/**
 * Public names, directional TypeScript values and exact owned package auditing.
 * Real compiled-runtime checks live in owned-javascript-wasm-prepared.test.mjs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";
import { generateJavaScriptPackage, compileJavaScriptPackageModel, renderJavaScriptPackageLayout } from "../src/backends/javascript/generate.mjs";
import { auditJavaScriptPackage } from "../src/backends/javascript/package-audit.mjs";
import { analyzeJavaScriptCoverage } from "../src/backends/javascript/coverage.mjs";
import { ownedDotnetCallbacksReviewedIr } from "./helpers/owned-dotnet-callback-fixture.mjs";

const prepare = async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-owned-js-projection-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const ir = ownedDotnetCallbacksReviewedIr(), files = generateJavaScriptPackage(ir);
	for(const [path, source] of Object.entries(files)) await writeFile(join(directory, path), source);
	await writeFile(join(directory, "package.json"), JSON.stringify({ ...JSON.parse(files["package.json"]), name: "owned-js-projection" }));
	return { directory, ir, files };
};

test("the standard JS generator emits one typed ownership surface without public transport state", () => {
	const ir = ownedDotnetCallbacksReviewedIr(), files = generateJavaScriptPackage(ir);
	assert.deepEqual(renderJavaScriptPackageLayout(compileJavaScriptPackageModel(ir)), files);
	assert.equal(analyzeJavaScriptCoverage(ir).supported, true);
	assert.deepEqual(auditJavaScriptPackage(ir, files).exports, [...ir.declarations.map(item => item.name), "close", "withRecovery"]);
	assert.doesNotMatch(files["index.d.ts"], /\b(?:any|pointer|token|signatureId|WebAssembly)\b/u);
	assert.doesNotMatch(files["index.mjs"], /\b(?:class|JSON|WebAssembly|wasmTable|ccall)\b/u);
	assert.match(files["index.d.ts"], /export interface Ticket extends LeanLease/u);
	assert.match(files["index.d.ts"], /export interface BundleInput/u);
	assert.match(files["index.d.ts"], /export interface Bundle /u);
	assert.match(files["index.d.ts"], /Lease extends LeanLease/u);
});

test("the owned package audit rejects altered code, types, metadata and extra files", () => {
	const ir = ownedDotnetCallbacksReviewedIr(), files = generateJavaScriptPackage(ir);
	for(const path of Object.keys(files)) assert.throws(() => auditJavaScriptPackage(ir, { ...files, [path]: files[path] + "\n" }), /differs/u);
	assert.throws(() => auditJavaScriptPackage(ir, { ...files, "internal/raw.mjs": "export const token = 1;" }), /differs/u);
	assert.throws(() => auditJavaScriptPackage(ir, { ...files, "index.d.ts": files["index.d.ts"].replace("bigint", "number") }), /differs/u);
});

test("owned public naming rejects collisions, unsafe syntax and Promise-like modules", () => {
	for(const name of ["close", "withRecovery", "default", "then", "runtime", "Ticket", "BundleInput", "_private", "break", "x;throw 1", "newTicket"])
	{
		const ir = ownedDotnetCallbacksReviewedIr(); ir.declarations[1].name = name;
		assert.throws(() => generateJavaScriptPackage(ir), /name|identifier/u, name);
		assert.equal(analyzeJavaScriptCoverage(ir).supported, false);
	}
	const ir = ownedDotnetCallbacksReviewedIr(); ir.types.find(type => type.kind === "variant").cases[1].fields[0].name = "kind";
	assert.throws(() => generateJavaScriptPackage(ir), /discriminator/u);
});

test("generated calls preserve argument counts and delegate lifetime and recovery to the private runtime", async t => {
	const { directory } = await prepare(t);
	await mkdir(join(directory, "internal"));
	await writeFile(join(directory, "internal/runtime.mjs"), `export const runtime = {
  call: (id, args) => ({ id, args }), close: () => 17,
  withRecovery: (operation, recovery) => ({ operation, recovery })
};\n`);
	const api = await import(pathToFileURL(join(directory, "index.mjs")).href);
	const resource = Object.freeze({}), input = { primary: resource };
	assert.deepEqual(api.echoRecord(input), { id: "lean:Owned.echoRecord", args: [input] });
	assert.deepEqual(api.echoRecord(), { id: "lean:Owned.echoRecord", args: [] });
	assert.deepEqual(api.echoRecord(input, 9), { id: "lean:Owned.echoRecord", args: [input, 9] });
	assert.equal(api.close(), 17);
	const callback = value => value;
	assert.deepEqual(api.withRecovery(callback, input), { operation: callback, recovery: input });
	assert.equal(api.default.echoRecord, api.echoRecord); assert.ok(Object.isFrozen(api.default));
});

test("owned coverage does not promise unimplemented callback policies", () => {
	for(const [key, value] of [["resultMode", "promise"], ["invocation", "once"], ["reentry", "disallowed"], ["selfDisposal", "reject"]])
	{
		const ir = ownedDotnetCallbacksReviewedIr(), callable = ir.types.find(type => type.kind === "callback").callable;
		callable[key] = value;
		if(key === "resultMode") callable.effects = [...callable.effects, "async"];
		assert.throws(() => generateJavaScriptPackage(ir), /callbacks require/u);
		assert.equal(analyzeJavaScriptCoverage(ir).supported, false);
	}
});

test("strict TypeScript consumers distinguish opaque resources, native leases and host callbacks", async t => {
	const { directory, ir } = await prepare(t);
	const callback = ir.types.find(type => type.id === ir.declarations.find(item => item.name === "callbackRecord").parameters[1].type.id).name;
	await writeFile(join(directory, "consumer.mts"), `import api, { type Ticket, type Bundle, type BundleInput, type ${callback}, type ${callback}Lease } from "owned-js-projection";
const ticket = api.newTicket(12n, "door");
const retained: Ticket = ticket.retain();
const input: BundleInput = { primary: ticket, spare: { tag: "none" }, peers: [ticket], history: [], payload: { count: -2n, bytes: new Uint8Array() } };
const result: Bundle = api.echoRecord(input);
const callback: ${callback} = value => { const kept = value.primary.retain(); kept.dispose(); return value; };
api.callbackRecord(input, callback);
api.withFunction(input, (fn, value) => { const kept: ${callback}Lease = fn.retain(); kept.dispose(); return fn(value); });
const callable = api.makeRecord(input);
const answer: Bundle = callable(true, input);
const copy = callable.retain(); copy(false, answer); copy.dispose(); callable.dispose();
api.callbackRecord(input, api.withRecovery(value => { if (value.primary.disposed) throw new Error(); return value; }, input));
const nested = api.echoMixed({ ticket, markers: [{ tag: "none" }, { tag: "some", value: { tag: "some", value: false } }], unit: { tag: "some", value: undefined }, result: { error: ticket }, signed: -1n, unsigned: 1n, scalar: "π", precise: 1.5, approximate: 0.5, bytes: new Uint8Array(), words: [1n], product: [ticket, [{ tag: "none" }, input.payload]], chain: { kind: "stop" } });
api.echoRecursive({ kind: "branch", children: [{ kind: "leaf", ticket }] });
if (nested.unit.tag === "some") { const unit: undefined = nested.unit.value; }
// @ts-expect-error Identity values cannot be constructed from their lifecycle shape.
const forged: Ticket = { dispose: () => true, retain: () => ticket, disposed: false };
// @ts-expect-error Native callbacks require explicit lifetime methods.
const forgedCallback: ${callback}Lease = callback;
// @ts-expect-error Nat is bigint, not Number.
api.newTicket(12, "door");
// @ts-expect-error An Option tag is mandatory.
api.echoOption(ticket);
// @ts-expect-error Unit cannot silently discard a supplied value.
api.viaUnit(() => 1, undefined);
// @ts-expect-error There is no public numeric identity.
ticket.token;
retained.dispose(); ticket.dispose(); api.close();
void result; void nested;
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
