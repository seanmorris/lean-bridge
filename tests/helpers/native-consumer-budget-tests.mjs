/**
 * Keep the history-heavy native budgets raised without dropping any native
 * acceptance gate. Runs 37873560469 and 42435025687 cut the c-family and
 * Python comparison steps off while they were still passing tests.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";

const path = ".github/workflows/consumer-matrix.yml";
const oldBudget = "    timeout-minutes: 240\n";
const previousBudget = "    # Run 37873560469 cut the c-family Compare step off at 240 minutes while it was still\n    # passing tests. Python and Rust keep their 240-minute budget.\n    timeout-minutes: ${{ matrix.profile == 'c-family' && 360 || 240 }}\n";
const newBudget = "    # Run 37873560469 cut the c-family Compare step off at 240 minutes while it was still\n    # passing tests. Run 42435025687 then cut Python off at the same whole-job ceiling\n    # after every completed corpus stage had passed. Give both history-heavy profiles\n    # the six-hour budget while keeping Rust at 240 minutes.\n    timeout-minutes: ${{ (matrix.profile == 'c-family' || matrix.profile == 'python') && 360 || 240 }}\n";
// The authenticated pre-fix workflow (d6070cb) and its unchanged native steps.
const previousSha256 = "1e7839d9b11cf76a009d5a2440f0daf87cde5e5733da70f9169249042324bc84";
const reviewedBudgetSha256
	= "0c5b81683de3d568297530531e9f92626b22d43053a6bf78df38f5b56301e2a1";
const stepsSha256 = "2ccbafde74289fbc06688d9a851b3a3d597cd2b58db2bf45147e40deb834d812";
const nativeJob = workflow => /^ {2}native-consumers:\n[\s\S]*?(?=^ {2}[a-z][a-z0-9-]*:\n)/mu.exec(workflow)?.[0];

/**
 * The per-profile budget GitHub evaluates from the job's timeout expression.
 *
 * @param job - The native-consumers job.
 */
export const nativeConsumerBudgets = job => {
	const lines = [...job.matchAll(/^ {4}timeout-minutes: (.+)$/gmu)];
	assert.equal(lines.length, 1, "exactly one job budget");
	const expression = /^\$\{\{ \(matrix\.profile == 'c-family' \|\| matrix\.profile == 'python'\) && ([0-9]+) \|\| ([0-9]+) \}\}$/u.exec(lines[0][1]);
	assert.ok(expression, "the budget is the reviewed per-profile expression");
	const profiles = /^ {6}matrix:\n {8}profile: \[([a-z, -]+)\]$/mu.exec(job)[1].split(", ");
	return Object.fromEntries(profiles.map(profile => [profile, Number(
		profile === "c-family" || profile === "python"
			? expression[1] : expression[2]
	)]));
};

/**
 * The only workflow changes are the native job's budget line with its explanatory comment, and the separately
 * gated FinContainers entry counters. Unwind the exact later Wasm CI transition, then remove the entry counters
 * before checking the original pinned digests. Unknown edits retain their bytes and fail the check.
 *
 * @param workflow - Complete workflow being checked.
 */
export const assertNativeConsumerBudget = workflow => {
	const liveJob = nativeJob(workflow); assert.ok(liveJob);
	assert.ok(liveJob.includes(newBudget)
		, "the current budget belongs to the native job");
	assert.deepEqual(nativeConsumerBudgets(liveJob)
		, { "c-family": 360, python: 360, rust: 240 });
	assert.doesNotMatch(liveJob.split("    steps:\n")[0], /continue-on-error/u);
	const current = beforeFinRefinementSource(
		path, workflow, reviewedBudgetSha256
	);
	assert.equal(sha256(current), reviewedBudgetSha256
		, "reach the authenticated budget milestone");
	assert.equal(current.split(previousBudget).length, 2
		, "the earlier reviewed budget appears once");
	assert.equal(sha256(current.replace(previousBudget, oldBudget)), previousSha256
		, "preserve every native step, report gate, upload, enforcement and other job");
	const reviewedJob = nativeJob(current); assert.ok(reviewedJob);
	assert.equal(sha256(reviewedJob.split(/^ {6}- name: /mu).slice(1).join(""))
		, stepsSha256, "every step at the reviewed budget boundary is unchanged");
};

test("only history-heavy native shards gain 360-minute budgets; every native gate is unchanged", async () => {
	assertNativeConsumerBudget(await readFile(path, "utf8"));
});

test("the native budget guard refuses shorter, wider or unbounded budgets, lost gates and other jobs' changes", async () => {
	const current = await readFile(path, "utf8"), job = nativeJob(current);
	const changedJob = update => current.replace(job, update(job));
	const mutations = [
		changedJob(text => text.replace("&& 360 ||", "&& 300 ||"))
		, changedJob(text => text.replace("|| 240 }}", "|| 360 }}"))
		, changedJob(text => text.replace(" || matrix.profile == 'python'", ""))
		, changedJob(text => text.replace("    timeout-minutes: ${{ (matrix.profile == 'c-family' || matrix.profile == 'python') && 360 || 240 }}\n", ""))
		, changedJob(text => text.replace("    timeout-minutes: ${{ (matrix.profile == 'c-family' || matrix.profile == 'python') && 360 || 240 }}\n", "    timeout-minutes: 360\n"))
		, changedJob(text => text.replace("    timeout-minutes: ${{ (matrix.profile == 'c-family' || matrix.profile == 'python') && 360 || 240 }}\n", "    timeout-minutes: ${{ (matrix.profile == 'c-family' || matrix.profile == 'python') && 360 || 240 }}\n    continue-on-error: true\n"))
		, changedJob(text => text.replace("tests/reviewed-fin-refusals.test.mjs", "tests/reviewed-fin-refusals.test.mjs --test-name-pattern=none"))
		, changedJob(text => text.replace("          test -s build/reviewed-fin-refusals/fin-containers.json\n", ""))
		, changedJob(text => text.replace("            build/reviewed-fin-refusals/\n", ""))
		, changedJob(text => text.replace("      - name: Enforce native consumer support\n        if: always() && ", "      - name: Enforce native consumer support\n        if: false && "))
		, current.replace("  wasi-consumer:\n", "  wasi-consumer:\n    # changed\n")
	];
	assert.equal(mutations.length, 11);
	for(const changed of mutations)
	{
		assert.notEqual(changed, current, "mutation must change the workflow");
		assert.throws(() => assertNativeConsumerBudget(changed), assert.AssertionError);
	}
});
