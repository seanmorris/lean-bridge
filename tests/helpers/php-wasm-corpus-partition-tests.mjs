/**
 * Keep every PHP-Wasm command required after splitting the timed-out job.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { gunzipSync } from "node:zlib";
import { sha256 } from "./source-history-digest.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { assertPhpWasmCorpusPartition, partitionPhpWasmCorpusWorkflow, phpWasmCorpusPartitionPredecessor, phpWasmCorpusPartitionSummaryGate, phpWasmPartitionJob, phpWasmPartitionStep } from "./php-wasm-corpus-partition.mjs";
import { assertWorkflowRunBudget, workflowRunScalars } from "./native-observation-split.mjs";
import "./php-wasm-recursive-failure-evidence-tests.mjs";

const path = ".github/workflows/consumer-matrix.yml";
const partitionWorkflowSha256
	= "e4ce3dc6fb32d4f5a74add5141215f770527f1342210060b19ec6f93816ad98d";
const previous = () => execFileSync("git", ["show", `${phpWasmCorpusPartitionPredecessor}:${path}`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
const read = async () => {
	const source = beforeFinRefinementSource(
		path, await readFile(path, "utf8"), partitionWorkflowSha256
	);
	assert.equal(sha256(source), partitionWorkflowSha256);
	return source;
};
const jobs = ["php-wasm-consumers", "php-wasm-corpus", "php-wasm-observations"];
const states = ["success", "failure", "cancelled", "skipped", ""];
const expression = source => source.replace(/^always\(\) && /u, "")
	.replaceAll(/needs\.([a-z-]+)\.result/gu, 'needs["$1"].result');

test("PHP-Wasm partition preserves all 62 corpus command lines, 38 corpus paths and original transport and ownership steps", async () => {
	const source = await read(), original = previous();
	assert.deepEqual(assertPhpWasmCorpusPartition(original, source), { commands: 62, artifacts: 38, lanes: ["transport-ownership", "values", "refinements"] });
	assert.throws(() => partitionPhpWasmCorpusWorkflow(source));
	assert.ok(assertWorkflowRunBudget(source) > 20);
	for(const name of jobs) for(const run of workflowRunScalars(phpWasmPartitionJob(source, name)))
		assert.equal(execFileSync("/bin/bash", ["-n"], { input: run.source, encoding: "utf8" }), "");
	const oldCore = phpWasmPartitionJob(original, "php-wasm-consumers"), core = phpWasmPartitionJob(source, "php-wasm-consumers");
	for(const name of ["Build twice, install, and execute the PHP-Wasm transport"
		, "Exercise generic copied Zend conversions in 32-bit PHP-Wasm"
		, "Compile ordinary Lean APIs and execute installed PHP-Wasm packages"
		, "Execute owned PHP-Wasm values and installed CLI releases"
		, "Upload owned PHP-Wasm execution evidence"])
		assert.equal(phpWasmPartitionStep(core, name), phpWasmPartitionStep(oldCore, name), name);
	const originalRecord = phpWasmPartitionStep(oldCore, "Record PHP observations").split("\n").find(line => line.includes("node scripts/consumer-ci.mjs record"));
	const recorded = phpWasmPartitionStep(phpWasmPartitionJob(source, "php-wasm-observations"), "Record PHP observations");
	assert.ok(recorded.includes(originalRecord + "\n"));
	assert.doesNotMatch(core, /record --consumer php-wasm|consumer-results-php-wasm/u);
});

test("PHP-Wasm partition refuses every omitted corpus command, report path and required old ownership command", async t => {
	const source = await read(), original = previous(); let controls = 0;
	for(const name of ["Compare installed PHP-Wasm value packages with the shared Lean corpus", "Compare installed PHP-Wasm refinements with the shared Lean corpus"])
	{
		const step = phpWasmPartitionStep(phpWasmPartitionJob(source, "php-wasm-corpus"), name);
		for(const line of step.split("        run: |\n")[1].trimEnd().split("\n"))
		{
			const changed = source.replace(step, () => step.replace(line + "\n", ""));
			assert.notEqual(changed, source); assert.throws(() => assertPhpWasmCorpusPartition(original, changed)); controls++;
		}
	}
	for(const name of jobs)
	{
		const job = phpWasmPartitionJob(source, name);
		for(const match of job.matchAll(/^ {12}build\/[^\n]+\n/gmu))
		{
			const changed = source.replace(job, () => job.replace(match[0], ""));
			assert.notEqual(changed, source); assert.throws(() => assertPhpWasmCorpusPartition(original, changed)); controls++;
		}
	}
	const owned = phpWasmPartitionStep(phpWasmPartitionJob(source, "php-wasm-consumers"), "Execute owned PHP-Wasm values and installed CLI releases");
	for(const line of owned.split("        run: |\n")[1].trimEnd().split("\n"))
	{
		const changed = source.replace(owned, () => owned.replace(line + "\n", ""));
		assert.notEqual(changed, source); assert.throws(() => assertPhpWasmCorpusPartition(original, changed)); controls++;
	}
	assert.ok(controls > 150); t.diagnostic(`${controls} command and original artifact omission controls`);
});

test("PHP-Wasm partition rejects missing lanes, implicit bootstrap, shared artifacts and suppressed outcomes", async t => {
	const source = await read(), original = previous(), corpus = phpWasmPartitionJob(source, "php-wasm-corpus");
	const mutations = [
		...[ ["    steps:\n", "    if: false\n    steps:\n"]
			, ["    steps:\n", "    continue-on-error: true\n    steps:\n"]
			, ["    steps:\n", "    needs: php-wasm-consumers\n    steps:\n"]
			, ["    timeout-minutes: 240\n", "    timeout-minutes: 360\n"]
			, ["      fail-fast: false\n", "      fail-fast: true\n"]
			, ["        profile: [values, refinements]\n", "        profile: [values]\n"]
			, ["        profile: [values, refinements]\n", "        profile: [refinements]\n"]
			, ["          fetch-depth: 0\n", "          fetch-depth: 1\n"]
			, ["          bash scripts/bootstrap-toolchains.sh\n", ""]
			, ["          bash scripts/bootstrap-php-wasm-ci.sh 2>&1 | tee build/php-wasm-corpus-host.log\n", ""]
			, ["          bash scripts/build-lean-runtime.sh 2>&1 | tee build/php-wasm-corpus-runtime.log\n", ""]
			, ["        run: npx playwright install --with-deps chromium\n", "        run: true\n"]
			, ["          LEAN_WASM_RUNTIME_VARIANT: php-wasm-3.1.68\n", ""]
			, ["          set -euo pipefail\n", "          set +e\n"]
			, ["        if: matrix.profile == 'values'\n", "        if: false\n"]
			, ["        if: matrix.profile == 'refinements'\n", "        if: false\n"]
			, ["type-corpus-php-wasm-values-${{ github.sha }}", "type-corpus-php-wasm-${{ github.sha }}"]
			, ["        if: always() && matrix.profile == 'refinements'\n", "        if: success()\n"]
			, ["          if-no-files-found: error\n", "          if-no-files-found: ignore\n"]
			, ["steps.type_corpus_php_wasm.outcome != 'success'", "false"]
			, ["steps.refinements_php_wasm.outcome != 'success'", "false"]
		].map(([from, to]) => source.replace(corpus, () => corpus.replace(from, to)))
		, source.replace("      - php-wasm-corpus\n", "")
		, source.replace("      - php-wasm-observations\n", "")
		, source.replace("    needs: [php-wasm-consumers, php-wasm-corpus]\n", "    needs: [php-wasm-consumers]\n")
		, source.replace(phpWasmCorpusPartitionSummaryGate, "")
		, source.replace(phpWasmCorpusPartitionSummaryGate, () => phpWasmCorpusPartitionSummaryGate.replace(" || ", " && "))
		, source.replace(phpWasmCorpusPartitionSummaryGate, () => phpWasmCorpusPartitionSummaryGate.replace("run: exit 1", "run: exit 0"))
	];
	for(const changed of mutations)
	{ assert.notEqual(changed, source); assert.throws(() => assertPhpWasmCorpusPartition(original, changed)); }
	t.diagnostic(`${mutations.length} bootstrap, lane, upload and outcome suppression controls`);
});

test("PHP-Wasm shell records success only when the core, complete corpus matrix and performance download all succeed", async () => {
	const source = await read(), job = phpWasmPartitionJob(source, "php-wasm-observations");
	const step = phpWasmPartitionStep(job, "Record PHP observations"), body = step.split("        run: |\n")[1];
	const recordLine = body.split("\n").find(line => line.includes("node scripts/consumer-ci.mjs record"));
	assert.ok(recordLine);
	for(const core of states) for(const corpus of states) for(const performance of states)
	{
		const command = body.replace("${{ needs.php-wasm-consumers.result }}", core)
			.replace("${{ needs.php-wasm-corpus.result }}", corpus)
			.replace("${{ steps.performance.outcome }}", performance)
			.replace(recordLine, '          printf "%s %s\\n" "$wasm_result" "$wasm_executed"');
		const env = { ...process.env, BASH_ENV: "/dev/null" };
		const output = execFileSync("/bin/bash", ["--noprofile", "--norc", "-eu", "-o", "pipefail", "-c", command], { encoding: "utf8", env });
		assert.equal(output, [core, corpus, performance].every(state => state === "success") ? "passed true\n" : "failed false\n");
	}
});

test("PHP-Wasm matrix and summary guards reject every non-success while ignoring only the unselected lane", async () => {
	const source = await read(), corpus = phpWasmPartitionJob(source, "php-wasm-corpus");
	const guard = phpWasmPartitionStep(corpus, "Enforce PHP-Wasm corpus").match(/^ {8}if: (.+)$/mu)[1];
	for(const profile of ["values", "refinements"]) for(const selected of states) for(const unselected of states)
	{
		const steps = { type_corpus_php_wasm: { outcome: profile === "values" ? selected : unselected }
			, refinements_php_wasm: { outcome: profile === "refinements" ? selected : unselected } };
		assert.equal(runInNewContext(expression(guard), { matrix: { profile }, steps }), selected !== "success");
	}
	const summary = phpWasmPartitionJob(source, "support-summary");
	assert.ok(summary.indexOf(phpWasmCorpusPartitionSummaryGate) > summary.indexOf("Validate all fourteen targets and publish the table"));
	const enforce = phpWasmCorpusPartitionSummaryGate.match(/^ {8}if: (.+)$/mu)[1];
	for(const corpusState of states) for(const observations of states)
		assert.equal(runInNewContext(expression(enforce), { needs: { "php-wasm-corpus": { result: corpusState }, "php-wasm-observations": { result: observations } } }), corpusState !== "success" || observations !== "success");
});

test("the PHP-Wasm split retains the original timed-out hosted job, annotations and failed summary", async () => {
	const root = "docs/evidence/php-wasm-corpus-timeout-20261014", bytes = await readFile(`${root}/index.json`);
	assert.equal(sha256(bytes), "becc6f0e7e543aa0588e7537d0b18d223a21aeea3745fce02432f10ce25f2791");
	const index = JSON.parse(bytes);
	assert.equal(index.schemaVersion, 1); assert.equal(index.runId, 38474413393);
	assert.equal(index.revision, "9b39bd38db9165e95a948a6bbc8023409cc8b4ce");
	assert.equal(index.retryPerformed, false); assert.equal(index.installedAcceptance, false);
	assert.deepEqual(index.files.map(file => file.path).sort(), ["annotations.json", "php-wasm-job.json", "php-wasm.log.gz", "summary-job.json", "summary.log.gz"]);
	const content = {};
	for(const file of index.files)
	{
		const bytes = await readFile(`${root}/${file.path}`); assert.equal(bytes.length, file.bytes); assert.equal(sha256(bytes), file.sha256);
		content[file.path] = file.path.endsWith(".gz") ? gunzipSync(bytes, { maxOutputLength: 32 * 1024 * 1024 }).toString() : JSON.parse(bytes);
	}
	const job = content["php-wasm-job.json"], summary = content["summary-job.json"];
	assert.equal(job.id, 115561453120); assert.equal(job.run_id, index.runId); assert.equal(job.conclusion, "cancelled");
	assert.equal(summary.id, 115738365762); assert.equal(summary.run_id, index.runId); assert.equal(summary.conclusion, "failure");
	assert.ok(content["annotations.json"].some(item => item.message.includes("maximum execution time of 5h30m0s")));
	for(const name of ["Build twice, install, and execute the PHP-Wasm transport", "Execute owned PHP-Wasm values and installed CLI releases"])
		assert.equal(job.steps.find(step => step.name === name).conclusion, "success");
	assert.equal(job.steps.find(step => step.name === "Compare installed PHP-Wasm packages with the shared Lean corpus").conclusion, "cancelled");
	assert.match(content["php-wasm.log.gz"], /PHP-Wasm generic-record archive preserves every installed loading and caller mode/u);
	assert.match(content["php-wasm.log.gz"], /The operation was canceled/u);
	assert.match(content["summary.log.gz"], /\| php-wasm \| supported \| failed \| no \| no \|/u);
});
