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
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
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
import { reviewedFinWasmTypeScript } from "./helpers/reviewed-fin-wasm-typescript.mjs";
import { accountReviewedFinWasmEntryReport, assertReviewedFinWasmEntryPhases, authenticateReviewedFinWasmEntryPackage, prepareReviewedFinWasmEntryConsumer, recountReviewedFinWasmEntryReport, reviewedFinWasmEntryBrowserPhases, reviewedFinWasmEntryNodeIndex, reviewedFinWasmInstalledManifest, runReviewedFinWasmEntryNode, runReviewedFinWasmEntryNodeOutput } from "./helpers/reviewed-fin-wasm-entry-producer.mjs";

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
 * @param options - Package layout.
 * @param options.compiled - List declarations in the compiler's alphabetical order rather than the authored order.
 */
const consumer = async (t, selection, mode, runtime = "faithful", { compiled = false } = {}) => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-fin-wasm-entry-harness-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	// A compiled package lists its declarations alphabetically, as the compiler's elaborated contract does.
	const authored = reviewedFinWasmEntryIr(selection, mode), installed = join(root, "node_modules/reviewed-fin");
	const ir = compiled ? { ...authored, declarations: [...authored.declarations].sort((left, right) => (left.id < right.id ? -1 : 1)) } : authored;
	for(const [path, text] of Object.entries(generateJavaScriptPackage(ir))) await saveLakeFile(installed, path, text);
	const bytes = frames(reviewedFinWasmEntrySymbols(selection, mode).map(item => item.symbol));
	await saveLakeFile(installed, "internal/wasm/component.wasm", bytes);
	await saveLakeFile(installed, "internal/descriptor.mjs", `export default Object.freeze({ integrity: ${JSON.stringify(sha256(bytes))}, sideModule: new URL("./wasm/component.wasm", import.meta.url), bindingIr: ${JSON.stringify(ir)}, privateAbi: ${JSON.stringify(createComponentPrivateAbi(ir))} });\n`);
	await saveLakeFile(installed, "internal/runtime.mjs", runtimes[runtime](selection, mode));
	// The shared runtime package an installation also carries; the stand-in runtime above does its work.
	await saveLakeFile(root, "node_modules/@lean-bridge/runtime/package.json", canonicalJson({ name: "@lean-bridge/runtime", version: "0.0.0-stand-in", type: "module" }));
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

test("a package in the compiler's declaration order is authenticated and accounted in the shared column order", async t => {
	for(const [selection, mode] of [["scalar", "original"], ["structural", "probe"]])
	{
		const { root } = await consumer(t, selection, mode, "faithful", { compiled: true });
		const accounted = accountReviewedFinWasmEntryReport(await expectReviewedFinWasmEntry(selection, mode), await runReviewedFinWasmEntryNode(root, "index.mjs"));
		assert.deepEqual(accounted.columns, reviewedFinWasmEntrySymbols(selection, mode).map(item => item.name));
	}
});

test("a static package import and its prelude calls, as in the strict TypeScript consumer, are observed and accounted", async t => {
	for(const mode of ["original", "probe"])
	{
		const { root } = await consumer(t, "scalar", mode), expected = await expectReviewedFinWasmEntry("scalar", mode);
		await writeFile(join(root, "static.mjs"), `import * as api from "reviewed-fin";\nvoid api.mirror(9n);\nvoid api.label("prefix", 0n, "suffix");\n${reviewedFinWasmEntryNodeIndex}`);
		const report = await runReviewedFinWasmEntryNode(root, "static.mjs");
		assert.deepEqual(accountReviewedFinWasmEntryReport(expected, report, ["mirror", "label"]).prelude, ["mirror", "label"]);
		// The prelude's entries are never dropped: an undeclared, partial or extra prelude is refused, and a reordered
		// one where source lines carry the order. Adapter counters alone cannot order calls.
		for(const prelude of [[], ["mirror"], ["mirror", "label", "mirror"], ...mode === "probe" ? [["label", "mirror"]] : []])
			assert.throws(() => accountReviewedFinWasmEntryReport(expected, report, prelude), assert.AssertionError, `${mode} ${prelude}`);
		const hidden = structuredClone(report); delete hidden.entry.before;
		assert.throws(() => accountReviewedFinWasmEntryReport(expected, hidden, ["mirror", "label"]), assert.AssertionError);
	}
});

