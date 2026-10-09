/**
 * Exact per-call adapter and Lean source entry of the installed ordinary and reviewed Fin npm corpus (VO #1438).
 * The expectation runs the unchanged shared corpus against the generated public JavaScript and the real runtime
 * argument encoders, with a stub adapter that only records entry, and a model of the Lean exports' bounds and
 * results. A public call enters the adapter only when the generated wrapper reaches the runtime; a raw call only
 * when the runtime's encoder accepts its arguments; the Lean source only when the adapter accepts the bounds.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { sha256 } from "../../src/capsule/node.mjs";
import { generateJavaScriptPackage } from "../../src/backends/javascript/generate.mjs";
import { createComponentPrivateAbi } from "../../src/build/component-callable-adapters.mjs";
import { callComponentScalar } from "../../src/release/component-runtime.mjs";
import { compileComponentCopiedCall } from "../../src/release/component-copied-runtime.mjs";
import { reviewedFinWasmIr, reviewedFinWasmSelections } from "./reviewed-fin-wasm-fixture.mjs";
import { captureConsoleError, entryBegin, entryEnd, measureCorpus } from "../fixtures/reviewed-fin-wasm/javascript-entry.mjs";

export const reviewedFinWasmEntryMarker = "lean-bridge-source-entry";
const wide = 184467440737095516170n;
// Scalar ABI 2 reports an adapter-side Fin failure as 6; copied ABI 6 reports it as 5.
const boundStatus = selection => (selection === "scalar" ? 6 : 5);
const fin = (value, bound) => typeof value === "bigint" && value >= 0n && value < bound;
const nested = value => value?.tag === "none" || value?.tag === "some" && fin(value.value[0], 3n)
	&& (Object.hasOwn(value.value[1], "ok") ? fin(value.value[1].ok, 5n) : fin(value.value[1].error, 2n));
/** Each Lean export's adapter bound check and its result, on runtime-accepted arguments. */
const leanExports = {
	mirror: { accepts: ([value]) => fin(value, 10n), run: ([value]) => 9n - value }
	, never: { accepts: () => false, run: () => assert.fail("Fin 0 has no value") }
	, only: { accepts: ([value]) => fin(value, 1n), run: ([value]) => value + 7n }
	, huge: { accepts: ([value]) => fin(value, wide), run: ([value]) => value }
	, tenth: { accepts: () => true, run: ([value]) => value % 10n }
	, label: { accepts: ([, digit]) => fin(digit, 10n), run: ([before, digit, after]) => `${before}${digit}${after}` }
	, rows: { accepts: ([rows]) => rows.every(row => row.every(value => fin(value, 10n))), run: ([rows]) => [...rows].reverse() }
	, empty: { accepts: ([values]) => values.length === 0, run: () => [] }
	, nested: { accepts: ([values]) => values.every(nested), run: ([values]) => [...values].reverse() }
};

/**
 * The selected adapter symbols of one selection, in private ABI order, derived from its binding IR.
 *
 * @param selection - Scalar-only or structural corpus.
 */
export const reviewedFinWasmEntrySymbols = selection => {
	assert.ok(reviewedFinWasmSelections.includes(selection));
	return createComponentPrivateAbi(reviewedFinWasmIr(selection)).exports.map(item => ({ name: item.bindingId.replace(/^lean:ReviewedFin\./u, ""), bindingId: item.bindingId, symbol: item.symbol }));
};

/**
 * Authenticate an installed package's descriptor and side-module bytes before any observation: the bytes are the
 * descriptor's integrity, its private ABI is the one its binding IR derives, and its symbols are the selection's.
 *
 * @param options - Installed descriptor and the bytes the loader will read.
 * @param options.descriptor - Default export of the installed internal/descriptor.mjs.
 * @param options.bytes - Installed side-module bytes.
 * @param options.selection - Scalar-only or structural corpus.
 */
