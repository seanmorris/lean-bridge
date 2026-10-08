/**
 * Account for Lean source entry on every call of the installed scalar Fin rejection packages (VO #1430).
 * A probe variant of the fixture wraps each measured export body, and an unrefined control, in dbgTrace.
 * Its consumer brackets every public and raw call with begin and end records on the same stderr stream,
 * so each marker belongs to exactly one call. Probe packages are instrumented builds; they are not the
 * unmodified packages the rejection suite installs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { sha256 } from "../../src/capsule/node.mjs";

export const sourceEntryMarker = "lean-bridge-source-entry";
export const sourceEntryBegin = "lean-bridge-call-begin";
export const sourceEntryEnd = "lean-bridge-call-end";
export const sourceEntryControl = "traceNat";
export const sourceEntryInstrumentation = "probe build: dbgTrace markers in the fixture source and call brackets in the consumer; not the unmodified packages of the rejection suite";
const traced = new Set(["mirror", "never", "one", "huge", "pair", "tenth", "mix", "apply", "count", "tag", "orZero", "labelled", sourceEntryControl]);
const definition = /^def (\w+) (.*?) := (.+)$/u;
const outOfRange = ["10n", "11n", "2n ** 70n", "184467440737095516170n", "184467440737095516171n"];

/**
 * Every def header of a Lean source: its name, parameters and result type, without the body.
 *
 * @param lean - Fixture text whose definitions are listed.
 */
export const sourceEntryHeaders = lean => [...lean.matchAll(/^def (\w+) (.*?) :=/gmu)].map(match => `${match[1]} ${match[2]}`);

const replaceOnce = (value, from, to) => {
	assert.equal(value.split(from).length, 2, from);
	return value.replace(from, to);
};

/**
 * Wrap each measured body in a marker naming its export and add the unrefined control export.
 *
 * @param lean - Uninstrumented fixture source.
 */
export const instrumentSourceEntryLean = lean => {
	const lines = lean.split("\n").map(line => {
		const match = definition.exec(line);
		return match && traced.has(match[1]) ? `def ${match[1]} ${match[2]} := dbgTrace "${sourceEntryMarker} ${match[1]}" fun _ => ${match[3]}` : line;
	});
	return replaceOnce(lines.join("\n"), "end OnboardingSmall\n", `def ${sourceEntryControl} (value : Nat) : Nat := dbgTrace "${sourceEntryMarker} ${sourceEntryControl}" fun _ => value\nend OnboardingSmall\n`);
};

const measured = `import * as published from "onboarding-small";
import { runtime } from "./node_modules/onboarding-small/internal/runtime.mjs";
const sourceEntryCalls = [];
let sourceEntryNext = 0;
// Begin and end share the stderr stream that Lean's dbgTrace writes, so each marker falls inside its call.
const measure = (name, kind, call) => {
  const id = sourceEntryNext++;
  console.error("${sourceEntryBegin} " + id);
  let outcome = 1;
  try { return call(); } catch (error) { outcome = 0; throw error; } finally { console.error("${sourceEntryEnd} " + id); sourceEntryCalls.push([id, name, kind, outcome]); }
};
const api = new Proxy(published, { get: (target, key) => typeof target[key] === "function" ? (...args) => measure(String(key), "public", () => target[key](...args)) : target[key] });
const raw = (name, args) => measure(name, "raw", () => runtime.call("lean:OnboardingSmall." + name, args));
`;

/**
 * Route every public and raw call of the uninstrumented consumer through the bracketing recorder, add
 * the unrefined control calls with the same out-of-range numbers and report every call.
 *
 * @param consumer - Uninstrumented consumer source.
 * @param abi - Private ABI name.
 */
export const instrumentSourceEntryConsumer = (consumer, abi) => {
	let probe = replaceOnce(consumer, `import * as api from "onboarding-small";
import { runtime } from "./node_modules/onboarding-small/internal/runtime.mjs";
const raw = (name, args) => runtime.call("lean:OnboardingSmall." + name, args);
`, measured);
	const controls = `// Unrefined control: the same out-of-range numbers reach the source when no Fin bound applies.
for (const value of [${outOfRange.join(", ")}]) {
  check(api.${sourceEntryControl}(value) === value, "${sourceEntryControl} public " + value);
  check(raw("${sourceEntryControl}", [value]) === value, "${sourceEntryControl} raw " + value);
}
`;
	const report = `console.log(JSON.stringify({ abi: ${JSON.stringify(abi)}, checks, rejections }));\n`;
	probe = replaceOnce(probe, report, `${controls}console.log(JSON.stringify({ abi: ${JSON.stringify(abi)}, checks, rejections, calls: sourceEntryCalls }));\n`);
	return probe;
};