test("a failed load, before or after the selected instantiation, restores this realm and keeps the original error", async t => {
	const { root } = await consumer(t, "scalar", "original");
	const observation = await import(pathToFileURL(join(root, "corpus/entry-observation.mjs")));
	const moduleBytes = await readFile(join(root, "node_modules/reviewed-fin/internal/wasm/component.wasm"));
	const symbols = reviewedFinWasmEntrySymbols("scalar", "original").map(item => item.symbol);
	const native = { error: console.error, instantiate: WebAssembly.instantiate, instantiateStreaming: WebAssembly.instantiateStreaming };
	const unhandled = [];
	const record = error => unhandled.push(error);
	process.on("unhandledRejection", record);
	t.after(() => process.off("unhandledRejection", record));
	for(const [label, load, expected] of [
		["before instantiation", async () => { throw new Error("sentinel failed import"); }, /sentinel failed import/u]
		, ["after instantiation", async () => { await WebAssembly.instantiate(moduleBytes); throw new Error("sentinel failed after load"); }, /sentinel failed after load/u]
		, ["refused by the observer", async () => WebAssembly.instantiate(new WebAssembly.Module(moduleBytes)), /precompiled Module input/u]
		, ["never instantiated", async () => ({}), /did not instantiate the selected component/u]
	]) {
		observation.startEntryObservation({ mode: "original", moduleBytes, symbols });
		assert.notEqual(WebAssembly.instantiate, native.instantiate, `${label}: observing`);
		await assert.rejects(observation.loadUnderObservation(load), expected, label);
		assert.deepEqual({ error: console.error, instantiate: WebAssembly.instantiate, instantiateStreaming: WebAssembly.instantiateStreaming }, native, `${label}: restored`);
		assert.equal(globalThis[Symbol.for("lean-bridge.reviewed-fin-wasm-entry")], undefined, `${label}: cleared`);
	}
	await new Promise(resolveTick => setImmediate(resolveTick));
	assert.deepEqual(unhandled, []);
});

test("observation leaves the whole installation unchanged, and an altered or linked installed file is detected", async t => {
	const { root, installed } = await consumer(t, "structural", "probe");
	const before = await reviewedFinWasmInstalledManifest(root);
	assert.ok(before.files.some(file => file.path === "node_modules/reviewed-fin/internal/wasm/component.wasm"));
	await runReviewedFinWasmEntryNode(root, "index.mjs");
	assert.deepEqual(await reviewedFinWasmInstalledManifest(root), before);
	await writeFile(join(installed, "README.md"), "changed\n");
	assert.notDeepEqual(await reviewedFinWasmInstalledManifest(root), before);
	await symlink("/etc/hostname", join(installed, "linked"));
	await assert.rejects(reviewedFinWasmInstalledManifest(root), /is not a link/u);
});

