/**
 * Keep nominal Composer CI required and preserve all preceding jobs and records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { nominalSubtypePhpCiBlock, enableNominalSubtypePhpWorkflow, disableNominalSubtypePhpWorkflow, assertNominalSubtypePhpWorkflow } from "./nominal-subtype-php-ci-workflow.mjs";
import { nominalSubtypePhpCiPredecessor } from "./nominal-subtype-php-ci-history.mjs";
import { assertNominalSubtypeJvmWorkflow } from "./nominal-subtype-jvm-ci-workflow.mjs";
import { assertStructuralSubtypeWorkflow } from "./structural-subtype-ci-workflow.mjs";
import { disableNominalSubtypeWitWorkflow } from "./nominal-subtype-wit-ci-workflow.mjs";
import { beforePhpWasmCorpusPartitionSource } from "./php-wasm-corpus-partition-history.mjs";

const path = ".github/workflows/consumer-matrix.yml";
const bodyOf = source => /^ {2}php-consumers:\n[\s\S]*?(?=^ {2}[a-z][a-z0-9-]*:\n)/mu.exec(source)[0];

test("nominal PHP CI preserves every previous job and enforces all four Composer selections", async () => {
	const source = await readFile(path, "utf8"); assertNominalSubtypePhpWorkflow(source);
	const previous = execFileSync("git", ["show", `${nominalSubtypePhpCiPredecessor}:${path}`], { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
	const checkpoint = disableNominalSubtypeWitWorkflow(beforePhpWasmCorpusPartitionSource(path, source));
	assert.equal(disableNominalSubtypePhpWorkflow(checkpoint), previous);
	assert.equal(enableNominalSubtypePhpWorkflow(previous), checkpoint);
	assert.equal(checkpoint.replace(bodyOf(checkpoint), ""), previous.replace(bodyOf(previous), ""));
	assertNominalSubtypeJvmWorkflow(source); assertStructuralSubtypeWorkflow(source, "consumer-matrix.yml");
});

test("nominal PHP CI refuses dropped gates, overwritten attempts and false successful summaries", async t => {
	const source = await readFile(path, "utf8"), block = nominalSubtypePhpCiBlock;
	const replacements = [[block, ""]
		, [block, block.replace("        run: |", "        continue-on-error: true\n        run: |")]
		, [block, block.replace("        run: |", "        if: false\n        run: |")]
		, [block, block.replace("if: always()", "if: success()")]
		, [block, block.replace("if-no-files-found: error", "if-no-files-found: ignore")]
		, [block, block.replace("path: build/nominal-subtype-php-ci/", "path: build/nominal-subtype-php-ci/*/verification.json")]
		, [block, block.replace("retention-days: 30", "retention-days: 1")]
		, [block, block.replace('"/usr/bin/php"', '"php"')]
		, [block, block.replace('"/usr/bin/composer"', '"composer"')]
		, [block, block.replace('"/usr/bin/composer"\n', '"/usr/bin/composer" || true\n')]
		, [block, block.replace("timeout-minutes: 45", "timeout-minutes: 1")]
		, [block, block.replace("set -euo pipefail", "set +e")]
		, ["  php-consumers:\n", "  php-consumers:\n    if: false\n"]
		, ["  php-consumers:\n", "  php-consumers:\n    continue-on-error: true\n"]
		, ["      - php-consumers\n", ""]
		, [' || [ "${{ steps.nominal_php.outcome }}" != success ]', ""]
		, [" || steps.nominal_php.outcome != 'success'", ""]
		, [block, block.replace("-attempt-${{ github.run_attempt }}", "")]
		, [block, block.replace("overwrite: false", "overwrite: true")]
		, ...["LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR", "LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_ROUTES", "LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_MODES"].map(name =>
			[block, block.replace("        run: |", `        env:\n          ${name}: override\n        run: |`)])];
	for(const [index, [from, to]] of replacements.entries())
	{
		const changed = source.replace(from, () => to); assert.notEqual(changed, source);
		assert.throws(() => assertNominalSubtypePhpWorkflow(changed), assert.AssertionError, `workflow mutation ${index}`);
	}
	const body = bodyOf(source), bodyChanges = [["fetch-depth: 0", "fetch-depth: 1"]
		, ["persist-credentials: false", "persist-credentials: true"]
		, ["timeout-minutes: 240", "timeout-minutes: 1"]
		, ["php-mbstring composer", "php-mbstring"]
		, ["          bash scripts/bootstrap-toolchains.sh --lean-only\n", ""]
		, ["if: always() && (steps.consumer.outcome", "if: (steps.consumer.outcome"]
		, ["steps.nominal_php.outcome != 'success'", "steps.nominal_php.outcome == 'failure'"]];
	for(const [from, to] of bodyChanges)
	{
		const changed = source.replace(body, () => body.replace(from, () => to)); assert.notEqual(changed, source);
		assert.throws(() => assertNominalSubtypePhpWorkflow(changed), assert.AssertionError);
	}
	t.diagnostic(`${replacements.length + bodyChanges.length} missing, skipped or weakened workflow controls`);
});

test("nominal PHP final gate rejects failed, skipped and cancelled required outcomes", async () => {
	const body = bodyOf(await readFile(path, "utf8"));
	const expression = body.split("      - name: Enforce PHP support\n")[1].split("\n")[0].trim().slice("if: ".length);
	const ids = ["consumer", "ordinary_php", "type_corpus_php_native", "owned_php", "nominal_php"];
	const evaluate = overrides => runInNewContext(expression, { always: () => true
		, steps: Object.fromEntries(ids.map(id => [id, { outcome: overrides[id] ?? "success" }])) }, { timeout: 100 });
	assert.equal(evaluate({}), false);
	for(const id of ids) for(const outcome of ["failure", "skipped", "cancelled"])
		assert.equal(evaluate({ [id]: outcome }), true, id + "/" + outcome);
});
