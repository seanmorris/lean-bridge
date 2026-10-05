/**
 * Bind copied Perl callbacks to installed archives, failure probes and sources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { structuredCallableReviewedIr } from "./structured-callable-fixture.mjs";
import { callableSignatures } from "./callable-fixture.mjs";
import { collectionSignatures } from "./collection-fixture.mjs";
import { compoundSignatures } from "./compound-source-fixture.mjs";
import { listPrimitives, listSignatures } from "./list-fixture.mjs";
import { cVariantReviewedIr } from "./c-variant-fixture.mjs";
import { perlStructuredCallableSignatures } from "./perl-structured-callable-acceptance.mjs";
import { perlStructuredDocumentationExample } from "./perl-structured-callable-fixture.mjs";
import { assertPerlStructuredCodegenRegression } from "./perl-structured-callable-regression.mjs";
import { assertPerlStructuredFaults } from "./perl-structured-callable-faults.mjs";
import { jvmStructuredCallableHistoryPath } from "./jvm-structured-callable-source-history.mjs";
import { assertJvmStructuredCallableIntegration } from "./jvm-structured-callable-evidence.mjs";
import { perlStructuredCallableChangedPaths, reversePerlStructuredCallableUpdate } from "./perl-structured-callable-source-history.mjs";
import { beforeNpmStructuredCallables } from "./npm-structured-callable-source-history.mjs";

const priorSource = async path => beforeNpmStructuredCallables(path, await readFile(path, "utf8"));

export const perlStructuredCallableExecutionPath = "docs/evidence/perl-structured-callables-20260925.json";
export const perlStructuredCodegenPath = "docs/evidence/perl-structured-codegen-regression-20260925.json";
export const perlStructuredAbis = [
	"5.36.3-threaded", "5.36.3-unthreaded"
	, "5.38.2-threaded", "5.38.2-unthreaded"
];
export const perlStructuredCopiedFamilies = ["collections", "compounds", "lists", "variants"];
export const perlStructuredCallableAddedPaths = [
	perlStructuredCallableExecutionPath, perlStructuredCodegenPath
	, "docs/evidence/perl-structured-callables-20260925.md"
	, "tests/perl-structured-callable-contract.test.mjs"
	, "tests/perl-structured-callable-evidence.test.mjs"
	, "tests/perl-structured-callables.test.mjs"
	, "tests/fixtures/structured-callable-consumers/perl.pl"
	, "tests/fixtures/structured-callable-consumers/perl-values.pl"
	, "tests/fixtures/structured-callable-consumers/perl-faults.pl"
	, "tests/fixtures/structured-callable-consumers/perl-probe.h"
	, "tests/helpers/perl-structured-callable-acceptance.mjs"
	, "tests/helpers/perl-structured-callable-install.mjs"
	, "tests/helpers/perl-structured-callable-fixture.mjs"
	, "tests/helpers/perl-structured-callable-faults.mjs"
	, "tests/helpers/perl-structured-callable-regression.mjs"
	, "tests/helpers/perl-structured-callable-evidence.mjs"
	, "tests/helpers/perl-structured-callable-source-history.mjs"
].sort();
export const perlStructuredCallableScope = {
	profiles: ["perl"], paths: ["ordinary-source", "reviewed-ir"]
	, shapes: ["alias", "array", "list", "option", "record", "result", "tuple", "variant"]
	, positions: ["callback-parameter", "callback-result"]
	, recursiveCallbacks: false, ownedResourceAggregates: false
};
const hash = value => assert.match(value, /^[a-f0-9]{64}$/u);
const passing = (run, file, flag, count) => {
	assert.ok(run.command.includes(file)); assert.equal(run.exitCode, 0);
	assert.ok(run.command.includes(`${flag}=1`));
	assert.doesNotMatch(run.command, /--test-name-pattern/u);
	assert.equal(sha256(run.text), run.sha256);
	assert.ok(run.text.includes(`# tests ${count}\n# suites 0\n# pass ${count}\n# fail 0\n# cancelled 0\n# skipped 0\n`));
};
const abiName = run => `${run.hostVersion}-${run.abi.useithreads === "define" ? "threaded" : "unthreaded"}`;
const abiHash = abi => sha256(JSON.stringify(Object.fromEntries(Object.keys(abi).sort().map(key => [key, abi[key]]))));
const order = perlStructuredCallableScope.paths.flatMap(path => perlStructuredAbis.map(abi => `${path}/${abi}`));
const sortSignatures = values => values.toSorted((a, b) => a.name.localeCompare(b.name));
const variantContract = ir => ({
	declarations: ir.declarations.map(item => ({ id: item.id
		, parameters: item.parameters.map(p => p.type), result: item.result.type }))
		.sort((a, b) => a.id.localeCompare(b.id))
	, types: ir.types.map(type => ({ id: type.id, name: type.name, kind: type.kind
		, fields: type.fields.map(({ name, type }) => ({ name, type }))
		, cases: type.cases.map(branch => ({ name: branch.name
			, fields: branch.fields.map(({ name, type }) => ({ name, type })) })) }))
		.sort((a, b) => a.id.localeCompare(b.id))
});
const packages = run => {
	assert.equal(run.profile, "perl"); assert.equal(run.packages.length, 2);
	const runtime = run.packages.find(pkg => pkg.role === "runtime");
	const component = run.packages.find(pkg => pkg.role === "component");
	assert.ok(runtime && component);
	assert.equal(runtime.name, "LeanBridge-Runtime");
	assert.equal(runtime.runtimeDelivery, "provided");
	assert.equal(component.runtimeDelivery, "dependency");
	assert.deepEqual(runtime.requires, []);
	assert.deepEqual(component.requires, [{ ecosystem: "cpan", name: runtime.name, version: runtime.version }]);
	assert.equal(component.runtimeIdentity, runtime.runtimeIdentity);
	for(const pkg of run.packages)
	{
		assert.equal(pkg.target, "cpan"); assert.equal(pkg.ecosystem, "cpan");
		assert.equal(pkg.profile, "native-library-v1"); hash(pkg.runtimeIdentity);
		assert.equal(pkg.artifacts.length, 1);
		assert.match(pkg.artifacts[0].path, /^archives\/LeanBridge-.*\.tar\.gz$/u);
		hash(pkg.artifacts[0].sha256); assert.ok(pkg.artifacts[0].bytes > 0);
	}
	for(const key of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"]) hash(run[key]);
	assert.equal(run.sourceRemovedBeforeInstallation, true);
};
const files = run => {
	assert.equal(Object.keys(run.nativeLibraries).length, 5);
	assert.deepEqual(run.nativeLibraries, Object.fromEntries(Object.entries(run.installedFiles)
		.filter(([path]) => path.endsWith(".so")).map(([path, file]) => [path, file.sha256])));
	for(const file of Object.values(run.installedFiles))
	{ hash(file.sha256); assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0); }
	assert.equal(Object.keys(run.installedFiles).filter(path => path.endsWith("install-receipt.json")).length, 2);
	for(const key of ["offlineInstall", "compilerFreeExecution", "relocatedInstallation", "repeatExecution", "installedFilesUnchanged"])
		assert.equal(run[key], true, key);
	hash(run.perlSha256);
};

/**
 * Authenticate all four ABIs, both source paths and separately injected faults.
 *
 * @param record - Original installed reports and complete terminal TAP logs.
 */
