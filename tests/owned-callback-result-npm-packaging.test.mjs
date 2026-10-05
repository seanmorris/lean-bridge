/**
 * Installed CLI, original npm archives and browser callback-result lifetimes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildJavaScriptWasmCompilerInputs } from "../src/release/javascript-wasm-compiler-inputs.mjs";
import { buildCliNpmPackage } from "../src/release/cli-npm-package.mjs";
import { readVerifiedPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { buildOwnedJavaScriptNpmPackages } from "../src/release/owned-javascript-npm-package.mjs";
import { readVerifiedOwnedJavaScriptWasmComponent } from "../src/build/javascript-wasm-owned-artifacts.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { ownedCallbackResultConfiguration, ownedCallbackResultReviewedIr, ownedCallbackResultSource } from "./helpers/owned-callback-result-fixture.mjs";
import { saveLakeFile, lakeInputState } from "./helpers/lake-workspace.mjs";
import { checkOwnedJavaScriptBrowsers } from "./helpers/owned-javascript-npm-browser.mjs";
import { ownedJavaScriptReceiverInventory } from "./helpers/owned-javascript-receiver-inventory.mjs";

const rejectDrift = async root => {
	const inventory = JSON.parse(await readFile(join(root, "artifacts.json"), "utf8"));
	const receipt = JSON.parse(await readFile(join(root, "javascript-wasm-component.json"), "utf8"));
	const changes = [];
	for(const mutate of [
		value => { delete value.ownedGraph.callbackResultAnchors; }
		, value => { value.ownedGraph.callbackResultAnchors.signatures.pop(); }
		, value => { value.ownedGraph.callbackResultAnchors.signatures[0].parameter += 1; }
		, value => { value.ownedGraph.callbackResultAnchors.anchor = "closure-owner"; }
		, value => { value.ownedGraph.callbackResultAnchors.expiration = "never"; }
		, value => { value.ownedGraph.callbackResultAnchors.unknown = true; }
		, value => { value.schemaVersion = 4; }
	]) {
		const changed = structuredClone(receipt); mutate(changed);
		changes.push(["javascript-wasm-component.json", canonicalJson(changed)]);
	}
	for(const path of Object.keys(receipt.ownedGraph.files)) changes.push([path, (await readFile(join(root, path), "utf8")) + "\n/* callback owner drift */\n"]);
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

