/**
 * Authenticate recursive JVM acceptance, unchanged installed archives and source history.
 *
 * @file
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { canonicalJson, sha256 } from '../../src/capsule/node.mjs';
import { readTypeSurface, typeSurfaceCells } from '../../src/adoption/type-surface.mjs';
import { assertDotnetRecursiveCallableIntegration } from './dotnet-recursive-callable-evidence.mjs';
import { dotnetRecursiveCallableHistoryPath } from './dotnet-recursive-callable-source-history.mjs';
import { assertJvmStructuredCallableExecution, jvmStructuredCallableExecutionPath } from './jvm-structured-callable-evidence.mjs';
import { assertJvmGraphPackageReports } from './jvm-graph-receipt.mjs';
import { jvmStructuredCallableConsumer, jvmStructuredCallableRejections } from './jvm-structured-callable-fixture.mjs';
import { nativeRecursiveCallableReviewedIr } from './native-recursive-callable-fixture.mjs';
import { jvmRecursiveMixedFixture, jvmRecursiveMixedConsumer, jvmRecursiveMixedRejections, jvmRecursiveAcyclicExample } from './jvm-recursive-callable-mixed.mjs';
import { jvmRecursiveCallableRejections } from './jvm-recursive-callable-types.mjs';
import { jvmRecursiveCallableDocumentation } from './jvm-recursive-callable-docs.mjs';
import { assertJvmRecursiveProbes } from './jvm-recursive-callable-faults.mjs';
import { jvmRecursiveCallableChangedPaths, reverseJvmRecursiveCallableUpdate } from './jvm-recursive-callable-source-history.mjs';

export const jvmRecursiveCallableBaseline = 'e3ebe7870a10e98d0215b3b09fc3910d719ddc0b';
export const jvmRecursiveCallableExecutionPath = 'docs/evidence/jvm-recursive-callables-20260926.json';
export const jvmRecursiveCallableScope = {
	profiles: ['java', 'kotlin']
	, paths: ['ordinary-source', 'reviewed-ir']
	, shapes: ['alias', 'array', 'list', 'option', 'record', 'recursive', 'result', 'tuple', 'variant']
	, positions: ['callback-parameter', 'callback-result']
	, recursiveCallbacks: true
	, ownedResourceAggregates: false
};
export const jvmRecursiveCallableAddedPaths = [
	jvmRecursiveCallableExecutionPath
	, 'docs/evidence/jvm-recursive-callables-20260926.md'
	, ...['model', 'runtime', 'calls', 'package'].map(name => `src/backends/jvm/callable-graph-${name}.mjs`)
	, ...['GraphFaultCases', 'GraphFaultProbe', 'GraphLifetime', 'GraphOwnership'].map(name => `tests/fixtures/structured-callable-consumers/jvm-recursive-${name}.java`)
	, ...['java', 'kotlin'].flatMap(profile => ['', '-cold'].map(suffix => `tests/fixtures/structured-callable-consumers/${profile}-recursive${suffix}.${profile === 'java' ? 'java' : 'kt'}`))
	, ...['acceptance', 'docs', 'faults', 'instrument', 'lifetimes', 'mixed', 'ownership', 'probes', 'tamper', 'types', 'evidence', 'source-history'].map(name => `tests/helpers/jvm-recursive-callable-${name}.mjs`)
	, 'tests/jvm-recursive-callable-contract.test.mjs'
	, 'tests/jvm-recursive-callable-evidence.test.mjs'
	, 'tests/jvm-recursive-callables.test.mjs'
].sort();
export const jvmRecursiveCallableProjectionPaths = [
	...['model', 'runtime', 'calls', 'package'].map(name => `src/backends/jvm/callable-graph-${name}.mjs`)
	, 'src/backends/jvm/copied-graph-assets.mjs'
	, 'src/backends/managed/package-audit.mjs'
	, 'src/build/compile-jvm-sources.mjs'
	, 'src/build/native-c-projection.mjs'
	, 'src/build/native-graph-projection.mjs'
	, 'src/build/native-jvm-artifacts.mjs'
	, 'src/build/native-jvm-projection.mjs'
	, 'src/release/native-maven.mjs'
].sort();
const hash = value => assert.match(value, /^[a-f0-9]{64}$/u);
const authenticated = async (entry, path) => {
	assert.equal(entry.path, path); const bytes = await readFile(path);
	assert.equal(sha256(bytes), entry.sha256); return JSON.parse(bytes);
};
const passing = (run, count) => {
	assert.equal(run.exitCode, 0); assert.equal(sha256(run.text), run.sha256);
	for(const [name, value] of Object.entries({ tests: count, pass: count, fail: 0, cancelled: 0, skipped: 0 }))
		assert.match(run.text, new RegExp('^# ' + name + ' ' + value + '$', 'mu'));
};
const files = inventory => {
	assert.ok(Object.keys(inventory).length > 0);
	for(const [path, entry] of Object.entries(inventory))
	{
		assert.ok(!path.startsWith('/') && !path.split('/').includes('..'));
		hash(entry.sha256); assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0);
	}
};

/**
 * Require all original package consumers, negative callers, faults and exact examples.
 *
 * @param record - Frozen terminal logs and installed execution reports.
 */
