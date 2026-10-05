/**
 * Require real owner lifetimes, installed consumers and retained CI evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { assertOwnedPhpWasmTransferCi } from "./owned-php-wasm-transfer-ci.mjs";

export const ownedPhpWasmBorrowReports = ["ordinary", "reviewed", "ordinary-borrow-only", "reviewed-borrow-only", "native-fibers", "packages", "documentation"]
	.map(name => `build/owned-php-wasm-borrows/${name}.json`);
export const ownedPhpWasmBorrowScript = "LEAN_BRIDGE_OWNED_PHP_WASM_BORROW_TEST=1 node --test --test-concurrency=1 tests/owned-php-wasm-borrows.test.mjs tests/owned-php-wasm-borrow-packaging.test.mjs tests/owned-php-wasm-borrow-documentation.test.mjs";

/**
 * Reject skipped, suppressed, unrecorded or unretained acceptance runs.
 *
 * @param workflow - Complete consumer workflow.
 * @param manifest - Complete npm manifest and named scripts.
 */
export const assertOwnedPhpWasmBorrowCi = (workflow, manifest) => {
	assertOwnedPhpWasmTransferCi(workflow, manifest);
	assert.equal(manifest.scripts["test:owned-php-wasm-borrows"], ownedPhpWasmBorrowScript);
	const step = workflow.match(/^ {6}- name: Execute owned PHP-Wasm values and installed CLI releases\n([^]*?)(?=^ {6}- name: )/mu)?.[0];
	assert.ok(step?.includes("          npm run test:owned-php-wasm-borrows 2>&1 | tee build/owned-php-wasm-borrows.log\n"));
	assert.doesNotMatch(step, /^ {8}if:/mu);
	for(const expected of ["tests 12", "fail 0", "cancelled 0", "skipped 0"])
		assert.ok(step.includes(`          rg '^# ${expected}$' build/owned-php-wasm-borrows.log\n`));
	assert.match(workflow, /^ {10}sudo apt-get install .*php-dev.*ripgrep$/mu);
	const recorded = workflow.split("\n").find(line => line.includes("record --consumer php-wasm"));
	assert.ok(recorded?.includes(" && npm run test:owned-php-wasm-borrows"));
	const upload = workflow.match(/^ {6}- name: Upload owned PHP-Wasm execution evidence\n([^]*?)(?=^ {6}- name: )/mu)?.[0];
	assert.ok(upload?.includes("            build/owned-php-wasm-borrows.log\n"));
	for(const path of ownedPhpWasmBorrowReports)
	{
		assert.ok(step.includes("          test -s " + path + "\n"), path);
		assert.ok(upload?.includes("            " + path + "\n"), path);
	}
	return { testFiles: 3, tests: 12, reports: ownedPhpWasmBorrowReports.length };
};
