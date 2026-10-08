/**
 * Keep the scalar Fin source-entry probe exact: uninstrumented inputs unchanged, instrumented signatures
 * unchanged, and every stderr line accounted to one call (VO #1430).
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { scalarFinRejectionAbis, scalarFinRejectionInputs } from "./scalar-fin-rejection-packages.mjs";
import { accountSourceEntry, checkSourceEntry, scalarFinSourceEntryProbe, sourceEntryBegin, sourceEntryControl, sourceEntryEnd, sourceEntryHeaders, sourceEntryMarker } from "./scalar-fin-source-entry.mjs";

// The rejection suite's inputs before the probe existed; the probe must leave them byte-identical.
const uninstrumented = {
	scalar: ["a40c9325db305ca4d553151a15e3c7e574499b5bdcf1a87c5bebb50af3eae432", "7b59a9f254bbbd3e4bb278da6d0ae2354126a87d6f6479a649446ce8f6ec8b31", "mirror,never,one,huge,pair,tenth,mix"]
	, callable: ["d960b1a6d0aca2ded41a10eda3d9021624e596d2fdc2f474fb7e04e47be0fc44", "307ec812852f88a10dfadbad25d89f991bdb0a5cff5ac7099d071e2e2b34a13f", "mirror,never,one,huge,pair,tenth,mix,apply"]
	, copied: ["a827aa19c8665ecb5924381171c10bf5f46d0162a5e1d676a21da48d5bc6368e", "5866456bf980ffbc76ddc124d3c5f07d58fea22ab4a289384123b54cd25c8fd2", "mirror,never,one,huge,pair,tenth,mix,count"]
	, record: ["74e0136549d4775f8b1ab27876e9db47c32bf66ab1e8fc3a0cb9a4d2b71c14b0", "a864d5ee083192c2d8fa7b84dac789aa385c4d99cf9d78707d06dd30a5b34764", "mirror,never,one,huge,pair,tenth,mix,tag"]
	, compound: ["7eda6e95a84d8643cdc8e98429befd91ce70df8a0864664811f9ad88e0fd1ea5", "112c49dea8d9b72bca79008b476d3eb4e54d6aee94b7353250d05a8d6287a00a", "mirror,never,one,huge,pair,tenth,mix,orZero"]
	, nominal: ["578a4de0d6bdabbbd99896960fe1b9237f2e7a58a4e26f354fb1cdd5cf34047e", "90611a6f115b2182180a581b20f6282462ed021a30d2aae8fad0b4b1be5eb103", "mirror,never,one,huge,pair,tenth,mix,labelled"]
};
const markerPrefix = new RegExp(`dbgTrace "${sourceEntryMarker} \\w+" fun _ => `, "gu");

test("without a probe, every ABI's rejection inputs are byte-identical to the uninstrumented suite", () => {
	assert.deepEqual(scalarFinRejectionAbis, Object.keys(uninstrumented));
	for(const abi of scalarFinRejectionAbis)
	{
		const inputs = scalarFinRejectionInputs(abi), [lean, consumer, names] = uninstrumented[abi];
		assert.equal(sha256(inputs.lean), lean, abi); assert.equal(sha256(inputs.consumer), consumer, abi);
		assert.equal(inputs.names.join(","), names, abi);
		assert.doesNotMatch(inputs.lean, /dbgTrace/u); assert.doesNotMatch(inputs.consumer, /lean-bridge-call-/u);
	}
});

test("the probe keeps every signature, wraps each measured body and adds only the unrefined control", () => {
	for(const abi of scalarFinRejectionAbis)
	{
		const plain = scalarFinRejectionInputs(abi), probe = scalarFinRejectionInputs(abi, scalarFinSourceEntryProbe);
		assert.deepEqual(sourceEntryHeaders(probe.lean), [...sourceEntryHeaders(plain.lean), `${sourceEntryControl} (value : Nat) : Nat`], abi);
		assert.deepEqual(probe.names, [...plain.names, sourceEntryControl]);
		// Every export the consumer calls is traced under its own name; checkedText is a contract, not an export.
		for(const name of probe.names) assert.match(probe.lean, new RegExp(`^def ${name} .* := dbgTrace "${sourceEntryMarker} ${name}" fun _ => `, "mu"), `${abi}/${name}`);
		assert.doesNotMatch(probe.lean, /^def checkedText .*dbgTrace/mu);
		// Removing the markers and the control restores the uninstrumented source exactly.
		const control = new RegExp(`^def ${sourceEntryControl} .*\\n`, "mu");
		assert.equal(probe.lean.replace(markerPrefix, "").replace(control, ""), plain.lean, abi);
		// The consumer keeps every uninstrumented line in order; only imports, the call routing, controls and the report differ.
		const probeLines = probe.consumer.split("\n");
		let cursor = 0;
		const kept = plain.consumer.split("\n").filter(line => !line.startsWith("import * as api") && !line.startsWith("import { runtime }") && !line.startsWith("const raw =") && !line.startsWith("console.log(JSON.stringify"));
		for(const line of kept)
		{
			cursor = probeLines.indexOf(line, cursor);
			assert.ok(cursor >= 0, `${abi}: ${line}`);
			cursor++;
		}
		assert.match(probe.consumer, /checks, rejections, calls: sourceEntryCalls \}\)\);\n$/u);
		// The recorder's names cannot collide with a consumer's own variables, such as the callable ABI's host call count.
		assert.doesNotMatch(plain.consumer, /sourceEntry|\bmeasure\b|\bpublished\b/u);
	}
});

const stream = segments => segments.map((markers, id) => [`${sourceEntryBegin} ${id}`, ...markers.map(name => `${sourceEntryMarker} ${name}`), `${sourceEntryEnd} ${id}`].join("\n")).join("\n") + "\n";
const names = ["mirror", "pair", sourceEntryControl];
const calls = [[0, "mirror", "public", 1], [1, "mirror", "raw", 0], [2, "pair", "raw", 0], [3, sourceEntryControl, "raw", 1]];
const valid = [["mirror"], [], [], [sourceEntryControl]];

test("per-call accounting attributes each marker to one call and refuses compensated, misplaced or foreign output", () => {
	assert.deepEqual(accountSourceEntry(stream(valid), calls, names), { mirror: { entered: 1, rejected: 1 }, pair: { entered: 0, rejected: 1 }, [sourceEntryControl]: { entered: 1, rejected: 0 } });
	const text = stream(valid);
	const refused = {
		"missing marker in a successful call": [stream([[], [], [], [sourceEntryControl]]), calls]
		, "duplicate marker": [stream([["mirror", "mirror"], [], [], [sourceEntryControl]]), calls]
		, "wrong export": [stream([["pair"], [], [], [sourceEntryControl]]), calls]
		, "marker in a rejected call": [stream([["mirror"], ["mirror"], [], [sourceEntryControl]]), calls]
		// Equal totals: the rejected call entered and a successful one did not.
		, "compensated totals": [stream([[], ["mirror"], [], [sourceEntryControl]]), calls]
		, "late rejection entered": [stream([["mirror"], [], ["pair"], [sourceEntryControl]]), calls]
		, "marker after its call": [text.replace(`${sourceEntryMarker} mirror\n${sourceEntryEnd} 0\n`, `${sourceEntryEnd} 0\n${sourceEntryMarker} mirror\n`), calls]
		, "marker before any call": [`${sourceEntryMarker} mirror\n${text}`, calls]
		, "panic inside a call": [text.replace(`${sourceEntryEnd} 1\n`, `PANIC at OnboardingSmall.mirror\n${sourceEntryEnd} 1\n`), calls]
		, "foreign output between calls": [text.replace(`${sourceEntryBegin} 2\n`, `warning\n${sourceEntryBegin} 2\n`), calls]
		, "unknown export": [stream([["mirror"], [], [], ["other"]]), calls]
		, "unclosed call": [text.replace(`${sourceEntryEnd} 3\n`, ""), calls]
		, "mismatched end": [text.replace(`${sourceEntryEnd} 2`, `${sourceEntryEnd} 1`), calls]
		, "out-of-order calls": [text.replaceAll(`${sourceEntryBegin} 0`, "swap").replaceAll(`${sourceEntryBegin} 1`, `${sourceEntryBegin} 0`).replaceAll("swap", `${sourceEntryBegin} 1`), calls]
		, "missing trailing newline": [text.slice(0, -1), calls]
		, "unreported call": [text, calls.slice(0, 3)]
		, "misnumbered record": [text, calls.map((record, index) => index === 2 ? [3, ...record.slice(1)] : record)]
		, "unknown outcome": [text, calls.map((record, index) => index === 0 ? [0, "mirror", "public", 2] : record)]
	};
	for(const [label, [stderr, records]] of Object.entries(refused))
		assert.throws(() => accountSourceEntry(stderr, records, names), assert.AssertionError, label);
});

/**
 * A minimal consistent run for one ABI's names: every refined export rejects, the valid ones enter,
 * pair and mix reject late, mirror recovers and the control enters on all ten out-of-range calls.
 *
 * @param probeNames - Instrumented export names.
 */
