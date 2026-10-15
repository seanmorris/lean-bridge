/**
 * Keep primitive-base .NET acceptance blocking, pinned and fully retained.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertNominalPrimitiveSubtypeDotnetWorkflow } from "./nominal-primitive-subtype-dotnet-ci-workflow.mjs";

const path = ".github/workflows/nominal-primitive-subtype-dotnet.yml";

test("primitive-base nominal .NET workflow runs all four installed selections", async () => {
	assertNominalPrimitiveSubtypeDotnetWorkflow(await readFile(path, "utf8"));
});

test("primitive-base nominal .NET workflow rejects skipped, unpinned, or narrowed evidence", async t => {
	const source = await readFile(path, "utf8");
	const replacements = [
		["        if: always()\n", "        if: success()\n"]
		, ["          if-no-files-found: error", "          if-no-files-found: ignore"]
		, ["          retention-days: 30", "          retention-days: 1"]
		, ["        timeout-minutes: 120", "        timeout-minutes: 1"]
		, ["    timeout-minutes: 180", "    timeout-minutes: 1"]
		, ["actions/setup-dotnet@v6", "actions/setup-dotnet@main"]
		, ["dotnet-version: '8.0.424'", "dotnet-version: '8.0.x'"]
		, ["fetch-depth: 0", "fetch-depth: 1"]
		, ["persist-credentials: false", "persist-credentials: true"]
		, ["build/nominal-primitive-subtype-dotnet-ci/", "build/nominal-primitive-subtype-dotnet-ci/*/verification.json"]
		, ["bash scripts/run-nominal-primitive-subtype-dotnet-ci.sh", "true || bash scripts/run-nominal-primitive-subtype-dotnet-ci.sh"]
		, ["    runs-on: ubuntu-24.04", "    continue-on-error: true\n    runs-on: ubuntu-24.04"]
		, ["      LEAN_NUM_THREADS: \"1\"", "      LEAN_NUM_THREADS: \"1\"\n      LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_DOTNET_MODES: full"]
	];
	for(const [index, [from, to]] of replacements.entries())
	{
		const changed = source.replace(from, () => to); assert.notEqual(changed, source);
		assert.throws(() => assertNominalPrimitiveSubtypeDotnetWorkflow(changed), assert.AssertionError, `workflow mutation ${index}`);
	}
	t.diagnostic(`${replacements.length} missing, skipped, weakened, unpinned, or narrowed workflow controls`);
});
