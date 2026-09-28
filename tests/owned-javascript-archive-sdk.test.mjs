/**
 * Execute owned npm packages compiled with an archive-shaped immutable SDK.
 * This checks SDK admission, not Nix or Docker isolation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, lstat, readFile, rm, symlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson } from "../src/capsule/node.mjs";
import { buildOwnedJavaScriptWasmComponent } from "../src/build/javascript-wasm-owned-component.mjs";
import { readVerifiedOwnedJavaScriptWasmComponent } from "../src/build/javascript-wasm-owned-artifacts.mjs";
import { buildOwnedJavaScriptNpmPackages } from "../src/release/owned-javascript-npm-package.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { ownedAnalysisFixture } from "./helpers/owned-analysis.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";

const archive = { schemaVersion: 1, kind: "emscripten-release-archive"
	, version: "6.0.6"
	, release: "833aa203ba2283fc2b6adb504a79a3a0d692df81"
	, sha256: "sha256-bLfPRa2FsLm0ZqRMxLtl7zgOR/BAznPm+Va954J4f0Y=" };
const marker = JSON.stringify(JSON.parse(canonicalJson(archive))) + "\n";
const target = "build/lean-runtime/f3b06c705e6c85f5314019d5d3baab0fec5b580c-743765bf566f43ec2f7b4eb84a85686880b3797efe83bf244d6fc7281e4f85a3-browser";

for(const reviewed of [false, true]) test(`${reviewed ? "reviewed" : "ordinary"} owned npm compilation accepts a pinned archive SDK without inventing Git provenance`, {
	skip: process.env.LEAN_BRIDGE_OWNED_JS_WASM_BUILD_TEST !== "1", timeout: 600000
}, async t => {
	const { directory, root } = await ownedAnalysisFixture(t, reviewed);
	const sdk = join(directory, "immutable-sdk"), originalSdk = resolve(".toolchains/emsdk");
	await saveLakeFile(sdk, "lean-bridge-toolchain.json", marker);
	await cp(join(originalSdk, ".emscripten"), join(sdk, ".emscripten"));
	await symlink(join(originalSdk, "upstream"), join(sdk, "upstream"));
	await symlink(join(originalSdk, "node"), join(sdk, "node"));
	const before = await lakeInputState(root), calls = [];
	const componentRoot = join(directory, "component");
	const built = await buildOwnedJavaScriptWasmComponent({ projectRoot: root
		, outputRoot: componentRoot
		, leanPrefix: resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2")
		, leanRuntimeRoot: resolve(process.env.LEAN_BRIDGE_JS_TARGET_RUNTIME ?? target)
		, emsdkRoot: sdk
		, runner: { capture: request => {
			calls.push(request);
			return processBuildRunner.capture(request).catch(error => { t.diagnostic(JSON.stringify(error.details)); throw error; });
		} }
	});
	assert.deepEqual(await lakeInputState(root), before);
	assert.equal(await readFile(join(sdk, "lean-bridge-toolchain.json"), "utf8"), marker);
	assert.equal(await lstat(join(sdk, ".git")).catch(error => { assert.equal(error.code, "ENOENT"); return null; }), null);
	assert.equal(calls.some(call => call.command === "git" && call.args.includes(sdk)), false);
	const verified = await readVerifiedOwnedJavaScriptWasmComponent(componentRoot);
	assert.deepEqual(verified.model, built.model); assert.equal(verified.model.exports.length, 51);
	assert.deepEqual(verified.receipt.compiler.releaseArchive, archive);
	assert.equal(Object.hasOwn(verified.receipt.compiler, "emsdkCommit"), false);
	const packaged = await buildOwnedJavaScriptNpmPackages({ componentRoot
		, runtimeRoot: resolve(process.env.LEAN_BRIDGE_OWNED_JS_WASM_PREPARED_ROOT ?? "build/lean-link-spike", "lazy")
		, outputRoot: join(directory, "packages") });
	const consumer = join(directory, "consumer");
	await saveLakeFile(consumer, "package.json", '{"name":"archive-sdk-consumer","version":"1.0.0","type":"module","private":true}\n');
	await saveLakeFile(consumer, "runtime.tgz", await readFile(packaged.runtimeArchive));
	await saveLakeFile(consumer, "component.tgz", await readFile(packaged.componentArchive));
	await rm(root, { recursive: true }); await rm(componentRoot, { recursive: true });
	await rm(packaged.output, { recursive: true }); await rm(sdk, { recursive: true });
	const run = (command, args) => processBuildRunner.capture({ command, args, cwd: consumer, timeoutMs: 120000 });
	await run("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "./runtime.tgz", "./component.tgz"]);
	await saveLakeFile(consumer, "call.mjs", `import assert from "node:assert/strict";
import api from ${JSON.stringify(packaged.coordinate.name)};
const owner=api.newTicket(1n<<110n,"archive\\0🙂");
const value={primary:owner,spare:{tag:"none"},peers:[owner],history:[owner],payload:{count:-(1n<<170n),bytes:new Uint8Array([0,255])}};
assert.equal(api.serial(owner),1n<<110n); assert.equal(api.label(owner),"archive\\0🙂");
assert.deepEqual(api.echoRecord(value),value);
let borrowed; assert.deepEqual(api.callbackRecord(value,input=>{borrowed=input.primary;return input;}),value);
assert.equal(borrowed.disposed,true);
const closure=api.dispatch(value); assert.deepEqual(closure(input=>input),value); closure.dispose();
const failure=new Error("archive callback"); assert.throws(()=>api.callbackRecord(value,()=>{throw failure;}),error=>error===failure);
owner.dispose(); assert.equal(api.close(),true); console.log("archive SDK installed API passed");
`);
	assert.equal((await run(process.execPath, ["call.mjs"])).stdout, "archive SDK installed API passed\n");
	t.diagnostic(JSON.stringify({ reviewed, exports: 51, sourceUnchanged: true
		, sdkGitQueries: 0, installedNode: true, producerRemoved: true
		, nixIsolation: false
		, compiler: verified.receipt.compiler.version, releaseArchive: archive }));
});
