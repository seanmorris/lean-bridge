/**
 * Expand and close the exact type-surface scope owned by VO #1220.
 *
 * @file
 */
import assert from "node:assert/strict";
import { typeSurfaceCells } from "../../src/adoption/type-surface.mjs";

export const vo1220Owner = 1220;
export const vo1220Stages = Object.freeze([
	"analysis", "generation", "compilation", "packaging"
	, "installedExecution"
]);
export const vo1220ShapeCells = Object.freeze({
	"checked-record": 170
	, dependent: 34
	, fin: 170
	, generic: 34
	, "host-null": 170
	, implicit: 34
	, instance: 34
	, "optional-parameter": 34
	, proof: 204
	, subtype: 170
});
export const vo1220SourceOnlyShapes = Object.freeze([
	"checked-record", "dependent", "implicit", "instance"
	, "optional-parameter", "proof", "subtype"
]);
export const vo1220ClassifiedShapes = Object.freeze({
	fin: "primitive:nat"
	, generic: "typeReference:parameter"
	, "host-null": "constructor:host-null"
});
export const vo1220CellCount = Object.values(vo1220ShapeCells)
	.reduce((sum, count) => sum + count, 0);
export const vo1220StageEntryCount = vo1220CellCount * vo1220Stages.length;
assert.equal(vo1220CellCount, 1054);
assert.equal(vo1220StageEntryCount, 5270);

/**
 * Describe every current #1220-owned cell without treating a gap as success.
 *
 * @param document - Current type-surface inventory.
 * @param contracts - Current Binding IR schema and consumer contract.
 */
export const vo1220ZeroGapReport = (document, contracts) => {
	assert.deepEqual(document.stages, vo1220Stages);
	const familyIds = Object.entries(document.families)
		.filter(([, family]) => family.owner === vo1220Owner)
		.map(([id]) => id).sort();
	assert.deepEqual(familyIds, ["checked-value", "generic", "proof"]);
	const selectedShapes = document.shapes.filter(shape =>
		document.families[shape.family].owner === vo1220Owner);
	assert.deepEqual(selectedShapes.map(shape => shape.id).sort()
		, Object.keys(vo1220ShapeCells).sort());
	assert.deepEqual(selectedShapes.filter(shape => shape.ir === null)
		.map(shape => shape.id).sort(), [...vo1220SourceOnlyShapes].sort());
	assert.deepEqual(Object.fromEntries(selectedShapes
		.filter(shape => shape.ir !== null)
		.map(shape => [shape.id, shape.ir])), vo1220ClassifiedShapes);
	const shapeIds = new Set(selectedShapes.map(shape => shape.id));
	const cells = typeSurfaceCells(document, contracts, cell =>
		shapeIds.has(cell.shape));
	assert.equal(new Set(cells.map(cell => cell.id)).size, cells.length);
	const shapeCells = Object.fromEntries(Object.keys(vo1220ShapeCells)
		.map(shape => [shape, cells.filter(cell => cell.shape === shape).length]));
	const gaps = cells.flatMap(cell => vo1220Stages
		.filter(stage => cell.stages[stage].state !== "passed")
		.map(stage => ({
			cell: cell.id, stage, state: cell.stages[stage].state
		}))
	);
	const missingObservations = cells.filter(cell => cell.observation === null)
		.map(cell => cell.id);
	const missingHostTypes = cells.filter(cell => typeof cell.hostType !== "string"
		|| cell.hostType.length === 0).map(cell => cell.id);
	const reviewedExclusions = cells.filter(cell =>
		cell.requirement === "reviewed-exclusion").map(cell => cell.id);
	const evidence = new Map(document.evidence.map(item => [item.id, item]));
	const invalidEvidence = [];
	for(const cell of cells)
		for(const stage of vo1220Stages)
		{
			const record = cell.stages[stage];
			if(record.state !== "passed" || record.evidence.length === 0)
				continue;
			for(const id of record.evidence)
				if(!evidence.has(id)) invalidEvidence.push(`${cell.id}/${stage}/${id}`);
			if(stage === "installedExecution"
				&& !record.evidence.some(id => evidence.get(id)?.kind === "installed"))
				invalidEvidence.push(`${cell.id}/${stage}/missing-installed-evidence`);
		}
	return Object.freeze({
		schemaVersion: 1, owner: vo1220Owner
		, shapes: selectedShapes.length, shapeCells: Object.freeze(shapeCells)
		, cells: cells.length, stageEntries: cells.length * vo1220Stages.length
		, passedCells: cells.filter(cell => vo1220Stages.every(stage =>
			cell.stages[stage].state === "passed")).length
		, gaps: Object.freeze(gaps)
		, missingObservations: Object.freeze(missingObservations)
		, missingHostTypes: Object.freeze(missingHostTypes)
		, reviewedExclusions: Object.freeze(reviewedExclusions)
		, invalidEvidence: Object.freeze(invalidEvidence)
		, evidence: Object.freeze([...new Set(cells.flatMap(cell =>
			vo1220Stages.flatMap(stage => cell.stages[stage].evidence)))].sort())
	});
};

/**
 * Require the complete original #1220 inventory at the current contracts.
 *
 * @param document - Current type-surface inventory.
 * @param contracts - Current Binding IR schema and consumer contract.
 */
export const assertVo1220ZeroGap = (document, contracts) => {
	const report = vo1220ZeroGapReport(document, contracts);
	assert.deepEqual(report.shapeCells, vo1220ShapeCells);
	assert.equal(report.shapes, Object.keys(vo1220ShapeCells).length);
	assert.equal(report.cells, vo1220CellCount);
	assert.equal(report.stageEntries, vo1220StageEntryCount);
	assert.equal(report.passedCells, vo1220CellCount);
	for(const key of [
		"gaps", "missingObservations", "missingHostTypes"
		, "reviewedExclusions", "invalidEvidence"
	]) assert.deepEqual(report[key], [], key);
	assert.ok(report.evidence.length > 0);
	return report;
};
