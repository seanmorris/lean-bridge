/**
 * Promote only the reviewed primitive-Subtype browser positions in the accepted run.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertReviewedSubtypeBrowserRecords } from "./reviewed-subtype-browser-report.mjs";

export const browserSubtypeRoot = "docs/evidence/reviewed-subtype-browser-runs-20261010";
export const browserSubtypeIndex = "f2992a5696da474d6dce426c4b6c4aaee5d6eb5f0f989723e9a68a77a0cc5b7a";
export const browserSubtypeProfiles = Object.freeze(["browser-javascript", "browser-react", "browser-worker"]);
export const browserSubtypeEvidenceId = "reviewed-browser-subtype-installed";
export const browserSubtypeObservationId = "reviewed-browser-subtype";
export const browserSubtypeLimit = "Reviewed top-level Subtype parameters and results over String, Nat, Int, ByteArray and UInt8 bases. Two finite instantiations select different constructors; other generic combinations, nested containers, nominal fields, callbacks and owned-value transports are not established by this run. Local-engine acceptance, not hosted locked-Nix acceptance. No entry counters or relocated browser replay were measured. The archive retains selected sources and package digests, not binaries or a complete toolchain closure.";
export const browserSubtypeConversion = "Pass the base value: string, bigint, number or Uint8Array for the tested primitive. The reviewed API selects the checked Lean constructor. Rejection throws; accepted normalization becomes the value received by the export. Results expose the proof-backed base value. Pages, React and workers use the same generated exports.";
const validators = [
	"tests/helpers/reviewed-subtype-browser-promotion.mjs"
	, "tests/helpers/reviewed-subtype-browser-promotion-tests.mjs"
	, "tests/helpers/reviewed-subtype-browser-report.mjs"
	, "tests/helpers/reviewed-subtype-browser-report-tests.mjs"
	, "tests/helpers/reviewed-subtype-browser-fixture.mjs"
	, "tests/helpers/reviewed-subtype-browser-archive-tests.mjs"
	, "scripts/check-reviewed-subtype-browser-reports.mjs"
];

/**
 * Authenticate the whole original archive before selecting the browser observation.
 *
 * @param read - Archive byte reader, injectable for corruption controls.
 */
export const browserSubtypeReference = async (read = readFile) => {
	const indexBytes = await read(browserSubtypeRoot + "/index.json");
	assert.equal(sha256(indexBytes), browserSubtypeIndex);
	const index = JSON.parse(indexBytes), files = new Map();
	for(const artifact of index.artifacts)
	{
		const bytes = await read(browserSubtypeRoot + "/" + artifact.path);
		assert.equal(bytes.length, artifact.bytes); assert.equal(sha256(bytes), artifact.sha256);
		files.set(artifact.path, bytes);
	}
	await assertReviewedSubtypeBrowserRecords(async path => {
		assert.ok(files.has(path), "Missing original " + path); return files.get(path);
	});
	const npm = JSON.parse(files.get("report.json")), start = JSON.parse(files.get("run.start.json"));
	const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";
	const command = [...Object.entries(start.environment).map(([key, value]) => {
		assert.match(key, /^[A-Z_][A-Z0-9_]*$/u); return key + "=" + quote(value);
	})
	, quote(start.command), ...start.args.map(quote)].join(" ");
	return {
		id: browserSubtypeEvidenceId, revision: index.revision
		, sourcePath: "reviewed-ir", profiles: browserSubtypeProfiles, command
		, scope: "Twelve independently reviewed exports; two reproduced author roots deleted before offline compiler-free npm installation. Node and strict TypeScript pass, then Chromium, Firefox and WebKit execute pages, React production/strict mode and dedicated workers. Twelve engine/build executions and fifty-one lifecycle observations each pass 2036 checks and 2024 rejections. Wasm asset identity, reruns, missing-asset recovery, pending unmounts and worker disposal are checked. " + browserSubtypeLimit
		, files: [{ path: browserSubtypeRoot + "/index.json", sha256: browserSubtypeIndex }
			, ...index.artifacts.map(file => ({ path: browserSubtypeRoot + "/" + file.path, sha256: file.sha256 }))]
		, artifacts: [npm.receipt.package, npm.receipt.runtime].map(item => ({ path: item.archive, sha256: item.sha256 }))
	};
};

/**
 * Append six installed cells while preserving every older observation and claim.
 *
 * @param original - Inventory before this promotion.
 * @param reference - Complete independently authenticated browser reference.
 */
export const promoteBrowserSubtype = async (original, reference) => {
	assert.deepEqual(reference, await browserSubtypeReference());
	const result = structuredClone(original);
	assert.ok(!result.evidence.some(item => item.id === browserSubtypeEvidenceId), "Already promoted");
	for(const profile of browserSubtypeProfiles)
		assert.ok(!result.observations.some(item => item.path === "reviewed-ir" && item.profiles.includes(profile)
			&& item.shapes.includes("subtype") && item.positions.some(position => ["parameter", "result"].includes(position))), "Overlapping reviewed Subtype observation");
	const ordinary = original.observations.find(item => item.id === "npm-browser-subtype-ordinary-source");
	assert.ok(ordinary);
	const pins = await Promise.all(validators.map(async path => ({ path, sha256: sha256(await readFile(path)) })));
	result.evidence.push({
		id: reference.id, kind: "installed", revision: reference.revision
		, command: reference.command, scope: reference.scope
		, files: [...pins, ...reference.files]
		, artifacts: reference.artifacts.map(item => ({ ...item, path: reference.id + "/" + item.path })) });
	const notes = {
		analysis: "Fresh Lean reconciles the independent review's exact constructors and specialization choices."
		, generation: "Generated declarations expose primitive base values and preserve the selected public export names."
		, compilation: "Compiled Lean constructs checked Subtypes and projects proof-backed results."
		, packaging: "Two author roots reproduce the archives; consumers install offline after deleting both producers. Browsers use source-free static deployments."
		, installedExecution: reference.scope
	};
	assert.deepEqual(Object.keys(notes), result.stages);
	result.observations.push({
		id: browserSubtypeObservationId, profiles: browserSubtypeProfiles
		, shapes: ["subtype"], positions: ["parameter", "result"], path: "reviewed-ir"
		, scope: reference.scope
		, hostTypes: { subtype: structuredClone(ordinary.hostTypes.subtype) }
		, conversionNotes: { subtype: browserSubtypeConversion }
		, limitations: [browserSubtypeLimit]
		, stages: Object.fromEntries(result.stages.map(stage => [stage, {
			state: "passed", evidence: [reference.id], note: notes[stage]
		}]))
	});
	return result;
};
