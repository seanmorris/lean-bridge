/**
 * Keep the complete Core contract bounded without truncating its evidence checks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const assertCoreQualityBudget = source => {
	const timeouts = [...source.matchAll(/^\s+timeout-minutes:\s*(\d+)\s*$/gmu)];
	assert.equal(timeouts.length, 1, "Core quality must have one explicit job timeout");
	assert.equal(Number(timeouts[0][1]), 180, "Core quality must retain its reviewed 180-minute bound");
	assert.equal([...source.matchAll(/^\s+npm run check:core\s*$/gmu)].length, 1
		, "Core quality must execute the complete check:core contract exactly once");
	assert.equal([...source.matchAll(/^\s+fetch-depth:\s*0\s*$/gmu)].length, 1
		, "Core quality must retain all producer history");
	assert.equal([...source.matchAll(/^\s+persist-credentials:\s*false\s*$/gmu)].length, 1
		, "Core quality checkout must not persist credentials");
	assert.ok(!/^\s+continue-on-error:\s*true\s*$/mu.test(source), "Core quality failures must remain fatal");
};

const assertCoreProcessBudget = source => {
	assert.equal([...source.matchAll(/requested === "contract" && process\.env\.CI === "true"/gu)].length, 1
		, "Only the hosted Core profile must use the resource bound");
	assert.equal([...source.matchAll(/"--test-concurrency=2"/gu)].length, 1
		, "Hosted Core must run at most two contract files concurrently");
	assert.equal([...source.matchAll(/"--max-old-space-size=4096"/gu)].length, 1
		, "Each hosted Core process must have a visible 4 GiB heap failure bound");
	assert.match(source, /const childEnvironment = boundedHostedCore \? \{\n\t\.\.\.process\.env\n\t, NODE_OPTIONS:/u
		, "Hosted Core must bound only the hosted contract environment");
	assert.match(source, /NODE_OPTIONS: \[process\.env\.NODE_OPTIONS, "--max-old-space-size=4096"\]\s*\.filter\(Boolean\)\.join\(" "\)/u
		, "Hosted Core must preserve prior Node options and append its reviewed heap bound");
	assert.match(source, /"--test", \.\.\.boundedHostedCore \? \["--test-concurrency=2"\] : \[\], \.\.\.selected\s*\]/u
		, "Hosted Core must execute every selected contract test under the bound");
	assert.match(source, /\], \{ cwd: root, env: childEnvironment, stdio: "inherit" \}\);/u
		, "Hosted Core must spawn the child with the bounded environment");
};

test("Core quality has a bounded budget for the complete evidence contract", async () => {
	const source = await readFile(".github/workflows/quality.yml", "utf8");
	assertCoreQualityBudget(source);
	for(const changed of [
		source.replace("timeout-minutes: 180", "timeout-minutes: 90")
		, source.replace("timeout-minutes: 180", "timeout-minutes: 179")
		, source.replace("timeout-minutes: 180", "timeout-minutes: 181")
		, source.replace("    timeout-minutes: 180\n", "")
		, source.replace("    timeout-minutes: 180\n", "    timeout-minutes: 180\n    timeout-minutes: 180\n")
		, source.replace("npm run check:core", "npm run lint")
		, source.replace("npm run check:core", "npm run check:core -- --test-name-pattern smoke")
		, source.replace("fetch-depth: 0", "fetch-depth: 1")
		, source.replace("persist-credentials: false", "persist-credentials: true")
		, source.replace("        run: |\n          source scripts/env.sh\n", "        continue-on-error: true\n        run: |\n          source scripts/env.sh\n")
	]) {
		assert.notEqual(changed, source);
		assert.throws(() => assertCoreQualityBudget(changed));
	}
});

test("Hosted Core bounds concurrent history replay without truncating the profile", async () => {
	const source = await readFile("scripts/run-test-profile.mjs", "utf8");
	assertCoreProcessBudget(source);
	for(const changed of [
		source.replace("--test-concurrency=2", "--test-concurrency=3")
		, source.replace("--max-old-space-size=4096", "--max-old-space-size=8192")
		, source.replace(" && process.env.CI === \"true\"", "")
		, source.replace("...selected", "...selected.slice(0, 10)")
		, source.replace("env: childEnvironment", "env: process.env")
		, source.replace("boundedHostedCore ? {", "!boundedHostedCore ? {")
		, source.replace("[process.env.NODE_OPTIONS, \"--max-old-space-size=4096\"]"
			, "[\"--max-old-space-size=4096\", process.env.NODE_OPTIONS]")
		, source.replace("...boundedHostedCore ? [\"--test-concurrency=2\"] : []", "...[]")
	]) {
		assert.notEqual(changed, source);
		assert.throws(() => assertCoreProcessBudget(changed));
	}
});
