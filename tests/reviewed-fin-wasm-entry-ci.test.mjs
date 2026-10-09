/**
 * The recurring reviewed Fin Wasm entry job (VO #1438): its exact workflow contract, that the summary refuses any
 * unsuccessful leg, and the leg checker against real retained reports and mutations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { gunzipSync } from "node:zlib";
import { recountReviewedFinWasmEntryReport } from "./helpers/reviewed-fin-wasm-entry-producer.mjs";
import { expectReviewedFinWasmEntry } from "./helpers/reviewed-fin-wasm-entry.mjs";
import { assertWasmEntryCi, checkWasmEntryCiRun, insertWasmEntryCi, wasmEntryCiJob, wasmEntryCiJobName, wasmEntryCiReports, wasmEntryCiSummaryFails } from "./helpers/reviewed-fin-wasm-entry-ci.mjs";
import { wasmEntryDirectory } from "./helpers/wasm-entry-evidence.mjs";

const workflowPath = ".github/workflows/consumer-matrix.yml";
/**
 * Change only the Wasm entry job's own text; identical lines in other jobs stay as they are.
 *
 * @param workflow - Consumer workflow text.
 * @param from - Text or pattern inside the job.
 * @param to - Replacement.
 */
const inJob = (workflow, from, to) => workflow.replace(wasmEntryCiJob, wasmEntryCiJob.replace(from, to));

test("the Wasm entry job runs both modes on all three engines, checked, required and always preserved", async () => {
	const workflow = await readFile(workflowPath, "utf8");
	assert.deepEqual(assertWasmEntryCi(workflow), { modes: ["original", "probe"], engines: ["chromium", "firefox", "webkit"], enforced: true });
	// The job is exactly the inserted text; removing it and inserting again reproduces the workflow byte for byte.
	const without = workflow.replace(wasmEntryCiJob, "").replace(`      - node-consumers\n      - ${wasmEntryCiJobName}\n`, "      - node-consumers\n")
		.replace(`      - name: Enforce reviewed Fin Wasm entry acceptance\n        if: needs.${wasmEntryCiJobName}.result != 'success'\n        run: exit 1\n`, "");
	assert.equal(insertWasmEntryCi(without), workflow);
	assert.throws(() => insertWasmEntryCi(workflow), /not yet present/u);
	const mutations = [
		["one mode", text => inJob(text, "mode: [original, probe]", "mode: [original]")]
		, ["two engines", text => inJob(text, "LEAN_BRIDGE_TYPE_CORPUS_BROWSERS: chromium,firefox,webkit", "LEAN_BRIDGE_TYPE_CORPUS_BROWSERS: chromium,firefox")]
		, ["no browser gate", text => inJob(text, "          LEAN_BRIDGE_REVIEWED_FIN_WASM_ENTRY_BROWSER_TEST: \"1\"\n", "")]
		, ["looser name pattern", text => inJob(text, "--test-name-pattern='^${{ matrix.mode }} (ordinary", "--test-name-pattern='${{ matrix.mode }} (ordinary")]
		, ["no pipefail", text => inJob(text, "          set -euo pipefail\n          mkdir -p build/reviewed-fin-wasm-entry\n", "          mkdir -p build/reviewed-fin-wasm-entry\n")]
		, ["stderr dropped", text => inJob(text, "reviewed-fin-wasm-entry.test.mjs 2>&1 | tee", "reviewed-fin-wasm-entry.test.mjs | tee")]
		, ["no checker", text => inJob(text, /^ {10}node scripts\/check-reviewed-fin-wasm-entry-run\.mjs .*\n/mu, "")]
		, ["continue on error", text => inJob(text, "      - name: Account installed Wasm adapter and Lean source entry in Node and every browser context\n", "      - name: Account installed Wasm adapter and Lean source entry in Node and every browser context\n        continue-on-error: true\n")]
		, ["artifact only on success", text => inJob(text, "      - name: Preserve Wasm entry observations\n        if: always()\n", "      - name: Preserve Wasm entry observations\n")]
		, ["attempts overwrite each other", text => inJob(text, "${{ github.sha }}-${{ github.run_attempt }}", "${{ github.sha }}")]
		, ["fail-fast", text => inJob(text, "      fail-fast: false\n", "")]
		, ["not required", text => text.replace(`      - ${wasmEntryCiJobName}\n`, "")]
		, ["not enforced", text => text.replace(`        if: needs.${wasmEntryCiJobName}.result != 'success'\n`, "        if: false\n")]
		, ["two jobs", text => text.replace(wasmEntryCiJob, wasmEntryCiJob + wasmEntryCiJob)]];
	for(const [label, change] of mutations)
	{
		const changed = change(workflow);
		assert.notEqual(changed, workflow, label);
		assert.throws(() => assertWasmEntryCi(changed), assert.AssertionError, label);
	}
});

