/**
 * Fresh ordinary/reviewed Lean builds through the ownership compiler profile.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildOwnedJavaScriptWasmComponent } from "../src/build/javascript-wasm-owned-component.mjs";
import { readVerifiedOwnedJavaScriptWasmComponent } from "../src/build/javascript-wasm-owned-artifacts.mjs";
import { generateJavaScriptPackage } from "../src/backends/javascript/generate.mjs";
import { createComponentRuntime } from "../src/release/component-runtime.mjs";
import { buildOwnedJavaScriptNpmPackages } from "../src/release/owned-javascript-npm-package.mjs";
import { readVerifiedPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { ownedDotnetCallbacksReviewedIr } from "./helpers/owned-dotnet-callback-fixture.mjs";
import { saveLakeFile, lakeInputState } from "./helpers/lake-workspace.mjs";
import { checkOwnedJavaScriptBrowsers } from "./helpers/owned-javascript-npm-browser.mjs";

const enabled = process.env.LEAN_BRIDGE_OWNED_JS_WASM_BUILD_TEST === "1";
const target = resolve(process.env.LEAN_BRIDGE_JS_TARGET_RUNTIME ?? "build/lean-runtime/f3b06c705e6c85f5314019d5d3baab0fec5b580c-743765bf566f43ec2f7b4eb84a85686880b3797efe83bf244d6fc7281e4f85a3-browser");
const prepared = resolve(process.env.LEAN_BRIDGE_OWNED_JS_WASM_PREPARED_ROOT ?? "build/lean-link-spike", "lazy");

const installedSource = name => `import assert from "node:assert/strict";
import api from ${JSON.stringify(name)};
const ticket = api.newTicket(1n << 90n, "installed\\0🙂");
const bundle = { primary: ticket, spare: { tag: "some", value: ticket }, peers: [ticket], history: [ticket],
  payload: { count: -(1n << 140n), bytes: new Uint8Array([0, 255]) } };
assert.equal(api.serial(ticket), 1n << 90n);
assert.equal(api.label(ticket), "installed\\0🙂");
assert.deepEqual(api.echoRecord(bundle), bundle);
assert.deepEqual(api.echoOption({tag: "none"}), {tag: "none"});
assert.deepEqual(api.echoResult({ok: bundle}), {ok: bundle});
assert.deepEqual(api.echoResult({error: ticket}), {error: ticket});
const tree = {kind: "branch", children: [{kind: "leaf", ticket}, {kind: "branch", children: []}]};
assert.deepEqual(api.echoRecursive(tree), tree);
let borrowed, retained;
assert.deepEqual(api.callbackRecord(bundle, value => { borrowed = value.primary; retained = borrowed.retain(); return value; }), bundle);
assert.equal(borrowed.disposed, true);
assert.equal(api.serial(retained), 1n << 90n); retained.dispose();
const closure = api.dispatch(bundle);
assert.deepEqual(closure(value => value), bundle); closure.dispose();
const failure = new Error("installed callback");
assert.throws(() => api.callbackRecord(bundle, () => {throw failure;}), error => error === failure);
assert.equal(api.viaNat(value => value + 1n, 1n << 200n), (1n << 200n) + 1n);
assert.throws(() => api.serial({...ticket}), /resource/);
ticket.dispose();
assert.equal(ticket.disposed, true);
assert.throws(() => api.serial(ticket), /disposed/);
assert.equal(api.close(), true); assert.equal(api.close(), false);
console.log("installed owned API passed");
`;

const checkInstalled = async (scratch, componentRoot) => {
	const options = { componentRoot, runtimeRoot: prepared };
	const first = await buildOwnedJavaScriptNpmPackages({ ...options, outputRoot: join(scratch, "packages") });
	const second = await buildOwnedJavaScriptNpmPackages({ ...options, outputRoot: join(scratch, "repeated-packages") });
	for(const path of ["runtimeArchive", "componentArchive"])
		assert.deepEqual(await readFile(first[path]), await readFile(second[path]), path + " must reproduce byte for byte");
	const report = await readVerifiedPackageSetReceipt({ receiptPath: join(first.output, "package-set-receipt.json") });
	assert.deepEqual(report.result.profiles, ["javascript-wasm-owned-v1"]);
	const consumer = join(scratch, "consumer"), handoff = join(consumer, "handoff");
	await saveLakeFile(consumer, "package.json", '{"name":"owned-consumer","version":"1.0.0","private":true,"type":"module"}\n');
	for(const [path, filename] of [[first.runtimeArchive, "runtime.tgz"], [first.componentArchive, "component.tgz"]])
		await saveLakeFile(handoff, filename, await readFile(path));
	// Installation and execution cannot fall back to producer files or source.
	await rm(first.output, { recursive: true }); await rm(second.output, { recursive: true });
	await rm(componentRoot, { recursive: true });
	const run = (command, args) => processBuildRunner.capture({ command, args, cwd: consumer, timeoutMs: 120000 });
	await run("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "./handoff/runtime.tgz", "./handoff/component.tgz"]);
	await saveLakeFile(consumer, "consumer.mjs", installedSource(first.coordinate.name));
	assert.equal((await run(process.execPath, ["consumer.mjs"])).stdout, "installed owned API passed\n");
	await saveLakeFile(consumer, "consumer.mts", `import api from ${JSON.stringify(first.coordinate.name)};
const ticket = api.newTicket(1n, "typed");
const serial: bigint = api.serial(ticket);
const option = api.echoOption({tag: "some", value: ticket});
if(option.tag === "some") { const value: bigint = api.serial(option.value); void value; }
const result = api.viaNat(value => value + serial, 1n);
// @ts-expect-error Nat is bigint, not number.
api.newTicket(1, "invalid");
// @ts-expect-error A caller cannot forge the generated opaque resource.
api.serial({disposed: false});
// @ts-expect-error Option retains an explicit constructor tag.
api.echoOption(null);
ticket.dispose(); api.close(); void result;
`);
	await run(process.execPath, [resolve("node_modules/typescript/bin/tsc"), "--strict", "--noEmit", "--target", "ES2022", "--module", "NodeNext", "--moduleResolution", "NodeNext", "--skipLibCheck", "false", "consumer.mts"]);
	const browser = process.env.LEAN_BRIDGE_OWNED_JS_WASM_BROWSER_TEST === "1"
		? await checkOwnedJavaScriptBrowsers({ root: consumer, name: first.coordinate.name, run }) : null;
	return { archiveReproduction: true, installedNode: true
		, installedTypeScript: true
		, runtimeIdentity: first.runtimeIdentity, browser };
};

const rejectDrift = async root => {
	const inventory = JSON.parse(await readFile(join(root, "artifacts.json"), "utf8"));
	const receipt = JSON.parse(await readFile(join(root, "javascript-wasm-component.json"), "utf8"));
	const changedReceipt = mutate => { const value = structuredClone(receipt); mutate(value); return canonicalJson(value); };
	const changes = [
		["javascript-wasm-component.json", changedReceipt(value => { value.pointerBits = 64; })]
		, ["javascript-wasm-component.json", changedReceipt(value => { value.compiler.version = "emcc 3.1.68"; })]
		, ["javascript-wasm-component.json", changedReceipt(value => { value.ownedGraph.metadataHash = "0".repeat(64); })]
		, ["javascript-wasm-component.json", changedReceipt(value => { value.initializer += "_drift"; })]
		, ["javascript-wasm-component.json", changedReceipt(value => { value.targetHeaders["compiler/include/lean/lean.h"].sha256 = "0".repeat(64); })]
		, ["owned/component.c", "/* substituted source */\n"]
		, ["owned/lean_bridge_native_runtime.h", "/* substituted broker */\n"]
		, ["owned/allocation-guard.h", "/* removed allocation check */\n"]
		, ["component.h", "/* substituted carrier declarations */\n"]
		, ["generated.lean", "def substituted := 0\n"]
		, ["private-abi.json", "{}\n"]
		, ["lib/component.so.wasm", new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0])]
	];
	for(const [path, bytes] of changes)
	{
		const original = await readFile(join(root, path));
		try
		{
			await saveLakeFile(root, path, bytes);
			await saveLakeFile(root, "artifacts.json", canonicalJson({ ...inventory, files: { ...inventory.files
				, [path]: { bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) } } }));
			await assert.rejects(() => readVerifiedOwnedJavaScriptWasmComponent(root), undefined, path);
		}
		finally
		{ await saveLakeFile(root, path, original); await saveLakeFile(root, "artifacts.json", canonicalJson(inventory)); }
	}
	return changes.length;
};

