/**
 * Actual-wasm32 execution for the recursive Zend conversion layer.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson } from "../src/capsule/node.mjs";
import { checkPhpWasmRecursiveGenerated } from "./helpers/php-wasm-recursive-callable-generated.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { withPhpWasmRecursiveFailureEvidence } from "./helpers/php-wasm-recursive-failure-evidence.mjs";
import "./helpers/php-wasm-recursive-failure-evidence-tests.mjs";

test("generated recursive Zend callables execute in actual wasm32 PHP with allocation-failure cleanup", {
	skip: process.env.LEAN_BRIDGE_PHP_WASM_RECURSIVE_GENERATED_TEST !== "1"
	, timeout: 600000
}, async t => {
	await withPhpWasmRecursiveFailureEvidence(async root => {
		const report = await checkPhpWasmRecursiveGenerated(root, message => t.diagnostic(message));
		assert.equal(report.observations.length, 2);
		await saveLakeFile("build/recursive-callables", "php-wasm-generated.json", canonicalJson(report));
	}, { diagnostic: message => t.diagnostic(message) });
});
