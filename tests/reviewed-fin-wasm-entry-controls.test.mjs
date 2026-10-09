/**
 * Source controls for installed Wasm Fin entry (VO #1438): the exact per-call expectation, the selection's
 * authenticated symbols and bytes, the instrumented probe inputs, the accountant's refusals and the frame observer
 * attached to a synthetic loader. No package is built or installed here.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { createComponentPrivateAbi } from "../src/build/component-callable-adapters.mjs";
import { accountReviewedFinWasmEntry, expectReviewedFinWasmEntry, reviewedFinWasmEntryMarker, reviewedFinWasmEntrySelection, reviewedFinWasmEntrySymbols } from "./helpers/reviewed-fin-wasm-entry.mjs";
import { instrumentReviewedFinWasmIr, instrumentReviewedFinWasmLean, reviewedFinWasmSourceControl, reviewedFinWasmSourceControls } from "./helpers/reviewed-fin-wasm-source-entry.mjs";
import { reviewedFinWasmIr } from "./helpers/reviewed-fin-wasm-fixture.mjs";
import { reviewedSourceSelection } from "../src/analyze/reviewed-source.mjs";
import { hashBindingIr } from "../src/binding-ir/canonical.mjs";
import { canonicalJson } from "../src/capsule/node.mjs";
import { reviewedFinWasmExpected } from "./helpers/reviewed-fin-wasm-install.mjs";
import { withWasmFrameEntryObserver } from "./helpers/wasm-frame-entry-observer.mjs";
import { captureConsoleError, entryBegin, entryEnd, measureCorpus } from "./fixtures/reviewed-fin-wasm/javascript-entry.mjs";

const typeInvalid = ['[{"bigint":"-1"}]', "[3]", '["3"]', "[null]", '[{"undefined":true}]', "[true]"];
const tally = calls => calls.reduce((counts, call) => {
	const key = `${call[2]} ${call[5]}${call[6]} ${call[4]}`;
	return { ...counts, [key]: (counts[key] ?? 0) + 1 };
}, {});

test("the expectation reproduces the pinned corpus and follows the generated validators and real encoders", async () => {
	const pinned = {
		scalar: { calls: 226, tally: { "public 11 1": 50, "raw 11 1": 50, "public 00 0": 63, "raw 10 0": 42, "raw 00 0": 21 } }
		, structural: { calls: 520, tally: { "public 11 1": 125, "raw 11 1": 125, "public 00 0": 135, "raw 10 0": 114, "raw 00 0": 21 } }
	};
	for(const selection of ["scalar", "structural"])
	{
		const { result, calls } = await expectReviewedFinWasmEntry(selection, "original");
		assert.deepEqual(result, { module: "reviewed-fin", selection, ...reviewedFinWasmExpected[selection] });
		assert.equal(calls.length, pinned[selection].calls);
		assert.deepEqual(tally(calls), pinned[selection].tally);
		// Public refusals never reach the runtime; only valid public calls enter.
		for(const call of calls.filter(item => item[2] === "public")) assert.deepEqual(call.slice(4), call[4] ? [1, 1, 1] : [0, 0, 0], call.join(" "));
		// The runtime's encoders refuse exactly the wrong JS types and the negative Nat, for every scalar export.
		const refused = calls.filter(call => call[2] === "raw" && call[5] === 0);
		assert.deepEqual([...new Set(refused.map(call => call[3]))].sort(), [...typeInvalid].sort());
		assert.deepEqual([...new Set(refused.map(call => call[1]))].sort(), ["huge", "mirror", "never", "only"]);
		// Fin 0 never enters its source, and every rejection is followed by a recovered mirror call.
		assert.ok(calls.filter(call => call[1] === "never").every(call => call[6] === 0 && call[4] === 0));
		assert.ok(calls.some(call => call[1] === "label" && call[2] === "raw" && call[5] === 1 && call[6] === 0), "late raw label enters only the adapter");
		// Each raw bound rejection is followed by its recovery calls, which enter both the adapter and the source:
		// mirror(3n) and raw mirror(9n) for scalar exports, and a valid call on both routes for label and structures.
		const bound = calls.filter(call => call[2] === "raw" && !call[4] && (call[5] === 1 || call[3] === typeInvalid[0]));
		// Bound inputs: mirror 4, never 2, only 2, huge 3 and 32 late label rounds; structures add 8 rounds of 4 + 2 + 3.
		assert.equal(bound.length, selection === "scalar" ? 11 + 32 : 11 + 32 + 8 * 9);
		for(const call of bound)
		{
			const next = calls.slice(call[0] + 1, call[0] + 3);
			const recovered = ["mirror", "never", "only", "huge"].includes(call[1]) ? [["mirror", "public", '[{"bigint":"3"}]'], ["mirror", "raw", '[{"bigint":"9"}]']] : [[call[1], "public"], [call[1], "raw"]];
			assert.deepEqual(next.map(item => [item[1], item[2], ...recovered[0].length === 3 ? [item[3]] : [], item[6]]), recovered.map(item => [...item, 1]), `recovery after ${call.join(" ")}`);
		}
	}
	const controlled = await expectReviewedFinWasmEntry("scalar", "probe");
	assert.equal(controlled.calls.length, 236);
	assert.deepEqual(controlled.calls.slice(0, 226), (await expectReviewedFinWasmEntry("scalar", "original")).calls, "the probe adds only control calls");
	await assert.rejects(expectReviewedFinWasmEntry("scalar"), assert.AssertionError, "an explicit mode");
	// The generated package's temporary runtime binding does not outlive its import.
	assert.deepEqual(Object.keys(globalThis).filter(key => key.startsWith("__leanBridgeEntryRuntime")), []);
	assert.deepEqual(controlled.calls.slice(226).map(call => [call[1], call[2], call.slice(4)]), reviewedFinWasmSourceControls[0][1].flatMap(() => ["public", "raw"].map(route => [reviewedFinWasmSourceControl, route, [1, 1, 1]])));
});

test("the selection authenticates the installed bytes, contract and private ABI of its mode before any observation", () => {
	const bytes = Buffer.from("\0asm\x01\0\0\0component bytes");
	const descriptorOf = bindingIr => ({ integrity: sha256(bytes), bindingIr, privateAbi: createComponentPrivateAbi(bindingIr) });
	for(const [selection, mode, ir, columns] of [["structural", "original", reviewedFinWasmIr("structural"), 9], ["scalar", "probe", instrumentReviewedFinWasmIr("scalar"), 7]])
	{
		const selected = reviewedFinWasmEntrySelection({ descriptor: descriptorOf(ir), bytes, selection, mode });
		assert.deepEqual(selected.symbols, reviewedFinWasmEntrySymbols(selection, mode).map(item => item.symbol));
		assert.equal(selected.symbols.length, columns);
	}
	const flipped = Buffer.from(bytes); flipped[9] ^= 1;
	// Each changed contract keeps a freshly rederived private ABI, as a rebuilt package would.
	const changed = (selection, mode, change) => {
		const ir = structuredClone(mode === "original" ? reviewedFinWasmIr(selection) : instrumentReviewedFinWasmIr(selection)); change(ir);
		return { descriptor: descriptorOf(ir), bytes, selection, mode };
	};
	const refinement = (ir, name) => ir.declarations.find(item => item.name === name).source.extensions["lean-lang.org/refinements"];
	const original = descriptorOf(reviewedFinWasmIr("structural"));
	for(const [label, options] of [
		["flipped byte", { descriptor: original, bytes: flipped, selection: "structural", mode: "original" }]
		, ["other selection", { descriptor: original, bytes, selection: "scalar", mode: "original" }]
		, ["no mode", { descriptor: original, bytes, selection: "structural" }]
		, ["foreign symbol", { descriptor: { ...original, privateAbi: { ...original.privateAbi, exports: original.privateAbi.exports.map((item, index) => (index ? item : { ...item, symbol: "lean_bridge_000000000000000000000000" })) } }, bytes, selection: "structural", mode: "original" }]
		, ["ABI not derived from its IR", { descriptor: { ...original, bindingIr: reviewedFinWasmIr("scalar") }, bytes, selection: "structural", mode: "original" }]
		, ["bound 10 to 11", changed("structural", "original", ir => { refinement(ir, "mirror").parameters[0].bound = "11"; })]
		, ["result-only bound", changed("scalar", "original", ir => { refinement(ir, "tenth").result.bound = "11"; })]
		, ["nested bound", changed("structural", "original", ir => { refinement(ir, "nested").parameters[0].arguments[0].arguments[0].arguments[0].bound = "4"; })]
		, ["parameter type", changed("scalar", "original", ir => { ir.declarations[0].parameters[0].type = { kind: "primitive", name: "int" }; })]
		, ["bound position", changed("scalar", "original", ir => { const value = refinement(ir, "label"); value.parameters = [value.parameters[1], value.parameters[0], value.parameters[2]]; })]
		, ["probe control omitted", changed("scalar", "probe", ir => { ir.declarations.pop(); })]
		, ["probe control refined", changed("scalar", "probe", ir => { ir.declarations.at(-1).source.extensions["lean-lang.org/refinements"] = { parameters: [{ kind: "fin", bound: "10" }], result: null }; })]
		, ["probe control substituted", changed("scalar", "probe", ir => { ir.declarations.at(-1).parameters[0].type = { kind: "primitive", name: "int" }; })]
		, ["probe control with a no-op refinement", changed("scalar", "probe", ir => { ir.declarations.at(-1).source.extensions["lean-lang.org/refinements"] = { parameters: [null], result: null }; })]
		, ["probe as original", { descriptor: descriptorOf(instrumentReviewedFinWasmIr("scalar")), bytes, selection: "scalar", mode: "original" }]
		, ["original as probe", { descriptor: descriptorOf(reviewedFinWasmIr("scalar")), bytes, selection: "scalar", mode: "probe" }]
	]) assert.throws(() => reviewedFinWasmEntrySelection(options), assert.AssertionError, label);
});

test("probe inputs add only the markers and the unrefined control", async () => {
	const lean = await readFile("tests/fixtures/onboarding/reviewed-fin-wasm/ReviewedFin.lean", "utf8"), probe = instrumentReviewedFinWasmLean(lean);
	assert.equal(probe.split(`dbgTrace "${reviewedFinWasmEntryMarker} `).length - 1, 10);
	assert.match(probe, new RegExp(`^def ${reviewedFinWasmSourceControl} \\(value : Nat\\) : Nat := dbgTrace`, "mu"));
	assert.throws(() => instrumentReviewedFinWasmLean(lean.replace("def only", "def alone")), assert.AssertionError);
	assert.throws(() => instrumentReviewedFinWasmLean(lean.replace("end ReviewedFin\n", "")), assert.AssertionError);
	for(const selection of ["scalar", "structural"])
	{
		const ir = instrumentReviewedFinWasmIr(selection);
		assert.deepEqual(ir.declarations.slice(0, -1), reviewedFinWasmIr(selection).declarations);
		assert.equal(ir.declarations.at(-1).name, reviewedFinWasmSourceControl);
		assert.equal(Object.hasOwn(ir.declarations.at(-1).source.extensions, "lean-lang.org/refinements"), false);
		// The production review gate admits the original and probe contracts as captured review inputs.
		for(const [document, extra] of [[reviewedFinWasmIr(selection), []], [ir, [`ReviewedFin.${reviewedFinWasmSourceControl}`]]])
		{
			const source = canonicalJson(document), review = { schemaVersion: 1, path: "api.binding-ir.json", source, sourceSha256: sha256(source), semanticSha256: hashBindingIr(document) };
			assert.deepEqual(reviewedSourceSelection(review).exports, [...reviewedFinWasmIr(selection).declarations.map(item => item.source.declaration), ...extra].sort());
		}
		// An all-null no-op refinement on the control is not a buildable review.
		const noop = structuredClone(ir); noop.declarations.at(-1).source.extensions["lean-lang.org/refinements"] = { parameters: [null], result: null };
		const source = canonicalJson(noop);
		assert.throws(() => reviewedSourceSelection({ schemaVersion: 1, path: "api.binding-ir.json", source, sourceSha256: sha256(source), semanticSha256: hashBindingIr(noop) }));
	}
});

/**
 * A measured run exactly as an installed package would produce it, for the accountant controls.
 *
 * @param expected - Expected calls of one mode.
 * @param symbols - Adapter columns in counter order.
 */
