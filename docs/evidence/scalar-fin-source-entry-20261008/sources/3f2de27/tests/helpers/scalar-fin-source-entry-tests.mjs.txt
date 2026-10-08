/**
 * Keep the scalar Fin source-entry probe exact: uninstrumented inputs unchanged, instrumented signatures
 * unchanged, and every stderr line accounted to one call (VO #1430).
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { scalarFinRejectionAbis, scalarFinRejectionInputs } from "./scalar-fin-rejection-packages.mjs";
import { accountSourceEntry, checkSourceEntry, scalarFinSourceEntryProbe, sourceEntryBegin, sourceEntryControl, sourceEntryEnd, sourceEntryHeaders, sourceEntryLateCases, sourceEntryMarker } from "./scalar-fin-source-entry.mjs";

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

// Instrumentation alone never writes; only retain uses the directory.
const instrumenting = scalarFinSourceEntryProbe(null);

test("the probe keeps every signature, wraps each measured body and adds only the unrefined control", () => {
	for(const abi of scalarFinRejectionAbis)
	{
		const plain = scalarFinRejectionInputs(abi), probe = scalarFinRejectionInputs(abi, instrumenting);
		assert.deepEqual(sourceEntryHeaders(probe.lean), [...sourceEntryHeaders(plain.lean), `${sourceEntryControl} (value : Nat) : Nat`], abi);
		assert.deepEqual(probe.names, [...plain.names, sourceEntryControl]);
		// Every export the consumer calls is traced under its own name; checkedText is a contract, not an export.
		for(const name of probe.names) assert.match(probe.lean, new RegExp(`^def ${name} .* := dbgTrace "${sourceEntryMarker} ${name}" fun _ => `, "mu"), `${abi}/${name}`);
		assert.doesNotMatch(probe.lean, /^def checkedText .*dbgTrace/mu);
		// Removing the markers and the control restores the uninstrumented source exactly.
		const control = new RegExp(`^def ${sourceEntryControl} .*\\n`, "mu");
		assert.equal(probe.lean.replace(markerPrefix, "").replace(control, ""), plain.lean, abi);
		// The consumer keeps every uninstrumented line in order; only imports, call routing, case labels, controls and the report differ.
		const probeLines = probe.consumer.split("\n");
		let cursor = 0;
		const routed = ["import * as api", "import { runtime }", "const raw =", "console.log(JSON.stringify", "  try { call(); }"];
		for(const line of plain.consumer.split("\n").filter(item => !routed.some(prefix => item.startsWith(prefix))))
		{
			cursor = probeLines.indexOf(line, cursor);
			assert.ok(cursor >= 0, `${abi}: ${line}`);
			cursor++;
		}
		assert.match(probe.consumer, /checks, rejections, calls: sourceEntryCalls \}\)\);\n$/u);
		assert.match(probe.consumer, /^ {2}sourceEntryCase = label;$/mu);
		// Each late case names one exact call in both the plain and the probe consumer.
		for(const line of Object.values(sourceEntryLateCases))
		{
			assert.equal(plain.consumer.split(line).length, 2, `${abi}: ${line}`); assert.equal(probe.consumer.split(line).length, 2, `${abi}: ${line}`);
		}
		// The recorder's names cannot collide with a consumer's own variables, such as the callable ABI's host call count.
		assert.doesNotMatch(plain.consumer, /sourceEntry|\bmeasure\b|\bpublished\b/u);
	}
});

const stream = segments => segments.map((markers, id) => [`${sourceEntryBegin} ${id}`, ...markers.map(name => `${sourceEntryMarker} ${name}`), `${sourceEntryEnd} ${id}`].join("\n")).join("\n") + "\n";
const names = ["mirror", "pair", sourceEntryControl];
const calls = [[0, "mirror", "public", 1, null], [1, "mirror", "raw", 0, "mirror raw 10"], [2, "pair", "raw", 0, "pair raw late"], [3, sourceEntryControl, "raw", 1, null]];
const valid = [["mirror"], [], [], [sourceEntryControl]];
const change = (index, record) => calls.map((item, position) => position === index ? record : item);

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
		, "misnumbered record": [text, change(2, [3, "pair", "raw", 0, "pair raw late"])]
		, "unknown outcome": [text, change(0, [0, "mirror", "public", 2, null])]
		, "short record": [text, change(0, [0, "mirror", "public", 1])]
		, "case on a successful call": [text, change(0, [0, "mirror", "public", 1, "mirror public 0"])]
		, "non-text case": [text, change(1, [1, "mirror", "raw", 0, 7])]
	};
	for(const [label, [stderr, records]] of Object.entries(refused))
		assert.throws(() => accountSourceEntry(stderr, records, names), assert.AssertionError, label);
});

/**
 * Renumber records and derive the stderr a correct package would write for them.
 *
 * @param records - Call records in order.
 */
