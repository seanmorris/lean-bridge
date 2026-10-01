/**
 * Install resource-only and unanchored callback receiver packages without sources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildOwnedJavaScriptWasmComponent } from "../src/build/javascript-wasm-owned-component.mjs";
import { readVerifiedOwnedJavaScriptWasmComponent } from "../src/build/javascript-wasm-owned-artifacts.mjs";
import { buildOwnedJavaScriptNpmPackages } from "../src/release/owned-javascript-npm-package.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { ownedJavaScriptReceiverConfiguration } from "./helpers/owned-javascript-receiver-configurations.mjs";
import { checkOwnedJavaScriptBrowsers } from "./helpers/owned-javascript-npm-browser.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { ownedJavaScriptReceiverInventory } from "./helpers/owned-javascript-receiver-inventory.mjs";

for(const mode of ["ordinary", "reviewed"]) for(const kind of ["plain", "consuming", "unanchored"])
	test(`installed JavaScript ${kind} receivers (${mode})`, {
		skip: process.env.LEAN_BRIDGE_OWNED_JS_RECEIVER_TEST !== "1", timeout: 1200000
	}, async t => {
		const root = await mkdtemp(join(tmpdir(), "lean-owned-js-resource-receivers-"));
		t.after(() => rm(root, { recursive: true, force: true }));
		const unanchored = kind === "unanchored", consuming = kind !== "plain";
		const { configuration, reviewedIr, sourceSuffix } = await ownedJavaScriptReceiverConfiguration(unanchored, consuming);
		const project = join(root, "project"), componentRoot = join(root, "component"), name = `@owned/${mode}-${kind}-receivers`;
		const config = mode === "reviewed" ? { schemaVersion: 1, modules: ["Owned"] } : configuration;
		config.targets = { npm: { name, version: "1.2.3" } };
		await cp("tests/fixtures/onboarding/owned-aggregates", project, { recursive: true });
		await saveLakeFile(project, "Owned.lean", (await readFile(join(project, "Owned.lean"), "utf8")) + sourceSuffix);
		await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
		if(mode === "reviewed") await saveLakeFile(project, "reviewed.binding-ir.json", canonicalJson(reviewedIr));
		const before = await lakeInputState(project);
		const build = async outputRoot => {
			await buildOwnedJavaScriptWasmComponent({ projectRoot: project, outputRoot
				, leanPrefix: resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2")
				, leanRuntimeRoot: resolve(process.env.LEAN_BRIDGE_JS_TARGET_RUNTIME ?? "build/lean-runtime/f3b06c705e6c85f5314019d5d3baab0fec5b580c-743765bf566f43ec2f7b4eb84a85686880b3797efe83bf244d6fc7281e4f85a3-browser")
				, emsdkRoot: resolve(process.env.LEAN_BRIDGE_JS_EMSDK ?? ".toolchains/emsdk")
				, receiverExports: true, anchoredResults: false
				, transferredInputs: consuming, hostCallbacks: unanchored });
			assert.deepEqual(await lakeInputState(project), before);
		};
		await build(componentRoot);
		const verified = await readVerifiedOwnedJavaScriptWasmComponent(componentRoot);
		assert.equal(verified.model.schemaVersion, 10); assert.equal(verified.privateAbi.version, 13);
		assert.equal(Boolean(verified.model.ownedGraph.hostCallbacks), unanchored);
		assert.equal(Boolean(verified.model.ownedGraph.inputTransfers), consuming);
		assert.equal(verified.model.ownedGraph.resultAnchors, undefined);
		assert.equal(Boolean(verified.receipt.ownedGraph.files["owned/callbacks.c"]), unanchored);
		assert.equal(verified.privateAbi.receiverExports.exports.length, unanchored ? 16 : consuming ? 4 : 3);
		const input = { metadata: JSON.parse(await readFile(join(componentRoot, "metadata.json"), "utf8"))
			, sourceIdentity: verified.receipt.sourceIdentity
			, component: verified.model.component };
		const runtimeRoot = resolve(process.env.LEAN_BRIDGE_OWNED_JS_WASM_PREPARED_ROOT ?? "build/lean-link-spike", "lazy");
		const packages = await buildOwnedJavaScriptNpmPackages({ componentRoot, runtimeRoot, outputRoot: join(root, "packages") });
		const repeatedRoot = join(root, "repeated"); await build(repeatedRoot);
		const repeated = await buildOwnedJavaScriptNpmPackages({ componentRoot: repeatedRoot, runtimeRoot, outputRoot: join(root, "repeated-packages") });
		const reassembled = await buildOwnedJavaScriptNpmPackages({ componentRoot, runtimeRoot, outputRoot: join(root, "reassembled") });
		const archives = [];
		const consumer = join(root, "consumer");
		await saveLakeFile(consumer, "package.json", '{"name":"source-free-receiver-consumer","version":"1.0.0","private":true,"type":"module"}\n');
		for(const [index, key] of ["componentArchive", "runtimeArchive"].entries())
		{
			const bytes = await readFile(packages[key]);
			assert.deepEqual(await readFile(repeated[key]), bytes); assert.deepEqual(await readFile(reassembled[key]), bytes);
			await saveLakeFile(consumer, `${index}.tgz`, bytes);
			archives.push({ role: key === "componentArchive" ? "component" : "runtime", bytes: bytes.length, sha256: sha256(bytes) });
		}
		for(const path of [project, componentRoot, repeatedRoot, packages.output, repeated.output, reassembled.output]) await rm(path, { recursive: true });
		const environment = { ...process.env };
		for(const key of ["LEAN_BRIDGE_RUNTIME_ROOT", "LEAN_BRIDGE_JS_INPUTS", "LEAN_BRIDGE_JS_TARGET_RUNTIME", "NODE_PATH", "NODE_OPTIONS"]) delete environment[key];
		const consume = (command, args) => processBuildRunner.capture({ command, args, cwd: consumer, env: environment, timeoutMs: 180000 })
			.catch(error => { t.diagnostic(JSON.stringify(error.details ?? error.message)); throw error; });
		await consume("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "./0.tgz", "./1.tgz"]);
		await rm(join(consumer, "0.tgz")); await rm(join(consumer, "1.tgz"));
		const inventory = await ownedJavaScriptReceiverInventory(join(consumer, "node_modules"));
		const probe = await readFile("tests/fixtures/structured-types/owned-installed-javascript-resource-receivers.mjs", "utf8");
		const expression = unanchored ? "runUnanchoredReceivers(api)" : `runPlainReceivers(api, ${consuming})`;
		await saveLakeFile(consumer, "call.mjs", `import api from ${JSON.stringify(name)};\n${probe}\nconsole.log(JSON.stringify(${expression}));\nif(!api.close() || api.close())throw new Error("Close failed");\n`);
		const observed = JSON.parse((await consume(process.execPath, ["call.mjs"])).stdout);
		assert.equal(observed.consuming, consuming); assert.equal(observed.callbacks, unanchored);
		assert.equal(observed.resultAnchors, false); assert.ok(observed.checks >= (unanchored ? 11 : 17));
		await saveLakeFile(consumer, "consumer.mts", `import api, {type TicketValue} from ${JSON.stringify(name)};
const root: TicketValue = api.newTicket(42n, "typed");
const serial: bigint = root.serial;
const result: TicketValue = root.retainTicket();
const rawResult: TicketValue = root.get().retainTicket();
const share: TicketValue = result.share();
// @ts-expect-error Properties are immutable.
root.serial = 1n;
${consuming ? `const moved: TicketValue = result.transferTicket(); moved.dispose();
// @ts-expect-error Consuming a receiver requires its original owner.
root.get().transferTicket();` : `// @ts-expect-error Undeclared members remain absent.
root.transferTicket();`}
share.dispose(); rawResult.dispose(); result.dispose(); root.dispose(); api.close(); void serial;
`);
		await consume(process.execPath, [resolve("node_modules/typescript/bin/tsc"), "--strict", "--noEmit", "--target", "ES2022", "--module", "NodeNext", "--moduleResolution", "NodeNext", "--skipLibCheck", "false", "consumer.mts"]);
		const browser = await checkOwnedJavaScriptBrowsers({
			root: consumer, name, run: consume
			, probeSource: `import api from ${JSON.stringify(name)};\n${probe}\nexport const run=()=>${expression};\nexport const close=()=>api.close();\n`
			, expected: observed });
		await saveLakeFile("build/owned-javascript-receivers", `${mode}-${kind}-package.json`, canonicalJson({
			schemaVersion: 1, profile: "installed-javascript-resource-receivers"
			, mode, kind, consuming, unanchored, input
			, model: verified.model, receipt: verified.receipt
			, sourceUnchanged: true, sourceRemovedBeforeInstall: true
			, installedTypeScript: true, producerInterface: "javascript-wasm-build-api"
			, independentRebuild: true, deterministicReassembly: true
			, archives, inventory, observed, browser, consumerSha256: sha256(probe)
		}));
		t.diagnostic(JSON.stringify({ mode, kind, observed }));
	});
