/**
 * Ownership admission and repository-free author CLI/npm handoffs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { usesOwnedJavaScript } from "../src/build/javascript-wasm-owned-project.mjs";
import { buildJavaScriptWasmCompilerInputs } from "../src/release/javascript-wasm-compiler-inputs.mjs";
import { buildCliNpmPackage } from "../src/release/cli-npm-package.mjs";
import { readVerifiedPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { ownedDotnetCallbacksReviewedIr } from "./helpers/owned-dotnet-callback-fixture.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";

const makeProject = async (root, reviewed) => {
	const project = join(root, reviewed ? "reviewed" : "ordinary");
	await cp("tests/fixtures/onboarding/owned-dotnet-callables", project, { recursive: true });
	const config = reviewed ? { schemaVersion: 1, modules: ["Owned"] }
		: JSON.parse(await readFile(join(project, "lean-bridge.exports.json"), "utf8"));
	config.targets = { npm: { name: `@owned/${reviewed ? "reviewed" : "ordinary"}`, version: "1.2.3" } };
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
	if(reviewed) await saveLakeFile(project, "reviewed.binding-ir.json", canonicalJson(ownedDotnetCallbacksReviewedIr()));
	return project;
};

for(const reviewed of [false, true]) test(`${reviewed ? "reviewed" : "ordinary"} owned npm dispatch preserves explicit tools and cache choices`, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-owned-javascript-cli-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const project = await makeProject(root, reviewed), before = await lakeInputState(project);
	assert.equal(await usesOwnedJavaScript(project), true);
	const options = { projectRoot: project, outputRoot: join(root, "output")
		, targets: ["npm"]
		, environment: { LEAN_BRIDGE_JS_EMSDK: join(root, "missing-sdk") } };
	await assert.rejects(buildCanonicalProject(options), { code: "javascript-wasm-toolchain-unavailable" });
	const unavailable = { capture: async () => { throw Object.assign(new Error("Unavailable test backend"), { code: "ENOENT" }); } };
	for(const backend of ["docker", "nix"])
		await assert.rejects(buildCanonicalProject({ ...options, runner: unavailable, environment: { ...options.environment, LEAN_BRIDGE_BUILD_BACKEND: backend } }), { code: `${backend}-unavailable` });
	await assert.rejects(buildCanonicalProject({ ...options, runner: unavailable, environment: { ...options.environment, LEAN_BRIDGE_BUILD_BACKEND: "typo" } }), { code: "invalid-build-backend" });
	await assert.rejects(buildCanonicalProject({ ...options, cache: { policy: "use", directory: join(root, "cache") } }), { code: "cache-directory-unsupported" });
	await assert.rejects(buildCanonicalProject({ ...options, cache: { policy: "typo" } }), { code: "invalid-cache-policy" });
	for(const backend of ["auto", "nix", "docker"])
	{
		const request = { ...options, environment: { ...options.environment, LEAN_BRIDGE_BUILD_BACKEND: backend }
			, runner: { capture: () => assert.fail("Invalid cache options reached a build tool") } };
		await assert.rejects(buildCanonicalProject({ ...request, cache: { policy: "use", directory: 42 } }), { code: "invalid-cache-directory" });
		await assert.rejects(buildCanonicalProject({ ...request, cache: { policy: "off", directory: join(root, "cache") } }), { code: "invalid-cache-policy" });
	}
	await assert.rejects(buildCanonicalProject({ ...options, targets: ["npm", "wit-wasi"] }), error => error.code === (reviewed ? "consumer-upgrade-required" : "unsupported-export-configuration"));
	assert.deepEqual(await lakeInputState(project), before);
	assert.deepEqual(await readdir(root), [reviewed ? "reviewed" : "ordinary"]);
});

test("installed CLI builds ordinary and reviewed owned npm packages from bundled headers", {
	skip: process.env.LEAN_BRIDGE_OWNED_JS_WASM_BUILD_TEST !== "1"
	, timeout: 1200000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-owned-javascript-installed-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const inputs = await buildJavaScriptWasmCompilerInputs({ outputRoot: join(root, "inputs")
		, leanRuntimeRoot: resolve(process.env.LEAN_BRIDGE_JS_TARGET_RUNTIME ?? "build/lean-runtime/f3b06c705e6c85f5314019d5d3baab0fec5b580c-743765bf566f43ec2f7b4eb84a85686880b3797efe83bf244d6fc7281e4f85a3-browser") });
	const candidate = await buildCliNpmPackage({ outputRoot: join(root, "candidate")
		, javascriptWasmInputsRoot: inputs.directory
		, runtimeRoot: resolve(process.env.LEAN_BRIDGE_OWNED_JS_WASM_PREPARED_ROOT ?? "build/lean-link-spike", "lazy") });
	assert.equal(candidate.report.javascriptWasmInputsIncluded, true);
	const author = join(root, "author");
	await saveLakeFile(author, "package.json", '{"name":"isolated-author","private":true,"version":"1.0.0"}\n');
	await saveLakeFile(author, "cli.tgz", await readFile(candidate.archive));
	await rm(candidate.output, { recursive: true }); await rm(inputs.output, { recursive: true });
	const environment = { ...process.env, LEAN_BRIDGE_BUILD_BACKEND: "auto"
		, LEAN_BRIDGE_LEAN_PREFIX: resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2")
		, LEAN_BRIDGE_JS_EMSDK: resolve(process.env.LEAN_BRIDGE_JS_EMSDK ?? ".toolchains/emsdk") };
	for(const key of ["LEAN_BRIDGE_RUNTIME_ROOT", "LEAN_BRIDGE_JS_INPUTS", "LEAN_BRIDGE_JS_TARGET_RUNTIME", "NODE_PATH", "NODE_OPTIONS"]) delete environment[key];
	const run = async (command, args, cwd = author, timeoutMs = 300000) => {
		try
		{ return await processBuildRunner.capture({ command, args, cwd, env: environment, timeoutMs }); }
		catch(error)
		{ t.diagnostic(JSON.stringify(error.details ?? error.message)); throw error; }
	};
	await run("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "./cli.tgz"]);
	const cli = join(author, "node_modules/.bin/lean-bridge"), reports = [];
	for(const reviewed of [false, true])
	{
		const project = await makeProject(root, reviewed), before = await lakeInputState(project);
		const output = join(root, reviewed ? "reviewed-release" : "ordinary-release");
		// Native C builds its pinned GMP dependency on a cold host. Keep the
		// longer bound specific to that combined compilation, not every command.
		const result = JSON.parse((await run(cli, ["build", "--project", project, "--target", "npm", ...(reviewed ? ["--target", "c"] : []), "--output", output, "--json"], author, reviewed ? 900000 : 300000)).stdout);
		assert.equal(result.status, "ok", JSON.stringify(result));
		if(reviewed)
		{
			assert.equal(result.result.kind, "lean-bridge-multi-profile-release");
			assert.deepEqual(result.result.profiles.map(item => item.profile).sort(), ["javascript-wasm-owned-v1", "native-library-v1"]);
		}
		else assert.equal(result.result.profile, "javascript-wasm-owned-v1");
		assert.deepEqual(await lakeInputState(project), before);
		const checked = await readVerifiedPackageSetReceipt({ receiptPath: join(output, "package-set-receipt.json") });
		const npm = checked.receipt.packages.filter(item => item.target === "npm");
		const component = npm.find(item => item.role === "component");
		assert.equal(component.name, `@owned/${reviewed ? "reviewed" : "ordinary"}`); assert.equal(component.version, "1.2.3");
		const consumer = join(root, reviewed ? "reviewed-consumer" : "ordinary-consumer");
		await saveLakeFile(consumer, "package.json", '{"name":"installed-consumer","version":"1.0.0","type":"module","private":true}\n');
		for(const [index, entry] of npm.entries()) await saveLakeFile(consumer, `handoff/${index}.tgz`, await readFile(join(output, entry.artifacts[0].path)));
		await rm(project, { recursive: true }); await rm(output, { recursive: true });
		await run("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "./handoff/0.tgz", "./handoff/1.tgz"], consumer);
		await saveLakeFile(consumer, "call.mjs", `import assert from "node:assert/strict";
import api from ${JSON.stringify(component.name)};
const ticket=api.newTicket(1n<<100n,"CLI\\0🙂");
const bundle={primary:ticket,spare:{tag:"some",value:ticket},peers:[ticket],history:[ticket],payload:{count:-(1n<<160n),bytes:new Uint8Array([0,255])}};
assert.equal(api.serial(ticket),1n<<100n);assert.equal(api.label(ticket),"CLI\\0🙂");
assert.deepEqual(api.echoRecord(bundle),bundle);assert.deepEqual(api.echoOption({tag:"none"}),{tag:"none"});
let borrowed;assert.deepEqual(api.callbackRecord(bundle,value=>{borrowed=value.primary;return value;}),bundle);assert.equal(borrowed.disposed,true);
const closure=api.dispatch(bundle);assert.deepEqual(closure(value=>value),bundle);closure.dispose();
const failure=new Error("installed CLI callback");assert.throws(()=>api.callbackRecord(bundle,()=>{throw failure;}),error=>error===failure);
ticket.dispose();assert.equal(api.close(),true);console.log("installed CLI consumer passed");
`);
		assert.equal((await run(process.execPath, ["call.mjs"], consumer)).stdout, "installed CLI consumer passed\n");
		reports.push({ reviewed, component: component.name, sourceRemoved: true, installedCli: true, installedConsumer: true, combinedNative: reviewed });
	}
	t.diagnostic(JSON.stringify({ compilerInputsIdentity: inputs.identity, reports }));
});
