/**
 * Bind WIT/WASI value-index support to the immutable hosted archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { typeSurfaceCells, validateTypeSurface } from "../../src/adoption/type-surface.mjs";
import {
	checkedRecordValueIndexWitPromotionBaseline
	, checkedRecordValueIndexWitPromotionConversion
	, checkedRecordValueIndexWitPromotionLimit
	, checkedRecordValueIndexWitPromotionReferences
	, promoteCheckedRecordValueIndexWit
} from "./checked-record-value-index-wit-promotion.mjs";

const contracts = async () => ({
	irSchema: JSON.parse(await readFile("schema/binding-ir.schema.json"))
	, consumers: JSON.parse(await readFile("docs/consumer-support.v1.json"))
});
const target = cell => cell.profile === "wit-wasi"
	&& cell.shape === "checked-record"
	&& ["ordinary-source", "reviewed-ir"].includes(cell.path)
	&& ["parameter", "result"].includes(cell.position);

test("hosted WIT/WASI value-index promotion authenticates four routes", {
	timeout: 180_000
}, async () => {
	const references = await checkedRecordValueIndexWitPromotionReferences();
	assert.deepEqual(references.map(item => [item.route, item.positions]), [
		["ordinary-source", ["parameter", "result"]]
		, ["reviewed-ir", ["parameter", "result"]]
		, ["result-only-ordinary-source", ["result"]]
		, ["result-only-reviewed-ir", ["result"]]
	]);
	for(const reference of references)
	{
		assert.deepEqual(reference.profiles, ["wit-wasi"]);
		assert.equal(reference.hostedRun, 39373895062);
		assert.equal(reference.artifact, 12243086792);
		assert.equal(reference.counts.executions, 2);
		assert.equal(reference.artifacts.length, 1);
		assert.ok(reference.files.some(file => file.path.endsWith("index.json")));
		assert.ok(reference.files.some(file => file.path.endsWith("report.json")));
	}
});

test("WIT/WASI promotion changes only four exact cells", {
	timeout: 180_000
}, async () => {
	const original = checkedRecordValueIndexWitPromotionBaseline();
	const frozen = structuredClone(original);
	const references = await checkedRecordValueIndexWitPromotionReferences();
	const proposed = await promoteCheckedRecordValueIndexWit(original, references);
	validateTypeSurface(proposed, await contracts());
	assert.deepEqual(original, frozen);
	const before = new Map(typeSurfaceCells(original, await contracts())
		.map(cell => [cell.id, cell]));
	const difference = typeSurfaceCells(proposed, await contracts()).filter(cell =>
		JSON.stringify(cell) !== JSON.stringify(before.get(cell.id)));
	assert.equal(difference.length, 4);
	for(const cell of difference)
	{
		assert.ok(target(cell), cell.id);
		assert.ok(cell.conversionNote.includes(
			checkedRecordValueIndexWitPromotionConversion));
		assert.ok(cell.limitations.includes(checkedRecordValueIndexWitPromotionLimit));
		for(const stage of Object.values(cell.stages))
			assert.ok(stage.evidence.some(id =>
				id.startsWith("checked-record-value-index-wit-")));
	}
	await assert.rejects(promoteCheckedRecordValueIndexWit(
		proposed, references), /Already promoted/u);
	await assert.rejects(promoteCheckedRecordValueIndexWit(
		original, references.slice(1)));
});

test("checked-record value-index WIT/WASI inventory equals the exact promotion", {
	timeout: 180_000
}, async () => {
	const proposed = await promoteCheckedRecordValueIndexWit(
		checkedRecordValueIndexWitPromotionBaseline()
		, await checkedRecordValueIndexWitPromotionReferences()
	);
	assert.deepEqual(JSON.parse(await readFile("docs/type-surface.v1.json"))
		, proposed);
});
