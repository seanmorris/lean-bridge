/**
 * Keep callback checked-record promotion exact before all hosted lanes settle.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	typeSurfaceCells, validateTypeSurface
} from "../src/adoption/type-surface.mjs";
import {
	callbackCheckedRecordPromotionLanes
	, callbackCheckedRecordPromotionLimit
	, promoteCallbackCheckedRecords
	, renderCallbackCheckedRecordPromotion
} from "./helpers/callback-checked-record-promotion.mjs";
import {
	callbackCheckedRecordPromotionPredecessor
} from "./helpers/callback-checked-record-promotion-source-history.mjs";

const readJson = async path => JSON.parse(await readFile(path, "utf8"));
const baseline = execFileSync("git", ["show"
	, `${callbackCheckedRecordPromotionPredecessor}:docs/type-surface.v1.json`]
, { encoding: "utf8", maxBuffer: 512 * 1024 ** 2 });
const document = JSON.parse(baseline);
const [irSchema, consumers] = await Promise.all([
	readJson("schema/binding-ir.schema.json")
	, readJson("docs/consumer-support.v1.json")
]);
const contracts = { irSchema, consumers };
const digest = "0".repeat(64), revision = "0".repeat(40);
const references = callbackCheckedRecordPromotionLanes.map(item => ({
	lane: item.lane, profiles: [...item.profiles]
	, routes: ["ordinary", "reviewed"]
	, id: `callback-checked-record-${item.lane}-hosted-installed`
	, kind: "installed", revision
	, command: `Replay ${item.lane} archive.`
	, scope: `Test-only ${item.lane} hosted scope.`
	, files: [{ path: `test/${item.lane}.json`, sha256: digest }]
	, artifacts: [{ path: `test/${item.lane}.zip`, sha256: digest }]
}));
const targetProfiles = callbackCheckedRecordPromotionLanes
	.flatMap(item => item.profiles);
const target = new Set(targetProfiles.flatMap(profile =>
	["ordinary-source", "reviewed-ir"].flatMap(path =>
		["callback-parameter", "callback-result"].map(position =>
			`${profile}/checked-record/${path}/${position}`))));

test("callback checked-record promotion closes exactly 64 non-PHP-Wasm cells", () => {
	const promoted = promoteCallbackCheckedRecords(document, references);
	assert.equal(validateTypeSurface(promoted, contracts), true);
	assert.equal(target.size, 64);
	const before = new Map(typeSurfaceCells(document, contracts).map(cell =>
		[cell.id, cell]));
	let changed = 0;
	for(const cell of typeSurfaceCells(promoted, contracts))
	{
		const original = before.get(cell.id);
		if(target.has(cell.id))
		{
			for(const stage of Object.values(cell.stages))
				assert.equal(stage.state, "passed", cell.id);
			assert.ok(cell.hostType && cell.conversionNote, cell.id);
			assert.ok(cell.limitations.includes(
				callbackCheckedRecordPromotionLimit), cell.id);
			changed++;
		}
		else assert.deepEqual(cell, original, cell.id);
	}
	assert.equal(changed, 64);
	for(const path of ["ordinary-source", "reviewed-ir"])
		for(const position of ["callback-parameter", "callback-result"])
			assert.deepEqual(
				before.get(`php-wasm/checked-record/${path}/${position}`)
				, typeSurfaceCells(promoted, contracts).find(cell =>
					cell.id === `php-wasm/checked-record/${path}/${position}`)
			);
});

test("callback checked-record promotion binds exact lanes and refuses repetition", () => {
	const promoted = promoteCallbackCheckedRecords(document, references);
	assert.deepEqual(promoted.evidence.slice(-8).map(item => item.id)
		, references.map(item => item.id));
	assert.deepEqual(promoted.observations.slice(-6).map(item => item.id), [
		"callback-checked-record-browser-ordinary"
		, "callback-checked-record-browser-reviewed"
		, "callback-checked-record-native-ordinary"
		, "callback-checked-record-native-reviewed"
		, "callback-checked-record-perl-ordinary"
		, "callback-checked-record-perl-reviewed"
	]);
	assert.throws(() => promoteCallbackCheckedRecords(promoted, references)
		, /Already promoted/u);
	assert.throws(() => promoteCallbackCheckedRecords(document
		, references.slice(1)), assert.AssertionError);
	const wrong = structuredClone(references);
	wrong[0].profiles = ["php-wasm"];
	assert.throws(() => promoteCallbackCheckedRecords(document, wrong)
		, assert.AssertionError);
});

test("callback checked-record promotion renders the exact hosted boundary", () => {
	const summary = renderCallbackCheckedRecordPromotion(references);
	assert.match(summary, /exactly 64 cells/u);
	assert.match(summary, /sixteen profiles, two author routes and two callback positions/u);
	for(const reference of references)
	{
		assert.match(summary, new RegExp(
			`callback-checked-record-${reference.lane}-20261022/index\\.json`, "u"
		));
		assert.match(summary, new RegExp(reference.revision, "u"));
	}
	assert.match(summary, /does not cover PHP-Wasm/u);
	assert.match(summary, /retained or asynchronous callbacks/u);
	assert.match(summary, /owned records/u);
});
