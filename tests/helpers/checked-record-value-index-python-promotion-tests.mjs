/**
 * Bind Python value-index support to the immutable hosted archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { typeSurfaceCells, validateTypeSurface } from "../../src/adoption/type-surface.mjs";
import {
	checkedRecordValueIndexPythonPromotionBaseline
	, checkedRecordValueIndexPythonPromotionConversion
	, checkedRecordValueIndexPythonPromotionLimit
	, checkedRecordValueIndexPythonPromotionReferences
	, promoteCheckedRecordValueIndexPython
} from "./checked-record-value-index-python-promotion.mjs";

const contracts = async () => ({
	irSchema: JSON.parse(await readFile("schema/binding-ir.schema.json"))
	, consumers: JSON.parse(await readFile("docs/consumer-support.v1.json"))
});
const target = cell => cell.profile === "python"
	&& cell.shape === "checked-record" && ["ordinary-source", "reviewed-ir"].includes(cell.path)
	&& ["parameter", "result"].includes(cell.position);

test("hosted Python value-index promotion authenticates four routes", {
	timeout: 120_000
}, async () => {
	const references = await checkedRecordValueIndexPythonPromotionReferences();
	assert.deepEqual(references.map(item => [item.route, item.positions]), [
		["ordinary-source", ["parameter", "result"]]
		, ["reviewed-ir", ["parameter", "result"]]
		, ["result-only-ordinary-source", ["result"]]
		, ["result-only-reviewed-ir", ["result"]]
	]);
	for(const reference of references)
	{
		assert.deepEqual(reference.profiles, ["python"]);
		assert.equal(reference.hostedRun, 39318504598);
		assert.equal(reference.artifact, 12220917624);
		assert.equal(reference.counts.executions, 4);
		assert.equal(reference.artifacts.length, 1);
		assert.ok(reference.files.some(file => file.path.endsWith("index.json")));
		assert.ok(reference.files.some(file => file.path.endsWith("report.json")));
	}
});

test("Python promotion changes only four exact cells and refreshes stale pins", {
	timeout: 120_000
}, async () => {
	const original = checkedRecordValueIndexPythonPromotionBaseline();
	const frozen = structuredClone(original);
	const references = await checkedRecordValueIndexPythonPromotionReferences();
	const proposed = await promoteCheckedRecordValueIndexPython(original, references);
	validateTypeSurface(proposed, await contracts());
	assert.deepEqual(original, frozen);
	const before = new Map(typeSurfaceCells(original, await contracts()).map(cell => [cell.id, cell]));
	const difference = typeSurfaceCells(proposed, await contracts()).filter(cell =>
		JSON.stringify(cell) !== JSON.stringify(before.get(cell.id)));
	assert.equal(difference.length, 4);
	for(const cell of difference)
	{
		assert.ok(target(cell), cell.id);
		assert.ok(cell.conversionNote.includes(checkedRecordValueIndexPythonPromotionConversion));
		assert.ok(cell.limitations.includes(checkedRecordValueIndexPythonPromotionLimit));
		for(const stage of Object.values(cell.stages))
			assert.ok(stage.evidence.some(id => id.startsWith("checked-record-value-index-python-")));
	}
	const liveProfile = sha256(await readFile("src/adoption/test-profiles.mjs"));
	let refreshed = 0;
	for(const evidence of proposed.evidence) for(const file of evidence.files)
		if(file.path === "src/adoption/test-profiles.mjs")
		{
			assert.equal(file.sha256, liveProfile); refreshed += 1;
		}
	assert.ok(refreshed > 0);
	await assert.rejects(promoteCheckedRecordValueIndexPython(proposed, references)
		, /Already promoted/u);
	await assert.rejects(promoteCheckedRecordValueIndexPython(original, references.slice(1)));
});

test("checked-record value-index Python inventory equals the exact promotion", {
	timeout: 120_000
}, async () => {
	const proposed = await promoteCheckedRecordValueIndexPython(
		checkedRecordValueIndexPythonPromotionBaseline()
		, await checkedRecordValueIndexPythonPromotionReferences()
	);
	assert.deepEqual(JSON.parse(await readFile("docs/type-surface.v1.json")), proposed);
});