const synthetic = (expected, symbols) => ({
	observed: { mode: expected.mode, result: expected.result, calls: expected.calls.map(([id, name, route, args, outcome, adapter]) => [id, name, route, args, outcome, symbols.map(symbol => (symbol === name ? adapter : 0))]) }
	, lines: expected.calls.flatMap(([id, name, , , , , source]) => [`${entryBegin} ${id}`, ...source ? [`${reviewedFinWasmEntryMarker} ${name}`] : [], `${entryEnd} ${id}`])
});

test("the accountant refuses altered adapter or source entry and names the failing call", async () => {
	const expected = await expectReviewedFinWasmEntry("structural", "probe");
	const symbols = reviewedFinWasmEntrySymbols("structural", "probe").map(item => item.name);
	assert.equal(symbols.at(-1), reviewedFinWasmSourceControl);
	const original = synthetic(expected, symbols);
	assert.deepEqual(accountReviewedFinWasmEntry(expected, original.observed, original.lines), { mode: "probe", calls: 530, columns: symbols, source: true });
	const find = predicate => expected.calls.findIndex(predicate);
	const fin0 = find(call => call[1] === "never" && call[2] === "raw" && call[5] === 1);
	const late = find(call => call[1] === "label" && call[2] === "raw" && call[5] === 1 && call[6] === 0);
	const nested = find(call => call[1] === "nested" && call[2] === "raw" && call[6] === 0);
	const recovery = find((call, index) => call[1] === "mirror" && call[6] === 1 && index > fin0);
	const alias = find(call => call[1] === "mirror" && call[2] === "public" && call[4] === 0);
	const describe = index => { const call = expected.calls[index]; return `${call[2]} ${call[1]}(${call[3]}) #${call[0]}`; };
	const at = (index, name) => symbols.indexOf(name ?? expected.calls[index][1]);
	const mutations = [
		// Adapter entry: a missed, doubled, invented or misattributed counter change.
		[fin0, value => { value.observed.calls[fin0][5][at(fin0)] = 0; }]
		, [late, value => { value.observed.calls[late][5][at(late)] = 2; }]
		, [alias, value => { value.observed.calls[alias][5][at(alias)] = 1; }]
		, [nested, value => { value.observed.calls[nested][5][at(nested)] = 0; value.observed.calls[nested][5][at(nested, "rows")] = 1; }]
		// The call itself: a swapped route, a flipped outcome or changed arguments.
		, [recovery, value => { value.observed.calls[recovery][2] = value.observed.calls[recovery][2] === "raw" ? "public" : "raw"; }]
		, [fin0, value => { value.observed.calls[fin0][4] = 1; }]
		, [late, value => { value.observed.calls[late][3] = "[]"; }]
		// Source entry: a marker on a rejected call, a missing marker, a foreign marker or a marker outside its call.
		, [fin0, value => { value.lines.splice(value.lines.indexOf(`${entryEnd} ${fin0}`), 0, `${reviewedFinWasmEntryMarker} never`); }]
		, [recovery, value => { value.lines.splice(value.lines.indexOf(`${entryBegin} ${recovery}`) + 1, 1); }]
		, [nested, value => { value.lines.splice(value.lines.indexOf(`${entryEnd} ${nested}`), 0, `${reviewedFinWasmEntryMarker} rows`); }]
	];
	for(const [index, mutate] of mutations)
	{
		const value = structuredClone(original); mutate(value);
		assert.throws(() => accountReviewedFinWasmEntry(expected, value.observed, value.lines), error => error instanceof assert.AssertionError && error.message.includes(describe(index)), describe(index));
	}
	// Whole-run refusals: a lost or extra call, a wrong total, an unentered control, stray or misordered lines.
	const control = expected.calls.length - 1;
	for(const mutate of [
		value => { value.observed.calls.pop(); }
		, value => { value.observed.calls.push(value.observed.calls[0]); }
		, value => { value.observed.result.checks--; }
		, value => { value.lines.splice(value.lines.indexOf(`${entryBegin} ${control}`) + 1, 1); }
		, value => { value.lines.push(`${reviewedFinWasmEntryMarker} mirror`); }
		, value => { value.lines.unshift("warning: unexpected"); }
		, value => { [value.lines[0], value.lines[1]] = [value.lines[1], value.lines[0]]; }
		, value => { value.lines.splice(value.lines.indexOf(`${entryEnd} 3`), 1); }
	]) {
		const value = structuredClone(original); mutate(value);
		assert.throws(() => accountReviewedFinWasmEntry(expected, value.observed, value.lines), assert.AssertionError);
	}
});

