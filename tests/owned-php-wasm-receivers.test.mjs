/**
 * Execute nominal members against freshly compiled Lean in real PHP-Wasm.
 *
 * @file
 */
import test from "node:test";
import { checkOwnedPhpWasmBorrows } from "./helpers/owned-php-wasm-borrows.mjs";
import { checkOwnedPhpWasmBorrowFibers } from "./helpers/owned-php-wasm-borrow-fibers.mjs";

for(const mode of ["ordinary", "reviewed"])
	test(`PHP-Wasm receiver methods retain original owners (${mode})`, {
		skip: process.env.LEAN_BRIDGE_OWNED_PHP_WASM_RECEIVER_TEST !== "1"
		, timeout: 900000
	}, t => checkOwnedPhpWasmBorrows(t, mode, { receiverExports: true }));

test("native Zend companion guards receiver members during Fibers and fork", {
	skip: process.env.LEAN_BRIDGE_OWNED_PHP_WASM_RECEIVER_TEST !== "1"
	, timeout: 600000
}, t => checkOwnedPhpWasmBorrowFibers(t, { receiverExports: true }));
