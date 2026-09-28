/**
 * Prepared resource-bearing PHP-Wasm APIs, not producer-tree imports.
 *
 * @file
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson } from "../src/capsule/node.mjs";
import { checkOwnedPhpWasmPackages } from "./helpers/owned-php-wasm-packages.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("installed CLI builds ordinary and reviewed owned PHP-Wasm archives for npm and Composer consumers", {
	skip: process.env.LEAN_BRIDGE_OWNED_PHP_WASM_PACKAGE_TEST !== "1"
	, timeout: 900000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-owned-php-wasm-packages-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const report = await checkOwnedPhpWasmPackages(root, message => { t.diagnostic(message); process.stderr.write(message + "\n"); });
	await saveLakeFile("build/owned-php-wasm", "packages-cli.json", canonicalJson(report));
});
