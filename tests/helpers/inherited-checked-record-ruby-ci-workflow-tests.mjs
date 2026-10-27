/**
 * Refuse Ruby workflow shortcuts while leaving existing consumer gates in place.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertInheritedCheckedRecordRubyWorkflow } from "./inherited-checked-record-ruby-ci-workflow.mjs";

test("inherited checked-record Ruby workflow requires every Ruby selection and complete failure records", async t => {
	const source = await readFile(".github/workflows/inherited-checked-record-ruby.yml", "utf8");
	assertInheritedCheckedRecordRubyWorkflow(source);
	const changes = [
		["  workflow_dispatch:\n", "  push:\n  workflow_dispatch:\n"]
		, ["  workflow_dispatch:\n", "  pull_request:\n  workflow_dispatch:\n"]
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
		, ["          ruby-version: '3.3.12'", "          ruby-version: '3.4'"]
		, ["        uses: ruby/setup-ruby@v1", "        uses: actions/setup-node@v6"]
		, ["          ruby_command=$(command -v ruby)", "          ruby_command=ruby"]
		, ["          gem_command=$(command -v gem)", "          gem_command=gem"]
		, ["        timeout-minutes: 120", "        timeout-minutes: 1"]
		, ["          set -euo pipefail", "          set -eu"]
		, ["          source scripts/env.sh\n", ""]
		, ["bash scripts/run-inherited-checked-record-ruby-ci.sh", "bash scripts/run-inherited-checked-record-ruby-ci.sh || true"]
		, ["bash scripts/run-inherited-checked-record-ruby-ci.sh", "echo skipped"]
		, ["bash scripts/bootstrap-toolchains.sh --lean-only", "bash scripts/bootstrap-toolchains.sh"]
		, ["        if: always()\n", "        if: success()\n"]
		, ["          if-no-files-found: error", "          if-no-files-found: warn"]
		, ["            build/inherited-checked-record-ruby-ci/", "            build/inherited-checked-record-ruby-ci/ordinary-full/"]
		, ["            build/inherited-checked-record-ruby-toolchain.log\n", ""]
		, ["          retention-days: 30", "          retention-days: 1"]
		, ["        if: always() && steps.acceptance.outcome != 'success'", "        if: failure()"]
		, ["        run: exit 1", "        run: exit 0"]
	];
	for(const [before, after] of changes)
	{
		assert.ok(source.includes(before), before);
		assert.throws(() => assertInheritedCheckedRecordRubyWorkflow(source.replace(before, after)), undefined, before);
	}
	t.diagnostic(`${changes.length} workflow bypass controls; no installed acceptance claimed.`);
});
