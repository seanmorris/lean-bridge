/**
 * Reject coordinated lifetime-report changes, including altered raw child output.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertOwnedPerlCallbackLifetime, assertOwnedPerlCallbackLifetimeMatrix
	, ownedPerlCallbackLifetimeReports } from "./owned-perl-callback-result-lifetime-evidence.mjs";

const enabled = process.env.LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_EVIDENCE_TEST === "1";
const directory = process.env.LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_LIFETIME_REPORTS ?? "build/owned-perl-callback-result-lifetime";
const compact = value => JSON.stringify(JSON.parse(canonicalJson(value)));
const zeroIndices = () => [0, 1, 2, 3, 4, 5];
const reports = async () => Object.fromEntries(await Promise.all(ownedPerlCallbackLifetimeReports
	.map(async name => [name, JSON.parse(await readFile(join(directory, name), "utf8"))])));
const select = (item, scenario = "process-reentry", threaded = true) => item.observations.find(observation =>
	observation.variant === scenario && observation.perl.endsWith(`/5.36.3-${threaded ? "threaded" : "unthreaded"}/bin/perl`));
const sync = observation => {
	for(const [name, field] of [["fork", "stdout"], ["thread", "returned"]])
	{
		const event = observation.observed.events[name];
		if(event?.observed) event[field] = compact(event.observed);
	}
	observation.execution.stdout = compact(observation.observed);
};
const coherent = (change, scenario = "process-reentry", threaded = true) => item => {
	const observation = select(item, scenario, threaded);
	change(observation.observed); sync(observation);
};

test("Perl callback lifetime evidence reconstructs both four-ABI scenario matrices", { skip: !enabled }, async () => {
	await assertOwnedPerlCallbackLifetimeMatrix(await reports());
});

test("Perl callback lifetime evidence rejects coordinated source, process, reentry and retirement changes", { skip: !enabled }, async t => {
	const originals = await reports();
	const mutations = [
		["extra acceptance", item => { item.finalAcceptance = true; }]
		, ["schema", item => { item.schemaVersion++; }]
		, ["kind", item => { item.kind = "installed"; }]
		, ["mode", item => { item.mode = item.mode === "ordinary" ? "reviewed" : "ordinary"; }]
		, ["not actual Lean", item => { item.actualLean = false; }]
		, ["installed claim", item => { item.installedPackage = true; }]
		, ["missing report observation", item => { item.observations.pop(); }]
		, ["duplicate scenario", item => { item.observations[1] = structuredClone(item.observations[0]); }]
		, ["unknown ABI", item => { item.observations[0].perl = "/usr/bin/perl"; }]
		, ["extra observation claim", item => { item.observations[0].acceptance = true; }]
		, ["changed scenario", item => { item.observations[0].variant = "other"; }]
		, ["capability", item => { item.options.callbackResultAnchors = false; }]
		, ["compiler identity", item => { item.input.sourceIdentity.leanCompilerSha256 = "0".repeat(64); }]
		, ["metadata", item => { item.input.metadata.extra = true; }]
		, ["rewritten probe", item => { item.probe = "print qq(ok);"; item.probeSha256 = sha256(item.probe); }]
		, ...["nativeSourceSha256", "declarationsSha256", "valuesSha256", "xsSha256"]
			.map(key => [key, item => { item[key] = "0".repeat(64); }])
		, ["process exit", item => { item.observations[0].execution.code = 1; }]
		, ["process signal", item => { item.observations[0].execution.signal = "SIGSEGV"; }]
		, ["process stderr", item => { item.observations[0].execution.stderr = "leaked ownership"; }]
		, ["process raw output", item => { item.observations[0].execution.stdout = "{}"; }]
		, ["build failure", item => { item.observations[0].build.code = 1; }]
		, ["build warnings", item => { item.observations[0].build.stderr = "warning"; }]
		, ["fingerprint query failure", item => { item.observations[0].fingerprintExecution.code = 1; }]
		, ["fingerprint raw output", item => { item.observations[0].fingerprintExecution.stdout = "{}"; }]
		, ...["perlVersion", "threaded"].map(key => ["coordinated " + key, item => {
			const observation = item.observations[0], value = key === "threaded" ? 0 : "v5.40.0";
			observation.fingerprint[key] = value; observation.observed[key] = value;
			observation.fingerprintExecution.stdout = compact(observation.fingerprint); sync(observation);
		}])
		, ["observed scope", coherent(value => { value.installedPackage = true; })]
		, ["observed schema", coherent(value => { value.finalAcceptance = true; })]
		, ["threaded check count", coherent(value => { value.checks--; })]
		, ["unthreaded check count", coherent(value => { value.checks++; }, "process-reentry", false)]
		, ["shutdown check count", coherent(value => { value.checks++; }, "reentrant-shutdown")]
		, ["initial native session", coherent(value => { value.baseline[1] = 0; })]
		, ...zeroIndices().map(index => ["final counter " + index, coherent(value => { value.final[index]++; })])
		, ["missing expected error", coherent(value => { value.errors.pop(); })]
		, ["changed retirement call stage", coherent(value => { value.errors[1].error = "Can't locate object method copy_arg0"; })]
		, ["expired original guard", coherent(value => { value.errors[0].error = "wrong type"; })]
		, ["fork abnormal wait", coherent(value => { value.events.fork.waitStatus = 256; })]
		, ["fork absent PID", coherent(value => { value.events.fork.pid = 0; })]
		, ["fork omitted public entry", coherent(value => { value.events.fork.observed.pop(); })]
		, ["thread omitted public entry", coherent(value => { value.events.thread.observed.pop(); })]
		, ["thread falsely skipped", coherent(value => { value.events.thread = { skipped: "Perl was built without ithreads" }; })]
		, ["unthreaded skip explanation", coherent(value => { value.events.thread.skipped = "not tested"; }, "process-reentry", false)]
		, ...["fork", "thread"].flatMap(name => [
			...zeroIndices().map(index => [`${name} public entry ${index} accepted`, coherent(value => { value.events[name].observed[index].ok = 1; })])
			, ...zeroIndices().map(index => [`${name} public entry ${index} wrong stage`
				, coherent(value => {
					value.events[name].observed[index].error = "Can't locate object method: initiating process and Perl interpreter thread\n";
				})
			])
			, [name + " duplicate public entry", coherent(value => { value.events[name].observed[1] = value.events[name].observed[0]; })]
			, [name + " native counters changed", coherent(value => { value.events[name].after[1]--; })]
			, [name + " inactive callback", coherent(value => { value.events[name].before[4] = 0; value.events[name].after[4] = 0; })]
			, [name + " creator did not continue", coherent(value => { value.events[name].creatorSerial = 0; })]
		])
		, ["creator handoff missing", coherent(value => { value.events.creator.handoffAfter = 0; })]
		, ["creator duplicate handoff", coherent(value => { value.events.creator.handoffAfter = 2; })]
		, ["creator result wrong", coherent(value => { value.events.creator.resultSerial = 0; })]
		, ...[0, 1, 2, 3].flatMap(index => [
			["reentry callback " + index, coherent(value => { value.events.reentry.calls[index] = 0; })]
			, ["reentry escaped borrow " + index, coherent(value => { value.events.reentry.escapedClosed[index] = 0; })]
		])
		, ["reentry duplicate handoff", coherent(value => { value.events.reentry.handoffAfter++; })]
		, ["reentry output", coherent(value => { value.events.reentry.outputSerial = 0; })]
		, ["reentry independent retain", coherent(value => { value.events.reentry.retainedSerial = 0; })]
		, ...["inputPin", "replyPin"].flatMap(name => [
			[name + " premature native release", coherent(value => { value.events[name].after[1]--; })]
			, [name + " premature identity release", coherent(value => { value.events[name].after[2]--; })]
			, [name + " inactive entry", coherent(value => { value.events[name].before[4] = 0; value.events[name].after[4] = 0; })]
		])
		, ["input pin callback value", coherent(value => { value.events.inputPin.callbackSerial = 0; })]
		, ["reply pin repeated FETCH", coherent(value => { value.events.replyPin.fetches = 2; })]
		, ["reply pin output", coherent(value => { value.events.replyPin.outputSerial = 0; })]
		, ...[1, 2, 4, 5].map(index => ["retirement leaked counter " + index, coherent(value => { value.events.retirement.after[index]++; })])
		, ["shutdown no active callback"
			, coherent(value => {
				value.events.shutdownDuringCallback.before[4] = 0; value.events.shutdownDuringCallback.after[4] = 0;
			}, "reentrant-shutdown")
		]
		, ["shutdown released native state too soon", coherent(value => { value.events.shutdownDuringCallback.after[1] = 0; }, "reentrant-shutdown")]
		, ["shutdown second callback ran", coherent(value => { value.events.shutdownResult.calls[1] = 1; }, "reentrant-shutdown")]
		, ["shutdown lost handoff", coherent(value => { value.events.shutdownResult.handoffAfter = 0; }, "reentrant-shutdown")]
		, ["shutdown wrong error stage", coherent(value => { value.errors[0].error = "status=4"; }, "reentrant-shutdown")]
		, ...[1, 2, 4, 5].map(index => ["shutdown leaked counter " + index, coherent(value => { value.events.shutdownResult.drained[index]++; }, "reentrant-shutdown")])
	];
	let rejected = 0;
	for(const [name, original] of Object.entries(originals))
	{
		for(const [label, change] of mutations)
		{
			const item = structuredClone(original); change(item);
			await assert.rejects(() => assertOwnedPerlCallbackLifetime(name, item), undefined, `${name}: ${label}`); ++rejected;
		}
		const missing = { ...originals }; delete missing[name];
		await assert.rejects(() => assertOwnedPerlCallbackLifetimeMatrix(missing)); ++rejected;
	}
	await assert.rejects(() => assertOwnedPerlCallbackLifetimeMatrix({ ...originals, "extra.json": originals["ordinary.json"] })); ++rejected;
	t.diagnostic(`${rejected} altered lifetime report and matrix claims rejected`);
});
