/**
 * Authenticate the complete local primitive-base nominal Rust evidence archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertNominalPrimitiveSubtypeRustCiTap } from "./nominal-primitive-subtype-rust-ci-report.mjs";
import { checkNominalPrimitiveSubtypeRustControls } from "./nominal-primitive-subtype-rust-controls.mjs";
import { checkNominalPrimitiveSubtypeRustReport, nominalPrimitiveSubtypeRustRecords } from "./nominal-primitive-subtype-rust-report.mjs";
import {
	nominalPrimitiveSubtypeRustAcceptedLaunches
	, nominalPrimitiveSubtypeRustEvidence
	, nominalPrimitiveSubtypeRustEvidenceSources
	, nominalPrimitiveSubtypeRustInterruptedPaths
	, nominalPrimitiveSubtypeRustInterruptedProducer
	, nominalPrimitiveSubtypeRustLaunchPaths
	, nominalPrimitiveSubtypeRustLoadCeiling
	, nominalPrimitiveSubtypeRustOriginal
	, nominalPrimitiveSubtypeRustPreservedLaunches
	, nominalPrimitiveSubtypeRustProducer
	, nominalPrimitiveSubtypeRustSelections
	, nominalPrimitiveSubtypeRustWorktree
} from "./nominal-primitive-subtype-rust-provenance.mjs";

export { nominalPrimitiveSubtypeRustEvidence } from "./nominal-primitive-subtype-rust-provenance.mjs";
export const nominalPrimitiveSubtypeRustEvidenceSha256 = "b19457891ebc791f6d9a08269e03701b45e9cbf27cd93bed97536e274a56f5dc";

const runtime = { platform: "linux", arch: "x64", glibc: "2.36" }, floor = "2.36";
const fixPaths = Object.freeze([
	"tests/helpers/nominal-primitive-subtype-rust-install-policy-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-rust-install.mjs"
	, "tests/helpers/nominal-primitive-subtype-rust-installed-tests.mjs"
]);
const safePath = path => typeof path === "string" && /^[A-Za-z0-9_.+/-]+$/u.test(path)
	&& !path.startsWith("/") && path.split("/").every(part => part && part !== "." && part !== "..");
const json = (bytes, path) => {
	const value = JSON.parse(bytes); assert.equal(bytes.toString(), canonicalJson(value), path); return value;
};
const duration = tap => {
	const matches = [...tap.toString().matchAll(/^# duration_ms ([0-9]+(?:\.[0-9]+)?)$/gmu)];
	assert.equal(matches.length, 1); return Number(matches[0][1]);
};
const expectedControls = (records, mode) => ({
	recordControls: records * 2
	, environmentControls: mode === "full" ? 60 : 61
	, packageControls: 6
	, modelControls: mode === "full" ? 42 : 23
	, executionControls: 30
});

let cachedRepresentative;

/**
 * Reconcile every retained crate, source, report and interrupted launch.
 *
 * @param read - Reader of repository-relative immutable evidence bytes.
 * @param options - Negative-control replay scope.
 * @param options.controls - Replay one representative matrix, all four, or none.
 */
