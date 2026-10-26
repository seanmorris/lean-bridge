/**
 * Keep the supplemental primitive-base replay recurring, complete and
 * fail-closed without rebuilding Lean packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertNominalPrimitiveSubtypeHistoryCheckout } from "./helpers/nominal-primitive-subtype-history-checkout.mjs";

const path
	= ".github/workflows/nominal-primitive-subtype-supplement.yml";

const assertWorkflow = source => {
	const checkout = source.split(
		"      - name: Check out the exact revision and original evidence history\n"
	)[1].split("      - name: ")[0];
	assertNominalPrimitiveSubtypeHistoryCheckout(checkout);
	for(const required of [
		"  push:\n", "  pull_request:\n", "  workflow_dispatch:\n"
		, "contents: read", "cancel-in-progress: true"
		, "runs-on: ubuntu-24.04", "timeout-minutes: 180"
		, "actions/checkout@v6", "fetch-depth: 0"
		, "persist-credentials: false", "actions/setup-node@v6"
		, 'node-version: "22"', "actions/setup-python@v7"
		, 'python-version: "3.11"', 'python-version: "3.12"'
		, "npm ci --ignore-scripts --no-audit --no-fund"
		, "install-playwright-browsers.sh chromium firefox webkit"
		, "LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_SUPPLEMENT_TEST: \"1\""
		, '"3.11":"${{ steps.python311.outputs.python-path }}"'
		, '"3.12":"${{ steps.python312.outputs.python-path }}"'
		, "LEAN_BRIDGE_TYPE_CORPUS_BROWSERS: chromium,firefox,webkit"
		, "printf 'revision='; git rev-parse HEAD"
		, "printf 'node='; node --version", "printf 'npm='; npm --version"
		, "printf 'python-3.11='; \"$SUPPLEMENT_PYTHON_311\" --version"
		, "printf 'python-3.12='; \"$SUPPLEMENT_PYTHON_312\" --version"
		, "build/nominal-primitive-subtype-supplement/tools.txt"
		, "node --test --test-concurrency=1 --test-reporter=tap"
		, "nominal-primitive-subtype-supplement-caller-tests.mjs"
		, "nominal-primitive-subtype-supplement-installed-tests.mjs"
		, "2>&1 | tee build/nominal-primitive-subtype-supplement/run.tap"
		, "if: always()", "actions/upload-artifact@v7"
		, "if-no-files-found: error", "retention-days: 30"
		, "steps.acceptance.outcome != 'success'", "run: exit 1"
	]) assert.ok(source.includes(required), required);
	assert.equal(source.match(/actions\/setup-python@v7/gu)?.length, 2);
	assert.equal(source.match(/id: acceptance/gu)?.length, 1);
	assert.equal(source.match(/if: always\(\)/gu)?.length, 2);
	assert.ok(source.indexOf("id: acceptance")
		< source.indexOf("actions/upload-artifact@v7"));
};

test("supplemental primitive-base workflow replays every archived caller", async () => {
	assertWorkflow(await readFile(path, "utf8"));
});

test("supplemental primitive-base workflow refuses narrowed and optional gates", async t => {
	const source = await readFile(path, "utf8");
	const replacements = [
		["  push:\n", ""]
		, ["contents: read", "contents: write"]
		, ["cancel-in-progress: true", "cancel-in-progress: false"]
		, ["actions/checkout@v6", "actions/checkout@main"]
		, ["fetch-depth: 0", "fetch-depth: 1"]
		, ["persist-credentials: false", "persist-credentials: true"]
		, ['node-version: "22"', 'node-version: "latest"']
		, ['python-version: "3.11"', 'python-version: "3.10"']
		, ["chromium firefox webkit", "chromium firefox"]
		, ["SUPPLEMENT_TEST: \"1\"", "SUPPLEMENT_TEST: \"0\""]
		, ["--test-concurrency=1", "--test-concurrency=8"]
		, ["nominal-primitive-subtype-supplement-installed-tests.mjs"
			, "nominal-primitive-subtype-supplement-caller-tests.mjs"]
		, ["if: always()", "if: success()"]
		, ["if-no-files-found: error", "if-no-files-found: ignore"]
		, ["steps.acceptance.outcome != 'success'", "failure()"]
		, ["run: exit 1", "run: exit 0"]
	];
	for(const [before, after] of replacements)
	{
		const changed = source.replace(before, () => after);
		assert.notEqual(changed, source, before);
		assert.throws(() => assertWorkflow(changed), undefined
			, `accepted workflow bypass ${JSON.stringify(before)}`);
	}
	assert.equal(replacements.length, 16);
	t.diagnostic("Sixteen supplemental workflow bypasses refused");
});
