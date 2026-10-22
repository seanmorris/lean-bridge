/**
 * Keep callback Subtype promotion exact before all hosted lanes settle.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	typeSurfaceCells, validateTypeSurface
} from "../src/adoption/type-surface.mjs";
import {
	callbackSubtypePromotionLanes
	, callbackSubtypePromotionLimit
	, promoteCallbackSubtypes
	, renderCallbackSubtypePromotion
} from "./helpers/callback-subtype-promotion.mjs";

const readJson = async path => JSON.parse(await readFile(path, "utf8"));
const [document, irSchema, consumers] = await Promise.all([
	readJson("docs/type-surface.v1.json")
	, readJson("schema/binding-ir.schema.json")
	, readJson("docs/consumer-support.v1.json")
]);
const contracts = { irSchema, consumers };
const digest = "0".repeat(64), revision = "0".repeat(40);
const references = callbackSubtypePromotionLanes.map(item => ({
	lane: item.lane, profiles: [...item.profiles]
	, routes: ["ordinary", "reviewed"]
	, id: `callback-subtype-${item.lane}-hosted-installed`
	, kind: "installed", revision
	, command: `Replay ${item.lane} archive.`
	, scope: `Test-only ${item.lane} hosted scope.`
	, files: [{ path: `test/${item.lane}.json`, sha256: digest }]
	, artifacts: [{ path: `test/${item.lane}.zip`, sha256: digest }]
}));
const targetProfiles = callbackSubtypePromotionLanes
	.flatMap(item => item.profiles);
const target = new Set(targetProfiles.flatMap(profile =>
	["ordinary-source", "reviewed-ir"].flatMap(path =>
		["callback-parameter", "callback-result"].map(position =>
			`${profile}/subtype/${path}/${position}`))));

test("callback Subtype promotion closes exactly 64 non-PHP-Wasm cells", () => {
	const promoted = promoteCallbackSubtypes(document, references);
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
				callbackSubtypePromotionLimit), cell.id);
			changed++;
		}
		else assert.deepEqual(cell, original, cell.id);
	}
	assert.equal(changed, 64);
	for(const path of ["ordinary-source", "reviewed-ir"])
		for(const position of ["callback-parameter", "callback-result"])
			assert.deepEqual(
				before.get(`php-wasm/subtype/${path}/${position}`)
				, typeSurfaceCells(promoted, contracts).find(cell =>
					cell.id === `php-wasm/subtype/${path}/${position}`)
			);
});

test("callback Subtype promotion binds exact lanes and refuses repetition", () => {
	const promoted = promoteCallbackSubtypes(document, references);
	assert.deepEqual(promoted.evidence.slice(-8).map(item => item.id)
		, references.map(item => item.id));
	assert.deepEqual(promoted.observations.slice(-2).map(item => item.id), [
		"callback-subtype-browser-ordinary"
		, "callback-subtype-browser-reviewed"
	]);
	assert.throws(() => promoteCallbackSubtypes(promoted, references)
		, /Already promoted/u);
	assert.throws(() => promoteCallbackSubtypes(document
		, references.slice(1)), assert.AssertionError);
	const wrong = structuredClone(references);
	wrong[0].profiles = ["php-wasm"];
	assert.throws(() => promoteCallbackSubtypes(document, wrong)
		, assert.AssertionError);
});

test("callback Subtype promotion renders the exact hosted boundary", () => {
	const summary = renderCallbackSubtypePromotion(references);
	assert.match(summary, /exactly 64 cells/u);
	assert.match(summary
		, /sixteen profiles, two author routes and two callback positions/u);
	for(const reference of references)
	{
		assert.match(summary, new RegExp(
			`callback-subtype-${reference.lane}-20261022/index\\.json`, "u"
		));
		assert.match(summary, new RegExp(reference.revision, "u"));
	}
	assert.match(summary, /does not cover PHP-Wasm/u);
	assert.match(summary, /retained or asynchronous callbacks/u);
	assert.match(summary, /owned Subtypes/u);
});