const rebuild = records => {
	const calls = records.map((record, index) => [index, ...record.slice(1)]);
	return [stream(calls.map(([, name, , outcome]) => outcome ? [name] : [])), { calls }];
};

/**
 * A minimal consistent run for one ABI's names: every refined export rejects early and, but for Fin 0,
 * then enters; every late case rejects; tenth and the ten control calls enter.
 *
 * @param probeNames - Instrumented export names.
 */
const synthetic = probeNames => {
	const records = [];
	for(const name of probeNames.filter(item => ![sourceEntryControl, "tenth"].includes(item)))
	{
		records.push([0, name, "raw", 0, `${name} raw early`]);
		if(name !== "never") records.push([0, name, "raw", 1, null]);
	}
	for(const label of Object.keys(sourceEntryLateCases)) records.push([0, label.split(" ")[0], label.includes(" public ") ? "public" : "raw", 0, label]);
	records.push([0, "tenth", "public", 1, null]);
	for(let index = 0; index < 5; index++) records.push([0, sourceEntryControl, "public", 1, null], [0, sourceEntryControl, "raw", 1, null]);
	const [stderr, result] = rebuild(records);
	return { stderr, result };
};

test("each ABI's accounting requires every exact late case, its control entries, recovery and per-export coverage", () => {
	for(const abi of scalarFinRejectionAbis)
	{
		const inputs = scalarFinRejectionInputs(abi, instrumenting), run = synthetic(inputs.names);
		const summary = checkSourceEntry(run.stderr, run.result, inputs);
		assert.equal(summary.leanSha256, sha256(inputs.lean)); assert.equal(summary.consumerSha256, sha256(inputs.consumer));
		assert.match(summary.instrumentation, /not the unmodified packages/u);
		assert.deepEqual(summary.exports[sourceEntryControl], { entered: 10, rejected: 0 });
		const records = run.result.calls;
		const refused = {
			"control call missing": rebuild(records.slice(0, -1))
			, "control rejected": rebuild(records.map((record, index) => index === records.length - 1 ? [...record.slice(0, 3), 0, null] : record))
			// Mirror enters only before it rejects, so no call recovers after a rejection.
			, "no mirror recovery": rebuild([...records.filter(record => record[1] === "mirror").reverse(), ...records.filter(record => record[1] !== "mirror")])
			, "an export never rejects": rebuild(records.filter(record => !(record[1] === "huge" && !record[3])))
		};
		// Removing only one late case fails even though early pair and mix rejections remain.
		for(const label of Object.keys(sourceEntryLateCases))
		{
			assert.ok(records.some(record => record[4] === `${label.split(" ")[0]} raw early`));
			refused[`no ${label}`] = rebuild(records.filter(record => record[4] !== label));
			refused[`${label} on the other route`] = rebuild(records.map(record => record[4] === label ? [...record.slice(0, 2), record[2] === "raw" ? "public" : "raw", ...record.slice(3)] : record));
			refused[`${label} on another export`] = rebuild(records.map(record => record[4] === label ? [record[0], record[1] === "pair" ? "mix" : "pair", ...record.slice(2)] : record));
		}
		for(const [label, [stderr, result]] of Object.entries(refused))
			assert.throws(() => checkSourceEntry(stderr, result, inputs), assert.AssertionError, `${abi}/${label}`);
	}
});

