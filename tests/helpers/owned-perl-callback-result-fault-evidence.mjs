/**
 * Reconstruct compiled callback faults and check every raw handoff observation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertOwnedPerlCallbackSources } from "./owned-perl-callback-result-runtime-evidence.mjs";
import { assertOwnedPerlReceiverMatrix, ownedPerlReceiverVariant } from "./owned-perl-receiver-evidence.mjs";

const keys = (value, expected) => assert.deepEqual(Object.keys(value).sort(), [...expected].sort());
const compact = value => JSON.stringify(JSON.parse(canonicalJson(value)));
const baseline = [0, 1, 1, 0, 0, 0], zeros = [0, 0, 0, 0, 0, 0];
const kinds = ["raw", "whole-reply", "whole-recovery"];
const domains = ["allocator", "exception", "native"];
// Exact observed sweep sizes and pre/post-transfer failures on all four ABIs.
// Terminal controls and raw attempts below must independently agree with these.
const counts = {
	raw: [[18, 50, 69, 69, 19], [22, 242, 265, 265, 88], [13, 120, 134, 133, 51]]
	, "whole-reply": [[17, 29, 47, 47, 19], [21, 157, 179, 179, 88], [10, 68, 79, 78, 51]]
	, "whole-recovery": [[31, 50, 82, 82, 19], [40, 242, 283, 283, 88], [22, 120, 143, 142, 51]]
};
const successfulSites = { raw: [68, 264], "whole-reply": [46, 178], "whole-recovery": [81, 282] };
const expectedSequence = kinds.flatMap(kind => [
	[kind, "none", 0, null]
	, ...domains.flatMap((domain, domainIndex) => [
		...Array.from({ length: counts[kind][domainIndex][2] }, (_, index) => [kind, domain, index + (domain === "native" ? 0 : 1), null])
		, [kind, "none", 0, domain]
	])
	, ...kind === "whole-recovery" ? [[kind, "none", 0, "intentional-exception"]] : []
]);

/**
 * Check the complete raw fault observation independently of its runner wrapper.
 *
 * @param observed - Decoded original subprocess output.
 * @param perl - Independently selected interpreter executable.
 */
