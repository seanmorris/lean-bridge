/**
 * Bind Ruby value-index support to the immutable hosted archive.
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
	checkedRecordValueIndexRubyPromotionBaseline
	, checkedRecordValueIndexRubyPromotionConversion
	, checkedRecordValueIndexRubyPromotionLimit
	, checkedRecordValueIndexRubyPromotionParent
	, checkedRecordValueIndexRubyPromotionReferences
	, promoteCheckedRecordValueIndexRuby
} from "./checked-record-value-index-ruby-promotion.mjs";
import {
	checkedRecordValueIndexRubyPromotionHistoryPath
} from "./checked-record-value-index-ruby-promotion-source-history.mjs";

const contractsAt = revision => ({
	irSchema: JSON.parse(execFileSync("git", ["show"
		, `${revision}:schema/binding-ir.schema.json`], { encoding: "utf8" }))
	, consumers: JSON.parse(execFileSync("git", ["show"
		, `${revision}:docs/consumer-support.v1.json`], { encoding: "utf8" }))
});
const target = cell => cell.profile === "ruby"
	&& cell.shape === "checked-record"
	&& ["ordinary-source", "reviewed-ir"].includes(cell.path)
	&& ["parameter", "result"].includes(cell.position);

test("hosted Ruby value-index promotion authenticates four routes", {
	timeout: 120_000
}, async () => {
	const references = await checkedRecordValueIndexRubyPromotionReferences();
	assert.deepEqual(references.map(item => [item.route, item.positions]), [
		["ordinary-source", ["parameter", "result"]]
		, ["reviewed-ir", ["parameter", "result"]]
		, ["result-only-ordinary-source", ["result"]]
		, ["result-only-reviewed-ir", ["result"]]
	]);
	for(const reference of references)
	{
		assert.deepEqual(reference.profiles, ["ruby"]);
		assert.equal(reference.hostedRun, 39360088323);
		assert.equal(reference.artifact, 12238516604);
		assert.equal(reference.counts.executions, 2);
		assert.equal(reference.artifacts.length, 1);
		assert.ok(reference.files.some(file => file.path.endsWith("index.json")));
		assert.ok(reference.files.some(file => file.path.endsWith("report.json")));
	}
});

test("Ruby promotion changes only four exact cells and refreshes stale pins", {
	timeout: 120_000
}, async () => {
	const original = checkedRecordValueIndexRubyPromotionBaseline();
	const frozen = structuredClone(original);
	const references = await checkedRecordValueIndexRubyPromotionReferences();
	const proposed = await promoteCheckedRecordValueIndexRuby(original, references);
	const contracts = contractsAt(checkedRecordValueIndexRubyPromotionParent);
	validateTypeSurface(proposed, contracts);
	assert.deepEqual(original, frozen);
	const before = new Map(typeSurfaceCells(original, contracts)
		.map(cell => [cell.id, cell]));
	const difference = typeSurfaceCells(proposed, contracts).filter(cell =>
		JSON.stringify(cell) !== JSON.stringify(before.get(cell.id)));
	assert.equal(difference.length, 4);
	for(const cell of difference)
	{
		assert.ok(target(cell), cell.id);
		assert.ok(cell.conversionNote.includes(
			checkedRecordValueIndexRubyPromotionConversion));
		assert.ok(cell.limitations.includes(checkedRecordValueIndexRubyPromotionLimit));
		for(const stage of Object.values(cell.stages))
			assert.ok(stage.evidence.some(id =>
				id.startsWith("checked-record-value-index-ruby-")));
	}
	const liveProfile = sha256(await readFile("src/adoption/test-profiles.mjs"));
	let refreshed = 0;
	for(const evidence of proposed.evidence) for(const file of evidence.files)
		if(file.path === "src/adoption/test-profiles.mjs")
		{
			assert.equal(file.sha256, liveProfile); refreshed += 1;
		}
	assert.ok(refreshed > 0);
	await assert.rejects(promoteCheckedRecordValueIndexRuby(proposed, references)
		, /Already promoted/u);
	await assert.rejects(promoteCheckedRecordValueIndexRuby(
		original, references.slice(1)));
});

/** History commit whose inventory the promotion ledger records. */
const checkedRecordValueIndexRubyPromotionMilestone
	= "bb14e51b5a9f1fc5c0957f97c7c3d0ad7952326d";

test("checked-record value-index Ruby inventory equals the exact promotion", {
	timeout: 120_000
}, async () => {
	const show = path => execFileSync("git", ["show"
		, `${checkedRecordValueIndexRubyPromotionMilestone}:${path}`]
	, { maxBuffer: 512 * 1024 * 1024 });
	const history = JSON.parse(await readFile(
		checkedRecordValueIndexRubyPromotionHistoryPath, "utf8"));
	assert.equal(execFileSync("git", ["rev-parse"
		, `${checkedRecordValueIndexRubyPromotionMilestone}^`], { encoding: "utf8" })
		.trim(), history.draftParentCommit);
	const inventory = show("docs/type-surface.v1.json");
	assert.equal(sha256(inventory), history.updates.find(update =>
		update.path === "docs/type-surface.v1.json").currentSha256);
	const proposed = await promoteCheckedRecordValueIndexRuby(
		checkedRecordValueIndexRubyPromotionBaseline()
		, await checkedRecordValueIndexRubyPromotionReferences()
		, async path => show(path)
	);
	assert.deepEqual(JSON.parse(inventory), proposed);
});
