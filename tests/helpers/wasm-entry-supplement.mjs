/**
 * Supplement existing npm Fin observations with the archived entry measurements.
 * These reports retain package identities, not the original package archives.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertWasmEntryArchive, wasmEntryAttempts, wasmEntryCase, wasmEntryDirectory, wasmEntryRuns } from "./wasm-entry-evidence.mjs";

export const wasmEntrySupplementReceipt = `${wasmEntryDirectory}/receipt.json`;
export const wasmEntrySupplementReceiptSha256 = "04e06f2615e9c3de7e4609b2939cc89c3f0a2795603cd4f12502bf767d85119b";
export const wasmEntrySupplementObservations = Object.freeze([
	"npm-fin-refinements-ordinary-source"
	, "npm-browser-fin-ordinary-source"
	, "reviewed-fin-npm-scalar-structural"
]);
const nodeProfiles = ["node-javascript", "node-typescript"];
const browserProfiles = ["browser-javascript", "browser-react", "browser-worker"];
const oldCounterNote = "Public and raw boundary rejection is executed, but source-dispatch counters are not measured.";
const counterNote = "Unmodified npm packages have measured Wasm adapter entry. Separately built instrumented packages measure Lean source entry; their counters do not measure source entry in the unmodified packages. The scalar and structural measurements supplement this observation only on its listed source route and consumer profiles. Browser reports retain Chromium's version only; Firefox and WebKit versions are not report-carried. These local reports do not establish hosted CI or locked-Nix acceptance.";

/**
 * Authenticate and recount the archive before describing any report's coverage.
 *
 * @param read - Original byte reader, injectable for corruption controls.
 */
export const wasmEntrySupplementReferences = async (read = readFile) => {
	const receiptBytes = await read(wasmEntrySupplementReceipt);
	assert.equal(sha256(receiptBytes), wasmEntrySupplementReceiptSha256, "the unchanged entry archive receipt");
	const receipt = JSON.parse(receiptBytes);
	const { runs } = await assertWasmEntryArchive(receipt, read);
	assert.equal(runs, 440);
	const references = [];
	for(const attempt of wasmEntryAttempts.filter(item => item.outcome === "passed")) for(const name of attempt.reports)
	{
		const reportPath = `${wasmEntryDirectory}/${attempt.id}/${name}.json.gz`;
		const member = receipt.artifacts.find(item => item.path === reportPath);
		const bytes = await read(reportPath);
		// The reader may change between calls. Authenticate these bytes before parsing them again.
		assert.equal(sha256(bytes), member.sha256, reportPath);
		const original = gunzipSync(bytes, { maxOutputLength: member.originalBytes });
		assert.equal(original.length, member.originalBytes);
		assert.equal(sha256(original), member.originalSha256);
		const report = JSON.parse(original);
		const selected = wasmEntryCase(name);
		const profiles = [...nodeProfiles, ...attempt.engines.length ? browserProfiles : []];
		assert.deepEqual(report.contexts.map(context => context.profile), profiles);
		const environment = attempt.engines.length ? "node-and-browser" : "node";
		const id = `wasm-fin-entry-${environment}-${name}`;
		references.push({ id, ...selected, profiles, engines: [...attempt.engines]
			, revision: attempt.revision, attempt: attempt.id, reportPath
			, reportSha256: member.originalSha256, compressedSha256: member.sha256
			, receiptSha256: report.receiptSha256
			, componentIntegrity: report.componentIntegrity
			, calls: report.calls, runs: wasmEntryRuns(attempt.engines) });
	}
	assert.equal(references.length, 16);
	assert.equal(new Set(references.map(item => item.id)).size, references.length);
	assert.equal(references.reduce((sum, item) => sum + item.runs, 0), runs);
	return { receipt, references };
};

/**
 * Prepare additive test evidence. No package archive digest is invented from a receipt or component digest.
 *
 * @param read - Original byte reader.
 */
