/**
 * Installed author CLI and source-free consuming npm packages in every JS host.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildJavaScriptWasmCompilerInputs } from "../src/release/javascript-wasm-compiler-inputs.mjs";
import { buildCliNpmPackage } from "../src/release/cli-npm-package.mjs";
import { readVerifiedPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { buildOwnedJavaScriptNpmPackages } from "../src/release/owned-javascript-npm-package.mjs";
import { readVerifiedOwnedJavaScriptWasmComponent } from "../src/build/javascript-wasm-owned-artifacts.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { ownedRustTransferConfiguration, ownedRustTransferReviewedIr, ownedRustTransferSource } from "./helpers/owned-rust-transfer-fixture.mjs";
import { saveLakeFile, lakeInputState } from "./helpers/lake-workspace.mjs";
import { checkOwnedJavaScriptBrowsers } from "./helpers/owned-javascript-npm-browser.mjs";

const installedInventory = async (root, prefix = "") => {
	const result = {};
	for(const entry of (await readdir(join(root, prefix), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name)))
	{
		const path = prefix + entry.name;
		if(entry.isDirectory()) Object.assign(result, await installedInventory(root, path + "/"));
		else
		{
			assert.ok(entry.isFile(), path);
			const bytes = await readFile(join(root, path));
			result[path] = { bytes: bytes.length, sha256: sha256(bytes) };
		}
	}
	return result;
};

const rejectTransferDrift = async root => {
	const inventory = JSON.parse(await readFile(join(root, "artifacts.json"), "utf8"));
	const receipt = JSON.parse(await readFile(join(root, "javascript-wasm-component.json"), "utf8"));
	const changes = [];
	for(const mutate of [
		value => { delete value.ownedGraph.inputTransfers; }
		, value => { value.ownedGraph.inputTransfers.ownership = "one-wrapper"; }
		, value => { value.ownedGraph.inputTransfers.exports.pop(); }
		, value => { value.ownedGraph.inputTransfers.consumption = "after-lean-call"; }
	]) {
		const changed = structuredClone(receipt); mutate(changed);
		changes.push(["javascript-wasm-component.json", canonicalJson(changed)]);
	}
	for(const path of Object.keys(receipt.ownedGraph.files)) changes.push([path, (await readFile(join(root, path), "utf8")) + "\n/* altered generated source */\n"]);
	for(const [path, source] of changes)
	{
		const original = await readFile(join(root, path));
		try
		{
			await saveLakeFile(root, path, source);
			await saveLakeFile(root, "artifacts.json", canonicalJson({ ...inventory, files: { ...inventory.files
				, [path]: { bytes: Buffer.byteLength(source), sha256: sha256(source) } } }));
			await assert.rejects(readVerifiedOwnedJavaScriptWasmComponent(root), undefined, path);
		}
		finally
		{ await saveLakeFile(root, path, original); await saveLakeFile(root, "artifacts.json", canonicalJson(inventory)); }
	}
	return changes.length;
};

