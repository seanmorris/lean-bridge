/**
 * Bind PHP-Wasm value-index support to the immutable hosted archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { typeSurfaceCells, validateTypeSurface } from "../../src/adoption/type-surface.mjs";
import {
	checkedRecordValueIndexPhpWasmPromotionBaseline
	, checkedRecordValueIndexPhpWasmPromotionConversion
	, checkedRecordValueIndexPhpWasmPromotionLimit
	, checkedRecordValueIndexPhpWasmPromotionReferences
	, promoteCheckedRecordValueIndexPhpWasm
} from "./checked-record-value-index-php-wasm-promotion.mjs";
import {
	checkedRecordValueIndexPhpWasmPromotionHistoryPath
} from "./checked-record-value-index-php-wasm-promotion-source-history.mjs";

const contracts = async () => ({
	irSchema: JSON.parse(await readFile("schema/binding-ir.schema.json"))
	, consumers: JSON.parse(await readFile("docs/consumer-support.v1.json"))
});
const target = cell => cell.profile === "php-wasm"
	&& cell.shape === "checked-record"
	&& ["ordinary-source", "reviewed-ir"].includes(cell.path)
	&& ["parameter", "result"].includes(cell.position);

test("hosted PHP-Wasm value-index promotion authenticates four routes", {
	timeout: 900_000
}, async () => {
	const references = await checkedRecordValueIndexPhpWasmPromotionReferences();
	assert.deepEqual(references.map(item => [item.route, item.positions]), [
		["ordinary-source", ["parameter", "result"]]
		, ["reviewed-ir", ["parameter", "result"]]
		, ["result-only-ordinary-source", ["result"]]
		, ["result-only-reviewed-ir", ["result"]]
	]);
	for(const reference of references)
	{
		assert.deepEqual(reference.profiles, ["php-wasm"]);
		assert.equal(reference.hostedRun, 39370772629);
		assert.equal(reference.artifact, 12241424497);
		assert.equal(reference.counts.executions, 12);
		assert.equal(reference.artifacts.length, 3);
		assert.ok(reference.files.some(file => file.path.endsWith("index.json")));
		assert.ok(reference.files.some(file => file.path.endsWith("report.json")));
	}
});

test("PHP-Wasm promotion changes only four exact cells", {
	timeout: 900_000
}, async () => {
	const original = checkedRecordValueIndexPhpWasmPromotionBaseline();
	const frozen = structuredClone(original);
	const references = await checkedRecordValueIndexPhpWasmPromotionReferences();
	const proposed = await promoteCheckedRecordValueIndexPhpWasm(
		original, references
	);
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
			checkedRecordValueIndexPhpWasmPromotionConversion));
		assert.ok(cell.limitations.includes(
			checkedRecordValueIndexPhpWasmPromotionLimit));
		for(const stage of Object.values(cell.stages))
			assert.ok(stage.evidence.some(id =>
				id.startsWith("checked-record-value-index-php-wasm-")));
	}
	await assert.rejects(promoteCheckedRecordValueIndexPhpWasm(
		proposed, references), /Already promoted/u);
	await assert.rejects(promoteCheckedRecordValueIndexPhpWasm(
		original, references.slice(1)));
});

/** History commit whose inventory the promotion ledger records. */
const checkedRecordValueIndexPhpWasmPromotionMilestone
	= "dd2ee7a08530f5956912616442bc0a110c5708e9";

test("checked-record value-index PHP-Wasm inventory equals the exact promotion", {
	timeout: 900_000
}, async () => {
	const show = path => execFileSync("git", ["show"
		, `${checkedRecordValueIndexPhpWasmPromotionMilestone}:${path}`]
	, { maxBuffer: 512 * 1024 * 1024 });
	const history = JSON.parse(await readFile(
		checkedRecordValueIndexPhpWasmPromotionHistoryPath, "utf8"));
	assert.equal(execFileSync("git", ["rev-parse"
		, `${checkedRecordValueIndexPhpWasmPromotionMilestone}^`], { encoding: "utf8" })
		.trim(), history.draftParentCommit);
	const inventory = show("docs/type-surface.v1.json");
	assert.equal(sha256(inventory), history.updates.find(update =>
		update.path === "docs/type-surface.v1.json").currentSha256);
	const proposed = await promoteCheckedRecordValueIndexPhpWasm(
		checkedRecordValueIndexPhpWasmPromotionBaseline()
		, await checkedRecordValueIndexPhpWasmPromotionReferences()
		, async path => show(path)
	);
	assert.deepEqual(JSON.parse(inventory), proposed);
});
