/**
 * Authenticate the complete local primitive-base nominal native PHP archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkNominalPrimitiveSubtypePhpControls } from "./nominal-primitive-subtype-php-controls.mjs";
import { checkNominalPrimitiveSubtypePhpReport } from "./nominal-primitive-subtype-php-report.mjs";
import {
	nominalPrimitiveSubtypePhpEvidence
	, nominalPrimitiveSubtypePhpEvidenceSources
	, nominalPrimitiveSubtypePhpLoadCeiling
	, nominalPrimitiveSubtypePhpOriginal
	, nominalPrimitiveSubtypePhpProducer
	, nominalPrimitiveSubtypePhpSelections
} from "./nominal-primitive-subtype-php-provenance.mjs";

export { nominalPrimitiveSubtypePhpEvidence } from "./nominal-primitive-subtype-php-provenance.mjs";
export const nominalPrimitiveSubtypePhpEvidenceSha256 = "4babb306def56e0f80dbb88fe01d1b08764beca1d6edd8c19c68f1958db4a401";

const safePath = path => typeof path === "string" && /^[A-Za-z0-9_.+/[\]-]+$/u.test(path)
	&& !path.startsWith("/") && path.split("/").every(part => part && part !== "." && part !== "..");
const json = (bytes, path) => {
	const value = JSON.parse(bytes); assert.equal(bytes.toString(), canonicalJson(value), path); return value;
};
const expectedControls = (records, mode) => ({
	recordControls: records * 2
	, executionControls: 40
	, toolControls: 12
	, resourceControls: 4
	, environmentControls: 10
	, packageControls: 4
	, modelControls: mode === "full" ? 6 : 5
});
const checkerPaths = Object.freeze([
	"tests/helpers/nominal-primitive-subtype-php-controls.mjs"
	, "tests/helpers/nominal-primitive-subtype-php-environment-records.mjs"
	, "tests/helpers/nominal-primitive-subtype-php-generators.mjs"
	, "tests/helpers/nominal-primitive-subtype-php-model-records.mjs"
	, "tests/helpers/nominal-primitive-subtype-php-package-records.mjs"
	, "tests/helpers/nominal-primitive-subtype-php-provenance.mjs"
	, "tests/helpers/nominal-primitive-subtype-php-report.mjs"
	, "tests/helpers/nominal-subtype-php-tool-records.mjs"
]);
let cachedRepresentative;

/**
 * Reconcile every retained package, source, report and negative-control count.
 *
 * @param read - Reader of repository-relative immutable evidence bytes.
 * @param options - Negative-control replay scope.
 * @param options.controls - Replay one representative selection, all four, or none.
 */
