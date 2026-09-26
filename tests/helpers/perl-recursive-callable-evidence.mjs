/**
 * Bind recursive Perl support to original installed archives and exact sources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { assertRubyRecursiveCallableIntegration } from "./ruby-recursive-callable-evidence.mjs";
import { rubyRecursiveCallableHistoryPath } from "./ruby-recursive-callable-source-history.mjs";
import { assertPerlStructuredCallableExecution, perlStructuredCallableExecutionPath, perlStructuredAbis } from "./perl-structured-callable-evidence.mjs";
import { assertPerlRecursiveFaults } from "./perl-recursive-callable-faults.mjs";
import { perlRecursiveCallableDocumentation } from "./perl-recursive-callable-docs.mjs";
import { perlRecursiveAcyclicConsumer } from "./perl-recursive-callable-consumers.mjs";
import { perlRecursiveCallableChangedPaths, reversePerlRecursiveCallableUpdate } from "./perl-recursive-callable-source-history.mjs";
import { beforeDotnetRecursiveCallables } from "./dotnet-recursive-callable-source-history.mjs";

const priorSource = async path => beforeDotnetRecursiveCallables(path, await readFile(path, "utf8"));

export const perlRecursiveCallableBaseline = "7cf6ee0bf049502eb9b581c8cc6efb88dc9aeddc";
export const perlRecursiveCallableExecutionPath = "docs/evidence/perl-recursive-callables-20260925.json";
export const perlRecursiveCallableAddedPaths = [
	perlRecursiveCallableExecutionPath
	, "docs/evidence/perl-recursive-callables-20260925.md"
	, ...["model", "runtime", "xs", "package"].map(name => `src/backends/perl/callable-graph-${name}.mjs`)
	, ...["perl-recursive", "perl-recursive-faults", "perl-recursive-lifetimes", "perl-recursive-ownership", "perl-recursive-poison"].map(name => `tests/fixtures/structured-callable-consumers/${name}.pl`)
	, ...["acceptance", "consumers", "docs", "faults", "ownership", "probes", "evidence", "source-history"].map(name => `tests/helpers/perl-recursive-callable-${name}.mjs`)
	, "tests/perl-recursive-callable-contract.test.mjs"
	, "tests/perl-recursive-callable-evidence.test.mjs"
	, "tests/perl-recursive-callables.test.mjs"
].sort();
export const perlRecursiveCallableScope = {
	profiles: ["perl"], paths: ["ordinary-source", "reviewed-ir"]
	, shapes: ["alias", "array", "list", "option", "record", "recursive", "result", "tuple", "variant"]
	, positions: ["callback-parameter", "callback-result"]
	, recursiveCallbacks: true, ownedResourceAggregates: false
};
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const authenticated = async (entry, path) => {
	assert.equal(entry.path, path); const bytes = await readFile(path);
	assert.equal(sha256(bytes), entry.sha256); return JSON.parse(bytes);
};
const passing = (run, count) => {
	assert.equal(run.exitCode, 0); assert.equal(sha256(run.text), run.sha256);
	assert.doesNotMatch(run.command, /--test-name-pattern/u);
	for(const [name, value] of Object.entries({ tests: count, pass: count, fail: 0, cancelled: 0, skipped: 0 }))
		assert.match(run.text, new RegExp(`^# ${name} ${value}$`, "mu"));
};
const abiName = run => `${run.perl.slice(1)}-${run.threaded ? "threaded" : "unthreaded"}`;

/**
 * Require every ABI, install mode, public value, safety probe and exact example.
 *
 * @param record - Terminal logs and original installed-package reports.
 */
