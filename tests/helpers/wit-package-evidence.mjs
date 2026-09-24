/**
 * Require installed recursive WIT packages, independent rebuilds and regressions.
 * These records do not establish final copied-recursive acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename, dirname } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { wasmtimeCapiIdentity } from "../../src/build/native-wit-artifacts.mjs";
import { compileCopiedWitGraphModel } from "../../src/backends/wit/copied-graph-model.mjs";
import { renderWitGraphConversions } from "../../src/backends/wit/copied-graph-conversions.mjs";
import { generateCopiedCGraphTypes } from "../../src/backends/c/copied-graph-layout.mjs";
import { nativeRecursiveReviewedIr } from "./native-recursive-reviewed.mjs";
import { assertDotnetSharedRegressions } from "./dotnet-shared-regressions.mjs";
import { validateWitEvidence } from "./type-corpus-wit-evidence.mjs";
import { validateWitCollectionSignatures, witCollectionConsumer } from "./wit-collection-fixture.mjs";
import { beforeWitPackageIntegration, reverseWitPackageUpdate, witPackageChangedPaths } from "./wit-package-source-history.mjs";

export const witPackageExecutionPath = "docs/evidence/wit-recursive-packages-20260924.json";
export const witPackageRegressionPath = "docs/evidence/wit-recursive-package-regressions-20260924.json";
export const witPackageAddedPaths = [
	"src/backends/wit/copied-graph-package.mjs"
	, "tests/fixtures/recursive-consumers/wit-installed.c"
	, "tests/fixtures/recursive-consumers/wit-library-lifetime.c"
	, "tests/fixtures/recursive-consumers/wit-result-fault.c"
	, "tests/helpers/wit-graph-packages.mjs"
	, "tests/helpers/wit-package-evidence.mjs"
	, "tests/helpers/wit-package-source-history.mjs"
	, "tests/wit-copied-graph-package.test.mjs"
	, "tests/wit-graph-package-evidence.test.mjs"
].sort();
const digest = value => sha256(canonicalJson(value));
const hash = value => assert.match(value, /^[a-f0-9]{64}$/);
const flags = (value, names) => { for(const name of names) assert.equal(value[name], true, name); };
const fileMap = files => {
	assert.ok(Object.keys(files).length > 0);
	for(const [path, entry] of Object.entries(files))
	{
		assert.match(path, /^[A-Za-z0-9_.+/-]+$/);
		assert.ok(!path.startsWith("/") && path.split("/").every(part => !["", ".", ".."].includes(part)));
		assert.deepEqual(Object.keys(entry).sort(), ["bytes", "sha256"]);
		assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes > 0); hash(entry.sha256);
	}
};
const passingLog = (entry, passes = 1, skipped = 0) => {
	assert.equal(sha256(entry.text), entry.sha256);
	assert.match(entry.text, new RegExp(`# pass ${passes}\\n# fail 0\\n# cancelled 0\\n# skipped ${skipped}\\n`));
};

/**
 * Reverse only current source digests. Support claims and historical evidence stay.
 *
 * @param source - Entire current support inventory text.
 * @param refresh - Exact source-only refresh recorded by this integration.
 * @param updates - Authenticated production and verifier source transitions.
 */
export const beforeWitPackageInventory = (source, refresh, updates) => {
	assert.equal(refresh.path, "docs/type-surface.v1.json");
	assert.equal(refresh.previousSha256, "d9434c7aa2a196d3efded9878281457668a681d1da603837711dc5b5f1494e6c");
	assert.equal(sha256(source), refresh.currentSha256);
	assert.equal(new Set(refresh.entries.map(entry => entry.path)).size, refresh.entries.length);
	for(const entry of refresh.entries)
	{
		const transitions = updates.filter(update => update.path === entry.path);
		assert.ok(transitions.length > 0);
		assert.equal(entry.previousSha256, transitions[0].previousSha256);
		assert.equal(entry.currentSha256, transitions.at(-1).currentSha256);
		assert.ok(Number.isSafeInteger(entry.occurrences) && entry.occurrences > 0);
		const path = entry.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const pattern = new RegExp(`("path": "${path}",\\n +"sha256": ")${entry.currentSha256}(".*?)`, "g");
		assert.equal([...source.matchAll(pattern)].length, entry.occurrences);
		source = source.replace(pattern, `$1${entry.previousSha256}$2`);
	}
	assert.equal(sha256(source), refresh.previousSha256, "Only measured source digests may change");
	return source;
};

