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
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateJavaScriptPackage } from "../../src/backends/javascript/generate.mjs";
import { createComponentPrivateAbi } from "../../src/build/component-callable-adapters.mjs";
import { callComponentScalar } from "../../src/release/component-runtime.mjs";
import { compileComponentCopiedCall } from "../../src/release/component-copied-runtime.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { reviewedFinWasmIr, reviewedFinWasmSelections } from "./reviewed-fin-wasm-fixture.mjs";
import { instrumentReviewedFinWasmIr, reviewedFinWasmSourceControl, reviewedFinWasmSourceControls } from "./reviewed-fin-wasm-source-entry.mjs";
import { captureConsoleError, entryBegin, entryEnd, measureCorpus, sourceEntryMarker } from "../fixtures/reviewed-fin-wasm/javascript-entry.mjs";

export const reviewedFinWasmEntryMarker = sourceEntryMarker;
/**
 * Measurement modes. An original package is the unmodified build, observed only at its adapters; a probe package is
 * the separate instrumented build, observed at its adapters, including the control, and at its Lean source.
 */
export const reviewedFinWasmEntryModes = Object.freeze(["original", "probe"]);
/**
 * The expected binding IR of one selection and mode.
 *
 * @param selection - Scalar-only or structural corpus.
 * @param mode - Mode: original or probe.
 */
export const reviewedFinWasmEntryIr = (selection, mode) => {
	assert.ok(reviewedFinWasmSelections.includes(selection), "a known selection");
	assert.ok(reviewedFinWasmEntryModes.includes(mode), "an explicit measurement mode");
	return mode === "original" ? reviewedFinWasmIr(selection) : instrumentReviewedFinWasmIr(selection);
};
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

const byBindingId = (left, right) => (left.bindingId < right.bindingId ? -1 : left.bindingId > right.bindingId ? 1 : 0);
/**
 * A private ABI with its exports in binding ID order and its records in canonical order. Declaration order is the
 * emitter's choice: the compiler lists exports alphabetically, an authored contract in source order.
 *
 * @param abi - A private ABI.
 */
const canonicalAbi = abi => ({ ...abi, exports: [...abi.exports].sort(byBindingId), ...abi.records ? { records: [...abi.records].map(item => canonicalJson(item)).sort().map(item => JSON.parse(item)) } : {} });

/**
 * Every adapter column of one selection and mode, derived from its expected binding IR, in binding ID order: the
 * one deterministic column order shared by the observed symbols, their counters and the accountant.
 *
 * @param selection - Scalar-only or structural corpus.
 * @param mode - Mode: original or probe.
 */
export const reviewedFinWasmEntrySymbols = (selection, mode) => canonicalAbi(createComponentPrivateAbi(reviewedFinWasmEntryIr(selection, mode))).exports
	.map(item => ({ name: item.bindingId.replace(/^lean:ReviewedFin\./u, ""), bindingId: item.bindingId, symbol: item.symbol }));

/**
 * Authenticate an installed package's descriptor and side-module bytes before any observation: the bytes are the
 * descriptor's integrity, its private ABI is the one its binding IR derives, and its symbols are the selection's.
 *
 * @param options - Installed descriptor and the bytes the loader will read.
 * @param options.descriptor - Default export of the installed internal/descriptor.mjs.
 * @param options.bytes - Installed side-module bytes.
 * @param options.selection - Scalar-only or structural corpus.
 * @param options.mode - Mode: original for the unmodified package, probe for the instrumented one.
 */
export const reviewedFinWasmEntrySelection = ({ descriptor, bytes, selection, mode }) => {
	const expected = reviewedFinWasmEntryIr(selection, mode);
	assert.equal(sha256(bytes), descriptor.integrity, "the side module is the descriptor's");
	// The actual transport and refinement trees, not only identities: a changed bound, type or position differs.
	assert.equal(reviewedContractDifference(expected, descriptor.bindingIr), null, `the ${mode} binding IR is the expected contract`);
	assert.deepEqual(descriptor.privateAbi, createComponentPrivateAbi(descriptor.bindingIr), "the private ABI is its binding IR's");
	const exported = descriptor.privateAbi.exports;
	assert.equal(new Set(exported.map(item => item.bindingId)).size, exported.length, "no duplicate export");
	assert.equal(new Set(exported.map(item => item.symbol)).size, exported.length, "no duplicate adapter symbol");
	// Export by export: the same binding IDs, each with the expected symbol, signature and result mode.
	assert.deepEqual(canonicalAbi(descriptor.privateAbi), canonicalAbi(createComponentPrivateAbi(expected)), "the private ABI is the expected contract's, export by export");
	const symbols = reviewedFinWasmEntrySymbols(selection, mode);
	assert.deepEqual(Object.fromEntries(exported.map(item => [item.bindingId, item.symbol])), Object.fromEntries(symbols.map(item => [item.bindingId, item.symbol])), "the selection's symbols");
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
 * Import the public package generated from a binding IR over a runtime that answers through the given call.
 *
 * @param ir - Expected binding IR of the selection and mode.
 * @param call - Runtime call implementation.
 */
const generatedPublic = async (ir, call) => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-fin-entry-"));
	try
	{
		const files = generateJavaScriptPackage(ir);
		for(const [path, text] of Object.entries(files))
		{
			await mkdir(join(root, path, ".."), { recursive: true });
			await writeFile(join(root, path), text);
		}
		const key = `__leanBridgeEntryRuntime${sha256(root).slice(0, 12)}`;
		globalThis[key] = { call };
		await writeFile(join(root, "internal/runtime.mjs"), `export const runtime = globalThis[${JSON.stringify(key)}];\n`);
		try
		{ return { api: await import(pathToFileURL(join(root, "index.mjs"))), files }; }
		finally
		{ delete globalThis[key]; }
	}
	finally
	{ await rm(root, { recursive: true, force: true }); }
};

