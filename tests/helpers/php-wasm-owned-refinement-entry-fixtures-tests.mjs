/**
 * Source-only controls for closed owned probe author and consumer fixtures.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { ownedCheckedRecordTrees } from "./owned-checked-record-fixture.mjs";
import { ownedSubtypePackageReviewedIr } from "./owned-aggregate-fixture.mjs";
import {
	phpWasmOwnedRefinementEntryCaller, phpWasmOwnedRefinementEntryExpected
	, phpWasmOwnedRefinementEntryFamilies, phpWasmOwnedRefinementEntryFixture
	, phpWasmOwnedRefinementEntryHostedSelection, phpWasmOwnedRefinementEntryRequest
	, phpWasmOwnedRefinementEntryRoutes
} from "./php-wasm-owned-refinement-entry-fixtures.mjs";

test("owned entry fixtures close ordinary and reviewed author selections", async () => {
	for(const family of phpWasmOwnedRefinementEntryFamilies)
		for(const route of phpWasmOwnedRefinementEntryRoutes)
		{
			const fixture = await phpWasmOwnedRefinementEntryFixture(family, route);
			assert.equal(fixture.family, family); assert.equal(fixture.route, route);
			assert.deepEqual(Object.keys(fixture.configuration.targets), ["php-wasm"]);
			assert.equal(fixture.configuration.targets["php-wasm"].hostCallbacks, false);
			assert.ok(fixture.review.declarations.some(item => item.name === "newTicket"));
			assert.ok(fixture.review.declarations.some(item => item.name === (family === "owned-subtype"
				? "transferRecord" : "transferClaim")));
			if(family === "owned-checked-record")
			{
				assert.deepEqual(fixture.review.declarations.map(item => item.name), [
					"newTicket", "serial", "echoBooking", "echoClaim", "echoGrant"
					, "pairClaim", "transferClaim"
				]);
				assert.ok(fixture.review.types.some(item => item.name === "Grant"));
				assert.equal(fixture.review.types.some(item => item.kind === "callback"), false);
			}
		}
});

test("owned entry reviews list effects in compiler order and the hosted difference is only that order", async () => {
	for(const family of phpWasmOwnedRefinementEntryFamilies)
		for(const route of phpWasmOwnedRefinementEntryRoutes)
		{
			const fixture = await phpWasmOwnedRefinementEntryFixture(family, route);
			for(const declaration of fixture.review.declarations)
				assert.deepEqual(declaration.effects, declaration.effects.toSorted(), declaration.id);
			fixture.verify({ bindingIr: structuredClone(fixture.review) });
		}
	// Hosted 390ae18 jobs 120732738114/120732738274 failed at exactly this path.
	const fixture = await phpWasmOwnedRefinementEntryFixture("owned-subtype", "ordinary");
	const shared = ownedSubtypePackageReviewedIr();
	assert.deepEqual(shared.declarations.find(item => item.name === "echoRecord").effects
		, ["reads-resource", "allocates"]);
	assert.equal(reviewedContractDifference(shared, fixture.review)
		, "bindingIr.declarations[0].effects[0]");
	const reordered = structuredClone(fixture.review);
	reordered.declarations.find(item => item.name === "echoRecord").effects.reverse();
	assert.throws(() => fixture.verify({ bindingIr: reordered }));
	const missing = structuredClone(fixture.review);
	missing.declarations.find(item => item.name === "newTicket").effects = [];
	assert.throws(() => fixture.verify({ bindingIr: missing }));
});

test("owned checked-record ordinary configuration names the Grant weight Subtype by constructor", async () => {
	const fixture = await phpWasmOwnedRefinementEntryFixture("owned-checked-record", "ordinary");
	validateExportConfiguration(fixture.configuration);
	const grant = fixture.configuration.contracts["OwnedCheckedRecords.echoGrant"];
	assert.deepEqual(grant.parameters[0].refinement, {
		kind: "checked-record", name: "OwnedCheckedRecords.Grant"
		, constructor: "OwnedCheckedRecords.mkGrant"
		, fields: [{ name: "holder", refinement: null }
			, { name: "weight", refinement: { constructor: "OwnedCheckedRecords.checkedPositive" } }
			, { name: "limit", refinement: null }]
	});
	// Hosted 390ae18 job 120732738323 failed on the reviewed-IR tree used as author configuration.
	const tagged = structuredClone(fixture.configuration);
	tagged.contracts["OwnedCheckedRecords.echoGrant"].parameters[0].refinement
		= ownedCheckedRecordTrees.grant("OwnedCheckedRecords.mkGrant", "OwnedCheckedRecords.checkedPositive");
	assert.throws(() => validateExportConfiguration(tagged)
		, /Contract OwnedCheckedRecords\.echoGrant: Invalid checked refinement selection/u);
});

test("owned entry callers vary only lexical strictness and bind a closed request", async () => {
	for(const family of phpWasmOwnedRefinementEntryFamilies)
	{
		const weak = await phpWasmOwnedRefinementEntryCaller(family, "weak");
		const strict = await phpWasmOwnedRefinementEntryCaller(family, "strict");
		assert.equal(strict, weak.replace("declare(strict_types=0);", "declare(strict_types=1);"));
		const entryProbe = { scope: "separate-instrumented-probe", family
			, selected: [], cases: [{ control: "probe" }] };
		for(const arrangement of ["embedded", "composer"])
		{
			const request = JSON.parse(phpWasmOwnedRefinementEntryRequest(family, arrangement, entryProbe));
			assert.equal(request.entryProbe.family, family);
			assert.equal(request.autoload, arrangement === "composer" ? "vendor/autoload.php"
				: `vendor/${(await phpWasmOwnedRefinementEntryFixture(family, "ordinary")).settings.composer.name}/bootstrap.php`);
		}
		assert.deepEqual(phpWasmOwnedRefinementEntryExpected(family, Array(3).fill({})), {
			checks: 3, family, word_bits: 32, php: "8.4.1"
		});
	}
});

test("owned entry fixtures reject open family, route and request choices", async () => {
	await assert.rejects(() => phpWasmOwnedRefinementEntryFixture("other", "ordinary"));
	await assert.rejects(() => phpWasmOwnedRefinementEntryFixture("owned-subtype", "other"));
	await assert.rejects(() => phpWasmOwnedRefinementEntryCaller("other", "weak"));
	assert.throws(() => phpWasmOwnedRefinementEntryRequest("owned-subtype", "network", {
		scope: "separate-instrumented-probe", family: "owned-subtype"
	}));
});

test("owned entry hosted selection is opt-in, closed and duplicate-free", () => {
	const prefix = "LEAN_BRIDGE_OWNED_REFINEMENT_ENTRY_PHP_WASM_";
	assert.deepEqual(phpWasmOwnedRefinementEntryHostedSelection({}), {
		enabled: false, families: [...phpWasmOwnedRefinementEntryFamilies]
		, routes: [...phpWasmOwnedRefinementEntryRoutes]
	});
	assert.deepEqual(phpWasmOwnedRefinementEntryHostedSelection({
		[prefix + "TEST"]: "1", [prefix + "FAMILIES"]: "owned-subtype"
		, [prefix + "ROUTES"]: "reviewed", [prefix + "OUTPUT"]: "build/probe"
	}), { enabled: true, families: ["owned-subtype"], routes: ["reviewed"] });
	for(const environment of [
		{ [prefix + "TEST"]: "yes" }
		, { [prefix + "FAMILIES"]: "owned-subtype" }
		, { [prefix + "TEST"]: "1", [prefix + "FAMILIES"]: "owned-subtype,owned-subtype" }
		, { [prefix + "TEST"]: "1", [prefix + "ROUTES"]: "network" }
	]) assert.throws(() => phpWasmOwnedRefinementEntryHostedSelection(environment));
});
