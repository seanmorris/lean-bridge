/**
 * Compare historical inventories using today's strict shape classifier, without adding old evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	bindingIrTypeFacets, typeSurfaceCells
} from "../../src/adoption/type-surface.mjs";

const checkedRecordShape = Object.freeze({
	id: "checked-record"
	, lean: "Checked records and closed Nat indices"
	, family: "checked-value"
	, ir: null
	, meaning: "A structure with zero or more runtime payload fields and erased proofs, optionally specialized at closed Nat literal indices. A proof-only record crosses as an empty carrier and a Unit-bearing record keeps its unit field; neither is an absent, null or default value."
	, bounds: "Construct inputs only through the selected safe Lean constructor over the exact payload fields. Preserve closed indices and per-site choices; project proof-backed results without fabricating proofs."
});
const hostNullShape = Object.freeze({
	id: "host-null"
	, lean: "Explicit nullable host value"
	, family: "checked-value"
	, ir: "constructor:host-null"
	, meaning: "Null from a declared host API."
	, bounds: "Select an explicit host projection; null does not stand for every missing, erased or unsupported value."
});
const laterShapes = Object.freeze([checkedRecordShape, hostNullShape]);
const laterConstructors = Object.freeze(["host-null"]);

/**
 * Classify a newly named shape as unobserved while expanding a pre-classification snapshot.
 * Return only that snapshot's original shapes so historical positional comparisons remain exact.
 *
 * @param document - Authenticated historical inventory.
 * @param contracts - Current independent IR and consumer contracts.
 */
export const historicalTypeSurfaceCells = (document, contracts) => {
	const currentConstructors = bindingIrTypeFacets(
		contracts.irSchema).constructor;
	const applicableShapes = currentConstructors.includes(hostNullShape.id)
		? laterShapes : [checkedRecordShape];
	const applicableConstructors = currentConstructors.includes(hostNullShape.id)
		? laterConstructors : [];
	const known = new Set(document.shapes.map(shape => shape.id));
	const missing = applicableShapes.filter(shape => !known.has(shape.id));
	const knownConstructors = new Set(document.irFacets.constructor);
	const missingConstructors = applicableConstructors.filter(
		constructor => !knownConstructors.has(constructor));
	if(missing.length === 0 && missingConstructors.length === 0)
		return typeSurfaceCells(document, contracts);
	for(const shape of missing)
		assert.ok(!document.observations.some(item => item.shapes.includes(shape.id)));
	const shapes = document.shapes.map(shape => {
		if(shape.id !== hostNullShape.id
			|| !missingConstructors.includes(hostNullShape.id)) return shape;
		assert.deepEqual(shape, { ...hostNullShape, ir: null });
		return hostNullShape;
	});
	const classified = typeSurfaceCells({
		...document
		, irFacets: {
			...document.irFacets
			, constructor: [
				...document.irFacets.constructor, ...missingConstructors
			]
		}
		, shapes: [...shapes, ...missing]
	}, contracts);
	const added = new Set(missing.map(shape => shape.id));
	for(const cell of classified.filter(item => added.has(item.shape)))
		for(const stage of Object.values(cell.stages)) assert.equal(stage.state, "unreviewed");
	return classified.filter(cell => known.has(cell.shape));
};
