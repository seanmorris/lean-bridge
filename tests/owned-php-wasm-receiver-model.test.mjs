/**
 * Preserve receiver ownership and nominal members in the wasm32 Zend model.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileOwnedPhpZendModel } from "../src/backends/php/owned-zend-model.mjs";
import { generateOwnedPhpZendPhp } from "../src/backends/php/owned-zend-php.mjs";
import { generateOwnedNativeValueAdapters } from "../src/backends/native/owned-value-adapters.mjs";
import { generateOwnedPhpZendExtension } from "../src/backends/php/owned-zend-extension.mjs";
import { createCompiledPhpWasmModel, generateCompiledPhpWasmLeanAdapters } from "../src/build/php-wasm-graph-model.mjs";
import { generateCompiledPhpWasmOwned } from "../src/build/php-wasm-owned-component.mjs";
import { ownedRustReceiverReviewedIr } from "./helpers/owned-rust-receiver-fixture.mjs";
import { ownedJvmPlainReceiverReviewedIr } from "./helpers/owned-jvm-receiver-fixture.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { prepareOwnedPhpWasmRuntime } from "./helpers/owned-php-wasm-runtime.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const capabilities = { receiverExports: true, transferredInputs: true, anchoredResults: true };

test("Zend receiver members preserve nominal owners and original parameter positions", () => {
	const ir = ownedRustReceiverReviewedIr(), before = canonicalJson(ir);
	assert.throws(() => compileOwnedPhpZendModel(ir, { transferredInputs: true, anchoredResults: true }), /only synchronous function exports/u);
	const model = compileOwnedPhpZendModel(ir, capabilities), files = generateOwnedPhpZendPhp(model);
	assert.equal(canonicalJson(ir), before);
	assert.equal(model.receiverExports, true); assert.equal(model.wholeOwners, true);
	assert.equal(model.wordBits, 32); assert.equal(model.integerBits, 32);
	assert.equal(model.functions.filter(fn => fn.receiver === 0).length, 16);
	assert.equal(model.functions.filter(fn => fn.anchor !== undefined).length, 20);
	assert.equal(model.functions.find(fn => fn.name === "chooseTicket").anchor, 1);
	assert.equal(model.functions.find(fn => fn.name === "retainTicket").anchor, 0);
	for(const name of ["Ticket", "Bundle", "Choice", "Tree"])
		assert.match(files["src/Api.php"], new RegExp(`final class ${name}Value extends Value`, "u"));
	assert.match(files["src/Api.php"], /public function chooseTicket\(mixed \$owner1\): TicketValue/u);
	assert.match(files["src/Api.php"], /'serial' => serial\(\$this->get\(\)\)/u);
	assert.match(files["src/Api.php"], /return retain_ticket\(\$this\);/u);
	assert.match(files["src/Api.php"], /return new static\(Internal\\Native::owner\('share'/u);
	assert.doesNotMatch(Object.values(files).join("\n"), /FFI|NativeBinding|LeaseOwner/u);
});

test("Zend resource receivers do not require result anchors or callback transport", () => {
	for(const consuming of [false, true])
	{
		const model = compileOwnedPhpZendModel(ownedJvmPlainReceiverReviewedIr(consuming), {
			receiverExports: true, transferredInputs: consuming, hostCallbacks: false
		});
		assert.equal(model.wholeOwners, true); assert.equal(model.anchoredResults, undefined);
		assert.equal(model.hostCallbacks, false); assert.deepEqual(model.callbacks, []);
		const files = generateOwnedPhpZendPhp(model);
		assert.match(files["src/Api.php"], /final class TicketValue extends Value/u);
		assert.doesNotMatch(Object.values(files).join("\n"), /WithRecovery|with_recovery|NativeBinding/u);
	}
});

test("PHP-Wasm receiver components authenticate methods and properties on both source paths", async () => {
	const previous = JSON.parse(await readFile("docs/evidence/owned-perl-receivers-20261001.json", "utf8"));
	for(const { input } of previous.runtime)
	{
		assert.throws(() => createCompiledPhpWasmModel({ ...input, receiverExports: false }), /receiver-capable consumer/u);
		const model = createCompiledPhpWasmModel({ ...input, receiverExports: true });
		assert.equal(model.schemaVersion, 10); assert.equal(model.ownedGraph.schemaVersion, 5);
		assert.equal(model.pointerBits, 32); assert.equal(model.ownedGraph.receiverExports.exports.length, 16);
		assert.equal(model.ownedGraph.resultAnchors.exports.length, 20);
		const adapters = generateCompiledPhpWasmLeanAdapters(model);
		const generated = generateCompiledPhpWasmOwned(model, input.metadata, adapters);
		assert.equal(generated.manifest.schemaVersion, 4); assert.equal(generated.receipt.schemaVersion, 4);
		assert.deepEqual(generated.manifest.receiverExports, model.ownedGraph.receiverExports);
		assert.deepEqual(generated.receipt.receiverExports, model.ownedGraph.receiverExports);
		assert.deepEqual(generated.receipt.files, Object.fromEntries(Object.entries(generated.files).map(([path, source]) => [path, sha256(source)])));
		const native = generateOwnedNativeValueAdapters({ ...input, ...capabilities, wordBits: 32, hostCallbacks: true });
		assert.equal(generateOwnedPhpZendExtension(native).source, generated.files[`extension/${generated.manifest.extension}.c`]);
		for(const mutate of [
			value => { value.schemaVersion = 9; }
			, value => { delete value.ownedGraph.receiverExports; }
			, value => { value.ownedGraph.receiverExports.exports[0].kind = "function"; }
			, value => { value.ownedGraph.receiverExports.exports[0].argument = 1; }
			, value => { value.ownedGraph.resultAnchors.exports.pop(); }
			, value => { value.ownedGraph.layoutSha256 = "0".repeat(64); }
		]) {
			const changed = structuredClone(model); mutate(changed);
			assert.throws(() => generateCompiledPhpWasmLeanAdapters(changed));
			assert.throws(() => generateCompiledPhpWasmOwned(changed, input.metadata, adapters));
		}
	}
});

test("receiver Zend C and PHP compile with pinned wasm32 headers and optional capabilities", {
	skip: process.env.LEAN_BRIDGE_OWNED_PHP_WASM_RECEIVER_TEST !== "1"
	, timeout: 600000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-zend-receiver-syntax-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const runtime = await prepareOwnedPhpWasmRuntime(directory);
	const sdk = resolve(process.env.LEAN_BRIDGE_PHP_EMSDK ?? ".toolchains/emsdk-php-wasm");
	const php = resolve(process.env.LEAN_BRIDGE_PHP_SOURCE ?? "build/php-wasm-sdk/php8.4-src");
	const previous = JSON.parse(await readFile("docs/evidence/owned-perl-receivers-20261001.json", "utf8"));
	for(const [index, item] of [...previous.runtime, ...previous.plain].entries())
	{
		const plain = previous.plain.includes(item);
		const model = createCompiledPhpWasmModel({ ...item.input, receiverExports: true
			, hostCallbacks: !plain, anchoredResults: !plain
			, transferredInputs: plain ? item.consuming : true });
		const adapters = generateCompiledPhpWasmLeanAdapters(model);
		const generated = generateCompiledPhpWasmOwned(model, item.input.metadata, adapters);
		if(plain)
		{
			assert.equal(model.ownedGraph.hostCallbacks, undefined);
			assert.equal(model.ownedGraph.resultAnchors, undefined);
			assert.equal(generated.files["owned/callbacks.c"], undefined);
		}
		const root = join(directory, String(index));
		for(const [path, source] of Object.entries({ ...generated.files, "component.h": adapters.header }))
			await saveLakeFile(root, path, source);
		for(const path of generated.manifest.phpFiles)
			await processBuildRunner.capture({ command: "/usr/bin/php", args: ["-n", "-l", path], cwd: root });
		const roots = [root, join(root, "owned"), join(runtime.root, "include"), php
			, ...["Zend", "main", "TSRM", "ext"].map(path => join(php, path))];
		await processBuildRunner.capture({ command: join(sdk, "upstream/emscripten/emcc")
			, args: ["-fsyntax-only", "-DLEAN_EMSCRIPTEN", "-fbracket-depth=4096"
				, "-Wall", "-Wextra", "-Werror"
				, "-Wno-unused-parameter", "-Wno-unused-function"
				, ...roots.flatMap(path => ["-I", path]), ...generated.sources]
			, cwd: root, timeoutMs: 300000
			, env: { ...process.env, EM_CONFIG: join(sdk, ".emscripten"), EMSDK: sdk }
		}).catch(error => { throw new Error(JSON.stringify(error.details ?? error.message), { cause: error }); });
		t.diagnostic(`${item.mode}: ${plain ? "resource-only" : "anchored"}, consuming=${plain ? item.consuming : true}`);
	}
});
