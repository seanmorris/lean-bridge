/**
 * Refuse Rust workflow shortcuts while leaving existing consumer gates in place.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertNominalPrimitiveSubtypeRustWorkflow } from "./nominal-primitive-subtype-rust-ci-workflow.mjs";

test("primitive-base Rust workflow requires every Rust selection and complete failure records", async t => {
	const source = await readFile(".github/workflows/nominal-primitive-subtype-rust.yml", "utf8");
	assertNominalPrimitiveSubtypeRustWorkflow(source);
	const changes = [
		["  push:\n", ""], ["  pull_request:\n", ""]
		, ["    runs-on: ubuntu-24.04", "    runs-on: ubuntu-latest"]
		, ["    timeout-minutes: 180", "    timeout-minutes: 20"]
		, ["    env:\n", "    continue-on-error: true\n    env:\n"]
		, ["    env:\n", "    needs: optional\n    env:\n"]
		, ["    env:\n", "    if: false\n    env:\n"]
		, ["    env:\n", "    strategy:\n      fail-fast: false\n    env:\n"]
		, ["      LEAN_NUM_THREADS: \"1\"", "      LEAN_NUM_THREADS: \"8\""]
		, ["      LEAN_NUM_THREADS: \"1\"", "      LEAN_NUM_THREADS: \"1\"\n      LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: \"2.36\""]
		, ["          fetch-depth: 0", "          fetch-depth: 1"]
		, ["          persist-credentials: false", "          persist-credentials: true"]
		, ["          node-version: \"22\"", "          node-version: \"24\""]
		, ["          bash scripts/bootstrap-rust-ci.sh 2>&1", "          true 2>&1"]
		, ["          bash scripts/bootstrap-rust-ci.sh 2>&1", "          bash scripts/bootstrap-rust-ci.sh || true 2>&1"]
		, ["$PWD/.toolchains/rust-1.90.0/bin/rustc", "rustc"]
		, ["$PWD/.toolchains/rust-1.90.0/bin/cargo", "cargo"]
		, ["        timeout-minutes: 120", "        timeout-minutes: 1"]
		, ["          set -euo pipefail", "          set -eu"]
		, ["          source scripts/env.sh\n", ""]
		, ["bash scripts/run-nominal-primitive-subtype-rust-ci.sh", "bash scripts/run-nominal-primitive-subtype-rust-ci.sh || true"]
		, ["bash scripts/run-nominal-primitive-subtype-rust-ci.sh", "echo skipped"]
		, ["bash scripts/bootstrap-toolchains.sh --lean-only", "bash scripts/bootstrap-toolchains.sh"]
		, ["        if: always()\n", "        if: success()\n"]
		, ["          if-no-files-found: error", "          if-no-files-found: warn"]
		, ["            build/nominal-primitive-subtype-rust-ci/", "            build/nominal-primitive-subtype-rust-ci/ordinary-full/"]
		, ["            build/nominal-primitive-subtype-rust-toolchain.log\n", ""]
		, ["          retention-days: 30", "          retention-days: 1"]
		, ["        if: always() && steps.acceptance.outcome != 'success'", "        if: failure()"]
		, ["        run: exit 1", "        run: exit 0"]
	];
	for(const [before, after] of changes)
	{
		assert.ok(source.includes(before), before);
		assert.throws(() => assertNominalPrimitiveSubtypeRustWorkflow(source.replace(before, after)), undefined, before);
	}
	t.diagnostic(`${changes.length} workflow bypass controls; no installed acceptance claimed.`);
});
