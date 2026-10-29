/**
 * Promote exactly the complete 204-cell proof-erasure matrix.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import {
	directProofErasureHostedEvidenceDirectory
	, directProofErasureHostedLanes
} from "./direct-proof-erasure-hosted-archive.mjs";
import {
	checkDirectProofErasureHostedEvidence
} from "./direct-proof-erasure-hosted-evidence.mjs";

export const directProofErasureCompleteEvidenceId
	= "hosted-direct-proof-erasure-complete";
export const directProofErasureCompletePaths = Object.freeze([
	"ordinary-source", "reviewed-ir"
]);
export const directProofErasureCompletePositions = Object.freeze([
	"parameter", "result", "field", "callback-parameter"
	, "callback-result", "signature"
]);
export const directProofErasureCompleteProfiles = Object.freeze(
	directProofErasureHostedLanes.flatMap(lane => lane.profiles)
);
export const directProofErasureCompleteCells = Object.freeze(
	directProofErasureCompleteProfiles.flatMap(profile =>
		directProofErasureCompletePaths.flatMap(path =>
			directProofErasureCompletePositions.map(position =>
				`${profile}/proof/${path}/${position}`)))
);
assert.equal(directProofErasureCompleteProfiles.length, 17);
assert.equal(new Set(directProofErasureCompleteProfiles).size, 17);
assert.equal(directProofErasureCompleteCells.length, 204);
assert.equal(new Set(directProofErasureCompleteCells).size, 204);

export const directProofErasureCompleteReferencePaths = Object.freeze([
	".github/workflows/direct-proof-erasure-complete.yml"
	, `${directProofErasureHostedEvidenceDirectory}/index.json`
	, "scripts/archive-direct-proof-erasure-hosted.mjs"
	, "scripts/download-direct-proof-erasure-hosted-inputs.mjs"
	, "scripts/generate-reference-docs.mjs"
	, "scripts/generate-type-docs.mjs"
	, "scripts/promote-direct-proof-erasure-complete.mjs"
	, "tests/helpers/direct-proof-erasure-complete-ci-tests.mjs"
	, "tests/helpers/direct-proof-erasure-complete-documentation.mjs"
	, "tests/helpers/direct-proof-erasure-complete-documentation-tests.mjs"
	, "tests/helpers/direct-proof-erasure-complete-promotion.mjs"
	, "tests/helpers/direct-proof-erasure-complete-promotion-tests.mjs"
	, "tests/helpers/direct-proof-erasure-complete-promotion-transaction-tests.mjs"
	, "tests/helpers/direct-proof-erasure-hosted-archive.mjs"
	, "tests/helpers/direct-proof-erasure-hosted-evidence.mjs"
	, "tests/helpers/promotion-file-transaction.mjs"
	, "tests/helpers/type-surface-promotion-io.mjs"
]);

/** Authenticate the complete archive and describe its inventory evidence. */
export const directProofErasureCompleteReference = async () => {
	const checked = await checkDirectProofErasureHostedEvidence();
	assert.equal(checked.hostedAcceptance, true);
	assert.equal(checked.supportPromoted, false);
	assert.equal(checked.cells, 204);
	assert.equal(checked.lanes.length, 10);
	const files = await Promise.all(directProofErasureCompleteReferencePaths
		.map(async path => ({ path, sha256: sha256(await readFile(path)) })));
	const artifacts = checked.artifacts.map(artifact => ({
		path: `${artifact.name}.zip`, sha256: artifact.sha256
	}));
	return Object.freeze({
		id: directProofErasureCompleteEvidenceId
		, revision: checked.producerCommit
		, command: "node --test --test-concurrency=1 tests/direct-proof-erasure-complete-hosted-evidence.test.mjs"
		, scope: "Ten same-revision hosted artifacts, one fresh-Lean refusal and the independently retained field/callback ledger close all 204 proof-erasure cells across seventeen profiles and both author routes."
		, files, artifacts
		, limitations: checked.limitations
	});
};

const exactKeys = (value, keys, label) => assert.deepEqual(
	Object.keys(value).sort(), [...keys].sort(), label
);
const hostTypes = Object.freeze({
	parameter: "erased; no host argument"
	, result: "no runtime result; a proof-valued export is refused"
	, field: "erased; no host field"
	, "callback-parameter": "erased; no host callback argument"
	, "callback-result": "erased; no host callback result"
	, signature: "proof-free public signature"
});
const notes = Object.freeze({
	analysis: "Fresh Lean metadata identifies proof-only binders, fields, results and declarations from elaborated types while retaining theorem identity and assumptions."
	, generation: "Generated public APIs omit proof storage and proof arguments; they do not substitute null, Unit, a default value or fabricated evidence."
	, compilation: "Compiled packages retain every runtime payload and refinement check while proof-only values have no ABI slot or allocation."
	, packaging: "Both author routes produce receipt-closed prepared packages that install offline, relocate and replay after author and build removal."
	, installedExecution: "Installed consumers exercise direct proof parameters and proof-free signatures, retained field and callback positions, and the fail-closed refusal of proof-valued exports."
});

