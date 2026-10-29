/**
 * Admit only the exact complete hosted proof-erasure matrix.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	renderTypeTable, typeGuideProfiles
} from "../../scripts/generate-type-docs.mjs";
import {
	typeSurfaceCells, validateTypeSurface
} from "../../src/adoption/type-surface.mjs";
import {
	directProofErasureCompleteCells, directProofErasureCompleteEvidenceId
	, directProofErasureCompletePaths, directProofErasureCompletePositions
	, directProofErasureCompleteProfiles
	, directProofErasureCompleteReferencePaths
	, promoteDirectProofErasureComplete
} from "./direct-proof-erasure-complete-promotion.mjs";
import {
	directProofErasureHostedLanes
} from "./direct-proof-erasure-hosted-archive.mjs";

const load = async () => {
	const [document, irSchema, consumers] = await Promise.all([
		"docs/type-surface.v1.json", "schema/binding-ir.schema.json"
		, "docs/consumer-support.v1.json"
	].map(async path => JSON.parse(await readFile(path, "utf8"))));
	return { document, contracts: { irSchema, consumers } };
};
const revision = "2".repeat(40);
const referenceFiles = directProofErasureCompleteReferencePaths.map(
	(path, index) => ({
		path, sha256: ((index + 1) % 16).toString(16).repeat(64)
	})
);
const referenceArtifacts = directProofErasureHostedLanes.map(
	(lane, index) => ({
		path: `${lane.artifactPrefix}-${revision}.zip`
		, sha256: ((index + 5) % 16).toString(16).repeat(64)
	})
);
const reference = Object.freeze({
	id: directProofErasureCompleteEvidenceId, revision
	, command: "hosted complete proof-erasure command"
	, scope: "hosted complete proof-erasure scope"
	, files: Object.freeze(referenceFiles)
	, artifacts: Object.freeze(referenceArtifacts)
	, limitations: Object.freeze(Array.from({ length: 4 }, (_, index) =>
		`complete proof-erasure limitation ${index + 1}`))
});
const generatedRow = (source, lean) => source.split("\n").find(line =>
	line.startsWith(`| \`${lean}\` |`));

test("complete proof-erasure promotion owns exactly 204 cells", () => {
	assert.equal(directProofErasureCompleteCells.length, 204);
	assert.equal(new Set(directProofErasureCompleteCells).size, 204);
	assert.equal(directProofErasureCompleteProfiles.length, 17);
	assert.equal(new Set(directProofErasureCompleteProfiles).size, 17);
	assert.deepEqual(directProofErasureCompletePaths
		, ["ordinary-source", "reviewed-ir"]);
	assert.deepEqual(directProofErasureCompletePositions, [
		"parameter", "result", "field", "callback-parameter"
		, "callback-result", "signature"
	]);
});

test("complete proof-erasure promotion changes only its exact cells", async () => {
	const { document, contracts } = await load();
	const frozen = structuredClone(document);
	const beforeCells = typeSurfaceCells(document, contracts);
	const before = new Map(beforeCells.map(cell => [cell.id, cell]));
	const proposed = promoteDirectProofErasureComplete(
		document, contracts, reference);
	assert.deepEqual(document, frozen);
	assert.equal(validateTypeSurface(proposed, contracts), true);
	assert.equal(proposed.evidence.length, document.evidence.length + 1);
	assert.equal(proposed.observations.length, document.observations.length + 2);
	const changed = typeSurfaceCells(proposed, contracts).filter(cell =>
		JSON.stringify(cell) !== JSON.stringify(before.get(cell.id)));
	assert.deepEqual(changed.map(cell => cell.id).sort()
		, [...directProofErasureCompleteCells].sort());
	for(const cell of changed)
	{
		assert.equal(before.get(cell.id).stages.installedExecution.state
			, "unreviewed", cell.id);
		for(const stage of Object.values(cell.stages))
		{
			assert.equal(stage.state, "passed", cell.id);
			assert.deepEqual(stage.evidence, [reference.id], cell.id);
		}
		assert.match(cell.conversionNote
			, /null, Unit, defaults or fabricated proofs/u);
	}
	const expectedArtifacts = reference.artifacts.map(artifact => ({
		...artifact, path: `${reference.id}/${artifact.path}`
	}));
	assert.deepEqual(proposed.evidence.at(-1).artifacts, expectedArtifacts);
});

test("complete proof-erasure promotion refuses partial and overlapping evidence", async () => {
	const { document, contracts } = await load();
	const partial = {
		...reference, artifacts: reference.artifacts.slice(1)
	};
	assert.throws(() => promoteDirectProofErasureComplete(
		document, contracts, partial));
	assert.throws(() => promoteDirectProofErasureComplete(
		document, contracts, { ...reference, id: "forged" }));
	const forgedFiles = reference.files.map((file, index) =>
		index === 0 ? { ...file, sha256: "forged" } : file);
	assert.throws(() => promoteDirectProofErasureComplete(document, contracts, {
		...reference, files: forgedFiles
	}));
	const proposed = promoteDirectProofErasureComplete(
		document, contracts, reference);
	assert.throws(() => promoteDirectProofErasureComplete(
		proposed, contracts, reference));
});

test("complete proof-erasure promotion renders every consumer guide", async () => {
	const { document, contracts } = await load();
	const proposed = promoteDirectProofErasureComplete(
		document, contracts, reference);
	const seenProfiles = new Set();
	for(const [guide, profiles] of Object.entries(typeGuideProfiles))
	{
		profiles.forEach(profile => seenProfiles.add(profile));
		const row = generatedRow(renderTypeTable({
			document: proposed, ...contracts
		}, profiles, "reference/types.md"), "Prop / theorem / proof arguments");
		assert.ok(row, guide);
		assert.match(row
			, /Ordinary source: Installed checks passed\. Reviewed IR: Installed checks passed/u
			, guide);
		assert.match(row, /Proof-only parameters, fields and synchronous callback positions consume no host storage/u
			, guide);
		for(const value of [
			"erased; no host argument"
			, "no runtime result; a proof-valued export is refused"
			, "erased; no host field"
			, "erased; no host callback argument"
			, "erased; no host callback result"
			, "proof-free public signature"
		]) assert.ok(row.includes(`\`${value}\``), `${guide}: ${value}`);
	}
	assert.deepEqual([...seenProfiles].sort()
		, [...directProofErasureCompleteProfiles].sort());
});