test("each mode requires every adapter column, exactly its own source claim and a run with observations", async () => {
	const unmodified = await expectReviewedFinWasmEntry("scalar", "original"), probe = await expectReviewedFinWasmEntry("scalar", "probe");
	const columns = reviewedFinWasmEntrySymbols("scalar", "original").map(item => item.name);
	const base = synthetic(unmodified, columns), traced = synthetic(probe, reviewedFinWasmEntrySymbols("scalar", "probe").map(item => item.name));
	assert.deepEqual(accountReviewedFinWasmEntry(unmodified, base.observed), { mode: "original", calls: 226, columns, source: false });
	for(const [label, expected, observed, lines] of [
		["empty adapter vectors", unmodified, { ...base.observed, calls: base.observed.calls.map(call => [...call.slice(0, 5), []]) }, undefined]
		, ["an omitted column", unmodified, { ...base.observed, calls: base.observed.calls.map(call => [...call.slice(0, 5), call[5].slice(1)]) }, undefined]
		, ["a duplicated column", unmodified, { ...base.observed, calls: base.observed.calls.map(call => [...call.slice(0, 5), [...call[5], call[5][0]]]) }, undefined]
		, ["no observation", unmodified, { ...base.observed, calls: [] }, undefined]
		, ["no run", unmodified, undefined, undefined]
		, ["an original run claiming source entry", unmodified, base.observed, base.lines]
		, ["a probe run without source brackets", probe, traced.observed, undefined]
		, ["a probe run without the control column", probe, { ...traced.observed, calls: traced.observed.calls.map(call => [...call.slice(0, 5), call[5].slice(0, -1)]) }, traced.lines]
		, ["an original run labelled probe", probe, { ...base.observed, mode: "probe" }, base.lines]
		, ["a probe run labelled original", unmodified, { ...traced.observed, mode: "original" }, undefined]
		, ["an unlabelled run", unmodified, { ...base.observed, mode: undefined }, undefined]
	]) assert.throws(() => accountReviewedFinWasmEntry(expected, observed, lines), assert.AssertionError, label);
});

