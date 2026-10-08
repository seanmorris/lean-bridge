/**
 * Check one completed source-entry probe run (VO #1430) from its output directory: the TAP, the report
 * and every raw call file. Accounting is recomputed from fixed directory-relative call files and compared
 * whole with the report; the report's recorded retained paths are never opened.
 *
 * @file
 */
import assert from "node:assert/strict";
import { sha256 } from "../../src/capsule/node.mjs";
import { scalarFinRejectionAbis, scalarFinRejectionInputs } from "./scalar-fin-rejection-packages.mjs";
import { checkSourceEntry, scalarFinSourceEntryProbe, sourceEntryControl, sourceEntryInstrumentation } from "./scalar-fin-source-entry.mjs";

export const sourceEntryRunTest = "installed scalar Fin rejections never enter the Lean source on any private ABI";
/** Each late case runs exactly this many times per ABI. */
export const sourceEntryLateMultiplicities = Object.freeze({ "pair raw late": 1, "pair public late": 1, "mix raw late Fin": 1, "mix public late Fin": 1, "mix cycle late Fin": 500 });

const count = value => Number.isSafeInteger(value) && value >= 0;
const counts = (tap, expected) => {
	for(const [key, count] of Object.entries(expected))
		assert.deepEqual([...tap.matchAll(new RegExp(`^# ${key} (.+)$`, "gmu"))].map(match => match[1]), [String(count)], `TAP ${key}`);
};

/**
 * The run's TAP holds exactly the one source-entry test, passed and not skipped.
 *
 * @param tap - Captured TAP.
 */
export const assertSourceEntryTap = tap => {
	assert.equal(typeof tap, "string", "TAP");
	assert.deepEqual([...tap.matchAll(/^(not ok|ok) (\d+) - (.*)$/gmu)].map(match => match.slice(1)), [["ok", "1", sourceEntryRunTest]]);
	assert.deepEqual([...tap.matchAll(/^1\.\.(\d+)$/gmu)].map(match => match[1]), ["1"], "one plan for one test");
	assert.doesNotMatch(tap, /# (?:SKIP|TODO)\b/u);
	counts(tap, { tests: 1, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0 });
};

/**
 * The probe inputs the current source would run for one ABI.
 *
 * @param abi - Private ABI name.
 */
const currentInputs = abi => scalarFinRejectionInputs(abi, scalarFinSourceEntryProbe(null));

/**
 * Check a completed run: TAP, report and every call file, re-accounted from the raw files.
 *
 * @param run - The run's output.
 * @param run.tap - Captured TAP text.
 * @param run.report - Text of the run's report.json.
 * @param run.read - Read a file relative to the run directory; only report.json and calls/<abi>.* are read.
 * @param run.inputs - The instrumented inputs for an ABI; the current source's by default.
 */
export const assertSourceEntryRun = async ({ tap, report, read, inputs = currentInputs }) => {
	assertSourceEntryTap(tap);
	assert.equal(typeof report, "string", "report.json");
	const parsed = JSON.parse(report);
	assert.deepEqual(Object.keys(parsed), ["instrumentation", "observations", "schemaVersion"]);
	assert.equal(parsed.schemaVersion, 1); assert.equal(parsed.instrumentation, sourceEntryInstrumentation);
	assert.deepEqual(parsed.observations.map(item => item.abi), scalarFinRejectionAbis, "every ABI in order");
	const summary = {};
	for(const [index, abi] of scalarFinRejectionAbis.entries())
	{
		const observation = parsed.observations[index], input = inputs(abi);
		assert.equal(observation.privateAbi, index + 2, abi);
		const files = { "stderr.txt": await read(`calls/${abi}.stderr.txt`), "stdout.json": await read(`calls/${abi}.stdout.json`) };
		const stderr = files["stderr.txt"].toString(), stdout = files["stdout.json"].toString(), result = JSON.parse(stdout);
		assert.deepEqual(Object.keys(result), ["abi", "checks", "rejections", "calls"], `${abi} consumer report`);
		// Consumer counts are exact non-negative integers at the producer's thresholds.
		assert.ok(count(result.checks) && result.checks > 100, `${abi} checks`);
		assert.ok(count(result.rejections) && result.rejections > 2000, `${abi} rejections`);
		const accounting = checkSourceEntry(stderr, result, input);
		const late = Object.fromEntries(Object.keys(sourceEntryLateMultiplicities).map(label => [label, result.calls.filter(record => record[4] === label).length]));
		assert.deepEqual(late, sourceEntryLateMultiplicities, `${abi} late cases`);
		assert.equal(result.calls.filter(record => record[1] === sourceEntryControl && record[3] === 1).length, 10, `${abi} control calls`);
		assert.equal(result.abi, abi);
		const retained = Object.fromEntries(Object.entries(files).map(([suffix, bytes]) => {
			const path = observation.sourceEntry?.retained?.[suffix]?.path;
			// The recorded path is provenance only; it must name this file but is never opened.
			assert.ok(typeof path === "string" && path.endsWith(`/calls/${abi}.${suffix}`), `${abi} retained ${suffix}`);
			return [suffix, { path, sha256: sha256(bytes), bytes: bytes.length }];
		}));
		assert.deepEqual(observation, {
			abi
			, privateAbi: index + 2
			, archiveSha256: observation.archiveSha256
			, runtimeArchiveSha256: observation.runtimeArchiveSha256
			, checks: result.checks
			, rejections: result.rejections
			, sourceEntry: { ...accounting, retained }
		}, `${abi} observation`);
		assert.match(observation.archiveSha256, /^[0-9a-f]{64}$/u); assert.match(observation.runtimeArchiveSha256, /^[0-9a-f]{64}$/u);
		assert.equal(accounting.rejected, result.rejections, `${abi} every rejection accounted`);
		assert.ok([accounting.calls, accounting.entered, accounting.rejected].every(count) && accounting.entered + accounting.rejected === accounting.calls, `${abi} accounting totals`);
		summary[abi] = { checks: result.checks, rejections: result.rejections, calls: accounting.calls, entered: accounting.entered };
	}
	return summary;
};
