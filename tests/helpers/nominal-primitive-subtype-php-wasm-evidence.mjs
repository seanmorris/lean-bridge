/**
 * Authenticate the complete local primitive-base nominal PHP-Wasm archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkNominalPrimitiveSubtypePhpWasmControls } from "./nominal-primitive-subtype-php-wasm-controls.mjs";
import { checkNominalPrimitiveSubtypePhpWasmReport } from "./nominal-primitive-subtype-php-wasm-report.mjs";
import {
	assertNominalPrimitiveSubtypePhpWasmTap
	, nominalPrimitiveSubtypePhpWasmEvidence
	, nominalPrimitiveSubtypePhpWasmEvidenceSources
	, nominalPrimitiveSubtypePhpWasmLoadCeiling
	, nominalPrimitiveSubtypePhpWasmOriginal
	, nominalPrimitiveSubtypePhpWasmProducer
	, nominalPrimitiveSubtypePhpWasmSelections
} from "./nominal-primitive-subtype-php-wasm-provenance.mjs";

export { nominalPrimitiveSubtypePhpWasmEvidence } from "./nominal-primitive-subtype-php-wasm-provenance.mjs";
export const nominalPrimitiveSubtypePhpWasmEvidenceSha256 = "6e2cb3ebc16c0e96db926172944eedc3d38361ed80654c1081b12fbfa25de430";

const failedProducer = "d1974b22c9ea4bb19da90817d9a08d6a6d880a28";
const safePath = path => typeof path === "string" && /^[A-Za-z0-9_.+/[\]-]+$/u.test(path)
	&& !path.startsWith("/") && path.split("/").every(part => part && part !== "." && part !== "..");
const json = (bytes, path) => {
	const value = JSON.parse(bytes); assert.equal(bytes.toString(), canonicalJson(value), path); return value;
};
const expectedControls = (records, mode) => ({
	recordControls: records * 2, semanticControls: mode === "full" ? 55 : 53
});
const checkerPaths = Object.freeze([
	"tests/helpers/nominal-primitive-subtype-php-wasm-controls.mjs"
	, "tests/helpers/nominal-primitive-subtype-php-wasm-directory.mjs"
	, "tests/helpers/nominal-primitive-subtype-php-wasm-provenance.mjs"
	, "tests/helpers/nominal-primitive-subtype-php-wasm-report.mjs"
	, "tests/helpers/nominal-primitive-subtype-php-wasm-sources.mjs"
]);
let cachedRepresentative;

/**
 * Reconcile every retained package, source, report, TAP and negative-control count.
 *
 * @param read - Reader of repository-relative immutable evidence bytes.
 * @param options - Negative-control replay scope.
 * @param options.controls - Replay one representative selection, all four, or none.
 */