test("installed CLI ships consuming npm packages for Node, TypeScript, browsers, React and workers", {
	skip: process.env.LEAN_BRIDGE_OWNED_JS_TRANSFER_TEST !== "1", timeout: 1500000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-owned-js-transfer-installed-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const inputs = await buildJavaScriptWasmCompilerInputs({ outputRoot: join(root, "inputs")
		, leanRuntimeRoot: resolve(process.env.LEAN_BRIDGE_JS_TARGET_RUNTIME ?? "build/lean-runtime/f3b06c705e6c85f5314019d5d3baab0fec5b580c-743765bf566f43ec2f7b4eb84a85686880b3797efe83bf244d6fc7281e4f85a3-browser") });
	const candidate = await buildCliNpmPackage({ outputRoot: join(root, "candidate")
		, javascriptWasmInputsRoot: inputs.directory
		, runtimeRoot: resolve(process.env.LEAN_BRIDGE_OWNED_JS_WASM_PREPARED_ROOT ?? "build/lean-link-spike", "lazy") });
	assert.equal(candidate.report.javascriptWasmInputsIncluded, true);
	const author = join(root, "author");
	await saveLakeFile(author, "package.json", '{"name":"isolated-transfer-author","private":true,"version":"1.0.0"}\n');
	await saveLakeFile(author, "cli.tgz", await readFile(candidate.archive));
	await rm(candidate.output, { recursive: true }); await rm(inputs.output, { recursive: true });
	const environment = { ...process.env, LEAN_BRIDGE_BUILD_BACKEND: "auto"
		, LEAN_BRIDGE_LEAN_PREFIX: resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2")
		, LEAN_BRIDGE_JS_EMSDK: resolve(process.env.LEAN_BRIDGE_JS_EMSDK ?? ".toolchains/emsdk") };
	for(const key of ["LEAN_BRIDGE_RUNTIME_ROOT", "LEAN_BRIDGE_JS_INPUTS", "LEAN_BRIDGE_JS_TARGET_RUNTIME", "NODE_PATH", "NODE_OPTIONS"]) delete environment[key];
	const run = (command, args, cwd = author, timeoutMs = 900000) => processBuildRunner.capture({ command, args, cwd, env: environment, timeoutMs })
		.catch(error => { t.diagnostic(JSON.stringify(error.details ?? error.message)); throw error; });
	await run("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "./cli.tgz"]);
	const cli = join(author, "node_modules/.bin/lean-bridge"), reports = [];
	const probe = await readFile("tests/fixtures/structured-types/owned-installed-javascript-transfers.mjs", "utf8");
	const docs = (await readFile("docs/javascript-typescript.md", "utf8")).split("### Consuming inputs\n")[1].split("### Type conversions\n")[0];
	const example = docs.match(/```js\n([^]*?)\n```/u)[1];
	for(const reviewed of [false, true])
	{
		const project = join(root, reviewed ? "reviewed" : "ordinary"), output = join(root, reviewed ? "reviewed-release" : "ordinary-release");
		await cp("tests/fixtures/onboarding/owned-aggregates", project, { recursive: true });
		await saveLakeFile(project, "Owned.lean", (await readFile(join(project, "Owned.lean"), "utf8")) + ownedRustTransferSource);
		const config = reviewed ? { schemaVersion: 1, modules: ["Owned"] } : await ownedRustTransferConfiguration();
		config.targets = { npm: { name: `@owned/${reviewed ? "reviewed" : "ordinary"}-transfers`, version: "1.2.3" } };
		await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
		if(reviewed) await saveLakeFile(project, "reviewed.binding-ir.json", canonicalJson(ownedRustTransferReviewedIr()));
		const before = await lakeInputState(project);
		const result = JSON.parse((await run(cli, ["build", "--project", project, "--target", "npm", ...(reviewed ? ["--target", "c"] : []), "--output", output, "--json"])).stdout);
		assert.equal(result.status, "ok", JSON.stringify(result));
		assert.deepEqual(await lakeInputState(project), before);
		const checked = await readVerifiedPackageSetReceipt({ receiptPath: join(output, "package-set-receipt.json") });
		const npm = checked.receipt.packages.filter(item => item.target === "npm"), component = npm.find(item => item.role === "component");
		assert.equal(npm.length, 2);
		assert.equal(checked.receipt.packages.some(item => item.target === "c"), reviewed);
		const componentRoot = join(output, reviewed ? "profiles/wasm/javascript-wasm/component" : "javascript-wasm/component");
		const verified = await readVerifiedOwnedJavaScriptWasmComponent(componentRoot);
		assert.equal(verified.model.schemaVersion, 8); assert.equal(verified.privateAbi.version, 11);
		if(reviewed)
		{
			const native = JSON.parse(await readFile(join(output, "profiles/native/native/component/model.json"), "utf8"));
			assert.equal(native.schemaVersion, 8); assert.equal(native.pointerBits, 64);
			assert.deepEqual(native.ownedGraph.inputTransfers, verified.model.ownedGraph.inputTransfers);
		}
		const rejected = await rejectTransferDrift(componentRoot);
		const repackaged = await buildOwnedJavaScriptNpmPackages({ componentRoot
			, runtimeRoot: resolve(process.env.LEAN_BRIDGE_OWNED_JS_WASM_PREPARED_ROOT ?? "build/lean-link-spike", "lazy")
			, outputRoot: join(root, reviewed ? "reviewed-repackaged" : "ordinary-repackaged") });
		for(const item of npm) assert.deepEqual(await readFile(join(output, item.artifacts[0].path))
			, await readFile(item.role === "component" ? repackaged.componentArchive : repackaged.runtimeArchive));
		await rm(repackaged.output, { recursive: true });
		const consumer = join(root, reviewed ? "reviewed-consumer" : "ordinary-consumer");
		await saveLakeFile(consumer, "package.json", '{"name":"installed-transfer-consumer","version":"1.0.0","type":"module","private":true}\n');
		const packages = [];
		for(const [index, entry] of npm.entries())
		{
			const bytes = await readFile(join(output, entry.artifacts[0].path));
			await saveLakeFile(consumer, `handoff/${index}.tgz`, bytes);
			packages.push({ name: entry.name, role: entry.role, bytes: bytes.length, sha256: sha256(bytes) });
		}
		await rm(project, { recursive: true }); await rm(output, { recursive: true });
		const consume = (command, args) => run(command, args, consumer, 180000);
		await consume("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "./handoff/0.tgz", "./handoff/1.tgz"]);
		await rm(join(consumer, "handoff"), { recursive: true });
		const inventory = await installedInventory(join(consumer, "node_modules"));
		assert.ok(Object.keys(inventory).length > 50);
		await saveLakeFile(consumer, "probe.mjs", probe);
		await saveLakeFile(consumer, "call.mjs", `import api from ${JSON.stringify(component.name)};\nimport {runTransfers} from "./probe.mjs";\nconsole.log(JSON.stringify(runTransfers(api)));\nif(!api.close() || api.close()) throw new Error("Component close failed");\n`);
		const observed = JSON.parse((await consume(process.execPath, ["call.mjs"])).stdout);
		assert.equal(observed.exports, 26); assert.equal(observed.checks, 130);
		assert.equal(observed.transferredInputs, true);
		await saveLakeFile(consumer, "docs.mjs", `import api from ${JSON.stringify(component.name)};\n${example}\napi.close();\n`);
		const documentation = (await consume(process.execPath, ["docs.mjs"])).stdout;
		assert.equal(documentation, "true\n42n\n42n\n");
		await saveLakeFile(consumer, "consumer.mts", `import api, {type Bundle} from ${JSON.stringify(component.name)};
const ticket = api.newTicket(42n, "typed");
const input: Bundle = {primary:ticket,spare:{tag:"none"},peers:[ticket],history:[],payload:{count:0n,bytes:new Uint8Array()}};
const result: Bundle = api.echoRecord(input);
api.callbackRecord(result, value => value);
const closure = api.newRecordCallback();
const moved = api.transferCallback(closure);
moved.retain().dispose(); moved.dispose();
// @ts-expect-error Consuming callbacks require a returned Lean lease.
api.transferCallback((value: Bundle) => value);
// @ts-expect-error Opaque resources cannot be constructed from lifecycle methods.
api.retainTicket({disposed:false,dispose:()=>true,retain:()=>ticket});
// @ts-expect-error Nat does not accept Number.
api.newTicket(42, "wrong");
api.close();
`);
		await consume(process.execPath, [resolve("node_modules/typescript/bin/tsc"), "--strict", "--noEmit", "--target", "ES2022", "--module", "NodeNext", "--moduleResolution", "NodeNext", "--skipLibCheck", "false", "consumer.mts"]);
		const browser = await checkOwnedJavaScriptBrowsers({
			root: consumer, name: component.name, run: consume
			, probeSource: `import api from ${JSON.stringify(component.name)};\n${probe}\nexport const run = () => runTransfers(api);\nexport const close = () => api.close();\n`
			, expected: observed });
		reports.push({ reviewed, sourceRemovedBeforeInstall: true
			, installedCli: true, installedTypeScript: true
			, combinedNative: reviewed, deterministicReassembly: true, rejected
			, receipt: verified.receipt, model: verified.model, inventory
			, packages, observed, browser
			, documentation: { sourceSha256: sha256(example), output: documentation } });
	}
	const report = { schemaVersion: 1, profile: "installed-owned-javascript-transfers", compilerInputsIdentity: inputs.identity, reports };
	await saveLakeFile("build/owned-javascript-transfer-packaging", "report.json", canonicalJson(report));
	t.diagnostic(JSON.stringify(report));
});