export const checkNominalPrimitiveSubtypePhpEvidence = async (
	read = readFile
	, { controls = "representative" } = {}
) => {
	assert.ok(["all", "none", "representative"].includes(controls), controls);
	if(read === readFile && controls === "representative" && cachedRepresentative) return cachedRepresentative;
	const checking = (async () => {
		const bytes = await read(nominalPrimitiveSubtypePhpEvidence + "/index.json");
		assert.equal(sha256(bytes), nominalPrimitiveSubtypePhpEvidenceSha256);
		const index = json(bytes, "index.json"), files = new Map();
		assert.deepEqual(Object.keys(index).sort(), [
			"checkers", "files", "kind", "limitations"
			, "loadCeiling", "producerCommit", "runs"
			, "schemaVersion", "selectedSources"
		].sort());
		assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "nominal-primitive-subtype-php-installed-v1");
		assert.equal(index.producerCommit, nominalPrimitiveSubtypePhpProducer);
		assert.equal(index.loadCeiling, nominalPrimitiveSubtypePhpLoadCeiling);
		assert.ok(Array.isArray(index.limitations) && index.limitations.length === 7
			&& index.limitations.every(item => typeof item === "string" && item.length > 0));
		for(const entry of index.files)
		{
			assert.deepEqual(Object.keys(entry).sort(), ["bytes", "path", "sha256"]);
			assert.ok(safePath(entry.path) && !files.has(entry.path), entry.path);
			assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0); assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
			const value = Buffer.from(await read(nominalPrimitiveSubtypePhpEvidence + "/" + entry.path));
			assert.equal(value.length, entry.bytes, entry.path); assert.equal(sha256(value), entry.sha256, entry.path);
			files.set(entry.path, value);
		}
		const get = path => {
			const value = files.get(path); assert.ok(Buffer.isBuffer(value), path); return value;
		};
		const expectedPaths = [], selectedSources = await nominalPrimitiveSubtypePhpEvidenceSources();
		assert.deepEqual(index.selectedSources, selectedSources);
		for(const path of selectedSources)
		{
			const retained = "sources/" + path; expectedPaths.push(retained);
			assert.deepEqual(get(retained), nominalPrimitiveSubtypePhpOriginal(nominalPrimitiveSubtypePhpProducer, path), path);
		}
		assert.deepEqual(index.checkers, checkerPaths.map(path => basename(path)));
		for(const path of checkerPaths)
		{
			const retained = "checkers/" + basename(path); expectedPaths.push(retained);
			assert.deepEqual(get(retained), await readFile(path), path);
		}
		assert.deepEqual(index.runs.map(run => [run.route, run.mode]), nominalPrimitiveSubtypePhpSelections);
		const checked = [];
		for(const [position, run] of index.runs.entries())
		{
			const [route, mode] = nominalPrimitiveSubtypePhpSelections[position], label = `${route}-${mode}`;
			assert.equal(run.label, label); assert.equal(run.route, route); assert.equal(run.mode, mode);
			assert.equal(run.producerCommit, nominalPrimitiveSubtypePhpProducer);
			assert.equal(run.loadCeiling, nominalPrimitiveSubtypePhpLoadCeiling);
			assert.deepEqual(run.runtime, { platform: "linux", arch: "x64", glibc: "2.36" });
			assert.equal(run.floor, "2.36"); assert.equal(run.phpVersion, "8.2.33"); assert.equal(run.composerVersion, "2.5.5");
			const prefix = `${label}/records/`, recordRead = path => Promise.resolve(get(prefix + path));
			const result = await checkNominalPrimitiveSubtypePhpReport(recordRead, {
				route, mode, producerCommit: nominalPrimitiveSubtypePhpProducer
				, runtime: run.runtime, floor: run.floor
				, phpVersion: run.phpVersion, composerVersion: run.composerVersion
			});
			for(const key of ["counts", "executions", "dispatchObserved", "archiveSha256", "reportSha256"])
				assert.deepEqual(run[key], result[key], `${label} ${key}`);
			assert.equal(run.generatorModules, result.generatorPaths.length); assert.equal(run.records, result.records.length);
			const controlCounts = expectedControls(result.records.length, mode); assert.deepEqual(run.controls, controlCounts);
			if(controls === "all" || controls === "representative" && position === 0)
				assert.deepEqual(await checkNominalPrimitiveSubtypePhpControls(recordRead, {
					route, mode, producerCommit: nominalPrimitiveSubtypePhpProducer
					, runtime: run.runtime, floor: run.floor
					, phpVersion: run.phpVersion, composerVersion: run.composerVersion
				}), controlCounts);
			expectedPaths.push(...result.records.map(path => prefix + path));
			checked.push({ ...result, ...controlCounts, loadCeiling: nominalPrimitiveSubtypePhpLoadCeiling });
		}
		assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
		return {
			producerCommit: index.producerCommit
			, selections: checked
			, files: index.files
			, selectedSources: index.selectedSources
			, controls
			, installedProfiles: ["php-native"]
			, supportPromoted: false, hostedAcceptance: false };
	})();
	if(read === readFile && controls === "representative") cachedRepresentative = checking;
	return checking;
};
