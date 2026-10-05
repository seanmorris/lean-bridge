/**
 * Public receiver exports and strict TypeScript whole-owner member types.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";
import { generateJavaScriptPackage } from "../src/backends/javascript/generate.mjs";
import { auditJavaScriptPackage } from "../src/backends/javascript/package-audit.mjs";
import { ownedRustReceiverReviewedIr } from "./helpers/owned-rust-receiver-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const prepare = async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-js-receiver-types-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const ir = ownedRustReceiverReviewedIr(), files = generateJavaScriptPackage(ir);
	for(const [path, source] of Object.entries(files)) await saveLakeFile(directory, path, source);
	await saveLakeFile(directory, "package.json", JSON.stringify({ ...JSON.parse(files["package.json"]), name: "receiver-js-projection" }));
	return { directory, ir, files };
};

test("JavaScript receiver exports distinguish the receiver from remaining copy selectors", async t => {
	const { directory, ir, files } = await prepare(t);
	assert.ok(auditJavaScriptPackage(ir, files).exports.includes("chooseTicket"));
	assert.doesNotMatch(files["index.d.ts"], /\b(?:any|pointer|token|signatureId|WebAssembly)\b/u);
	await saveLakeFile(directory, "internal/runtime.mjs", `export const runtime = {
  call: (id, args) => ({ id, args }), close: () => true,
  copyValue: (type, value) => ({ type, value }), withRecovery: operation => operation
};\n`);
	const api = await import(pathToFileURL(join(directory, "index.mjs")).href);
	const first = {}, second = {};
	assert.deepEqual(api.chooseTicket(first, second), { id: "lean:Owned.chooseTicket", args: [first, second] });
	assert.deepEqual(api.copyValue(first, { receiverOf: "chooseTicket" }), api.copyValue(first, { resultOf: "newTicket" }));
	assert.deepEqual(api.copyValue(second, { parameterOf: ["chooseTicket", 0] }), api.copyValue(second, { parameterOf: ["chooseTicket", "owner1"] }));
	assert.throws(() => api.copyValue(first, { parameterOf: ["chooseTicket", 1] }));
	assert.throws(() => api.copyValue(first, { receiverOf: "newTicket" }));
	let getterCalls = 0;
	const accessor = Object.defineProperty({}, "receiverOf", { get: () => { getterCalls++; return "chooseTicket"; } });
	assert.throws(() => api.copyValue(first, accessor)); assert.equal(getterCalls, 0);
	for(const name of ["get", "dispose", "retain", "share", "then", "constructor"])
	{
		const changed = structuredClone(ir); changed.declarations.find(fn => fn.name === "serial").name = name;
		assert.throws(() => generateJavaScriptPackage(changed));
	}
});

test("strict TypeScript preserves nominal owners and rejects forged or expired-view members", async t => {
	const { directory } = await prepare(t);
	await saveLakeFile(directory, "consumer.mts", `import api, { type Ticket, type TicketValue, type BundleValue } from "receiver-js-projection";
const root: TicketValue = api.newTicket(42n, "door");
const serial: bigint = root.serial;
const label: string = root.get().label;
const shared: TicketValue = root.share();
const kept: TicketValue = root.retain();
const keptView: TicketValue = root.get().retain();
const borrowed: TicketValue = root.retainTicket();
const selected: TicketValue = root.chooseTicket(kept);
const fromView: TicketValue = root.get().chooseTicket(kept);
const copied: TicketValue = api.copyValue(root.get(), { receiverOf: "chooseTicket" });
const parameter: TicketValue = api.copyValue(root.get(), { parameterOf: ["chooseTicket", 0] });
const record: BundleValue = api.copyValue({ primary: root.get(), spare: { tag: "none" }, peers: [], history: [], payload: { count: 0n, bytes: new Uint8Array() } }, { receiverOf: "echoRecord" });
const alias: BundleValue = api.echoAlias(record);
const echoed: BundleValue = record.echoRecord();
const primary: TicketValue = record.primary;
const count: bigint = record.payload.count;
const callback: BundleValue = record.callbackRecord(value => value);
const fromClosure: BundleValue = record.makeRecord().get()(true, record);
const moved: TicketValue = copied.transferTicket();
// @ts-expect-error Read-only Lean property.
root.serial = 1n;
// @ts-expect-error Raw views cannot anchor a borrowed receiver result.
root.get().retainTicket();
// @ts-expect-error Consuming members require whole owners.
root.get().transferTicket();
// @ts-expect-error The remaining anchor parameter requires its whole owner.
root.chooseTicket(kept.get());
// @ts-expect-error This aggregate has no Ticket-only member.
record.chooseTicket(root);
// @ts-expect-error Receiver position is not a remaining parameter index.
api.copyValue(root.get(), { parameterOf: ["chooseTicket", 1] });
// @ts-expect-error Root brands cannot be forged structurally.
const forged: TicketValue = { get: () => root.get(), disposed: false, dispose: () => true, share: () => root, retain: () => root, serial: 42n, label: "door", retainTicket: () => root, chooseTicket: () => root, transferTicket: () => root, mixedTicket: () => root };
const view: Ticket = root.get();
for (const value of [root, shared, kept, keptView, borrowed, selected, fromView, copied, parameter, record, alias, echoed, primary, callback, fromClosure, moved]) value.dispose();
void serial; void label; void count; void view;
`);
	const program = ts.createProgram([join(directory, "consumer.mts")], {
		strict: true, noEmit: true, skipLibCheck: false
		, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext
		, moduleResolution: ts.ModuleResolutionKind.NodeNext, types: [] });
	const diagnostics = ts.getPreEmitDiagnostics(program);
	assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
		getCanonicalFileName: file => file
		, getCurrentDirectory: () => directory, getNewLine: () => "\n"
	}));
});
