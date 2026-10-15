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
