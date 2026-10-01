/**
 * Whole-owner JavaScript exports and strict directional TypeScript consumers.
 * Installed archive and browser gates remain separate from projection checks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";
import { sha256 } from "../src/capsule/node.mjs";
import { generateJavaScriptPackage } from "../src/backends/javascript/generate.mjs";
import { auditJavaScriptPackage } from "../src/backends/javascript/package-audit.mjs";
import { generateOwnedNativeValueAdapters } from "../src/backends/native/owned-value-adapters.mjs";
import { generateOwnedWasmComponent } from "../src/backends/javascript/owned-wasm-component.mjs";
import { ownedJavaScriptWasmNativeProbe } from "./helpers/owned-javascript-wasm-native.mjs";
import { ownedRustBorrowReviewedIr } from "./helpers/owned-rust-borrow-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const prepare = async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-js-borrow-types-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const ir = ownedRustBorrowReviewedIr(), files = generateJavaScriptPackage(ir);
	for(const [path, source] of Object.entries(files)) await saveLakeFile(directory, path, source);
	await saveLakeFile(directory, "package.json", JSON.stringify({ ...JSON.parse(files["package.json"]), name: "borrowed-js-projection" }));
	return { directory, ir, files };
};

test("borrowed JS packages expose typed whole owners and checked copy selectors", async t => {
	const { directory, ir, files } = await prepare(t);
	assert.ok(auditJavaScriptPackage(ir, files).exports.includes("copyValue"));
	assert.doesNotMatch(files["index.d.ts"], /\b(?:any|pointer|token|signatureId|WebAssembly)\b/u);
	assert.match(files["index.d.ts"], /export interface LeanValue<T>/u);
	await saveLakeFile(directory, "internal/runtime.mjs", `export const runtime = {
  call: (id, args) => ({ id, args }), close: () => true,
  copyValue: (type, value) => ({ type, value }),
  withRecovery: (operation, recovery) => ({ operation, recovery })
};\n`);
	const api = await import(pathToFileURL(join(directory, "index.mjs")).href);
	const value = [], copy = api.copyValue(value, { resultOf: "echoArray" });
	assert.equal(copy.value, value); assert.equal(typeof copy.type, "string");
	assert.deepEqual(api.copyValue(value, { parameterOf: ["echoArray", 0] }), copy);
	assert.deepEqual(api.copyValue(value, { parameterOf: ["echoArray", "owner0"] }), copy);
	assert.equal(api.default.copyValue, api.copyValue);
	let getterCalls = 0;
	const accessor = Object.defineProperty({}, "resultOf", { get: () => { getterCalls++; return "echoArray"; } });
	for(const selector of [null, [], {}, { resultOf: "serial" }
		, { resultOf: "unknown" }, { parameterOf: ["echoArray", 9] }
		, { resultOf: "echoArray", parameterOf: ["echoArray", 0] }
		, accessor])
		assert.throws(() => api.copyValue(value, selector), TypeError);
	assert.equal(getterCalls, 0);
	assert.throws(() => api.copyValue(value, { resultOf: "echoArray" }, 1), TypeError);
});

test("strict TypeScript distinguishes payload views, whole roots and copied results", async t => {
	const { directory } = await prepare(t);
	await saveLakeFile(directory, "consumer.mts", `import api, { type LeanValue, type Ticket, type Bundle } from "borrowed-js-projection";
const root: LeanValue<Ticket> = api.newTicket(42n, "door");
const leaf: Ticket = root.get();
const shared: LeanValue<Ticket> = root.share();
const independent: LeanValue<Ticket> = root.retain();
const retainedLeaf: LeanValue<Ticket> = leaf.retain();
const same: boolean = leaf.equals(independent.get());
const serial: bigint = api.serial(root);
api.serial(leaf);
const borrowed: LeanValue<Ticket> = api.retainTicket(root);
const empty = api.copyValue([], { resultOf: "echoArray" });
const emptyAgain = api.copyValue([], { parameterOf: ["echoArray", "owner0"] });
const array: LeanValue<ReadonlyArray<Ticket>> = api.echoArray(empty);
const record: LeanValue<Bundle> = api.copyValue({ primary: leaf, spare: { tag: "none" }, peers: [leaf], history: [], payload: { count: -1n, bytes: new Uint8Array() } }, { resultOf: "echoRecord" });
const echoed: LeanValue<Bundle> = api.callbackRecord(record, value => { const kept = value.primary.retain(); kept.dispose(); return value; });
const closure = api.makeRecord(record);
const fromClosure: LeanValue<Bundle> = closure.get()(true, record);
const copied = api.payload(record);
const count: bigint = copied.count;
api.moveArray(emptyAgain).dispose();
// @ts-expect-error Anchors require a whole owner, not a raw payload.
api.echoArray([]);
// @ts-expect-error A resource view does not keep a whole result alive.
api.retainTicket(leaf);
// @ts-expect-error Copied scalar results cannot define whole-owner construction.
api.copyValue(1n, { resultOf: "serial" });
// @ts-expect-error Copied parameters cannot define whole-owner construction.
api.copyValue(1n, { parameterOf: ["newTicket", 0] });
// @ts-expect-error The private owner brand prevents structural forgery.
const forged: LeanValue<Ticket> = { get: () => leaf, share: () => root, retain: () => root, dispose: () => true, disposed: false };
// @ts-expect-error A whole owner is not a payload's native function.
closure(true, record);
for (const owner of [root, shared, independent, retainedLeaf, borrowed, empty, array, record, echoed, closure, fromClosure]) owner.dispose();
api.close(); void same; void serial; void count;
`);
	const program = ts.createProgram([join(directory, "consumer.mts")], {
		strict: true, noEmit: true, skipLibCheck: false
		, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext
		, moduleResolution: ts.ModuleResolutionKind.NodeNext, types: []
	});
	const diagnostics = ts.getPreEmitDiagnostics(program);
	assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
		getCanonicalFileName: file => file
		, getCurrentDirectory: () => directory, getNewLine: () => "\n"
	}));
});

test("borrowed-result capability leaves prior transfer components byte-identical", async () => {
	const receipt = JSON.parse(await readFile("docs/evidence/owned-javascript-transfers-20260930.json", "utf8"));
	for(const previous of receipt.runtime)
	{
		const generated = generateOwnedNativeValueAdapters({ ...previous.input, wordBits: 32, hostCallbacks: true, transferredInputs: true });
		const component = generateOwnedWasmComponent(generated);
		assert.deepEqual(component.privateAbi, previous.privateAbi);
		assert.equal(sha256(ownedJavaScriptWasmNativeProbe(component)), previous.sourceSha256);
	}
});
