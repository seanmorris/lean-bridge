/**
 * Authenticate installed recursive PHP callbacks, regressions and source history.
 *
 * @file
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { canonicalJson, sha256 } from '../../src/capsule/node.mjs';
import { hashBindingIr } from '../../src/binding-ir/canonical.mjs';
import { readTypeSurface, typeSurfaceCells } from '../../src/adoption/type-surface.mjs';
import { generateCallablePhpGraphPackage } from '../../src/backends/php/callable-graph-package.mjs';
import { compileCallablePhpGraphPackageModel } from '../../src/backends/php/callable-graph-model.mjs';
import { phpIsolationFlags, composerProbe } from './type-corpus-php.mjs';
import { validateBrickMathInstall } from './brick-math.mjs';
import { assertPhpStructuredCallableExecution, phpStructuredCallableExecutionPath } from './php-structured-callable-evidence.mjs';
import { assertPhpGraphPackageReports } from './php-graph-receipt.mjs';
import { phpRecursiveCallableDocumentation } from './php-recursive-callable-docs.mjs';
import { jvmRecursiveMixedFixture } from './jvm-recursive-callable-mixed.mjs';
import { assertPhpRecursiveFaults, assertPhpRecursivePoison, assertPhpRecursiveOwnership, assertPhpRecursiveLifetimes } from './php-recursive-callable-faults.mjs';
import { phpRecursiveTamperSource } from './php-recursive-callable-tamper.mjs';
import { assertJvmRecursiveCallableIntegration } from './jvm-recursive-callable-evidence.mjs';
import { jvmRecursiveCallableHistoryPath } from './jvm-recursive-callable-source-history.mjs';
import { phpRecursiveCallableChangedPaths, reversePhpRecursiveCallableUpdate } from './php-recursive-callable-source-history.mjs';
import { beforePhpWasmRecursiveCallables } from './php-wasm-recursive-callable-source-history.mjs';

const priorSource = async path => beforePhpWasmRecursiveCallables(path, await readFile(path, 'utf8'));

export const phpRecursiveCallableBaseline = 'e17c1fe6e137d1a3bbdb65d9a9ec1e49dbc751be';
export const phpRecursiveCallableExecutionPath = 'docs/evidence/php-recursive-callables-20260926.json';
export const phpRecursiveCallableScope = {
	profiles: ['php-native']
	, paths: ['ordinary-source', 'reviewed-ir']
	, shapes: ['alias', 'array', 'list', 'option', 'record', 'recursive', 'result', 'tuple', 'variant']
	, positions: ['callback-parameter', 'callback-result']
	, recursiveCallbacks: true
	, ownedResourceAggregates: false
};
export const phpRecursiveCallableAddedPaths = [
	phpRecursiveCallableExecutionPath
	, 'docs/evidence/php-recursive-callables-20260926.md'
	, ...['model', 'runtime', 'calls', 'package'].map(name => `src/backends/php/callable-graph-${name}.mjs`)
	, ...['php', 'cold.php', 'forward.c', 'host-faults.php', 'native-faults.php', 'ownership.php', 'retirement-mutant.php', 'lifetimes.php'].map(name => 'tests/fixtures/structured-callable-consumers/php-recursive' + (name === 'php' ? '.' : '-') + name)
	, ...['acceptance', 'cold', 'docs', 'faults', 'native', 'probes', 'tamper', 'evidence', 'source-history'].map(name => `tests/helpers/php-recursive-callable-${name}.mjs`)
	, 'tests/php-recursive-callable-contract.test.mjs'
	, 'tests/php-recursive-callable-evidence.test.mjs'
	, 'tests/php-recursive-callables.test.mjs'
].sort();
export const phpRecursiveCallableProjectionPaths = [
	...['model', 'runtime', 'calls', 'package'].map(name => `src/backends/php/callable-graph-${name}.mjs`)
	, 'src/backends/php/package-audit.mjs'
	, 'src/build/native-c-projection.mjs'
	, 'src/build/native-graph-projection.mjs'
	, 'src/build/native-php-artifacts.mjs'
	, 'src/release/native-composer.mjs'
].sort();
const hash = value => assert.match(value, /^[a-f0-9]{64}$/u);
const hashes = files => Object.fromEntries(Object.entries(files).map(([path, source]) => [path, sha256(source)]));
const authenticated = async (entry, path) => {
	assert.equal(entry.path, path); const bytes = await readFile(path);
	assert.equal(sha256(bytes), entry.sha256); return JSON.parse(bytes);
};
const passing = (run, count) => {
	assert.equal(run.exitCode, 0); assert.equal(sha256(run.text), run.sha256);
	for(const [name, value] of Object.entries({ tests: count, pass: count, fail: 0, cancelled: 0, skipped: 0 }))
		assert.match(run.text, new RegExp('^# ' + name + ' ' + value + '$', 'mu'));
};
const inventory = files => {
	assert.ok(Object.keys(files).length > 0);
	for(const [path, file] of Object.entries(files))
	{
		assert.ok(!path.startsWith('/') && path.split('/').every(part => part && part !== '.' && part !== '..'));
		hash(file.sha256); assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0);
	}
};

/**
 * Require complete fault paths, named mutant failures and authenticated originals.
 *
 * @param report - Original installed package report with isolated probe results.
 */