const synthetic = probeNames => {
	const records = [], markers = [];
	const call = (name, kind, outcome) => {
		records.push([records.length, name, kind, outcome]); markers.push(outcome ? [name] : []);
	};
	for(const name of probeNames.filter(item => ![sourceEntryControl, "tenth"].includes(item)))
	{
		call(name, "raw", 0);
		if(name !== "never") call(name, "raw", 1);
	}
	call("tenth", "public", 1);
	for(let index = 0; index < 5; index++)
	{
		call(sourceEntryControl, "public", 1); call(sourceEntryControl, "raw", 1);
	}
	return { result: { calls: records }, stderr: stream(markers) };
};

test("each ABI's accounting requires its control entries, late rejections, recovery and per-export coverage", () => {
	for(const abi of scalarFinRejectionAbis)
	{
		const inputs = scalarFinRejectionInputs(abi, scalarFinSourceEntryProbe), run = synthetic(inputs.names);
		const summary = checkSourceEntry(run.stderr, run.result, inputs);
		assert.equal(summary.leanSha256, sha256(inputs.lean)); assert.equal(summary.consumerSha256, sha256(inputs.consumer));
		assert.match(summary.instrumentation, /not the unmodified packages/u);
		assert.deepEqual(summary.exports[sourceEntryControl], { entered: 10, rejected: 0 });
		const without = predicate => {
			const records = [], markers = [];
			for(const record of run.result.calls.filter((item, index) => !predicate(item, index)))
			{
				records.push([records.length, ...record.slice(1)]); markers.push(record[3] ? [record[1]] : []);
			}
			return [stream(markers), { calls: records }];
		};
		const refused = {
			"control call missing": without(([, name], index) => name === sourceEntryControl && index === run.result.calls.length - 1)
			, "no late pair rejection": without(([, name, , outcome]) => name === "pair" && !outcome)
			, "no late mix rejection": without(([, name, , outcome]) => name === "mix" && !outcome)
			, "no mirror recovery": without(([, name, , outcome]) => name === "mirror" && outcome)
			, "an export never rejects": without(([, name, , outcome]) => name === "huge" && !outcome)
		};
		for(const [label, [stderr, result]] of Object.entries(refused))
			assert.throws(() => checkSourceEntry(stderr, result, inputs), assert.AssertionError, `${abi}/${label}`);
		const control = structuredClone(run.result);
		control.calls.at(-1)[3] = 0;
		assert.throws(() => checkSourceEntry(stream(control.calls.map(([, name, , outcome]) => outcome ? [name] : [])), control, inputs), assert.AssertionError, `${abi}/control rejected`);
	}
});

