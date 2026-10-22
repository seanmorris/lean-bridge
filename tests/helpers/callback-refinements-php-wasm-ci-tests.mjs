/**
 * Recurring workflow and verifier registration for checked PHP-Wasm callbacks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	callbackRefinementsPhpWasmRecords
} from "./callback-refinements-php-wasm-report.mjs";

test("checked callback PHP-Wasm workflow retains exact reports and runs their verifier", async () => {
	const manifest = JSON.parse(await readFile("package.json", "utf8"));
	assert.equal(manifest.scripts["test:callback-refinements-php-wasm"]
		, "LEAN_BRIDGE_CALLBACK_REFINEMENTS_PHP_WASM_TEST=1 node --test --test-concurrency=1 tests/callback-refinements-php-wasm.test.mjs");
	const workflow = await readFile(".github/workflows/callback-refinements-php-wasm.yml", "utf8");
	for(const value of [
		"npm run test:callback-refinements-php-wasm"
		, "check-callback-refinements-php-wasm-reports.mjs"
		, "build/callback-refinements-php-wasm/records/index.json"
		, "build/callback-refinements-php-wasm/verification.json"
		, "callback-refinements-php-wasm-${{ github.sha }}"
	]) assert.ok(workflow.includes(value), value);
	assert.match(workflow, /timeout-minutes: 360/u);
	assert.match(workflow, /timeout-minutes: 240/u);
});

test("checked callback PHP-Wasm verifier requires every original route record", () => {
	for(const profile of ["fin", "checked-record"])
		for(const route of ["ordinary", "reviewed"])
		{
			const records = callbackRefinementsPhpWasmRecords(profile, route);
			assert.equal(records.length, route === "reviewed" ? 39 : 37);
			assert.equal(new Set(records).size, records.length);
			for(const path of ["report.json", "reviewed.binding-ir.json"
				, "build-0/model.json", "build-1/model.json"
				, "deployment/weak.php", "deployment/strict.php"
				, "executions/0.json", "executions/11.json"])
				assert.ok(records.includes(path), `${profile}/${route}/${path}`);
		}
});
