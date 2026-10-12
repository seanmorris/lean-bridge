/**
 * Keep nominal Rust acceptance required alongside all older hosted work.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { nominalSubtypeRustCiBlock, enableNominalSubtypeRustWorkflow, disableNominalSubtypeRustWorkflow, assertNominalSubtypeRustWorkflow } from "./nominal-subtype-rust-ci-workflow.mjs";
import { assertNominalSubtypeRubyWorkflow } from "./nominal-subtype-ruby-ci-workflow.mjs";
import { assertNominalSubtypePythonWorkflow } from "./nominal-subtype-python-ci-workflow.mjs";
import { assertStructuralSubtypeWorkflow } from "./structural-subtype-ci-workflow.mjs";

const path = ".github/workflows/consumer-matrix.yml";
const predecessor = "d2d819205189ceaaf80d7e2cc80901111c778de2";

test("nominal Rust CI preserves older jobs and requires four complete pinned-toolchain selections", async () => {
	const source = await readFile(path, "utf8");
	assertNominalSubtypeRustWorkflow(source);
	const previous = execFileSync("git", ["show", `${predecessor}:${path}`], { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
	assert.equal(disableNominalSubtypeRustWorkflow(source), previous);
	assert.equal(enableNominalSubtypeRustWorkflow(previous), source);
	assertNominalSubtypePythonWorkflow(source);
	assertNominalSubtypeRubyWorkflow(source);
	assertStructuralSubtypeWorkflow(source, "consumer-matrix.yml");
});

test("nominal Rust CI rejects skipped gates, wrong toolchains and narrowed original records", async t => {
	const source = await readFile(path, "utf8"), block = nominalSubtypeRustCiBlock;
	const replacements = [
		[block, ""]
		, [block, block.replace("        run: |", "        continue-on-error: true\n        run: |")]
		, [block, block.replace("        if: matrix.profile == 'rust'", "        if: false")]
		, [block, block.replace("        if: always()", "        if: success()")]
		, [block, block.replace("          if-no-files-found: error", "          if-no-files-found: ignore")]
		, [block, block.replace("          path: build/nominal-subtype-rust-ci/", "          path: build/nominal-subtype-rust-ci/*/report.json")]
		, [block, block.replace("          retention-days: 30", "          retention-days: 1")]
		, [block, block.replace(' "$PWD/.toolchains/rust-1.90.0/bin/cargo"', "")]
		, [block, block.replace(' "$PWD/.toolchains/rust-1.90.0/bin/cargo"', ' "$PWD/.toolchains/rust-1.90.0/bin/rustc"')]
		, [block, block.replace(' "$PWD/.toolchains/rust-1.90.0/bin/rustc"', ' "rust"')]
		, [block, block.replace('"$PWD/.toolchains/rust-1.90.0/bin/cargo"\n', '"$PWD/.toolchains/rust-1.90.0/bin/cargo" || true\n')]
		, [block, block.replace("          source scripts/env.sh", "          set +e\n          source scripts/env.sh")]
		, [block, block.replace("        timeout-minutes: 45", "        timeout-minutes: 1")]
		, ["  native-consumers:\n", "  native-consumers:\n    if: false\n"]
		, ["  native-consumers:\n", "  native-consumers:\n    continue-on-error: true\n"]
		, ["        profile: [c-family, python, rust]", "        profile: [c-family, python]"]
		, ["      - native-consumers\n", ""]
		, [block, block.replace("          bash scripts/bootstrap-rust-ci.sh\n", "")]
		, [block, block.replace("          CARGO_BUILD_JOBS: \"1\"", "          CARGO_BUILD_JOBS: \"8\"")]
		, ...["LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR", "LEAN_BRIDGE_NOMINAL_SUBTYPE_RUST_ROUTES", "LEAN_BRIDGE_NOMINAL_SUBTYPE_RUST_MODES"].map(name => [block, block.replace("          LEAN_NUM_THREADS:", `          ${name}: override\n          LEAN_NUM_THREADS:`)])
	];
	for(const [index, [from, to]] of replacements.entries())
	{
		const changed = source.replace(from, () => to); assert.notEqual(changed, source);
		assert.throws(() => assertNominalSubtypeRustWorkflow(changed), assert.AssertionError, `workflow mutation ${index}`);
	}
	const rustJob = source.split("\n  native-consumers:\n")[1].split(/\n {2}[a-z][a-z0-9-]*:\n/u)[0];
	for(const [from, to] of [["fetch-depth: 0", "fetch-depth: 1"], ["rust-1.90.0", "rust-1.89.0"], ["360 || 240", "360 || 1"]])
	{
		const changed = source.replace(rustJob, () => rustJob.replaceAll(from, to)); assert.notEqual(changed, source);
		assert.throws(() => assertNominalSubtypeRustWorkflow(changed), assert.AssertionError);
	}
	t.diagnostic(`${replacements.length + 3} missing, skipped, weakened or narrowed workflow controls`);
});