export const assertOwnedPerlCallbackFaultObservation = (observed, perl) => {
	const fields = [
		"actualLean", "installedPackage", "perlVersion", "threaded", "checks"
		, "attempts", "baseline", "final", "heldErrors", "exception", "sweeps"
	];
	keys(observed, fields);
	const abi = ownedPerlReceiverVariant(perl);
	assert.equal(observed.actualLean, true); assert.equal(observed.installedPackage, false);
	assert.equal(observed.perlVersion, "v" + abi.split("-")[0]);
	assert.equal(observed.threaded, Number(!abi.endsWith("unthreaded")));
	assert.equal(observed.checks, 12015); assert.equal(observed.attempts.length, 1294);
	assert.equal(observed.heldErrors, 1273);
	assert.deepEqual(observed.attempts.map(item => [item.kind, item.domain, item.index, item.restoredAfter ?? null]), expectedSequence);
	assert.deepEqual(observed.baseline, baseline); assert.deepEqual(observed.final, zeros);
	keys(observed.sweeps, kinds);
	for(const kind of kinds)
	{
		keys(observed.sweeps[kind], domains);
		const controls = observed.attempts.filter(item => item.kind === kind && item.domain === "none");
		assert.equal(controls.length, kind === "whole-recovery" ? 5 : 4);
		assert.equal(controls[0].restoredAfter, undefined);
		assert.deepEqual(controls.slice(1).map(item => item.restoredAfter)
			, [...domains, ...kind === "whole-recovery" ? ["intentional-exception"] : []]);
		for(const [domainIndex, domain] of domains.entries())
		{
			const [before, after, length, firstSuccess, replyEnteredFailures] = counts[kind][domainIndex];
			const summary = { before, after, attempts: length, firstSuccess, replyEnteredFailures };
			assert.deepEqual(observed.sweeps[kind][domain], summary);
			const attempts = observed.attempts.filter(item => item.kind === kind && item.domain === domain);
			assert.equal(attempts.length, length);
			assert.equal(attempts.filter(item => !item.ok && item.handoffDelta === 0).length, before);
			assert.equal(attempts.filter(item => !item.ok && item.handoffDelta === 1).length, after);
			assert.equal(attempts.filter(item => !item.ok && item.calls[kind === "whole-reply" ? 0 : 1]).length, replyEnteredFailures);
			for(const [index, attempt] of attempts.entries())
			{
				assert.equal(attempt.index, index + (domain === "native" ? 0 : 1));
				assert.equal(attempt.ok, index === length - 1 ? 1 : 0);
			}
			assert.equal(attempts.at(-1).index, firstSuccess);
		}
	}
	let previousHandoff = 0, failures = 0;
	for(const item of observed.attempts)
	{
		const fields = [
			"kind", "domain", "index", "ok", "calls", "error", "closed", "cleanup"
			, "handoffBefore", "handoffAfter", "handoffDelta", "injectionSnapshot"
			, "independentSerial", "retainedSerial"
			, ...item.restoredAfter === undefined ? [] : ["restoredAfter"]
		];
		keys(item, fields);
		assert.ok(kinds.includes(item.kind)); assert.ok([...domains, "none"].includes(item.domain));
		assert.ok([0, 1].includes(item.handoffDelta));
		if(item.restoredAfter === "intentional-exception")
		{
			assert.equal(observed.exception.handoffBefore, previousHandoff);
			previousHandoff = observed.exception.handoffAfter;
		}
		assert.equal(item.handoffBefore, previousHandoff);
		assert.equal(item.handoffAfter, previousHandoff + item.handoffDelta);
		previousHandoff = item.handoffAfter;
		assert.deepEqual(item.closed, Array(3).fill(item.handoffDelta));
		assert.deepEqual(item.cleanup, baseline);
		assert.equal(item.retainedSerial, 63);
		assert.equal(item.independentSerial, item.kind === "raw" ? null : 63);
		assert.equal(item.injectionSnapshot.length, 8);
		assert.ok(item.injectionSnapshot.every(value => Number.isSafeInteger(value) && value >= 0));
		assert.deepEqual(item.injectionSnapshot.slice(6), [0, 0]);
		assert.equal(item.calls.length, 2);
		assert.ok(item.calls.every(value => value === 0 || value === 1));
		assert.ok(item.calls[1] <= item.calls[0]);
		if(item.kind === "whole-reply") assert.equal(item.calls[1], 0);
		if(item.domain === "none")
		{ assert.equal(item.index, 0); assert.equal(item.ok, 1); }
		else assert.equal(item.restoredAfter, undefined);
		if(item.ok)
		{
			assert.equal(item.handoffDelta, 1); assert.equal(item.error, "");
			assert.deepEqual(item.injectionSnapshot.slice(4, 6), successfulSites[item.kind]);
			assert.deepEqual(item.calls, item.kind === "whole-reply" ? [1, 0] : [1, 1]);
			if(item.domain === "allocator") assert.ok(item.index > item.injectionSnapshot[4]);
			if(item.domain === "exception") assert.ok(item.index > item.injectionSnapshot[5]);
		}
		else
		{
			failures++;
			assert.match(item.error, item.domain === "exception" ? /injected Perl ownership exception/u : /allocation failed|status=3/u);
			if(!item.handoffDelta) assert.deepEqual(item.calls, [0, 0]);
		}
	}
	assert.equal(previousHandoff, 1101); assert.equal(failures + 1, observed.heldErrors);
	const exception = observed.exception;
	assert.ok(Number.isSafeInteger(exception.expectedAddress) && exception.expectedAddress > 0);
	const expectedException = {
		expectedClass: "CallbackFaultException", actualClass: "CallbackFaultException"
		, expectedAddress: exception.expectedAddress
		, actualAddress: exception.expectedAddress
		, handoffBefore: 1099, handoffAfter: 1100, calls: [1, 0]
		, retainedSerial: 63, recoverySerial: 63, cleanup: baseline
	};
	assert.deepEqual(exception, expectedException);
};

/**
 * Require compiled source identities and the complete four-interpreter fault matrix.
 *
 * @param mode - Required ordinary or reviewed input path.
 * @param item - Original fault report, including full process output.
 */
export const assertOwnedPerlCallbackFaults = async (mode, item) => {
	const fields = [
		"schemaVersion", "kind", "mode", "actualLean", "installedPackage"
		, "options", "input", "nativeSourceSha256", "declarationsSha256"
		, "valuesSha256", "xsSha256", "probe", "probeSha256", "observations"
	];
	keys(item, fields);
	assert.equal(item.schemaVersion, 1); assert.equal(item.kind, "owned-perl-callback-result-faults");
	assert.equal(item.mode, mode); assert.equal(item.actualLean, true); assert.equal(item.installedPackage, false);
	await assertOwnedPerlCallbackSources(mode, "combined", item);
	const probe = await readFile("tests/fixtures/structured-types/owned-perl-callback-result-faults.pl", "utf8");
	assert.equal(item.probe, probe); assert.equal(item.probeSha256, sha256(probe));
	assertOwnedPerlReceiverMatrix(item.observations);
	for(const observation of item.observations)
	{
		keys(observation, ["perl", "build", "execution", "observed"]);
		assert.deepEqual(observation.build, { code: 0, stdout: "", stderr: "" });
		const { execution, observed, perl } = observation;
		assert.deepEqual(execution, { code: 0, signal: null, stdout: compact(observed), stderr: "" });
		assertOwnedPerlCallbackFaultObservation(observed, perl);
	}
};
