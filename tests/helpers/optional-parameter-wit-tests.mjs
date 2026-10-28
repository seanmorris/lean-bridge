/**
 * Static controls for the optional-parameter WIT package lane.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("optional WIT runner owns both routes and its checker", async () => {
	const source = await readFile(
		"scripts/run-optional-parameter-wit-ci.sh", "utf8");
	assert.match(source, /for route in ordinary reviewed/u);
	assert.match(source, /optional-parameter-wit-installed\.test\.mjs/u);
	assert.match(source, /check-optional-parameter-wit-ci\.mjs/u);
	assert.match(source, /LEAN_BRIDGE_OPTIONAL_PARAMETER_WIT_TEST=1/u);
});

test("consumer workflow retains and enforces optional WIT evidence", async () => {
	const source = await readFile(
		".github/workflows/consumer-matrix.yml", "utf8");
	assert.match(source
		, /name: optional-parameter-wit-\$\{\{ github\.sha \}\}/u);
	assert.match(source, /run-optional-parameter-wit-ci\.sh/u);
	assert.match(source
		, /steps\.optional_parameters_wit\.outcome != 'success'/u);
});

test("the WIT caller distinguishes omission, None, Unit and host null", async () => {
	const source = await readFile(
		"tests/fixtures/optional-parameter-consumers/wit-wasi.c", "utf8");
	for(const name of [
		"word", "natural", "text", "character", "maybe", "present", "unit-value"
	]) assert.match(source, new RegExp(`"${name}-default"`, "u"));
	assert.match(source, /input = none\(\); expect\("present"/u);
	assert.match(source, /expect\("unit-value", &input, 1, unit\(\)\)/u);
	assert.match(source, /refused\("word", NULL, 1,/u);
	assert.match(source, /input = text\("wrong"\)/u);
});
