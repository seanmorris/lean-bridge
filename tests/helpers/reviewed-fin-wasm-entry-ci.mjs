/**
 * The required recurring job for the installed reviewed Fin Wasm entry acceptance (VO #1438): one leg per mode,
 * each running every route and selection in Node and every browser context on the three declared engines, and the
 * run checker that recounts each report against coverage it declares itself.
 *
 * @file
 */
import assert from "node:assert/strict";

/** Modes the job covers, one matrix leg each. */
export const wasmEntryCiModes = Object.freeze(["original", "probe"]);
/** Engines every leg must cover, declared here and never read back from a report. */
export const wasmEntryCiEngines = Object.freeze(["chromium", "firefox", "webkit"]);
/** Contexts every report must carry: both Node consumers, then each browser context. */
export const wasmEntryCiContexts = Object.freeze(["node-javascript", "node-typescript", "browser-javascript", "browser-react", "browser-worker"]);
const routes = Object.freeze({ ordinary: "ordinary", reviewed: "independently reviewed" });
const selections = Object.freeze(["scalar", "structural"]);

export const wasmEntryCiJobName = "reviewed-fin-wasm-entry";
const needsLine = `      - ${wasmEntryCiJobName}\n`;
export const wasmEntryCiEnforce = `      - name: Enforce reviewed Fin Wasm entry acceptance
        if: needs.${wasmEntryCiJobName}.result != 'success'
        run: exit 1
`;

const once = (text, part, label) => {
	const index = text.indexOf(part);
	assert.ok(index >= 0 && text.indexOf(part, index + 1) < 0, `exactly one ${label}`);
	return index;
};
const summaryOf = workflow => workflow.slice(once(workflow, "\n  support-summary:\n", "support summary job") + 1);

/**
 * Return the current job without requiring unrelated checkout and receipt
 * plumbing to remain byte-identical to its original insertion template.
 *
 * @param workflow - Complete consumer workflow text.
 */
export const wasmEntryCiJobSource = workflow => {
	const start = once(workflow, `\n  ${wasmEntryCiJobName}:\n`
		, "Wasm entry job") + 1;
	const tail = workflow.slice(start);
	const next = tail.match(/\n {2}[a-z][a-z0-9-]*:\n/u);
	assert.ok(next?.index, "the next job follows the Wasm entry job");
	return tail.slice(0, next.index + 1);
};

/**
 * Require the exact job, both modes and engines, the non-skippable checked step, the always-run artifact, and that
 * the summary needs and enforces the job's result.
 *
 * @param workflow - Consumer workflow text.
 */
export const assertWasmEntryCi = workflow => {
	const job = wasmEntryCiJobSource(workflow);
	assert.match(job, new RegExp(`^  ${wasmEntryCiJobName}:\\n`, "u"));
	assert.match(job, /^ {4}name: Reviewed Fin Wasm entry \(\$\{\{ matrix\.mode \}\}\)$/mu);
	once(job, `        mode: [${wasmEntryCiModes.join(", ")}]\n`, "mode matrix");
	once(job, "      fail-fast: false\n", "non-fail-fast strategy");
	once(job, `          LEAN_BRIDGE_TYPE_CORPUS_BROWSERS: ${wasmEntryCiEngines.join(",")}\n`
		, "browser engine declaration");
	once(job, "          LEAN_BRIDGE_REVIEWED_FIN_WASM_ENTRY_BROWSER_TEST: \"1\"\n"
		, "browser execution gate");
	assert.doesNotMatch(job, /continue-on-error/u);
	assert.match(job, /set -euo pipefail\n/u);
	assert.match(job, /--test-name-pattern='\^\$\{\{ matrix\.mode \}\} \(ordinary\|independently reviewed\) \(scalar\|structural\) Fin entry is accounted in installed npm packages\$'/u);
	assert.match(job, /reviewed-fin-wasm-entry\.test\.mjs 2>&1 \| tee build\/reviewed-fin-wasm-entry\/run\.tap/u);
	assert.match(job, /^ {10}node scripts\/check-reviewed-fin-wasm-entry-run\.mjs build\/reviewed-fin-wasm-entry --mode=\$\{\{ matrix\.mode \}\}$/mu);
	assert.match(job, /- name: Preserve Wasm entry observations\n {8}if: always\(\)\n {8}uses: actions\/upload-artifact@v7/u);
	assert.match(job, /name: reviewed-fin-wasm-entry-\$\{\{ matrix\.mode \}\}-\$\{\{ github\.sha \}\}-\$\{\{ github\.run_attempt \}\}/u);
	assert.match(job, /^ {10}path: build\/reviewed-fin-wasm-entry\/$/mu);
	assert.match(job, /^ {10}if-no-files-found: error$/mu);
	const summary = summaryOf(workflow);
	once(summary, needsLine, "summary requirement");
	assert.ok(summary.indexOf(needsLine) < summary.indexOf("    steps:\n"), "required in needs");
	once(summary, wasmEntryCiEnforce, "result enforcement");
	return { modes: wasmEntryCiModes, engines: wasmEntryCiEngines, enforced: true };
};

