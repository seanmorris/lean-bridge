/**
 * Consuming APIs installed from original npm and Composer archives.
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

test("installed PHP-Wasm transfer packages consume shared owners in Node and Chromium", {
	skip: process.env.LEAN_BRIDGE_OWNED_PHP_WASM_TRANSFER_TEST !== "1"
	, timeout: 1800000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-owned-php-wasm-transfers-installed-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const report = await checkOwnedPhpWasmPackages(directory, message => {
		t.diagnostic(message); process.stderr.write(message + "\n");
	}, { transferredInputs: true });
	await saveLakeFile("build/owned-php-wasm-transfers", "packages.json", canonicalJson(report));
});
