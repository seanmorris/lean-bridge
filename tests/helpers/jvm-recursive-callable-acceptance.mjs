/**
 * Fresh Maven-only authors, original offline installs and runtime-only JVM consumers.
 *
 * @file
 */
import assert from 'node:assert/strict';
import { cp, mkdir, readFile, readdir, rm, statfs } from 'node:fs/promises';
import { join } from 'node:path';
import { canonicalJson, sha256 } from '../../src/capsule/node.mjs';
import { buildCanonicalProject } from '../../src/build/canonical-build.mjs';
import { ordinaryJvmEvidence } from '../../src/build/native-jvm-artifacts.mjs';
import { nativeArtifactPaths } from '../../src/build/native-artifacts.mjs';
import { packageOrdinaryMaven } from '../../src/release/native-maven.mjs';
import { verifyPackageSetReceipt } from '../../src/release/package-set-receipt.mjs';
import { nativeRecursiveCallableExports, nativeRecursiveCallableArities, nativeRecursiveCallableReviewedIr } from './native-recursive-callable-fixture.mjs';
import { nativeFixtureEnvironment, copiedCleanEnvironment, runCopied } from './copied-fixture-install.mjs';
import { saveLakeFile, lakeInputState } from './lake-workspace.mjs';
import { copyPackageSetHandoff } from './package-set.mjs';
import { prepareJvmCorpusDependencies } from './type-corpus-jvm-tools.mjs';
import { installedJvmCorpus } from './type-corpus-jvm.mjs';
import { jvmStructuredCallableConsumer, jvmStructuredCallableRejections } from './jvm-structured-callable-fixture.mjs';
import { jvmRecursiveMixedFixture, jvmRecursiveMixedConsumer, jvmRecursiveMixedRejections, jvmRecursiveAcyclicExample } from './jvm-recursive-callable-mixed.mjs';
import { jvmRecursiveCallableRejections } from './jvm-recursive-callable-types.mjs';
import { jvmRecursiveCallableDocumentation } from './jvm-recursive-callable-docs.mjs';
import { checkJvmRecursiveProbes } from './jvm-recursive-callable-probes.mjs';
import { checkJvmRecursiveTamper } from './jvm-recursive-callable-tamper.mjs';

const json = async path => JSON.parse(await readFile(path, 'utf8'));
const digest = async path => sha256(await readFile(path));
const snapshot = async root => Object.fromEntries(await Promise.all(
	(await nativeArtifactPaths(root)).map(async path => [path, await digest(join(root, path))])));

/**
 * Build both compiler paths and consume unchanged archives after removing producers.
 *
 * @param directory - Task-owned temporary destination.
 * @param diagnostic - Progress callback for native builds and isolated probes.
 * @param includeMixed - Include all primitive callbacks and sixteen-argument Unit functions.
 */
