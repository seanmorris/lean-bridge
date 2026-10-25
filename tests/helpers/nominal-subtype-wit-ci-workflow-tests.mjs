/**
 * Keep recurring nominal WIT acceptance required and preserve earlier consumer jobs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { nominalSubtypeWitCiBlock, nominalSubtypeWitRequiredSteps, enableNominalSubtypeWitWorkflow, disableNominalSubtypeWitWorkflow, assertNominalSubtypeWitWorkflow } from "./nominal-subtype-wit-ci-workflow.mjs";
import { nominalSubtypeWitCiHistoryPath, nominalSubtypeWitCiPredecessor } from "./nominal-subtype-wit-ci-history.mjs";
import { assertNominalSubtypePhpWorkflow } from "./nominal-subtype-php-ci-workflow.mjs";
import { assertNominalSubtypeJvmWorkflow } from "./nominal-subtype-jvm-ci-workflow.mjs";
import { assertStructuralSubtypeWorkflow } from "./structural-subtype-ci-workflow.mjs";
import { sourceAtHistoryMilestone } from "./source-history-test-source.mjs";
const path = ".github/workflows/consumer-matrix.yml";
const bodyOf = source => /^ {2}wasi-consumer:\n[\s\S]*?(?=^ {2}[a-z][a-z0-9-]*:\n)/mu.exec(source)[0];

test("nominal WIT CI preserves every previous job and enforces all four component selections", async () => {
	const source = await readFile(path, "utf8"); assertNominalSubtypeWitWorkflow(source);
	const previous = execFileSync("git", ["show", `${nominalSubtypeWitCiPredecessor}:${path}`], { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
	const checkpoint = sourceAtHistoryMilestone(
		nominalSubtypeWitCiHistoryPath, path
	);
	assert.equal(disableNominalSubtypeWitWorkflow(checkpoint), previous);
	assert.equal(enableNominalSubtypeWitWorkflow(previous), checkpoint);
	assert.equal(checkpoint.replace(bodyOf(checkpoint), ""), previous.replace(bodyOf(previous), ""));
	assertNominalSubtypePhpWorkflow(source); assertNominalSubtypeJvmWorkflow(source);
	assertStructuralSubtypeWorkflow(source, "consumer-matrix.yml");
});

test("nominal WIT CI refuses dropped gates, partial uploads and weakened bootstrap", async t => {
	const source = await readFile(path, "utf8"), block = nominalSubtypeWitCiBlock;
	let controls = 0;
	for(const [from, to] of [[block, ""]
		, [block, block.replace("        run: |", "        continue-on-error: true\n        run: |")]
		, [block, block.replace("        run: |", "        if: false\n        run: |")]
		, [block, block.replace("if: always()", "if: success()")]
		, [block, block.replace("if-no-files-found: error", "if-no-files-found: ignore")]
		, [block, block.replace("path: build/nominal-subtype-wit-ci/", "path: build/nominal-subtype-wit-ci/*/verification.json")]
		, [block, block.replace("retention-days: 30", "retention-days: 1")]
		, [block, block.replace('"/usr/bin/cc"', '"cc"')]
		, [block, block.replace('"$PWD/.toolchains/wasm-tools/bin/wasm-tools"', '"wasm-tools"')]
		, [block, block.replace('"$PWD/build/wasmtime-c-api"\n', '"$PWD/build/wasmtime-c-api" || true\n')]
		, [block, block.replace("timeout-minutes: 45", "timeout-minutes: 1")]
		, [block, block.replace("set -euo pipefail", "set +e")]
		, ["  wasi-consumer:\n", "  wasi-consumer:\n    if: false\n"]
		, ["  wasi-consumer:\n", "  wasi-consumer:\n    continue-on-error: true\n"]
		, ["      - wasi-consumer\n", ""]
		, ["steps.nominal_wit.outcome == 'success' && ", ""]
		, [" || steps.nominal_wit.outcome != 'success'", ""]
		, [block, block.replace("-attempt-${{ github.run_attempt }}", "")]
		, [block, block.replace("overwrite: false", "overwrite: true")]
		, ...["LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR", "LEAN_BRIDGE_NOMINAL_SUBTYPE_WIT_ROUTES", "LEAN_BRIDGE_NOMINAL_SUBTYPE_WIT_MODES"].map(name =>
			[block, block.replace("        run: |", `        env:\n          ${name}: override\n        run: |`)])
	]) {
		const changed = source.replace(from, () => to); assert.notEqual(changed, source);
		assert.throws(() => assertNominalSubtypeWitWorkflow(changed), assert.AssertionError); controls++;
	}
	const body = bodyOf(source);
	for(const [from, to] of [["fetch-depth: 0", "fetch-depth: 1"]
		, ["persist-credentials: false", "persist-credentials: true"]
		, ["timeout-minutes: 240", "timeout-minutes: 1"]
		, ["build-essential cmake pkg-config zstd ripgrep", "pkg-config ripgrep"]
		, ["          bash scripts/bootstrap-toolchains.sh --lean-only\n", ""]
		, ["          bash scripts/bootstrap-toolchains.sh --wasm-tools-only\n", ""]
		, ["sha256sum --check --status", "true"]
		, ["if: always() && (steps.consumer.outcome", "if: (steps.consumer.outcome"]
	]) {
		const changed = source.replace(body, () => body.replace(from, () => to)); assert.notEqual(changed, source);
		assert.throws(() => assertNominalSubtypeWitWorkflow(changed), assert.AssertionError); controls++;
	}
	assert.equal(controls, 30); t.diagnostic(`${controls} weakened workflow controls`);
});

test("nominal WIT final gate and observations reject unsuccessful required outcomes", async t => {
	const body = bodyOf(await readFile(path, "utf8")); let controls = 0;
	const expression = body.split("      - name: Enforce WIT and WASI support\n")[1].split("\n")[0].trim().slice("if: ".length);
	const ids = [...nominalSubtypeWitRequiredSteps, "nominal_wit"];
	const run = (expression, overrides) => runInNewContext(expression, { always: () => true
		, steps: Object.fromEntries(ids.map(id => [id, { outcome: overrides[id] ?? "success" }])) }, { timeout: 100 });
	assert.equal(run(expression, {}), false);
	const summaries = [...body.matchAll(/^ {10}(test_result|executed)="\$\{\{ (.+) \}\}"$/gmu)]; assert.equal(summaries.length, 2);
	for(const [,, value] of summaries) assert.ok(["passed", "true"].includes(run(value, {})));
	for(const id of ids) for(const outcome of ["failure", "skipped", "cancelled"])
	{
		const override = { [id]: outcome }; assert.equal(run(expression, override), true); controls++;
		for(const [, name, value] of summaries)
		{ assert.equal(run(value, override), name === "test_result" ? "failed" : "false"); controls++; }
	}
	assert.equal(controls, 117); t.diagnostic(`${controls} failed, skipped and cancelled gate/observation controls`);
});
