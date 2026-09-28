/**
 * Every generated owned downcall and typed Zend callback compiles for wasm32.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { generateOwnedNativeValueAdapters } from "../src/backends/native/owned-value-adapters.mjs";
import { ownedAggregateLeaseSource } from "../src/backends/native/owned-aggregate-leases.mjs";
import { generateOwnedPhpZendExtension } from "../src/backends/php/owned-zend-extension.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const inputs = async () => JSON.parse(await readFile("docs/evidence/owned-aggregate-execution-20260926.json", "utf8")).inputs;

test("owned Zend extensions require the exact wasm32 layout and authenticated host callbacks", async () => {
	const input = (await inputs()).aggregates;
	assert.throws(() => generateOwnedPhpZendExtension(generateOwnedNativeValueAdapters(input)), /wasm32/u);
	assert.throws(() => generateOwnedPhpZendExtension(generateOwnedNativeValueAdapters({ ...input, wordBits: 32 })), /callback carriers/u);
	const native = generateOwnedNativeValueAdapters({ ...input, wordBits: 32, hostCallbacks: true });
	const generated = generateOwnedPhpZendExtension(native);
	assert.deepEqual(generated, generateOwnedPhpZendExtension(native));
	assert.equal(generated.model.callbacks.length, native.carriers.hostCallbacks.length);
	for(const fn of generated.model.functions) assert.ok(generated.source.includes(`static ZEND_FUNCTION(lgo_call${fn.index})`));
	for(const fn of generated.model.callbacks)
	{
		assert.ok(generated.source.includes(`static ZEND_FUNCTION(lgo_invoke${fn.index})`));
		assert.ok(generated.source.includes(`static lean_object *lgo_host${fn.index}_invoke`));
		assert.equal(fn.hostArguments[0], false);
	}
	assert.doesNotMatch(generated.source, /\bFFI\b|CData|gmp_/u);
});

test("owned Zend scalar and recursive extensions compile every downcall and host trampoline", {
	skip: process.env.LEAN_BRIDGE_OWNED_PHP_ZEND_TEST !== "1", timeout: 180000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-owned-zend-extension-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const sdk = resolve(process.env.LEAN_BRIDGE_PHP_EMSDK ?? ".toolchains/emsdk-php-wasm");
	const php = resolve(process.env.LEAN_BRIDGE_PHP_SOURCE ?? "build/php-wasm-sdk/php8.4-src");
	const runtime = resolve(process.env.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME ?? "build/owned-wasm32-runtime");
	for(const [name, input] of Object.entries(await inputs()))
	{
		const native = generateOwnedNativeValueAdapters({ ...input, wordBits: 32, hostCallbacks: true });
		const extension = generateOwnedPhpZendExtension(native);
		for(const [path, source] of Object.entries({ "owned-values.h": native.typesHeader
			, "owned-values-codec.h": native.source
			, "owned-leases.h": ownedAggregateLeaseSource
			, "carriers.h": native.carriers.header, "extension.c": extension.source }))
			await saveLakeFile(directory, path, source);
		await processBuildRunner.capture({ command: join(sdk, "upstream/emscripten/emcc")
			, args: ["-fsyntax-only", "-Wall", "-Wextra", "-Werror"
				, "-Wno-unused-function", "-Wno-unused-parameter"
				, "-fbracket-depth=4096", "-DLEAN_EMSCRIPTEN"
				, ...[directory, join(runtime, "include"), php, ...["Zend", "main", "TSRM", "ext"].map(path => join(php, path))].flatMap(path => ["-I", path])
				, "extension.c"]
			, cwd: directory, timeoutMs: 60000
			, env: { ...process.env, EM_CONFIG: join(sdk, ".emscripten"), EMSDK: sdk }
		}).catch(error => { error.message += ": " + (error.details?.stderr ?? ""); throw error; });
		t.diagnostic(`${name}: ${extension.model.functions.length} exports, ${extension.model.callbacks.length} typed callbacks`);
	}
});
