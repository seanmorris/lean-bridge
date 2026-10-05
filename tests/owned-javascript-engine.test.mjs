/**
 * Run source-only owned component requests with real pinned compilers.
 * This is engine acceptance, not a claim of Nix or Docker process isolation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, readFile, rm, symlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { executeComponentEngineRequest } from "../src/build/component-engine.mjs";
import { readVerifiedOwnedJavaScriptEngineOutput } from "../src/build/javascript-wasm-owned-engine.mjs";
import { validateOwnedJavaScriptWasmBinary } from "../src/build/javascript-wasm-owned-artifacts.mjs";
import { createEngineExecutionRequest, writeEngineExecutionRequest } from "../src/build/engine-execution-request.mjs";
import { prepareLakeEntryIntent, writeLakeEntryInputs } from "../src/build/lake-entry-intent.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { buildOwnedJavaScriptNpmPackages } from "../src/release/owned-javascript-npm-package.mjs";
import { ownedAnalysisFixture } from "./helpers/owned-analysis.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { generatedLakeWorkspaceFixture } from "./helpers/lake-generator.mjs";

const environment = { ...process.env
	, LEAN_BRIDGE_LEAN_PREFIX: resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2")
	, LEAN_BRIDGE_JS_EMSDK: resolve(process.env.LEAN_BRIDGE_JS_EMSDK ?? ".toolchains/emsdk")
	, LEAN_BRIDGE_JS_TARGET_RUNTIME: resolve(process.env.LEAN_BRIDGE_JS_TARGET_RUNTIME ?? "build/lean-runtime/f3b06c705e6c85f5314019d5d3baab0fec5b580c-743765bf566f43ec2f7b4eb84a85686880b3797efe83bf244d6fc7281e4f85a3-browser") };

test("owned Wasm export validation permits only the optional linker relocation helper", async () => {
	const suffix = "0123456789abcdef0123", control = `lbjs_component_${suffix}_control`;
	const unsigned = value => {
		const bytes = [];
		do
		{ const next = value & 127; value >>>= 7; bytes.push(next | (value ? 128 : 0)); } while(value);
		return bytes;
	};
	const text = value => { const bytes = [...Buffer.from(value)]; return [...unsigned(bytes.length), ...bytes]; };
	const section = (id, bytes) => [id, ...unsigned(bytes.length), ...bytes];
	const binary = (names, broker = "lean_bridge_native_component_initialize") => Uint8Array.from([
		0, 97, 115, 109, 1, 0, 0, 0
		, ...section(1, [1, 96, 0, 0])
		, ...section(2, [3, ...text("env"), ...text("memory"), 2, 0, 1
			, ...text("env"), ...text("__indirect_function_table"), 1, 112, 0, 1
			, ...text("env"), ...text(broker), 0, 0])
		, ...section(6, [1, 127, 0, 65, 0, 11])
		, ...section(7, [...unsigned(names.length), ...names.flatMap(([name, kind]) => [...text(name), kind, 0])])
	]);
	const required = [[control, 0], ["__wasm_call_ctors", 0]
		, [`__em_js__lbjs_${suffix}_dispatch_js`, 3]
		, [`__em_js__lbjs_${suffix}_finish_js`, 3]];
	for(const exports of [required, [...required, ["__wasm_apply_data_relocs", 0]]])
		await validateOwnedJavaScriptWasmBinary(binary(exports), control);
	for(const exports of [required.slice(1), required.slice(0, -1)
		, [...required, ["application_export", 0]]
		, [...required, ["__wasm_apply_data_relocs", 3]]])
		await assert.rejects(validateOwnedJavaScriptWasmBinary(binary(exports), control));
	await assert.rejects(validateOwnedJavaScriptWasmBinary(binary(required, "unrelated_initializer"), control));
});

for(const reviewed of [false, true]) test(`owned JavaScript ${reviewed ? "reviewed" : "ordinary"} engine compiles captured source and rejects unrelated output`, {
	skip: process.env.LEAN_BRIDGE_OWNED_JS_WASM_BUILD_TEST !== "1", timeout: 600000
}, async t => {
	const { root, directory } = await ownedAnalysisFixture(t, reviewed);
	const intent = await prepareLakeEntryIntent({ projectRoot: root, purpose: "owned-javascript", ownedGraphs: true });
	const inputRoot = join(directory, "input"), requestPath = join(directory, "request.json"), outputRoot = join(directory, "output");
	await writeLakeEntryInputs({ intent, outputRoot: inputRoot });
	const request = await writeEngineExecutionRequest({ output: requestPath
		, engineRoot: resolve("."), inputRoot
		, entryIntent: intent, purpose: "owned-javascript", targets: ["npm"] });
	const sourceBefore = await lakeInputState(root), inputsBefore = await lakeInputState(inputRoot);
	const built = await executeComponentEngineRequest({ requestPath, inputRoot
		, outputRoot, engineRoot: resolve(".")
		, backend: "direct-test", environment
		, runner: { capture: invocation => processBuildRunner.capture(invocation).catch(error => { t.diagnostic(JSON.stringify(error.details)); throw error; }) } });
	const options = { outputRoot, request, intent, inputRoot, engineRoot: resolve("."), backend: "direct-test" };
	const checked = await readVerifiedOwnedJavaScriptEngineOutput(options);
	assert.equal(checked.model.exports.length, 51);
	assert.equal(checked.identity, built.report.componentReceiptSha256);
	assert.deepEqual(await lakeInputState(root), sourceBefore); assert.deepEqual(await lakeInputState(inputRoot), inputsBefore);
	await assert.rejects(readVerifiedOwnedJavaScriptEngineOutput({ ...options, backend: "native-nix" }));
	const altered = structuredClone(request.document); altered.output.authorizedFiles.push("extra.txt");
	await assert.rejects(readVerifiedOwnedJavaScriptEngineOutput({ ...options, request: { document: altered, sha256: sha256(canonicalJson(altered)) } }));
	await saveLakeFile(outputRoot, "component/extra.txt", "not authorized");
	await assert.rejects(readVerifiedOwnedJavaScriptEngineOutput(options));
	await rm(join(outputRoot, "component/extra.txt"));
	const report = await readFile(join(outputRoot, "engine-execution-report.json"));
	await saveLakeFile(outputRoot, "engine-execution-report.json", canonicalJson({ ...built.report, sourceReadOnly: false }));
	await assert.rejects(readVerifiedOwnedJavaScriptEngineOutput(options));
	await saveLakeFile(outputRoot, "engine-execution-report.json", report);
	await symlink(root, join(outputRoot, "unexpected-source"));
	await assert.rejects(readVerifiedOwnedJavaScriptEngineOutput(options));
	await rm(join(outputRoot, "unexpected-source"));
	const different = join(directory, "different-source"); await cp(root, different, { recursive: true });
	await saveLakeFile(different, "Owned.lean", (await readFile(join(different, "Owned.lean"), "utf8")) + "\n-- another source identity\n");
	const otherIntent = await prepareLakeEntryIntent({ projectRoot: different, purpose: "owned-javascript", ownedGraphs: true });
	const otherInputs = join(directory, "other-inputs"); await writeLakeEntryInputs({ intent: otherIntent, outputRoot: otherInputs });
	const otherRequest = await createEngineExecutionRequest({ engineRoot: resolve("."), inputRoot: otherInputs, entryIntent: otherIntent, purpose: "owned-javascript", targets: ["npm"] });
	const changedReport = { ...built.report, requestSha256: otherRequest.sha256, inputClosureSha256: otherRequest.document.component.inputClosureSha256 };
	await saveLakeFile(outputRoot, "engine-execution-report.json", canonicalJson(changedReport));
	await assert.rejects(readVerifiedOwnedJavaScriptEngineOutput({ ...options, request: otherRequest, intent: otherIntent, inputRoot: otherInputs }), /captured source/);
	await saveLakeFile(outputRoot, "engine-execution-report.json", report);
	assert.equal((await readVerifiedOwnedJavaScriptEngineOutput(options)).identity, checked.identity);
	t.diagnostic(JSON.stringify({ reviewed, exports: 51
		, sourceUnchanged: true, inputUnchanged: true
		, sourceOnlyRequest: true, checkedOutput: true
		, rejectedMutations: 6, nixIsolation: false }));
});

test("owned JavaScript engine verifies generated Lean, locked dependencies and native inputs", {
	skip: process.env.LEAN_BRIDGE_OWNED_JS_WASM_BUILD_TEST !== "1", timeout: 600000
}, async t => {
	const context = await generatedLakeWorkspaceFixture(t);
	const base = JSON.parse(await readFile("tests/fixtures/onboarding/owned-dotnet-callables/lean-bridge.exports.json", "utf8"));
	const config = { ...context.configuration, modules: ["Shop"]
		, exports: ["Shop.newTicket", "Shop.serial", "Shop.total"]
		, resources: ["Shop.Ticket"], ownedAggregates: base.ownedAggregates };
	await saveLakeFile(context.root, "lean-bridge.exports.json", canonicalJson(config));
	await saveLakeFile(context.root, "Shop.lean", `import Generated
import ${context.names.local}
namespace Shop
structure Ticket where
  serial : Nat
  label : String
structure Bundle where
  ticket : Ticket
  value : UInt32
def newTicket (serial : Nat) : Ticket := ⟨serial, "generated"⟩
def serial (ticket : Ticket) : Nat := ticket.serial
def total (bundle : Bundle) : Nat := bundle.ticket.serial + bundle.value.toNat + Generated.value.toNat
end Shop
`);
	const before = await lakeInputState(context.workspace);
	const intent = await prepareLakeEntryIntent({ projectRoot: context.root, purpose: "owned-javascript", ownedGraphs: true });
	const inputRoot = join(context.directory, "engine-input"), requestPath = join(context.directory, "request.json");
	await writeLakeEntryInputs({ intent, outputRoot: inputRoot });
	const request = await writeEngineExecutionRequest({ output: requestPath
		, engineRoot: resolve("."), inputRoot, entryIntent: intent
		, purpose: "owned-javascript", targets: ["npm"] });
	assert.ok(request.document.output.authorizedFiles.includes("lake-generated-sources.json"));
	const outputRoot = join(context.directory, "engine-output");
	await executeComponentEngineRequest({ requestPath, inputRoot, outputRoot
		, engineRoot: resolve("."), backend: "direct-test", environment
		, runner: { capture: invocation => processBuildRunner.capture(invocation).catch(error => { t.diagnostic(JSON.stringify(error.details)); throw error; }) } })
		.catch(error => { t.diagnostic(JSON.stringify(error.details)); throw error; });
	const checked = await readVerifiedOwnedJavaScriptEngineOutput({ outputRoot
		, request, intent
		, inputRoot, engineRoot: resolve("."), backend: "direct-test" });
	assert.equal(checked.model.exports.length, 3);
	assert.ok(checked.receipt.nativeCompilation.objects.length > 0);
	assert.ok(checked.receipt.sourceIdentity.lakeDependencies.generatedSourcesSha256);
	assert.deepEqual(await lakeInputState(context.workspace), before);
	const packaged = await buildOwnedJavaScriptNpmPackages({ componentRoot: checked.root
		, runtimeRoot: resolve(process.env.LEAN_BRIDGE_OWNED_JS_WASM_PREPARED_ROOT ?? "build/lean-link-spike", "lazy")
		, outputRoot: join(context.directory, "packages") });
	const consumer = join(context.directory, "consumer");
	await saveLakeFile(consumer, "package.json", '{"name":"generated-owned-consumer","private":true,"version":"1.0.0","type":"module"}\n');
	await saveLakeFile(consumer, "runtime.tgz", await readFile(packaged.runtimeArchive));
	await saveLakeFile(consumer, "component.tgz", await readFile(packaged.componentArchive));
	await rm(context.workspace, { recursive: true }); await rm(outputRoot, { recursive: true });
	await rm(packaged.output, { recursive: true });
	const run = (command, args) => processBuildRunner.capture({ command, args, cwd: consumer, timeoutMs: 120000 });
	await run("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "./runtime.tgz", "./component.tgz"]);
	await saveLakeFile(consumer, "call.mjs", `import assert from "node:assert/strict";
import api from ${JSON.stringify(packaged.coordinate.name)};
const ticket = api.newTicket(7n);
assert.equal(api.serial(ticket), 7n);
assert.equal(api.total({ticket, value: 5}), 32n);
ticket.dispose(); assert.equal(api.close(), true);
console.log("generated Lean returned 32");
`);
	assert.equal((await run(process.execPath, ["call.mjs"])).stdout, "generated Lean returned 32\n");
	t.diagnostic(JSON.stringify({ generated: true, nativeInputs: true
		, lockedDependencies: true, sourceUnchanged: true
		, installedNode: true, producerRemoved: true, generatedResult: 32
		, exports: 3, nixIsolation: false }));
});
