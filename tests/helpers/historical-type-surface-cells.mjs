/**
 * Compare historical inventories using today's strict shape classifier, without adding old evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { typeSurfaceCells } from "../../src/adoption/type-surface.mjs";

/**
 * Classify a newly named shape as unobserved while expanding a pre-classification snapshot.
 * Return only that snapshot's original shapes so historical positional comparisons remain exact.
 *
 * @param document - Authenticated historical inventory.
 * @param contracts - Current independent IR and consumer contracts.
 */
export const historicalTypeSurfaceCells = (document, contracts) => {
	const known = new Set(document.shapes.map(shape => shape.id));
	if(known.has("checked-record")) return typeSurfaceCells(document, contracts);
	const shape = JSON.parse(readFileSync("docs/type-surface.v1.json", "utf8")).shapes.find(item => item.id === "checked-record");
	assert.ok(shape); assert.equal(shape.family, "checked-value");
	assert.ok(!document.observations.some(item => item.shapes.includes(shape.id)));
	const classified = typeSurfaceCells({ ...document, shapes: [...document.shapes, shape] }, contracts);
	for(const cell of classified.filter(item => item.shape === shape.id))
		for(const stage of Object.values(cell.stages)) assert.equal(stage.state, "unreviewed");
	return classified.filter(cell => known.has(cell.shape));
};
