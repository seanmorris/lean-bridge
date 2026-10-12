/**
 * Keep both Python floors required without replacing older hosted acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { nominalSubtypePythonCiBlock, enableNominalSubtypePythonWorkflow, disableNominalSubtypePythonWorkflow, assertNominalSubtypePythonWorkflow } from "./nominal-subtype-python-ci-workflow.mjs";
import { assertStructuralSubtypeWorkflow } from "./structural-subtype-ci-workflow.mjs";

const path = ".github/workflows/consumer-matrix.yml";
const predecessor = "ad3f7716d997ef8a4331ec8a3f2a6524a2ca3b30";

test("nominal Python CI preserves older jobs and requires four complete two-floor selections", async () => {
	const source = await readFile(path, "utf8");
	assertNominalSubtypePythonWorkflow(source);
	const previous = execFileSync("git", ["show", `${predecessor}:${path}`], { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
	assert.equal(disableNominalSubtypePythonWorkflow(source), previous);
	assert.equal(enableNominalSubtypePythonWorkflow(previous), source);
	assertStructuralSubtypeWorkflow(source, "consumer-matrix.yml");
});

test("nominal Python CI rejects skipped gates, missing floors and narrowed original records", async t => {
	const source = await readFile(path, "utf8"), block = nominalSubtypePythonCiBlock;
	const replacements = [
		[block, ""]
		, [block, block.replace("        run: |", "        continue-on-error: true\n        run: |")]
		, [block, block.replace("        if: matrix.profile == 'python'", "        if: false")]
		, [block, block.replace("        if: always()", "        if: success()")]
		, [block, block.replace("          if-no-files-found: error", "          if-no-files-found: ignore")]
		, [block, block.replace("          path: build/nominal-subtype-python-ci/", "          path: build/nominal-subtype-python-ci/*/report.json")]
		, [block, block.replace("          retention-days: 30", "          retention-days: 1")]
		, [block, block.replace(' "$NOMINAL_PYTHON_312"', "")]
		, [block, block.replace(' "$NOMINAL_PYTHON_312"', ' "$NOMINAL_PYTHON_311"')]
		, [block, block.replace('"$NOMINAL_PYTHON_312"\n', '"$NOMINAL_PYTHON_312" || true\n')]
		, [block, block.replace("          source scripts/env.sh", "          set +e\n          source scripts/env.sh")]
		, [block, block.replace("        timeout-minutes: 45", "        timeout-minutes: 1")]
		, ["  native-consumers:\n", "  native-consumers:\n    if: false\n"]
		, ["  native-consumers:\n", "  native-consumers:\n    continue-on-error: true\n"]
		, ["        profile: [c-family, python, rust]", "        profile: [c-family, rust]"]
		, ["      - native-consumers\n", ""]
		, ...["311", "312"].map(suffix => [`        id: collection_python${suffix}\n`, ""])
		, ...["LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR", "LEAN_BRIDGE_NOMINAL_SUBTYPE_PYTHONS"].map(name => [block, block.replace("          LEAN_NUM_THREADS:", `          ${name}: override\n          LEAN_NUM_THREADS:`)])
	];
	for(const [index, [from, to]] of replacements.entries())
	{
		const changed = source.replace(from, () => to); assert.notEqual(changed, source);
		assert.throws(() => assertNominalSubtypePythonWorkflow(changed), assert.AssertionError, `workflow mutation ${index}`);
	}
	t.diagnostic(`${replacements.length} missing, skipped, weakened or narrowed workflow controls`);
});
