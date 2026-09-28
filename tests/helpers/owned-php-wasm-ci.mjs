/**
 * Required real ownership execution, archive consumption and report retention.
 *
 * @file
 */
import assert from "node:assert/strict";

export const ownedPhpWasmCiCommands = [
	"LEAN_BRIDGE_OWNED_PHP_WASM_VALUES_TEST=1 node --test --test-name-pattern='32-bit PHP-Wasm' tests/owned-php-values.test.mjs"
	, "LEAN_BRIDGE_OWNED_PHP_ZEND_TEST=1 LEAN_BRIDGE_OWNED_ZEND_FIBER_TEST=1 node --test --test-concurrency=1 tests/owned-php-zend-model.test.mjs tests/owned-php-zend-ownership.test.mjs tests/owned-php-zend-extension.test.mjs tests/owned-php-zend-generated.test.mjs"
	, "LEAN_BRIDGE_OWNED_PHP_WASM_PACKAGE_TEST=1 node --test tests/owned-php-wasm-package.test.mjs"
	, "LEAN_BRIDGE_OWNED_PHP_WASM_MULTI_PROFILE_TEST=1 node --test tests/owned-php-wasm-multi-profile.test.mjs"
	, "LEAN_BRIDGE_OWNED_PHP_WASM_DOCUMENTATION_TEST=1 node --test tests/owned-php-wasm-documentation.test.mjs"
];
export const ownedPhpWasmCiReports = [
	"build/owned/php-wasm-values.json"
	, "build/owned-php-zend/lifetime.json"
	, "build/owned-php-zend/native-fibers.json"
	, "build/owned-php-zend/generated.json"
	, "build/owned-php-zend/generated-reviewed.json"
	, "build/owned-php-wasm/packages-cli.json"
	, "build/owned-php-wasm/multi-profile.json"
	, "build/owned-php-wasm/documentation.json"
];

/**
 * Reject disabled suites, missing evidence and failure aggregation omissions.
 *
 * @param workflow - Complete current consumer matrix workflow.
 */
export const assertOwnedPhpWasmCi = workflow => {
	const step = workflow.match(/^ {6}- name: Execute owned PHP-Wasm values and installed CLI releases\n([^]*?)(?=^ {6}- name: )/mu)?.[0];
	assert.ok(step); assert.match(step, /^ {8}id: owned_php_wasm$/mu);
	assert.doesNotMatch(step, /^ {8}if:/mu);
	assert.ok(workflow.indexOf("      - name: Compile ordinary Lean APIs and execute installed PHP-Wasm packages\n") < workflow.indexOf(step));
	assert.match(workflow, /^ {10}sudo apt-get install .*\bphp-dev\b/mu);
	const recorded = workflow.split("\n").find(line => line.includes("record --consumer php-wasm"));
	assert.ok(recorded);
	for(const command of ownedPhpWasmCiCommands)
	{
		assert.ok(step.includes("          " + command + "\n"), command);
		assert.ok(recorded.includes(" && " + command), command);
	}
	const upload = workflow.match(/^ {6}- name: Upload owned PHP-Wasm execution evidence\n([^]*?)(?=^ {6}- name: )/mu)?.[0];
	assert.ok(upload); assert.match(upload, /^ {8}if: always\(\)$/mu);
	assert.match(upload, /^ {10}if-no-files-found: error$/mu);
	for(const path of ownedPhpWasmCiReports)
	{
		assert.ok(step.includes("          test -s " + path + "\n"), path);
		assert.ok(upload.includes("            " + path + "\n"), path);
	}
	const failure = workflow.split("\n").find(line => line.includes("steps.ordinary_php_wasm.outcome") && line.includes("; then"));
	assert.ok(failure?.includes('[ "${{ steps.owned_php_wasm.outcome }}" != success ]'));
	const enforcement = workflow.split("      - name: Enforce PHP support\n")[1]?.split("\n\n")[0];
	assert.ok(enforcement?.includes("steps.owned_php_wasm.outcome != 'success'"));
	assert.match(enforcement, /run: exit 1/u);
	return { testFiles: 8, requiredReports: ownedPhpWasmCiReports.length
		, recordedRouteMatches: true, realExecutionRequired: true
		, failurePropagated: true };
};
