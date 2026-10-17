/**
 * Workflow bypass controls for inherited checked-record C/C++ acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertInheritedCheckedRecordNativeWorkflow
} from "./inherited-checked-record-native-ci-workflow.mjs";

test("inherited checked-record workflow requires every C/C++ selection", async t => {
	const source = await readFile(
		".github/workflows/inherited-checked-record-native.yml", "utf8");
	assertInheritedCheckedRecordNativeWorkflow(source);
	const changes = [
		["  push:\n", ""], ["  pull_request:\n", ""]
		, ["    runs-on: ubuntu-24.04", "    runs-on: ubuntu-latest"]
		, ["    timeout-minutes: 180", "    timeout-minutes: 20"]
		, ["    env:\n", "    continue-on-error: true\n    env:\n"]
		, ['      LEAN_NUM_THREADS: "1"', '      LEAN_NUM_THREADS: "8"']
		, ["          fetch-depth: 0", "          fetch-depth: 1"]
		, ['          node-version: "22"', '          node-version: "24"']
		, ["        timeout-minutes: 120", "        timeout-minutes: 1"]
		, ["          set -euo pipefail", "          set -eu"]
		, ["          source scripts/env.sh\n", ""]
		, ["bash scripts/run-inherited-checked-record-native-ci.sh"
			, "bash scripts/run-inherited-checked-record-native-ci.sh || true"]
		, ["bash scripts/bootstrap-toolchains.sh --lean-only"
			, "bash scripts/bootstrap-toolchains.sh"]
		, ["        if: always()\n", "        if: success()\n"]
		, ["          if-no-files-found: error", "          if-no-files-found: warn"]
		, ["            build/inherited-checked-record-native-ci/"
			, "            build/inherited-checked-record-native-ci/ordinary-full/"]
		, ["          retention-days: 30", "          retention-days: 1"]
		, ["        if: always() && steps.acceptance.outcome != 'success'"
			, "        if: failure()"]
		, ["        run: exit 1", "        run: exit 0"]
	];
	for(const [before, after] of changes)
	{
		assert.ok(source.includes(before), before);
		assert.throws(() => assertInheritedCheckedRecordNativeWorkflow(
			source.replace(before, after)), undefined, before);
	}
	t.diagnostic(`${changes.length} workflow bypass controls; no installed acceptance claimed.`);
});
