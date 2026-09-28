/**
 * Keep native PHP ownership CI executable and its observations mandatory.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertOwnedPhpCi } from "./helpers/owned-php-ci.mjs";

const workflow = () => readFile(".github/workflows/consumer-matrix.yml", "utf8");

test("owned PHP CI executes every layer and retains required observations", async () => {
	assert.deepEqual(assertOwnedPhpCi(await workflow()), {
		testFiles: 8, requiredReports: 13, recordedRouteMatches: true
		, realExecutionRequired: true, failurePropagated: true
	});
});

test("owned PHP CI rejects skipped layers, missing reports and ignored failures", async () => {
	const source = await workflow();
	for(const [before, after] of [
		["          LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test --test-concurrency=1 tests/owned-php-runtime.test.mjs", "          node --test --test-concurrency=1 tests/owned-php-runtime.test.mjs"]
		, ["tests/owned-php-calls.test.mjs tests/owned-php-package.test.mjs", "tests/owned-php-package.test.mjs"]
		, ["          test -s build/owned-php-packaging/documentation.json\n", ""]
		, ["            build/owned-php-packaging/\n", ""]
		, [" && LEAN_BRIDGE_OWNED_PHP_VALUES_TEST=1", " && LEAN_BRIDGE_OWNED_PHP_VALUES_TEST=0"]
		, [' || [ "${{ steps.owned_php.outcome }}" != success ]', ""]
		, [" || steps.owned_php.outcome != 'success'", ""]
		, ["        id: owned_php\n", "        id: owned_php\n        if: false\n"]
		, ["            sudo phpdismod -s cli xdebug\n", "            export XDEBUG_MODE=off\n"]
		, ["          env -i PATH=/usr/bin:/bin /usr/bin/php", "          /usr/bin/php"]
		, ["Consumer PHP must run without Xdebug.\\n\"); exit(1);", "Consumer PHP must run without Xdebug.\\n\"); exit(0);"]
		, ["      - name: Disable host PHP debugging instrumentation\n", "      - name: Disable host PHP debugging instrumentation\n        if: false\n"]
	]) {
		const changed = source.replace(before, after); assert.notEqual(changed, source);
		assert.throws(() => assertOwnedPhpCi(changed));
	}
});