export const assertPhpRecursiveInspection = async report => {
	const { php, nativeEvidence, bindingIr } = report, { probes, tamper } = report.inspection;
	assert.equal(probes.originalPackagesUnchanged, true);
	assert.equal(probes.originalArchiveSha256, php.archiveSha256); hash(probes.forwardSha256);
	const fixtureNames = ['host-faults.php', 'native-faults.php', 'lifetimes.php', 'ownership.php', 'retirement-mutant.php', 'forward.c'];
	assert.deepEqual(Object.keys(probes.sourceHashes).sort(), fixtureNames.map(name => 'php-recursive-' + name).sort());
	for(const [name, digest] of Object.entries(probes.sourceHashes))
		assert.equal(digest, sha256(await readFile('tests/fixtures/structured-callable-consumers/' + name)));
	assertPhpRecursiveFaults(probes.host, 'host'); assertPhpRecursiveFaults(probes.native, 'native');
	assertPhpRecursiveLifetimes(probes.lifetimes);
	assert.deepEqual(probes.ownership.map(run => run.mode), ['baseline', 'reply-scope']);
	for(const { mode, ...observation } of probes.ownership) assertPhpRecursiveOwnership(observation, mode === 'reply-scope');
	assert.deepEqual(probes.poisoned.map(run => run.mode), [1, 2, 3, 4, 5]);
	for(const observation of probes.poisoned) assertPhpRecursivePoison(observation, observation.mode);
	assert.deepEqual(probes.mutant, { exitCode: 1, signal: null, killed: false, stdout: '', stderr: 'malformed_output_retires_runtime\n' });
	const adapter = probes.adapter;
	assert.equal(adapter.schemaVersion, 1); assert.equal(adapter.isolated, true);
	assert.equal(adapter.runtimeHeadersVerified, true); assert.equal(adapter.layout, 170);
	assert.equal(adapter.originalAdapter, nativeEvidence.libraries[nativeEvidence.library]);
	hash(adapter.instrumentedAdapter); assert.notEqual(adapter.instrumentedAdapter, adapter.originalAdapter);
	assert.deepEqual(adapter.originalSources, hashes(generateCallablePhpGraphPackage(bindingIr, nativeEvidence)));
	assert.deepEqual(adapter.instrumentedSources, hashes(generateCallablePhpGraphPackage(bindingIr, {
		...nativeEvidence
		, libraries: { ...nativeEvidence.libraries, [nativeEvidence.library]: adapter.instrumentedAdapter }
	})));
	for(const [path, digest] of Object.entries(adapter.originalNative))
		assert.equal(php.packageReceipt.files['lean-bridge/adapter/' + path].sha256, digest, path);
	assert.deepEqual(Object.keys(adapter.instrumentedNative).sort(), Object.keys(adapter.originalNative).sort());
	for(const [path, digest] of Object.entries(adapter.instrumentedNative))
	{
		hash(digest);
		if(path === 'src/native.c') assert.notEqual(digest, adapter.originalNative[path]);
		else assert.equal(digest, adapter.originalNative[path]);
	}
	assert.equal(tamper.originalPackagesUnchanged, true);
	assert.equal(tamper.sourceSha256, sha256(phpRecursiveTamperSource));
	const assets = Object.keys(nativeEvidence.libraries).sort();
	assert.deepEqual(tamper.cases.map(run => run.path).sort(), assets.map(name => 'native/linux-x64/' + name));
	for(const run of tamper.cases)
	{
		assert.equal(run.sha256, php.packageReceipt.files[run.path].sha256);
		assert.equal(run.rejectedBeforeMapping, true); assert.equal(run.separateCopy, true);
	}
};

