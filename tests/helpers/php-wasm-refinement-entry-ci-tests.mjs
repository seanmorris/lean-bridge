/**
 * Static controls for the hosted #1824 producer matrix and its narrowed shell.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("hosted graph entry workflow covers every family and source route", async () => {
	const workflow = await readFile(".github/workflows/php-wasm-refinement-entry.yml", "utf8");
	const shell = await readFile("scripts/run-php-wasm-refinement-entry-ci.sh", "utf8");
	for(const family of [
		"nominal-full", "nominal-result-only", "recursive-subtype"
		, "recursive-checked-record"
	]) assert.ok(workflow.includes(`          - ${family}\n`), family);
	for(const route of ["ordinary", "reviewed"])
		assert.ok(workflow.includes(`          - ${route}\n`), route);
	assert.match(workflow, /max-parallel: 2/u);
	assert.match(workflow, /if: always\(\)\n {8}uses: actions\/upload-artifact@v7/u);
	assert.match(workflow, /if: always\(\) && steps\.acceptance\.outcome != 'success'/u);
	assert.match(workflow, /LEAN_BRIDGE_REFINEMENT_ENTRY_PHP_WASM_FAMILIES: \$\{\{ matrix\.family \}\}/u);
	assert.match(workflow, /LEAN_BRIDGE_REFINEMENT_ENTRY_PHP_WASM_ROUTES: \$\{\{ matrix\.route \}\}/u);
	assert.match(shell, /test "\$\(git rev-parse HEAD\)" = "\$revision"/u);
	assert.match(shell, /--test-concurrency=1/u);
	assert.match(shell, /test -s "\$output\/\$LEAN_BRIDGE_REFINEMENT_ENTRY_PHP_WASM_ROUTES\/\$LEAN_BRIDGE_REFINEMENT_ENTRY_PHP_WASM_FAMILIES\/summary\.json"/u);
});

test("hosted graph entry shell refuses ambiguous or incomplete selection", async () => {
	const source = await readFile("scripts/run-php-wasm-refinement-entry-ci.sh", "utf8");
	assert.match(source, /Select exactly one known refinement-entry family/u);
	assert.match(source, /Select exactly one refinement-entry source route/u);
	assert.match(source, /Refinement entry output already exists/u);
	assert.doesNotMatch(source, /\|\| true|continue-on-error/u);
});
