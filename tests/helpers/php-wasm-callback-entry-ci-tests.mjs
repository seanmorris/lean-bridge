/**
 * Static controls for the hosted synchronous callback-entry matrix.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("hosted callback-entry workflow covers all three families and ordered routes", async () => {
	const workflow = await readFile(".github/workflows/php-wasm-callback-entry.yml", "utf8");
	const shell = await readFile("scripts/run-php-wasm-callback-entry-ci.sh", "utf8");
	for(const family of ["callback-fin", "callback-checked-record", "callback-subtype"])
	{
		assert.ok(workflow.includes(`          - ${family}\n`), family);
		assert.ok(shell.includes(family), `${family} shell admission`);
	}
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

// The entry acceptance is gated on its own lane, so it must never be imported by
// the callback-refinement suite, whose hosted gate requires zero skipped tests.
test("each hosted PHP-Wasm callback lane runs only the suite its gate admits", async () => {
	const read = path => readFile(path, "utf8");
	const imports = text => [...text.matchAll(/^import "\.\/helpers\/([^"]+)";$/gmu)].map(match => `tests/helpers/${match[1]}`);
	const [shell, entryWorkflow, refinementsWorkflow, entrySuite, refinementsSuite, manifest]
		= await Promise.all([
			"scripts/run-php-wasm-callback-entry-ci.sh"
			, ".github/workflows/php-wasm-callback-entry.yml"
			, ".github/workflows/callback-refinements-php-wasm.yml"
			, "tests/php-wasm-callback-entry-installed.test.mjs"
			, "tests/callback-refinements-php-wasm.test.mjs"
			, "package.json"
		].map(read));
	const installed = "tests/helpers/php-wasm-callback-entry-installed-tests.mjs";
	// Entry lane: the shell runs exactly the dedicated suite, selected by name.
	assert.deepEqual(imports(entrySuite), [installed]);
	assert.equal(entrySuite.split("\n").filter(line => line.startsWith("import ")).length, 1);
	assert.match(shell, /--test-name-pattern="\^\$name\$" \\\n {2}tests\/php-wasm-callback-entry-installed\.test\.mjs 2>&1 \| tee "\$output\.tap"\n/u);
	assert.equal(shell.match(/node --test /gu).length, 1);
	assert.doesNotMatch(shell, /callback-refinements-php-wasm|tests\/helpers\/php-wasm-callback-entry-installed-tests/u);
	assert.match(entryWorkflow, /LEAN_BRIDGE_CALLBACK_ENTRY_PHP_WASM_TEST: "1"\n/u);
	assert.match(entryWorkflow, /bash scripts\/run-php-wasm-callback-entry-ci\.sh\n/u);
	assert.doesNotMatch(entryWorkflow, /php-wasm-callback-entry-installed|callback-refinements-php-wasm/u);
	// Refinement lane: its suite imports no other lane's gated test, its only
	// gated import is enabled by its own script, and its gate stays strict.
	const helpers = imports(refinementsSuite);
	assert.ok(!helpers.includes(installed));
	const gated = [];
	for(const path of helpers)
		if(/\bskip:/u.test(await read(path))) gated.push(path);
	assert.deepEqual(gated, ["tests/helpers/callback-refinements-php-wasm-installed-tests.mjs"]);
	assert.match(await read(gated[0]), /const flag = process\.env\.LEAN_BRIDGE_CALLBACK_REFINEMENTS_PHP_WASM_TEST;\n/u);
	assert.equal(JSON.parse(manifest).scripts["test:callback-refinements-php-wasm"]
		, "LEAN_BRIDGE_CALLBACK_REFINEMENTS_PHP_WASM_TEST=1 node --test --test-concurrency=1 tests/callback-refinements-php-wasm.test.mjs");
	assert.match(refinementsWorkflow, /npm run test:callback-refinements-php-wasm 2>&1 \| tee build\/callback-refinements-php-wasm\/run\.tap\n/u);
	assert.match(refinementsWorkflow, /rg '\^# skipped 0\$' build\/callback-refinements-php-wasm\/run\.tap\n/u);
	assert.doesNotMatch(refinementsWorkflow, /CALLBACK_ENTRY|php-wasm-callback-entry-installed/u);
});
