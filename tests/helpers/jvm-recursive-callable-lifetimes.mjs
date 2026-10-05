/**
 * Installed-source native JVM closure lifetime checks with an explicit PID simulation.
 *
 * @file
 */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, cp, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { sha256 } from '../../src/capsule/node.mjs';
import { compileJvmSources } from '../../src/build/compile-jvm-sources.mjs';
import { runCopied, copiedCleanEnvironment } from './copied-fixture-install.mjs';
import { saveLakeFile } from './lake-workspace.mjs';

/**
 * Exercise native ownership, Throwable identity, thread guards and Cleaner recovery.
 *
 * @param options - Verified source copies and private workspace.
 * @param options.root - Destination owned by this test.
 * @param options.input - Fault-probe directory containing authenticated resources.
 * @param options.model - Recursive JVM graph model.
 * @param options.sources - Verified instrumented source files.
 * @param options.environment - Selected JVM compilers.
 * @param options.diagnostic - Progress callback.
 */
export const checkJvmRecursiveLifetimes = async ({ root: work, input, model, sources, environment, diagnostic }) => {
	const files = { ...sources }, prefix = 'src/main/java/' + model.namespace.replaceAll('.', '/') + '/';
	const callback = model.functions.find(fn => fn.publicName === 'callRecursive').parameters[1].callback;
	files[prefix + 'GraphFaultProbe.java'] = files[prefix + 'GraphFaultProbe.java'].replace('static boolean active;', 'static boolean active, fakeFork;');
	const old = 'return (int)PID.invokeExact();'; assert.equal(files[prefix + '_CallableGraphRuntime.java'].split(old).length, 2);
	files[prefix + '_CallableGraphRuntime.java'] = files[prefix + '_CallableGraphRuntime.java'].replace(old, 'return (int)PID.invokeExact() + (GraphFaultProbe.fakeFork ? 1 : 0);');
	files[prefix + 'GraphLifetime.java'] = await readFile('tests/fixtures/structured-callable-consumers/jvm-recursive-GraphLifetime.java', 'utf8');
	files[prefix + 'GraphMarker.java'] = 'package ' + model.namespace + ';\nfinal class GraphMarker { private GraphMarker() {}\n'
		+ 'static Object callback(boolean kotlin, Throwable marker, int[] count) {\n'
		+ 'if(kotlin)return (' + callback.kotlinJavaName + ')(value -> { ++count[0]; throw GraphFaultProbe.raise(marker); });\n'
		+ 'return (' + callback.publicName + ')(value -> { ++count[0]; throw GraphFaultProbe.raise(marker); });\n}\n}\n';
	for(const [file, source] of Object.entries(files)) await saveLakeFile(work, file, source);
	await cp(join(input, 'resources'), join(work, 'resources'), { recursive: true });
	await compileJvmSources({ root: work, files, environment });
	const kotlin = join(dirname(dirname(environment.LEAN_BRIDGE_KOTLINC)), 'lib/kotlin-stdlib.jar'), observations = [];
	for(const profile of ['java', 'kotlin'])
	{
		const temp = await mkdtemp(join(work, 'native-temp-'));
		const result = await runCopied(environment.LEAN_BRIDGE_JAVA, ['--enable-native-access=ALL-UNNAMED', '-Xmx512m', '-Djava.io.tmpdir=' + temp, '-classpath', 'classes:resources:' + kotlin, model.namespace + '.GraphLifetime', profile], work, copiedCleanEnvironment);
		assert.equal(result.stderr, ''); const observation = JSON.parse(result.stdout); assert.deepEqual(await readdir(temp), []);
		assert.equal(observation.identities, 0); assert.equal(observation.capacity, 4096); assert.equal(observation.recovered, 8192); assert.equal(observation.cleaner, true); assert.equal(observation.actualFork, false);
		assert.equal(observation.checks, 8235); assert.equal(observation.simulatedFork, true);
		observations.push(observation); diagnostic('lifetimes ' + profile + ': ' + observation.checks + ' checks');
	}
	return { observations, sources: Object.fromEntries(Object.entries(files).map(([file, source]) => [file, sha256(source)])) };
};
