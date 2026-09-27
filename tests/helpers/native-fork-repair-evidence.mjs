/**
 * Bind the fork-status correction to fresh native execution and exact history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { nativeRecursiveCallableCallsProbe } from "./native-recursive-callable-calls-probe.mjs";
import { assertOwnedDotnetProcess } from "./owned-dotnet-process-evidence.mjs";
import { ownedDotnetProcessPath } from "./owned-dotnet-process-history.mjs";
import { nativeForkRepairBaseline, nativeForkRepairChangedPaths, nativeForkRepairAddedPaths, reverseNativeForkRepair } from "./native-fork-repair-history.mjs";
import { beforeManagedCiIsolation, managedCiIsolationHistoricalBytes } from "./managed-ci-isolation-history.mjs";

export const nativeForkRepairCommand = "LEAN_BRIDGE_NATIVE_RECURSIVE_CALLABLE_TEST=1 node --test tests/native-recursive-callable-compile.test.mjs";
export const nativeForkRepairScope = {
	paths: ["ordinary-source", "reviewed-ir"]
	, expectedChildStatus: "NG_RUNTIME"
	, unchangedArgument: true, unchangedOutput: true, childAlarmSeconds: 5
	, parentRemainsUsable: true
	, productionChanged: false, generalForkSupport: false
	, sanitizers: ["address", "leak", "undefined"]
	, installedPackageClaim: false, promotedCells: 0
};
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const carrierResult = {
	checks: 26746, callbacks: 196, emptyReplies: 1, depth: 64
	, allocationFailures: 33, releasedReplies: 4
};
const callsResult = {
	checks: 68613, callbacks: 3365, shapes: 9, rejections: 1163
	, ownedReplies: 343, allocationFailures: 579
	, reentryDepth: 64, aliasSignatures: 2
};

/**
 * Authenticate each source, reconstruct the caller, and preserve older receipts.
 *
 * @param record - Fresh terminal execution and exact predecessor transitions.
 * @param replay - Also validate the complete previous evidence chain.
 */
export const assertNativeForkRepair = async (record, replay = true) => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "native-recursive-fork-repair");
	assert.equal(record.baselineRevision, nativeForkRepairBaseline);
	assert.deepEqual(record.scope, nativeForkRepairScope);
	assert.deepEqual(record.previous, { path: ownedDotnetProcessPath
		, sha256: "0001d8090edbd9fcb9e0f3772bfcefecc863dba6010f3313563ea7f95cc5412d" });
	const previousBytes = await readFile(record.previous.path);
	assert.equal(sha256(previousBytes), record.previous.sha256);
	const previous = JSON.parse(previousBytes.toString("utf8"));
	const paths = [...new Set([...Object.keys(previous.sources), ...nativeForkRepairChangedPaths, ...nativeForkRepairAddedPaths])].sort();
	assert.deepEqual(Object.keys(record.sources).sort(), paths);
	assert.deepEqual(record.updates.map(item => item.path).sort(), nativeForkRepairChangedPaths);
	const updates = new Map(record.updates.map(item => [item.path, item]));
	for(const path of paths)
	{
		const bytes = managedCiIsolationHistoricalBytes(path, await readFile(path), record.sources[path]);
		assert.equal(sha256(bytes), record.sources[path], path);
		const update = updates.get(path);
		if(update)
		{
			assert.equal(update.previousSha256, previous.sources[path], path);
			assert.equal(sha256(reverseNativeForkRepair(bytes.toString("utf8"), update)), previous.sources[path], path);
		}
		else if(previous.sources[path]) assert.equal(record.sources[path], previous.sources[path], path);
	}
	const run = record.run;
	assert.equal(run.command, nativeForkRepairCommand); assert.equal(run.exitCode, 0);
	assert.equal(run.sha256, sha256(run.text));
	for(const [key, value] of Object.entries({ tests: 1, pass: 1, fail: 0, skipped: 0, cancelled: 0 }))
		assert.match(run.text, new RegExp("^# " + key + " " + value + "$", "mu"));
	assert.doesNotMatch(run.text, /^not ok/mu);
	const diagnostics = run.text.split("\n").filter(line => line.startsWith("# {"))
		.map(line => JSON.parse(line.slice(2).replaceAll("\\\\", "\\"))).filter(item => item.input);
	assert.deepEqual(record.transport.reports, diagnostics);
	assert.deepEqual(record.transport.reports.map(item => item.path), nativeForkRepairScope.paths);
	for(const [index, report] of record.transport.reports.entries())
	{
		const model = createCompiledNativeModel(report.input);
		assert.equal(model.schemaVersion, index === 0 ? 4 : 5);
		assert.equal(model.exports.length, 33);
		assert.equal(report.bindingIrSha256, model.bindingIrSha256);
		assert.equal(report.initializer, "initialize_" + generateCompiledNativeLeanAdapters(model).module);
		const caller = nativeRecursiveCallableCallsProbe(model, { initializer: report.initializer }).source;
		assert.equal(report.calls.sourceSha256, sha256(caller));
		assert.match(caller, /alarm\(5\); bool selected = false/u);
		assert.match(caller, /status == NG_RUNTIME && !selected && !memcmp\(expected, &out, sizeof\(out\)\)/u);
		assert.deepEqual(report.result, carrierResult); assert.deepEqual(report.sanitized, carrierResult);
		assert.deepEqual(report.calls.result, callsResult); assert.deepEqual(report.calls.sanitized, callsResult);
		assert.deepEqual(report.rejectedCleanupMutations, ["argument-arena", "reply-owner"]);
		assert.deepEqual(report.calls.rejectedMutations, ["closure-disposal", "failed-output"]);
		assert.deepEqual(report.calls.retirementChecks, ["stop-repeated-callback", "preserve-first-error", "malformed-carrier"]);
		assert.equal(report.consumerSha256, "e5c12bd1be602eca16cb8107a6a97380dc509ceda5b98dc5e18d0d848801fd0d");
		digest(report.nativeLibrary.sha256);
		assert.ok(Number.isSafeInteger(report.nativeLibrary.bytes) && report.nativeLibrary.bytes > 0);
	}
	assert.notEqual(record.transport.reports[0].bindingIrSha256, record.transport.reports[1].bindingIrSha256);
	assert.deepEqual(record.transport.reports[0].nativeLibrary, record.transport.reports[1].nativeLibrary);
	assert.deepEqual(record.inventory, previous.inventory); assert.equal(record.inventory.promoted, 0);
	const { document, ...contracts } = await readTypeSurface();
	const inventory = beforeManagedCiIsolation("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8"), record.sources["docs/type-surface.v1.json"]);
	const old = JSON.parse(reverseNativeForkRepair(inventory, updates.get("docs/type-surface.v1.json")));
	const expected = structuredClone(old);
	for(const evidence of expected.evidence) for(const file of evidence.files)
	{
		const update = updates.get(file.path);
		if(update)
		{ assert.equal(file.sha256, update.previousSha256); file.sha256 = update.currentSha256; }
	}
	assert.deepEqual(JSON.parse(inventory), expected);
	assert.deepEqual(typeSurfaceCells(document, contracts), typeSurfaceCells(old, contracts));
	if(replay) await assertOwnedDotnetProcess(previous);
};
