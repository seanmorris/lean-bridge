/**
 * Reconstruct direct callback lifetime evidence without widening its scope.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertOwnedPerlCallbackSources } from "./owned-perl-callback-result-runtime-evidence.mjs";
import { ownedPerlReceiverVariant, ownedPerlReceiverVariants } from "./owned-perl-receiver-evidence.mjs";

export const ownedPerlCallbackLifetimeReports = Object.freeze(["ordinary.json", "reviewed.json"]);
const scenarios = ["process-reentry", "reentrant-shutdown"];
const compact = value => JSON.stringify(JSON.parse(canonicalJson(value)));
const keys = (value, expected) => assert.deepEqual(Object.keys(value).sort(), [...expected].sort());
const zero = [0, 0, 0, 0, 0, 0];
const location = (source, text, path) => {
	const lines = source.split("\n"), matches = lines.flatMap((line, index) => line.includes(text) ? [index + 1] : []);
	assert.equal(matches.length, 1, text);
	return `${path} line ${matches[0]}.\n`;
};

const expectations = (probe, valuesSource, probePath) => {
	assert.ok(["consumer.pl", "./lifetime.pl"].includes(probePath));
	const consumer = text => location(probe, text, probePath);
	const member = name => location(valuesSource, `return LeanBridge::OwnedProbe::${name}($self, @_);`, "LeanBridge/OwnedProbe.pm");
	const invoke = consumer("sub invoke {");
	const context = "Lean ownership requires its initiating process and Perl interpreter thread at ";
	const closed = "Lean ownership session is closed at ";
	const expired = "Lean ownership failed (status=4): resource closed at ";
	const entries = [
		["copy_arg0", consumer("['copy_arg0', sub")]
		, ["copy_result", consumer("['copy_result', sub")]
		, ["native_call", consumer("['native_call', sub")]
		, ["borrowed_get", consumer("['borrowed_get', sub")]
		, ["consuming_receiver", member("move_record")]
		, ["host_callback", invoke]
	].map(([name, site]) => ({ name, ok: 0, error: context + site }));
	const errors = [
		["closed original after reentry", expired + invoke]
		, ["retired copy_arg0", closed + consumer("rejected('retired copy_arg0'")]
		, ["retired copy_result", closed + consumer("rejected('retired copy_result'")]
		, ["retired native call", closed + consumer("rejected('retired native call'")]
		, ["retired consuming receiver", closed + member("move_record")]
		, ["retired borrowed result get", expired + consumer("rejected('retired borrowed result get'")]
	].map(([label, error]) => ({ label, error }));
	const shutdownErrors = [
		["callback retired factory", closed + consumer("rejected('callback retired factory'")]
		, ["callback retired entry", closed + invoke]
		, ["outer callback after shutdown", closed + member("move_twice")]
	].map(([label, error]) => ({ label, error }));
	return { entries, errors, shutdownErrors };
};

// The fixed, source-bound probe has these deterministic live-state ledgers on
// both compiler paths and all four ABIs. Only the actual child PID is variable.
const expectedEvents = (scenario, threaded, expected, pid) => {
	if(scenario === "reentrant-shutdown") return {
		shutdownDuringCallback: { before: [63, 88, 11, 8, 2, 0], after: [63, 88, 11, 8, 2, 0] }
		, shutdownResult: { calls: [1, 0], handoffBefore: 0, handoffAfter: 1, drained: [22, 0, 0, 5, 0, 0] }
	};
	const foreign = { observed: expected.entries, before: [46, 89, 11, 8, 2, 0]
		, after: [46, 89, 11, 8, 2, 0], creatorSerial: 63 };
	return {
		fork: { ...foreign, pid, waitStatus: 0, stdout: compact(expected.entries) }
		, thread: threaded ? { ...foreign, returned: compact(expected.entries) }
			: { skipped: "Perl was built without ithreads" }
		, creator: { handoffBefore: 0, handoffAfter: 1, resultSerial: 63 }
		, reentry: { calls: [1, 1, 1, 1], escapedClosed: [1, 1, 1, 1]
			, handoffBefore: 1, handoffAfter: 2, outputSerial: 63, retainedSerial: 63 }
		, inputPin: { before: [44, 86, 9, 7, 2, 0], after: [44, 86, 9, 7, 2, 0], callbackSerial: 63 }
		, replyPin: { before: [43, 51, 6, 5, 2, 0], after: [43, 51, 6, 5, 2, 0], fetches: 1, outputSerial: 63 }
		, retirement: { after: [21, 0, 0, 5, 0, 0] }
	};
};

/**
 * Require the complete lifetime output from a direct or sanitizer dispatcher.
 *
 * @param observed - Decoded original subprocess output.
 * @param perl - Independently selected interpreter executable.
 * @param scenario - Independently required lifetime scenario.
 * @param probe - Authenticated authored Perl probe.
 * @param valuesSource - Reconstructed generated public values module.
 * @param probePath - Exact supported execution path, not a diagnostic rewrite.
 */