/**
 * Assign every stderr line to one measured call and require exactly one marker naming the export for
 * each successful call, none for each rejected call and nothing else on stderr.
 *
 * @param stderr - Consumer stderr.
 * @param calls - The consumer's [id, export, kind, outcome] records, outcome 1 for success.
 * @param names - Exports that may appear in a marker.
 */
export const accountSourceEntry = (stderr, calls, names) => {
	const lines = stderr.split("\n");
	assert.equal(lines.pop(), "", "stderr ends with a newline");
	const segments = [];
	let open = null;
	for(const line of lines)
	{
		const parts = line.split(" ");
		assert.equal(parts.length, 2, `unexpected stderr line: ${line}`);
		const [kind, value] = parts;
		if(kind === sourceEntryBegin)
		{
			assert.equal(open, null, `nested or unclosed call: ${line}`);
			assert.equal(value, String(segments.length), `out-of-order call: ${line}`);
			open = { id: segments.length, markers: [] };
		}
		else if(kind === sourceEntryEnd)
		{
			assert.ok(open && value === String(open.id), `unmatched end: ${line}`);
			segments.push(open); open = null;
		}
		else if(kind === sourceEntryMarker)
		{
			assert.ok(open, `source entry outside any call: ${line}`);
			assert.ok(names.includes(value), `unknown export in marker: ${line}`);
			open.markers.push(value);
		}
		else assert.fail(`unexpected stderr line: ${line}`);
	}
	assert.equal(open, null, "unclosed call");
	assert.equal(segments.length, calls.length, "every measured call has one bracket");
	const exports = {};
	for(const [index, record] of calls.entries())
	{
		assert.equal(record.length, 4);
		const [id, name, kind, outcome] = record;
		assert.equal(id, index); assert.ok(names.includes(name), name);
		assert.ok(["public", "raw"].includes(kind), kind); assert.ok([0, 1].includes(outcome));
		assert.deepEqual(segments[index].markers, outcome ? [name] : [], `${kind} ${name} call ${id} ${outcome ? "succeeded" : "was rejected"}`);
		exports[name] ??= { entered: 0, rejected: 0 };
		exports[name][outcome ? "entered" : "rejected"]++;
	}
	return exports;
};

/**
 * Check one ABI's per-call accounting and the coverage it must include.
 *
 * @param stderr - Consumer stderr.
 * @param result - Parsed consumer report.
 * @param inputs - The instrumented inputs the run used.
 */
export const checkSourceEntry = (stderr, result, inputs) => {
	const exports = accountSourceEntry(stderr, result.calls, inputs.names);
	// Every refined export rejects at least once without entering its source; all but Fin 0 also enter on valid calls.
	for(const name of inputs.names.filter(item => !["tenth", sourceEntryControl].includes(item)))
	{
		assert.ok(exports[name]?.rejected > 0, `${name} rejects`);
		assert.equal(exports[name].entered > 0, name !== "never", `${name} entry`);
	}
	assert.ok(exports.tenth.entered > 0); assert.equal(exports.tenth.rejected ?? 0, 0);
	assert.deepEqual(exports[sourceEntryControl], { entered: outOfRange.length * 2, rejected: 0 });
	// Late rejection: the second argument fails after the first passed, in both pair and mix.
	assert.ok(result.calls.some(([, name, kind, outcome]) => name === "pair" && kind === "raw" && !outcome));
	assert.ok(result.calls.some(([, name, kind, outcome]) => name === "mix" && kind === "raw" && !outcome));
	// Recovery: a mirror call enters its source right after a rejected mirror call.
	assert.ok(result.calls.some(([, name, , outcome], index) => name === "mirror" && outcome && result.calls[index - 1]?.[1] === "mirror" && !result.calls[index - 1][3]));
	const calls = result.calls.length, entered = result.calls.filter(record => record[3]).length;
	return { instrumentation: sourceEntryInstrumentation, leanSha256: sha256(inputs.lean), consumerSha256: sha256(inputs.consumer), calls, entered, rejected: calls - entered, exports };
};

/** The probe the rejection harness accepts: instrument its inputs, then account for every call. */
export const scalarFinSourceEntryProbe = Object.freeze({
	instrument: (inputs, abi) => ({
		lean: instrumentSourceEntryLean(inputs.lean)
		, names: [...inputs.names, sourceEntryControl]
		, consumer: instrumentSourceEntryConsumer(inputs.consumer, abi)
	})
	, check: checkSourceEntry
});