test("every browser observation carries its engine, variant and phase, and executions bind to their first run", () => {
	for(const [profile, { variants, phases }] of Object.entries(reviewedFinWasmEntryBrowserPhases))
	{
		const engines = ["chromium", "firefox", "webkit"];
		const observations = engines.flatMap(engine => variants.flatMap(variant => phases.map(phase => ({ engine, variant, phase, transcriptSha256: sha256(`${engine} ${variant} ${phase}`) }))));
		const executions = engines.flatMap(engine => variants.map(variant => ({ engine, variant, transcriptSha256: sha256(`${engine} ${variant} first`) })));
		const context = { profile, engines, observations, executions };
		assertReviewedFinWasmEntryPhases(context);
		for(const mutate of [
			value => { value.observations.pop(); }
			, value => { value.observations.push(value.observations[0]); }
			, value => { value.observations.reverse(); }
			, value => { value.observations[1].phase = "first"; }
			, value => { value.executions[0].transcriptSha256 = value.observations[1].transcriptSha256; }
			, value => { value.executions.pop(); }
			, value => { value.engines.pop(); }
		]) {
			const value = structuredClone(context); mutate(value);
			assert.throws(() => assertReviewedFinWasmEntryPhases(value), assert.AssertionError, profile);
		}
	}
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

test("retained transcripts alone recount every run, and an altered or missing transcript is refused", async t => {
	const expected = await expectReviewedFinWasmEntry("structural", "probe");
	const { root } = await consumer(t, "structural", "probe");
	const stdout = await runReviewedFinWasmEntryNodeOutput(root, "index.mjs"), digest = sha256(stdout);
	const accounted = accountReviewedFinWasmEntryReport(expected, JSON.parse(stdout));
	// A Node-only report: the strict TypeScript context's run here is the same consumer with its declared prelude.
	await writeFile(join(root, "typed.mjs"), `import * as api from "reviewed-fin";\nvoid api.mirror(9n);\nvoid api.label("prefix", 0n, "suffix");\nvoid api.rows([[0n, 9n]]);\nvoid api.nested([{ tag: "some", value: [2n, { error: 1n }] }]);\n${reviewedFinWasmEntryNodeIndex}`);
	const typedOutput = await runReviewedFinWasmEntryNodeOutput(root, "typed.mjs"), typedDigest = sha256(typedOutput);
	const prelude = ["mirror", "label", "rows", "nested"];
	const typed = accountReviewedFinWasmEntryReport(expected, JSON.parse(typedOutput), prelude);
	const contexts = [{ profile: "node-javascript", transcriptSha256: digest, ...accounted }, { profile: "node-typescript", transcriptSha256: typedDigest, ...typed }];
	const report = {
		mode: "probe"
		, selection: "structural"
		, calls: expected.calls.length
		, typescriptSha256: sha256(reviewedFinWasmTypeScript("structural"))
		, contexts
		, transcripts: { [digest]: stdout, [typedDigest]: typedOutput }
	};
	assert.equal(recountReviewedFinWasmEntryReport(report, expected, { engines: [] }), 2);
	// Coverage is declared independently: a dropped or relabelled context, a relabelled prelude, an undeclared
	// browser run or a different TypeScript consumer is refused.
	for(const [value, coverage, diagnostic] of [
		[{ ...report, contexts: report.contexts.slice(0, 1) }, { engines: [] }, /the declared contexts/u]
		, [{ ...report, contexts: [report.contexts[0], { ...report.contexts[1], prelude: ["mirror", "label"] }] }, { engines: [] }, /node-typescript prelude/u]
		, [{ ...report, contexts: [report.contexts[0], { ...report.contexts[1], prelude: [] }] }, { engines: [] }, /node-typescript prelude/u]
		, [report, { engines: ["chromium"] }, /the declared contexts/u]
		, [{ ...report, typescriptSha256: sha256("other") }, { engines: [] }, /the strict TypeScript consumer/u]
	]) assert.throws(() => recountReviewedFinWasmEntryReport(value, expected, coverage), error => error instanceof assert.AssertionError && diagnostic.test(error.message), String(diagnostic));
	assert.throws(() => recountReviewedFinWasmEntryReport(report, expected), TypeError);
	// Transcript corruption, with both declared contexts present so each case reaches its own check.
	const parsed = JSON.parse(stdout);
	parsed.entry.lines = parsed.entry.lines.filter(line => !line.startsWith("lean-bridge-source-entry nested"));
	const forged = JSON.stringify(parsed), forgedDigest = sha256(forged);
	for(const [value, diagnostic] of [
		[{ ...report, transcripts: { ...report.transcripts, [digest]: `${stdout} ` } }, /a retained transcript is its digest's bytes/u]
		, [{ ...report, transcripts: { [digest]: stdout } }, new RegExp(`transcript ${typedDigest} is retained`, "u")]
		, [{ ...report, contexts: [{ ...report.contexts[0], transcriptSha256: forgedDigest }, report.contexts[1]], transcripts: { ...report.transcripts, [forgedDigest]: forged } }, /source entry of raw nested|source entry of public nested/u]
		, [{ ...report, contexts: [{ ...report.contexts[0], source: false }, report.contexts[1]] }, /node-javascript recount/u]
		, [{ ...report, contexts: [report.contexts[0], { ...report.contexts[1], calls: report.contexts[1].calls - 1 }] }, /node-typescript recount/u]
	]) assert.throws(() => recountReviewedFinWasmEntryReport(value, expected, { engines: [] }), error => error instanceof assert.AssertionError && diagnostic.test(error.message), String(diagnostic));
	// A report relabelled as another mode is refused before any transcript is read.
	assert.throws(() => recountReviewedFinWasmEntryReport({ ...report, mode: "original" }, expected, { engines: [] }), assert.AssertionError);
});

test("a browser report must cover exactly the declared engines; removing an engine with all its rows is refused", () => {
	const engines = ["chromium", "firefox", "webkit"];
	const context = profile => {
		const { variants, phases } = reviewedFinWasmEntryBrowserPhases[profile];
		const observations = engines.flatMap(engine => variants.flatMap(variant => phases.map(phase => ({ engine, variant, phase, transcriptSha256: sha256(`${profile} ${engine} ${variant} ${phase}`) }))));
		return { profile, engines, observations, executions: engines.flatMap(engine => variants.map(variant => ({ engine, variant, transcriptSha256: sha256(`${profile} ${engine} ${variant} first`) }))) };
	};
	// Removing one engine together with its observations and executions still satisfies the per-context phase check,
	// so only the independently declared engines can refuse it.
	const reduced = context("browser-worker");
	reduced.engines = ["chromium", "firefox"];
	reduced.observations = reduced.observations.filter(item => item.engine !== "webkit");
	reduced.executions = reduced.executions.filter(item => item.engine !== "webkit");
	assertReviewedFinWasmEntryPhases(reduced);
	const contexts = [{ profile: "node-javascript", prelude: [] }, { profile: "node-typescript", prelude: ["mirror", "label"] }, context("browser-javascript"), context("browser-react"), reduced];
	const report = {
		mode: "original"
		, selection: "scalar"
		, calls: 226
		, typescriptSha256: sha256(reviewedFinWasmTypeScript("scalar"))
		, transcripts: {}
		, contexts
	};
	assert.throws(() => recountReviewedFinWasmEntryReport(report, { mode: "original", selection: "scalar", calls: Array(226) }, { engines }), /browser-worker engines/u);
});