/**
 * Validate every installed observation and the independent archive rebuilds.
 *
 * @param record - Original package execution record, including sanitizer output.
 */
export const assertWitPackageReports = record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "wit-recursive-package-execution"); assert.equal(record.finalAcceptance, false);
	assert.deepEqual(record.profiles, ["wit-wasi"]); assert.equal(record.wordBits, 64);
	assert.equal(digest(Object.keys(record.sourceHashes).sort()), "ba659ea88942d6b0c0592ef66f4a7351d66ddd08bbd38b1552b34d54658205c3", "Complete measured compiler, fixture and registration source set");
	assert.deepEqual(Object.keys(record.reports).sort(), ["installed", "reproduction", "sanitizers"]);
	assert.deepEqual(Object.keys(record.reportHashes).sort(), Object.keys(record.reports).sort());
	assert.deepEqual(Object.keys(record.logs).sort(), Object.keys(record.reports).sort());
	for(const [name, report] of Object.entries(record.reports)) assert.equal(digest(report), record.reportHashes[name]);
	passingLog(record.logs.installed, 3, 1); passingLog(record.logs.reproduction); passingLog(record.logs.sanitizers);
	for(const [name, title] of [
		["installed", "ordinary and reviewed recursive WIT archives execute from a source-free installation"]
		, ["reproduction", "independent recursive WIT builds reproduce the installed archives"]
		, ["sanitizers", "WIT recursive converters preserve values and reject malformed arenas without leaks"]
	]) assert.ok(record.logs[name].text.includes(`- ${title}\n`));
	const { installed, reproduction, sanitizers } = record.reports;
	flags(installed, ["compiledLean", "installedPackage"]); assert.equal(installed.schemaVersion, 1);
	assert.equal(reproduction.schemaVersion, 1); assert.equal(reproduction.independentBuilds, true);
	assert.equal(reproduction.originalReportSha256, digest(installed));
	for(const report of [installed, reproduction]) assert.deepEqual(report.observations.map(run => run.reviewed), [false, true]);
	const expected = nativeRecursiveReviewedIr().declarations.map(item => ({ name: item.name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase(), arity: item.parameters.length })).sort((a, b) => a.name.localeCompare(b.name));
	for(const run of installed.observations)
	{
		const repeat = reproduction.observations.find(item => item.reviewed === run.reviewed);
		const { installed: evidence, ...provenance } = run;
		assert.deepEqual(repeat, { ...provenance, originalArchiveSha256: evidence.archiveSha256, reproducedOriginalArchive: true });
		flags(run, ["checkedSourceUnchanged", "compilerFreeReassembly", "deterministicReassembly", "witOnly"]);
		assert.equal(run.exports, 18); assert.equal(run.rejectsGraphReceiptDrift, 3); assert.equal(run.rejectsRegeneratedSourceDrift, 8);
		for(const key of ["binarySha256", "bindingIrSha256", "layoutSha256", "runtimeIdentity"]) hash(run[key]);
		const pkg = run.package, receipt = evidence.packageReceipt, files = receipt.files, compiled = evidence.compiled;
		assert.equal(pkg.target, "wit-wasi"); assert.equal(pkg.role, "component"); assert.equal(pkg.runtimeDelivery, "embedded");
		assert.equal(pkg.name, "recursive"); assert.equal(pkg.version, "1.0.0"); assert.equal(pkg.runtimeIdentity, run.runtimeIdentity);
		assert.deepEqual(pkg.requires, []); assert.equal(pkg.artifacts.length, 1);
		assert.equal(pkg.artifacts[0].path, "archives/recursive-1.0.0-wit-wasi.tar.gz");
		assert.equal(pkg.artifacts[0].sha256, evidence.archiveSha256); assert.ok(pkg.artifacts[0].bytes > 0);
		flags(evidence, ["sourceFreeInstallation", "compilerFreeExecution", "sourceAndHandoffRemovedBeforeExecution", "publicHeadersOnly", "offline", "nodelete"]);
		assert.equal(evidence.repeatExecutions, 2); assert.equal(evidence.observations.length, 2);
		assert.deepEqual(evidence.observations[0], evidence.observations[1]);
		assert.equal(receipt.kind, "lean-bridge-ordinary-wit-package"); assert.equal(receipt.glibcMinimumVersion, "2.38");
		assert.equal(receipt.bindingIrSha256, run.bindingIrSha256); assert.equal(receipt.runtimeIdentity, run.runtimeIdentity);
		assert.equal(compiled.bindingIrSha256, run.bindingIrSha256); assert.equal(compiled.runtimeIdentity, run.runtimeIdentity);
		assert.equal(compiled.profile, "native-wit-v1"); assert.equal(compiled.library, "librecursive_wasmtime.so");
		assert.equal(compiled.component, "component/recursive.wasm"); assert.equal(compiled.glibcMinimumVersion, receipt.glibcMinimumVersion);
		assert.deepEqual(compiled.settings, { name: pkg.name, version: pkg.version });
		for(const map of [files, compiled.files, compiled.wasmtime.files, evidence.libraries]) fileMap(map);
		assert.equal(Object.keys(files).length, 69); assert.equal(files["native-wit-adapter.json"].sha256, digest(compiled));
		assert.equal(files["share/lean-bridge/component/native-component.json"].sha256, compiled.componentReceiptSha256);
		assert.equal(files["share/lean-bridge/native-c-adapter.json"].sha256, compiled.adapterReceiptSha256);
		assert.equal(files["share/lean-bridge/runtime.json"].sha256, run.runtimeIdentity);
		assert.equal(receipt.componentSha256, files[compiled.component].sha256);
		assert.deepEqual(Object.fromEntries(Object.keys(wasmtimeCapiIdentity).map(key => [key, compiled.wasmtime[key]])), wasmtimeCapiIdentity);
		assert.equal(digest(compiled.wasmtime.files), wasmtimeCapiIdentity.filesSha256);
		for(const [path, identity] of Object.entries(compiled.files))
			assert.deepEqual(files[path === "wasmtime/LICENSE" ? "share/lean-bridge/licenses/Wasmtime-LICENSE" : path.startsWith("wasmtime/") ? path.slice(9) : path], identity);
		for(const [path, identity] of Object.entries(compiled.wasmtime.files)) assert.deepEqual(compiled.files["wasmtime/" + path], identity);
		assert.deepEqual(evidence.libraries, Object.fromEntries(Object.entries(files).filter(([path]) => /^lib\/[^/]+\.so$/.test(path))));
		assert.equal(Object.keys(evidence.libraries).length, 6);
		const components = Object.keys(evidence.libraries).filter(path => /^lib\/libcomponent_[a-f0-9]{20}\.so$/.test(path));
		assert.equal(components.length, 1); assert.equal(evidence.libraries[components[0]].sha256, run.binarySha256);
		const { loadedLibraries, ...values } = evidence.observations[0].values;
		assert.deepEqual(values, { calls: 33, checks: 73, compiledLean: true, exports: 18, independentResult: true, rejections: 11, scalarTypes: 19, trapRecovery: true });
		const loaded = loadedLibraries.filter(path => path.includes("/relocated/lib/"));
		assert.deepEqual(loaded.map(path => basename(path)).sort(), Object.keys(evidence.libraries).map(path => basename(path)).sort());
		assert.equal(new Set(loaded.map(dirname)).size, 1);
		assert.deepEqual(evidence.observations[0].lifetime, { notPreloaded: true, resultAfterClose: true, cleanupAfterDlclose: true });
		assert.deepEqual(evidence.faults, { limit: { limitRecoverable: true, twoSessionsUsable: true }, malformed: { runtimeRetired: true, twoSessionsRejected: true } });
		assert.deepEqual(evidence.documents.map(item => item.path), ["wit/recursive.wit", compiled.component]);
		for(const document of evidence.documents)
		{ assert.equal(document.sha256, files[document.path].sha256); assert.deepEqual(document.shapes, [expected, expected]); }
		assert.deepEqual(Object.keys(evidence.probes).sort(), ["consumer", "fault", "lifetime", "result-fault.so"]);
		for(const [name, fixture] of [["consumer", "wit-installed"], ["lifetime", "wit-library-lifetime"], ["fault", "wit-result-fault"], ["result-fault.so", "wit-result-fault"]])
		{
			assert.equal(evidence.probes[name].sourceSha256, record.sourceHashes[`tests/fixtures/recursive-consumers/${fixture}.c`]);
			hash(evidence.probes[name].executableSha256);
		}
	}
	assert.equal(sanitizers.synthetic, true); assert.equal(sanitizers.installedAcceptance, false);
	assert.deepEqual(sanitizers.sanitizers, ["address", "undefined", "leak"]);
	assert.ok(sanitizers.compilerOptions.includes("-fsanitize=address,undefined"));
	assert.deepEqual(sanitizers.observation, { inputBudgetFailures: 291, liveAllocations: 0, malformedInputs: 13, malformedOutputs: 263, outputBudgetFailures: 310, roundtrips: 14, scalarTypes: 19, scratchFailures: 132 });
	const ir = nativeRecursiveReviewedIr(), model = compileCopiedWitGraphModel(ir);
	assert.equal(sanitizers.bindingIrSha256, model.manifest.bindingIrSha256);
	assert.equal(sanitizers.conversionsSha256, sha256(renderWitGraphConversions(model)));
	assert.equal(sanitizers.headerSha256, sha256(generateCopiedCGraphTypes(ir).header));
};

