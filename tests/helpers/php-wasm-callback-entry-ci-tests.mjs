/**
 * Static controls for the hosted synchronous callback-entry matrix.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("hosted callback-entry workflow covers both families and ordered routes", async () => {
	const workflow = await readFile(".github/workflows/php-wasm-callback-entry.yml", "utf8");
	const shell = await readFile("scripts/run-php-wasm-callback-entry-ci.sh", "utf8");
	for(const family of ["callback-fin", "callback-checked-record"])
		assert.ok(workflow.includes(`          - ${family}\n`), family);
	assert.match(workflow, /max-parallel: 2/u);
	assert.match(workflow, /timeout-minutes: 240/u);
	assert.match(workflow, /run: bash scripts\/install-playwright-browsers\.sh chromium/u);
	assert.match(workflow, /Consumer PHP must run without Xdebug/u);
	assert.match(workflow, /tests\/helpers\/php-wasm-callback-entry-report-tests\.mjs/u);
	assert.match(workflow, /LEAN_BRIDGE_CALLBACK_ENTRY_PHP_WASM_ROUTES: ordinary,reviewed/u);
	assert.match(workflow, /if: always\(\)\n {8}uses: actions\/upload-artifact@v7/u);
	assert.match(workflow, /if: always\(\) && steps\.acceptance\.outcome != 'success'/u);
	assert.match(shell, /test "\$\(git rev-parse HEAD\)" = "\$revision"/u);
	assert.match(shell, /--test-concurrency=1/u);
	assert.match(shell, /for route in ordinary reviewed/u);
	assert.match(shell, /node scripts\/check-php-wasm-callback-entry-records\.mjs/u);
	assert.match(shell, /--producer "\$revision"/u);
	assert.match(shell, /test -s "\$output\/index\.json"/u);
});

test("hosted callback-entry shell refuses ambiguous or incomplete selection", async () => {
	const source = await readFile("scripts/run-php-wasm-callback-entry-ci.sh", "utf8");
	assert.match(source, /Select exactly one known callback-entry family/u);
	assert.match(source, /requires ordinary,reviewed route order/u);
	assert.match(source, /Callback entry output already exists/u);
	assert.doesNotMatch(source, /\|\| true|continue-on-error/u);
});