export const assertOwnedPerlCallbackLifetimeObservation = (observed, perl, scenario, probe, valuesSource, probePath = "consumer.pl") => {
	assert.ok(scenarios.includes(scenario));
	const abi = ownedPerlReceiverVariant(perl);
	const fingerprint = { perlVersion: "v" + abi.split("-")[0], threaded: Number(!abi.endsWith("unthreaded")) };
	const expected = expectations(probe, valuesSource, probePath);
	let pid;
	if(scenario === "process-reentry")
	{
		pid = observed.events.fork.pid;
		assert.ok(Number.isSafeInteger(pid) && pid > 0, "actual fork PID");
	}
	assert.deepEqual(observed, { actualLean: true, installedPackage: false
		, variant: scenario, ...fingerprint, baseline: [0, 1, 1, 0, 0, 0], final: zero
		, checks: scenario === "reentrant-shutdown" ? 12 : fingerprint.threaded ? 58 : 48
		, events: expectedEvents(scenario, fingerprint.threaded, expected, pid)
		, errors: scenario === "reentrant-shutdown" ? expected.shutdownErrors : expected.errors });
};

/**
 * Require source-bound raw lifetime output for both scenarios on four real ABIs.
 *
 * @param name - Independently required report basename.
 * @param item - Original direct-runtime lifetime report.
 */
export const assertOwnedPerlCallbackLifetime = async (name, item) => {
	assert.ok(ownedPerlCallbackLifetimeReports.includes(name), name);
	const mode = name.slice(0, -5);
	keys(item, ["schemaVersion", "kind", "mode", "actualLean", "installedPackage"
		, "options", "input", "nativeSourceSha256", "declarationsSha256"
		, "valuesSha256", "xsSha256", "probe", "probeSha256", "observations"]);
	assert.equal(item.schemaVersion, 1);
	assert.equal(item.kind, "owned-perl-callback-result-lifetime");
	assert.equal(item.mode, mode); assert.equal(item.actualLean, true); assert.equal(item.installedPackage, false);
	const { xs } = await assertOwnedPerlCallbackSources(mode, "combined", item);
	const probe = await readFile("tests/fixtures/structured-types/owned-perl-callback-result-lifetime.pl", "utf8");
	assert.equal(item.probe, probe); assert.equal(item.probeSha256, sha256(probe));
	assert.deepEqual(item.observations.map(observation => `${ownedPerlReceiverVariant(observation.perl)}:${observation.variant}`).sort()
		, ownedPerlReceiverVariants.flatMap(abi => scenarios.map(scenario => `${abi}:${scenario}`)).sort());
	for(const observation of item.observations)
	{
		keys(observation, ["perl", "variant", "fingerprintExecution", "fingerprint", "build", "execution", "observed"]);
		const abi = ownedPerlReceiverVariant(observation.perl), scenario = observation.variant;
		const fingerprint = { perlVersion: "v" + abi.split("-")[0], threaded: Number(!abi.endsWith("unthreaded")) };
		assert.deepEqual(observation.fingerprint, fingerprint);
		assert.deepEqual(observation.fingerprintExecution, { code: 0, stderr: "", stdout: compact(fingerprint) });
		assert.deepEqual(observation.build, { code: 0, stderr: "", stdout: "" });
		assertOwnedPerlCallbackLifetimeObservation(observation.observed, observation.perl, scenario, probe, xs.valuesSource);
		assert.deepEqual(observation.execution, { code: 0, signal: null, stderr: "", stdout: compact(observation.observed) });
	}
};

/**
 * Check complete ordinary/reviewed lifetime reports without an acceptance claim.
 *
 * @param reports - Original reports keyed by independently required filenames.
 */
export const assertOwnedPerlCallbackLifetimeMatrix = async reports => {
	keys(reports, ownedPerlCallbackLifetimeReports);
	for(const name of ownedPerlCallbackLifetimeReports) await assertOwnedPerlCallbackLifetime(name, reports[name]);
};