export const reviewedFinWasmEntrySelection = ({ descriptor, bytes, selection }) => {
	assert.equal(sha256(bytes), descriptor.integrity, "the side module is the descriptor's");
	assert.deepEqual(descriptor.privateAbi, createComponentPrivateAbi(descriptor.bindingIr), "the private ABI is its binding IR's");
	const symbols = reviewedFinWasmEntrySymbols(selection);
	assert.deepEqual(descriptor.privateAbi.exports.map(item => [item.bindingId, item.symbol]), symbols.map(item => [item.bindingId, item.symbol]), "the selection's symbols");
	return { moduleBytes: bytes, symbols: symbols.map(item => item.symbol) };
};

// Scratch memory for the real encoders; nothing here reaches a Wasm adapter.
const scratch = () => {
	const memory = new ArrayBuffer(1 << 24);
	let top = 8;
	return {
		HEAP8: new Int8Array(memory)
		, _malloc: size => { const pointer = top; top += (size + 7) & ~7; assert.ok(top < memory.byteLength); return pointer; }
		, _free: () => {}
		, _bridge_scalar_frame_clear: () => {}
		, _bridge_copied_frame_clear: () => {}
		, _bridge_recursive_frame_clear: () => {}
	};
};

/**
 * Whether the runtime's real encoder would enter the adapter for these raw arguments.
 *
 * @param abi - Private ABI of the selection.
 * @param signature - The called export's private ABI signature.
 * @param args - Raw call arguments.
 */
const encoderEnters = (abi, signature, args) => {
	let entered = false;
	const operation = frame => {
		entered = true;
		return frame === 0 ? 0 : 1;
	};
	try
	{
		if(abi.version === 2) callComponentScalar(scratch(), operation, signature, args);
		else compileComponentCopiedCall(scratch(), operation, signature, () => {}, abi.version, abi.records ?? [])(args);
	}
	catch
	{ /* The stub adapter never succeeds; only entry matters. */ }
	return entered;
};

/**
 * Import the generated public package of a selection over a runtime that answers through the given call.
 *
 * @param selection - Scalar-only or structural corpus.
 * @param call - Runtime call implementation.
 */
const generatedPublic = async (selection, call) => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-fin-entry-"));
	try
	{
		const files = generateJavaScriptPackage(reviewedFinWasmIr(selection));
		for(const [path, text] of Object.entries(files))
		{
			await mkdir(join(root, path, ".."), { recursive: true });
			await writeFile(join(root, path), text);
		}
		const key = `__leanBridgeEntryRuntime${sha256(root).slice(0, 12)}`;
		globalThis[key] = { call };
		await writeFile(join(root, "internal/runtime.mjs"), `export const runtime = globalThis[${JSON.stringify(key)}];\n`);
		return { api: await import(pathToFileURL(join(root, "index.mjs"))), files };
	}
	finally
	{ await rm(root, { recursive: true, force: true }); }
};

/**
 * The exact expected call sequence of one selection: every call's export, route, arguments and outcome, and
 * whether it enters the adapter and the Lean source.
 *
 * @param selection - Scalar-only or structural corpus.
 * @param controls - Calls of an unrefined control export, present only in instrumented probe builds.
 */
