/** @file Verify callback/IO failure isolation and shared retirement in installed npm packages. */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { promisify } from "node:util";
import { sha256 } from "../../src/capsule/node.mjs";
import { buildOwnedJavaScriptWasmComponent } from "../../src/build/javascript-wasm-owned-component.mjs";
import { buildOwnedJavaScriptNpmPackages } from "../../src/release/owned-javascript-npm-package.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { runInstalledChromium } from "./javascript-wasm-installed-browser.mjs";
import { checkCallbackWorker } from "./javascript-wasm-callback-io-browser-worker.mjs";
import { checkCallbackDelivery } from "./javascript-callback-io-delivery.mjs";
import { ledgerFrameworkArchives } from "./javascript-ledger-delivery.mjs";
import { retainPackageSetEvidence } from "./package-set.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const run = promisify(execFile);
const fixture = path => fileURLToPath(new URL("../fixtures/" + path, import.meta.url));
const ownedRelease = async (root, sdk, headers) => {
	const source = join(root, "owned-source"), compiled = join(root, "compiled"), out = join(root, "owned");
	await cp(fixture("onboarding/owned-dotnet-callables"), source, {recursive: true});
	await buildOwnedJavaScriptWasmComponent({projectRoot: source
		, outputRoot: compiled
		, leanPrefix: process.env.LEAN_BRIDGE_LEAN_PREFIX
		, leanRuntimeRoot: headers, emsdkRoot: sdk});
	await buildOwnedJavaScriptNpmPackages({componentRoot: compiled, runtimeRoot: process.env.LEAN_BRIDGE_RUNTIME_ROOT, outputRoot: out});
	return out;
};
const ioRelease = async root => {
	const source = join(root, "io-source"), out = join(root, "io"), cfg = join(source, "lean-bridge.exports.json");
	await cp(fixture("php-wasm-sync-io"), source, {recursive: true});
	const config = JSON.parse(await readFile(cfg)); config.targets = {npm: {name: "@example/ledger-io", version: "1.0.2"}};
	await writeFile(cfg, JSON.stringify(config));
	await run(process.execPath, [resolve("scripts/lean-bridge.mjs"), "build", "--project", source, "--target", "npm", "--output", out, "--json", "--progress", "none"]);
	return join(out, "packages/npm");
};
const handoff = async dir => {
	const {receipt, result} = await readVerifiedPackageSetReceipt({receiptPath: join(dir, "package-set-receipt.json")});
	const component = receipt.packages.find(p => p.role === "component"), runtime = receipt.packages.find(p => p.role === "runtime");
	assert.equal(component.requires[0].version, runtime.version);
	return {name: component.name
		, archive: join(dir, component.artifacts[0].path)
		, runtime: join(dir, runtime.artifacts[0].path)
		, sourceTree: receipt.source.treeSha256, receiptSha256: result.receiptSha256};
};

