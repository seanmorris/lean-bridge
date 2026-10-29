/**
 * Promote exactly the complete 34-cell direct dependent-signature matrix.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import {
	dependentSignatureHostedEvidenceDirectory
	, dependentSignatureHostedLanes
} from "./dependent-signature-hosted-archive.mjs";
import {
	checkDependentSignatureHostedEvidence
} from "./dependent-signature-hosted-evidence.mjs";

export const dependentSignatureCompleteEvidenceId
	= "hosted-dependent-signature-complete";
export const dependentSignatureCompletePaths = Object.freeze([
	"ordinary-source", "reviewed-ir"
]);
export const dependentSignatureCompletePositions = Object.freeze([
	"signature"
]);
export const dependentSignatureCompleteProfiles = Object.freeze([
	...new Set(dependentSignatureHostedLanes.flatMap(lane => lane.profiles))
]);
export const dependentSignatureCompleteCells = Object.freeze(
	dependentSignatureCompleteProfiles.flatMap(profile =>
		dependentSignatureCompletePaths.map(path =>
			`${profile}/dependent/${path}/signature`))
);
assert.equal(dependentSignatureCompleteProfiles.length, 17);
assert.equal(new Set(dependentSignatureCompleteProfiles).size, 17);
assert.equal(dependentSignatureCompleteCells.length, 34);
assert.equal(new Set(dependentSignatureCompleteCells).size, 34);

export const dependentSignatureCompleteReferencePaths = Object.freeze([
	".github/workflows/dependent-signature-complete.yml"
	, `${dependentSignatureHostedEvidenceDirectory}/index.json`
	, "scripts/archive-dependent-signature-hosted.mjs"
	, "scripts/download-dependent-signature-hosted-inputs.mjs"
	, "scripts/generate-reference-docs.mjs"
	, "scripts/generate-type-docs.mjs"
	, "scripts/promote-dependent-signature-complete.mjs"
	, "tests/helpers/dependent-signature-complete-ci-tests.mjs"
	, "tests/helpers/dependent-signature-complete-documentation.mjs"
	, "tests/helpers/dependent-signature-complete-documentation-tests.mjs"
	, "tests/helpers/dependent-signature-complete-promotion.mjs"
	, "tests/helpers/dependent-signature-complete-promotion-tests.mjs"
	, "tests/helpers/dependent-signature-complete-promotion-transaction-tests.mjs"
	, "tests/helpers/dependent-signature-hosted-archive.mjs"
	, "tests/helpers/dependent-signature-hosted-evidence.mjs"
	, "tests/helpers/promotion-file-transaction.mjs"
	, "tests/helpers/type-surface-promotion-io.mjs"
]);

/** Authenticate the complete archive and describe its inventory evidence. */
export const dependentSignatureCompleteReference = async () => {
	const checked = await checkDependentSignatureHostedEvidence();
	assert.equal(checked.kind, "dependent-signatures-hosted-installed-v1");
	assert.equal(checked.lanes.length, 14);
	assert.deepEqual(checked.lanes.map(lane => lane.id)
		, dependentSignatureHostedLanes.map(lane => lane.id));
	return Object.freeze({
		id: dependentSignatureCompleteEvidenceId
		, revision: checked.producerCommit
		, command: "node --test --test-concurrency=1 tests/dependent-signature-complete-hosted-evidence.test.mjs"
		, scope: "Fourteen same-revision hosted artifacts close the exact direct `(bound : Nat) (value : Fin bound)` dependency across seventeen profiles, ordinary Lean source and independently reviewed Binding IR."
		, files: await Promise.all(dependentSignatureCompleteReferencePaths
			.map(async path => ({ path, sha256: sha256(await readFile(path)) })))
		, artifacts: Object.freeze(checked.lanes.map(lane => ({
			path: `${lane.hostedRun.artifact.name}.zip`
			, sha256: lane.hostedRun.artifact.sha256
		})))
		, limitations: checked.limitations
	});
};

