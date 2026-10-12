/**
 * Keep nominal C# CI blocking and preserve every predecessor job and budget.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { nominalSubtypeDotnetCiBlock, enableNominalSubtypeDotnetWorkflow, disableNominalSubtypeDotnetWorkflow, assertNominalSubtypeDotnetWorkflow } from "./nominal-subtype-dotnet-ci-workflow.mjs";
import { assertNominalSubtypeRustWorkflow } from "./nominal-subtype-rust-ci-workflow.mjs";
import { assertNominalSubtypeRubyWorkflow } from "./nominal-subtype-ruby-ci-workflow.mjs";
import { assertNominalSubtypePythonWorkflow } from "./nominal-subtype-python-ci-workflow.mjs";
import { assertStructuralSubtypeWorkflow } from "./structural-subtype-ci-workflow.mjs";
import { beforePhpWasmFailureDiagnosticsSource } from "./php-wasm-failure-diagnostics-history.mjs";

const path = ".github/workflows/consumer-matrix.yml";
const predecessor = "51f55c70d0aa7fc08e582e2de9fb51f12e1869f7";

test("nominal C# CI preserves every earlier step and requires an isolated pinned SDK", async () => {
	const source = await readFile(path, "utf8");
	assertNominalSubtypeDotnetWorkflow(source);
	const previous = execFileSync("git", ["show", `${predecessor}:${path}`], { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
	const checkpoint = beforePhpWasmFailureDiagnosticsSource(path, source);
	assert.equal(disableNominalSubtypeDotnetWorkflow(checkpoint), previous);
	assert.equal(enableNominalSubtypeDotnetWorkflow(previous), checkpoint);
	assertNominalSubtypeRustWorkflow(source);
	assertNominalSubtypePythonWorkflow(source);
	assertNominalSubtypeRubyWorkflow(source);
	assertStructuralSubtypeWorkflow(source, "consumer-matrix.yml");
});

test("nominal C# CI rejects skipped gates, shared tool selection and narrowed evidence", async t => {
	const source = await readFile(path, "utf8"), block = nominalSubtypeDotnetCiBlock;
	const replacements = [
		[block, ""]
		, [block, block.replace("        run: |", "        continue-on-error: true\n        run: |")]
		, [block, block.replaceAll("        if: matrix.profile == 'dotnet'", "        if: false")]
		, [block, block.replace("        if: always()", "        if: success()")]
		, [block, block.replace("          if-no-files-found: error", "          if-no-files-found: ignore")]
		, [block, block.replace("          path: build/nominal-subtype-dotnet-ci/", "          path: build/nominal-subtype-dotnet-ci/*/report.json")]
		, [block, block.replace("          retention-days: 30", "          retention-days: 1")]
		, [block, block.replace('"$RUNNER_TEMP/lean-bridge-nominal-dotnet-8.0.424/dotnet"', '"dotnet"')]
		, [block, block.replace('"$RUNNER_TEMP/lean-bridge-nominal-dotnet-8.0.424/dotnet"\n', '"$RUNNER_TEMP/lean-bridge-nominal-dotnet-8.0.424/dotnet" || true\n')]
		, [block, block.replace("          source scripts/env.sh", "          set +e\n          source scripts/env.sh")]
		, [block, block.replace("        timeout-minutes: 45", "        timeout-minutes: 1")]
		, [block, block.replaceAll("8.0.424", "8.0.425")]
		, [block, block.replace("DOTNET_INSTALL_DIR:", "IGNORED_INSTALL_DIR:")]
		, [block, block.replace("${{ runner.temp }}/lean-bridge-nominal-dotnet-8.0.424", "/usr/share/dotnet")]
		, ["  managed-consumers:\n", "  managed-consumers:\n    if: false\n"]
		, ["  managed-consumers:\n", "  managed-consumers:\n    continue-on-error: true\n"]
		, ["        profile: [dotnet, jvm, ruby]", "        profile: [jvm, ruby]"]
		, ["      - managed-consumers\n", ""]
		, ...["LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR", "LEAN_BRIDGE_NOMINAL_SUBTYPE_DOTNET_ROUTES", "LEAN_BRIDGE_NOMINAL_SUBTYPE_DOTNET_MODES"].map(name => [block, block.replace("          LEAN_NUM_THREADS:", `          ${name}: override\n          LEAN_NUM_THREADS:`)])
	];
	for(const [index, [from, to]] of replacements.entries())
	{
		const changed = source.replace(from, () => to); assert.notEqual(changed, source);
		assert.throws(() => assertNominalSubtypeDotnetWorkflow(changed), assert.AssertionError, `workflow mutation ${index}`);
	}
	const body = source.split("\n  managed-consumers:\n")[1].split(/\n {2}[a-z][a-z0-9-]*:\n/u)[0];
	for(const [from, to] of [["fetch-depth: 0", "fetch-depth: 1"], ["persist-credentials: false", "persist-credentials: true"], ["timeout-minutes: 240", "timeout-minutes: 1"]])
	{
		const changed = source.replace(body, () => body.replaceAll(from, to)); assert.notEqual(changed, source);
		assert.throws(() => assertNominalSubtypeDotnetWorkflow(changed), assert.AssertionError);
	}
	t.diagnostic(`${replacements.length + 3} missing, skipped, weakened or narrowed workflow controls`);
});