test("console capture records synchronously and restores the realm's console on success and on throw", () => {
	const before = console.error;
	const captured = captureConsoleError();
	console.error("one", 2);
	captured.stop();
	assert.deepEqual(captured.lines, ["one 2"]);
	assert.equal(console.error, before);
	const failing = captureConsoleError();
	assert.throws(() => {
		try
		{ measureCorpus({ module: "reviewed-fin", selection: "scalar" }, { raw: () => { throw new Error("boom"); }, mirror: () => { throw new RangeError("unexpected"); } }); }
		finally
		{ failing.stop(); }
	});
	assert.equal(console.error, before);
	assert.equal(failing.lines[0], `${entryBegin} 0`);
});

// A synthetic side module whose named (i32) -> i32 frame exports return their argument.
const frames = names => {
	const name = text => [text.length, ...Buffer.from(text)];
	const section = (id, bytes) => [id, bytes.length, ...bytes];
	return new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0
		, ...section(1, [1, 0x60, 1, 0x7f, 1, 0x7f])
		, ...section(3, [names.length, ...names.map(() => 0)])
		, ...section(7, [names.length, ...names.flatMap((text, index) => [...name(text), 0, index])])
		, ...section(10, [names.length, ...names.flatMap(() => [4, 0, 0x20, 0, 0x0b])])]);
};

