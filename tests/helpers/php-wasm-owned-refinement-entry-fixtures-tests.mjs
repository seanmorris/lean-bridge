/**
 * Source-only controls for closed owned probe author and consumer fixtures.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
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
