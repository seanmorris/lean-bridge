/**
 * Original recursive and mixed PHP-Wasm archives through Node and Chromium.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson } from "../src/capsule/node.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { checkPhpWasmRecursivePackages } from "./helpers/php-wasm-recursive-callable-packages.mjs";

for(const mixed of [false, true]) test((mixed ? "mixed primitive and recursive" : "recursive and nested-alias") + " PHP-Wasm callables execute from offline-installed npm and Composer archives", {
	skip: process.env.LEAN_BRIDGE_PHP_WASM_RECURSIVE_PACKAGE_TEST !== "1"
	, timeout: 1200000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-recursive-installed-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const report = await checkPhpWasmRecursivePackages(root, message => { t.diagnostic(message); process.stderr.write(message + "\n"); }, mixed);
	assert.equal(report.observations.length, 2);
	await saveLakeFile("build/recursive-callables", "php-wasm-" + (mixed ? "mixed-packages" : "packages") + ".json", canonicalJson(report));
});
