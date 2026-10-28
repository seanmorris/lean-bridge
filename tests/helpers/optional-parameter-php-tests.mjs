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
