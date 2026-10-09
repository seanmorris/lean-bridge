/**
 * Node controls for the installed Wasm Fin entry harness (VO #1438), without Lean or a package build. A stand-in
 * installed package carries the exact generated public code, an authentic descriptor and a real side module whose
 * frame exports are the selected symbols; its runtime instantiates that module through the observed loader API,
 * binds console.error when it loads, as the Lean runtime does, and enters the adapter frame exactly when the
 * real runtime encoder would. The producer's own consumer files, preload and accounting run unchanged.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateJavaScriptPackage } from "../src/backends/javascript/generate.mjs";
import { createComponentPrivateAbi } from "../src/build/component-callable-adapters.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { expectReviewedFinWasmEntry, reviewedFinWasmEntryIr, reviewedFinWasmEntrySymbols } from "./helpers/reviewed-fin-wasm-entry.mjs";
import { reviewedFinWasmSourceControls } from "./helpers/reviewed-fin-wasm-source-entry.mjs";
import { accountReviewedFinWasmEntryReport, authenticateReviewedFinWasmEntryPackage, prepareReviewedFinWasmEntryConsumer, reviewedFinWasmEntryNodeIndex, runReviewedFinWasmEntryNode } from "./helpers/reviewed-fin-wasm-entry-producer.mjs";

const entryHelper = pathToFileURL(resolve("tests/helpers/reviewed-fin-wasm-entry.mjs")).href;
// A side module whose named (i32) -> i32 frame exports return 0.
const frames = names => {
	// Unsigned LEB128: the export section of ten 36-byte names exceeds one length byte.
	const leb = value => (value < 0x80 ? [value] : [(value & 0x7f) | 0x80, ...leb(value >>> 7)]);
	const name = text => [...leb(text.length), ...Buffer.from(text)];
	const section = (id, bytes) => [id, ...leb(bytes.length), ...bytes];
	return new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0
		, ...section(1, [1, 0x60, 1, 0x7f, 1, 0x7f])
		, ...section(3, [names.length, ...names.map(() => 0)])
		, ...section(7, [names.length, ...names.flatMap((text, index) => [...name(text), 0, index])])
		, ...section(10, [names.length, ...names.flatMap(() => [4, 0, 0x41, 0, 0x0b])])]);
};
const runtimes = {
	// The stand-in for the shared runtime: it loads the side module through the observable API and binds stderr.
	faithful: (selection, mode) => `import { readFile } from "node:fs/promises";
import descriptor from "./descriptor.mjs";
import { reviewedFinWasmEntryRuntime } from ${JSON.stringify(entryHelper)};
const err = console.error.bind(console);
const { instance } = await WebAssembly.instantiate(await readFile(descriptor.sideModule));
const call = reviewedFinWasmEntryRuntime(${JSON.stringify(selection)}, ${JSON.stringify(mode)}, { enter: (name, symbol) => instance.exports[symbol](0), source: name => ${mode === "probe" ? "err(\"lean-bridge-source-entry \" + name)" : "undefined"} });
export const runtime = { call: (id, args) => call(id.replace("lean:ReviewedFin.", ""), args) };
`
	// A runtime that never enters its adapter frames, as if calls reached an unobserved instance.
	, unobserved: selection => `import { reviewedFinWasmEntryRuntime } from ${JSON.stringify(entryHelper)};
import descriptor from "./descriptor.mjs";
import { readFile } from "node:fs/promises";
await WebAssembly.instantiate(await readFile(descriptor.sideModule));
const call = reviewedFinWasmEntryRuntime(${JSON.stringify(selection)}, "original");
export const runtime = { call: (id, args) => call(id.replace("lean:ReviewedFin.", ""), args) };
`
	// A runtime that compiles the side module itself and so bypasses byte authentication.
	, precompiled: () => `import descriptor from "./descriptor.mjs";
import { readFile } from "node:fs/promises";
await WebAssembly.instantiate(new WebAssembly.Module(await readFile(descriptor.sideModule)));
export const runtime = { call: () => { throw new Error("unreachable"); } };
`
};

/**
 * A consumer with a stand-in installed package, prepared exactly as the producer prepares a real one.
 *
 * @param t - Test context responsible for cleanup.
 * @param selection - Scalar-only or structural corpus.
 * @param mode - Mode: original or probe.
 * @param runtime - Which stand-in runtime the package ships.
 */
