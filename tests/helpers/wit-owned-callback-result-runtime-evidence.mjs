/**
 * Reconstruct selected direct WIT executions without installed or frozen claims.
 * Compiler-output pins identify the retained runs; this reader does not rerun Lean.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createCompiledNativeModel } from "../../src/build/native-graph-model.mjs";
import { generateOwnedWitPackage } from "../../src/backends/wit/owned-package.mjs";
import { ownedWitValueContract } from "../../src/build/owned-wit-artifacts.mjs";
import { wasmtimeCapiIdentity } from "../../src/build/native-wit-artifacts.mjs";
import { ownedDotnetCallbackResultSource, ownedDotnetCallbackResultCombinedSource
	, ownedDotnetCallbackResultReviewedIr, ownedDotnetCallbackResultCombinedReviewedIr } from "./owned-dotnet-callback-result-fixture.mjs";
import { ownedWitCallbackResultProbe, ownedWitCallbackNativeSource } from "./wit-owned-callback-result-probe.mjs";

const keys = (item, names) => assert.deepEqual(Object.keys(item).sort(), [...names].sort());
const hash = item => sha256(canonicalJson(item));
const integer = value => assert.ok(Number.isSafeInteger(value) && value >= 0);
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
export const ownedWitCallbackRuntimeReports = Object.freeze(["ordinary", "reviewed"]
	.flatMap(mode => ["no-host", "host", "combined"].map(variant => `${mode}-${variant}.json`)));
export const ownedWitCallbackRuntimeLogs = Object.freeze([
	"wit-callback-runtime-ordinary-no-host-r2.log"
	, "wit-callback-runtime-ordinary-host-r2.log"
	, "wit-callback-runtime-remaining-r2.log"
]);
const logHashes = [
	"cf13cf7679c5403661b5e400346e604c00cba22f0949b605521ae7fa87dd9066"
	, "3de2f81df300023c0eb94d5c87211c69b801af247980c9fd0ab661da67ce41af"
	, "8af75a4705268316ae9afaadc84bc8bd0385207a739419a46bf2a88251385028"
];
export const ownedWitCallbackRuntimeSourcePaths = Object.freeze([
	"src/analyze/NativeExports.lean"
	, "tests/fixtures/onboarding/owned-aggregates/Owned.lean"
	, "tests/fixtures/structured-types/owned-callback-results.c"
	, "tests/fixtures/structured-types/owned-wit-callback-mixed.c"
	, "tests/fixtures/structured-types/owned-installed-callback-combinations.c"
]);

// Independent identities of the four original compiler captures and component
// binaries. Host-only toggles do not change their authored Lean or component.
const captures = {
	"ordinary-no-host": [
		"920079df0971ebdb4d68beffb9741e01c33c27ca224d9b384d55955b8a7b751d"
		, "bcbe1b731415c26f0d4e6a1580cd88140de90f2b70b9c165115f69458d4bb978"
		, "84145e36a2c094209b85574cad95ee26b6637ab7298086a29275e9088f39a98e"
		, "07e71c69f0205e07ad53944dded3a3b1ab5d5b6911c351117f694f6d9c575697"
		, "bde2b4fec721a1b692c1c9c7d621e51b00e95eb373ed91310ed1f56397d5730c"
	]
	, "ordinary-combined": [
		"5d2d9563230b2e0ac3a9b7c21ecdd55c0032041103cfd3af77e4f5f4d1428821"
		, "12132fe4c4adc825ad52ad4ac9ac0e8f975ede18581bb2ec9fea486cb6eadd75"
		, "40b93f505e355da63f7211d9d1c9d33584cc481353106b328820cb1ed3d14cc7"
		, "74b2d3a83c17e99eaa480c0302494eff4d8559c371ce0b694a318dcdd9951614"
		, "7c2ac370b6dbb75cba0d37c546fc4522ad4e75d9ac48acc6cbe5dbeb9da6ea07"
	]
	, "reviewed-no-host": [
		"df4862e16d7c77318be1928c3634adea5f5214f43126626ddfa0590321f9f8d7"
		, "0401bc748535ff5512f3b94c4b7277409a6da9a716337664456105bb11a62fd9"
		, "86af4e86936f638e85d71476c77f72f8517063ae427741090468c8482e727f4b"
		, "ff87fab1d6ff0e3cc94fb39e5229a4783071a788376ac4eae3bcd45ca9c361cb"
		, "f84ee1985da0a7fc35a7d5eb758c6c1e65bf96786244d21360c1d6418c3f0bed"
	]
	, "reviewed-combined": [
		"444534c11087d9a5c1b0b85ffdfa19861ba285eb0a256c1aa61b513ece6c5ac3"
		, "86626697eefbc6044987086a060a7ac70557fdfb917013d162f50a626e722239"
		, "d62d681455231e1387cd6cbbed3e43a27ed55821de7b0a4b5b560f6517abc773"
		, "cd3d7224aab64a45718ac4468dcb9b87b143f468697dd48571e9f12550e687bf"
		, "e7b5f747bd2a7f4ff6d5dbced13ddbe75d504ceda19a59254bba464baa4a7653"
	]
};
const countsByVariant = {
	"no-host": [3760, 67, 87, 77, 49, 73272337]
	, host: [8928, 154, 184, 164, 50, 73272349]
	, combined: [10129, 154, 212, 192, 53, 599529531]
};
const identities = (mode, variant) => captures[`${mode}-${variant === "combined" ? variant : "no-host"}`];
const expectedNames = variant => ({
	exports: ["newTicket", "serial", "echoRecord", "makeRecord"
		, "makeLeasedRecord", "echoRecursive", "makeRecursive"
		, "makeRecordCallback", "dispatch", "applyTwice"
		, ...variant !== "no-host" ? ["callbackRecord", "callbackRecursive"] : []
		, ...variant === "combined" ? ["borrowRecord", "moveRecord", "moveTwice"] : []]
	, closures: ["make_record_result_t", "make_leased_record_result_t"
		, "make_recursive_result_t", "apply_twice_argument1_t", "dispatch_result_t"]
});
const expectedObservations = variant => {
	const [checks, allocationFailures, componentCalls, leanCalls, closureCalls, exportMask] = countsByVariant[variant];
	return {
		result: { checks, allocationFailures, live: 0, identities: 0 }
		, counts: { componentCalls, nativeImports: componentCalls, leanCalls
			, exports: expectedNames(variant).exports.length
			, closureCalls, exportMask, closureMask: 62 }
	};
};
const successful = (run, stdout) => assert.deepEqual(run, { code: 0, stderr: "", stdout });

/**
 * Reconstruct one named original runtime report, including its raw process output.
 *
 * @param name - Independently selected canonical report basename.
 * @param item - Unmodified direct-runtime report, never an installed-package report.
 * @param readSource - Injectable source reader for later authenticated replay.
 */