test("the frame observer attached at a loader counts only calls through the observed instance", async () => {
	const symbols = ["lean_bridge_aaaaaaaaaaaaaaaaaaaaaaaa", "lean_bridge_bbbbbbbbbbbbbbbbbbbbbbbb"], moduleBytes = frames(symbols);
	const run = bypass => withWasmFrameEntryObserver({ moduleBytes, symbols }, async counts => {
		const { instance } = await WebAssembly.instantiate(moduleBytes);
		const original = bypass ? (await WebAssembly.Module.exports(new WebAssembly.Module(moduleBytes)), null) : null;
		const exports = instance.exports;
		const calls = [];
		for(const [index, symbol] of symbols.entries())
		{
			const before = counts();
			assert.equal(exports[symbol](index + 1), index + 1);
			calls.push(counts().map((value, position) => value - before[position]));
		}
		return { calls, original };
	});
	const { value, counts } = await run(false);
	assert.deepEqual(value.calls, [[1, 0], [0, 1]]);
	assert.deepEqual(counts, [1, 1]);
	// The selected component must be the one the loader instantiates; another module exposing its symbol is refused.
	await assert.rejects(withWasmFrameEntryObserver({ moduleBytes, symbols }, async () => WebAssembly.instantiate(frames([symbols[0], "other"]))), /different module exposes/u);
	await assert.rejects(withWasmFrameEntryObserver({ moduleBytes, symbols }, async () => WebAssembly.instantiate(new WebAssembly.Module(moduleBytes))), /precompiled Module/u);
	await assert.rejects(withWasmFrameEntryObserver({ moduleBytes, symbols }, async () => { await WebAssembly.instantiate(moduleBytes); await WebAssembly.instantiate(moduleBytes); }), /more than once/u);
	await assert.rejects(withWasmFrameEntryObserver({ moduleBytes, symbols }, async () => new WebAssembly.Instance(new WebAssembly.Module(moduleBytes))), /did not instantiate/u);
});
