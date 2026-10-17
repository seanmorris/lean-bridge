/**
 * Require every original native command, artifact and blocking outcome after splitting CI.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { assertNativeConsumerPartition, extendPerlCompilerBudget, nativeConsumerPartitionBaseline, nativeConsumerPartitionSummaryGate, nativeConsumerValueGate } from "./native-consumer-partition.mjs";
import { assertWorkflowRunBudget, workflowRunScalars } from "./native-observation-split.mjs";
import { beforeNominalSubtypeJvmCiSource, nominalSubtypeJvmCiHistoryPath } from "./nominal-subtype-jvm-ci-history.mjs";
import { sourceAtHistoryMilestone } from "./source-history-test-source.mjs";

const path = ".github/workflows/consumer-matrix.yml";
const original = name => execFileSync("git", ["show", `${nativeConsumerPartitionBaseline}:${name}`], { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
const jobAt = (source, name) => `  ${name}:\n` + source.split(`  ${name}:\n`)[1].split(/^ {2}[a-z][a-z0-9-]*:\n/mu)[0];
const partitionCheckpoint = async () => beforeNominalSubtypeJvmCiSource(
	path, sourceAtHistoryMilestone(nominalSubtypeJvmCiHistoryPath, path)
);

test("native CI partition checkpoint preserves all 191 command lines, 77 artifact paths and other jobs", async () => {
	const source = await partitionCheckpoint();
	assert.deepEqual(assertNativeConsumerPartition(original(path), source), {
		commands: 191, artifacts: 77
		, independentJobs: ["native-consumers", "native-c-family-values"]
	});
	assert.equal(nativeConsumerValueGate(source).split, true);
	assert.equal(nativeConsumerValueGate(original(path)).split, false);
	assert.ok(assertWorkflowRunBudget(source) > 20);
	for(const job of ["native-consumers", "native-c-family-values"])
		for(const run of workflowRunScalars(jobAt(source, job)))
			assert.equal(execFileSync("/bin/bash", ["-n"], { input: run.source, encoding: "utf8" }), "");
	const record = jobAt(source, "native-consumers").split("      - name: Record native consumer observations\n")[1].split("      - name:")[0];
	assert.doesNotMatch(record, /npm run test:owned-|test:type-corpus:c-family|tests\/native-graph-package|tests\/c-callables/u);
	assert.ok(record.includes("npm run test:native-fin"));
});

test("native CI partition refuses every omitted command and original artifact path", async t => {
	const source = await partitionCheckpoint(), previous = original(path);
	let commands = 0, artifacts = 0;
	for(const job of ["native-consumers", "native-c-family-values"])
	{
		const body = jobAt(source, job);
		const step = job === "native-consumers" ? body.split("        id: type_corpus_c_family\n")[1].split("      - name:")[0] : nativeConsumerValueGate(source).step;
		const lines = step.split("        run: |\n")[1].trimEnd().split("\n");
		for(const line of lines)
		{
			const changed = source.replace(body, () => body.replace(step, () => step.replace(line + "\n", "")));
			assert.notEqual(changed, source, line);
			assert.throws(() => assertNativeConsumerPartition(previous, changed)); commands++;
		}
		const paths = /^ {10}path: \|\n((?: {12}.*\n)+)/mu.exec(body)[1].trimEnd().split("\n");
		for(const line of paths)
		{
			const changed = source.replace(body, () => body.replace(line + "\n", ""));
			assert.notEqual(changed, source, line);
			assert.throws(() => assertNativeConsumerPartition(previous, changed)); artifacts++;
		}
	}
	assert.equal(commands, 193); assert.equal(artifacts, 77);
	t.diagnostic(`${commands} command and ${artifacts} artifact omission controls`);
});

test("native partition rejects optional jobs, permissive shells, lost uploads and incomplete summary prerequisites", async t => {
	const source = await partitionCheckpoint(), previous = original(path), job = jobAt(source, "native-c-family-values");
	const mutations = [
		...[
			["    steps:\n", "    if: false\n    steps:\n"]
			, ["    steps:\n", "    continue-on-error: true\n    steps:\n"]
			, ["    steps:\n", "    needs: native-consumers\n    steps:\n"]
			, ["    timeout-minutes: 240\n", ""]
			, ["    timeout-minutes: 240\n", "    timeout-minutes: 360\n"]
			, ["          fetch-depth: 0", "          fetch-depth: 1"]
			, ["          persist-credentials: false", "          persist-credentials: true"]
			, ["        id: type_corpus_c_family_values\n", "        id: type_corpus_c_family_values\n        if: false\n"]
			, ["        id: type_corpus_c_family_values\n", "        id: type_corpus_c_family_values\n        continue-on-error: true\n"]
			, ["          set -euo pipefail\n", "          set +e\n"]
			, ["        if: always()", "        if: success()"]
			, ["          if-no-files-found: error", "          if-no-files-found: ignore"]
			, ["        run: bash scripts/bootstrap-toolchains.sh --lean-only", "        run: true"]
		].map(([from, to]) => source.replace(job, () => job.replace(from, () => to)))
		, source.replace("      - native-c-family-values\n", "")
		, source.replace(nativeConsumerPartitionSummaryGate, "")
		, source.replace(nativeConsumerPartitionSummaryGate, () => nativeConsumerPartitionSummaryGate.replace(" || ", " && "))
		, source.replace(nativeConsumerPartitionSummaryGate, () => nativeConsumerPartitionSummaryGate.replace("run: exit 1", "run: exit 0"))
		, source.replace(nativeConsumerPartitionSummaryGate, () => nativeConsumerPartitionSummaryGate.replace("!= 'success'", "== 'failure'"))
	];
	for(const changed of mutations)
	{
		assert.notEqual(changed, source);
		assert.throws(() => assertNativeConsumerPartition(previous, changed));
	}
	t.diagnostic(`${mutations.length} required-job, bootstrap, shell, upload and summary controls`);
});

test("combined C/C++ summary proceeds only when both actual jobs succeeded", async () => {
	const source = await partitionCheckpoint(), summary = jobAt(source, "support-summary");
	assert.ok(summary.includes("    steps:\n" + nativeConsumerPartitionSummaryGate));
	const expression = nativeConsumerPartitionSummaryGate.split("        if: ")[1].split("\n")[0]
		.replaceAll("needs.native-consumers", 'needs["native-consumers"]')
		.replaceAll("needs.native-c-family-values", 'needs["native-c-family-values"]');
	for(const first of ["success", "failure", "skipped", "cancelled", "unknown"])
		for(const second of ["success", "failure", "skipped", "cancelled", "unknown"])
			assert.equal(runInNewContext(expression, { needs: { "native-consumers": { result: first }, "native-c-family-values": { result: second } } }, { timeout: 100 }), first !== "success" || second !== "success");
});

test("Perl shared compiler receives 90 minutes with all commands and other budgets unchanged", async () => {
	const perlPath = ".github/workflows/perl-consumer.yml", previous = original(perlPath), current = await readFile(perlPath, "utf8");
	assert.equal(current, extendPerlCompilerBudget(previous));
	const job = jobAt(current, "compiler-checks");
	assert.match(job, /^ {4}timeout-minutes: 90$/mu);
	for(const budget of ["60", "120", "0"])
		assert.notEqual(current.replace(job, () => job.replace("timeout-minutes: 90", "timeout-minutes: " + budget)), extendPerlCompilerBudget(previous));
	assert.throws(() => extendPerlCompilerBudget(current));
});
