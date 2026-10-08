/**
 * Tie each Python/Ruby promotion to its original interpreter, report and execution.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { assertFinPythonRubyExecution, assertFinPythonRubyReport, finPythonRubyDirectory, finPythonRubyFamilies, finPythonRubyRevision, finPythonRubyRuntimes, finPythonRubySteps } from "./fin-python-ruby-evidence.mjs";

export const finPythonRubyReceiptPath = `${finPythonRubyDirectory}/receipt-v2.json`;
const readOriginal = async file => {
	const bytes = await readFile(file.path);
	assert.equal(bytes.length, file.bytes); assert.equal(sha256(bytes), file.sha256, file.path);
	return bytes;
};

/** Authenticate both Python executions separately, even when reports are identical. */
export const finPythonRubyPromotionReferences = async () => {
	const bytes = await readFile(finPythonRubyReceiptPath);
	assert.equal(sha256(bytes), "bf9d9e50056cf76630820935709134a7e4033f45721d380d4af2febe5e82dd98");
	const receipt = JSON.parse(bytes), references = [];
	assert.equal(receipt.revision, finPythonRubyRevision);
	assert.deepEqual(receipt.runs.map(run => run.id), finPythonRubyRuntimes.flatMap(runtime => finPythonRubySteps.map(step => `${runtime.id}-${step.id}`)));
	for(const file of receipt.sourceFiles)
		assert.equal(sha256(beforeFinRefinementSource(file.path, await readFile(file.path), file.sha256)), file.sha256, file.path);
	for(const runtime of finPythonRubyRuntimes)
	{
		const execution = receipt.runtimes.find(item => item.id === runtime.id);
		const queue = (await readOriginal(execution.queue)).toString();
		const tap = (await readOriginal(execution.tap)).toString();
		await readOriginal(execution.runner);
		assertFinPythonRubyExecution(runtime, queue, tap);
		for(const [index, step] of finPythonRubySteps.entries())
		{
			const run = receipt.runs.find(item => item.id === `${runtime.id}-${step.id}`);
			assert.equal(run.report.sha256, runtime.reports[index]);
			const report = JSON.parse(await readOriginal(run.report));
			await assertFinPythonRubyReport(report, run);
			const variable = `LEAN_BRIDGE_${step.route === "reviewed" ? "REVIEWED_" : ""}FIN_${step.family.replaceAll("-", "_").toUpperCase()}`;
			const interpreter = runtime.profile === "python"
				? `LEAN_BRIDGE_PYTHON=/app/.toolchains/${runtime.id}/bin/python3`
				: "LEAN_BRIDGE_RUBY=/app/.toolchains/ruby33/bin/ruby LEAN_BRIDGE_GEM=/app/.toolchains/ruby33/bin/gem";
			const pattern = queue.split("\n")[2 + index * 3].split(" pattern=")[1].split(" report=")[0];
			references.push({ id: `fin-${run.id}-installed`, runtime: runtime.id
				, profile: runtime.profile, version: runtime.version
				, family: step.family
				, sourcePath: step.route === "reviewed" ? "reviewed-ir" : "ordinary-source"
				, revision: receipt.revision
				, checks: finPythonRubyFamilies[step.family].checks[runtime.profile]
				, reportPath: run.report.path, reportSha256: run.report.sha256
				, executionFiles: [execution.tap, execution.queue, execution.runner]
				, command: `LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 ${interpreter} LEAN_BRIDGE_LEAN_PREFIX=/app/.toolchains/elan/toolchains/leanprover--lean4---v4.32.2 LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 ${variable}_PROFILES=${runtime.profile} ${variable}_REPORT=${run.report.originalPath} taskset -c 3 node --test --test-concurrency=1 --test-name-pattern='${pattern}' tests/native-fin-${step.family === "product-array" ? "product-arrays" : step.family + "s"}.test.mjs`
				, artifacts: Object.entries(report.archives).map(([path, sha256]) => ({ path, sha256 })) });
		}
	}
	return references;
};
