/**
 * Fresh Composer-only authors and unchanged, offline recursive PHP consumers.
 *
 * @file
 */
import assert from 'node:assert/strict';
import { cp, mkdir, readFile, readdir, rm, statfs } from 'node:fs/promises';
import { join } from 'node:path';
import { canonicalJson, sha256 } from '../../src/capsule/node.mjs';
import { buildCanonicalProject } from '../../src/build/canonical-build.mjs';
import { nativeArtifactPaths, verifyNativeFiles } from '../../src/build/native-artifacts.mjs';
import { ordinaryPhpEvidence } from '../../src/build/native-php-artifacts.mjs';
import { packageOrdinaryPhp } from '../../src/release/native-composer.mjs';
import { verifyPackageSetReceipt } from '../../src/release/package-set-receipt.mjs';
import { nativeRecursiveCallableExports, nativeRecursiveCallableArities, nativeRecursiveCallableReviewedIr } from './native-recursive-callable-fixture.mjs';
import { jvmRecursiveMixedFixture } from './jvm-recursive-callable-mixed.mjs';
import { saveLakeFile, lakeInputState } from './lake-workspace.mjs';
import { copyPackageSetHandoff } from './package-set.mjs';
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from './copied-fixture-install.mjs';
import { installedPhpCorpus } from './type-corpus-php.mjs';
import { validateBrickMathInstall } from './brick-math.mjs';
import { phpRecursiveCallableDocumentation } from './php-recursive-callable-docs.mjs';
import { checkPhpRecursiveProbes } from './php-recursive-callable-probes.mjs';
import { checkPhpRecursiveTamper } from './php-recursive-callable-tamper.mjs';

const digest = async path => sha256(await readFile(path));
const snapshot = async root => Object.fromEntries(await Promise.all(
	(await nativeArtifactPaths(root)).map(async path => [path, await digest(join(root, path))])));

/**
 * Build both compiler paths and run original installed archives without producers.
 *
 * @param directory - Task-owned temporary destination.
 * @param diagnostic - Progress callback for native builds and probes.
 * @param includeMixed - Include all primitive callback families and wide Unit calls.
 */
