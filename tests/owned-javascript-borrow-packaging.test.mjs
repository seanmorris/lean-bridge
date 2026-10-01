/**
 * Installed CLI, original npm archives and source-free borrowed-result callers.
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
import { ownedRustBorrowConfiguration, ownedRustBorrowReviewedIr, ownedRustBorrowSource } from "./helpers/owned-rust-borrow-fixture.mjs";
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
			assert.ok(entry.isFile(), path); const bytes = await readFile(join(root, path));
			result[path] = { bytes: bytes.length, sha256: sha256(bytes) };
		}
	}
	return result;
};

const rejectDrift = async root => {
	const inventory = JSON.parse(await readFile(join(root, "artifacts.json"), "utf8"));
	const receipt = JSON.parse(await readFile(join(root, "javascript-wasm-component.json"), "utf8"));
	const changes = [];
	for(const mutate of [
		value => { delete value.ownedGraph.resultAnchors; }
		, value => { value.ownedGraph.resultAnchors.anchor = "snapshot"; }
		, value => { value.ownedGraph.resultAnchors.expiration = "never"; }
		, value => { value.ownedGraph.resultAnchors.exports.pop(); }
		, value => { value.ownedGraph.resultAnchors.exports[0].parameter++; }
		, value => { delete value.ownedGraph.inputTransfers; }
	]) {
		const changed = structuredClone(receipt); mutate(changed);
		changes.push(["javascript-wasm-component.json", canonicalJson(changed)]);
	}
	for(const path of Object.keys(receipt.ownedGraph.files)) changes.push([path, (await readFile(join(root, path), "utf8")) + "\n/* source drift */\n"]);
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