export const assertJvmRecursiveCallableExecution = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, 'jvm-recursive-callable-execution');
	assert.equal(record.baselineRevision, jvmRecursiveCallableBaseline);
	assert.deepEqual(record.scope, jvmRecursiveCallableScope);
	assert.deepEqual(Object.keys(record.installed).sort(), ['mixed', 'recursive']);
	for(const variant of ['recursive', 'mixed'])
	{
		const run = record.installed[variant]; passing(run, 1);
		assert.ok(run.command.includes('LEAN_BRIDGE_JVM_RECURSIVE_CALLABLE_TEST=1'));
		assert.ok(run.command.endsWith("node --test --test-name-pattern='original " + variant + "' tests/jvm-recursive-callables.test.mjs"));
		assert.doesNotMatch(run.command, /--import|loader/u);
	}
	passing(record.contract, 10);
	assert.equal(record.contract.command, 'node --test tests/jvm-recursive-callable-contract.test.mjs');
	const regressions = record.regressions;
	passing(regressions.primitive.installed, 1); passing(regressions.structured.installed, 1); passing(regressions.copied.installed, 10);
	for(const flag of ['PACKAGE', 'INSTALLED', 'REPRO', 'LOADING'])
		assert.ok(regressions.copied.installed.command.includes('LEAN_BRIDGE_JVM_GRAPH_' + flag + '_TEST=1'));
	assert.deepEqual(Object.keys(regressions.projectionSources).sort(), jvmRecursiveCallableProjectionPaths);
	for(const [path, digest] of Object.entries(regressions.projectionSources)) assert.equal(sha256(await readFile(path)), digest, path);
	assert.deepEqual(regressions.generatedEquivalence, {
		base: 'a689161035d23ec813faa8000ba60360fb2dc710840cddc3d96c291b36aee5cb'
		, mixed: 'd4001f41f718561b632d82252d1d7e5c76dfce167efa86e334c82b75fb948303'
		, copied: '7816866ada03a9092ee606dae2645adb0158ab8ce820585a86133cc815b7f25f'
	});
	const previous = await authenticated(record.previousJvmExecution, jvmStructuredCallableExecutionPath);
	await assertJvmStructuredCallableExecution({
		...previous
		, installed: regressions.structured.installed
		, reports: regressions.structured.reports
		, primitiveRegression: regressions.primitive.installed
		, primitiveReports: regressions.primitive.reports
	});
	assertJvmGraphPackageReports(regressions.copied.reports);
	const documentation = await jvmRecursiveCallableDocumentation(), mixed = await jvmRecursiveMixedFixture(documentation.source);
	for(const [isMixed, reports] of [[false, record.reports], [true, record.mixedReports]])
	{
		assert.deepEqual(reports.map(run => [run.path, run.reviewed]), [['ordinary', false], ['reviewed', true]]);
		for(const run of reports)
		{
			for(const key of ['freshAuthor', 'mavenOnly', 'producerRemovedBeforeInstall', 'deterministicReassembly']) assert.equal(run[key], true, key);
			assert.equal(run.exports, isMixed ? 98 : 33); assert.equal(run.signatures, isMixed ? 59 : 18);
			for(const key of ['bindingIrSha256', 'layoutSha256', 'handoffSha256']) hash(run[key]);
			assert.ok(Object.keys(run.producerSources).length > 0);
			for(const value of Object.values(run.producerSources)) hash(value);
			assert.equal(run.producerSources['Structured.lean'], sha256(isMixed ? mixed.source : documentation.source));
			assert.deepEqual(run.documentation, { authorSha256: sha256(documentation.author), configurationSha256: sha256(documentation.configuration), standaloneLeanChecked: true, compiledVerbatim: true });
			assert.equal(run.packages.length, 1); const pkg = run.packages[0];
			assert.equal(pkg.target, 'maven'); assert.equal(pkg.ecosystem, 'maven');
			assert.equal(pkg.name, 'org.leanbridge:structured'); assert.equal(pkg.version, '1.0.0');
			assert.equal(pkg.role, 'component'); assert.equal(pkg.runtimeDelivery, 'embedded'); assert.deepEqual(pkg.requires, []);
			assert.equal(pkg.artifacts.length, 2); hash(pkg.runtimeIdentity);
			const jar = pkg.artifacts.find(file => file.path.endsWith('.jar')), pom = pkg.artifacts.find(file => file.path.endsWith('.pom'));
			for(const artifact of [jar, pom])
			{ hash(artifact.sha256); assert.ok(artifact.bytes > 0); }
			assert.deepEqual(run.consumers.map(consumer => consumer.profile), ['java', 'kotlin']);
			for(const consumer of run.consumers)
			{
				const { profile, observation, jvm } = consumer;
				for(const key of ['offline', 'emptyRepository', 'emptyUserHome', 'resolvedClasspathOnly', 'installedSourcesRemoved', 'compilerFreeExecution', 'runtimeOnlyExecution', 'normalExitCleanup', 'repeatExecution', 'localLibraries', 'publicApiOnly', 'runtimeOverridesDisabled', 'exactPublicSignatures', 'handoffRemovedBeforeExecution']) assert.equal(jvm[key], true, key);
				assert.equal(jvm.archiveSha256, jar.sha256); assert.equal(jvm.pomSha256, pom.sha256);
				assert.deepEqual(jvm.deployment['package.jar'], { bytes: jar.bytes, sha256: jar.sha256 });
				assert.equal(jvm.bindingIrSha256, run.bindingIrSha256);
				assert.equal(jvm.signaturesSha256, sha256(canonicalJson((isMixed ? mixed.ir : nativeRecursiveCallableReviewedIr()).declarations)));
				assert.equal(jvm.consumerSourceSha256, sha256(isMixed ? jvmRecursiveMixedConsumer(profile) : jvmStructuredCallableConsumer(profile)));
				assert.deepEqual(jvm.runtimeModules, ['java.base@22.0.2']); assert.equal(jvm.javacVersion, 'javac 22.0.2');
				for(const [name, value] of Object.entries(jvm)) if(name.endsWith('Sha256')) hash(value);
				files(jvm.deployment); files(jvm.runtimeFiles); files(jvm.dependencies.files); hash(jvm.dependencies.sha256);
				assert.deepEqual(jvm.resolvedDependencies.map(entry => entry.mavenPath), ['org/jetbrains/kotlin/kotlin-stdlib/2.2.0/kotlin-stdlib-2.2.0.jar', 'org/jetbrains/annotations/13.0/annotations-13.0.jar']);
				for(const dependency of jvm.resolvedDependencies)
				{
					assert.equal(dependency.sha256, jvm.dependencies.files[dependency.mavenPath].sha256);
					assert.equal(jvm.deployment['dependencies/' + dependency.mavenPath.split('/').at(-1)].sha256, dependency.sha256);
				}
				assert.equal(Object.keys(jvm.nativeLibraries).length, 4);
				assert.deepEqual(observation.nativeLibraries, jvm.nativeLibraries);
				assert.equal(observation.profile, profile); assert.deepEqual(observation.errors, []); assert.equal(observation.nativeRootCount, 1);
				assert.match(observation.apiLocation, /\/relocated\/package\.jar$/u);
				const checks = observation.results.find(value => value.id === (isMixed ? 'callables/assertions' : 'structured/assertions'));
				assert.equal(checks.status, 'matched');
				assert.equal(Number(checks.observed.integer), isMixed ? (profile === 'java' ? 66701 : 66673) : (profile === 'java' ? 257978 : 177270));
				const rejected = observation.results.filter(value => value.status === 'rejected-at-compile-time');
				const expected = [...(isMixed ? jvmRecursiveMixedRejections(profile) : jvmStructuredCallableRejections(profile)), ...jvmRecursiveCallableRejections(profile)];
				assert.deepEqual(rejected.map(value => value.id), expected.map(value => value.id));
				for(const [index, rejection] of rejected.entries())
				{
					assert.equal(rejection.sourceSha256, sha256(expected[index].source));
					assert.deepEqual(rejection.diagnostics.map(value => value.code), [expected[index].expectation.diagnostic].flat());
					for(const diagnostic of rejection.diagnostics)
					{
						assert.ok(diagnostic.line > 0 && diagnostic.column > 0);
						assert.equal(diagnostic.file, 'src/reject-' + rejection.id.split('/')[1] + (profile === 'java' ? '.java' : '.kt'));
					}
				}
				const recursiveSource = await readFile('tests/fixtures/structured-callable-consumers/' + profile + '-recursive.' + (profile === 'java' ? 'java' : 'kt'), 'utf8');
				const examples = [{ id: 'recursive-public-consumer', source: recursiveSource, stdout: JSON.stringify({ profile, recursiveChecks: profile === 'java' ? 661 : 658 }) + '\n' }, documentation.examples[profile], ...isMixed ? [jvmRecursiveAcyclicExample(profile)] : []];
				assert.deepEqual(jvm.documentation, examples.map(example => ({ id: example.id, sourceSha256: sha256(example.source), stdout: example.stdout, archiveSha256: jar.sha256, sourceFreeExecution: true, runtimeOnlyExecution: true, normalExitCleanup: true })));
				if(isMixed || profile === 'kotlin') assert.equal(jvm.inspection, undefined);
				else
				{
					await assertJvmRecursiveProbes(jvm.inspection.probes, jvm);
					await assertTamper(jvm.inspection.tamper, jvm);
				}
			}
		}
	}
};
const assertTamper = async (report, jvm) => {
	assert.equal(report.originalPackagesUnchanged, true); assert.equal(report.originalSha256, jvm.archiveSha256);
	for(const profile of ['java', 'kotlin']) assert.equal(report.sourceHashes[profile], sha256(await readFile('tests/fixtures/structured-callable-consumers/' + profile + '-recursive-cold.' + (profile === 'java' ? 'java' : 'kt'))));
	const assets = Object.keys(jvm.nativeLibraries).sort().map(name => 'META-INF/lean-bridge/native/linux-x64/' + name);
	assert.deepEqual(report.observations.map(run => [run.profile, run.mode, run.asset]), [null, ...assets].flatMap(asset => ['java', 'kotlin'].map(profile => [profile, asset ? 'tamper' : 'valid', asset])));
	for(const run of report.observations)
	{
		assert.equal(run.checks, run.mode === 'valid' ? 11 : 10);
		assert.equal(run.stdout, run.mode + ' ' + run.checks + '\n'); hash(run.archiveSha256);
		if(run.mode === 'valid') assert.equal(run.archiveSha256, jvm.archiveSha256);
		else assert.notEqual(run.archiveSha256, jvm.archiveSha256);
	}
};

