/**
 * Compare historical inventories using today's strict shape classifier, without adding old evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { typeSurfaceCells } from "../../src/adoption/type-surface.mjs";

const checkedRecordShape = Object.freeze({
	id: "checked-record"
	, lean: "Checked records and closed Nat indices"
	, family: "checked-value"
	, ir: null
	, meaning: "A structure with zero or more runtime payload fields and erased proofs, optionally specialized at closed Nat literal indices. A proof-only record crosses as an empty carrier and a Unit-bearing record keeps its unit field; neither is an absent, null or default value."
	, bounds: "Construct inputs only through the selected safe Lean constructor over the exact payload fields. Preserve closed indices and per-site choices; project proof-backed results without fabricating proofs."
});

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
	assert.ok(!document.observations.some(item => item.shapes.includes(checkedRecordShape.id)));
	const classified = typeSurfaceCells({
		...document, shapes: [...document.shapes, checkedRecordShape]
	}, contracts);
	for(const cell of classified.filter(
		item => item.shape === checkedRecordShape.id))
		for(const stage of Object.values(cell.stages)) assert.equal(stage.state, "unreviewed");
	return classified.filter(cell => known.has(cell.shape));
};