test("a failed, cancelled or skipped Wasm entry leg can never be summarized as success", async () => {
	const workflow = await readFile(workflowPath, "utf8");
	assert.equal(wasmEntryCiSummaryFails(workflow, { [wasmEntryCiJobName]: "success" }), false);
	for(const result of ["failure", "cancelled", "skipped"]) assert.equal(wasmEntryCiSummaryFails(workflow, { [wasmEntryCiJobName]: result }), true, result);
	// Without the enforcement step the same failure would pass the summary, so the step is what refuses it.
	const unenforced = workflow.replace(`      - name: Enforce reviewed Fin Wasm entry acceptance\n        if: needs.${wasmEntryCiJobName}.result != 'success'\n        run: exit 1\n`, "");
	assert.equal(wasmEntryCiSummaryFails(unenforced, { [wasmEntryCiJobName]: "failure" }), false);
	assert.throws(() => wasmEntryCiSummaryFails(workflow.replace("  support-summary:\n    name: Publish consumer support summary\n    if: always()\n", "  support-summary:\n    name: Publish consumer support summary\n"), {}));
});

// A real original-mode leg from the retained local browser reports.
const titles = mode => ["ordinary scalar", "independently reviewed scalar", "ordinary structural", "independently reviewed structural"].map((name, index) => `ok ${index + 1} - ${mode} ${name} Fin entry is accounted in installed npm packages`);
const tapOf = mode => ["TAP version 13", ...titles(mode), "1..4", "# tests 4", "# suites 0", "# pass 4", "# fail 0", "# cancelled 0", "# skipped 0", "# todo 0", ""].join("\n");
const retained = async mode => {
	const reports = {};
	for(const name of wasmEntryCiReports(mode))
	{
		const attempt = name.endsWith("ordinary-scalar") ? "browser-scalar-7eae444" : "browser-remaining-7eae444";
		reports[name] = JSON.parse(gunzipSync(await readFile(`${wasmEntryDirectory}/${attempt}/${name}.json.gz`)));
	}
	return reports;
};
const recount = async (report, mode, selection, engines) => recountReviewedFinWasmEntryReport(report, await expectReviewedFinWasmEntry(selection, mode), { engines: [...engines] });
const run = (mode, reports, change = value => value) => change({ mode, tap: tapOf(mode), files: ["run.tap", ...Object.keys(reports).map(name => `${name}.json`)], reports, recount });

test("the leg checker recounts real reports and refuses missing, extra, skipped or misattributed runs", async () => {
	for(const mode of ["original", "probe"])
	{
		const reports = await retained(mode);
		assert.deepEqual(Object.values(await checkWasmEntryCiRun(run(mode, reports))), [53, 53, 53, 53], mode);
	}
	const reports = await retained("original");
	const mutations = [
		value => ({ ...value, mode: "hosted" })
		, value => ({ ...value, files: [...value.files, "extra.json"] })
		, value => ({ ...value, files: value.files.filter(name => name !== "original-reviewed-structural.json") })
		, value => ({ ...value, tap: value.tap.replace("# skipped 0", "# skipped 1") })
		, value => ({ ...value, tap: value.tap.replace("# pass 4", "# pass 3") })
		, value => ({ ...value, tap: value.tap.replace("ok 2 - original independently reviewed scalar", "ok 2 - original ordinary scalar") })
		, value => ({ ...value, tap: value.tap.replace("ok 4 - ", "not ok 4 - ") })
		, value => ({ ...value, reports: { ...value.reports, "original-ordinary-scalar": { ...value.reports["original-ordinary-scalar"], mode: "probe" } } })
		, value => ({ ...value, reports: { ...value.reports, "original-reviewed-scalar": { ...value.reports["original-reviewed-scalar"], path: "ordinary-source" } } })
		, value => ({ ...value, reports: { ...value.reports, "original-ordinary-structural": { ...value.reports["original-ordinary-structural"], instrumentation: "probe build" } } })
		, value => ({ ...value, reports: { ...value.reports, "original-ordinary-structural": { ...value.reports["original-ordinary-structural"], independentBuilds: 1 } } })
		, value => ({ ...value, reports: { ...value.reports, "original-ordinary-scalar": { ...value.reports["original-ordinary-scalar"], contexts: value.reports["original-ordinary-scalar"].contexts.filter(context => context.profile !== "node-typescript") } } })
		, value => ({ ...value, reports: { ...value.reports, "original-ordinary-scalar": { ...value.reports["original-ordinary-scalar"], contexts: value.reports["original-ordinary-scalar"].contexts.map(context => context.profile === "browser-worker" ? { ...context, engines: ["chromium", "firefox"] } : context) } } })
		, value => ({ ...value, recount: async () => 52 })
		, value => ({ ...value, recount: async (report, mode, selection) => recount(report, mode, selection, ["chromium", "firefox"]) })];
	for(const [index, mutate] of mutations.entries()) await assert.rejects(checkWasmEntryCiRun(run("original", reports, mutate)), `mutation ${index}`);
});
