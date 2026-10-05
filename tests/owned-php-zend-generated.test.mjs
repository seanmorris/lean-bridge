/**
 * Generated public PHP APIs execute real owned Lean values in wasm32.
 *
 * @file
 */
import test from "node:test";
import { checkOwnedPhpZendGenerated } from "./helpers/owned-php-zend-generated.mjs";

for(const reviewed of [false, true])
	test(`${reviewed ? "reviewed" : "ordinary"} generated PHP-Wasm ownership APIs round-trip structured values and typed callbacks`, {
		skip: process.env.LEAN_BRIDGE_OWNED_PHP_ZEND_TEST !== "1", timeout: 480000
	}, t => checkOwnedPhpZendGenerated(t, reviewed));
