/**
 * Static controls for the hosted #1827 flat copied producer matrix.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	phpWasmIndexedRefinementEntryFamilies, phpWasmIndexedRefinementEntryRoutes
} from "./php-wasm-indexed-refinement-entry-fixtures.mjs";

test("hosted indexed entry workflow covers every family and source route", async () => {
	const workflow = await readFile(".github/workflows/php-wasm-indexed-refinement-entry.yml", "utf8");
	const shell = await readFile("scripts/run-php-wasm-refinement-entry-ci.sh", "utf8");
	for(const family of phpWasmIndexedRefinementEntryFamilies)
		assert.ok(workflow.includes(`          - ${family}\n`), family);
	for(const route of phpWasmIndexedRefinementEntryRoutes)
		assert.ok(workflow.includes(`          - ${route}\n`), route);
	assert.match(workflow, /max-parallel: 2/u);
	assert.match(workflow, /timeout-minutes: 240/u);
	assert.match(workflow, /run: bash scripts\/install-playwright-browsers\.sh chromium/u);
	assert.match(workflow, /Consumer PHP must run without Xdebug/u);
	assert.match(workflow, /tests\/helpers\/php-wasm-refinement-entry-report-tests\.mjs/u);
	assert.match(workflow, /if: always\(\)\n {8}uses: actions\/upload-artifact@v7/u);
	assert.match(workflow, /if: always\(\) && steps\.acceptance\.outcome != 'success'/u);
	assert.match(workflow, /LEAN_BRIDGE_REFINEMENT_ENTRY_PHP_WASM_FAMILIES: \$\{\{ matrix\.family \}\}/u);
	assert.match(workflow, /LEAN_BRIDGE_REFINEMENT_ENTRY_PHP_WASM_ROUTES: \$\{\{ matrix\.route \}\}/u);
	for(const family of phpWasmIndexedRefinementEntryFamilies)
		assert.ok(shell.includes(family), family);
	assert.match(shell, /instrumented PHP-Wasm copied package closes/u);
	assert.match(shell, /node scripts\/check-php-wasm-refinement-entry-records\.mjs/u);
	assert.match(shell, /--producer "\$revision"/u);
});

test("indexed entry workflow keeps exact artifacts and bounded resources", async () => {
	const workflow = await readFile(".github/workflows/php-wasm-indexed-refinement-entry.yml", "utf8");
	assert.match(workflow, /concurrency:\n {2}group: php-wasm-indexed-refinement-entry-\$\{\{ github\.ref \}\}/u);
	assert.match(workflow, /EMCC_CORES: "2"/u);
	assert.match(workflow, /fetch-depth: 0/u);
	assert.match(workflow, /persist-credentials: false/u);
	assert.match(workflow, /if-no-files-found: error/u);
	assert.match(workflow, /retention-days: 30/u);
	assert.doesNotMatch(workflow, /continue-on-error|\|\| true/u);
});
