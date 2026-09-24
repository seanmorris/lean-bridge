/**
 * Fresh builds must reproduce recursive npm and Composer archives byte for byte.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson } from "../src/capsule/node.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { checkPhpWasmGraphReproduction, comparePhpWasmGraphBuilds } from "./helpers/php-wasm-graph-reproduction.mjs";

test("recursive PHP-Wasm reproduction rejects changed binaries, packages and observations", async () => {
	const { report } = JSON.parse(await readFile("docs/evidence/php-wasm-recursive-packages-20260924.json", "utf8"));
	assert.equal(comparePhpWasmGraphBuilds(report, structuredClone(report)).length, 2);
	for(const mutate of [
		value => { value.runtimeIdentity = "0".repeat(64); }
		, value => { value.observations.pop(); }
		, value => { value.observations[0].archives[1].sha256 = "0".repeat(64); }
		, value => { value.observations[0].receipt.wasmLibrary.sha256 = "0".repeat(64); }
		, value => { value.observations[0].installedFiles = {}; }
		, value => { value.observations[0].executions.pop(); }
		, value => { value.observations[0].browser.executions.pop(); }
		, value => { value.observations[0].authorRemoved = false; }
	]) {
		const changed = structuredClone(report); mutate(changed);
		assert.throws(() => comparePhpWasmGraphBuilds(report, changed));
	}
});

test("independent recursive PHP-Wasm builds reproduce the installed npm and Composer archives", {
	skip: process.env.LEAN_BRIDGE_PHP_WASM_GRAPH_REPRO_TEST !== "1"
	, timeout: 900000
}, async t => {
	// Compare two runs in the same packing environment. Historical archives also
	// bind Node, zlib, ICU and the compiler, which can differ on another CI host.
	const original = JSON.parse(await readFile("build/recursive/php-wasm-graph-packages.json", "utf8"));
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-graph-repro-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const report = await checkPhpWasmGraphReproduction(root, original, message => { t.diagnostic(message); process.stderr.write(message + "\n"); });
	await saveLakeFile("build/recursive", "php-wasm-graph-reproduction.json", canonicalJson(report));
});