export const assertPerlRecursiveCallableExecution = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "perl-recursive-callable-execution");
	assert.equal(record.baselineRevision, perlRecursiveCallableBaseline);
	assert.deepEqual(record.scope, perlRecursiveCallableScope);
	assert.deepEqual(record.abis, perlStructuredAbis);
	passing(record.installed, 1); passing(record.contract, 6);
	assert.ok(record.installed.command.includes("LEAN_BRIDGE_PERL_RECURSIVE_CALLABLE_TEST=1"));
	assert.ok(record.installed.command.includes("tests/perl-recursive-callables.test.mjs"));
	assert.ok(record.contract.command.includes("tests/perl-recursive-callable-contract.test.mjs"));
	const old = await authenticated(record.previousPerlExecution, perlStructuredCallableExecutionPath);
	await assertPerlStructuredCallableExecution({ ...old
		, installed: record.regressions.structured.installed
		, reports: record.regressions.structured.reports
		, primitiveRegressions: record.regressions.primitive });
	const order = perlRecursiveCallableScope.paths.flatMap(path => perlStructuredAbis.flatMap(abi => ["prebuilt-only", "build-xs"].map(mode => `${path}/${abi}/${mode}`)));
	assert.deepEqual(record.reports.map(run => `${run.path}/${abiName(run)}/${run.mode}`), order);
	const documentation = await perlRecursiveCallableDocumentation();
	const acyclic = sha256(await perlRecursiveAcyclicConsumer());
	const fixture = async name => sha256(await readFile(`tests/fixtures/structured-callable-consumers/${name}.pl`));
	const probeSources = {};
	for(const name of ["faults", "ownership", "poison"]) probeSources[name] = await fixture(`perl-recursive-${name}`);
	probeSources.values = sha256((await readFile("tests/fixtures/structured-callable-consumers/perl-values.pl", "utf8")).replaceAll("LeanBridge::Structured", "LeanBridge::Recursive") + "\n1;\n");
	for(const run of record.reports)
	{
		assert.equal(run.profile, "perl"); assert.equal(run.exports, 33); assert.equal(run.signatures, 18);
		assert.equal(run.checks, run.threaded ? 206 : 204); assert.equal(run.identities, 0);
		for(const key of ["producerRemoved", "handoffRemoved", "relocated", "compilerFreeExecution", "repeated", "installedFilesUnchanged"])
			assert.equal(run[key], true, key);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256", "perlSha256"]) digest(run[key]);
		assert.equal(run.sourceSha256, await fixture("perl-recursive"));
		assert.equal(run.lifetimeSourceSha256, await fixture("perl-recursive-lifetimes"));
		assert.equal(run.acyclicSourceSha256, acyclic);
		assert.deepEqual(run.documentation, { authorSha256: sha256(documentation.author)
			, configurationSha256: sha256(documentation.configuration)
			, consumerSha256: sha256(documentation.consumer)
			, compiled: true, executed: true });
		assert.deepEqual(run.lifetimes, { capacity: 4096, identities: 0
			, childFinalizationIsolated: true, finalized: true, overflowRejected: true
			, replacementUsable: true, staleRejected: true });
		const previous = record.regressions.structured.reports.find(item => item.path === run.path
			&& item.hostVersion === run.perl.slice(1) && (item.abi.useithreads === "define") === run.threaded);
		assert.ok(previous);
		for(const key of ["checks", "calls", "rejected", "shapes", "wordBits", "abi", "abiKey"])
			assert.deepEqual(run.acyclic[key], previous[key], key);
		assert.equal(run.packages.length, 2);
		const runtime = run.packages.find(pkg => pkg.role === "runtime"), component = run.packages.find(pkg => pkg.role === "component");
		assert.equal(runtime.name, "LeanBridge-Runtime"); assert.equal(runtime.runtimeDelivery, "provided");
		assert.equal(component.name, "LeanBridge-Recursive"); assert.equal(component.runtimeDelivery, "dependency");
		assert.deepEqual(runtime.requires, []);
		assert.deepEqual(component.requires, [{ ecosystem: "cpan", name: runtime.name, version: runtime.version }]);
		assert.equal(component.runtimeIdentity, runtime.runtimeIdentity);
		for(const pkg of run.packages)
		{
			assert.equal(pkg.target, "cpan"); assert.equal(pkg.ecosystem, "cpan"); digest(pkg.runtimeIdentity);
			assert.equal(pkg.profile, "native-library-v1"); assert.equal(pkg.artifacts.length, 1);
			for(const artifact of pkg.artifacts)
			{ digest(artifact.sha256); assert.ok(artifact.bytes > 0); assert.match(artifact.path, /\.tar\.gz$/u); }
		}
		assert.equal(Object.keys(run.installedFiles).length, 24);
		assert.equal(Object.keys(run.installedFiles).filter(path => path.endsWith("install-receipt.json")).length, 2);
		for(const file of Object.values(run.installedFiles))
		{ digest(file.sha256); assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0); }
		const probes = run.probes;
		assertPerlRecursiveFaults(probes.faults);
		assert.deepEqual(probes.faults, record.reports[0].probes.faults);
		assert.deepEqual(probes.ownership, { ownershipChecks: 9, checkedBeforeDecode: true });
		assert.deepEqual(probes.poison, { malformedOutputRejected: true, clears: 1, retired: 1, remainingOwners: 0 });
		for(const key of ["isolatedXsCopy", "installedRuntime", "compilerFreeExecution"]) assert.equal(probes[key], true, key);
		for(const key of ["originalXsSha256", "driverSha256"]) digest(probes[key]);
		assert.deepEqual(probes.sources, probeSources);
		assert.deepEqual(probes.libraries.map(item => item.mode), ["baseline", "reply-scope", "retirement"]);
		for(const library of probes.libraries)
		{ digest(library.sha256); digest(library.xsSha256); assert.notEqual(library.xsSha256, probes.originalXsSha256); }
		assert.equal(new Set(probes.libraries.map(item => item.xsSha256)).size, 3);
		assert.deepEqual(probes.counterfactuals.map(item => item.mode), ["reply-scope", "retirement"]);
		for(const [index, marker] of ["8 Callback owners released before native copying: array,list,result,tuple,record,variant,alias,recursive", "Retired runtime reentered"].entries())
		{
			const rejected = probes.counterfactuals[index];
			assert.equal(rejected.rejected, true); assert.equal(rejected.exitCode, 255);
			assert.equal(rejected.marker, marker); assert.ok(rejected.stderr.includes(marker));
		}
	}
};

