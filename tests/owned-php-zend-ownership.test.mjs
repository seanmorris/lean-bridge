/**
 * Real Zend resources backed by compiled Lean values in the pinned PHP-Wasm VM.
 *
 * @file
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson } from "../src/capsule/node.mjs";
import { checkOwnedPhpZendOwnership } from "./helpers/owned-php-zend-ownership.mjs";
import { checkOwnedZendNativeFibers } from "./helpers/owned-php-zend-native.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("owned Zend resources preserve leases, callback borrows and failure cleanup in actual PHP-Wasm", {
	skip: process.env.LEAN_BRIDGE_OWNED_PHP_ZEND_TEST !== "1", timeout: 600000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-owned-zend-lifetime-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const report = await checkOwnedPhpZendOwnership(directory, message => t.diagnostic(message));
	await saveLakeFile("build/owned-php-zend", "lifetime.json", canonicalJson(report));
});

test("the Zend lifetime layer executes real Fiber entry guards and deferred destruction in native PHP", {
	skip: process.env.LEAN_BRIDGE_OWNED_ZEND_FIBER_TEST !== "1", timeout: 600000
}, checkOwnedZendNativeFibers);
