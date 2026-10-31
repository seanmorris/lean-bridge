/**
 * Bind Python value-index support to the immutable hosted archive.
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
	checkedRecordValueIndexPythonPromotionBaseline
	, checkedRecordValueIndexPythonPromotionConversion
	, checkedRecordValueIndexPythonPromotionLimit
	, checkedRecordValueIndexPythonPromotionParent
	, checkedRecordValueIndexPythonPromotionReferences
	, promoteCheckedRecordValueIndexPython
} from "./checked-record-value-index-python-promotion.mjs";
import {
	checkedRecordValueIndexPythonPromotionHistoryPath
} from "./checked-record-value-index-python-promotion-source-history.mjs";
import { typeSurfaceContractsAtProducer } from "./producer-source.mjs";

const contracts = () => typeSurfaceContractsAtProducer(
	checkedRecordValueIndexPythonPromotionParent
);
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

/** History commit whose inventory the promotion ledger records. */
const checkedRecordValueIndexPythonPromotionMilestone
	= "4060e1c6eaea9d7ebcef15d57cdf98b7f5a7b81b";

test("checked-record value-index Python inventory equals the exact promotion", {
	timeout: 120_000
}, async () => {
	const show = path => execFileSync("git", ["show"
		, `${checkedRecordValueIndexPythonPromotionMilestone}:${path}`]
	, { maxBuffer: 512 * 1024 * 1024 });
	const history = JSON.parse(await readFile(
		checkedRecordValueIndexPythonPromotionHistoryPath, "utf8"));
	assert.equal(execFileSync("git", ["rev-parse"
		, `${checkedRecordValueIndexPythonPromotionMilestone}^`], { encoding: "utf8" })
		.trim(), history.draftParentCommit);
	const inventory = show("docs/type-surface.v1.json");
	assert.equal(sha256(inventory), history.updates.find(update =>
		update.path === "docs/type-surface.v1.json").currentSha256);
	const proposed = await promoteCheckedRecordValueIndexPython(
		checkedRecordValueIndexPythonPromotionBaseline()
		, await checkedRecordValueIndexPythonPromotionReferences()
		, async path => show(path)
	);
	assert.deepEqual(JSON.parse(inventory), proposed);
});