export const assertOwnedWitCallbackRuntime = async (name, item, readSource = readFile) => {
	const readFixture = (path, encoding) => {
		assert.ok(ownedWitCallbackRuntimeSourcePaths.includes(path), path);
		return readSource(path, encoding);
	};
	assert.ok(ownedWitCallbackRuntimeReports.includes(name), name);
	keys(item, ["schemaVersion", "mode", "variant", "input", "native", "result"
		, "counts", "execution", "expectedExports", "expectedClosures"
		, "observedExports", "observedClosures", "wasmTools", "wasmtime"
		, "validation", "manifest", "ownedValues", "componentBase64"
		, "componentSha256", "sourceSha256", "observedSourceSha256", "probeSha256"
		, "freeBytesBefore", "freeBytesAfterExecution"]);
	const [, mode, variant] = /^(ordinary|reviewed)-(no-host|host|combined)\.json$/u.exec(name);
	assert.equal(item.schemaVersion, 1); assert.equal(item.mode, mode); assert.equal(item.variant, variant);
	const combined = variant === "combined", hostCallbacks = variant !== "no-host";
	const { metadata, sourceIdentity, component, ...options } = item.input;
	assert.deepEqual(options, { hostCallbacks, callbackResultAnchors: true
		, transferredInputs: combined, anchoredResults: combined
		, receiverExports: combined });
	assert.deepEqual(component, { id: "owned-aggregates@1.0.0", name: "owned-aggregates", version: "1.0.0" });
	const capture = identities(mode, variant);
	assert.equal(hash(metadata), capture[0]); assert.equal(hash(sourceIdentity), capture[1]);
	assert.deepEqual(metadata.diagnostics, []);
	assert.equal(sourceIdentity.leanVersion, "4.32.2");
	assert.equal(sourceIdentity.leanCommit, "f3b06c705e6c85f5314019d5d3baab0fec5b580c");
	assert.equal(sourceIdentity.leanCompilerSha256, "e8baaa71855a616dc351028f3ad2200051b0671f423a1696a100e809302d5550");
	assert.equal(sourceIdentity.extractorSha256, sha256(await readFixture("src/analyze/NativeExports.lean")));
	const lean = await readFixture("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8")
		+ (combined ? ownedDotnetCallbackResultCombinedSource : ownedDotnetCallbackResultSource);
	assert.equal(sourceIdentity.sourceTreeSha256, sha256(lean));
	assert.deepEqual(sourceIdentity.modules[0].source, { path: "Owned.lean", sha256: sha256(lean) });
	assert.equal(Boolean(sourceIdentity.reviewedBindingIr), mode === "reviewed");
	if(mode === "reviewed")
	{
		const ir = (combined ? ownedDotnetCallbackResultCombinedReviewedIr : ownedDotnetCallbackResultReviewedIr)();
		assert.equal(sourceIdentity.reviewedBindingIr.source, canonicalJson(ir));
		assert.equal(sourceIdentity.reviewedBindingIr.sourceSha256, hash(ir));
	}
	const native = createCompiledNativeModel(item.input, { ownedGraphs: true
		, ownedHostCallbacks: hostCallbacks, ownedCallbackResultAnchors: true
		, ownedInputTransfers: combined, ownedAnchoredResults: combined
		, ownedReceiverExports: combined });
	assert.deepEqual(item.native, native);
	assert.equal(native.schemaVersion, 11); assert.equal(native.ownedGraph.schemaVersion, 6);
	const binary = Buffer.from(item.componentBase64, "base64");
	assert.equal(binary.toString("base64"), item.componentBase64);
	assert.equal(sha256(binary), capture[2]); assert.equal(item.componentSha256, capture[2]);
	const generated = generateOwnedWitPackage(item.input, binary);
	assert.deepEqual(item.manifest, generated.model.manifest);
	assert.equal(item.manifest.graph.schemaVersion, 4);
	assert.deepEqual(item.manifest.graph.callbackResultAnchors, generated.layout.callbacks
		.filter(fn => fn.anchor !== undefined).map(fn => ({ id: fn.id, parameter: fn.anchor - 1 })));
	assert.equal(item.manifest.graph.callbackResultAnchors.length, 4);
	assert.deepEqual(item.ownedValues, ownedWitValueContract(native, { generated, files: generated.files }));
	assert.equal(item.ownedValues.schemaVersion, 5);
	assert.equal(item.sourceSha256, sha256(generated.source));
	assert.equal(item.observedSourceSha256, sha256(ownedWitCallbackNativeSource(generated)));
	assert.equal(item.probeSha256, sha256(await ownedWitCallbackResultProbe(generated, combined, hostCallbacks, readFixture)));
	if(!hostCallbacks)
	{
		assert.equal(generated.carriers.callbackSource, undefined);
		assert.equal(native.ownedGraph.hostCallbacks, undefined);
		assert.doesNotMatch(generated.publicHeader, /_host\b/u);
		assert.equal(item.ownedValues.hostCallbacks, null);
	}
	const names = expectedNames(variant), observed = expectedObservations(variant);
	assert.deepEqual(item.expectedExports, names.exports); assert.deepEqual(item.expectedClosures, names.closures);
	assert.deepEqual(item.observedExports, [...names.exports].sort()); assert.deepEqual(item.observedClosures, [...names.closures].sort());
	assert.deepEqual(item.result, observed.result); assert.deepEqual(item.counts, observed.counts);
	const mask = (functions, includes) => Number(functions.reduce((bits, fn, index) => includes(fn) ? bits | 1n << BigInt(index) : bits, 0n));
	assert.equal(item.counts.exportMask, mask(generated.layout.functions, fn => names.exports.includes(fn.name)));
	assert.equal(item.counts.closureMask, mask(generated.layout.callbacks, fn => names.closures.includes(
		generated.values.callbacks.find(value => value.id === fn.id).cName.slice(generated.values.prefix.length + 1, -5))));
	successful(item.execution, JSON.stringify(observed.result) + "\n" + JSON.stringify(observed.counts) + "\n");
	for(const value of [item.freeBytesBefore, item.freeBytesAfterExecution]) integer(value);
	assert.ok(item.freeBytesBefore > 2 * 1024 ** 3 && item.freeBytesAfterExecution > 2 * 1024 ** 3);
	successful(item.wasmTools, "wasm-tools 1.245.1 (76927bf4b 2026-02-12)\n");
	assert.equal(hash(item.wasmtime), wasmtimeCapiIdentity.filesSha256);
	for(const file of Object.values(item.wasmtime))
	{ keys(file, ["bytes", "sha256"]); integer(file.bytes); digest(file.sha256); }
	const args = [["parse", "component.wat", "-o", "component.wasm"]
		, ["validate", "component.wasm"]
		, ["component", "wit", "component.wit", "--json"]
		, ["component", "wit", "component.wasm", "--json"]];
	assert.equal(item.validation.length, 4);
	for(const [index, run] of item.validation.entries())
	{
		const { args: actual, ...execution } = run;
		assert.deepEqual(actual, args[index]);
		successful(execution, index < 2 ? "" : run.stdout);
		if(index >= 2)
		{
			assert.equal(sha256(run.stdout), capture[index + 1]);
			assert.deepEqual(Object.keys(JSON.parse(run.stdout)).sort(), ["interfaces", "packages", "types", "worlds"]);
		}
	}
};

