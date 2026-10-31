/**
 * Bind Rust value-index support to the immutable hosted archive.
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
	checkedRecordValueIndexRustPromotionBaseline
	, checkedRecordValueIndexRustPromotionConversion
	, checkedRecordValueIndexRustPromotionLimit
	, checkedRecordValueIndexRustPromotionParent
	, checkedRecordValueIndexRustPromotionReferences
	, promoteCheckedRecordValueIndexRust
} from "./checked-record-value-index-rust-promotion.mjs";
import {
	checkedRecordValueIndexRustPromotionHistoryPath
} from "./checked-record-value-index-rust-promotion-source-history.mjs";
import { typeSurfaceContractsAtProducer } from "./producer-source.mjs";

const contracts = () => typeSurfaceContractsAtProducer(
	checkedRecordValueIndexRustPromotionParent
);
const target = cell => cell.profile === "rust"
	&& cell.shape === "checked-record"
	&& ["ordinary-source", "reviewed-ir"].includes(cell.path)
	&& ["parameter", "result"].includes(cell.position);

test("hosted Rust value-index promotion authenticates four routes", {
	timeout: 180_000
}, async () => {
	const references = await checkedRecordValueIndexRustPromotionReferences();
	assert.deepEqual(references.map(item => [item.route, item.positions]), [
		["ordinary-source", ["parameter", "result"]]
		, ["reviewed-ir", ["parameter", "result"]]
		, ["result-only-ordinary-source", ["result"]]
		, ["result-only-reviewed-ir", ["result"]]
	]);
	for(const reference of references)
	{
		assert.deepEqual(reference.profiles, ["rust"]);
		assert.equal(reference.hostedRun, 39379254943);
		assert.equal(reference.artifact, 12245482092);
		assert.equal(reference.counts.executions, 3);
		assert.equal(reference.artifacts.length, 1);
		assert.ok(reference.files.some(file => file.path.endsWith("index.json")));
		assert.ok(reference.files.some(file => file.path.endsWith("report.json")));
	}
});

test("Rust promotion changes only four exact cells", {
	timeout: 180_000
}, async () => {
	const original = checkedRecordValueIndexRustPromotionBaseline();
	const frozen = structuredClone(original);
	const references = await checkedRecordValueIndexRustPromotionReferences();
	const proposed = await promoteCheckedRecordValueIndexRust(original, references);
	const historicalContracts = contracts();
	validateTypeSurface(proposed, historicalContracts);
	assert.deepEqual(original, frozen);
	const before = new Map(typeSurfaceCells(original, historicalContracts)
		.map(cell => [cell.id, cell]));
	const difference = typeSurfaceCells(proposed, historicalContracts).filter(cell =>
		JSON.stringify(cell) !== JSON.stringify(before.get(cell.id)));
	assert.equal(difference.length, 4);
	for(const cell of difference)
	{
		assert.ok(target(cell), cell.id);
		assert.ok(cell.conversionNote.includes(
			checkedRecordValueIndexRustPromotionConversion));
		assert.ok(cell.limitations.includes(checkedRecordValueIndexRustPromotionLimit));
		for(const stage of Object.values(cell.stages))
			assert.ok(stage.evidence.some(id =>
				id.startsWith("checked-record-value-index-rust-")));
	}
	await assert.rejects(promoteCheckedRecordValueIndexRust(proposed, references)
		, /Already promoted/u);
	await assert.rejects(promoteCheckedRecordValueIndexRust(
		original, references.slice(1)));
});

/** History commit whose inventory the promotion ledger records. */
const checkedRecordValueIndexRustPromotionMilestone
	= "42c40d8d54895be99bfcd2ee6856357919f55113";

test("checked-record value-index Rust inventory equals the exact promotion", {
	timeout: 180_000
}, async () => {
	const show = path => execFileSync("git", ["show"
		, `${checkedRecordValueIndexRustPromotionMilestone}:${path}`]
	, { maxBuffer: 512 * 1024 * 1024 });
	const history = JSON.parse(await readFile(
		checkedRecordValueIndexRustPromotionHistoryPath, "utf8"));
	assert.equal(execFileSync("git", ["rev-parse"
		, `${checkedRecordValueIndexRustPromotionMilestone}^`], { encoding: "utf8" })
		.trim(), history.draftParentCommit);
	const inventory = show("docs/type-surface.v1.json");
	assert.equal(sha256(inventory), history.updates.find(update =>
		update.path === "docs/type-surface.v1.json").currentSha256);
	const proposed = await promoteCheckedRecordValueIndexRust(
		checkedRecordValueIndexRustPromotionBaseline()
		, await checkedRecordValueIndexRustPromotionReferences()
		, async path => show(path)
	);
	assert.deepEqual(JSON.parse(inventory), proposed);
});
