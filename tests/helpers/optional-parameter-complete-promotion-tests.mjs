/**
 * Prove exact optional-parameter type-surface promotion behavior.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	optionalParameterCompleteCells, optionalParameterCompleteEvidenceId
	, optionalParameterCompleteGroups, optionalParameterCompletePaths
	, optionalParameterCompleteProfiles, optionalParameterCompleteReferencePaths
	, promoteOptionalParameterComplete
} from "./optional-parameter-complete-promotion.mjs";
import { optionalParameterMatrixLanes }
	from "./optional-parameter-matrix.mjs";
import {
	typeSurfaceCells, validateTypeSurface
} from "../../src/adoption/type-surface.mjs";

const load = async () => {
	const [document, irSchema, consumers] = await Promise.all([
		"docs/type-surface.v1.json", "schema/binding-ir.schema.json"
		, "docs/consumer-support.v1.json"
	].map(async path => JSON.parse(await readFile(path, "utf8"))));
	return { document, contracts: { irSchema, consumers } };
};
const revision = "3".repeat(40);
const reference = Object.freeze({
	id: optionalParameterCompleteEvidenceId, revision
	, command: "hosted complete optional-parameter command"
	, scope: "hosted complete optional-parameter scope"
	, files: Object.freeze(optionalParameterCompleteReferencePaths.map(
		(path, index) => ({
			path, sha256: ((index + 1) % 16).toString(16).repeat(64)
		})
	))
	, artifacts: Object.freeze([
		...optionalParameterMatrixLanes.map((lane, index) => ({
			path: `${lane.artifactPrefix}-${revision}.zip`
			, sha256: ((index + 5) % 16).toString(16).repeat(64)
		}))
		, { path: `optional-parameter-matrix-${revision}.zip`
			, sha256: "f".repeat(64) }
	])
	, limitations: Object.freeze(Array.from({ length: 4 }, (_, index) =>
		`optional-parameter limitation ${index + 1}`))
});

test("complete optional-parameter promotion owns exactly 34 cells", () => {
	assert.equal(optionalParameterCompleteProfiles.length, 17);
	assert.equal(optionalParameterCompletePaths.length, 2);
	assert.equal(optionalParameterCompleteCells.length, 34);
	assert.equal(new Set(optionalParameterCompleteCells).size, 34);
	assert.equal(optionalParameterCompleteGroups.flatMap(item => item.profiles)
		.length, 17);
});

test("complete optional-parameter promotion changes only exact cells"
	, async () => {
		const { document, contracts } = await load();
		const frozen = structuredClone(document);
		const beforeCells = typeSurfaceCells(document, contracts);
		const before = new Map(beforeCells.map(cell => [cell.id, cell]));
		const proposed = promoteOptionalParameterComplete(
			document, contracts, reference);
		assert.deepEqual(document, frozen);
		assert.equal(validateTypeSurface(proposed, contracts), true);
		assert.equal(proposed.evidence.length, document.evidence.length + 1);
		assert.equal(proposed.observations.length
			, document.observations.length + 23);
		const changed = typeSurfaceCells(proposed, contracts).filter(cell =>
			JSON.stringify(cell) !== JSON.stringify(before.get(cell.id)));
		assert.deepEqual(changed.map(cell => cell.id).sort()
			, [...optionalParameterCompleteCells].sort());
		for(const cell of changed)
		{
			for(const stage of Object.values(cell.stages))
			{
				assert.equal(stage.state, "passed", cell.id);
				assert.deepEqual(stage.evidence, [reference.id], cell.id);
			}
			assert.match(cell.conversionNote
				, /Option\.none, Unit and explicit host null/u);
		}
		for(const id of [
			"javascript-delivery", "php-delivery", "rust-delivery-rejection"
			, "c-delivery-rejection"
		]) {
			const owner = proposed.observations.find(item => item.id === id);
			assert.ok(owner, id);
			assert.ok(!owner.shapes.includes("optional-parameter"), id);
		}
		assert.ok(!proposed.observations.some(item =>
			item.id === "python-optional-rejection"));
	}
);

test("complete optional-parameter promotion refuses partial and overlap"
	, async () => {
		const { document, contracts } = await load();
		assert.throws(() => promoteOptionalParameterComplete(
			document, contracts, { ...reference
				, artifacts: reference.artifacts.slice(1) }));
		assert.throws(() => promoteOptionalParameterComplete(
			document, contracts, { ...reference, id: "forged" }));
		const files = reference.files.map((file, index) => index === 0
			? { ...file, sha256: "forged" } : file);
		assert.throws(() => promoteOptionalParameterComplete(
			document, contracts, { ...reference, files }));
		const promoted = promoteOptionalParameterComplete(
			document, contracts, reference);
		assert.throws(() => promoteOptionalParameterComplete(
			promoted, contracts, reference));
	}
);
