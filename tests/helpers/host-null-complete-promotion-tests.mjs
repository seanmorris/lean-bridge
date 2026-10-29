/**
 * Admit only the exact complete hosted HostNull matrix.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	typeSurfaceCells, validateTypeSurface
} from "../../src/adoption/type-surface.mjs";
import {
	hostNullCompletePromotionCells, hostNullCompletePromotionEvidenceId
	, hostNullCompletePromotionGroups, hostNullCompletePromotionPaths
	, hostNullCompletePromotionPositions, hostNullCompletePromotionProfiles
	, promoteHostNullComplete
} from "./host-null-complete-promotion.mjs";
import {
	hostNullCompleteHostedEvidence
} from "./host-null-complete-hosted-evidence.mjs";
import {
	hostNullCompleteHostedLanes
} from "./host-null-complete-hosted-archive.mjs";

const load = async () => {
	const [document, irSchema, consumers] = await Promise.all([
		"docs/type-surface.v1.json", "schema/binding-ir.schema.json"
		, "docs/consumer-support.v1.json"
	].map(async path => JSON.parse(await readFile(path, "utf8"))));
	return { document, contracts: { irSchema, consumers } };
};
const revision = "1".repeat(40);
const referencePaths = [
	`${hostNullCompleteHostedEvidence}/index.json`
	, "scripts/archive-host-null-complete-evidence.mjs"
	, "scripts/download-host-null-complete-inputs.mjs"
	, "scripts/generate-type-docs.mjs"
	, "scripts/promote-host-null-complete.mjs"
	, "tests/helpers/host-null-complete-hosted-archive.mjs"
	, "tests/helpers/host-null-complete-hosted-evidence.mjs"
	, "tests/helpers/host-null-complete-promotion.mjs"
	, "tests/helpers/host-null-complete-promotion-tests.mjs"
];
const artifacts = hostNullCompleteHostedLanes.map((selectedLane, index) => ({
	path: `${selectedLane.artifactPrefix}-${revision}.zip`
	, sha256: "abcdef0"[index].repeat(64)
}));
const reference = Object.freeze({
	id: hostNullCompletePromotionEvidenceId, revision
	, command: "hosted complete HostNull command"
	, scope: "hosted complete HostNull scope"
	, files: Object.freeze(referencePaths.map((path, index) => ({
		path, sha256: `${index + 1}`.repeat(64)
	})))
	, artifacts: Object.freeze(artifacts)
	, limitations: Object.freeze(Array.from({ length: 6 }, (_, index) =>
		`complete hosted limitation ${index + 1}`))
});

test("complete HostNull promotion owns exactly 170 closed cells", () => {
	assert.equal(hostNullCompletePromotionCells.length, 170);
	assert.equal(new Set(hostNullCompletePromotionCells).size, 170);
	assert.equal(hostNullCompletePromotionProfiles.length, 17);
	assert.deepEqual(hostNullCompletePromotionPaths
		, ["ordinary-source", "reviewed-ir"]);
	assert.deepEqual(hostNullCompletePromotionPositions, [
		"parameter", "result", "field", "callback-parameter"
		, "callback-result"
	]);
	assert.deepEqual(hostNullCompletePromotionGroups.flatMap(item => item.profiles)
		, hostNullCompletePromotionProfiles);
});

test("complete HostNull promotion changes only its exact 170 cells", async () => {
	const { document, contracts } = await load();
	const frozen = structuredClone(document);
	const beforeCells = typeSurfaceCells(document, contracts);
	const before = new Map(beforeCells.map(cell => [cell.id, cell]));
	const proposed = promoteHostNullComplete(document, contracts, reference);
	assert.deepEqual(document, frozen);
	assert.equal(validateTypeSurface(proposed, contracts), true);
	assert.equal(proposed.evidence.length, document.evidence.length + 1);
	assert.equal(proposed.observations.length, document.observations.length
		+ hostNullCompletePromotionGroups.length * 2);
	const afterCells = typeSurfaceCells(proposed, contracts);
	const changed = afterCells.filter(cell => JSON.stringify(cell)
		!== JSON.stringify(before.get(cell.id)));
	assert.deepEqual(changed.map(cell => cell.id).sort()
		, [...hostNullCompletePromotionCells].sort());
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
			, /Option, Unit, erased proofs and omitted\/default arguments/u);
	}
	assert.deepEqual(proposed.evidence.at(-1).artifacts
		, reference.artifacts.map(artifact => ({
			...artifact, path: `${reference.id}/${artifact.path}`
		}))
	);
});

test("complete HostNull promotion refuses partial, forged and overlapping evidence", async () => {
	const { document, contracts } = await load();
	assert.throws(() => promoteHostNullComplete(document, contracts, {
		...reference, artifacts: reference.artifacts.slice(1)
	}));
	assert.throws(() => promoteHostNullComplete(document, contracts, {
		...reference, id: "forged"
	}));
	assert.throws(() => promoteHostNullComplete(document, contracts, {
		...reference, artifacts: reference.artifacts.map((artifact, index) =>
			index === 0 ? { ...artifact, sha256: "forged" } : artifact)
	}));
	const proposed = promoteHostNullComplete(document, contracts, reference);
	assert.throws(() => promoteHostNullComplete(
		proposed, contracts, reference));
});
