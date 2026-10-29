/**
 * Static controls for the optional-parameter PHP hosted lane.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("optional PHP runner owns both author routes and its checker", async () => {
	const source = await readFile(
		"scripts/run-optional-parameter-php-ci.sh", "utf8");
	assert.match(source, /for route in ordinary reviewed/u);
	assert.match(source, /tests\/optional-parameter-php-installed\.test\.mjs/u);
	assert.match(source, /check-optional-parameter-php-ci\.mjs/u);
	assert.match(source, /LEAN_BRIDGE_OPTIONAL_PARAMETER_PHP_TEST=1/u);
});

test("consumer matrix retains and enforces optional PHP evidence", async () => {
	const source = await readFile(
		".github/workflows/consumer-matrix.yml", "utf8");
	assert.match(source, /id: optional_parameters_php/u);
	assert.match(source, /bash scripts\/run-optional-parameter-php-ci\.sh/u);
	assert.match(source, /name: optional-parameter-php-\$\{\{ github\.sha \}\}/u);
	assert.match(source, /path: build\/optional-parameter-php-ci\//u);
	assert.match(source, /steps\.optional_parameters_php\.outcome != 'success'/u);
});

test("optional PHP-Wasm uses an exact small-fixture check count", async () => {
	const [installed, helper] = await Promise.all([
		readFile("tests/optional-parameter-php-installed.test.mjs", "utf8")
		, readFile("tests/helpers/copied-fixture-php-wasm.mjs", "utf8")
	]);
	assert.match(installed, /expectedChecks: 23/u);
	assert.match(helper
		, /const expectedChecks = fixture\.expectedChecks \?\? executions\[0\]\.checks/u);
	assert.match(helper
		, /executions\.every\(item => item\.checks === expectedChecks\)/u);
	assert.match(helper
		, /fixture\.expectedChecks === undefined\) assert\.ok\(expectedChecks >= 1000\)/u);
});

test("optional PHP evidence keeps the authenticated component identity"
	, async () => {
		const source = await readFile(
			"tests/optional-parameter-php-installed.test.mjs", "utf8");
		assert.match(source
			, /\.\.\.optionalParameterPhpComponentFact\(components\)/u);
		assert.doesNotMatch(source
			, /bindingIrSha256: built\.bindingIrSha256/u);
	}
);
