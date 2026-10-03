/**
 * Authenticate callback-result whole owners on the wasm32 Zend transport.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { createOwnedPhpWasmModel, generateOwnedPhpWasmLeanAdapters } from "../src/build/php-wasm-owned-model.mjs";
import { generateCompiledPhpWasmOwned } from "../src/build/php-wasm-owned-component.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { brokerHeader } from "../src/backends/native/runtime-broker.mjs";
import { nativeCallbackHeader } from "../src/build/native-component.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { checkOwnedPhpWasmPackages } from "./helpers/owned-php-wasm-packages.mjs";

const observations = async () => {
	const archive = JSON.parse(await readFile("docs/evidence/owned-php-callback-runtime-staged-20261003.json", "utf8"));
	return Object.fromEntries(Object.entries(archive.reports).map(([name, item]) => [name
		, JSON.parse(gunzipSync(Buffer.from(item.gzipBase64, "base64")))]));
};

test("PHP-Wasm callback-result models preserve every compiler-authenticated lifetime", async () => {
	for(const [name, observation] of Object.entries(await observations()))
	{
		const before = canonicalJson(observation.input);
		const model = createOwnedPhpWasmModel({ ...observation.input, ...observation.options });
		assert.equal(canonicalJson(observation.input), before, name);
		assert.equal(model.schemaVersion, 11); assert.equal(model.ownedGraph.schemaVersion, 6);
		assert.equal(model.pointerBits, 32); assert.equal(model.profile, "php-wasm-copied-v1");
		assert.equal(model.ownedGraph.callbackResultAnchors.signatures.length, 4);
		assert.equal(Boolean(model.ownedGraph.hostCallbacks), observation.options.hostCallbacks);
		for(const capability of ["inputTransfers", "resultAnchors", "receiverExports"])
			assert.equal(Boolean(model.ownedGraph[capability]), observation.variant === "combined", `${name}: ${capability}`);
		const adapters = generateOwnedPhpWasmLeanAdapters(model);
		const generated = generateCompiledPhpWasmOwned(model, observation.input.metadata, adapters);
		assert.equal(generated.manifest.schemaVersion, 5); assert.equal(generated.receipt.schemaVersion, 5);
		assert.deepEqual(generated.manifest.callbackResultAnchors, model.ownedGraph.callbackResultAnchors);
		assert.deepEqual(generated.receipt.callbackResultAnchors, model.ownedGraph.callbackResultAnchors);
		assert.equal(Boolean(generated.files["owned/callbacks.c"]), observation.options.hostCallbacks);
		assert.match(generated.files["src/Api.php"], /function copyArg\(mixed \$index, mixed \$value\): Value/u);
		assert.match(generated.files["src/Api.php"], /function copyResult\(mixed \$value\): Value/u);
		assert.match(generated.files["src/Internal/Native.php"], /function copyCallback\(mixed \$closure, \?int \$index, mixed \$value\):/u);
		if(observation.options.hostCallbacks)
		{
			assert.match(generated.files["src/Internal/Native.php"], /\['owner' => \$owner, 'value' => \$wire\]/u);
			assert.match(generated.files[`extension/${generated.manifest.extension}.c`], /lgo_lease \*reply_pin/u);
		}
		assert.deepEqual(generated.receipt.files, Object.fromEntries(Object.entries(generated.files)
			.map(([path, source]) => [path, sha256(source)])));
	}
});

test("PHP-Wasm callback-result generation rejects disabled and forged capabilities", async () => {
	const observation = (await observations())["reviewed-host.json"];
	assert.throws(() => createOwnedPhpWasmModel({ ...observation.input, ...observation.options
		, callbackResultAnchors: false }), /callback-result lifetime consumer adapter/u);
	const model = createOwnedPhpWasmModel({ ...observation.input, ...observation.options });
	const adapters = generateOwnedPhpWasmLeanAdapters(model);
	for(const mutate of [
		value => { value.schemaVersion = 10; }
		, value => { value.ownedGraph.schemaVersion = 5; }
		, value => { delete value.ownedGraph.callbackResultAnchors; }
		, value => { value.ownedGraph.callbackResultAnchors.signatures[0].parameter++; }
		, value => { value.ownedGraph.callbackResultAnchors.hostResultHandoff = "after-callback"; }
		, value => { value.ownedGraph.layoutSha256 = "0".repeat(64); }
	]) {
		const changed = structuredClone(model); mutate(changed);
		assert.throws(() => generateOwnedPhpWasmLeanAdapters(changed));
		assert.throws(() => generateCompiledPhpWasmOwned(changed, observation.input.metadata, adapters));
	}
});

test("PHP-Wasm callback-result PHP sources parse on the supported language surface", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-zend-callback-php-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	for(const [index, observation] of Object.values(await observations()).entries())
	{
		const model = createOwnedPhpWasmModel({ ...observation.input, ...observation.options });
		const generated = generateCompiledPhpWasmOwned(model, observation.input.metadata, generateOwnedPhpWasmLeanAdapters(model));
		const root = join(directory, String(index));
		for(const path of generated.manifest.phpFiles)
		{
			await saveLakeFile(root, path, generated.files[path]);
			await processBuildRunner.capture({ command: "/usr/bin/php", args: ["-n", "-l", path], cwd: root });
		}
	}
});

test("PHP-Wasm callback-result Zend C parses with pinned wasm32 headers", {
	skip: process.env.LEAN_BRIDGE_OWNED_PHP_WASM_CALLBACK_RESULT_TEST !== "1"
	, timeout: 600000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-zend-callback-c-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const runtime = join(directory, "runtime");
	const runtimeHeader = brokerHeader.replace("#ifdef __cplusplus\n}", `${nativeCallbackHeader}\n#ifdef __cplusplus\n}`);
	await saveLakeFile(runtime, "include/lean_bridge_native_runtime.h", runtimeHeader);
	const leanHeaders = resolve(process.env.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME
		?? "build/type-corpus/php-wasm-callable-runtime", "include");
	const sdk = resolve(process.env.LEAN_BRIDGE_PHP_EMSDK ?? ".toolchains/emsdk-php-wasm");
	const php = resolve(process.env.LEAN_BRIDGE_PHP_SOURCE ?? "build/php-wasm-sdk/php8.4-src");
	for(const [index, observation] of Object.values(await observations()).entries())
	{
		const model = createOwnedPhpWasmModel({ ...observation.input, ...observation.options });
		const adapters = generateOwnedPhpWasmLeanAdapters(model);
		const generated = generateCompiledPhpWasmOwned(model, observation.input.metadata, adapters);
		const root = join(directory, String(index));
		for(const [path, source] of Object.entries({ ...generated.files, "component.h": adapters.header }))
			await saveLakeFile(root, path, source);
		const roots = [root, join(root, "owned")
			, join(runtime, "include"), leanHeaders, php
			, ...["Zend", "main", "TSRM", "ext"].map(path => join(php, path))];
		await processBuildRunner.capture({ command: join(sdk, "upstream/emscripten/emcc")
			, args: ["-fsyntax-only", "-DLEAN_EMSCRIPTEN", "-fbracket-depth=4096"
				, "-Wall"
				, "-Wextra"
				, "-Werror"
				, "-Wno-unused-parameter"
				, "-Wno-unused-function"
				, ...roots.flatMap(path => ["-I", path]), ...generated.sources]
			, cwd: root, timeoutMs: 300000
			, env: { ...process.env, EM_CONFIG: join(sdk, ".emscripten"), EMSDK: sdk }
		}).catch(error => { throw new Error(JSON.stringify(error.details ?? error.message), { cause: error }); });
	}
});

const packageEnabled = process.env.LEAN_BRIDGE_OWNED_PHP_WASM_CALLBACK_RESULT_PACKAGE_TEST === "1";
const selectedVariant = process.env.LEAN_BRIDGE_OWNED_PHP_WASM_CALLBACK_RESULT_VARIANT;
for(const variant of ["no-host", "host", "combined"])
test(`installed PHP-Wasm callback-result owners execute in Node and Chromium (${variant})`, {
	skip: !packageEnabled || (selectedVariant !== undefined && selectedVariant !== variant)
	, timeout: 2400000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), `lean-owned-php-wasm-callback-results-${variant}-`));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const report = await checkOwnedPhpWasmPackages(directory, message => {
		t.diagnostic(message); process.stderr.write(message + "\n");
	}, { callbackVariant: variant });
	await saveLakeFile("build/owned-php-wasm-callback-results", `${variant}-packages.json`, canonicalJson(report));
});
