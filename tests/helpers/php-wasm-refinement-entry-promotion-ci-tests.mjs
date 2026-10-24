/**
 * Adversarial controls for recurring PHP-Wasm refinement-entry promotion.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertPhpWasmRefinementEntryPromotionWorkflow
	, phpWasmRefinementEntryPromotionPath
	, phpWasmRefinementEntryPromotionProducers
} from "./php-wasm-refinement-entry-promotion-ci.mjs";
import {
	phpWasmRefinementEntryArtifactNames
} from "./php-wasm-refinement-entry-hosted-summary.mjs";

test("the recurring PHP-Wasm entry promotion has one bounded same-run topology", async () => {
	const source = await readFile(phpWasmRefinementEntryPromotionPath, "utf8");
	assert.deepEqual(assertPhpWasmRefinementEntryPromotionWorkflow(source), {
		schedule: "17 5 1 * *", producers: 4, maximumProducerJobs: 4
		, cells: 27, artifacts: 27, logicalRoutes: 30
	});
	const revision = "a".repeat(40);
	const pattern = `php-wasm-*-entry-*-${revision}`;
	const expression = new RegExp("^" + pattern.replace(/[.+?^${}()|[\]\\]/gu, "\\$&")
		.replaceAll("*", ".*") + "$", "u");
	const artifacts = phpWasmRefinementEntryArtifactNames(revision);
	assert.equal(artifacts.length, 27);
	assert.ok(artifacts.every(name => expression.test(name)));
	assert.doesNotMatch(`complete-php-wasm-refinement-entry-promotion-${revision}`
		, expression);
});

test("PHP-Wasm entry promotion admits only exact revision tags before default-branch registration", async () => {
	const source = await readFile(phpWasmRefinementEntryPromotionPath, "utf8");
	assert.match(source, /^ {2}create:$/mu);
	assert.match(source, /^ {2}cancel-in-progress: false$/mu);
	const guard = "${{ github.event_name == 'workflow_dispatch' || github.event_name == 'schedule' || (github.event_name == 'create' && github.event.ref_type == 'tag' && github.event.ref == format('ci/php-wasm-refinement-entry/{0}', github.sha)) }}";
	assert.equal(source.split(`    if: ${guard}\n`).length, 6);
	for(const id of [...phpWasmRefinementEntryPromotionProducers.map(item => item.id), "promote"])
	{
		const marker = `  ${id}:\n    if: ${guard}\n`;
		assert.ok(source.includes(marker), id);
		assert.throws(() => assertPhpWasmRefinementEntryPromotionWorkflow(source.replace(marker, `  ${id}:\n`)));
		assert.throws(() => assertPhpWasmRefinementEntryPromotionWorkflow(source.replace(marker, `  ${id}:\n    if: always()\n`)));
	}
	for(const [previous, next] of [
		["  create:\n", "  push:\n"]
		, ["github.event.ref_type == 'tag' && ", ""]
		, ["github.event_name == 'create'", "github.event_name == 'push'"]
		, ["ci/php-wasm-refinement-entry/{0}", "ci/php-wasm-refinement-entry/latest"]
		, ["github.sha", "github.ref_name"]
	]) {
		assert.ok(source.includes(previous));
		assert.throws(() => assertPhpWasmRefinementEntryPromotionWorkflow(source.replace(previous, next)));
	}
});

test("the recurring PHP-Wasm entry promotion rejects scheduling and verifier drift", async t => {
	const source = await readFile(phpWasmRefinementEntryPromotionPath, "utf8");
	const replacements = [
		["17 5 1 * *", "17 5 * * *"]
		, ["  workflow_dispatch:\n", ""]
		, ["  actions: read\n", "  actions: write\n"]
		, ["  contents: read\n", "  contents: write\n"]
		, ["  cancel-in-progress: false\n", "  cancel-in-progress: true\n"]
		, ["  owned:\n", "  forged:\n"]
		, ["    needs: owned\n", ""]
		, ["    needs: copied\n", ""]
		, ["./.github/workflows/php-wasm-refinement-entry.yml"
			, "./.github/workflows/forged.yml"]
		, ["      - indexed\n", ""]
		, ["    runs-on: ubuntu-24.04\n", "    runs-on: ubuntu-latest\n"]
		, ["    timeout-minutes: 20\n", "    timeout-minutes: 40\n"]
		, ["          fetch-depth: 0\n", "          fetch-depth: 1\n"]
		, ["          persist-credentials: false\n", "          persist-credentials: true\n"]
		, ["          node-version: \"22\"\n", "          node-version: \"24\"\n"]
		, ["npm ci --ignore-scripts --no-audit --no-fund"
			, "npm install"]
		, ["actions/download-artifact@v8", "actions/download-artifact@v7"]
		, ["php-wasm-*-entry-*-${{ github.sha }}", "php-wasm-*"]
		, ["          merge-multiple: false\n", "          merge-multiple: true\n"]
		, ["            --producer \"$GITHUB_SHA\" \\\n", ""]
		, ["            --directory \"$GITHUB_WORKSPACE/build/php-wasm-refinement-entry-hosted-artifacts\" \\\n", ""]
		, ["        id: verification\n", "        id: optional\n"]
		, ["        uses: actions/upload-artifact@v7\n"
			, "        uses: actions/upload-artifact@v6\n"]
		, ["          if-no-files-found: error\n", "          if-no-files-found: ignore\n"]
		, ["          retention-days: 30\n", "          retention-days: 1\n"]
		, ["steps.verification.outcome != 'success'"
			, "steps.verification.outcome == 'failure'"]
		, ["        run: exit 1\n", "        run: exit 0\n"]
	];
	for(const [index, [from, to]] of replacements.entries())
	{
		const changed = source.replace(from, to);
		assert.notEqual(changed, source, `promotion mutation ${index}`);
		assert.throws(() => assertPhpWasmRefinementEntryPromotionWorkflow(changed)
			, undefined, `promotion mutation ${index}`);
	}
	const extra = source.replace("  promote:\n", "  forged:\n    uses: ./.github/workflows/php-wasm-refinement-entry.yml\n\n  promote:\n");
	assert.throws(() => assertPhpWasmRefinementEntryPromotionWorkflow(extra));
	t.diagnostic(`${replacements.length + 1} promotion topology and verifier controls`);
});