/**
 * The installed runtime's observable behaviour for one selection and mode: the real argument encoder decides
 * whether the adapter is entered, the Lean export's bounds decide whether its source is entered, and the call
 * then returns the export's result or fails as the runtime reports it.
 *
 * @param selection - Scalar-only or structural corpus.
 * @param mode - Mode: original or probe.
 * @param hooks - Called on adapter entry with the export and its symbol, and on source entry with the export.
 * @param hooks.enter - Adapter entry.
 * @param hooks.source - Lean source entry.
 */
export const reviewedFinWasmEntryRuntime = (selection, mode, { enter = () => {}, source = () => {} } = {}) => {
	const abi = createComponentPrivateAbi(reviewedFinWasmEntryIr(selection, mode));
	const signatures = new Map(abi.exports.map(item => [item.bindingId.replace(/^lean:ReviewedFin\./u, ""), item]));
	const control = { accepts: () => true, run: ([value]) => value };
	return (name, args) => {
		const exported = mode === "probe" && name === reviewedFinWasmSourceControl ? control : leanExports[name];
		assert.ok(exported && signatures.has(name), `unknown export ${name}`);
		if(!encoderEnters(abi, signatures.get(name), args)) throw new TypeError(`The runtime's encoder refused ${name}`);
		enter(name, signatures.get(name).symbol);
		if(!exported.accepts(args)) throw new Error(`Component ${selection === "scalar" ? "scalar" : "copied"} call failed (${boundStatus(selection)})`);
		source(name);
		return exported.run(args);
	};
};

/**
 * The exact expected call sequence of one selection and mode: every call's export, route, arguments and outcome,
 * and whether it enters the adapter and the Lean source. Probe packages add the unrefined control's calls.
 *
 * @param selection - Scalar-only or structural corpus.
 * @param mode - Mode: original or probe.
 */
export const expectReviewedFinWasmEntry = async (selection, mode) => {
	const ir = reviewedFinWasmEntryIr(selection, mode), controls = mode === "probe" ? reviewedFinWasmSourceControls : [];
	const entries = [];
	let current = null;
	const call = reviewedFinWasmEntryRuntime(selection, mode, { enter: () => { current[0]++; }, source: () => { current[1]++; } });
	const { api } = await generatedPublic(ir, (id, args) => call(id.replace(/^lean:ReviewedFin\./u, ""), args));
	// Each top-level call starts with no entry; a generated validator that refuses never reaches the runtime.
	const tracked = run => {
		current = [0, 0];
		try
		{ return run(); }
		finally
		{ entries.push(current); current = null; }
	};
	const raw = (name, args) => tracked(() => call(name, args));
	const publicApi = new Proxy(api, { get: (target, key) => (typeof target[key] === "function" ? (...args) => tracked(() => target[key](...args)) : target[key]) });
	// The expectation's own brackets are captured, not printed; they are the measured run's, not evidence.
	const captured = captureConsoleError();
	let measured;
	try
	{ measured = measureCorpus({ module: "reviewed-fin", selection }, new Proxy({ raw }, { get: (target, key) => (key === "raw" ? raw : publicApi[key]) }), () => [], controls); }
	finally
	{ captured.stop(); }
	const { result, calls } = measured;
	assert.equal(calls.length, entries.length);
	return { mode, selection, result, calls: calls.map(([id, name, route, args, outcome], index) => [id, name, route, args, outcome, ...entries[index]]) };
};

const describe = call => `${call[2]} ${call[1]}(${call[3]}) #${call[0]}`;

/**
 * Account one measured run against the exact expectation of its mode. Every run observes every adapter column of
 * that mode, in ABI order: an original package all its exports, a probe package also the control. Only a probe run
 * carries Lean source brackets, and it must. The run's calls equal the expected ones in order and outcome, and each
 * call moves exactly the expected entry on its own column and nothing elsewhere.
 *
 * @param expected - Result of expectReviewedFinWasmEntry.
 * @param observed - The measured run: its mode, corpus result and calls.
 * @param lines - A probe run's captured console.error lines; absent for an original run.
 */
export const accountReviewedFinWasmEntry = (expected, observed, lines = undefined) => {
	const { mode, selection } = expected;
	const columns = reviewedFinWasmEntrySymbols(selection, mode).map(item => item.name);
	assert.equal(new Set(columns).size, columns.length, "unique adapter columns");
	assert.equal(columns.includes(reviewedFinWasmSourceControl), mode === "probe", "the control is a probe column only");
	assert.equal(observed?.mode, mode, `a ${mode} run`);
	assert.ok(Array.isArray(observed.calls) && observed.calls.length > 0, "a run with observations");
	assert.equal(mode === "probe", Array.isArray(lines), mode === "probe" ? "a probe run carries its source brackets" : "an original run claims no source entry");
	assert.deepEqual(observed.result, expected.result, "corpus result");
	assert.equal(observed.calls.length, expected.calls.length, "every call is measured once");
	for(const [index, call] of expected.calls.entries())
	{
		const seen = observed.calls[index], [, name, , , , adapter] = call;
		assert.deepEqual(seen.slice(0, 5), call.slice(0, 5), `call ${describe(call)}`);
		assert.ok(Array.isArray(seen[5]) && seen[5].length === columns.length, `every adapter column observed for ${describe(call)}`);
		assert.deepEqual(seen[5], columns.map(column => (column === name ? adapter : 0)), `adapter entry of ${describe(call)}`);
	}
	if(mode === "original") return { mode, calls: expected.calls.length, columns, source: false };
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
	return { mode, calls: expected.calls.length, columns, source: true };
};