const consumer = async (t, selection, mode, runtime = "faithful") => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-fin-wasm-entry-harness-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = reviewedFinWasmEntryIr(selection, mode), installed = join(root, "node_modules/reviewed-fin");
	for(const [path, text] of Object.entries(generateJavaScriptPackage(ir))) await saveLakeFile(installed, path, text);
	const bytes = frames(reviewedFinWasmEntrySymbols(selection, mode).map(item => item.symbol));
	await saveLakeFile(installed, "internal/wasm/component.wasm", bytes);
	await saveLakeFile(installed, "internal/descriptor.mjs", `export default Object.freeze({ integrity: ${JSON.stringify(sha256(bytes))}, sideModule: new URL("./wasm/component.wasm", import.meta.url), bindingIr: ${JSON.stringify(ir)}, privateAbi: ${JSON.stringify(createComponentPrivateAbi(ir))} });\n`);
	await saveLakeFile(installed, "internal/runtime.mjs", runtimes[runtime](selection, mode));
	await saveLakeFile(root, "package.json", canonicalJson({ private: true, type: "module" }));
	const request = { module: "reviewed-fin", selection, mode, ...mode === "probe" ? { controls: reviewedFinWasmSourceControls.map(([name, values]) => [name, values.map(String)]) } : {} };
	const selected = await authenticateReviewedFinWasmEntryPackage(root, selection, mode);
	await prepareReviewedFinWasmEntryConsumer(root, { request, selection: selected, node: true });
	await saveLakeFile(root, "index.mjs", reviewedFinWasmEntryNodeIndex);
	return { root, installed };
};

test("each mode's measured Node run is accounted in full through the producer's own preload and consumer files", async t => {
	for(const [selection, mode] of [["scalar", "original"], ["structural", "original"], ["scalar", "probe"], ["structural", "probe"]])
	{
		const { root } = await consumer(t, selection, mode);
		const report = await runReviewedFinWasmEntryNode(root, "index.mjs");
		const accounted = accountReviewedFinWasmEntryReport(await expectReviewedFinWasmEntry(selection, mode), report);
		assert.deepEqual([accounted.mode, accounted.source, accounted.columns.length], [mode, mode === "probe", { scalar: 6, structural: 9 }[selection] + (mode === "probe" ? 1 : 0)]);
		assert.equal(Object.hasOwn(report.entry, "lines"), mode === "probe");
	}
});

test("a static package import, as in the strict TypeScript consumer, is still observed from the preload", async t => {
	const { root } = await consumer(t, "scalar", "original");
	await writeFile(join(root, "static.mjs"), `import * as api from "reviewed-fin";\nvoid api.mirror(9n);\n${reviewedFinWasmEntryNodeIndex}`);
	accountReviewedFinWasmEntryReport(await expectReviewedFinWasmEntry("scalar", "original"), await runReviewedFinWasmEntryNode(root, "static.mjs"));
});

test("the harness refuses unobserved, bypassed, altered or mislabelled packages and runs", async t => {
	const expected = await expectReviewedFinWasmEntry("scalar", "original");
	// Calls that never enter the observed frames.
	const unobserved = await consumer(t, "scalar", "original", "unobserved");
	const report = await runReviewedFinWasmEntryNode(unobserved.root, "index.mjs");
	assert.throws(() => accountReviewedFinWasmEntryReport(expected, report), /adapter entry of/u);
	// A runtime that compiles the component itself is refused by the observer before any call.
	const precompiled = await consumer(t, "scalar", "original", "precompiled");
	await assert.rejects(runReviewedFinWasmEntryNode(precompiled.root, "index.mjs"), error => /precompiled Module input cannot authenticate component bytes/u.test(error.details?.stderr));
	// Side-module bytes changed after authentication are refused by the preload.
	const altered = await consumer(t, "scalar", "original");
	const wasm = join(altered.installed, "internal/wasm/component.wasm"), bytes = await readFile(wasm);
	bytes[bytes.length - 2] ^= 1; await writeFile(wasm, bytes);
	await assert.rejects(runReviewedFinWasmEntryNode(altered.root, "index.mjs"), error => /side-module bytes are not the selected component/u.test(error.details?.stderr));
	// Without the preload, the package was not loaded under observation.
	const bare = await consumer(t, "scalar", "original");
	await writeFile(join(bare.root, "entry-preload.mjs"), "");
	await assert.rejects(runReviewedFinWasmEntryNode(bare.root, "index.mjs"), error => /no entry observation in this realm/u.test(error.details?.stderr));
	// A probe run accounted as original, and an original run accounted as probe.
	const probe = await consumer(t, "scalar", "probe");
	const traced = await runReviewedFinWasmEntryNode(probe.root, "index.mjs");
	assert.throws(() => accountReviewedFinWasmEntryReport(expected, traced), assert.AssertionError);
	const probeExpected = await expectReviewedFinWasmEntry("scalar", "probe");
	const plain = await runReviewedFinWasmEntryNode((await consumer(t, "scalar", "original")).root, "index.mjs");
	assert.throws(() => accountReviewedFinWasmEntryReport(probeExpected, plain), assert.AssertionError);
	// Installed public code that is not the generated code of the mode's contract is refused before observation.
	const edited = await consumer(t, "scalar", "original");
	await writeFile(join(edited.installed, "internal/validators.mjs"), `${await readFile(join(edited.installed, "internal/validators.mjs"), "utf8")}\n`);
	await assert.rejects(authenticateReviewedFinWasmEntryPackage(edited.root, "scalar", "original"), /generated public code/u);
});
