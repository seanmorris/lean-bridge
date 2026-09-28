/**
 * Installed copied and owned APIs must use one content-addressed runtime.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildOwnedJavaScriptWasmComponent } from "../src/build/javascript-wasm-owned-component.mjs";
import { buildOwnedJavaScriptNpmPackages } from "../src/release/owned-javascript-npm-package.mjs";
import { buildComponentNpmPackages } from "../src/release/component-npm-package.mjs";
import { prepareLakeEntryIntent, writeLakeEntryInputs } from "../src/build/lake-entry-intent.mjs";
import { writeEngineExecutionRequest } from "../src/build/engine-execution-request.mjs";
import { executeComponentEngineRequest } from "../src/build/component-engine.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { ownedDotnetCallbacksReviewedIr } from "./helpers/owned-dotnet-callback-fixture.mjs";
import { saveLakeFile, lakeInputState } from "./helpers/lake-workspace.mjs";
import { coexistingNpmProbe } from "./helpers/owned-javascript-npm-coexistence-probe.mjs";

const orders = ["owned-first", "copied-first", "concurrent"];
const environment = { PATH: "/unavailable", CC: "/unavailable/compiler"
	, CXX: "/unavailable/compiler", LEAN_BRIDGE_LEAN_PREFIX: "/unavailable/lean"
	, LEAN_BRIDGE_RUNTIME_ROOT: "/unavailable/runtime", NODE_PATH: "" };

for(const reviewed of [false, true]) test(`installed ${reviewed ? "reviewed" : "ordinary"} owned and copied npm packages share one live heap`, {
	skip: process.env.LEAN_BRIDGE_OWNED_JS_WASM_BUILD_TEST !== "1", timeout: 600000
}, async t => {
	const scratch = await mkdtemp(join(tmpdir(), "lean-owned-npm-shared-"));
	t.after(() => rm(scratch, { recursive: true, force: true }));
	const producer = join(scratch, "producer"), consumer = join(scratch, "consumer");
	const ownedProject = join(producer, "owned-source"), copiedProject = join(producer, "copied-source");
	await cp("tests/fixtures/onboarding/owned-dotnet-callables", ownedProject, { recursive: true });
	await cp("tests/fixtures/onboarding/npm-compounds", copiedProject, { recursive: true });
	if(reviewed)
	{
		await saveLakeFile(ownedProject, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["Owned"] }));
		await saveLakeFile(ownedProject, "reviewed.binding-ir.json", canonicalJson(ownedDotnetCallbacksReviewedIr()));
	}
	const copiedName = "@owned/copied-compounds";
	await saveLakeFile(copiedProject, "lean-bridge.exports.json", canonicalJson({
		schemaVersion: 1, modules: ["Compounds"]
		, exports: ["Compounds.classify", "Compounds.next", "Compounds.transform", "Compounds.duplicate"]
		, targets: { npm: { name: copiedName, version: "1.0.0" } } }));
	const sourceStates = await Promise.all([ownedProject, copiedProject].map(lakeInputState));
	const leanPrefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
	const runtimeRoot = resolve(process.env.LEAN_BRIDGE_OWNED_JS_WASM_PREPARED_ROOT ?? "build/lean-link-spike", "lazy");
	const ownedRoot = join(producer, "owned-compiled"), copiedRoot = join(producer, "copied-compiled");
	try
	{
		await buildOwnedJavaScriptWasmComponent({ projectRoot: ownedProject
			, outputRoot: ownedRoot, leanPrefix
			, leanRuntimeRoot: resolve(process.env.LEAN_BRIDGE_JS_TARGET_RUNTIME ?? "build/lean-runtime/f3b06c705e6c85f5314019d5d3baab0fec5b580c-743765bf566f43ec2f7b4eb84a85686880b3797efe83bf244d6fc7281e4f85a3-browser")
			, emsdkRoot: resolve(process.env.LEAN_WASM_EMSDK ?? ".toolchains/emsdk") });
		const entryIntent = await prepareLakeEntryIntent({ projectRoot: copiedProject });
		const inputRoot = join(producer, "copied-input"), requestPath = join(producer, "request.json");
		await writeLakeEntryInputs({ intent: entryIntent, outputRoot: inputRoot });
		await writeEngineExecutionRequest({ output: requestPath, engineRoot: process.cwd(), inputRoot, entryIntent, targets: ["npm"], cachePolicy: "off" });
		await executeComponentEngineRequest({ requestPath, inputRoot
			, outputRoot: copiedRoot, engineRoot: process.cwd()
			, environment: { ...process.env, LEAN_BRIDGE_LEAN: join(leanPrefix, "bin/lean") } });
		assert.deepEqual(await Promise.all([ownedProject, copiedProject].map(lakeInputState)), sourceStates);
		const owned = await buildOwnedJavaScriptNpmPackages({ componentRoot: ownedRoot, runtimeRoot, outputRoot: join(producer, "owned-packages") });
		const copied = await buildComponentNpmPackages({ bundleRoot: join(copiedRoot, "bundle"), runtimeRoot, outputRoot: join(producer, "copied-packages") });
		const runtimeArchive = await readFile(owned.runtimeArchive);
		assert.deepEqual(await readFile(copied.runtimeArchive), runtimeArchive, "Owned and copied builders must produce the same runtime archive");
		for(const [name, path] of [["runtime", owned.runtimeArchive], ["owned", owned.componentArchive], ["copied", copied.componentArchive]])
			await saveLakeFile(consumer, `handoff/${name}.tgz`, await readFile(path));
		await rm(producer, { recursive: true });
		await saveLakeFile(consumer, "package.json", canonicalJson({ name: "coexisting-consumer", private: true, type: "module" }));
		await saveLakeFile(consumer, "user.npmrc", ""); await saveLakeFile(consumer, "global.npmrc", "");
		const run = (command, args, env = environment) => processBuildRunner.capture({ command, args, cwd: consumer, env, timeoutMs: 120000 });
		const npm = await realpath(join(process.execPath, "../../bin/npm"));
		await run(process.execPath, [npm, "install", "--offline", "--ignore-scripts"
			, "--no-audit", "--no-fund", "--userconfig", join(consumer, "user.npmrc")
			, "--globalconfig", join(consumer, "global.npmrc")
			, "--cache", join(consumer, "empty-cache")
			, ...["runtime", "owned", "copied"].map(name => `./handoff/${name}.tgz`)]);
		const lock = JSON.parse(await readFile(join(consumer, "package-lock.json")));
		assert.deepEqual(Object.keys(lock.packages).filter(path => path.endsWith("node_modules/@lean-bridge/runtime")), ["node_modules/@lean-bridge/runtime"]);
		await saveLakeFile(consumer, "probe.mjs", coexistingNpmProbe(owned.coordinate.name, copiedName));
		await saveLakeFile(consumer, "consumer.mjs", 'import {open} from "./probe.mjs";\nconst api=await open(process.argv[2]);\nconst runs=Array.from({length:3},()=>api.run());\nconsole.log(JSON.stringify({runs,finished:api[process.argv[3]]()}));\n');
		const executions = [];
		for(const order of orders) for(const finish of ["close", "retire"])
		{
			const result = await run(process.execPath, ["consumer.mjs", order, finish]);
			assert.equal(result.stderr, ""); const observed = JSON.parse(result.stdout);
			assert.equal(observed.runs.length, 3);
			assert.deepEqual(observed.runs, Array(3).fill(observed.runs[0]));
			assert.equal(observed.runs[0].order, order); assert.equal(observed.runs[0].checks, 22);
			assert.deepEqual(observed.runs[0].stats, { heaps: 1, initializations: 1, libraries: 2, components: 1, identities: 0, state: 2 });
			assert.equal(observed.finished.state, finish === "close" ? 2 : 3);
			assert.equal(observed.finished.components, finish === "close" ? 0 : 1);
			executions.push({ order, finish, ...observed });
		}
		await saveLakeFile(consumer, "consumer.mts", `import * as owned from ${JSON.stringify(owned.coordinate.name)};
import * as copied from ${JSON.stringify(copiedName)};
const ticket=owned.newTicket(123n,"typed");
const value:bigint=owned.serial(ticket);
const option=copied.next({tag:"some",value:{tag:"none"}});
const constructor:number=copied.classify(option);
// @ts-expect-error Resource identity is not a copied Option.
copied.classify(ticket);
// @ts-expect-error Copied values cannot forge an opaque resource.
owned.serial(option);
ticket.dispose();owned.close();void value;void constructor;
`);
		await run(process.execPath, [resolve("node_modules/typescript/bin/tsc"), "--strict", "--noEmit", "--target", "ES2022", "--module", "NodeNext", "--moduleResolution", "NodeNext", "--skipLibCheck", "false", "consumer.mts"]);
		const browser = process.env.LEAN_BRIDGE_OWNED_JS_WASM_BROWSER_TEST === "1"
			? await (await import("./helpers/owned-javascript-npm-coexistence-browser.mjs")).checkCoexistingNpmBrowsers({ root: consumer, ownedName: owned.coordinate.name, copiedName }) : null;
		t.diagnostic(JSON.stringify({ reviewed, runtimeIdentity: owned.runtimeIdentity
			, runtimeArchiveSha256: sha256(runtimeArchive), runtimeInstallations: 1
			, sourceRemoved: true, strictTypeScript: true, executions, browser }));
	}
	catch(error)
	{ t.diagnostic(JSON.stringify(error.details ?? error.message)); throw error; }
});