/**
 * Whether the summary job fails for the given results of the jobs it needs, as its enforcement steps decide. A job
 * the summary does not enforce leaves it passing, so this proves which results are refused.
 *
 * @param workflow - Consumer workflow text.
 * @param results - Job name to needs.<job>.result value.
 */
export const wasmEntryCiSummaryFails = (workflow, results) => {
	const summary = summaryOf(workflow);
	assert.match(summary, /^ {4}if: always\(\)$/mu, "the summary runs after failed jobs");
	const enforced = [...summary.matchAll(/^ {8}if: needs\.([a-z0-9-]+)\.result != 'success'\n {8}run: exit 1$/gmu)].map(match => match[1]);
	return enforced.some(job => Object.hasOwn(results, job) && results[job] !== "success");
};

/**
 * The four reports one leg must produce, in the producer test's order.
 *
 * @param mode - Leg mode.
 */
export const wasmEntryCiReports = mode => selections.flatMap(selection => Object.keys(routes).map(route => `${mode}-${route}-${selection}`));

/**
 * Check one completed leg: the exact TAP of its four tests, exactly its four reports and nothing else, and each
 * report recounted against its own expectation on the declared engines.
 *
 * @param run - Completed run.
 * @param run.mode - Leg mode.
 * @param run.tap - Original TAP.
 * @param run.files - Every file name in the run directory.
 * @param run.reports - Report name to parsed report.
 * @param run.recount - Recount of one report against its mode and selection on the given engines.
 */
export const checkWasmEntryCiRun = async ({ mode, tap, files, reports, recount }) => {
	assert.ok(wasmEntryCiModes.includes(mode), `Unknown Wasm entry mode: ${mode}`);
	const names = wasmEntryCiReports(mode);
	assert.deepEqual([...files].sort(), ["run.tap", ...names.map(name => `${name}.json`)].sort(), "exactly the run's TAP and four reports");
	assert.deepEqual(Object.keys(reports).sort(), [...names].sort());
	const lines = tap.split("\n");
	for(const line of ["# tests 4", "# pass 4", "# fail 0", "# skipped 0", "# cancelled 0", "# todo 0"]) assert.ok(lines.includes(line), line);
	assert.deepEqual(lines.filter(line => /^(?:not )?ok \d+ - /u.test(line)), selections.flatMap(selection => Object.values(routes).map(route => `${mode} ${route} ${selection} Fin entry is accounted in installed npm packages`)).map((title, index) => `ok ${index + 1} - ${title}`), "the four tests in driver order");
	const summary = {};
	for(const name of names)
	{
		const report = reports[name], [, route, selection] = name.split("-");
		assert.deepEqual([report.mode, report.path, report.selection], [mode, route === "reviewed" ? "reviewed-ir" : "ordinary-source", selection], name);
		assert.deepEqual([report.schemaVersion, report.offlineInstall, report.compilerFreePath, report.sourceRemovedBeforeInstallation, report.reproducible, report.independentBuilds], [1, true, true, true, true, 2], name);
		assert.equal(Object.hasOwn(report, "instrumentation"), mode === "probe", `${name}: only a probe is instrumented`);
		// Both Node contexts and every browser context, on exactly the declared engines.
		assert.deepEqual(report.contexts.map(context => context.profile), wasmEntryCiContexts, `${name}: every context`);
		for(const context of report.contexts.slice(2)) assert.deepEqual(context.engines, wasmEntryCiEngines, `${name}: ${context.profile} engines`);
		const runs = await recount(report, mode, selection, wasmEntryCiEngines);
		assert.equal(runs, 53, `${name}: two Node runs and every engine, variant and phase`);
		summary[name] = runs;
	}
	return summary;
};
