/**
 * Exercise public owned npm builds with a real engine behind an injected Nix transport.
 * The transport injection does not claim actual Nix or Docker isolation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { executeComponentEngineRequest } from "../src/build/component-engine.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { readVerifiedPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { ownedAnalysisFixture } from "./helpers/owned-analysis.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";

for(const reviewed of [false, true]) test(`public ${reviewed ? "reviewed" : "ordinary"} owned npm build routes explicit Nix requests through the engine`, {
	skip: process.env.LEAN_BRIDGE_OWNED_JS_WASM_BUILD_TEST !== "1", timeout: 600000
}, async t => {
	const { root, directory } = await ownedAnalysisFixture(t, reviewed);
	const before = await lakeInputState(root), invocations = [];
	const compilerEnvironment = { ...process.env
		, LEAN_BRIDGE_LEAN_PREFIX: resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2")
		, LEAN_BRIDGE_JS_EMSDK: resolve(process.env.LEAN_BRIDGE_JS_EMSDK ?? ".toolchains/emsdk")
		, LEAN_BRIDGE_JS_TARGET_RUNTIME: resolve(process.env.LEAN_BRIDGE_JS_TARGET_RUNTIME ?? "build/lean-runtime/f3b06c705e6c85f5314019d5d3baab0fec5b580c-743765bf566f43ec2f7b4eb84a85686880b3797efe83bf244d6fc7281e4f85a3-browser") };
	const runner = { capture: async request => {
		if(request.command === "unavailable-docker") throw Object.assign(new Error("Test Docker is unavailable"), { code: "ENOENT" });
		assert.equal(request.command, "test-nix");
		if(request.args[0] === "--version") return { stdout: "nix (Nix) 2.24.11", stderr: "", code: 0 };
		const arg = key => request.args[request.args.indexOf(key) + 1];
		const document = JSON.parse(await readFile(arg("--request"), "utf8"));
		assert.equal(document.schemaVersion, 4); assert.equal(document.cache.policy, "refresh");
		assert.ok(request.args.includes("--refresh"));
		invocations.push(document);
		await executeComponentEngineRequest({ requestPath: arg("--request")
			, inputRoot: arg("--component"), outputRoot: arg("--output")
			, engineRoot: arg("--engine"), backend: arg("--backend")
			, environment: compilerEnvironment, signal: request.signal
			, runner: { capture: invocation => processBuildRunner.capture(invocation).catch(error => { t.diagnostic(JSON.stringify(error.details)); throw error; }) } });
		return { stdout: "", stderr: "", code: 0 };
	} };
	const output = join(directory, "release");
	const result = await buildCanonicalProject({ projectRoot: root
		, outputRoot: output
		, targets: ["npm"], cache: { policy: "refresh", directory: null }, runner
		, environment: { ...process.env, LEAN_BRIDGE_BUILD_BACKEND: "nix"
			, LEAN_BRIDGE_NIX: "test-nix", LEAN_BRIDGE_DOCKER: "unavailable-docker"
			, LEAN_BRIDGE_LEAN_PREFIX: "/absent/author-lean"
			, LEAN_BRIDGE_JS_EMSDK: "/absent/author-emsdk"
			, LEAN_BRIDGE_JS_INPUTS: "/absent/author-headers"
			, LEAN_BRIDGE_RUNTIME_ROOT: resolve(process.env.LEAN_BRIDGE_OWNED_JS_WASM_PREPARED_ROOT ?? "build/lean-link-spike", "lazy") } });
	assert.equal(invocations.length, 1); assert.equal(result.backend, "native-nix");
	assert.equal(result.engineRequest, "javascript-wasm/engine-execution-request.json");
	assert.deepEqual(JSON.parse(await readFile(join(output, result.engineRequest), "utf8")), invocations[0]);
	const report = JSON.parse(await readFile(join(output, result.engineReport), "utf8"));
	assert.equal(report.backend, "native-nix"); assert.equal(report.runtimeBinaryIncluded, false);
	const receipt = await readVerifiedPackageSetReceipt({ receiptPath: join(output, result.packageSet) });
	assert.deepEqual(receipt.result.profiles, ["javascript-wasm-owned-v1"]);
	assert.deepEqual(await lakeInputState(root), before);
	const consumer = join(directory, "consumer");
	await saveLakeFile(consumer, "package.json", '{"name":"owned-engine-consumer","version":"1.0.0","private":true,"type":"module"}\n');
	const archives = [];
	for(const item of receipt.receipt.packages.flatMap(pkg => pkg.artifacts))
	{
		const path = item.path;
		archives.push(`./${path}`);
		await saveLakeFile(consumer, path, await readFile(join(output, "packages/npm", path)));
	}
	const packageName = receipt.receipt.packages.find(item => item.role === "component").name;
	await rm(root, { recursive: true }); await rm(output, { recursive: true });
	const run = (command, args) => processBuildRunner.capture({ command, args, cwd: consumer, timeoutMs: 120000 });
	await run("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", ...archives]);
	await saveLakeFile(consumer, "call.mjs", `import assert from "node:assert/strict";
import api from ${JSON.stringify(packageName)};
const resource=api.newTicket(1n<<120n,"engine\\0🙂");
const value={primary:resource,spare:{tag:"none"},peers:[resource],history:[resource],payload:{count:-(1n<<150n),bytes:new Uint8Array([0,255])}};
assert.deepEqual(api.echoRecord(value),value);
let borrowed;assert.deepEqual(api.callbackRecord(value,input=>{borrowed=input.primary;return input;}),value);assert.equal(borrowed.disposed,true);
const callback=api.dispatch(value);assert.deepEqual(callback(input=>input),value);callback.dispose();
resource.dispose();assert.equal(api.close(),true);console.log("owned engine consumer passed");
`);
	assert.equal((await run(process.execPath, ["call.mjs"])).stdout, "owned engine consumer passed\n");
	t.diagnostic(JSON.stringify({ reviewed, engineInvocations: 1
		, ignoredHostSdk: true, installedNode: true, producerRemoved: true
		, requestSchema: 4, injectedTransport: true, nixIsolation: false }));
});
