/**
 * Exact ordinary browser generic/implicit claims backed by the frozen installed run.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";

export const browserGenericEvidenceId = "browser-generic-specializations-ordinary-installed";
export const browserGenericObservationId = "browser-generic-specializations-ordinary-source";
export const browserGenericReceiptPath = "docs/evidence/generic-record-browser-20261008/receipt.json";
export const browserGenericCommandQualification = " The command is a reconstructed reproduction instruction; the original browser queue records times and result, not the verbatim command.";

/** The six signature cells established by the browser fixture, without instance dictionaries. */
export const browserGenericObservation = () => ({
	id: browserGenericObservationId
	, profiles: ["browser-javascript", "browser-react", "browser-worker"]
	, shapes: ["generic", "implicit"]
	, positions: ["signature"]
	, path: "ordinary-source"
	, scope: "Installed ordinary-source npm packages execute nine configured specializations of echo {α : Type u} over alias-named generic records, separate namespaces and List/Option aliases, alongside direct record exports with Array fields. Chromium, Firefox and WebKit run browser pages, React production and Strict Mode, and dedicated workers: 12 executions, 1025 checks and 1023 rejections each. Two relocated builds reproduce archives; the producer source and builds are removed before offline installation. Asset-load recovery, React pending unmount and worker disposal are checked."
	, hostTypes: {
		generic: { signature: "Concrete function over named record, List and Option aliases" }
		, implicit: { signature: "Concrete host signature with no runtime type argument" }
	}
	, stages: Object.fromEntries(Object.entries({
		analysis: "Lean elaborates the configured closed type arguments and records each alias and its origin."
		, generation: "The package exposes nine concrete functions without the unspecialized echo declaration."
		, compilation: "The specialized Lean functions compile to the WebAssembly executed in each browser realm."
		, packaging: "Two relocated builds reproduce both npm archives; the copied handoff installs offline after producer removal."
		, installedExecution: "Chromium, Firefox and WebKit execute the installed package in pages, React production and Strict Mode, and dedicated workers."
	}).map(([stage, note]) => [stage, { state: "passed", evidence: [browserGenericEvidenceId], note }]))
	, limitations: [
		"Ordinary-source, closed configured specializations only; open generic dispatch is not generated."
		, "The fixture has an implicit type argument but no instance dictionary. Instance arguments and reviewed-IR browser specializations are not established by this run."
		, "Local-engine acceptance; this archive does not establish a hosted locked-engine result, source-entry counters or a separate strict TypeScript consumer."
		, "Recursive, inherited, indexed, dependent and refined generic instantiations are outside this observation."
	]
	, conversionNotes: {
		generic: "Import a concrete export and pass the package's named record, List or Option value. Each alias keeps its descriptor identity; no runtime type argument crosses the boundary. Array fields keep their copied array representation."
		, implicit: "Lean supplies the configured type argument before compilation. Call the concrete function with its value only, without a type token or placeholder."
	}
});

/** Build current-source pins while preserving the executed producer and original archive identities. */
export const browserGenericEvidence = async () => {
	const receiptBytes = await readFile(browserGenericReceiptPath);
	assert.equal(sha256(receiptBytes), "f2eff03b171e1ece40124a3bf59b66812ea3956ee3f1687e6c290e2ee3722279");
	const receipt = JSON.parse(receiptBytes);
	const paths = [...receipt.sourceFiles.map(file => file.path)
		, "tests/helpers/generic-record-browser-evidence-tests.mjs"
		, "tests/helpers/browser-generic-promotion.mjs"
		, "tests/helpers/browser-generic-promotion-source-history-tests.mjs"
		, browserGenericReceiptPath, receipt.report.path, receipt.log.path
		, receipt.earlierFailure.log.path];
	return {
		id: browserGenericEvidenceId, kind: "installed", revision: receipt.revision
		, command: "source scripts/env.sh && env -u LEAN_BRIDGE_LAKE_ENGINE LEAN_BRIDGE_GENERIC_RECORD_BROWSER_TEST=1 LEAN_BRIDGE_TYPE_CORPUS_BROWSERS=chromium,firefox,webkit node --test --test-concurrency=1 tests/generic-records-browser.test.mjs"
		, scope: "Local ordinary-source npm browser acceptance at the recorded producer: nine finite function specializations, implicit type arguments and Array-field records; 12 engine/realm executions with 1025 checks and 1023 rejections each. The original report and logs remain byte-identical; current-source pins authenticate their history-aware regression readers." + browserGenericCommandQualification
		, files: await Promise.all(paths.map(async path => ({ path, sha256: sha256(await readFile(path)) })))
		, artifacts: Object.entries(receipt.identities.archives).map(([name, digest]) => ({ path: `browser-generic-specializations/${name}`, sha256: digest }))
	};
};