export const assertPerlStructuredCallableExecution = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "perl-structured-callable-execution");
	assert.deepEqual(record.scope, perlStructuredCallableScope);
	assert.deepEqual(record.abis, perlStructuredAbis);
	passing(record.installed, "tests/perl-structured-callables.test.mjs", "LEAN_BRIDGE_PERL_STRUCTURED_CALLABLE_TEST", 1);
	assert.deepEqual(record.reports.map(run => `${run.path}/${abiName(run)}`), order);
	const fixture = async name => sha256(await readFile(`tests/fixtures/structured-callable-consumers/${name}`));
	const documented = perlStructuredDocumentationExample(await readFile("docs/consume/perl.md", "utf8"));
	const builder = (await readFile("tests/fixtures/list-consumers/perl-probe-build.pl", "utf8"))
		.replaceAll("LeanBridge::Lists", "LeanBridge::Structured");
	for(const run of record.reports)
	{
		packages(run); files(run);
		assert.equal(run.packages.find(pkg => pkg.role === "component").name, "LeanBridge-Structured");
		assert.deepEqual(run.signatures, perlStructuredCallableSignatures(structuredCallableReviewedIr()));
		assert.equal(run.abiKey, abiHash(run.abi));
		assert.equal(run.wordBits, 64); assert.equal(run.checks, 64983);
		assert.equal(run.calls, 1686); assert.equal(run.rejected, 325);
		assert.deepEqual(run.shapes, [
			["array", 7493, 211, 41], ["list", 12219, 211, 41]
			, ["option", 2285, 207, 37], ["result", 3856, 211, 41]
			, ["tuple", 5723, 211, 41], ["record", 14176, 211, 41]
			, ["variant", 5018, 211, 41], ["alias", 14176, 211, 41]
		].map(([shape, checks, calls, rejected]) => ({ shape, checks, calls, rejected })));
		for(const key of ["producerInputsUnchanged", "relocatedBeforeInstallation", "handoffRemovedBeforeExecution", "publicCallsUninstrumented", "installedPodChecked"])
			assert.equal(run[key], true, key);
		assert.equal(run.apiPath, `${run.abi.archname}/LeanBridge/Structured.pm`);
		assert.ok(run.installedFiles[run.apiPath]);
		assert.deepEqual(run.consumerSourceHashes, { "perl-values.pl": await fixture("perl-values.pl"), "perl.pl": await fixture("perl.pl") });
		assert.deepEqual(run.documentation, { path: "docs/consume/perl.md"
			, sourceSha256: documented.sourceSha256, stdout: documented.stdout
			, stderr: "", installedPublicApi: true });
		const faults = run.faults; assertPerlStructuredFaults(faults);
		assert.equal(faults.checks, 134772); assert.equal(faults.failures, 22362);
		for(const key of ["isolatedXsCopy", "installedRuntime", "compilerFreeExecution"]) assert.equal(faults[key], true, key);
		for(const key of ["originalXsSha256", "instrumentedXsSha256", "probeSha256"]) hash(faults[key]);
		assert.notEqual(faults.originalXsSha256, faults.instrumentedXsSha256);
		assert.deepEqual(Object.keys(faults.sourceHashes).sort(), ["perl-faults.pl", "perl-probe.h", "perl-values.pl"]);
		for(const [name, expected] of Object.entries(faults.sourceHashes)) assert.equal(expected, await fixture(name));
		assert.equal(faults.builderSha256, sha256(builder));
		assert.deepEqual(faults.scenarios, record.reports[0].faults.scenarios);
		const sibling = record.reports.find(other => other.path !== run.path && other.abiKey === run.abiKey);
		assert.deepEqual(run.nativeLibraries, sibling.nativeLibraries);
		assert.equal(run.perlSha256, sibling.perlSha256);
	}
	assert.deepEqual(record.primitiveRegressions.map(run => run.abi), perlStructuredAbis);
	for(const regression of record.primitiveRegressions)
	{
		passing(regression, "tests/perl-callables.test.mjs", "LEAN_BRIDGE_PERL_CALLABLE_TEST", 2);
		assert.ok(regression.command.includes(`/perl/${regression.abi}/bin/perl`));
		assert.deepEqual(regression.reports.map(run => run.path), perlStructuredCallableScope.paths);
		for(const run of regression.reports)
		{
			packages(run); assert.equal(abiName(run.result), regression.abi);
			assert.equal(run.result.abiKey, abiHash(run.result.abi));
			assert.equal(run.result.wordBits, 64); assert.equal(run.checks, 8756);
			assert.equal(run.result.checks, run.checks);
			assert.equal(run.offlineInstall, true); assert.equal(run.compilerFreePath, true);
			assert.equal(run.consumerSha256, sha256(await readFile("tests/fixtures/callable-consumers/perl.pl")));
			assert.deepEqual(sortSignatures(run.signatures), sortSignatures(callableSignatures));
			assert.deepEqual(run.result.primitives.map(item => item.primitive).sort(), listPrimitives.toSorted());
			for(const primitive of run.result.primitives) assert.ok(primitive.checks > 100 && primitive.rejectedCases >= 3);
		}
	}
	assert.deepEqual(record.copiedRegressions.map(run => run.family), perlStructuredCopiedFamilies);
	for(const regression of record.copiedRegressions)
	{
		const singular = regression.family.slice(0, -1);
		passing(regression, `tests/perl-${regression.family}.test.mjs`, `LEAN_BRIDGE_PERL_${singular.toUpperCase()}_TEST`, 1);
		for(const abi of perlStructuredAbis) assert.ok(regression.command.includes(`/perl/${abi}/bin/perl`));
		assert.deepEqual(regression.reports.map(run => `${run.path}/${run.perl.slice(1)}-${run.threaded ? "threaded" : "unthreaded"}`), order);
		for(const run of regression.reports)
		{
			packages(run); files(run);
			const counts = { collections: 239954, compounds: 78980, lists: 112738, variants: 53680 };
			assert.equal(run.checks, counts[regression.family]);
			const cleanup = { collections: 1205, compounds: 268, lists: 717, variants: 584 };
			assert.equal(run.faults.checks, cleanup[regression.family]);
			assert.equal(run.producerHandoffRemoved, true); assert.equal(run.publicApiOnly, true);
			assert.equal(run.isolatedCompiledFaultProbe, true); assert.ok(run.faults.checks > 100);
			assert.equal(run.consumerSha256, sha256(await readFile(`tests/fixtures/${singular}-consumers/perl.pl`)));
			assert.deepEqual(run.primitives.map(item => typeof item === "string" ? item : item.name).sort(), listPrimitives.toSorted());
			if(regression.family === "variants") assert.deepEqual(run.contract, variantContract(cVariantReviewedIr()));
			else
			{
				const signatures = { collections: collectionSignatures, compounds: compoundSignatures, lists: listSignatures };
				assert.deepEqual(sortSignatures(run.signatures), sortSignatures(signatures[regression.family]));
			}
			const sibling = regression.reports.find(other => other.path !== run.path && other.perl === run.perl && other.threaded === run.threaded);
			assert.deepEqual(run.nativeLibraries, sibling.nativeLibraries);
		}
	}
};