test("installed callbacks preserve host and IO exceptions; a swallowed guest trap retires every package", {
	skip: process.env.LEAN_BRIDGE_JS_CALLBACK_IO_TEST !== "1"
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "js-callback-io-")); t.after(() => rm(root, {recursive: true, force: true}));
	const consumer = join(root, "consumer"); await mkdir(consumer);
	const sdk = resolve(process.env.LEAN_BRIDGE_JS_EMSDK ?? ".toolchains/emsdk");
	const headers = resolve(process.env.LEAN_BRIDGE_JS_TARGET_RUNTIME);
	const io = await handoff(process.env.LEAN_BRIDGE_JS_IO_RELEASE ?? await ioRelease(root));
	const callbackDir = process.env.LEAN_BRIDGE_JS_CALLBACK_RELEASE ?? await ownedRelease(root, sdk, headers);
	const owned = await handoff(callbackDir);
	if(process.env.LEAN_BRIDGE_JS_CALLBACK_KEEP) await retainPackageSetEvidence(callbackDir, process.env.LEAN_BRIDGE_JS_CALLBACK_KEEP);
	assert.deepEqual(await readFile(io.runtime), await readFile(owned.runtime), "both packages must ship the identical runtime archive");
	await writeFile(join(consumer, "package.json"), '{"private":true,"type":"module"}');
	const frameworks = await ledgerFrameworkArchives(root);
	await run("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--cache", join(root, "cache"), io.runtime, io.archive, owned.archive, ...frameworks], {cwd: consumer});
	const lock = JSON.parse(await readFile(join(consumer, "package-lock.json")));
	assert.deepEqual(Object.keys(lock.packages).filter(k => k.endsWith("node_modules/@lean-bridge/runtime")), ["node_modules/@lean-bridge/runtime"]);
	const binary = join(consumer, "fault.wasm");
	const flags = ["-O2", "-fPIC", "-fwasm-exceptions", "-sSIDE_MODULE=2"
		, "-Wl,--no-entry", "-Wl,--export=initialize_BridgeTestFault"
		, "-Wl,--export=lean_bridge_9a08ea85b538463aadcffcde"
		, "-I", join(headers, "cmake/include")
		, fixture("javascript-wasm-callback-io/fault.c"), "-o", binary];
	await run(join(sdk, "upstream/emscripten/emcc"), flags, {
		env: {...process.env, EMSDK: sdk, EM_CONFIG: join(sdk, ".emscripten")}});
	const integrity = sha256(await readFile(binary));
	await copyFile(new URL("./javascript-wasm-callback-io-calls.mjs", import.meta.url), join(consumer, "calls.mjs"));
	await copyFile(new URL("./javascript-wasm-callback-io-worker.mjs", import.meta.url), join(consumer, "worker.mjs"));
	await writeFile(join(consumer, "consume.mjs"), 'import {exercise} from "./calls.mjs"; console.log(JSON.stringify(await exercise(JSON.parse(process.argv[2]))));\n');
	const cases = [], requests = [];
	const realms = {node: [], chromium: []};
	const deliveryOnly = process.env.LEAN_BRIDGE_JS_CALLBACK_IO_DELIVERY_ONLY === "1";
	for(const order of ["io-first", "owned-first"]) for(const propagate of [false, true])
	{
		const options = {ioName: io.name, ownedName: owned.name, order, integrity, propagate};
		requests.push(options);
		if(deliveryOnly) continue;
		const node = JSON.parse((await run(process.execPath, ["consume.mjs", JSON.stringify(options)], {cwd: consumer})).stdout);
		const browser = await runInstalledChromium({root, consumer
			, names: [io.name, owned.name], argument: options
			, evaluate: async opts => (await import("/calls.mjs")).exercise(opts)});
		assert.deepEqual(browser, node); assert.equal(node.order, order); assert.ok(node.checks >= 23);
		realms.node.push(node); realms.chromium.push(browser);
		cases.push({options, node});
		t.diagnostic(JSON.stringify({node, chromium: browser, diagnosticWasm: integrity}));
		if(order === "owned-first" && propagate)
		{
			const isolated = JSON.parse((await run(process.execPath, ["worker.mjs", JSON.stringify(options)], {cwd: consumer})).stdout);
			assert.deepEqual(isolated.worker, node); assert.equal(isolated.parentCounter, 21);
			realms.nodeWorker = isolated;
			t.diagnostic("An independent Node worker retired its own heap; the live parent retained its ticket and advanced its counter to 21.");
		}
	}
	if(!deliveryOnly)
	{
		const dedicated = await checkCallbackWorker({root, consumer, names: [io.name, owned.name], cases});
		realms.chromiumWorkers = dedicated;
		t.diagnostic(JSON.stringify({chromiumWorkers: dedicated.workers.length, parentCounter: dedicated.parentCounter}));
	}
	const report = await checkCallbackDelivery({root, consumer, io, owned, requests});
	if(!deliveryOnly)
	{
		const source = async name => sha256(await readFile(new URL(name,import.meta.url)));
		report.otherRealms = {...realms, drivers: {
			nodeWorkerSha256: await source("./javascript-wasm-callback-io-worker.mjs"),
			chromiumWorkerSha256: await source("./javascript-wasm-callback-io-browser-worker.mjs"),
			diagnosticSourceSha256: await source("../fixtures/javascript-wasm-callback-io/fault.c")
		}};
	}
	if(process.env.LEAN_BRIDGE_JS_CALLBACK_DELIVERY_EVIDENCE)
		await saveLakeFile(process.env.LEAN_BRIDGE_JS_CALLBACK_DELIVERY_EVIDENCE, report.route + ".json", JSON.stringify(report, null, 2) + "\n");
	t.diagnostic(report.route + ": four typed callback traps and four React runtime-retirement/retry sequences passed.");
});