test("the probe keeps each run's exact output once and refuses to replace it", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-source-entry-retain-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const probe = scalarFinSourceEntryProbe(join(directory, "calls")), files = { "stderr.txt": `${sourceEntryBegin} 0\n${sourceEntryEnd} 0\n`, "stdout.json": "{\"calls\":[]}\n" };
	const retained = await probe.retain("scalar", files);
	for(const [suffix, text] of Object.entries(files))
	{
		assert.deepEqual(retained[suffix], { path: join(directory, "calls", `scalar.${suffix}`), sha256: sha256(text), bytes: Buffer.byteLength(text) });
		assert.equal(await readFile(retained[suffix].path, "utf8"), text);
	}
	await assert.rejects(() => probe.retain("scalar", { "stderr.txt": "replaced\n" }), error => error.code === "EEXIST");
	assert.equal(await readFile(retained["stderr.txt"].path, "utf8"), files["stderr.txt"]);
});

// A JavaScript stand-in for the installed package: the same results and rejections, and a marker on
// stderr whenever a body runs. A faulty stand-in enters the body before checking bounds on one route.
const standIn = fault => `const huge = 184467440737095516170n;
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
export const call = (name, args, route) => {
  const [check, body] = bodies[name], early = route === ${JSON.stringify(fault)};
  if (early) enter(name);
  const checked = check(...args);
  if (!early) enter(name);
  return body(...checked);
};
`;

test("the instrumented consumer accounts every call against a stand-in package and catches public-only and raw-only early entry", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-source-entry-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const exported = ["mirror", "never", "one", "huge", "pair", "tenth", "mix", "apply", "count", "tag", "orZero", "labelled", sourceEntryControl];
	for(const fault of ["none", "public", "raw"])
	{
		const root = join(directory, fault), pkg = join(root, "node_modules/onboarding-small");
		await mkdir(join(pkg, "internal"), { recursive: true });
		await writeFile(join(pkg, "package.json"), JSON.stringify({ name: "onboarding-small", type: "module", exports: { ".": "./index.mjs", "./internal/runtime.mjs": "./internal/runtime.mjs" } }));
		await writeFile(join(pkg, "stand-in.mjs"), standIn(fault));
		await writeFile(join(pkg, "internal/runtime.mjs"), "import { call } from \"../stand-in.mjs\";\nexport const runtime = { call: (name, args) => call(name.replace(\"lean:OnboardingSmall.\", \"\"), args, \"raw\") };\n");
		await writeFile(join(pkg, "index.mjs"), `import { call } from "./stand-in.mjs";\n${exported.map(name => `export const ${name} = (...args) => call("${name}", args, "public");`).join("\n")}\n`);
		for(const abi of scalarFinRejectionAbis)
		{
			const inputs = scalarFinRejectionInputs(abi, instrumenting);
			await writeFile(join(root, "index.mjs"), inputs.consumer);
			const run = await processBuildRunner.capture({ command: process.execPath, args: ["index.mjs"], cwd: root, env: { ...process.env, STAND_IN_ABI: abi } });
			const result = JSON.parse(run.stdout.trim());
			if(fault === "none")
			{
				const summary = checkSourceEntry(run.stderr, result, inputs);
				assert.equal(summary.rejected, result.rejections, abi);
				assert.equal(summary.entered + summary.rejected, summary.calls, abi);
			}
			else assert.throws(() => checkSourceEntry(run.stderr, result, inputs), new RegExp(`^AssertionError.*: ${fault} \\w+ call \\d+ was rejected`, "su"), `${fault}/${abi}`);
		}
	}
});
