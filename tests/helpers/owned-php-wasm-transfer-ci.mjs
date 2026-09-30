/**
 * Bind the consuming PHP-Wasm gate to enabled execution and retained reports.
 *
 * @file
 */
import assert from "node:assert/strict";
import { assertOwnedPhpWasmCi } from "./owned-php-wasm-ci.mjs";

export const ownedPhpWasmTransferReports = ["ordinary", "reviewed", "packages", "documentation"]
	.map(name => `build/owned-php-wasm-transfers/${name}.json`);
export const ownedPhpWasmTransferScript = "LEAN_BRIDGE_OWNED_PHP_WASM_TRANSFER_TEST=1 LEAN_BRIDGE_OWNED_PHP_WASM_DOCUMENTATION_TEST=1 node --test --test-concurrency=1 tests/owned-php-wasm-transfers.test.mjs tests/owned-php-wasm-transfer-packaging.test.mjs tests/owned-php-wasm-documentation.test.mjs";

/**
 * A named npm script must still enable each installed/compiler-backed test.
 *
 * @param workflow - Complete consumer matrix workflow.
 * @param manifest - Complete npm package manifest.
 */
export const assertOwnedPhpWasmTransferCi = (workflow, manifest) => {
	assertOwnedPhpWasmCi(workflow);
	assert.equal(manifest.scripts["test:owned-php-wasm-transfers"], ownedPhpWasmTransferScript);
	const step = workflow.match(/^ {6}- name: Execute owned PHP-Wasm values and installed CLI releases\n([^]*?)(?=^ {6}- name: )/mu)?.[0];
	assert.ok(step?.includes("          npm run test:owned-php-wasm-transfers\n"));
	assert.doesNotMatch(step, /^ {8}if:/mu);
	const recorded = workflow.split("\n").find(line => line.includes("record --consumer php-wasm"));
	assert.ok(recorded?.includes(" && npm run test:owned-php-wasm-transfers"));
	const upload = workflow.match(/^ {6}- name: Upload owned PHP-Wasm execution evidence\n([^]*?)(?=^ {6}- name: )/mu)?.[0];
	for(const path of ownedPhpWasmTransferReports)
	{
		assert.ok(step.includes("          test -s " + path + "\n"), path);
		assert.ok(upload?.includes("            " + path + "\n"), path);
	}
	return { testFiles: 3, reports: ownedPhpWasmTransferReports.length };
};