/**
 * Require original Composer installs, both lexical modes and all regression suites.
 *
 * @param record - Frozen terminal logs and original installed execution reports.
 */
export const assertPhpRecursiveCallableExecution = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, 'php-recursive-callable-execution');
	assert.equal(record.baselineRevision, phpRecursiveCallableBaseline); assert.deepEqual(record.scope, phpRecursiveCallableScope);
	assert.deepEqual(Object.keys(record.installed).sort(), ['mixed', 'recursive']);
	for(const variant of ['recursive', 'mixed'])
	{
		const run = record.installed[variant]; passing(run, 1);
		assert.equal(run.command, "LEAN_BRIDGE_PHP_RECURSIVE_CALLABLE_TEST=1 node --test --test-name-pattern='original " + variant + "' tests/php-recursive-callables.test.mjs");
	}
	passing(record.contract, 9); assert.equal(record.contract.command, 'node --test tests/php-recursive-callable-contract.test.mjs');
	const regressions = record.regressions;
	passing(regressions.primitive.installed, 1); passing(regressions.structured.installed, 1); passing(regressions.copied.installed, 8);
	assert.equal(regressions.primitive.installed.command, 'LEAN_BRIDGE_PHP_CALLABLE_TEST=1 node --test tests/php-callables.test.mjs');
	assert.equal(regressions.structured.installed.command, 'LEAN_BRIDGE_PHP_STRUCTURED_CALLABLE_TEST=1 node --test tests/php-structured-callables.test.mjs');
	assert.equal(regressions.copied.installed.command, "LEAN_BRIDGE_PHP_GRAPH_PACKAGE_TEST=1 LEAN_BRIDGE_PHP_GRAPH_INSTALLED_TEST=1 LEAN_BRIDGE_PHP_GRAPH_REPRO_TEST=1 LEAN_BRIDGE_PHP_GRAPH_LOADING_TEST=1 node --test --test-skip-pattern='recursive Composer evidence' tests/php-graph-package.test.mjs");
	assert.deepEqual(Object.keys(regressions.projectionSources).sort(), phpRecursiveCallableProjectionPaths);
	for(const [path, digest] of Object.entries(regressions.projectionSources)) assert.equal(sha256(await readFile(path)), digest, path);
	const previous = await authenticated(record.previousPhpExecution, phpStructuredCallableExecutionPath);
	await assertPhpStructuredCallableExecution({
		...previous
		, installed: regressions.structured.installed
		, report: regressions.structured.report
		, primitiveRegression: { ...regressions.primitive.installed, report: regressions.primitive.report }
	}, { probeSource: await readFile('tests/fixtures/structured-callable-consumers/php-faults.php', 'utf8') });
	await assertPhpGraphPackageReports(regressions.copied.reports);
	const documentation = await phpRecursiveCallableDocumentation(), mixed = await jvmRecursiveMixedFixture(documentation.source);
	const source = await readFile('tests/fixtures/structured-callable-consumers/php-recursive.php', 'utf8');
	for(const [isMixed, reports] of [[false, record.reports], [true, record.mixedReports]])
	{
		assert.deepEqual(reports.map(run => [run.path, run.reviewed]), [['ordinary', false], ['reviewed', true]]);
		for(const run of reports)
		{
			for(const key of ['freshAuthor', 'composerOnly', 'sourceRemovedBeforeInstallation', 'handoffRemovedBeforeExecution', 'compilerFreeReassembly', 'deterministicReassembly']) assert.equal(run[key], true, key);
			assert.equal(run.exports, isMixed ? 98 : 33); assert.equal(run.signatures, isMixed ? 59 : 18); hash(run.handoffSha256);
			assert.equal(run.producerSources['Structured.lean'], sha256(isMixed ? mixed.source : documentation.source));
			assert.equal(run.probeSha256, sha256(source));
			const { php, package: pkg, nativeEvidence } = run, receipt = php.packageReceipt, prefix = 'vendor/lean-bridge/structured/';
			assert.equal(pkg.target, 'php-native'); assert.equal(pkg.ecosystem, 'composer');
			assert.equal(pkg.name, 'lean-bridge/structured'); assert.equal(pkg.version, '1.0.0');
			assert.equal(pkg.runtimeDelivery, 'embedded'); assert.deepEqual(pkg.requires, []);
			assert.equal(pkg.artifacts.length, 1); const archive = pkg.artifacts[0];
			hash(archive.sha256); assert.ok(archive.bytes > 0); assert.match(archive.path, /^archives\/.+\.zip$/u);
			assert.equal(php.archiveSha256, archive.sha256);
			for(const flag of phpIsolationFlags) assert.equal(php[flag], true, flag);
			for(const [key, value] of Object.entries(php)) if(key.endsWith('Sha256')) hash(value);
			assert.equal(php.composerProbeSha256, sha256(composerProbe));
			assert.equal(php.requestSha256, sha256(canonicalJson({ path: run.reviewed ? 'reviewed-ir' : 'ordinary-source', mixed: isMixed })));
			assert.equal(php.manifestSha256, sha256(canonicalJson(php.manifest)));
			assert.deepEqual(php.manifest.require, { [pkg.name]: pkg.version });
			assert.deepEqual(php.manifest.config, { 'allow-plugins': false });
			assert.deepEqual(php.manifest.repositories[0], { 'packagist.org': false });
			assert.equal(php.lock.packages.length, 2); assert.equal(php.installed.packages.length, 2);
			validateBrickMathInstall(php, php.deployment); inventory(php.deployment); inventory(receipt.files);
			assert.equal(receipt.schemaVersion, 1); assert.equal(receipt.kind, 'lean-bridge-ordinary-php-package');
			assert.equal(receipt.name, pkg.name); assert.equal(receipt.version, pkg.version); assert.equal(receipt.namespace, 'LeanStructured');
			assert.equal(receipt.runtimeIdentity, pkg.runtimeIdentity); assert.equal(nativeEvidence.runtimeIdentity, pkg.runtimeIdentity);
			assert.equal(receipt.bindingIrSha256, hashBindingIr(run.bindingIr)); assert.equal(php.bindingIrSha256, receipt.bindingIrSha256);
			assert.equal(php.packageReceiptSha256, sha256(canonicalJson(receipt)));
			assert.equal(php.deployment[prefix + 'lean-bridge/package-receipt.json'].sha256, php.packageReceiptSha256);
			for(const [path, identity] of Object.entries(receipt.files)) assert.deepEqual(php.deployment[prefix + path], identity);
			assert.deepEqual(Object.keys(php.deployment).filter(path => path.startsWith(prefix)).sort(), [...Object.keys(receipt.files).map(path => prefix + path), prefix + 'lean-bridge/package-receipt.json'].sort());
			const model = compileCallablePhpGraphPackageModel(run.bindingIr);
			assert.equal(model.functions.length, run.exports); assert.equal(model.callbacks.size, run.signatures);
			assert.equal(model.layoutSha256, nativeEvidence.copiedGraph.layoutSha256);
			for(const [path, text] of Object.entries(generateCallablePhpGraphPackage(run.bindingIr, nativeEvidence)))
				assert.equal(receipt.files[path].sha256, sha256(text), path);
			assert.equal(Object.keys(nativeEvidence.libraries).length, 4);
			for(const [name, digest] of Object.entries(nativeEvidence.libraries)) assert.equal(receipt.files['native/linux-x64/' + name].sha256, digest);
			assert.deepEqual(php.executions.map(item => item.mode), ['weak', 'strict']);
			assert.deepEqual(run.afterProbes, php.executions); assert.deepEqual(run.observation, php.executions[0].observation);
			for(const { mode, observation } of php.executions)
			{
				assert.equal(php.consumerSources[mode], sha256(source.replace('strict_types=0', 'strict_types=' + (mode === 'strict' ? 1 : 0))));
				assert.equal(php.deployment[mode + '.php'].sha256, php.consumerSources[mode]);
				assert.deepEqual(observation, {
					checks: isMixed ? 1249 : 1130
					, rejections: 389
					, primitiveChecks: isMixed ? 119 : 0
					, shapes: ['array', 'list', 'option', 'result', 'tuple', 'record', 'variant', 'alias', 'recursive']
					, seeds: 6
					, compiledLean: true
					, installedPackage: true
					, publicApiOnly: true
					, actualPhpBits: 64
					, nativeLibraries: nativeEvidence.libraries
				});
			}
			assert.deepEqual(run.documentation, {
				authorSha256: sha256(documentation.author)
				, configurationSha256: sha256(documentation.configuration)
				, consumerSha256: sha256(documentation.example.source)
				, standaloneLeanChecked: true
				, compiledVerbatim: true
				, stdout: documentation.example.stdout
				, archiveSha256: archive.sha256
			});
			if(isMixed) assert.equal(run.inspection, undefined);
			else await assertPhpRecursiveInspection(run);
		}
	}
};

