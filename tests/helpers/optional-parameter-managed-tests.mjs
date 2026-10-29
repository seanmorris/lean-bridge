/**
 * Static controls for optional-parameter managed-package lanes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("optional managed runner owns both groups, routes and its checker", async () => {
	const source = await readFile(
		"scripts/run-optional-parameter-managed-ci.sh", "utf8");
	const installed = await readFile(
		"tests/optional-parameter-managed-installed.test.mjs", "utf8");
	assert.match(source, /dotnet && \$1 != jvm/u);
	assert.match(source, /for route in ordinary reviewed/u);
	assert.match(source, /optional-parameter-managed-installed\.test\.mjs/u);
	assert.match(source, /check-optional-parameter-managed-ci\.mjs/u);
	assert.match(source, /LEAN_BRIDGE_OPTIONAL_PARAMETER_MANAGED_TEST=1/u);
	assert.match(installed
		, /const target = \{ dotnet: "nuget", jvm: "maven" \}\[group\]/u);
	assert.match(installed, /targets: \[target\], environment/u);
});

test("consumer workflow retains and enforces every optional managed lane", async () => {
	const source = await readFile(
		".github/workflows/consumer-matrix.yml", "utf8");
	assert.match(source
		, /optional-parameter-managed-\$\{\{ matrix\.profile \}\}-\$\{\{ github\.sha \}\}/u);
	assert.match(source, /run-optional-parameter-managed-ci\.sh/u);
	assert.match(source
		, /steps\.optional_parameters_managed\.outcome != 'success'/u);
});

test("managed callers distinguish omission, None, Unit and host null", async () => {
	const root = "tests/fixtures/optional-parameter-consumers";
	const [dotnet, java, kotlin, dotnetInvalid, javaInvalid, kotlinInvalid]
		= await Promise.all([
			"dotnet.cs", "java.java", "kotlin.kt"
			, "dotnet-invalid.cs", "java-invalid.java", "kotlin-invalid.kt"
		].map(path => readFile(`${root}/${path}`, "utf8")));
	for(const [source, word, maybe, unit] of [
		[dotnet, /Api\.Word\(\)/u, /Api\.Maybe\(Option<uint>\.None\)/u
			, /Api\.UnitValue\(default\(Unit\)\)/u]
		, [java, /Api\.word\(\)/u, /Api\.maybe\(Option\.none\(\)\)/u
			, /Api\.unitValue\(Unit\.INSTANCE\)/u]
		, [kotlin, /Api\.word\(\)/u, /Api\.maybe\(Option\.none\(\)\)/u
			, /Api\.unitValue\(Unit\.INSTANCE\)/u]
	]) {
		assert.match(source, word); assert.match(source, maybe);
		assert.match(source, unit); assert.match(source, /present/iu);
	}
	assert.match(dotnetInvalid, /Api\.Word\(null\)/u);
	assert.match(dotnetInvalid, /Api\.Natural\(null\)/u);
	assert.match(javaInvalid, /Api\.word\(null\)/u);
	assert.match(javaInvalid, /Api\.character\(null\)/u);
	assert.match(kotlinInvalid, /Api\.word\(null\)/u);
	assert.match(kotlinInvalid, /Api\.natural\(null\)/u);
});
