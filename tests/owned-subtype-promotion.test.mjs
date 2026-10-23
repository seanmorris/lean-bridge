/**
 * Prove that owned-Subtype promotion changes only its exact matrix.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	typeSurfaceCells, validateTypeSurface
} from "../src/adoption/type-surface.mjs";
import {
	renderTypeDocuments
} from "../scripts/generate-type-docs.mjs";
import {
	ownedSubtypeJavaScriptPromotionReference
	, ownedSubtypePromotionLanes, ownedSubtypePromotionLimit
	, ownedSubtypePromotionPredecessor, ownedSubtypePromotionReferences
	, promoteOwnedSubtypes, renderOwnedSubtypePromotion
} from "./helpers/owned-subtype-promotion.mjs";

const readJson = async path => JSON.parse(await readFile(path, "utf8"));
const baseline = execFileSync("git", [
	"show"
	, `${ownedSubtypePromotionPredecessor}:docs/type-surface.v1.json`
], { encoding: "utf8", maxBuffer: 512 * 1024 ** 2 });
const document = JSON.parse(baseline);
const [irSchema, consumers] = await Promise.all([
	readJson("schema/binding-ir.schema.json")
	, readJson("docs/consumer-support.v1.json")
]);
const contracts = { irSchema, consumers };
const digest = "0".repeat(64), revision = "0".repeat(40);
const references = ownedSubtypePromotionLanes.map(item => ({
	lane: item.lane, profiles: [...item.profiles]
	, routes: ["ordinary", "reviewed"]
	, id: `owned-subtype-${item.lane}-${item.lane === "javascript"
		? "local" : "hosted"}-installed`
	, kind: "installed", revision
	, command: `Replay ${item.lane} owned Subtype evidence.`
	, scope: `Test-only ${item.lane} evidence scope.`
	, files: [{ path: `test/${item.lane}.json`, sha256: digest }]
	, artifacts: [{ path: `test/${item.lane}.zip`, sha256: digest }]
}));
const targetProfiles = ownedSubtypePromotionLanes.flatMap(item =>
	item.profiles);
const target = new Set(targetProfiles.flatMap(profile =>
	["ordinary-source", "reviewed-ir"].map(path =>
		`${profile}/subtype/${path}/field`)));

test("owned Subtype promotion closes exactly 32 non-PHP-Wasm cells", () => {
	const promoted = promoteOwnedSubtypes(document, references);
	assert.equal(validateTypeSurface(promoted, contracts), true);
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
				assert.ok(stage.evidence.some(id =>
					id.startsWith("owned-subtype-")), cell.id);
			}
			assert.match(cell.hostType, /tested acyclic owned Bundle/u);
			assert.match(cell.conversionNote
				, /before a successful transferred-input handoff/u);
			assert.ok(cell.limitations.includes(ownedSubtypePromotionLimit));
			changed++;
		}
		else assert.deepEqual(cell, original, cell.id);
	}
	assert.equal(changed, 32);
	for(const path of ["ordinary-source", "reviewed-ir"])
		assert.deepEqual(
			before.get(`php-wasm/subtype/${path}/field`)
			, typeSurfaceCells(promoted, contracts).find(cell =>
				cell.id === `php-wasm/subtype/${path}/field`)
		);
});

test("owned Subtype promotion binds exact lanes and refuses repetition", () => {
	const promoted = promoteOwnedSubtypes(document, references);
	assert.deepEqual(promoted.evidence.slice(-8).map(item => item.id)
		, references.map(item => item.id));
	assert.throws(() => promoteOwnedSubtypes(promoted, references)
		, /Already promoted/u);
	assert.throws(() => promoteOwnedSubtypes(document, references.slice(1))
		, assert.AssertionError);
	const wrong = structuredClone(references);
	wrong[0].profiles = ["php-wasm"];
	assert.throws(() => promoteOwnedSubtypes(document, wrong)
		, assert.AssertionError);
});

test("owned Subtype promotion renders the exact boundary", () => {
	const summary = renderOwnedSubtypePromotion(references);
	assert.match(summary, /exactly 32 existing cells/u);
	assert.match(summary, /all sixteen non-PHP-Wasm consumer profiles/u);
	assert.match(summary, /validated before ownership movement/u);
	assert.match(summary, /does not widen PHP-Wasm/u);
	assert.match(summary, /owned checked-record fields/u);
	for(const reference of references)
		assert.match(summary, new RegExp(reference.revision, "u"));
});

test("owned Subtype promotion documents every affected consumer", async () => {
	const before = await renderTypeDocuments({
		root: ".", inventory: { document, ...contracts }
	});
	const promoted = promoteOwnedSubtypes(document, references);
	const after = await renderTypeDocuments({
		root: ".", inventory: { document: promoted, ...contracts }
	});
	const evidence = /owned-subtype-promotion-20261023\.md/u;
	for(const [path, source] of Object.entries(after.documents))
	{
		assert.doesNotMatch(before.documents[path], evidence, path);
		assert.match(source, evidence, path);
		assert.match(source, /validates host input before a successful ownership transfer/u
			, path);
		assert.match(source, /rejection leaves ownership with the caller/u, path);
		assert.match(source, /explicit close or release performs cleanup/u, path);
		assert.match(source, /PHP-Wasm keeps its separately audited/u, path);
	}
	assert.doesNotMatch(before.reference, evidence);
	assert.match(after.reference, evidence);
	assert.match(after.reference, /all sixteen non-PHP-Wasm consumer profiles/u);
	assert.match(after.reference, /PHP-Wasm retains its separately audited/u);
});

test("JavaScript owned Subtype promotion rechecks both relocated routes"
	, async () => {
		const reference = await ownedSubtypeJavaScriptPromotionReference();
		assert.deepEqual(reference.profiles
			, ownedSubtypePromotionLanes[0].profiles);
		assert.deepEqual(reference.routes, ["ordinary", "reviewed"]);
		assert.equal(reference.artifacts.length, 4);
		assert.equal(new Set(reference.artifacts.map(file => file.path)).size, 4);
	}
);

const hostedAvailable = ownedSubtypePromotionLanes.slice(1).every(item =>
	existsSync(`docs/evidence/owned-subtype-${item.lane}-hosted-20261023/index.json`));
test("all retained owned Subtype lanes independently replay for promotion"
	, { skip: !hostedAvailable }, async () => {
		const actual = await ownedSubtypePromotionReferences();
		assert.deepEqual(actual.map(reference => reference.lane)
			, ownedSubtypePromotionLanes.map(item => item.lane));
	}
);