/**
 * Admit exactly four native PHP callback cells and preserve every predecessor.
 *
 * @param record - Reversible source transitions and immutable execution reference.
 */
export const assertPhpRecursiveCallableIntegration = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, 'php-recursive-callable-integration');
	assert.equal(record.baselineRevision, phpRecursiveCallableBaseline); assert.deepEqual(record.scope, phpRecursiveCallableScope);
	assert.deepEqual(record.inventory, { previousVersion: '0.104.0', version: '0.105.0', previousInstalled: 4818, installed: 4822, total: 6562 });
	const previous = await authenticated(record.previous, jvmRecursiveCallableHistoryPath);
	const execution = await authenticated(record.execution, phpRecursiveCallableExecutionPath);
	await assertPhpRecursiveCallableExecution(execution);
	assert.deepEqual(record.updates.map(update => update.path).sort(), phpRecursiveCallableChangedPaths);
	assert.deepEqual(Object.keys(record.additions).sort(), phpRecursiveCallableAddedPaths);
	const paths = [...new Set([...Object.keys(previous.sourceHashes), ...phpRecursiveCallableChangedPaths, ...phpRecursiveCallableAddedPaths])].sort();
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), paths);
	for(const path of paths) assert.equal(sha256(await priorSource(path)), record.sourceHashes[path], path);
	const restored = {};
	for(const update of record.updates)
	{
		assert.equal(update.currentSha256, record.sourceHashes[update.path]);
		if(previous.sourceHashes[update.path]) assert.equal(update.previousSha256, previous.sourceHashes[update.path]);
		restored[update.path] = reversePhpRecursiveCallableUpdate(await priorSource(update.path), update);
	}
	for(const [path, digest] of Object.entries(record.additions)) assert.equal(digest, record.sourceHashes[path]);
	const { document: current, ...contracts } = await readTypeSurface(), old = JSON.parse(restored['docs/type-surface.v1.json']);
	const document = JSON.parse(beforePhpWasmRecursiveCallables('docs/type-surface.v1.json', JSON.stringify(current, null, 2) + '\n'));
	assert.equal(document.contractVersion, '0.105.0'); assert.equal(old.contractVersion, '0.104.0');
	const cells = typeSurfaceCells(document, contracts), oldCells = typeSurfaceCells(old, contracts);
	const count = values => values.filter(cell => cell.stages.installedExecution.state === 'passed').length;
	assert.equal(count(cells), 4822); assert.equal(count(oldCells), 4818); assert.equal(cells.length, 6562);
	const promoted = cells.filter(cell => cell.stages.installedExecution.evidence.includes('php-native-recursive-callables-installed'));
	assert.equal(promoted.length, 4);
	for(const cell of promoted)
	{
		assert.equal(cell.profile, 'php-native'); assert.equal(cell.shape, 'recursive');
		assert.ok(phpRecursiveCallableScope.paths.includes(cell.path)); assert.ok(phpRecursiveCallableScope.positions.includes(cell.position));
		assert.ok(cell.hostType && cell.conversionNote);
		for(const stage of Object.values(cell.stages)) assert.deepEqual({ state: stage.state, evidence: stage.evidence }, { state: 'passed', evidence: ['php-native-recursive-callables-installed'] });
	}
	const oldById = new Map(oldCells.map(cell => [cell.id, cell]));
	for(const cell of cells.filter(cell => !promoted.includes(cell))) assert.deepEqual(cell, oldById.get(cell.id), cell.id);
	const entry = document.evidence.find(item => item.id === 'php-native-recursive-callables-installed');
	assert.deepEqual(entry.artifacts, execution.reports.flatMap((run, index) => run.package.artifacts.map(artifact => ({ path: 'php/' + phpRecursiveCallableScope.paths[index] + '/' + artifact.path, sha256: artifact.sha256 }))));
	assert.ok(entry.files.some(file => file.path === phpRecursiveCallableExecutionPath));
	await assertJvmRecursiveCallableIntegration(previous);
};
