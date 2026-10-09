/**
 * Installed adapter and Lean source entry of the ordinary and reviewed Fin npm corpus (VO #1438), in each mode:
 * the unmodified packages at their adapter frames, and the separately built instrumented probe packages at their
 * frames and Lean source. Gated: builds, installs and browsers run only when explicitly enabled.
 *
 * @file
 */
import assert from "node:assert/strict";
import { basename, dirname, resolve } from "node:path";
import test from "node:test";
import { canonicalJson } from "../src/capsule/node.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { checkReviewedFinWasmEntry, recountReviewedFinWasmEntryReport } from "./helpers/reviewed-fin-wasm-entry-producer.mjs";
import { reviewedFinBrowserProfiles } from "./helpers/reviewed-fin-wasm-browser.mjs";
import { expectReviewedFinWasmEntry, reviewedFinWasmEntryModes } from "./helpers/reviewed-fin-wasm-entry.mjs";
import { reviewedFinWasmSelections } from "./helpers/reviewed-fin-wasm-fixture.mjs";
import { corpusBrowserSelection } from "./helpers/type-corpus.mjs";

const browsers = process.env.LEAN_BRIDGE_REVIEWED_FIN_WASM_ENTRY_BROWSER_TEST === "1";
const enabled = process.env.LEAN_BRIDGE_REVIEWED_FIN_WASM_ENTRY_TEST === "1" || browsers;
for(const mode of reviewedFinWasmEntryModes) for(const selection of reviewedFinWasmSelections) for(const reviewed of [false, true])
	test(`${mode} ${reviewed ? "independently reviewed" : "ordinary"} ${selection} Fin entry is accounted in installed npm packages`, { skip: !enabled, timeout: 2_400_000 }, async t => {
		const report = await checkReviewedFinWasmEntry(t, selection, reviewed, mode, { browsers }).catch(error => {
			if(error.details) t.diagnostic(JSON.stringify(error.details));
			throw error;
		});
		// Every required context ran and was accounted in this mode; none can be missing or skipped.
		assert.deepEqual(report.contexts.map(context => context.profile), ["node-javascript", "node-typescript", ...browsers ? reviewedFinBrowserProfiles : []]);
		for(const context of report.contexts) assert.deepEqual([context.mode, context.source, context.calls], [mode, mode === "probe", report.calls], context.profile);
		// The retained transcripts alone reproduce every accounted run.
		// Coverage is declared from the run's own selection, independently of the report.
		const engines = browsers ? corpusBrowserSelection(process.env.LEAN_BRIDGE_TYPE_CORPUS_BROWSERS) : [];
		assert.ok(recountReviewedFinWasmEntryReport(report, await expectReviewedFinWasmEntry(selection, mode), { engines }) >= report.contexts.length);
		const path = resolve(process.env.LEAN_BRIDGE_REVIEWED_FIN_WASM_ENTRY_REPORT_DIR ?? "build/reviewed-fin-wasm-entry", `${mode}-${reviewed ? "reviewed" : "ordinary"}-${selection}.json`);
		await saveLakeFile(dirname(path), basename(path), canonicalJson(report));
	});