export const wasmEntrySupplementEvidence = async (read = readFile) => {
	const { receipt, references } = await wasmEntrySupplementReferences(read);
	const paths = [
		wasmEntrySupplementReceipt
		, "tests/helpers/wasm-entry-evidence.mjs"
		, "tests/wasm-entry-evidence.test.mjs"
		, "tests/helpers/wasm-entry-supplement.mjs"
		, "tests/wasm-entry-supplement.test.mjs"
		, ...receipt.artifacts.map(file => file.path)];
	const files = await Promise.all(paths.map(async path => {
		const digest = sha256(await read(path));
		const member = receipt.artifacts.find(item => item.path === path);
		if(member) assert.equal(digest, member.sha256, `archive member changed while collecting evidence: ${path}`);
		if(path === wasmEntrySupplementReceipt) assert.equal(digest, wasmEntrySupplementReceiptSha256);
		return { path, sha256: digest };
	}));
	const entries = references.map(reference => {
		const observed = reference.mode === "original"
			? "Unmodified installed packages: actual Wasm adapter-frame entries are observed. Lean source entry is not measured in these packages."
			: "Separate instrumented installed packages: dbgTrace source markers and Wasm adapter frames are observed, with an unrefined positive control. This does not measure source entry in the unmodified packages.";
		const scope = `${reference.path} ${reference.selection} Fin, ${reference.profiles.join(", ")}. ${observed} ${reference.calls} calls per runtime observation, ${reference.runs} recounted context/engine/phase observations. Strict TypeScript includes its separately accounted prelude. Public rejection, raw adapter rejection, valid calls and recovery are checked. Two author roots reproduce packages; author/build inputs are removed before offline, compiler-free installation. Local execution only, not hosted CI or locked Nix. No nominal-field, callback, Subtype, native-host or PHP-Wasm coverage. The unchanged compressed report ${reference.reportPath} inflates to SHA-256 ${reference.reportSha256}. Package receipt SHA-256 ${reference.receiptSha256} and component integrity ${reference.componentIntegrity} are report-carried identities; package archives and receipt bytes are not retained here. This supplements the existing installed evidence without replacing its archive identities.`;
		const browser = reference.engines.length ? " LEAN_BRIDGE_REVIEWED_FIN_WASM_ENTRY_BROWSER_TEST=1 LEAN_BRIDGE_TYPE_CORPUS_BROWSERS=chromium,firefox,webkit" : "";
		const route = reference.path === "reviewed-ir" ? "independently reviewed" : "ordinary";
		return { id: reference.id, kind: "test", revision: reference.revision
			, command: `LEAN_BRIDGE_REVIEWED_FIN_WASM_ENTRY_TEST=1${browser} node --test --test-concurrency=1 --test-name-pattern='^${reference.mode} ${route} ${reference.selection} Fin entry is accounted in installed npm packages$' tests/reviewed-fin-wasm-entry.test.mjs`
			, scope, files: structuredClone(files), artifacts: [] };
	});
	return { references, entries };
};

/**
 * Validate the exact three existing observations before supplementing their installed-execution evidence.
 * The immutable predecessor may include later, unrelated milestones such as Perl scalar promotion.
 *
 * @param previous - Complete predecessor inventory.
 * @param read - Original archive byte reader.
 */
export const supplementWasmEntryInventory = async (previous, read = readFile) => {
	const document = structuredClone(previous);
	const selected = wasmEntrySupplementObservations.map((id, index) => {
		const matches = document.observations.filter(item => item.id === id);
		assert.equal(matches.length, 1, `${id}: exactly one existing observation`);
		const observation = matches[0];
		assert.deepEqual(observation.profiles, index === 0 ? nodeProfiles : index === 1 ? browserProfiles : [...nodeProfiles, ...browserProfiles]);
		assert.deepEqual(observation.shapes, ["fin"]);
		assert.deepEqual(observation.positions, ["parameter", "result"]);
		assert.equal(observation.path, index === 2 ? "reviewed-ir" : "ordinary-source");
		assert.ok(Object.values(observation.stages).every(stage => stage.state === "passed"));
		assert.ok(observation.stages.installedExecution.evidence.some(id => document.evidence.some(item => item.id === id && item.kind === "installed")), "keep prior installed-package evidence");
		return observation;
	});
	assert.equal(selected[2].limitations.filter(note => note === oldCounterNote).length, 1, "replace only the superseded unmeasured-counter note");
	const { entries, references } = await wasmEntrySupplementEvidence(read);
	for(const entry of entries) assert.ok(!document.evidence.some(item => item.id === entry.id), `already supplemented: ${entry.id}`);
	document.evidence.push(...entries);
	for(const observation of selected)
	{
		const eligible = references.filter(reference => reference.path === observation.path && reference.profiles.some(profile => observation.profiles.includes(profile)));
		observation.stages.installedExecution.evidence.push(...eligible.map(item => item.id));
		observation.limitations = observation.limitations.map(note => note === oldCounterNote ? counterNote : note);
		if(!observation.limitations.includes(counterNote)) observation.limitations.push(counterNote);
	}
	return document;
};
