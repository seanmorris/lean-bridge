/**
 * Keep the c-family native budget raised without dropping any native acceptance gate (run 37873560469 cut the
 * c-family Compare step off at 240 minutes while it was still passing tests).
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";

const path = ".github/workflows/consumer-matrix.yml";
const oldBudget = "    timeout-minutes: 240\n";
const newBudget = "    # Run 37873560469 cut the c-family Compare step off at 240 minutes while it was still\n    # passing tests. Python and Rust keep their 240-minute budget.\n    timeout-minutes: ${{ matrix.profile == 'c-family' && 360 || 240 }}\n";
// The authenticated pre-fix workflow (d6070cb) and its unchanged native steps.
const previousSha256 = "1e7839d9b11cf76a009d5a2440f0daf87cde5e5733da70f9169249042324bc84";
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
	const expression = /^\$\{\{ matrix\.profile == '([a-z-]+)' && ([0-9]+) \|\| ([0-9]+) \}\}$/u.exec(lines[0][1]);
	assert.ok(expression, "the budget is the reviewed per-profile expression");
	const profiles = /^ {6}matrix:\n {8}profile: \[([a-z, -]+)\]$/mu.exec(job)[1].split(", ");
	return Object.fromEntries(profiles.map(profile => [profile, Number(profile === expression[1] ? expression[2] : expression[3])]));
};

/**
 * The only workflow change is the native job's budget line and its explanatory comment.
 *
 * @param current - Complete workflow being checked.
 */
export const assertNativeConsumerBudget = current => {
	assert.equal(current.split(newBudget).length, 2, "the reviewed budget appears once");
	assert.equal(sha256(current.replace(newBudget, oldBudget)), previousSha256, "preserve every native step, report gate, upload, enforcement and other job");
	const job = nativeJob(current); assert.ok(job);
	assert.ok(job.includes(newBudget), "the budget belongs to the native job");
	assert.deepEqual(nativeConsumerBudgets(job), { "c-family": 360, python: 240, rust: 240 });
	assert.equal(sha256(job.split(/^ {6}- name: /mu).slice(1).join("")), stepsSha256, "every native step is unchanged");
	assert.doesNotMatch(job.split("    steps:\n")[0], /continue-on-error/u);
};

test("only the c-family native shard gains a 360-minute budget; every native gate is unchanged", async () => {
	assertNativeConsumerBudget(await readFile(path, "utf8"));
});

test("the native budget guard refuses shorter, wider or unbounded budgets, lost gates and other jobs' changes", async () => {
	const current = await readFile(path, "utf8"), job = nativeJob(current);
	const changedJob = update => current.replace(job, update(job));
	const mutations = [
		changedJob(text => text.replace("&& 360 ||", "&& 300 ||"))
		, changedJob(text => text.replace("|| 240 }}", "|| 360 }}"))
		, changedJob(text => text.replace("matrix.profile == 'c-family'", "matrix.profile == 'python'"))
		, changedJob(text => text.replace("    timeout-minutes: ${{ matrix.profile == 'c-family' && 360 || 240 }}\n", ""))
		, changedJob(text => text.replace("    timeout-minutes: ${{ matrix.profile == 'c-family' && 360 || 240 }}\n", "    timeout-minutes: 360\n"))
		, changedJob(text => text.replace("    timeout-minutes: ${{ matrix.profile == 'c-family' && 360 || 240 }}\n", "    timeout-minutes: ${{ matrix.profile == 'c-family' && 360 || 240 }}\n    continue-on-error: true\n"))
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
