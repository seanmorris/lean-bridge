/**
 * Prove that generic-Subtype promotion changes only its closed field matrix.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	typeSurfaceCells, validateTypeSurface
} from "../../src/adoption/type-surface.mjs";
import {
	genericSubtypeHostedContracts, genericSubtypeHostedLaneNames
} from "./generic-subtype-hosted-contracts.mjs";
import {
	genericSubtypePromotionLimit, genericSubtypePromotionReferences
	, promoteGenericSubtypes, renderGenericSubtypePromotion
} from "./generic-subtype-promotion.mjs";

const readJson = async path => JSON.parse(await readFile(path, "utf8"));
const [document, irSchema, consumers] = await Promise.all([
	readJson("docs/type-surface.v1.json")
	, readJson("schema/binding-ir.schema.json")
	, readJson("docs/consumer-support.v1.json")
]);
const contracts = { irSchema, consumers };
const digest = "0".repeat(64), revision = "0".repeat(40);
const references = genericSubtypeHostedLaneNames.map(lane => {
	const contract = genericSubtypeHostedContracts[lane];
	return {
		lane, profiles: [...contract.profiles], routes: [...contract.routes]
		, id: `generic-subtype-${lane}-hosted-installed`
		, kind: lane === "foundation" ? "test" : "installed", revision
		, command: `Replay ${lane} generic Subtype evidence.`
		, scope: `Test-only ${lane} evidence scope.`
		, files: [{ path: `test/${lane}.json`, sha256: digest }]
		, artifacts: [{ path: `test/${lane}.zip`, sha256: digest }]
	};
});
const targetProfiles = [...new Set(genericSubtypeHostedLaneNames.flatMap(
	lane => genericSubtypeHostedContracts[lane].profiles))];
const target = new Set(targetProfiles.flatMap(profile =>
	["ordinary-source", "reviewed-ir"].map(path =>
		`${profile}/subtype/${path}/field`)));

test("generic Subtype promotion closes exactly 32 non-PHP-Wasm cells", () => {
	const promoted = promoteGenericSubtypes(document, references);
	assert.equal(validateTypeSurface(promoted, contracts), true);
	assert.equal(targetProfiles.length, 16);
	assert.equal(target.size, 32);
	const before = new Map(typeSurfaceCells(document, contracts).map(cell =>
		[cell.id, cell]));
	let changed = 0;
	for(const cell of typeSurfaceCells(promoted, contracts))
	{
		const original = before.get(cell.id);
		if(target.has(cell.id))
		{
			assert.notDeepEqual(cell, original, cell.id);
			for(const stage of Object.values(cell.stages))
			{
				assert.equal(stage.state, "passed", cell.id);
				assert.ok(stage.evidence.includes(
					"generic-subtype-foundation-hosted-installed"), cell.id);
				assert.ok(stage.evidence.some(id => id.startsWith(
					"generic-subtype-") && !id.includes("foundation")), cell.id);
			}
			assert.match(cell.hostType, /closed GenericNat record/u);
			assert.match(cell.conversionNote, /plusOne or plusTwo/u);
			assert.ok(cell.limitations.includes(genericSubtypePromotionLimit));
			changed++;
		}
		else assert.deepEqual(cell, original, cell.id);
	}
	assert.equal(changed, 32);
	for(const path of ["ordinary-source", "reviewed-ir"])
		assert.deepEqual(before.get(`php-wasm/subtype/${path}/field`)
			, typeSurfaceCells(promoted, contracts).find(cell =>
				cell.id === `php-wasm/subtype/${path}/field`));
});

test("generic Subtype promotion binds all twelve archive identities", () => {
	const promoted = promoteGenericSubtypes(document, references);
	assert.deepEqual(promoted.evidence.slice(-12).map(item => item.id)
		, references.map(item => item.id));
	assert.throws(() => promoteGenericSubtypes(promoted, references)
		, /Already promoted/u);
	assert.throws(() => promoteGenericSubtypes(document, references.slice(1))
		, assert.AssertionError);
	const wrong = structuredClone(references);
	wrong.find(item => item.lane === "native").profiles = ["php-wasm"];
	assert.throws(() => promoteGenericSubtypes(document, wrong)
		, assert.AssertionError);
});

test("generic Subtype promotion renders its exact closed boundary", () => {
	const summary = renderGenericSubtypePromotion(references);
	assert.match(summary, /Twelve immutable hosted archives/u);
	assert.match(summary, /all sixteen non-PHP-Wasm consumer profiles/u);
	assert.match(summary, /exactly 32 existing cells/u);
	assert.match(summary, /does not expose an open generic host type/u);
	assert.match(summary, /does not cover.*PHP-Wasm/u);
	for(const lane of genericSubtypeHostedLaneNames)
		assert.match(summary, new RegExp(
			`generic-subtype-${lane}-hosted-20261023/index\\.json`, "u"));
});

const hostedAvailable = genericSubtypeHostedLaneNames.every(lane =>
	existsSync(`docs/evidence/generic-subtype-${lane}-hosted-20261023/index.json`));
test("retained generic Subtype archives replay for promotion"
	, { skip: !hostedAvailable }, async () => {
		const actual = await genericSubtypePromotionReferences();
		assert.deepEqual(actual.map(reference => reference.lane)
			, genericSubtypeHostedLaneNames);
	}
);