/**
 * Keep all measured sources exact, including the explicit metadata transitions.
 *
 * @param record - Immutable installed execution record.
 */
export const assertWitPackageExecution = async record => {
	assertWitPackageReports(record);
	for(const [path, expected] of Object.entries(record.sourceHashes))
		assert.equal(sha256(beforeWitPackageIntegration(path, await readFile(path, "utf8"), expected)), expected, path);
};

/**
 * Verify every changed file, unchanged original receipt and fresh regression run.
 *
 * @param record - Current integration index, separate from execution evidence.
 */
export const assertWitPackageIntegration = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "wit-recursive-package-integration"); assert.equal(record.finalAcceptance, false);
	assert.equal(record.baselineRevision, "2fdd4cbb34a326205d4e0f7845290af305d906cc");
	assert.equal(record.execution.path, witPackageExecutionPath);
	const bytes = await readFile(record.execution.path); assert.equal(sha256(bytes), record.execution.sha256);
	const execution = JSON.parse(bytes); await assertWitPackageExecution(execution);
	assert.deepEqual([...new Set(record.updates.map(update => update.path))].sort(), witPackageChangedPaths);
	assert.deepEqual(Object.keys(record.additions).sort(), witPackageAddedPaths);
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), [...new Set([...Object.keys(execution.sourceHashes), ...witPackageChangedPaths, ...witPackageAddedPaths])].sort());
	for(const [path, expected] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), expected, path);
	for(const path of witPackageAddedPaths) assert.equal(record.additions[path], record.sourceHashes[path]);
	for(const path of witPackageChangedPaths)
	{
		let source = await readFile(path, "utf8");
		for(const update of record.updates.filter(update => update.path === path).toReversed()) source = reverseWitPackageUpdate(source, update);
	}
	beforeWitPackageInventory(await readFile(record.inventory.path, "utf8"), record.inventory, record.updates);
	assert.equal(record.regressions.path, witPackageRegressionPath);
	const regressions = await readFile(record.regressions.path); assert.equal(sha256(regressions), record.regressions.sha256);
	await assertWitPackageRegressions(JSON.parse(regressions));
};