export const checkJvmRecursiveCallables = async (directory, diagnostic = () => { }, includeMixed = false) => {
	await mkdir(directory, { recursive: true });
	const environment = nativeFixtureEnvironment(['java', 'kotlin']);
	const documentation = await jvmRecursiveCallableDocumentation();
	const mixed = includeMixed ? await jvmRecursiveMixedFixture(documentation.source) : null;
	const ir = mixed?.ir ?? nativeRecursiveCallableReviewedIr();
	const expectedExports = mixed ? 98 : 33, expectedSignatures = mixed ? 59 : 18;
	const docRoot = join(directory, 'documentation');
	await saveLakeFile(docRoot, 'Structured.lean', documentation.author);
	const checked = await runCopied(join(environment.LEAN_BRIDGE_LEAN_PREFIX, 'bin/lean'), ['Structured.lean'], docRoot, environment);
	assert.equal(checked.stdout, ''); assert.equal(checked.stderr, '');
	await rm(docRoot, { recursive: true, force: true });
	const examples = {};
	for(const profile of ['java', 'kotlin'])
	{
		examples[profile] = {
			id: 'recursive-public-consumer'
			, main: 'RecursiveChecks'
			, file: 'RecursiveChecks.' + (profile === 'java' ? 'java' : 'kt')
			, source: await readFile('tests/fixtures/structured-callable-consumers/' + profile + '-recursive.' + (profile === 'java' ? 'java' : 'kt'), 'utf8')
			, stdout: JSON.stringify({ profile, recursiveChecks: profile === 'java' ? 661 : 658 }) + '\n'
		};
	}
	const reports = [];
	for(const reviewed of [false, true])
	{
		const space = await statfs(directory);
		assert.ok(Number(space.bavail) * Number(space.bsize) >= 2 * 1024 ** 3, 'Recursive Maven acceptance needs 2 GiB free');
		const path = reviewed ? 'reviewed' : 'ordinary', work = join(directory, path);
		const author = join(work, 'author'), projectRoot = join(author, 'project'), outputRoot = join(author, 'release');
		const handoff = join(work, 'handoff'), headers = join(work, 'runtime-headers');
		await cp('tests/fixtures/onboarding/structured-callables', projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, 'Structured.lean', mixed?.source ?? documentation.source);
		await saveLakeFile(projectRoot, 'lean-bridge.exports.json', canonicalJson({
			schemaVersion: 1
			, modules: ['Structured']
			, targets: { maven: { name: 'org.leanbridge:structured', version: '1.0.0' } }
			, ...reviewed ? {} : { exports: mixed?.exports ?? nativeRecursiveCallableExports, arities: mixed?.arities ?? nativeRecursiveCallableArities }
		}));
		if(reviewed) await saveLakeFile(projectRoot, 'structured.binding-ir.json', canonicalJson(ir));
		const before = await lakeInputState(projectRoot), producerSources = await snapshot(projectRoot);
		diagnostic(path + ': building Maven-only ' + (mixed ? 'mixed' : 'recursive') + ' package');
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ['maven'], environment })
			.catch(error => { error.message += ': ' + JSON.stringify(error.details); throw error; });
		assert.deepEqual(await lakeInputState(projectRoot), before);
		assert.deepEqual(built.targets, ['maven']);
		const nativeRoot = join(outputRoot, 'native/component'), runtimeRoot = join(outputRoot, 'native/runtime');
		const adapterRoot = join(outputRoot, 'native/c-binding'), jvmRoot = join(outputRoot, 'native/jvm');
		const { model, projection, adapter } = await ordinaryJvmEvidence({ nativeRoot, runtimeRoot, adapterRoot });
		assert.equal(model.copiedGraph.callbacks.length, expectedSignatures);
		assert.equal(projection.functions.length, expectedExports);
		assert.equal(adapter.gmp, undefined); assert.equal(adapter.files['include/structured.h'], undefined);
		assert.equal((await json(join(jvmRoot, 'binding-manifest.json'))).generator, 'jvm-callable-graph-v1');
		const repeated = await packageOrdinaryMaven({
			working: join(author, 'repacked')
			, jvmRoot
			, nativeRoot
			, runtimeRoot
			, adapterRoot
			, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
			, settings: { name: 'org.leanbridge:structured', version: '1.0.0' }
			, glibcMinimumVersion: environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? '2.38'
		});
		assert.deepEqual(repeated.packages, built.packages);
		for(const pkg of repeated.packages) assert.equal(pkg.compilerAccess, false);
		const packageSet = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, 'package-set-receipt.json') });
		assert.equal(packageSet.packages.length, 1);
		const pkg = packageSet.packages[0]; assert.equal(pkg.target, 'maven');
		const handoffSha256 = await digest(join(handoff, 'package-set-receipt.json'));
		for(const artifact of pkg.artifacts) assert.equal(await digest(join(handoff, artifact.path)), artifact.sha256);
		const dependencies = await prepareJvmCorpusDependencies({ directory: author, handoff, pkg, environment, clean: copiedCleanEnvironment });
		if(!mixed) await cp(join(runtimeRoot, 'include'), headers, { recursive: true });
		await rm(author, { recursive: true, force: true });
		await assert.rejects(() => readdir(author), { code: 'ENOENT' });
		const consumers = [];
		for(const profile of ['java', 'kotlin'])
		{
			const localHandoff = join(work, 'handoff-' + profile);
			await cp(handoff, localHandoff, { recursive: true });
			diagnostic(path + '/' + profile + ': offline original JAR, typed callers and runtime-only relocation');
			const fixture = {
				source: mixed ? jvmRecursiveMixedConsumer : jvmStructuredCallableConsumer
				, signatures: () => canonicalJson(ir.declarations)
				, rejections: selected => [...(mixed ? jvmRecursiveMixedRejections(selected) : jvmStructuredCallableRejections(selected)), ...jvmRecursiveCallableRejections(selected)]
				, examples: selected => [examples[selected], documentation.examples[selected], ...mixed ? [jvmRecursiveAcyclicExample(selected)] : []]
				, removeHandoffBeforeExecution: true
				, inspectInstalled: !mixed && profile === 'java' ? async installed => {
					const probeRoot = join(work, 'isolated-probes');
					const probes = await checkJvmRecursiveProbes({ ...installed, root: probeRoot, headers, environment, diagnostic });
					const tamperRoot = join(work, 'isolated-tamper');
					const tamper = await checkJvmRecursiveTamper({ ...installed, root: tamperRoot, environment, diagnostic });
					await rm(probeRoot, { recursive: true, force: true });
					await rm(tamperRoot, { recursive: true, force: true });
					await rm(headers, { recursive: true, force: true });
					return { probes, tamper };
				} : undefined
			};
			const result = await installedJvmCorpus({
				library: { name: 'Structured', jvmModule: 'org.leanbridge.structured' }
				, profile
				, consumer: join(work, 'consumers')
				, handoff: localHandoff
				, pkg
				, dependencies
				, environment
				, clean: copiedCleanEnvironment
				, fixture
			}).catch(error => { error.message += ': ' + JSON.stringify(error.details); throw error; });
			const assertion = result.observation.results.find(item => item.id === (mixed ? 'callables/assertions' : 'structured/assertions'));
			const checks = Number(assertion.observed.integer);
			assert.equal(checks, mixed ? (profile === 'java' ? 66701 : 66673) : (profile === 'java' ? 257978 : 177270));
			const rejections = result.observation.results.filter(item => item.status === 'rejected-at-compile-time');
			assert.equal(rejections.length, (profile === 'java' ? 23 : 27) + (mixed ? 6 : 0));
			consumers.push({ profile, ...result });
			diagnostic(path + '/' + profile + ': ' + checks + ' checks and ' + rejections.length + ' typed rejections passed');
		}
		reports.push({
			path
			, reviewed
			, mavenOnly: true
			, freshAuthor: true
			, exports: expectedExports
			, signatures: expectedSignatures
			, producerSources
			, packages: packageSet.packages
			, handoffSha256
			, bindingIrSha256: model.bindingIrSha256
			, layoutSha256: projection.layoutSha256
			, producerRemovedBeforeInstall: true
			, deterministicReassembly: true
			, consumers
			, documentation: { authorSha256: sha256(documentation.author), configurationSha256: sha256(documentation.configuration), standaloneLeanChecked: true, compiledVerbatim: true }
		});
		await rm(work, { recursive: true, force: true });
	}
	return { schemaVersion: 1, mixed: includeMixed, reports };
};