for(const reviewed of [false, true]) test(`owned JavaScript ${reviewed ? "reviewed" : "ordinary"} compilation executes checked source in the production heap`, {
	skip: !enabled, timeout: 600000
}, async t => {
	const scratch = await mkdtemp(join(tmpdir(), "lean-owned-javascript-build-"));
	t.after(() => rm(scratch, { recursive: true, force: true }));
	const project = join(scratch, "source"), output = join(scratch, "compiled");
	await cp(resolve("tests/fixtures/onboarding/owned-dotnet-callables"), project, { recursive: true });
	if(reviewed)
	{
		await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["Owned"] }));
		await saveLakeFile(project, "reviewed.binding-ir.json", canonicalJson(ownedDotnetCallbacksReviewedIr()));
	}
	const before = await lakeInputState(project);
	const options = { projectRoot: project, outputRoot: output
		, leanPrefix: resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2")
		, leanRuntimeRoot: target
		, emsdkRoot: resolve(process.env.LEAN_WASM_EMSDK ?? ".toolchains/emsdk") };
	let built;
	try
	{ built = await buildOwnedJavaScriptWasmComponent(options); }
	catch(error)
	{ t.diagnostic(JSON.stringify(error.details ?? error.message)); throw error; }
	assert.deepEqual(await lakeInputState(project), before, "Compilation must not modify authored inputs");
	const verified = await readVerifiedOwnedJavaScriptWasmComponent(output);
	assert.deepEqual(verified.model, built.model); assert.deepEqual(verified.receipt, built.receipt);
	const rejected = await rejectDrift(output);
	// Relocate the verified output and remove author sources before loading it.
	const relocated = join(scratch, "relocated"); await cp(output, relocated, { recursive: true });
	await rm(project, { recursive: true }); await rm(output, { recursive: true });
	const retained = await readVerifiedOwnedJavaScriptWasmComponent(relocated);
	assert.equal(retained.identity, verified.identity);
	const createMain = (await import(pathToFileURL(join(prepared, "main.mjs")).href)).default;
	const module = await createMain();
	const loader = await createComponentRuntime(async () => module, pathToFileURL(join(prepared, "main.wasm")));
	const descriptor = { id: verified.model.component.id
		, buildHash: verified.identity
		, integrity: verified.receipt.wasmLibrary.sha256
		, initializer: verified.receipt.initializer
		, sideModule: pathToFileURL(join(relocated, verified.receipt.library))
		, bindingIr: verified.model.bindingIr
		, privateAbi: verified.privateAbi };
	const api = await loader.loadComponent(descriptor);
	// Generated public functions use the same loader, without exposing private entry points.
	const generated = generateJavaScriptPackage(verified.model.bindingIr);
	for(const [path, source] of Object.entries(generated)) await saveLakeFile(scratch, `public/${path}`, source);
	const key = `owned-build-${reviewed}-${sha256(scratch).slice(0, 16)}`;
	globalThis[key] = api;
	t.after(() => { delete globalThis[key]; });
	await saveLakeFile(scratch, "public/internal/runtime.mjs", `export const runtime = globalThis[${JSON.stringify(key)}];\n`);
	const publicApi = await import(pathToFileURL(join(scratch, "public/index.mjs")).href);
	const ticket = publicApi.newTicket(1n << 80n, "compiled\0🙂");
	assert.equal(publicApi.serial(ticket), 1n << 80n); assert.equal(publicApi.label(ticket), "compiled\0🙂");
	const bundle = { primary: ticket, spare: { tag: "none" }
		, peers: [ticket], history: [ticket]
		, payload: { count: -(1n << 180n), bytes: new Uint8Array([0, 255]) } };
	assert.deepEqual(publicApi.echoRecord(bundle), bundle);
	let borrowed;
	assert.deepEqual(publicApi.callbackRecord(bundle, value => { borrowed = value.primary; return value; }), bundle);
	assert.equal(borrowed.disposed, true);
	const dispatch = publicApi.dispatch(bundle);
	assert.deepEqual(dispatch(value => value), bundle); dispatch.dispose();
	const failure = new Error("compiled callback");
	assert.throws(() => publicApi.callbackRecord(bundle, () => { throw failure; }), error => error === failure);
	assert.deepEqual(publicApi.echoOption({ tag: "some", value: ticket }), { tag: "some", value: ticket });
	assert.equal(publicApi.viaNat(value => value + 1n, 1n << 120n), (1n << 120n) + 1n);
	ticket.dispose(); assert.equal(module._bridge_owned_runtime_identities(), 0);
	assert.equal(publicApi.close(), true); assert.equal(module._bridge_owned_runtime_components(), 0);
	assert.equal(module._bridge_lean_runtime_init_runs(), 1);
	assert.equal(module._bridge_lean_runtime_shutdown(), 1);
	let installed;
	try
	{ installed = await checkInstalled(scratch, relocated); }
	catch(error)
	{ t.diagnostic(JSON.stringify(error.details ?? error.message)); throw error; }
	t.diagnostic(JSON.stringify({ reviewed, rejected, installed, wasmBytes: verified.receipt.wasmLibrary.bytes, identity: verified.identity }));
});
