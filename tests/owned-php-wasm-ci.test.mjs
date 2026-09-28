/**
 * Keep ownership CI tied to real execution and nonempty retained observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertOwnedPhpWasmCi, ownedPhpWasmCiCommands, ownedPhpWasmCiReports } from "./helpers/owned-php-wasm-ci.mjs";

test("owned PHP-Wasm CI requires all layers, installed releases and exact documentation execution", async () => {
	assert.deepEqual(assertOwnedPhpWasmCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8")), {
		testFiles: 8, requiredReports: 8, recordedRouteMatches: true
		, realExecutionRequired: true, failurePropagated: true
	});
});

test("owned PHP-Wasm CI rejects skipped execution, omitted reports and swallowed failures", async () => {
	const source = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const mutations = [
		...ownedPhpWasmCiCommands.flatMap(command => [["          " + command + "\n", ""], [" && " + command, ""]])
		, ...ownedPhpWasmCiReports.flatMap(path => [["          test -s " + path + "\n", ""], ["            " + path + "\n", ""]])
		, ["        id: owned_php_wasm\n", "        id: owned_php_wasm\n        if: false\n"]
		, [' || [ "${{ steps.owned_php_wasm.outcome }}" != success ]', ""]
		, [" || steps.owned_php_wasm.outcome != 'success'", ""]
		, ["php-cli php-dev php-common", "php-cli php-common"]
		, ["          LEAN_BRIDGE_OWNED_PHP_WASM_PACKAGE_TEST=1", "          LEAN_BRIDGE_OWNED_PHP_WASM_PACKAGE_TEST=0"]
	];
	for(const [before, after] of mutations)
	{
		const changed = source.replace(before, after); assert.notEqual(changed, source);
		assert.throws(() => assertOwnedPhpWasmCi(changed));
	}
});
