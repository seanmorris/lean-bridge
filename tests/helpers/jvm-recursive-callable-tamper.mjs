/**
 * Cold recursive JVM validation and authenticated native-asset tamper checks.
 *
 * @file
 */
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { join, dirname, delimiter } from 'node:path';
import { sha256 } from '../../src/capsule/node.mjs';
import { createDeterministicZip } from '../../src/release/deterministic-zip.mjs';
import { saveLakeFile } from './lake-workspace.mjs';
import { copiedCleanEnvironment, runCopied } from './copied-fixture-install.mjs';
import { javaCompilerOptions, kotlinCompilerOptions } from './type-corpus-jvm-tools.mjs';

/**
 * Compile against the original JAR and corrupt one native resource per private copy.
 *
 * @param options - Original installed package and private scratch space.
 * @param options.root - Workspace owned by this test.
 * @param options.installedJar - Original unmodified Maven artifact.
 * @param options.classpath - Maven-resolved original package and dependencies.
 * @param options.environment - Selected Java and Kotlin compiler tools.
 * @param options.diagnostic - Progress callback.
 */
export const checkJvmRecursiveTamper = async ({ root: work, installedJar: jar, classpath, environment, diagnostic }) => {
	const originalSha256 = sha256(await readFile(jar));
	const java = await readFile('tests/fixtures/structured-callable-consumers/java-recursive-cold.java', 'utf8');
	const kotlin = await readFile('tests/fixtures/structured-callable-consumers/kotlin-recursive-cold.kt', 'utf8');
	const kotlinHome = dirname(dirname(environment.LEAN_BRIDGE_KOTLINC));
	const resolved = classpath.split(delimiter); assert.equal(resolved[0], jar);
	const dependencies = resolved.slice(1); assert.ok(dependencies.length > 0);
	const extracted = join(work, 'copy'); await mkdir(extracted, { recursive: true });
	await runCopied('/usr/bin/unzip', ['-q', jar, '-d', extracted], work, copiedCleanEnvironment);
	await saveLakeFile(work, 'ColdJava.java', java); await saveLakeFile(work, 'ColdKotlin.kt', kotlin);
	await runCopied(environment.LEAN_BRIDGE_JAVAC, [...javaCompilerOptions, '-classpath', classpath, '-d', 'classes', 'ColdJava.java'], work, copiedCleanEnvironment);
	await runCopied(environment.LEAN_BRIDGE_JAVA, ['-classpath'
		, join(kotlinHome, 'lib/*')
		, 'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler'
		, '-kotlin-home'
		, kotlinHome
		, ...kotlinCompilerOptions
		, '-jdk-home'
		, dirname(dirname(environment.LEAN_BRIDGE_JAVA))
		, '-classpath'
		, classpath
		, '-d'
		, 'classes'
		, 'ColdKotlin.kt'], work, copiedCleanEnvironment);
	const observations = [];
	const run = async (archive, mode, asset = null) => {
		for(const profile of ['java', 'kotlin'])
		{
			const temp = await mkdtemp(join(work, 'native-temp-'));
			const result = await runCopied(environment.LEAN_BRIDGE_JAVA, ['--enable-native-access=ALL-UNNAMED'
				, '-Djava.io.tmpdir=' + temp
				, '-classpath'
				, ['classes', archive, ...dependencies].join(delimiter)
				, profile === 'java' ? 'ColdJava' : 'ColdKotlinKt'
				, mode], work, copiedCleanEnvironment);
			assert.equal(result.stderr, ''); assert.equal(result.stdout, mode + ' ' + (mode === 'valid' ? 11 : 10) + '\n'); assert.deepEqual(await readdir(temp), []);
			observations.push({ profile, mode, asset, checks: mode === 'valid' ? 11 : 10, stdout: result.stdout, archiveSha256: sha256(await readFile(archive)) });
			diagnostic('native asset check ' + profile + '/' + mode + (asset ? ': ' + asset : ''));
		}
	};
	await run(jar, 'valid');
	const receipt = JSON.parse(await readFile(join(extracted, 'META-INF/lean-bridge/package-receipt.json'), 'utf8'));
	const assets = Object.keys(receipt.files).filter(path => path.startsWith('META-INF/lean-bridge/native/linux-x64/')); assert.equal(assets.length, 4);
	for(const asset of assets)
	{
		const original = await readFile(join(extracted, asset)); assert.equal(sha256(original), receipt.files[asset].sha256);
		const changed = Buffer.from(original); changed[changed.length - 1] ^= 1; await saveLakeFile(extracted, asset, changed);
		const mutated = join(work, 'tampered-' + asset.split('/').at(-1) + '.jar');
		await saveLakeFile(work, mutated.split('/').at(-1), await createDeterministicZip({ directory: extracted, sourceDateEpoch: 315532800 }));
		await saveLakeFile(extracted, asset, original);
		await run(mutated, 'tamper', asset);
		await rm(mutated);
	}
	assert.equal(sha256(await readFile(jar)), originalSha256);
	for(const [file, identity] of Object.entries(receipt.files)) assert.equal(sha256(await readFile(join(extracted, file))), identity.sha256, file);
	return { originalSha256, originalPackagesUnchanged: true, sourceHashes: { java: sha256(java), kotlin: sha256(kotlin) }, observations };
};
