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
const bodyOf = (source, job) => new RegExp(
	`^ {2}${job}:\\n[\\s\\S]*?(?=^ {2}[a-z][a-z0-9-]*:\\n)`, "mu"
).exec(source)[0];

test("nominal WIT CI preserves every previous job and enforces all four component selections", async () => {
	const source = await readFile(path, "utf8"); assertNominalSubtypeWitWorkflow(source);
	const previous = execFileSync("git", ["show", `${nominalSubtypeWitCiPredecessor}:${path}`], { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
	const checkpoint = sourceAtHistoryMilestone(
		nominalSubtypeWitCiHistoryPath, path
	);
	assert.equal(disableNominalSubtypeWitWorkflow(checkpoint), previous);
	assert.equal(enableNominalSubtypeWitWorkflow(previous), checkpoint);
	assert.equal(checkpoint.replace(bodyOf(checkpoint, "wasi-consumer"), "")
		, previous.replace(bodyOf(previous, "wasi-consumer"), ""));
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
		, ["  wasi-qualifications:\n", "  wasi-qualifications:\n    if: false\n"]
		, ["  wasi-qualifications:\n", "  wasi-qualifications:\n    continue-on-error: true\n"]
		, ["        continue-on-error: true\n        timeout-minutes: 45", "        timeout-minutes: 45"]
		, ["        if: ${{ !cancelled() }}\n", ""]
		, ["steps.nominal_wit.outcome != 'success' || ", ""]
		, [block, block.replace("-attempt-${{ github.run_attempt }}", "")]
		, [block, block.replace("overwrite: false", "overwrite: true")]
		, ...["LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR", "LEAN_BRIDGE_NOMINAL_SUBTYPE_WIT_ROUTES", "LEAN_BRIDGE_NOMINAL_SUBTYPE_WIT_MODES"].map(name =>
			[block, block.replace("        run: |", `        env:\n          ${name}: override\n        run: |`)])
	]) {
		const changed = source.replace(from, () => to); assert.notEqual(changed, source);
		assert.throws(() => assertNominalSubtypeWitWorkflow(changed), assert.AssertionError); controls++;
	}
	const [beforeSummary, supportSummary] = source.split("\n  support-summary:\n");
	assert.equal(typeof supportSummary, "string");
	const withoutWasi = supportSummary.replace("      - wasi-consumer\n", "");
	assert.notEqual(withoutWasi, supportSummary);
	assert.throws(() => assertNominalSubtypeWitWorkflow(
		`${beforeSummary}\n  support-summary:\n${withoutWasi}`
	), assert.AssertionError); controls++;
	const withoutFinalizer = supportSummary.replace(
		"      - wasi-consumer-finalize\n", ""
	);
	assert.notEqual(withoutFinalizer, supportSummary);
	assert.throws(() => assertNominalSubtypeWitWorkflow(
		`${beforeSummary}\n  support-summary:\n${withoutFinalizer}`
	), assert.AssertionError); controls++;
	const withoutFinalizerGate = supportSummary.replace(
		"      - name: Enforce combined WIT and WASI acceptance\n        if: needs.wasi-consumer-finalize.result != 'success'\n        run: exit 1\n", ""
	);
	assert.notEqual(withoutFinalizerGate, supportSummary);
	assert.throws(() => assertNominalSubtypeWitWorkflow(
		`${beforeSummary}\n  support-summary:\n${withoutFinalizerGate}`
	), assert.AssertionError); controls++;
	const body = bodyOf(source, "wasi-qualifications");
	for(const [from, to] of [["fetch-depth: 0", "fetch-depth: 1"]
		, ["persist-credentials: false", "persist-credentials: true"]
		, ["timeout-minutes: 330", "timeout-minutes: 1"]
		, ["build-essential cmake pkg-config zstd ripgrep", "pkg-config ripgrep"]
		, ["          bash scripts/bootstrap-toolchains.sh --lean-only\n", ""]
		, ["          bash scripts/bootstrap-toolchains.sh --wasm-tools-only\n", ""]
		, ["sha256sum --check --status", "true"]
		, ["if: always() && (steps.nominal_wit.outcome", "if: (steps.nominal_wit.outcome"]
	]) {
		const changed = source.replace(body, () => body.replace(from, () => to)); assert.notEqual(changed, source);
		assert.throws(() => assertNominalSubtypeWitWorkflow(changed), assert.AssertionError); controls++;
	}
	assert.equal(controls, 33); t.diagnostic(`${controls} weakened workflow controls`);
});