// A JavaScript stand-in for the installed package: the same results and rejections, a marker on stderr
// whenever a body runs. With leak set, raw calls enter the body before checking their bounds.
const standIn = leak => `const huge = 184467440737095516170n;
const abi = process.env.STAND_IN_ABI;
const failure = abi === "scalar" ? "Component scalar call failed (6)" : abi === "callable" ? "Component callable call failed (6)" : "Component copied call failed (5)";
const fin = (value, bound) => { if (typeof value !== "bigint") throw new TypeError("not a BigInt"); if (value < 0n) throw new RangeError("negative"); if (value >= bound) throw new Error(failure); return value; };
const text = value => { if (typeof value !== "string" || value === "") throw new Error(failure); return value; };
const enter = name => console.error("${sourceEntryMarker} " + name);
const bodies = {
  mirror: [v => [fin(v, 10n)], v => 9n - v], never: [v => [fin(v, 0n)], v => v], one: [v => [fin(v, 1n)], v => v]
  , huge: [v => [fin(v, huge)], v => v], pair: [(l, r) => [fin(l, 10n), fin(r, 4n)], (l, r) => l * 4n + r]
  , tenth: [v => [fin(v, 2n ** 128n)], v => v % 10n], mix: [(t, d) => [text(t), fin(d, 10n)], (t, d) => t + d]
  , apply: [(f, v) => [f, fin(v, 10n)], (f, v) => f(v)], count: [(rows, v) => [rows, fin(v, 10n)], (rows, v) => BigInt(rows.length) + v]
  , tag: [(plain, v) => [plain, fin(v, 10n)], (plain, v) => plain.value + v], orZero: [(option, d) => [option, fin(d, 10n)], (option, d) => (option.tag === "some" ? option.value : 0n) + d]
  , labelled: [(label, v) => [label, fin(v, 10n)], (label, v) => label + v], ${sourceEntryControl}: [v => [fin(v, 2n ** 128n)], v => v]
};
export const call = (name, args, leaking) => {
  const [check, body] = bodies[name];
  if (leaking) enter(name);
  const checked = check(...args);
  if (!leaking) enter(name);
  return body(...checked);
};
export const leak = ${leak};
`;