const exactKeys = (value, keys, label) => assert.deepEqual(
	Object.keys(value).sort(), [...keys].sort(), label
);
const hostType
	= "the profile's ordinary Nat values for the bound and Fin payload; payload < the live earlier bound";
const notes = Object.freeze({
	analysis: "Fresh Lean metadata authenticates Fin over an exact earlier explicit Nat parameter; independently reviewed Binding IR must reproduce the same parameter dependency."
	, generation: "Generated public APIs expose the bound and payload through the profile's ordinary Nat representation and retain the live earlier-parameter relation."
	, compilation: "The copied adapter compares the decoded payload with the decoded earlier bound before constructing Fin or entering the exported Lean declaration."
	, packaging: "Both author routes produce reproducible source-free packages that install offline, relocate, and preserve the exact dependency metadata."
	, installedExecution: "Installed consumers exercise zero, exact endpoints, changing and huge bounds, rejection without caller mutation, and recovery through public host APIs."
});

/**
 * Add one evidence entry and two observations covering exactly 34 cells.
 *
 * @param inventory - Current type-surface inventory.
 * @param contracts - Binding IR schema and consumer contract.
 * @param reference - Authenticated hosted evidence reference.
 */
export const promoteDependentSignatureComplete = (
	inventory, contracts, reference
) => {
	exactKeys(reference, [
		"artifacts", "command", "files", "id", "limitations", "revision"
		, "scope"
	], "dependent-signature complete reference");
	assert.equal(reference.id, dependentSignatureCompleteEvidenceId);
	assert.match(reference.revision, /^[a-f0-9]{40}$/u);
	assert.deepEqual(reference.files.map(file => file.path)
		, dependentSignatureCompleteReferencePaths);
	assert.equal(new Set(reference.files.map(file => file.path)).size
		, reference.files.length);
	for(const file of reference.files)
	{
		exactKeys(file, ["path", "sha256"], "dependent-signature reference file");
		assert.match(file.sha256, /^[a-f0-9]{64}$/u);
	}
	assert.equal(reference.artifacts.length, 14);
	assert.equal(new Set(reference.artifacts.map(item => item.path)).size, 14);
	for(const artifact of reference.artifacts)
	{
		exactKeys(artifact, ["path", "sha256"], "dependent-signature artifact");
		assert.match(artifact.sha256, /^[a-f0-9]{64}$/u);
	}
	assert.deepEqual(reference.artifacts.map(item => item.path).sort()
		, dependentSignatureHostedLanes.map(lane =>
			`${lane.artifactPrefix}-${reference.revision}.zip`).sort());
	assert.equal(reference.limitations.length, 5);
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
	const target = new Set(dependentSignatureCompleteCells);
	assert.equal(beforeCells.filter(cell => target.has(cell.id)).length, 34);
	for(const id of target)
		assert.equal(before.get(id).stages.installedExecution.state
			, "unreviewed", id);
	for(const path of dependentSignatureCompletePaths)
		proposed.observations.push({
			id: `dependent-signature-complete-${path}-hosted-installed`
			, profiles: dependentSignatureCompleteProfiles
			, shapes: ["dependent"], positions: ["signature"], path
			, scope: `${path === "ordinary-source" ? "Compiler-authenticated Lean source" : "Independently reviewed Binding IR"} packages preserve an explicit Fin payload's dependency on an earlier explicit Nat parameter.`
			, hostTypes: { dependent: { signature: hostType } }
			, stages: Object.fromEntries(proposed.stages.map(stage => [stage, {
				state: "passed", evidence: [reference.id], note: notes[stage]
			}]))
			, limitations: [
				...reference.limitations
				, "Promotion is limited to a direct copied Fin parameter whose index is an exact earlier explicit Nat parameter. Dependent results, fields, callbacks, owned values, arbitrary index expressions, later parameters and non-Nat bounds remain outside this evidence."
			]
			, conversionNotes: {
				dependent: "Pass the bound and Fin payload through the profile's ordinary Nat representation. The adapter enforces payload < the live earlier bound before Lean entry; no proof value crosses the host boundary."
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
