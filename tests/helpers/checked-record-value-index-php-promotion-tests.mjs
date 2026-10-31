/**
 * Bind native-PHP value-index support to the immutable hosted archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { typeSurfaceCells, validateTypeSurface } from "../../src/adoption/type-surface.mjs";
import {
	checkedRecordValueIndexPhpPromotionBaseline
	, checkedRecordValueIndexPhpPromotionConversion
	, checkedRecordValueIndexPhpPromotionLimit
	, checkedRecordValueIndexPhpPromotionParent
	, checkedRecordValueIndexPhpPromotionReferences
	, promoteCheckedRecordValueIndexPhp
} from "./checked-record-value-index-php-promotion.mjs";
import { typeSurfaceContractsAtProducer } from "./producer-source.mjs";

const contracts = () => typeSurfaceContractsAtProducer(
	checkedRecordValueIndexPhpPromotionParent
);
const target = cell => cell.profile === "php-native"
	&& cell.shape === "checked-record" && ["ordinary-source", "reviewed-ir"].includes(cell.path)
	&& ["parameter", "result"].includes(cell.position);

test("hosted native-PHP value-index promotion authenticates four routes", {
	timeout: 120_000
}, async () => {
	const references = await checkedRecordValueIndexPhpPromotionReferences();
	assert.deepEqual(references.map(item => [item.route, item.positions]), [
		["ordinary-source", ["parameter", "result"]]
		, ["reviewed-ir", ["parameter", "result"]]
		, ["result-only-ordinary-source", ["result"]]
		, ["result-only-reviewed-ir", ["result"]]
	]);
	for(const reference of references)
	{
		assert.deepEqual(reference.profiles, ["php-native"]);
		assert.equal(reference.hostedRun, 39318504656);
		assert.equal(reference.artifact, 12220100407);
		assert.equal(reference.counts.executions, 4);
		assert.equal(reference.artifacts.length, 1);
		assert.ok(reference.files.some(file => file.path.endsWith("index.json")));
		assert.ok(reference.files.some(file => file.path.endsWith("report.json")));
	}
});

test("native-PHP promotion changes only four exact cells", {
	timeout: 120_000
}, async () => {
	const original = checkedRecordValueIndexPhpPromotionBaseline();
	const frozen = structuredClone(original);
	const references = await checkedRecordValueIndexPhpPromotionReferences();
	const proposed = await promoteCheckedRecordValueIndexPhp(original, references);
	const historicalContracts = contracts();
	validateTypeSurface(proposed, historicalContracts);
	assert.deepEqual(original, frozen);
	const before = new Map(typeSurfaceCells(original, historicalContracts).map(cell => [cell.id, cell]));
	const difference = typeSurfaceCells(proposed, historicalContracts).filter(cell =>
		JSON.stringify(cell) !== JSON.stringify(before.get(cell.id)));
	assert.equal(difference.length, 4);
	for(const cell of difference)
	{
		assert.ok(target(cell), cell.id);
		assert.ok(cell.conversionNote.includes(checkedRecordValueIndexPhpPromotionConversion));
		assert.ok(cell.limitations.includes(checkedRecordValueIndexPhpPromotionLimit));
		for(const stage of Object.values(cell.stages))
			assert.ok(stage.evidence.some(id => id.startsWith("checked-record-value-index-php-")));
	}
	await assert.rejects(promoteCheckedRecordValueIndexPhp(proposed, references)
		, /Already promoted/u);
	await assert.rejects(promoteCheckedRecordValueIndexPhp(original, references.slice(1)));
});