export const checkPhpRecursiveCallables = async (directory, diagnostic = () => { }, includeMixed = false) => {
	await mkdir(directory, { recursive: true });
	const environment = {
		...nativeFixtureEnvironment(['php-native'])
		, LEAN_BRIDGE_PHP: process.env.LEAN_BRIDGE_PHP ?? '/usr/bin/php'
		, LEAN_BRIDGE_COMPOSER: process.env.LEAN_BRIDGE_COMPOSER ?? '/usr/bin/composer'
	};
	const documentation = await phpRecursiveCallableDocumentation();
	const docRoot = join(directory, 'documentation');
	await saveLakeFile(docRoot, 'Structured.lean', documentation.author);
	const checked = await runCopied(join(environment.LEAN_BRIDGE_LEAN_PREFIX, 'bin/lean'), ['Structured.lean'], docRoot, environment);
	assert.equal(checked.stdout, ''); assert.equal(checked.stderr, '');
	await saveLakeFile(docRoot, 'recursive-callbacks.php', documentation.example.source);
	const mixed = includeMixed ? await jvmRecursiveMixedFixture(documentation.source) : null;
	const ir = mixed?.ir ?? nativeRecursiveCallableReviewedIr(), reports = [];
	const consumerSource = await readFile('tests/fixtures/structured-callable-consumers/php-recursive.php', 'utf8');
	for(const reviewed of [false, true])
	{
		const space = await statfs(directory);
		assert.ok(Number(space.bavail) * Number(space.bsize) >= 2 * 1024 ** 3, 'Recursive Composer acceptance needs 2 GiB free');
		const path = reviewed ? 'reviewed' : 'ordinary', root = join(directory, path), author = join(root, 'author');
		const projectRoot = join(author, 'project'), outputRoot = join(author, 'release'), handoff = join(root, 'handoff');
		await cp('tests/fixtures/onboarding/structured-callables', projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, 'Structured.lean', mixed?.source ?? documentation.source);
		await saveLakeFile(projectRoot, 'lean-bridge.exports.json', canonicalJson({
			schemaVersion: 1
			, modules: ['Structured']
			, targets: { 'php-native': { name: 'lean-bridge/structured', version: '1.0.0' } }
			, ...reviewed ? {} : { exports: mixed?.exports ?? nativeRecursiveCallableExports, arities: mixed?.arities ?? nativeRecursiveCallableArities }
		}));
		if(reviewed) await saveLakeFile(projectRoot, 'structured.binding-ir.json', canonicalJson(ir));
		const before = await lakeInputState(projectRoot), producerSources = await snapshot(projectRoot);
		diagnostic(path + ': building Composer-only ' + (includeMixed ? 'mixed' : 'recursive') + ' package');
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ['php-native'], environment })
			.catch(error => { error.message += ': ' + JSON.stringify(error.details); throw error; });
		assert.deepEqual(await lakeInputState(projectRoot), before); assert.deepEqual(built.targets, ['php-native']);
		const nativeRoot = join(outputRoot, 'native/component'), runtimeRoot = join(outputRoot, 'native/runtime'), adapterRoot = join(outputRoot, 'native/c-binding');
		const { model, adapter, evidence } = await ordinaryPhpEvidence({ nativeRoot, runtimeRoot, adapterRoot });
		assert.equal(model.copiedGraph.callbacks.length, includeMixed ? 59 : 18); assert.equal(model.exports.length, includeMixed ? 98 : 33);
		assert.equal(adapter.files['include/structured.h'], undefined); assert.equal(adapter.gmp, undefined);
		const repeated = await packageOrdinaryPhp({
			working: join(author, 'repackaged')
			, nativeRoot
			, runtimeRoot
			, adapterRoot
			, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
			, settings: { name: 'lean-bridge/structured', version: '1.0.0' }
			, glibcMinimumVersion: environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? '2.38'
			, environment: { ...copiedCleanEnvironment, LEAN_BRIDGE_PHP: environment.LEAN_BRIDGE_PHP }
		});
		assert.deepEqual(repeated.packages, built.packages);
		const packageSet = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, 'package-set-receipt.json') });
		const handoffSha256 = await digest(join(handoff, 'package-set-receipt.json'));
		assert.equal(packageSet.packages.length, 1); const pkg = packageSet.packages[0]; assert.equal(pkg.target, 'php-native');
		for(const artifact of pkg.artifacts) assert.equal(await digest(join(handoff, artifact.path)), artifact.sha256);
		await rm(author, { recursive: true, force: true }); await assert.rejects(() => readdir(author), { code: 'ENOENT' });
		diagnostic(path + ': offline Composer install, then remove handoff and execute weak/strict relocated consumers');
		const consumer = join(root, 'consumer');
		const { php, observation } = await installedPhpCorpus({
			library: { phpModule: 'LeanStructured' }
			, consumer
			, handoff
			, pkg
			, environment
			, clean: copiedCleanEnvironment
			, sourcePath: reviewed ? 'reviewed-ir' : 'ordinary-source'
			, fixture: {
				source: mode => consumerSource.replace('strict_types=0', 'strict_types=' + (mode === 'strict' ? 1 : 0))
				, request: path => canonicalJson({ path, mixed: includeMixed })
				, removeHandoff: true
			}
		}).catch(error => { error.message += ': ' + JSON.stringify(error.details); throw error; });
		await assert.rejects(() => readdir(handoff), { code: 'ENOENT' }); validateBrickMathInstall(php, php.deployment);
		for(const entry of php.executions)
		{
			assert.equal(entry.observation.checks, includeMixed ? 1249 : 1130);
			assert.equal(entry.observation.rejections, 389);
			assert.equal(entry.observation.compiledLean, true); assert.equal(entry.observation.installedPackage, true);
			assert.equal(entry.observation.actualPhpBits, 64); assert.equal(Object.keys(entry.observation.nativeLibraries).length, 4);
		}
		const installed = join(consumer, 'php-native/relocated');
		const docResult = await runCopied(environment.LEAN_BRIDGE_PHP, [...php.runtimeOptions, '-r', 'eval("?>".file_get_contents($argv[1]));', join(docRoot, 'recursive-callbacks.php')], installed);
		assert.equal(docResult.stdout, documentation.example.stdout); assert.equal(docResult.stderr, '');
		const inspection = includeMixed ? undefined : {
			probes: await checkPhpRecursiveProbes({ root: join(root, 'probes'), installed, php, nativeEvidence: evidence, environment, diagnostic })
			, tamper: await checkPhpRecursiveTamper({ root: join(root, 'tamper'), installed, php, environment })
		};
		const afterProbes = [];
		for(const mode of ['weak', 'strict'])
		{
			const result = await runCopied(environment.LEAN_BRIDGE_PHP, [...php.runtimeOptions, mode + '.php'], installed);
			assert.equal(result.stderr, ''); const observed = JSON.parse(result.stdout);
			assert.deepEqual(observed, observation); afterProbes.push({ mode, observation: observed });
		}
		assert.deepEqual((await nativeArtifactPaths(installed)).sort(), Object.keys(php.deployment).sort());
		await verifyNativeFiles(installed, php.deployment);
		reports.push({
			path
			, reviewed
			, composerOnly: true
			, freshAuthor: true
			, exports: model.exports.length
			, signatures: model.copiedGraph.callbacks.length
			, producerSources
			, package: pkg
			, handoffSha256
			, sourceRemovedBeforeInstallation: true
			, handoffRemovedBeforeExecution: true
			, compilerFreeReassembly: true
			, deterministicReassembly: true
			, bindingIr: model.bindingIr
			, nativeEvidence: evidence
			, probeSha256: sha256(consumerSource)
			, php
			, observation
			, afterProbes
			, inspection
			, documentation: {
				authorSha256: sha256(documentation.author)
				, configurationSha256: sha256(documentation.configuration)
				, consumerSha256: sha256(documentation.example.source)
				, standaloneLeanChecked: true
				, compiledVerbatim: true
				, stdout: docResult.stdout
				, archiveSha256: php.archiveSha256
			}
		});
		diagnostic(path + ': ' + observation.checks + ' public checks passed; original installed package unchanged');
		await rm(root, { recursive: true, force: true });
	}
	return { schemaVersion: 1, mixed: includeMixed, reports };
};