/**
 * Add four Perl recursive callback cells and authenticate unchanged history.
 *
 * @param record - Reversible source transitions and immutable execution receipt.
 */
export const assertPerlRecursiveCallableIntegration = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "perl-recursive-callable-integration");
	assert.equal(record.baselineRevision, perlRecursiveCallableBaseline);
	assert.deepEqual(record.scope, perlRecursiveCallableScope);
	assert.deepEqual(record.inventory, { previousVersion: "0.101.0", version: "0.102.0", previousInstalled: 4802, installed: 4806, total: 6562 });
	const previous = await authenticated(record.previous, rubyRecursiveCallableHistoryPath);
	const execution = await authenticated(record.execution, perlRecursiveCallableExecutionPath);
	await assertPerlRecursiveCallableExecution(execution);
	assert.deepEqual(record.updates.map(update => update.path).sort(), perlRecursiveCallableChangedPaths);
	assert.deepEqual(Object.keys(record.additions).sort(), perlRecursiveCallableAddedPaths);
	const paths = [...new Set([...Object.keys(previous.sourceHashes), ...perlRecursiveCallableChangedPaths, ...perlRecursiveCallableAddedPaths])].sort();
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), paths);
	for(const path of paths) assert.equal(sha256(await priorSource(path)), record.sourceHashes[path], path);
	const restored = {};
	for(const update of record.updates)
	{
		assert.equal(update.currentSha256, record.sourceHashes[update.path]);
		if(previous.sourceHashes[update.path]) assert.equal(update.previousSha256, previous.sourceHashes[update.path]);
		restored[update.path] = reversePerlRecursiveCallableUpdate(await priorSource(update.path), update);
	}
	for(const [path, hash] of Object.entries(record.additions)) assert.equal(hash, record.sourceHashes[path]);
	const { document: current, ...contracts } = await readTypeSurface(); void current;
	const document = JSON.parse(await priorSource("docs/type-surface.v1.json")), old = JSON.parse(restored["docs/type-surface.v1.json"]);
	assert.equal(document.contractVersion, "0.102.0"); assert.equal(old.contractVersion, "0.101.0");
	const cells = typeSurfaceCells(document, contracts), oldCells = typeSurfaceCells(old, contracts);
	const count = values => values.filter(cell => cell.stages.installedExecution.state === "passed").length;
	assert.equal(count(cells), 4806); assert.equal(count(oldCells), 4802); assert.equal(cells.length, 6562);
	const promoted = cells.filter(cell => cell.stages.installedExecution.evidence.includes("perl-recursive-callables-installed"));
	assert.equal(promoted.length, 4);
	for(const cell of promoted)
	{
		assert.equal(cell.profile, "perl"); assert.equal(cell.shape, "recursive");
		assert.ok(record.scope.paths.includes(cell.path)); assert.ok(record.scope.positions.includes(cell.position));
		assert.ok(cell.hostType && cell.conversionNote);
		for(const stage of Object.values(cell.stages))
			assert.deepEqual({ state: stage.state, evidence: stage.evidence }, { state: "passed", evidence: ["perl-recursive-callables-installed"] });
	}
	const oldById = new Map(oldCells.map(cell => [cell.id, cell]));
	for(const cell of cells.filter(cell => !promoted.includes(cell))) assert.deepEqual(cell, oldById.get(cell.id), cell.id);
	const entry = document.evidence.find(item => item.id === "perl-recursive-callables-installed");
	assert.deepEqual(entry.artifacts, execution.reports.filter(run => abiName(run) === perlStructuredAbis[0] && run.mode === "prebuilt-only").flatMap(run => run.packages.flatMap(pkg => pkg.artifacts.map(artifact => ({ path: `perl/${run.path}/${artifact.path}`, sha256: artifact.sha256 })))));
	assert.ok(entry.files.some(file => file.path === perlRecursiveCallableExecutionPath));
	await assertRubyRecursiveCallableIntegration(previous);
};
