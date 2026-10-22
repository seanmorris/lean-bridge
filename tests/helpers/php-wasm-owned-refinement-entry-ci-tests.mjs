/**
 * Static controls for the hosted #1825 producer matrix and narrowed shell.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("hosted owned entry workflow covers both families and source routes", async () => {
	const workflow = await readFile(".github/workflows/php-wasm-owned-refinement-entry.yml", "utf8");
	const shell = await readFile("scripts/run-php-wasm-owned-refinement-entry-ci.sh", "utf8");
	for(const family of ["owned-subtype", "owned-checked-record"])
		assert.ok(workflow.includes(`          - ${family}\n`), family);
	for(const route of ["ordinary", "reviewed"])
		assert.ok(workflow.includes(`          - ${route}\n`), route);
	assert.match(workflow, /max-parallel: 2/u);
	assert.match(workflow, /timeout-minutes: 240/u);
	assert.match(workflow, /run: bash scripts\/install-playwright-browsers\.sh chromium/u);
	assert.match(workflow, /Consumer PHP must run without Xdebug/u);
	assert.match(workflow, /php-wasm-owned-refinement-entry-plan-tests\.mjs/u);
	assert.match(workflow, /if: always\(\)\n {8}uses: actions\/upload-artifact@v7/u);
	assert.match(workflow, /if: always\(\) && steps\.acceptance\.outcome != 'success'/u);
	assert.match(workflow, /LEAN_BRIDGE_OWNED_REFINEMENT_ENTRY_PHP_WASM_FAMILIES: \$\{\{ matrix\.family \}\}/u);
	assert.match(workflow, /LEAN_BRIDGE_OWNED_REFINEMENT_ENTRY_PHP_WASM_ROUTES: \$\{\{ matrix\.route \}\}/u);
	assert.match(shell, /test "\$\(git rev-parse HEAD\)" = "\$revision"/u);
	assert.match(shell, /--test-concurrency=1/u);
	assert.match(shell, /node scripts\/check-php-wasm-refinement-entry-records\.mjs/u);
	assert.match(shell, /--producer "\$revision"/u);
	assert.match(shell, /test -s "\$check"/u);
});

test("hosted owned entry shell refuses ambiguous or incomplete selection", async () => {
	const source = await readFile("scripts/run-php-wasm-owned-refinement-entry-ci.sh", "utf8");
	assert.match(source, /Select exactly one known owned refinement-entry family/u);
	assert.match(source, /Select exactly one owned refinement-entry source route/u);
	assert.match(source, /Owned refinement entry output already exists/u);
	assert.doesNotMatch(source, /\|\| true|continue-on-error/u);
});