export const checkNominalPrimitiveSubtypeRustEvidence = async (read = readFile, { controls = "representative" } = {}) => {
	assert.ok(["all", "none", "representative"].includes(controls), controls);
	if(read === readFile && controls === "representative" && cachedRepresentative) return cachedRepresentative;
	const checking = (async () => {
		const bytes = await read(nominalPrimitiveSubtypeRustEvidence + "/index.json");
		assert.equal(sha256(bytes), nominalPrimitiveSubtypeRustEvidenceSha256);
		const index = json(bytes, "index.json"), files = new Map();
		assert.deepEqual(Object.keys(index).sort(), [
			"files", "interruptedProducerCommit", "kind", "limitations", "loadCeiling"
			, "preserved"
			, "producerCommit"
			, "runs"
			, "schemaVersion"
			, "selectedSources"
			, "worktree"
		].sort());
		assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "nominal-primitive-subtype-rust-installed-v1");
		assert.equal(index.producerCommit, nominalPrimitiveSubtypeRustProducer);
		assert.equal(index.interruptedProducerCommit, nominalPrimitiveSubtypeRustInterruptedProducer);
		assert.equal(index.loadCeiling, nominalPrimitiveSubtypeRustLoadCeiling);
		assert.equal(index.worktree, nominalPrimitiveSubtypeRustWorktree);
		assert.ok(Array.isArray(index.limitations) && index.limitations.length === 8
			&& index.limitations.every(item => typeof item === "string" && item.length > 0));
		for(const entry of index.files)
		{
			assert.deepEqual(Object.keys(entry).sort(), ["bytes", "path", "sha256"]);
			assert.ok(safePath(entry.path) && !files.has(entry.path), entry.path);
			assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0); assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
			const value = Buffer.from(await read(nominalPrimitiveSubtypeRustEvidence + "/" + entry.path));
			assert.equal(value.length, entry.bytes, entry.path); assert.equal(sha256(value), entry.sha256, entry.path);
			files.set(entry.path, value);
		}
		const get = path => {
			const value = files.get(path); assert.ok(Buffer.isBuffer(value), path); return value;
		};
		const selectedSources = await nominalPrimitiveSubtypeRustEvidenceSources(), expectedPaths = [];
		assert.deepEqual(index.selectedSources, selectedSources);
		for(const path of selectedSources)
		{
			expectedPaths.push("sources/" + path);
			assert.deepEqual(get("sources/" + path), nominalPrimitiveSubtypeRustOriginal(nominalPrimitiveSubtypeRustProducer, path), path);
		}
		assert.deepEqual(index.runs.map(run => [run.route, run.mode]), nominalPrimitiveSubtypeRustSelections);
		const checked = [];
		for(const [position, run] of index.runs.entries())
		{
			const launch = nominalPrimitiveSubtypeRustAcceptedLaunches[position], { route, mode, attempt } = launch;
			const label = `${route}-${mode}`, origin = nominalPrimitiveSubtypeRustLaunchPaths(launch);
			for(const key of ["route", "mode", "attempt"]) assert.equal(run[key], launch[key], `${label} ${key}`);
			assert.equal(run.label, label); assert.deepEqual(run.origin, origin);
			assert.equal(run.producerCommit, nominalPrimitiveSubtypeRustProducer);
			assert.equal(run.worktree, nominalPrimitiveSubtypeRustWorktree);
			assert.equal(run.loadCeiling, nominalPrimitiveSubtypeRustLoadCeiling);
			assert.deepEqual(run.runtime, runtime); assert.equal(run.floor, floor);
			const tapPath = `${label}/producer/run.tap`, verificationPath = `${label}/producer/verification.json`;
			const tap = get(tapPath), verificationBytes = get(verificationPath), verification = json(verificationBytes, verificationPath);
			assertNominalPrimitiveSubtypeRustCiTap(tap.toString(), route, mode);
			assert.equal(run.durationMs, duration(tap)); assert.equal(run.tapSha256, sha256(tap));
			assert.equal(run.verificationSha256, sha256(verificationBytes));
			const prefix = `${label}/records/`, recordRead = path => Promise.resolve(get(prefix + path));
			const crate = json(get(prefix + "crate.json"), prefix + "crate.json");
			const dependencies = json(get(prefix + "dependencies.json"), prefix + "dependencies.json");
			const recordPaths = nominalPrimitiveSubtypeRustRecords(route, crate, dependencies);
			const result = await checkNominalPrimitiveSubtypeRustReport(recordRead, {
				route, mode, producerCommit: nominalPrimitiveSubtypeRustProducer
				, runtime, floor, toolchain: run.toolchain
			});
			assert.deepEqual(verification, result); assert.deepEqual(run.counts, result.counts);
			assert.equal(run.executions, result.executions); assert.equal(run.dispatchObserved, result.dispatchObserved);
			assert.equal(run.generatorModules, result.generatorModules); assert.equal(run.records, result.records);
			assert.equal(run.reportSha256, sha256(get(prefix + "report.json")));
			const controlCounts = expectedControls(recordPaths.length, mode);
			assert.deepEqual(run.controls, controlCounts);
			if(controls === "all" || controls === "representative" && position === 0)
			{
				const controlled = await checkNominalPrimitiveSubtypeRustControls(recordRead, {
					route, mode, producerCommit: nominalPrimitiveSubtypeRustProducer
					, runtime, floor, toolchain: run.toolchain
				});
				assert.deepEqual(controlled, { ...result, ...controlCounts });
			}
			expectedPaths.push(tapPath, verificationPath, ...recordPaths.map(path => prefix + path));
			checked.push({ ...result, ...controlCounts, attempt, loadCeiling: nominalPrimitiveSubtypeRustLoadCeiling });
		}
		assert.equal(index.preserved.length, 1); assert.deepEqual(nominalPrimitiveSubtypeRustPreservedLaunches, [{
			route: "ordinary"
			, mode: "full"
			, attempt: "r1"
			, producerCommit: nominalPrimitiveSubtypeRustInterruptedProducer
		}]);
		const preserved = index.preserved[0], failed = nominalPrimitiveSubtypeRustPreservedLaunches[0];
		for(const key of ["route", "mode", "attempt", "producerCommit"]) assert.equal(preserved[key], failed[key], key);
		assert.equal(preserved.label, "ordinary-full-r1"); assert.equal(preserved.replacementCommit, nominalPrimitiveSubtypeRustProducer);
		assert.deepEqual(preserved.origin, nominalPrimitiveSubtypeRustInterruptedPaths); assert.equal(preserved.counted, false);
		assert.match(preserved.classification, /offline installer reset the selected load ceiling from 8 to 6/u);
		const interruptedTapPath = "preserved/ordinary-full-r1/run.tap", interruptedTap = get(interruptedTapPath);
		assert.equal(preserved.tapSha256, sha256(interruptedTap));
		assert.match(interruptedTap.toString(), /^TAP version 13\n# Waiting for host load below 8[^]*# Waiting for host load below 6/u);
		assert.doesNotMatch(interruptedTap.toString(), /^(?:ok|not ok) /mu);
		expectedPaths.push(interruptedTapPath);
		const preservedPrefix = "preserved/ordinary-full-r1/records/";
		const retained = [...files.keys()].filter(path => path.startsWith(preservedPrefix)).map(path => path.slice(preservedPrefix.length)).sort();
		assert.deepEqual(preserved.records, retained); assert.equal(retained.length, 33);
		for(const path of ["build-0/model.json", "build-1/model.json", "handoff/archives/nominalprimitivesubtypes-1.0.0.crate"])
			assert.ok(retained.includes(path), path);
		for(const path of ["installation.json", "report.json"]) assert.ok(!retained.includes(path), path);
		expectedPaths.push(...retained.map(path => preservedPrefix + path));
		assert.deepEqual(preserved.fixPaths, fixPaths);
		const patchPath = "preserved/ordinary-full-r1/fix.patch", patch = get(patchPath);
		const expectedPatch = execFileSync("git", ["diff", "--abbrev=7", `${nominalPrimitiveSubtypeRustInterruptedProducer}..${nominalPrimitiveSubtypeRustProducer}`, "--", ...fixPaths]);
		assert.deepEqual(patch, expectedPatch); assert.equal(preserved.fixPatchSha256, sha256(patch)); expectedPaths.push(patchPath);
		for(const path of fixPaths)
		{
			const archivePath = "preserved/ordinary-full-r1/predecessor/" + path;
			assert.deepEqual(get(archivePath), nominalPrimitiveSubtypeRustOriginal(nominalPrimitiveSubtypeRustInterruptedProducer, path), path);
			expectedPaths.push(archivePath);
		}
		assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
		return {
			producerCommit: index.producerCommit
			, interruptedProducerCommit: index.interruptedProducerCommit
			, selections: checked, preserved: index.preserved, files: index.files
			, selectedSources: index.selectedSources, controls
			, installedProfiles: ["rust"]
			, supportPromoted: false
			, hostedAcceptance: false
		};
	})();
	if(read === readFile && controls === "representative") cachedRepresentative = checking;
	return checking;
};
