/**
 * Original C/npm archives preserve combined callback, receiver and transfer APIs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildJavaScriptWasmCompilerInputs } from "../src/release/javascript-wasm-compiler-inputs.mjs";
import { buildCliNpmPackage } from "../src/release/cli-npm-package.mjs";
import { readVerifiedPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { readVerifiedOwnedJavaScriptWasmComponent } from "../src/build/javascript-wasm-owned-artifacts.mjs";
import { readVerifiedNativeComponent, readVerifiedNativeRuntime, verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { ownedCallbackResultCombinedConfiguration, ownedCallbackResultCombinedReviewedIr, ownedCallbackResultCombinedSource } from "./helpers/owned-callback-result-fixture.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile, lakeInputState } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { checkOwnedJavaScriptBrowsers } from "./helpers/owned-javascript-npm-browser.mjs";
import { ownedJavaScriptReceiverInventory } from "./helpers/owned-javascript-receiver-inventory.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("installed C/npm archives combine callback lifetimes, receiver methods and transfers", {
	skip: process.env.LEAN_BRIDGE_OWNED_CALLBACK_RESULT_TEST !== "1"
	, timeout: 1800000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-callback-combined-installed-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const runtimeRoot = resolve(process.env.LEAN_BRIDGE_OWNED_JS_WASM_PREPARED_ROOT ?? "build/lean-link-spike", "lazy");
	const inputs = await buildJavaScriptWasmCompilerInputs({ outputRoot: join(root, "inputs")
		, leanRuntimeRoot: resolve(process.env.LEAN_BRIDGE_JS_TARGET_RUNTIME ?? "build/lean-runtime/f3b06c705e6c85f5314019d5d3baab0fec5b580c-743765bf566f43ec2f7b4eb84a85686880b3797efe83bf244d6fc7281e4f85a3-browser") });
	const candidate = await buildCliNpmPackage({ outputRoot: join(root, "candidate"), javascriptWasmInputsRoot: inputs.directory, runtimeRoot });
	assert.equal(candidate.report.javascriptWasmInputsIncluded, true);
	const cliArchive = await readFile(candidate.archive);
	await rm(candidate.output, { recursive: true }); await rm(inputs.output, { recursive: true });
	const environment = { ...nativeFixtureEnvironment(["c"]), LEAN_BRIDGE_BUILD_BACKEND: "auto"
		, LEAN_BRIDGE_JS_EMSDK: resolve(process.env.LEAN_BRIDGE_JS_EMSDK ?? ".toolchains/emsdk") };
	for(const key of ["LEAN_BRIDGE_RUNTIME_ROOT", "LEAN_BRIDGE_JS_INPUTS", "LEAN_BRIDGE_JS_TARGET_RUNTIME", "NODE_PATH", "NODE_OPTIONS"]) delete environment[key];
	const run = (command, args, cwd, env = environment, timeoutMs = 900000) => processBuildRunner.capture({ command, args, cwd, env, timeoutMs })
		.catch(error => { t.diagnostic(JSON.stringify(error.details ?? error.message)); throw error; });
	const baseC = await readFile("tests/fixtures/structured-types/owned-installed-callback-results.c", "utf8");
	const combinedC = await readFile("tests/fixtures/structured-types/owned-installed-callback-combinations.c", "utf8");
	const main = "int main(void) {", end = "  clear(&supplied_owner); clear(&first_owner); clear(&second_owner);";
	assert.equal(baseC.split(main).length, 2); assert.equal(baseC.split(end).length, 2);
	const cProbe = baseC.replace(main, combinedC + "\n" + main).replace(end, end + "\n  callback_combinations(session);");
	const jsProbe = await readFile("tests/fixtures/structured-types/owned-installed-javascript-callback-combinations.mjs", "utf8");
	const guide = await readFile("docs/javascript-typescript.md", "utf8");
	const example = guide.split("### Borrowed callback results\n")[1]?.split("### Methods and properties\n")[0]?.match(/```js\n([\s\S]*?)\n```/u)?.[1];
	assert.ok(example, "The consumer guide must contain its executable callback example");
	for(const mode of ["ordinary", "reviewed"])
	{
		const author = join(root, mode + "-author"), project = join(root, mode + "-source");
		const output = join(root, mode + "-release"), handoff = join(root, mode + "-handoff");
		await saveLakeFile(author, "package.json", canonicalJson({ private: true }));
		await saveLakeFile(author, "cli.tgz", cliArchive);
		await run("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "./cli.tgz"], author);
		const cliRoot = join(author, "node_modules", candidate.report.package.name);
		for(const file of candidate.report.files)
		{
			const bytes = await readFile(join(cliRoot, file.path));
			assert.equal(bytes.length, file.bytes); assert.equal(sha256(bytes), file.sha256);
		}
		await cp("tests/fixtures/onboarding/owned-aggregates", project, { recursive: true });
		await saveLakeFile(project, "Owned.lean", (await readFile(join(project, "Owned.lean"), "utf8")) + ownedCallbackResultCombinedSource);
		const configuration = mode === "ordinary" ? await ownedCallbackResultCombinedConfiguration() : { schemaVersion: 1, modules: ["Owned"] };
		configuration.targets = { c: { name: "owned-callback-combinations", version: "1.2.3" }
			, npm: { name: `@owned/${mode}-callback-combinations`, version: "1.2.3" } };
		await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(configuration));
		if(mode === "reviewed") await saveLakeFile(project, "reviewed.binding-ir.json", canonicalJson(ownedCallbackResultCombinedReviewedIr()));
		const before = await lakeInputState(project);
		t.diagnostic(`${mode}: installed CLI builds one C/npm release with all four capabilities`);
		const arguments_ = ["build", "--project", project
			, "--target", "c", "--target", "npm", "--output", output, "--json"];
		const built = JSON.parse((await run(join(author, "node_modules/.bin/lean-bridge"), arguments_, author)).stdout);
		assert.equal(built.status, "ok"); assert.deepEqual(await lakeInputState(project), before);
		const checked = await readVerifiedPackageSetReceipt({ receiptPath: join(output, "package-set-receipt.json") });
		const nativeRoot = join(output, "profiles/native/native/component");
		const { identity } = await readVerifiedNativeRuntime(join(output, "profiles/native/native/runtime"));
		const native = await readVerifiedNativeComponent(nativeRoot, identity, {
			ownedGraphs: true, ownedHostCallbacks: true, ownedInputTransfers: true
			, ownedAnchoredResults: true, ownedReceiverExports: true
			, ownedCallbackResultAnchors: true
		});
		const wasm = await readVerifiedOwnedJavaScriptWasmComponent(join(output, "profiles/wasm/javascript-wasm/component"));
		const nativeInput = { metadata: await json(join(nativeRoot, "metadata.json"))
			, sourceIdentity: native.model.sourceIdentity
			, component: native.model.component };
		const wasmInput = { metadata: await json(join(output, "profiles/wasm/javascript-wasm/component/metadata.json"))
			, sourceIdentity: wasm.model.sourceIdentity
			, component: wasm.model.component };
		assert.equal(native.model.pointerBits, 64); assert.equal(wasm.model.pointerBits, 32);
		assert.equal(wasm.privateAbi.version, 14);
		for(const capability of ["callbackResultAnchors", "receiverExports", "resultAnchors", "inputTransfers"])
		{
			assert.ok(native.model.ownedGraph[capability], capability);
			assert.deepEqual(native.model.ownedGraph[capability], wasm.model.ownedGraph[capability]);
		}
		assert.equal(wasm.model.ownedGraph.callbackResultAnchors.signatures.length, 4);
		assert.equal(wasm.model.ownedGraph.receiverExports.exports.length, 4);
		assert.equal(wasm.model.ownedGraph.resultAnchors.exports.length, 1);
		assert.equal(wasm.model.ownedGraph.inputTransfers.exports.length, 1);
		const receipt = await copyPackageSetHandoff(output, handoff);
		assert.deepEqual(receipt, checked.receipt);
		for(const path of [author, project, output])
		{ await rm(path, { recursive: true }); await assert.rejects(access(path), { code: "ENOENT" }); }
		const cPackages = receipt.packages.filter(item => item.target === "c");
		const npm = receipt.packages.filter(item => item.target === "npm"), component = npm.find(item => item.role === "component");
		assert.equal(cPackages.length, 1); assert.equal(npm.length, 2);
		const consumer = join(root, mode + "-consumer");
		const installedC = await installCopiedConsumer({
			profile: "c", consumer, handoff, packages: cPackages, environment
			, fixture: { source: () => cProbe, success: "callback-results-installed", expectedChecks: 219 } });
		const cRoot = join(consumer, "c"), packageRoot = join(cRoot, "owned-callback-combinations-1.2.3-c");
		const manifest = await json(join(packageRoot, "lean-bridge-package.json"));
		assert.equal(manifest.schemaVersion, 7);
		assert.deepEqual(manifest.ownedValues.callbackResultAnchors, native.model.ownedGraph.callbackResultAnchors);
		await verifyNativeFiles(packageRoot, manifest.files);
		const relocated = join(root, mode + "-relocated-c"); await rename(packageRoot, relocated);
		await saveLakeFile(cRoot, "CMakeLists.txt", `cmake_minimum_required(VERSION 3.20)
project(CombinedCallbackConsumer C)
find_package(${manifest.cmakePackage} 1.2.3 EXACT CONFIG REQUIRED)
add_executable(consumer consumer.c)
target_link_libraries(consumer PRIVATE ${manifest.cmakeTarget})
target_compile_options(consumer PRIVATE -Wall -Wextra -Werror -UNDEBUG)
`);
		const compileEnvironment = { ...copiedCleanEnvironment, PATH: join(cRoot, "tools") };
		const cmakeArguments = ["-S", cRoot, "-B", "cmake-build"
			, "-G", "Unix Makefiles", "-DCMAKE_C_COMPILER=/usr/bin/cc"
			, "-DCMAKE_MAKE_PROGRAM=/usr/bin/make", `-DCMAKE_PREFIX_PATH=${relocated}`];
		await runCopied("/usr/bin/cmake", cmakeArguments, cRoot, compileEnvironment);
		await runCopied("/usr/bin/cmake", ["--build", "cmake-build"], cRoot, compileEnvironment);
		const cmake = await runCopied(join(cRoot, "cmake-build/consumer"), [], cRoot);
		assert.equal(cmake.stderr, ""); assert.equal(cmake.stdout, "callback-results-installed:219\n");
		const jsRoot = join(consumer, "npm");
		await saveLakeFile(jsRoot, "package.json", canonicalJson({ name: "installed-callback-combinations", version: "1.0.0", private: true, type: "module" }));
		const consumerEnvironment = { ...environment, PATH: `${dirname(process.execPath)}:/usr/bin:/bin`
			, CC: "/unavailable/compiler", CXX: "/unavailable/compiler"
			, LEAN_BRIDGE_LEAN_PREFIX: "/unavailable/lean"
			, LEAN_BRIDGE_JS_EMSDK: "/unavailable/emsdk"
			, LEAN_BRIDGE_NATIVE_ROOT: "/unavailable/runtime"
			, LEAN_BRIDGE_RUNTIME_ROOT: "/unavailable/runtime" };
		const consume = (command, args) => run(command, args, jsRoot, consumerEnvironment, 180000);
		await consume("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", ...npm.map(item => join(handoff, item.artifacts[0].path))]);
		await rm(handoff, { recursive: true }); await assert.rejects(access(handoff), { code: "ENOENT" });
		const inventory = await ownedJavaScriptReceiverInventory(join(jsRoot, "node_modules"));
		assert.ok(Object.keys(inventory).length > 50);
		await saveLakeFile(jsRoot, "probe.mjs", jsProbe);
		await saveLakeFile(jsRoot, "call.mjs", `import api from ${JSON.stringify(component.name)};
import {runCallbackCombinations} from "./probe.mjs";
console.log(JSON.stringify(runCallbackCombinations(api)));
if(!api.close() || api.close()) throw new Error("Component close failed");
`);
		const observed = JSON.parse((await consume(process.execPath, ["call.mjs"])).stdout);
		assert.deepEqual(observed, { checks: 40, receiverMethods: true
			, transitiveExpiration: true
			, consumingHandoff: true, borrowedTransferRejected: true });
		await saveLakeFile(jsRoot, "consumer.mts", `import api, {type Bundle, type BundleValue} from ${JSON.stringify(component.name)};
const ticket = api.newTicket(42n, "typed");
const root: BundleValue = api.echoRecord({primary:ticket.get(),spare:{tag:"none"},peers:[],history:[],payload:{count:0n,bytes:new Uint8Array()}});
const shared: BundleValue = root.share();
const closure = root.makeRecord();
const child: BundleValue = closure.get()(false, root);
const nested: BundleValue = child.borrowRecord();
const retained: BundleValue = nested.retain();
const moved: BundleValue = shared.moveRecord(value => value);
// @ts-expect-error Callback anchor arguments require a whole owner.
closure.get()(false, root.get());
// @ts-expect-error A callback's selected owner must have the matching type.
closure.get()(false, ticket);
// @ts-expect-error Receiver-borrowing methods require whole owners.
root.get().borrowRecord();
// @ts-expect-error A consuming receiver must not accept a raw payload.
api.moveRecord(root.get(), value => value);
// @ts-expect-error A borrowed callback result is not an unowned record.
const raw: Bundle = closure.get()(false, root);
// @ts-expect-error Callback reply owners must match their declared payload.
root.moveRecord(() => ticket);
for(const value of [ticket,root,shared,closure,child,nested,retained,moved]) value.dispose();
api.close();
`);
		await consume(process.execPath, [resolve("node_modules/typescript/bin/tsc"), "--strict", "--noEmit", "--target", "ES2022", "--module", "NodeNext", "--moduleResolution", "NodeNext", "--skipLibCheck", "false", "consumer.mts"]);
		await saveLakeFile(jsRoot, "documentation.mjs", `import api from ${JSON.stringify(component.name)};\n${example}\napi.close();\n`);
		const documentation = await consume(process.execPath, ["documentation.mjs"]);
		assert.equal(documentation.stderr, ""); assert.equal(documentation.stdout, "42n\ntrue\n42n\n");
		const browser = await checkOwnedJavaScriptBrowsers({
			root: jsRoot, name: component.name, run: consume
			, probeSource: `import api from ${JSON.stringify(component.name)};\n${jsProbe}\nexport const run = () => runCallbackCombinations(api);\nexport const close = () => api.close();\n`
			, expected: observed });
		await saveLakeFile("build/owned-callback-results", `${mode}-combined-package.json`, canonicalJson({
			schemaVersion: 1, mode, cli: candidate.report
			, compilerInputsIdentity: inputs.identity
			, built, receipt, native, wasm, nativeInput, wasmInput
			, manifest, installedC, cmake: true
			, observed, inventory, browser, installedTypeScript: true
			, cliFilesVerified: candidate.report.files.length, sourceUnchanged: true
			, producerAndCliRemovedBeforeInstall: true
			, compilerFreeConsumerEnvironment: true
			, cProbeSha256: sha256(cProbe), jsProbeSha256: sha256(jsProbe)
			, documentation: { sourceSha256: sha256(example), output: documentation.stdout }
		}));
		t.diagnostic(`${mode}: ${installedC.checks} C checks via pkg-config and relocated CMake; ${observed.checks} JS checks in Node and nine browser contexts`);
		for(const path of [consumer, relocated]) await rm(path, { recursive: true });
	}
});