/**
 * Admit exactly eight JVM recursive callback cells while retaining every predecessor.
 *
 * @param record - Reversible source transitions and immutable execution reference.
 */
export const assertJvmRecursiveCallableIntegration = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, 'jvm-recursive-callable-integration');
	assert.equal(record.baselineRevision, jvmRecursiveCallableBaseline);
	assert.deepEqual(record.scope, jvmRecursiveCallableScope);
	assert.deepEqual(record.inventory, { previousVersion: '0.103.0', version: '0.104.0', previousInstalled: 4810, installed: 4818, total: 6562 });
	const previous = await authenticated(record.previous, dotnetRecursiveCallableHistoryPath);
	const execution = await authenticated(record.execution, jvmRecursiveCallableExecutionPath);
	await assertJvmRecursiveCallableExecution(execution);
	assert.deepEqual(record.updates.map(update => update.path).sort(), jvmRecursiveCallableChangedPaths);
	assert.deepEqual(Object.keys(record.additions).sort(), jvmRecursiveCallableAddedPaths);
	const paths = [...new Set([...Object.keys(previous.sourceHashes), ...jvmRecursiveCallableChangedPaths, ...jvmRecursiveCallableAddedPaths])].sort();
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), paths);
	for(const path of paths) assert.equal(sha256(await readFile(path, 'utf8')), record.sourceHashes[path], path);
	const restored = {};
	for(const update of record.updates)
	{
		assert.equal(update.currentSha256, record.sourceHashes[update.path]);
		if(previous.sourceHashes[update.path]) assert.equal(update.previousSha256, previous.sourceHashes[update.path]);
		restored[update.path] = reverseJvmRecursiveCallableUpdate(await readFile(update.path, 'utf8'), update);
	}
	for(const [path, digest] of Object.entries(record.additions)) assert.equal(digest, record.sourceHashes[path]);
	const { document, ...contracts } = await readTypeSurface(), old = JSON.parse(restored['docs/type-surface.v1.json']);
	assert.equal(document.contractVersion, '0.104.0'); assert.equal(old.contractVersion, '0.103.0');
	const cells = typeSurfaceCells(document, contracts), oldCells = typeSurfaceCells(old, contracts);
	const count = values => values.filter(cell => cell.stages.installedExecution.state === 'passed').length;
	assert.equal(count(cells), 4818); assert.equal(count(oldCells), 4810); assert.equal(cells.length, 6562);
	const promoted = cells.filter(cell => cell.stages.installedExecution.evidence.includes('jvm-recursive-callables-installed'));
	assert.equal(promoted.length, 8);
	for(const cell of promoted)
	{
		assert.ok(jvmRecursiveCallableScope.profiles.includes(cell.profile)); assert.equal(cell.shape, 'recursive');
		assert.ok(jvmRecursiveCallableScope.paths.includes(cell.path)); assert.ok(jvmRecursiveCallableScope.positions.includes(cell.position));
		assert.ok(cell.hostType && cell.conversionNote);
		for(const stage of Object.values(cell.stages)) assert.deepEqual({ state: stage.state, evidence: stage.evidence }, { state: 'passed', evidence: ['jvm-recursive-callables-installed'] });
	}
	const oldById = new Map(oldCells.map(cell => [cell.id, cell]));
	for(const cell of cells.filter(cell => !promoted.includes(cell))) assert.deepEqual(cell, oldById.get(cell.id), cell.id);
	const entry = document.evidence.find(item => item.id === 'jvm-recursive-callables-installed');
	assert.deepEqual(entry.artifacts, execution.reports.flatMap((run, index) => run.packages.flatMap(pkg => pkg.artifacts.map(artifact => ({ path: 'jvm/' + jvmRecursiveCallableScope.paths[index] + '/' + artifact.path, sha256: artifact.sha256 })))));
	assert.ok(entry.files.some(file => file.path === jvmRecursiveCallableExecutionPath));
	await assertDotnetRecursiveCallableIntegration(previous);
};