/**
 * Preserve the six installed native gates and repeat both acyclic WIT families.
 *
 * @param record - Fresh shared-backend executions and pinned original baselines.
 */
export const assertWitPackageRegressions = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "wit-recursive-package-regressions"); assert.equal(record.finalAcceptance, false);
	assert.equal(record.nativeBaseline.path, "docs/evidence/native-shared-regressions-20260924.json");
	const bytes = await readFile(record.nativeBaseline.path); assert.equal(sha256(bytes), record.nativeBaseline.sha256);
	const original = JSON.parse(bytes), baselines = {};
	for(const [name, entry] of Object.entries(original.baselines))
	{
		const bytes = await readFile(entry.path); assert.equal(sha256(bytes), entry.sha256); baselines[name] = JSON.parse(bytes);
	}
	const gateNames = {
		c: "prepared recursive C and C++ packages run after removing source, headers and handoff"
		, jvm: "installed Java and Kotlin collections preserve copied values on both source paths"
		, perl: "ordinary and reviewed CPAN graphs install source-free on selected Perl ABIs"
		, python: "prepared recursive Python wheels install offline and execute without the producer"
		, ruby: "prepared recursive Ruby gems install offline and run without the producer"
		, rust: "prepared recursive Cargo crates install offline and run without producer or installed sources"
	};
	for(const [name, run] of Object.entries(record.native))
	{
		passingLog(run.log); assert.equal(digest(run.executions ?? run.report), run.observationsSha256);
		assert.ok(run.log.text.includes(`ok 1 - ${gateNames[name]}\n`));
	}
	assertDotnetSharedRegressions(record.native, baselines);
	assert.deepEqual(Object.keys(record.wit).sort(), ["callables", "collections"]);
	for(const [family, run] of Object.entries(record.wit))
	{
		passingLog(run.log); assert.equal(digest(run.report), run.reportSha256);
		assert.ok(run.log.text.includes(`ok 1 - installed WIT ${family === "callables" ? "callbacks and Lean closures preserve nineteen primitives" : "collections preserve copied values"} on both source paths\n`));
		assert.equal(run.previous.path, `docs/evidence/wit-${family}-${family === "callables" ? "20260919" : "20260922"}.json`);
		const bytes = await readFile(run.previous.path); assert.equal(sha256(bytes), run.previous.sha256);
		const previous = JSON.parse(bytes);
		assert.equal(run.report.schemaVersion, 1);
		assert.deepEqual(run.report.reports.map(item => item.path), ["ordinary-source", "reviewed-ir"]);
		for(const item of run.report.reports)
		{
			const prior = previous.executions.find(entry => entry.path === item.path);
			assert.equal(item.profile, "wit-wasi"); assert.equal(item.sourceRemovedBeforeInstallation, true);
			assert.deepEqual(item.signatures, prior.signatures);
			if(family === "callables")
			{
				flags(item, ["compilerFreePath", "offlineInstall"]);
				assert.equal(item.checks, prior.checks); assert.equal(item.consumerSha256, prior.consumerSha256);
			}
			else
			{
				const withoutPaths = value => { const copy = { ...value }; delete copy.loadedLibraries; return copy; };
				assert.deepEqual(withoutPaths(item.observation), withoutPaths(prior.observation));
				flags(item.wit, ["compilerFreeExecution", "installedSourcesRemoved", "publicHeadersOnly", "offline", "localLibraries"]);
				assert.equal(item.handoffRemovedBeforeExecution, true); assert.equal(item.wit.repeatExecutions, 2);
				const checked = { ...item, archive: item.packages[0]
					, archiveSha256: item.packages[0].artifacts[0].sha256
					, runtimeIdentity: item.packages[0].runtimeIdentity
					, declarationEvidence: { modelSha256: item.modelSha256 } };
				const fixture = { source: await witCollectionConsumer()
					, validateSignatures: validateWitCollectionSignatures
					, validateObservation: observation => assert.deepEqual(withoutPaths(observation), withoutPaths(prior.observation)) };
				validateWitEvidence(checked, { cModule: "collections" }, fixture);
				for(const path of ["include/collections_wasmtime.h", "src/collections_wasmtime.c", "lib/libcollections_wasmtime.so", "wit/collections.wit", "component/collections.wat", "component/collections.wasm"])
					assert.deepEqual(item.wit.packageReceipt.files[path], prior.wit.packageReceipt.files[path], `Unchanged acyclic WIT artifact: ${path}`);
			}
		}
	}
};
