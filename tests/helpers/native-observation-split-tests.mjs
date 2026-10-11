/**
 * Check the hosted expression limit and execute both observation routes without producers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { nativeCiProfiles, nativeCiRecordScript, nativeCiSteps } from "./native-ci-isolation.mjs";
import { assertWorkflowRunBudget, joinNativeObservations, workflowExpressionLength, workflowRunScalars } from "./native-observation-split.mjs";
import "./native-observation-split-history-tests.mjs";

const path = ".github/workflows/consumer-matrix.yml";
const record = script => {
	const args = ["--noprofile", "--norc", "-euo", "pipefail", "-c"
		, 'node() { printf "%s\\0" "$@"; };\n' + script];
	const run = spawnSync("/bin/bash", args, { env: { PATH: "/usr/bin:/bin" } });
	assert.equal(run.status, 0, run.stderr.toString()); assert.equal(run.stderr.length, 0);
	return run.stdout;
};

test("all workflow run scalars fit the hosted expression budget", async () => {
	let count = 0;
	for(const file of await readdir(".github/workflows"))
		if(/\.ya?ml$/u.test(file)) count += assertWorkflowRunBudget(await readFile(`.github/workflows/${file}`, "utf8"));
	assert.ok(count > 100);
	const workflow = await readFile(path, "utf8"), previous = joinNativeObservations(workflow);
	assert.throws(() => assertWorkflowRunBudget(previous), /CI budget/u);
	assert.ok(workflowRunScalars(previous).some(run => workflowExpressionLength(run.source) > 21000));
});

test("run budgets include escaped literals and quoted expression delimiters", () => {
	assert.equal(workflowExpressionLength("plain"), 0);
	assert.equal(workflowExpressionLength("${{ matrix.profile }}"), "matrix.profile".length);
	assert.equal(workflowExpressionLength("a'{}${{ matrix.profile }}"), "format('a''{{}}{0}', matrix.profile)".length);
	assert.equal(workflowExpressionLength("x${{ '}}' }}y"), "format('x{0}y', '}}')".length);
	assert.equal(workflowExpressionLength("x${{ 'a''}}' }}y"), "format('x{0}y', 'a''}}')".length);
	assert.throws(() => workflowExpressionLength("${{ 'unclosed"), /unclosed/u);
	assert.throws(() => assertWorkflowRunBudget(`run: |\n  ${"'".repeat(10500)}\${{ matrix.profile }}\n`), /CI budget/u);
	assert.equal(workflowRunScalars("run: >\n  echo folded\n")[0].source, "echo folded\n");
	assert.equal(workflowRunScalars("run: |+\n  echo kept\n\nnext: value\n")[0].source, "echo kept\n\n");
	assert.equal(workflowRunScalars("run: |-\n  echo stripped\n\nnext: value\n")[0].source, "echo stripped");
	assert.throws(() => workflowRunScalars("run: |2\n  echo indented\n"), /indicator/u);
});

test("split native recording preserves every command, outcome and output path", async () => {
	const workflow = await readFile(path, "utf8"), previous = joinNativeObservations(workflow);
	let count = 0;
	for(const [profile, spec] of Object.entries(nativeCiProfiles))
	{
		const cases = [{}
			, ...["failure", "skipped", "cancelled"].flatMap(outcome =>
			["consumer", spec.ordinary, spec.corpus].map(id => ({ [id]: outcome })))];
		for(const outcomes of cases)
		{
			const current = nativeCiRecordScript(workflow, profile, outcomes), old = nativeCiRecordScript(previous, profile, outcomes);
			assert.deepEqual(record(current), record(old)); count++;
		}
		const args = ["--noprofile", "--norc", "-euo", "pipefail", "-c"
			, "node() { return 17; };\n" + nativeCiRecordScript(workflow, profile)];
		const failure = spawnSync("/bin/bash", args, { env: { PATH: "/usr/bin:/bin" } });
		assert.equal(failure.status, 17, "recording failure must propagate");
	}
	assert.equal(count, 30);
});

test("recording split refuses missing, duplicate and misrouted steps", async () => {
	const workflow = await readFile(path, "utf8");
	const step = nativeCiSteps(workflow).find(item => item.name === "Record native Python and Rust consumer observations");
	assert.ok(step);
	const mutations = [workflow.replace("      - name: " + step.text, "")
		, workflow.replace(step.text, () => step.text + "      - name: " + step.text)
		, workflow.replace(step.condition, "always() && matrix.profile == 'c-family'")];
	for(const changed of mutations)
	{
		assert.notEqual(changed, workflow);
		assert.throws(() => nativeCiRecordScript(changed, "python"), /exactly one/u);
		assert.throws(() => joinNativeObservations(changed));
	}
});