/**
 * Add one evidence entry and two observations covering exactly 204 cells.
 *
 * @param inventory - Current type-surface inventory.
 * @param contracts - Binding IR schema and consumer contract.
 * @param reference - Authenticated hosted evidence reference.
 */
export const promoteDirectProofErasureComplete = (
	inventory, contracts, reference
) => {
	exactKeys(reference, [
		"artifacts", "command", "files", "id", "limitations", "revision"
		, "scope"
	], "proof-erasure complete reference");
	assert.equal(reference.id, directProofErasureCompleteEvidenceId);
	assert.match(reference.revision, /^[a-f0-9]{40}$/u);
	assert.deepEqual(reference.files.map(file => file.path)
		, directProofErasureCompleteReferencePaths);
	assert.equal(new Set(reference.files.map(file => file.path)).size
		, reference.files.length);
	for(const file of reference.files)
	{
		exactKeys(file, ["path", "sha256"], "proof-erasure reference file");
		assert.match(file.sha256, /^[a-f0-9]{64}$/u);
	}
	assert.equal(reference.artifacts.length, 10);
	assert.equal(new Set(reference.artifacts.map(item => item.path)).size, 10);
	for(const artifact of reference.artifacts)
	{
		exactKeys(artifact, ["path", "sha256"], "proof-erasure artifact");
		assert.match(artifact.sha256, /^[a-f0-9]{64}$/u);
	}
	assert.deepEqual(reference.artifacts.map(item => item.path).sort()
		, directProofErasureHostedLanes.map(lane =>
			`${lane.artifactPrefix}-${reference.revision}.zip`).sort());
	assert.equal(reference.limitations.length, 4);
	assert.ok(reference.limitations.every(item => typeof item === "string"
		&& item.length > 0));
	assert.ok(!inventory.evidence.some(item => item.id === reference.id));
	const proposed = structuredClone(inventory);
	proposed.evidence.push({
		id: reference.id, kind: "installed", revision: reference.revision
		, command: reference.command, scope: reference.scope
		, files: reference.files
		, artifacts: reference.artifacts.map(artifact => ({
			...artifact, path: `${reference.id}/${artifact.path}`
		}))
	});
	const beforeCells = typeSurfaceCells(inventory, contracts);
	const before = new Map(beforeCells.map(cell => [cell.id, cell]));
	const target = new Set(directProofErasureCompleteCells);
	assert.equal(beforeCells.filter(cell => target.has(cell.id)).length, 204);
	for(const id of target)
		assert.equal(before.get(id).stages.installedExecution.state
			, "unreviewed", id);
	for(const path of directProofErasureCompletePaths)
		proposed.observations.push({
			id: `direct-proof-erasure-complete-${path}-hosted-installed`
			, profiles: directProofErasureCompleteProfiles, shapes: ["proof"]
			, positions: directProofErasureCompletePositions, path
			, scope: `${path === "ordinary-source" ? "Compiler-authenticated Lean source" : "Independently reviewed Binding IR"} packages erase every proof-only runtime position while retaining theorem provenance and runtime checks.`
			, hostTypes: { proof: hostTypes }
			, stages: Object.fromEntries(proposed.stages.map(stage => [stage, {
				state: "passed", evidence: [reference.id], note: notes[stage]
			}]))
			, limitations: reference.limitations
			, conversionNotes: {
				proof: "Proof-only parameters, fields and synchronous callback positions consume no host storage; public signatures omit them, and proof-valued exports are rejected rather than represented by null, Unit, defaults or fabricated proofs."
			}
		});
	const afterCells = typeSurfaceCells(proposed, contracts);
	const changed = afterCells.filter(cell => JSON.stringify(cell)
		!== JSON.stringify(before.get(cell.id)));
	assert.deepEqual(changed.map(cell => cell.id).sort(), [...target].sort());
	for(const cell of changed)
		for(const stage of Object.values(cell.stages))
		{
			assert.equal(stage.state, "passed", cell.id);
			assert.deepEqual(stage.evidence, [reference.id], cell.id);
		}
	return proposed;
};
