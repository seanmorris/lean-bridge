/**
 * Keep nominal JVM CI blocking and preserve every predecessor step and budget.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { nominalSubtypeJvmCiBlock, enableNominalSubtypeJvmWorkflow, disableNominalSubtypeJvmWorkflow, assertNominalSubtypeJvmWorkflow } from "./nominal-subtype-jvm-ci-workflow.mjs";
import { assertNominalSubtypeDotnetWorkflow } from "./nominal-subtype-dotnet-ci-workflow.mjs";
import { assertNominalSubtypeRustWorkflow } from "./nominal-subtype-rust-ci-workflow.mjs";
import { assertNominalSubtypeRubyWorkflow } from "./nominal-subtype-ruby-ci-workflow.mjs";
import { assertNominalSubtypePythonWorkflow } from "./nominal-subtype-python-ci-workflow.mjs";
import { assertStructuralSubtypeWorkflow } from "./structural-subtype-ci-workflow.mjs";
import { disableNominalSubtypePhpWorkflow } from "./nominal-subtype-php-ci-workflow.mjs";

const path = ".github/workflows/consumer-matrix.yml";
const predecessor = "2f38c10b8f0937edeeef39b4e15515f70b66ddd3";

test("nominal JVM CI preserves all preceding jobs and enforces four pinned selections", async () => {
	const source = await readFile(path, "utf8"); assertNominalSubtypeJvmWorkflow(source);
	const previous = execFileSync("git", ["show", `${predecessor}:${path}`], { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
	const checkpoint = disableNominalSubtypePhpWorkflow(source);
	assert.equal(disableNominalSubtypeJvmWorkflow(checkpoint), previous);
	assert.equal(enableNominalSubtypeJvmWorkflow(previous), checkpoint);
	assertNominalSubtypeDotnetWorkflow(source); assertNominalSubtypeRustWorkflow(source);
	assertNominalSubtypePythonWorkflow(source); assertNominalSubtypeRubyWorkflow(source);
	assertStructuralSubtypeWorkflow(source, "consumer-matrix.yml");
});

test("nominal JVM CI rejects omitted gates, narrowed artifacts and false successful summaries", async t => {
	const source = await readFile(path, "utf8"), block = nominalSubtypeJvmCiBlock;
	const replacements = [[block, ""]
		, [block, block.replace("        run: |", "        continue-on-error: true\n        run: |")]
		, [block, block.replace("        if: matrix.profile == 'jvm'", "        if: false")]
		, [block, block.replace("        if: always()", "        if: success()")]
		, [block, block.replace("          if-no-files-found: error", "          if-no-files-found: ignore")]
		, [block, block.replace("          path: build/nominal-subtype-jvm-ci/", "          path: build/nominal-subtype-jvm-ci/*/verification.json")]
		, [block, block.replace("          retention-days: 30", "          retention-days: 1")]
		, [block, block.replace('"$JAVA_HOME/bin/java"', '"java"')]
		, [block, block.replace('"$JAVA_HOME/bin/javac"', '"javac"')]
		, [block, block.replace('"$PWD/build/kotlin-tools/kotlinc/bin/kotlinc"', '"kotlinc"')]
		, [block, block.replace('"$PWD/build/kotlin-tools/kotlinc/bin/kotlinc"\n', '"$PWD/build/kotlin-tools/kotlinc/bin/kotlinc" || true\n')]
		, [block, block.replace("          source scripts/env.sh", "          set +e\n          source scripts/env.sh")]
		, [block, block.replace("        timeout-minutes: 45", "        timeout-minutes: 1")]
		, ["  managed-consumers:\n", "  managed-consumers:\n    if: false\n"]
		, ["  managed-consumers:\n", "  managed-consumers:\n    continue-on-error: true\n"]
		, ["        profile: [dotnet, jvm, ruby]", "        profile: [dotnet, ruby]"]
		, ["      - managed-consumers\n", ""]
		, [' || [ "${{ steps.nominal_jvm.outcome }}" != success ]', ""]
		, [" || steps.nominal_jvm.outcome != 'success'", ""]
		, ...["LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR", "LEAN_BRIDGE_NOMINAL_SUBTYPE_JVM_ROUTES", "LEAN_BRIDGE_NOMINAL_SUBTYPE_JVM_MODES"].map(name => [block, block.replace("        run: |", `        env:\n          ${name}: override\n        run: |`)])];
	for(const [index, [from, to]] of replacements.entries())
	{
		const changed = source.replace(from, () => to); assert.notEqual(changed, source);
		assert.throws(() => assertNominalSubtypeJvmWorkflow(changed), assert.AssertionError, `workflow mutation ${index}`);
	}
	const body = source.split("\n  managed-consumers:\n")[1].split(/\n {2}[a-z][a-z0-9-]*:\n/u)[0];
	const bodyChanges = [["fetch-depth: 0", "fetch-depth: 1"]
		, ["persist-credentials: false", "persist-credentials: true"]
		, ["timeout-minutes: 240", "timeout-minutes: 1"]
		, ["java-version: '22.0.2'", "java-version: '22.0.3'"]
		, ["1adb6f1a5845ba0aa5a59e412e44c8e405236b957de1a9683619f1dca3b16932", "0".repeat(64)]];
	for(const [from, to] of bodyChanges)
	{
		const changed = source.replace(body, () => body.replaceAll(from, to)); assert.notEqual(changed, source);
		assert.throws(() => assertNominalSubtypeJvmWorkflow(changed), assert.AssertionError);
	}
	t.diagnostic(`${replacements.length + 5} missing, skipped or weakened workflow controls`);
});