export const checkNominalPrimitiveSubtypePhpWasmEvidence = async (
	read = readFile
	, { controls = "representative" } = {}
) => {
	assert.ok(["all", "none", "representative"].includes(controls), controls);
	if(read === readFile && controls === "representative" && cachedRepresentative) return cachedRepresentative;
	const checking = (async () => {
		const bytes = await read(nominalPrimitiveSubtypePhpWasmEvidence + "/index.json");
		assert.equal(sha256(bytes), nominalPrimitiveSubtypePhpWasmEvidenceSha256);
		const index = json(bytes, "index.json"), files = new Map();
		assert.deepEqual(Object.keys(index).sort(), [
			"checkers", "files", "kind", "limitations", "loadCeiling"
			, "producerCommit", "rejected", "runs", "schemaVersion", "selectedSources"
		].sort());
		assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "nominal-primitive-subtype-php-wasm-installed-v1");
		assert.equal(index.producerCommit, nominalPrimitiveSubtypePhpWasmProducer);
		assert.equal(index.loadCeiling, nominalPrimitiveSubtypePhpWasmLoadCeiling);
		assert.ok(Array.isArray(index.limitations) && index.limitations.length === 7
			&& index.limitations.every(item => typeof item === "string" && item.length > 0));
		for(const entry of index.files)
		{
			assert.deepEqual(Object.keys(entry).sort(), ["bytes", "path", "sha256"]);
			assert.ok(safePath(entry.path) && !files.has(entry.path), entry.path);
			assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0); assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
			const value = Buffer.from(await read(nominalPrimitiveSubtypePhpWasmEvidence + "/" + entry.path));
			assert.equal(value.length, entry.bytes, entry.path); assert.equal(sha256(value), entry.sha256, entry.path);
			files.set(entry.path, value);
		}
		const get = path => {
			const value = files.get(path); assert.ok(Buffer.isBuffer(value), path); return value;
		};
		const expectedPaths = [], selectedSources = nominalPrimitiveSubtypePhpWasmEvidenceSources();
		assert.deepEqual(index.selectedSources, selectedSources);
		for(const path of selectedSources)
		{
			const retained = "sources/" + path; expectedPaths.push(retained);
			assert.deepEqual(get(retained), nominalPrimitiveSubtypePhpWasmOriginal(nominalPrimitiveSubtypePhpWasmProducer, path), path);
		}
		assert.deepEqual(index.checkers, checkerPaths.map(path => basename(path)));
		for(const path of checkerPaths)
		{
			const retained = "checkers/" + basename(path); expectedPaths.push(retained);
			assert.deepEqual(get(retained), await readFile(path), path);
		}
		assert.deepEqual(index.runs.map(run => [run.route, run.mode]), nominalPrimitiveSubtypePhpWasmSelections);
		const checked = [];
		for(const [position, run] of index.runs.entries())
		{
			const [route, mode] = nominalPrimitiveSubtypePhpWasmSelections[position], label = `${route}-${mode}`;
			assert.deepEqual([run.label, run.route, run.mode], [label, route, mode]);
			assert.equal(run.producerCommit, nominalPrimitiveSubtypePhpWasmProducer);
			assert.equal(run.loadCeiling, nominalPrimitiveSubtypePhpWasmLoadCeiling);
			assert.match(run.attempt, new RegExp(`^vo1497-php-wasm-installed-${label}-r[1-9][0-9]*$`, "u"));
			const prefix = `${label}/records/`, recordRead = path => Promise.resolve(get(prefix + path));
			const result = await checkNominalPrimitiveSubtypePhpWasmReport(recordRead, {
				route, mode, producerCommit: nominalPrimitiveSubtypePhpWasmProducer
			});
			for(const key of ["counts", "executions", "dispatchObserved", "packageFiles"])
				assert.deepEqual(run[key], result[key], `${label} ${key}`);
			assert.equal(run.records, result.records.length); assert.equal(run.reportSha256, sha256(get(prefix + "report.json")));
			const tapPath = `${label}/run.tap`, tap = get(tapPath); assertNominalPrimitiveSubtypePhpWasmTap(tap.toString(), route, mode);
			assert.equal(run.tapSha256, sha256(tap)); expectedPaths.push(tapPath);
			const controlCounts = expectedControls(result.records.length, mode); assert.deepEqual(run.controls, controlCounts);
			if(controls === "all" || controls === "representative" && position === 0)
				assert.deepEqual(await checkNominalPrimitiveSubtypePhpWasmControls(
					new Map(result.records.map(path => [path, get(prefix + path)]))
					, { route, mode, producerCommit: nominalPrimitiveSubtypePhpWasmProducer }
				), controlCounts);
			expectedPaths.push(...result.records.map(path => prefix + path));
			checked.push({ ...result, ...controlCounts, loadCeiling: nominalPrimitiveSubtypePhpWasmLoadCeiling });
		}
		const rejected = index.rejected, failurePrefix = "rejected-ordinary-full-r1/";
		assert.deepEqual(Object.keys(rejected).sort(), [
			"changedSources", "classification", "label", "loadCeiling"
			, "producerCommit", "records", "tapSha256"
		].sort());
		assert.equal(rejected.label, "ordinary-full-r1"); assert.equal(rejected.producerCommit, failedProducer);
		assert.equal(rejected.loadCeiling, nominalPrimitiveSubtypePhpWasmLoadCeiling);
		assert.match(rejected.classification, /decimal -2147483648 literal became a float in 32-bit PHP/u);
		const failedTap = get(failurePrefix + "run.tap"); assert.equal(sha256(failedTap), rejected.tapSha256);
		assert.match(failedTap.toString(), /Expected an int without numeric coercion/u);
		assert.match(failedTap.toString(), /# pass 0\n# fail 1/u); expectedPaths.push(failurePrefix + "run.tap");
		const failureRecords = [...files.keys()].filter(path => path.startsWith(failurePrefix + "records/"));
		assert.equal(failureRecords.length, rejected.records); expectedPaths.push(...failureRecords);
		const context = json(get(failurePrefix + "records/context.json"), "rejected context");
		assert.equal(context.producerCommit, failedProducer);
		assert.ok(get(failurePrefix + "records/weak.php").includes(Buffer.from("-2147483648")));
		assert.ok(!get(failurePrefix + "records/weak.php").includes(Buffer.from("PHP_INT_MIN")));
		assert.deepEqual(rejected.changedSources, [
			"tests/helpers/nominal-primitive-subtype-php-wasm-fixture.mjs"
			, "tests/helpers/nominal-primitive-subtype-php-wasm-tests.mjs"
		]);
		for(const path of rejected.changedSources)
		{
			const retained = failurePrefix + "sources/" + path; expectedPaths.push(retained);
			assert.deepEqual(get(retained), nominalPrimitiveSubtypePhpWasmOriginal(failedProducer, path));
			assert.notDeepEqual(get(retained), nominalPrimitiveSubtypePhpWasmOriginal(nominalPrimitiveSubtypePhpWasmProducer, path));
		}
		assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
		return {
			producerCommit: index.producerCommit, selections: checked, rejected
			, files: index.files, selectedSources: index.selectedSources, controls
			, installedProfiles: ["php-wasm"], supportPromoted: false
			, hostedAcceptance: false
		};
	})();
	if(read === readFile && controls === "representative") cachedRepresentative = checking;
	return checking;
};