test("the instrumented consumer accounts every call against a stand-in package and catches a stand-in that enters on rejection", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-source-entry-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	for(const leak of [false, true])
	{
		const root = join(directory, String(leak)), pkg = join(root, "node_modules/onboarding-small");
		await mkdir(join(pkg, "internal"), { recursive: true });
		await writeFile(join(pkg, "package.json"), JSON.stringify({ name: "onboarding-small", type: "module", exports: { ".": "./index.mjs", "./internal/runtime.mjs": "./internal/runtime.mjs" } }));
		await writeFile(join(pkg, "stand-in.mjs"), standIn(leak));
		await writeFile(join(pkg, "internal/runtime.mjs"), "import { call } from \"../stand-in.mjs\";\nexport const runtime = { call: (name, args) => call(name.replace(\"lean:OnboardingSmall.\", \"\"), args, false) };\n");
		await writeFile(join(pkg, "index.mjs"), `import { call, leak } from "./stand-in.mjs";\n${Object.keys({ mirror: 0, never: 0, one: 0, huge: 0, pair: 0, tenth: 0, mix: 0, apply: 0, count: 0, tag: 0, orZero: 0, labelled: 0, [sourceEntryControl]: 0 }).map(name => `export const ${name} = (...args) => call("${name}", args, leak);`).join("\n")}\n`);
		for(const abi of scalarFinRejectionAbis)
		{
			const inputs = scalarFinRejectionInputs(abi, scalarFinSourceEntryProbe);
			await writeFile(join(root, "index.mjs"), inputs.consumer);
			const run = await processBuildRunner.capture({ command: process.execPath, args: ["index.mjs"], cwd: root, env: { ...process.env, STAND_IN_ABI: abi } });
			const result = JSON.parse(run.stdout.trim());
			if(!leak)
			{
				const summary = checkSourceEntry(run.stderr, result, inputs);
				assert.equal(summary.rejected, result.rejections, abi);
				assert.equal(summary.entered + summary.rejected, summary.calls, abi);
			}
			else assert.throws(() => checkSourceEntry(run.stderr, result, inputs), /was rejected/u, abi);
		}
	}
});