test("installed callback-result npm archives execute in Node, TypeScript and browsers", {
	skip: process.env.LEAN_BRIDGE_OWNED_CALLBACK_RESULT_TEST !== "1"
	, timeout: 1800000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-callback-result-npm-installed-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const runtimeRoot = resolve(process.env.LEAN_BRIDGE_OWNED_JS_WASM_PREPARED_ROOT ?? "build/lean-link-spike", "lazy");
	const inputs = await buildJavaScriptWasmCompilerInputs({ outputRoot: join(root, "inputs")
		, leanRuntimeRoot: resolve(process.env.LEAN_BRIDGE_JS_TARGET_RUNTIME ?? "build/lean-runtime/f3b06c705e6c85f5314019d5d3baab0fec5b580c-743765bf566f43ec2f7b4eb84a85686880b3797efe83bf244d6fc7281e4f85a3-browser") });
	const candidate = await buildCliNpmPackage({ outputRoot: join(root, "candidate"), javascriptWasmInputsRoot: inputs.directory, runtimeRoot });
	assert.equal(candidate.report.javascriptWasmInputsIncluded, true);
	const author = join(root, "author");
	await saveLakeFile(author, "package.json", '{"name":"isolated-callback-result-author","private":true,"version":"1.0.0"}\n');
	await saveLakeFile(author, "cli.tgz", await readFile(candidate.archive));
	await rm(candidate.output, { recursive: true }); await rm(inputs.output, { recursive: true });
	const environment = { ...process.env, LEAN_BRIDGE_BUILD_BACKEND: "auto"
		, LEAN_BRIDGE_LEAN_PREFIX: resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2")
		, LEAN_BRIDGE_JS_EMSDK: resolve(process.env.LEAN_BRIDGE_JS_EMSDK ?? ".toolchains/emsdk") };
	for(const key of ["LEAN_BRIDGE_RUNTIME_ROOT", "LEAN_BRIDGE_JS_INPUTS", "LEAN_BRIDGE_JS_TARGET_RUNTIME", "NODE_PATH", "NODE_OPTIONS"]) delete environment[key];
	const run = (command, args, cwd = author, timeoutMs = 900000) => processBuildRunner.capture({ command, args, cwd, env: environment, timeoutMs })
		.catch(error => { t.diagnostic(JSON.stringify(error.details ?? error.message)); throw error; });
	await run("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "./cli.tgz"]);
	const cliRoot = join(author, "node_modules", candidate.report.package.name);
	for(const file of candidate.report.files)
	{
		const bytes = await readFile(join(cliRoot, file.path));
		assert.equal(bytes.length, file.bytes); assert.equal(sha256(bytes), file.sha256);
	}
	const cli = join(author, "node_modules/.bin/lean-bridge"), reports = [];
	const probe = await readFile("tests/fixtures/structured-types/owned-installed-javascript-callback-results.mjs", "utf8");
	for(const reviewed of [false, true])
	{
		const mode = reviewed ? "reviewed" : "ordinary";
		t.diagnostic(`${mode}: installed CLI builds original callback-result npm archives`);
		const project = join(root, mode), output = join(root, mode + "-release");
		await cp("tests/fixtures/onboarding/owned-aggregates", project, { recursive: true });
		await saveLakeFile(project, "Owned.lean", (await readFile(join(project, "Owned.lean"), "utf8")) + ownedCallbackResultSource);
		const config = reviewed ? { schemaVersion: 1, modules: ["Owned"] } : await ownedCallbackResultConfiguration();
		config.targets = { npm: { name: `@owned/${mode}-callback-results`, version: "1.2.3" } };
		await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
		if(reviewed) await saveLakeFile(project, "reviewed.binding-ir.json", canonicalJson(ownedCallbackResultReviewedIr()));
		const before = await lakeInputState(project);
		const build = async destination => {
			const result = JSON.parse((await run(cli, ["build", "--project", project, "--target", "npm", "--output", destination, "--json"])).stdout);
			assert.equal(result.status, "ok", JSON.stringify(result));
			assert.deepEqual(await lakeInputState(project), before);
			return readVerifiedPackageSetReceipt({ receiptPath: join(destination, "package-set-receipt.json") });
		};
		const checked = await build(output);
		const npm = checked.receipt.packages.filter(item => item.target === "npm"), component = npm.find(item => item.role === "component");
		assert.equal(npm.length, 2);
		const componentRoot = join(output, "javascript-wasm/component");
		const verified = await readVerifiedOwnedJavaScriptWasmComponent(componentRoot);
		assert.equal(verified.model.schemaVersion, 11); assert.equal(verified.privateAbi.version, 14);
		assert.equal(verified.model.ownedGraph.callbackResultAnchors.signatures.length, 4);
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
		await saveLakeFile(consumer, "package.json", '{"name":"installed-callback-result-consumer","version":"1.0.0","type":"module","private":true}\n');
		const packages = [];
		for(const [index, entry] of npm.entries())
		{
			const bytes = await readFile(join(output, entry.artifacts[0].path)); await saveLakeFile(consumer, `handoff/${index}.tgz`, bytes);
			packages.push({ name: entry.name, role: entry.role, bytes: bytes.length, sha256: sha256(bytes) });
		}
		for(const path of [project, output])
		{ await rm(path, { recursive: true }); await assert.rejects(access(path), { code: "ENOENT" }); }
		const consumerEnvironment = { ...environment
			, PATH: `${dirname(process.execPath)}:/usr/bin:/bin`
			, CC: "/unavailable/compiler", CXX: "/unavailable/compiler"
			, LEAN_BRIDGE_LEAN_PREFIX: "/unavailable/lean"
			, LEAN_BRIDGE_JS_EMSDK: "/unavailable/emsdk"
			, LEAN_BRIDGE_NATIVE_ROOT: "/unavailable/runtime"
			, LEAN_BRIDGE_RUNTIME_ROOT: "/unavailable/runtime"
		};
		const consume = (command, args) => processBuildRunner.capture({
			command, args, cwd: consumer, env: consumerEnvironment
			, timeoutMs: 180000
		}).catch(error => { t.diagnostic(JSON.stringify(error.details ?? error.message)); throw error; });
		await consume("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "./handoff/0.tgz", "./handoff/1.tgz"]);
		await rm(join(consumer, "handoff"), { recursive: true });
		const inventory = await ownedJavaScriptReceiverInventory(join(consumer, "node_modules"));
		assert.ok(Object.keys(inventory).length > 50);
		await saveLakeFile(consumer, "probe.mjs", probe);
		await saveLakeFile(consumer, "call.mjs", `import api from ${JSON.stringify(component.name)};\nimport {runCallbackResults} from "./probe.mjs";\nconsole.log(JSON.stringify(runCallbackResults(api)));\nif(!api.close() || api.close()) throw new Error("Component close failed");\n`);
		const observed = JSON.parse((await consume(process.execPath, ["call.mjs"])).stdout);
		assert.deepEqual(observed, { checks: 43, borrowedResults: true
			, transitiveExpiration: true, hostReplyHandoff: true });
		await saveLakeFile(consumer, "consumer.mts", `import api, {type Bundle, type LeanValue} from ${JSON.stringify(component.name)};
const ticket = api.newTicket(42n, "callback");
const input = api.echoRecord({primary:ticket.get(),spare:{tag:"none"},peers:[],history:[],payload:{count:-1n,bytes:new Uint8Array()}});
const closure = api.makeRecord(input);
const result: LeanValue<Bundle> = closure.get()(true, input);
const nested = closure.get()(false, result);
api.callbackRecord(input, value => value).dispose();
api.callbackRecord(input, value => api.echoRecord(value)).dispose();
const leased = api.makeLeasedRecord(input);
leased.get()(true, input.get()).dispose();
// @ts-expect-error The selected callback argument requires its whole owner.
closure.get()(false, input.get());
// @ts-expect-error The argument owner's type must match the declared bundle.
closure.get()(false, ticket);
// @ts-expect-error A borrowed result is not an unowned payload.
const raw: Bundle = closure.get()(true, input);
// @ts-expect-error A host reply must match its declared result type.
api.callbackRecord(input, () => ticket);
nested.dispose(); result.dispose(); closure.dispose(); leased.dispose(); input.dispose(); ticket.dispose(); api.close();
`);
		await consume(process.execPath, [resolve("node_modules/typescript/bin/tsc"), "--strict", "--noEmit", "--target", "ES2022", "--module", "NodeNext", "--moduleResolution", "NodeNext", "--skipLibCheck", "false", "consumer.mts"]);
		const browser = await checkOwnedJavaScriptBrowsers({ root: consumer
			, name: component.name, run: consume
			, probeSource: `import api from ${JSON.stringify(component.name)};\n${probe}\nexport const run = () => runCallbackResults(api);\nexport const close = () => api.close();\n`
			, expected: observed });
		reports.push({ reviewed, input, sourceRemovedBeforeInstall: true
			, compilerFreeConsumerEnvironment: true
			, installedCli: true, installedTypeScript: true
			, deterministicReassembly: true, independentRebuild: true, rejected
			, receipt: verified.receipt, model: verified.model, inventory
			, packages, observed, browser, probeSha256: sha256(probe) });
	}
	await saveLakeFile("build/owned-callback-results", "npm-package.json", canonicalJson({
		schemaVersion: 1, profile: "installed-owned-callback-results"
		, compilerInputsIdentity: inputs.identity, cli: candidate.report, reports
	}));
	t.diagnostic(JSON.stringify(reports.map(item => ({ reviewed: item.reviewed, observed: item.observed, browser: item.browser }))));
});
