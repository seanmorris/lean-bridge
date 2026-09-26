/**
 * Reply-scope and malformed-output retirement mutation checks for JVM callbacks.
 *
 * @file
 */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, cp, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { canonicalJson, sha256 } from '../../src/capsule/node.mjs';
import { compileJvmSources } from '../../src/build/compile-jvm-sources.mjs';
import { runCopied, copiedCleanEnvironment } from './copied-fixture-install.mjs';
import { saveLakeFile } from './lake-workspace.mjs';
import { captureCorpusCompiler } from './type-corpus-compiler.mjs';

/**
 * Check ownership invariants and deliberate defects in isolated source copies.
 *
 * @param options - Verified fault-probe inputs and private workspace.
 * @param options.root - Destination owned by this test.
 * @param options.input - Compiled fault-probe directory containing resources.
 * @param options.model - Recursive JVM graph model.
 * @param options.sources - Hashed instrumented sources from the fault probe.
 * @param options.environment - Selected native and JVM compilers.
 * @param options.diagnostic - Progress callback.
 */
export const checkJvmRecursiveOwnership = async ({ root, input, model, sources, environment, diagnostic }) => {
	const prefix = 'src/main/java/' + model.namespace.replaceAll('.', '/');
	const original = { ...sources }, sourceHashes = {};
	const shapes = ['Array', 'List', 'Option', 'Result', 'Tuple', 'Record', 'Variant', 'Alias', 'Recursive'];
	const selected = shapes.map(shape => model.functions.find(fn => fn.publicName === 'call' + shape));
	const observations = [];
	for(const mode of ['baseline', 'reply-scope', 'retirement'])
	{
		const work = join(root, mode), files = { ...original };
		let runtime = files[prefix + '/_CallableGraphRuntime.java'];
		if(mode === 'reply-scope')
		{
			const pattern = /( {12}var reply = _GraphRuntime.write\([^\n]+, )frame.replies(\);\n {12}java.lang.foreign.MemorySegment.copy[^\n]+;)/g;
			assert.equal([...runtime.matchAll(pattern)].length, 36);
			runtime = runtime.replace(pattern, '            try (var premature = new _GraphRuntime.Scope(false)) {\n$1premature$2\n            }');
		}
		if(mode === 'retirement')
		{
			const pattern = /links.lifecycle\(\).poison\(\);/g; assert.equal([...runtime.matchAll(pattern)].length, 102);
			runtime = runtime.replace(pattern, '/* deliberate missing-retirement mutation */');
			files[prefix + '/GraphFaultCases.java'] = files[prefix + '/GraphFaultCases.java'].replace('check(GraphFaultProbe.nativeCount("retired") == 1);', 'if(GraphFaultProbe.nativeCount("retired") != 1) throw new AssertionError("retirement missing after malformed output");');
		}
		files[prefix + '/_CallableGraphRuntime.java'] = runtime;
		files[prefix + '/GraphFaultProbe.java'] = files[prefix + '/GraphFaultProbe.java']
			.replace('static final List<Arena> arenas', 'static final List<MemorySegment> storage = new ArrayList<>();\n    static final List<Arena> arenas')
			.replace('return arena.allocate(size, alignment);', 'var memory = arena.allocate(size, alignment); storage.add(memory); return memory;');
		files[prefix + '/GraphOwnership.java'] = await readFile('tests/fixtures/structured-callable-consumers/jvm-recursive-GraphOwnership.java', 'utf8');
		files[prefix + '/OwnershipSetup.java'] = 'package ' + model.namespace + ';\nfinal class OwnershipSetup { private OwnershipSetup() {}\n'
			+ 'static final String[] SHAPES = {' + shapes.map(JSON.stringify).join(',') + '};\n'
			+ 'static final int[] NODES = {' + selected.map(fn => fn.parameters[0].node.index).join(',') + '};\n'
			+ 'static final int[] CALLBACKS = {' + selected.map(fn => fn.parameters[1].callback.index).join(',') + '};\n}\n';
		for(const [file, source] of Object.entries(files)) await saveLakeFile(work, file, source);
		await cp(join(input, 'resources'), join(work, 'resources'), { recursive: true });
		diagnostic('compile isolated ownership mutation: ' + mode);
		await compileJvmSources({ root: work, files, environment });
		const kotlin = join(dirname(dirname(environment.LEAN_BRIDGE_KOTLINC)), 'lib/kotlin-stdlib.jar');
		for(const profile of ['java', 'kotlin'])
		{
			const temp = await mkdtemp(join(work, 'native-temp-'));
			const args = ['--enable-native-access=ALL-UNNAMED'
				, '-Xmx512m'
				, '-Djava.io.tmpdir=' + temp
				, '-classpath'
				, 'classes:resources:' + kotlin
				, model.namespace + '.' + (mode === 'retirement' ? 'GraphFaultCases' : 'GraphOwnership')
				, profile
				, mode === 'retirement' ? 'poison' : mode];
			let result;
			if(mode === 'retirement')
			{
				const failed = await captureCorpusCompiler(environment.LEAN_BRIDGE_JAVA, args, work, copiedCleanEnvironment);
				assert.equal(failed.code, 1, failed.stderr); assert.equal(failed.stdout, ''); assert.match(failed.stderr, /java.lang.AssertionError: retirement missing after malformed output/);
				assert.ok(!/SIG|fatal error|A fatal|hs_err|timed out/.test(failed.stderr)); result = { rejected: true, exitCode: failed.code, stderr: failed.stderr };
			} else
			{
				const run = await runCopied(environment.LEAN_BRIDGE_JAVA, args, work, copiedCleanEnvironment); assert.equal(run.stderr, ''); result = JSON.parse(run.stdout);
				assert.equal(result.checks, mode === 'baseline' ? 9 : 1); assert.equal(result.errors.length, mode === 'baseline' ? 0 : 8); assert.equal(result.checkedBeforeDecode, true);
			}
			assert.deepEqual(await readdir(temp), []); observations.push({ profile, mode, ...result }); diagnostic('ownership ' + profile + '/' + mode + ': ' + (result.checks ?? result.exitCode));
		}
		sourceHashes[mode] = Object.fromEntries(Object.entries(files).map(([file, text]) => [file, sha256(text)]));
		await saveLakeFile(work, 'source-hashes.json', canonicalJson(sourceHashes[mode]));
	}
	return { checkedBeforeDecode: true, observations, sourceHashes };
};