test("installed borrowed-result archives execute in Node, TypeScript and all browser contexts", {
	skip: process.env.LEAN_BRIDGE_OWNED_JS_BORROW_TEST !== "1", timeout: 1800000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-owned-js-borrow-installed-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const runtimeRoot = resolve(process.env.LEAN_BRIDGE_OWNED_JS_WASM_PREPARED_ROOT ?? "build/lean-link-spike", "lazy");
	const inputs = await buildJavaScriptWasmCompilerInputs({ outputRoot: join(root, "inputs")
		, leanRuntimeRoot: resolve(process.env.LEAN_BRIDGE_JS_TARGET_RUNTIME ?? "build/lean-runtime/f3b06c705e6c85f5314019d5d3baab0fec5b580c-743765bf566f43ec2f7b4eb84a85686880b3797efe83bf244d6fc7281e4f85a3-browser") });
	const candidate = await buildCliNpmPackage({ outputRoot: join(root, "candidate"), javascriptWasmInputsRoot: inputs.directory, runtimeRoot });
	assert.equal(candidate.report.javascriptWasmInputsIncluded, true);
	const author = join(root, "author");
	await saveLakeFile(author, "package.json", '{"name":"isolated-borrow-author","private":true,"version":"1.0.0"}\n');
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
	const probe = await readFile("tests/fixtures/structured-types/owned-installed-javascript-borrows.mjs", "utf8");
	const docs = (await readFile("docs/javascript-typescript.md", "utf8")).split("### Borrowed results and whole-value owners\n")[1].split("### Consuming inputs\n")[0];
	const example = docs.match(/```js\n([^]*?)\n```/u)[1];
	for(const reviewed of [false, true])
	{
		const mode = reviewed ? "reviewed" : "ordinary";
		t.diagnostic(`${mode}: installed CLI builds original borrowed-result archives`);
		const project = join(root, mode), output = join(root, mode + "-release");
		await cp("tests/fixtures/onboarding/owned-aggregates", project, { recursive: true });
		await saveLakeFile(project, "Owned.lean", (await readFile(join(project, "Owned.lean"), "utf8")) + ownedRustBorrowSource);
		const config = reviewed ? { schemaVersion: 1, modules: ["Owned"] } : await ownedRustBorrowConfiguration();
		config.targets = { npm: { name: `@owned/${mode}-borrows`, version: "1.2.3" } };
		await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
		if(reviewed) await saveLakeFile(project, "reviewed.binding-ir.json", canonicalJson(ownedRustBorrowReviewedIr()));
		const before = await lakeInputState(project);
		const build = async destination => {
			const result = JSON.parse((await run(cli, ["build", "--project", project, "--target", "npm", ...reviewed ? ["--target", "c"] : [], "--output", destination, "--json"])).stdout);
			assert.equal(result.status, "ok", JSON.stringify(result));
			assert.deepEqual(await lakeInputState(project), before);
			return readVerifiedPackageSetReceipt({ receiptPath: join(destination, "package-set-receipt.json") });
		};
		const checked = await build(output);
		const npm = checked.receipt.packages.filter(item => item.target === "npm"), component = npm.find(item => item.role === "component");
		assert.equal(npm.length, 2); assert.equal(checked.receipt.packages.some(item => item.target === "c"), reviewed);
		const componentRoot = join(output, reviewed ? "profiles/wasm/javascript-wasm/component" : "javascript-wasm/component");
		const verified = await readVerifiedOwnedJavaScriptWasmComponent(componentRoot);
		assert.equal(verified.model.schemaVersion, 9); assert.equal(verified.privateAbi.version, 12);
		assert.equal(verified.model.ownedGraph.resultAnchors.exports.length, 19);
		if(reviewed)
		{
			const native = JSON.parse(await readFile(join(output, "profiles/native/native/component/model.json"), "utf8"));
			assert.equal(native.schemaVersion, 9); assert.equal(native.pointerBits, 64);
			assert.deepEqual(native.ownedGraph.resultAnchors, verified.model.ownedGraph.resultAnchors);
		}
		const input = { metadata: JSON.parse(await readFile(join(componentRoot, "metadata.json"), "utf8"))
			, sourceIdentity: verified.receipt.sourceIdentity
			, component: verified.model.component };
		const rejected = await rejectDrift(componentRoot);
		const repackaged = await buildOwnedJavaScriptNpmPackages({ componentRoot, runtimeRoot, outputRoot: join(root, mode + "-repackaged") });
		for(const item of npm) assert.deepEqual(await readFile(join(output, item.artifacts[0].path)), await readFile(item.role === "component" ? repackaged.componentArchive : repackaged.runtimeArchive));
		await rm(repackaged.output, { recursive: true });
		const repeated = join(root, mode + "-repeat"); await build(repeated);
		for(const item of npm) assert.deepEqual(await readFile(join(output, item.artifacts[0].path)), await readFile(join(repeated, item.artifacts[0].path)));
		await rm(repeated, { recursive: true });
		const consumer = join(root, mode + "-consumer");
		await saveLakeFile(consumer, "package.json", '{"name":"installed-borrow-consumer","version":"1.0.0","type":"module","private":true}\n');
		const packages = [];
		for(const [index, entry] of npm.entries())
		{
			const bytes = await readFile(join(output, entry.artifacts[0].path)); await saveLakeFile(consumer, `handoff/${index}.tgz`, bytes);
			packages.push({ name: entry.name, role: entry.role, bytes: bytes.length, sha256: sha256(bytes) });
		}
		await rm(project, { recursive: true }); await rm(output, { recursive: true });
		const consume = (command, args) => run(command, args, consumer, 180000);
		await consume("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "./handoff/0.tgz", "./handoff/1.tgz"]);
		await rm(join(consumer, "handoff"), { recursive: true });
		const inventory = await installedInventory(join(consumer, "node_modules"));
		assert.ok(Object.keys(inventory).length > 50);
		await saveLakeFile(consumer, "probe.mjs", probe);
		await saveLakeFile(consumer, "call.mjs", `import api from ${JSON.stringify(component.name)};\nimport { runBorrows } from "./probe.mjs";\nconsole.log(JSON.stringify(runBorrows(api)));\nif(!api.close() || api.close()) throw new Error("Component close failed");\n`);
		const observed = JSON.parse((await consume(process.execPath, ["call.mjs"])).stdout);
		assert.equal(observed.exports, 26); assert.ok(observed.checks >= 200); assert.equal(observed.borrowedResults, true);
		await saveLakeFile(consumer, "docs.mjs", `import api from ${JSON.stringify(component.name)};\n${example}\napi.close();\n`);
		const documentation = (await consume(process.execPath, ["docs.mjs"])).stdout;
		assert.equal(documentation, "42n\nexpired\n42n\n");
		await saveLakeFile(consumer, "consumer.mts", `import api, { type LeanValue, type Ticket, type Bundle } from ${JSON.stringify(component.name)};
const root: LeanValue<Ticket> = api.newTicket(42n, "typed");
const borrowed: LeanValue<Ticket> = api.retainTicket(root);
const array = api.copyValue([root.get()], { resultOf: "echoArray" });
const record: LeanValue<Bundle> = api.copyValue({primary:root.get(),spare:{tag:"none"},peers:[],history:[],payload:{count:0n,bytes:new Uint8Array()}}, {resultOf:"echoRecord"});
api.callbackRecord(record, value => value).dispose();
api.moveArray(array).dispose();
// @ts-expect-error Borrow anchors require whole owners.
api.retainTicket(root.get());
// @ts-expect-error Whole roots cannot be forged from lifecycle methods.
const forged: LeanValue<Ticket> = {get:()=>root.get(),share:()=>root,retain:()=>root,dispose:()=>true,disposed:false};
// @ts-expect-error Copied parameters cannot select an owned type.
api.copyValue(1n,{parameterOf:["newTicket",0]});
record.dispose(); borrowed.dispose(); root.dispose(); api.close();
`);
		await consume(process.execPath, [resolve("node_modules/typescript/bin/tsc"), "--strict", "--noEmit", "--target", "ES2022", "--module", "NodeNext", "--moduleResolution", "NodeNext", "--skipLibCheck", "false", "consumer.mts"]);
		const browser = await checkOwnedJavaScriptBrowsers({ root: consumer
			, name: component.name, run: consume
			, probeSource: `import api from ${JSON.stringify(component.name)};\n${probe}\nexport const run = () => runBorrows(api);\nexport const close = () => api.close();\n`
			, expected: observed });
		reports.push({ reviewed, input, sourceRemovedBeforeInstall: true
			, installedCli: true, installedTypeScript: true, combinedNative: reviewed
			, deterministicReassembly: true, independentRebuild: true, rejected
			, receipt: verified.receipt, model: verified.model, inventory
			, packages, observed, browser
			, documentation: { sourceSha256: sha256(example), output: documentation } });
	}
	const report = { schemaVersion: 1, profile: "installed-owned-javascript-borrows", compilerInputsIdentity: inputs.identity, reports };
	await saveLakeFile("build/owned-javascript-borrow-packaging", "report.json", canonicalJson(report));
	t.diagnostic(JSON.stringify(reports.map(item => ({ reviewed: item.reviewed, observed: item.observed, browser: item.browser }))));
});
