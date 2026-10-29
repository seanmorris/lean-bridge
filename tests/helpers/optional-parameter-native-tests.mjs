/**
 * Static controls for the optional-parameter native hosted lane.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("optional native runner owns both author routes and its checker", async () => {
	const source = await readFile(
		"scripts/run-optional-parameter-native-ci.sh", "utf8");
	assert.match(source, /for route in ordinary reviewed/u);
	assert.match(source
		, /tests\/optional-parameter-native-installed\.test\.mjs/u);
	assert.match(source, /check-optional-parameter-native-ci\.mjs/u);
	assert.match(source, /LEAN_BRIDGE_OPTIONAL_PARAMETER_NATIVE_TEST=1/u);
	assert.match(source, /--test-concurrency=1/u);
});

test("consumer matrix retains and enforces optional native evidence", async () => {
	const source = await readFile(
		".github/workflows/consumer-matrix.yml", "utf8");
	assert.match(source, /id: optional_parameters_native/u);
	assert.match(source, /bash scripts\/run-optional-parameter-native-ci\.sh/u);
	assert.match(source, /name: optional-parameter-native-\$\{\{ github\.sha \}\}/u);
	assert.match(source, /path: build\/optional-parameter-native-ci\//u);
	assert.match(source
		, /steps\.optional_parameters_native\.outcome != 'success'/u);
});

test("native callers distinguish omission, None, Unit and host null", async () => {
	const c = await readFile(
		"tests/fixtures/optional-parameter-consumers/c.c", "utf8");
	const cpp = await readFile(
		"tests/fixtures/optional-parameter-consumers/cpp.cpp", "utf8");
	assert.match(c, /defaults_present\(&option, &error\)/u);
	assert.match(c, /defaults_unit_value\(&error\)/u);
	assert.match(cpp, /api::present\(\)/u);
	assert.match(cpp, /api::unit_value\(\)/u);
	assert.match(c, /defaults_present\(NULL, &option, &error\)/u);
	assert.match(c, /defaults_present\(&none, &option, &error\)/u);
	assert.match(cpp, /api::present\(std::nullopt\)/u);
	assert.match(cpp, /api::maybe\(\) == std::nullopt/u);
});