/**
 * Verify every source transition and exactly thirty-two newly installed cells.
 *
 * @param record - Frozen predecessor, literal edits and inventory promotion.
 */
export const assertPerlStructuredCallableIntegration = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "perl-structured-callable-integration");
	assert.equal(record.baselineRevision, "aecdcd13d9caffed826aa79ae09af006803da650");
	assert.deepEqual(record.scope, perlStructuredCallableScope);
	assert.deepEqual(record.inventory, { previousVersion: "0.92.0", version: "0.93.0", previousInstalled: 4474, installed: 4506, total: 6562 });
	assert.equal(record.previous.path, jvmStructuredCallableHistoryPath);
	const oldBytes = await readFile(record.previous.path); assert.equal(sha256(oldBytes), record.previous.sha256);
	const previous = JSON.parse(oldBytes);
	assert.equal(record.execution.path, perlStructuredCallableExecutionPath);
	const bytes = await readFile(record.execution.path); assert.equal(sha256(bytes), record.execution.sha256);
	const execution = JSON.parse(bytes); await assertPerlStructuredCallableExecution(execution);
	assert.equal(record.codegen.path, perlStructuredCodegenPath);
	const codegenBytes = await readFile(record.codegen.path); assert.equal(sha256(codegenBytes), record.codegen.sha256);
	const codegen = JSON.parse(codegenBytes); assertPerlStructuredCodegenRegression(codegen);
	assert.deepEqual(record.updates.map(update => update.path).sort(), perlStructuredCallableChangedPaths);
	assert.deepEqual(Object.keys(record.additions).sort(), perlStructuredCallableAddedPaths);
	const paths = [...new Set([...Object.keys(previous.sourceHashes), ...perlStructuredCallableChangedPaths, ...perlStructuredCallableAddedPaths])].sort();
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), paths);
	for(const path of paths) assert.equal(sha256(await priorSource(path)), record.sourceHashes[path], path);
	const restored = {};
	for(const update of record.updates)
	{
		assert.equal(update.currentSha256, record.sourceHashes[update.path]);
		restored[update.path] = reversePerlStructuredCallableUpdate(await priorSource(update.path), update);
		if(previous.sourceHashes[update.path]) assert.equal(update.previousSha256, previous.sourceHashes[update.path]);
	}
	for(const [path, expected] of Object.entries(record.additions)) assert.equal(expected, record.sourceHashes[path]);
	for(const [path, expected] of Object.entries(codegen.predecessors))
	{
		assert.equal(expected, sha256(restored[path]));
		assert.equal(codegen.sourceHashes[path], record.sourceHashes[path]);
	}
	const { document, ...contracts } = { ...await readTypeSurface()
		, document: JSON.parse(await priorSource("docs/type-surface.v1.json")) };
	const oldDocument = JSON.parse(restored["docs/type-surface.v1.json"]);
	assert.equal(document.contractVersion, record.inventory.version); assert.equal(oldDocument.contractVersion, record.inventory.previousVersion);
	const cells = typeSurfaceCells(document, contracts), oldCells = typeSurfaceCells(oldDocument, contracts);
	const installed = values => values.filter(cell => cell.stages.installedExecution.state === "passed");
	assert.equal(installed(cells).length, record.inventory.installed); assert.equal(installed(oldCells).length, record.inventory.previousInstalled);
	assert.equal(cells.length, record.inventory.total);
	const promoted = cells.filter(cell => cell.stages.installedExecution.evidence.includes("perl-structured-callables-installed"));
	assert.equal(promoted.length, 32);
	for(const cell of promoted)
	{
		assert.equal(cell.profile, "perl"); assert.ok(perlStructuredCallableScope.shapes.includes(cell.shape));
		assert.ok(perlStructuredCallableScope.paths.includes(cell.path)); assert.ok(perlStructuredCallableScope.positions.includes(cell.position));
		assert.ok(cell.hostType && cell.conversionNote);
		for(const stage of Object.values(cell.stages)) assert.deepEqual({ state: stage.state, evidence: stage.evidence }, { state: "passed", evidence: ["perl-structured-callables-installed"] });
	}
	const oldById = new Map(oldCells.map(cell => [cell.id, cell]));
	for(const cell of cells.filter(cell => !promoted.includes(cell))) assert.deepEqual(cell, oldById.get(cell.id), cell.id);
	const entry = document.evidence.find(item => item.id === "perl-structured-callables-installed");
	assert.deepEqual(entry.artifacts, execution.reports.flatMap(run => run.packages.flatMap(pkg => pkg.artifacts.map(artifact => ({ path: `${run.profile}/${run.path}/${abiName(run)}/${artifact.path}`, sha256: artifact.sha256 })))));
	assert.ok(entry.files.some(file => file.path === perlStructuredCallableExecutionPath));
	await assertJvmStructuredCallableIntegration(previous);
};