test("nominal WIT final gate and observations reject unsuccessful required outcomes", async t => {
	const source = await readFile(path, "utf8"), controlsExpected = 135;
	const base = bodyOf(source, "wasi-consumer");
	const qualifications = bodyOf(source, "wasi-qualifications");
	const finalize = bodyOf(source, "wasi-consumer-finalize");
	let controls = 0;
	const runSteps = (expression, ids, overrides) => runInNewContext(
		expression
		, { always: () => true
		, steps: Object.fromEntries(ids.map(
			id => [id, { outcome: overrides[id] ?? "success" }]
		)) }, { timeout: 100 }
	);
	const baseExpression = base.split(
		"      - name: Enforce WIT and WASI support\n"
	)[1].split("\n")[0].trim().slice("if: ".length);
	const baseSummaries = [...base.matchAll(
		/^ {10}(test_result|executed)="\$\{\{ (.+) \}\}"$/gmu
	)];
	assert.equal(baseSummaries.length, 2);
	assert.equal(runSteps(baseExpression, nominalSubtypeWitRequiredSteps, {}), false);
	for(const [,, value] of baseSummaries)
		assert.ok(["passed", "true"].includes(runSteps(
			value, nominalSubtypeWitRequiredSteps, {}
		)));
	for(const id of nominalSubtypeWitRequiredSteps)
		for(const outcome of ["failure", "skipped", "cancelled"])
		{
			const override = { [id]: outcome };
			assert.equal(runSteps(baseExpression
				, nominalSubtypeWitRequiredSteps, override), true); controls++;
			for(const [, name, value] of baseSummaries)
			{
				assert.equal(runSteps(value, nominalSubtypeWitRequiredSteps, override)
					, name === "test_result" ? "failed" : "false"); controls++;
			}
		}
	const qualificationIds = [
		"nominal_wit", "direct_proof_wit", "optional_parameters_wit"
	];
	const qualificationExpression = qualifications.split(
		"      - name: Enforce all three WIT qualifications\n"
	)[1].split("\n")[0].trim().slice("if: ".length);
	assert.equal(runSteps(qualificationExpression, qualificationIds, {}), false);
	for(const id of qualificationIds)
		for(const outcome of ["failure", "skipped", "cancelled"])
		{
			assert.equal(runSteps(qualificationExpression, qualificationIds
				, { [id]: outcome }), true); controls++;
		}
	const finalJobs = ["wasi-consumer", "wasi-qualifications"];
	const runNeeds = (expression, overrides) => runInNewContext(
		expression.replaceAll("needs.wasi-consumer", 'needs["wasi-consumer"]')
			.replaceAll("needs.wasi-qualifications"
				, 'needs["wasi-qualifications"]')
		, { always: () => true
		, needs: Object.fromEntries(finalJobs.map(
			job => [job, { result: overrides[job] ?? "success" }]
		)) }, { timeout: 100 }
	);
	const finalExpression = finalize.split(
		"      - name: Enforce the combined WIT and WASI result\n"
	)[1].split("\n")[0].trim().slice("if: ".length);
	const finalSummaries = [...finalize.matchAll(
		/^ {10}(test_result|executed)="\$\{\{ (.+) \}\}"$/gmu
	)];
	assert.equal(finalSummaries.length, 2);
	assert.equal(runNeeds(finalExpression, {}), false);
	for(const [,, value] of finalSummaries)
		assert.ok(["passed", "true"].includes(runNeeds(value, {})));
	for(const job of finalJobs)
		for(const outcome of ["failure", "skipped", "cancelled"])
	{
		const override = { [job]: outcome };
		assert.equal(runNeeds(finalExpression, override), true); controls++;
		for(const [, name, value] of finalSummaries)
		{
			assert.equal(runNeeds(value, override)
				, name === "test_result" ? "failed" : "false"); controls++;
		}
	}
	assert.equal(controls, controlsExpected);
	t.diagnostic(`${controls} failed, skipped and cancelled gate/observation controls`);
});