export const expectReviewedFinWasmEntry = async (selection, controls = []) => {
	const abi = createComponentPrivateAbi(reviewedFinWasmIr(selection));
	const signatures = new Map(abi.exports.map(item => [item.bindingId.replace(/^lean:ReviewedFin\./u, ""), item]));
	const entries = [];
	const model = (name, args, publicCall) => {
		const exported = leanExports[name] ?? (controls.some(([control]) => control === name) ? { accepts: () => true, run: ([value]) => value } : null);
		assert.ok(exported, `unknown export ${name}`);
		const enters = publicCall || !signatures.has(name) || encoderEnters(abi, signatures.get(name), args);
		if(!enters) entries.push([0, 0]);
		else if(!exported.accepts(args)) entries.push([1, 0]);
		else entries.push([1, 1]);
		const [adapter, source] = entries.at(-1);
		if(!adapter) return null;
		if(!source) throw new Error(`Component ${selection === "scalar" ? "scalar" : "copied"} call failed (${boundStatus(selection)})`);
		return exported.run(args);
	};
	let reached = false;
	const { api } = await generatedPublic(selection, (id, args) => {
		reached = true;
		return model(id.replace(/^lean:ReviewedFin\./u, ""), args, true);
	});
	const raw = (name, args) => {
		const result = model(name, args, false);
		// The real encoder refused these arguments; repeat its refusal for the corpus.
		if(entries.at(-1)[0] === 0) throw new TypeError(`Encoder refused ${name}`);
		return result;
	};
	const publicApi = new Proxy(api, { get: (target, key) => (typeof target[key] === "function" ? (...args) => {
		reached = false;
		const before = entries.length;
		try
		{ return target[key](...args); }
		finally
		{
			// The generated wrapper refused before reaching the runtime: neither adapter nor source is entered.
			if(!reached)
			{ assert.equal(entries.length, before); entries.push([0, 0]); }
		}
	} : target[key]) });
	const controlApi = Object.fromEntries(controls.map(([name]) => [name, value => model(name, [value], true)]));
	// The expectation's own brackets are captured, not printed; they are the measured run's, not evidence.
	const captured = captureConsoleError();
	let measured;
	try
	{ measured = measureCorpus({ module: "reviewed-fin", selection }, new Proxy({ raw }, { get: (target, key) => (key === "raw" ? raw : controlApi[key] ?? publicApi[key]) }), () => [], controls); }
	finally
	{ captured.stop(); }
	const { result, calls } = measured;
	assert.equal(calls.length, entries.length);
	return { result, calls: calls.map(([id, name, route, args, outcome], index) => [id, name, route, args, outcome, ...entries[index]]) };
};

const describe = call => `${call[2]} ${call[1]}(${call[3]}) #${call[0]}`;

/**
 * Account one measured run against the exact expectation: the same calls in order with the same outcomes, the
 * adapter counters moving by exactly the expected entry on the called export's symbol and nowhere else, and, when
 * stderr lines are given, exactly one Lean source marker inside each bracket of a call that enters the source.
 *
 * @param expected - Result of expectReviewedFinWasmEntry.
 * @param observed - The measured run's corpus result and calls.
 * @param options - Selected symbols, and the run's console.error lines for an instrumented probe build.
 * @param options.symbols - Selected export names in counter order; empty when adapters were not observed.
 * @param options.lines - Captured console.error lines, or null when source entry was not measured.
 */
export const accountReviewedFinWasmEntry = (expected, observed, { symbols, lines = null }) => {
	assert.deepEqual(observed.result, expected.result, "corpus result");
	assert.equal(observed.calls.length, expected.calls.length, "every call is measured once");
	for(const [index, call] of expected.calls.entries())
	{
		const seen = observed.calls[index], [, name, , , , adapter] = call;
		assert.deepEqual(seen.slice(0, 5), call.slice(0, 5), `call ${describe(call)}`);
		assert.deepEqual(seen[5], symbols.map(symbol => (symbol === name ? adapter : 0)), `adapter entry of ${describe(call)}`);
	}
	if(lines === null) return expected.calls.length;
	const segments = [];
	let open = null;
	for(const line of lines)
	{
		const [kind, value, ...rest] = line.split(" ");
		assert.equal(rest.length, 0, `unexpected stderr line: ${line}`);
		if(kind === entryBegin)
		{
			assert.equal(open, null, `nested or unclosed call: ${line}`);
			assert.equal(value, String(segments.length), `out-of-order call: ${line}`);
			open = [];
		}
		else if(kind === entryEnd)
		{
			assert.ok(open && value === String(segments.length), `unmatched end: ${line}`);
			segments.push(open); open = null;
		}
		else if(kind === reviewedFinWasmEntryMarker)
		{
			assert.ok(open, `source entry outside any call: ${line}`);
			open.push(value);
		}
		else assert.fail(`unexpected stderr line: ${line}`);
	}
	assert.equal(open, null, "unclosed call");
	assert.equal(segments.length, expected.calls.length, "every call has one bracket");
	for(const [index, call] of expected.calls.entries())
		assert.deepEqual(segments[index], call[6] ? [call[1]] : [], `source entry of ${describe(call)}`);
	return expected.calls.length;
};
