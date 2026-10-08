/**
 * Keep the Node cold-run budget bounded without dropping its downstream acceptance gates.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { beforeNodeConsumerBudgetSource } from "./node-consumer-budget-source-history.mjs";
import { beforeScalarFinSourceEntryCiSource } from "./scalar-fin-source-entry-ci-source-history.mjs";

const path = ".github/workflows/consumer-matrix.yml";
const oldBudget = "    # The full type corpus plus installed multi-profile/CLI acceptance exceeds\n    # two hours on cold runners. Keep the final registry/browser gate enabled.\n    timeout-minutes: 180\n";
const newBudget = "    # Run 37805067353 hit three hours during the corpus. Leave time for the\n    # remaining multi-profile, installed CLI and registry/browser gates.\n    timeout-minutes: 330\n";
const nodeJob = workflow => workflow.match(/^ {2}node-consumers:\n[\s\S]*?(?=^ {2}[a-z][a-z0-9-]*:\n)/mu)?.[0];

/**
 * The only workflow change is this job's budget and its explanatory comment.
 *
 * @param current - Complete workflow being checked.
 * @param previous - Authenticated pre-fix workflow.
 */
const validate = (current, previous) => {
	assert.equal(previous.split(oldBudget).length, 2);
	assert.equal(current, previous.replace(oldBudget, newBudget), "preserve every gate, artifact and other job");
	const job = nodeJob(current); assert.ok(job);
	assert.equal([...job.matchAll(/^ {4}timeout-minutes: (\d+)$/gmu)].length, 1);
	assert.match(job, /^ {4}timeout-minutes: 330$/mu);
	for(const command of [
		"node --test tests/scalar-fin-rejection.test.mjs"
		, "npm run test:consumer:node && npm run test:type-corpus:npm"
		, "node scripts/check-local-npm-release.mjs"
		, "Publish through the installed CLI and consume only the component"
		, "Enforce Node support and the browser corpus"
		, "Preserve installed npm corpus observations"
	]) assert.ok(job.includes(command), command);
};

test("Node consumers retain every cold-run acceptance gate with a 330-minute budget", async () => {
	const current = beforeScalarFinSourceEntryCiSource(path, await readFile(path, "utf8"));
	validate(current, beforeNodeConsumerBudgetSource(path, current));
});

test("Node budget guards reject shorter or unbounded runs, lost gates and changes to other jobs", async () => {
	const current = beforeScalarFinSourceEntryCiSource(path, await readFile(path, "utf8")), previous = beforeNodeConsumerBudgetSource(path, current);
	const changedJob = update => current.replace(nodeJob(current), update(nodeJob(current)));
	const mutations = [
		changedJob(job => job.replace("timeout-minutes: 330", "timeout-minutes: 180"))
		, changedJob(job => job.replace("timeout-minutes: 330", "timeout-minutes: 3600"))
		, changedJob(job => job.replace("    timeout-minutes: 330\n", ""))
		, changedJob(job => job.replace("    timeout-minutes: 330\n", "    timeout-minutes: 330\n    continue-on-error: true\n"))
		, changedJob(job => job.replace("node --test tests/scalar-fin-rejection.test.mjs", "true"))
		, changedJob(job => job.replace("npm run test:consumer:node && npm run test:type-corpus:npm", "npm run test:consumer:node"))
		, changedJob(job => job.replace("node scripts/check-local-npm-release.mjs", "echo skipped"))
		, changedJob(job => job.replace("      - name: Enforce Node support and the browser corpus", "      - name: Enforce Node support and the browser corpus\n        if: false"))
		, changedJob(job => job.replace("      - name: Preserve installed npm corpus observations\n        if: always()", "      - name: Preserve installed npm corpus observations\n        if: success()"))
		, current.replace("    timeout-minutes: 240", "    timeout-minutes: 1")
	];
	assert.equal(mutations.length, 10);
	for(const changed of mutations)
	{
		assert.notEqual(changed, current, "mutation must change the workflow");
		assert.throws(() => validate(changed, previous), assert.AssertionError);
	}
});