/**
 * Require exactly one report for each source path and capability variant.
 *
 * @param reports - Canonical basenames mapped to the six original reports.
 * @param readSource - Injectable source reader for later authenticated replay.
 */
export const assertOwnedWitCallbackRuntimeMatrix = async (reports, readSource = readFile) => {
	keys(reports, ownedWitCallbackRuntimeReports);
	for(const name of ownedWitCallbackRuntimeReports) await assertOwnedWitCallbackRuntime(name, reports[name], readSource);
};

/**
 * Require the complete selected raw TAP streams, excluding both r1 diagnostics.
 * This checks recorded process output, not a frozen receipt or CI authorization.
 *
 * @param logs - Exact three selected r2 basenames mapped to raw UTF-8 logs.
 * @param reports - Already reconstructed reports whose diagnostics must match.
 */
export const assertOwnedWitCallbackRuntimeLogs = (logs, reports) => {
	keys(logs, ownedWitCallbackRuntimeLogs); keys(reports, ownedWitCallbackRuntimeReports);
	const selections = [["ordinary-no-host.json"], ["ordinary-host.json"]
		, ownedWitCallbackRuntimeReports.slice(2)];
	for(const [index, name] of ownedWitCallbackRuntimeLogs.entries())
	{
		const lines = logs[name].split("\n"); assert.equal(lines.pop(), ""); let cursor = 0;
		const line = expected => assert.equal(lines[cursor++], expected, `${name}:${cursor}`);
		const duration = prefix => {
			const value = lines[cursor++]; assert.ok(value.startsWith(prefix));
			const number = value.slice(prefix.length); assert.match(number, /^(?:0|[1-9]\d*)(?:\.\d+)?$/u);
			assert.ok(Number.isFinite(Number(number)) && Number(number) > 0);
		};
		for(const report of selections[index])
		{
			const item = reports[report], { mode, variant } = item;
			const title = `WIT callback-result owners execute through compiled Lean (${mode}, ${variant})`;
			const observed = expectedObservations(variant);
			line("TAP version 13"); line("# Subtest: " + title); line("ok 1 - " + title);
			line("  ---"); duration("  duration_ms: "); line("  type: 'test'"); line("  ...");
			line("# " + JSON.stringify({ mode, variant
				, ...observed.result, ...observed.counts
				, freeBytesBefore: item.freeBytesBefore
				, freeBytesAfterExecution: item.freeBytesAfterExecution }));
			line("1..1");
			for(const [key, value] of Object.entries({ tests: 1, suites: 0, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
				line(`# ${key} ${value}`);
			duration("# duration_ms ");
			if(index === 2) line(`WIT_CASE_EXIT=0 CASE=${mode}, ${variant}`);
		}
		assert.equal(cursor, lines.length, name);
		assert.equal(sha256(logs[name]), logHashes[index], name);
	}
};
