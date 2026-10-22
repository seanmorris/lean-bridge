/**
 * Closed author and consumer fixtures for #1825 owned PHP-Wasm entry probes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { ownedSubtypePackageReviewedIr } from "./owned-aggregate-fixture.mjs";
import {
	ownedCheckedRecordFixture, ownedCheckedRecordReviewedIr, ownedCheckedRecordTrees
} from "./owned-checked-record-fixture.mjs";
import {
	ownedCheckedRecordJavaScriptConfiguration, ownedCheckedRecordJavaScriptReviewedIr
} from "./owned-checked-record-javascript-fixture.mjs";

export const phpWasmOwnedRefinementEntryFamilies = Object.freeze([
	"owned-subtype", "owned-checked-record"
]);
export const phpWasmOwnedRefinementEntryRoutes = Object.freeze(["ordinary", "reviewed"]);

/**
 * Require explicit producer enablement before permitting a narrowed hosted matrix.
 *
 * @param environment - Producer environment.
 */
export const phpWasmOwnedRefinementEntryHostedSelection = environment => {
	const prefix = "LEAN_BRIDGE_OWNED_REFINEMENT_ENTRY_PHP_WASM_";
	const flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag), "Invalid owned refinement entry TEST");
	const choose = (name, allowed) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
			assert.equal(flag, "1", `Explicit owned refinement entry ${name} requires TEST=1`);
		const selected = raw === undefined ? [...allowed] : raw.split(",");
		assert.ok(selected.length && selected.every(value => allowed.includes(value))
			, `Invalid owned refinement entry ${name}`);
		assert.equal(new Set(selected).size, selected.length, `Duplicate owned refinement entry ${name}`);
		return selected;
	};
	if(environment[prefix + "OUTPUT"] !== undefined)
		assert.equal(flag, "1", "Explicit owned refinement entry OUTPUT requires TEST=1");
	return { enabled: flag === "1"
		, families: choose("FAMILIES", phpWasmOwnedRefinementEntryFamilies)
		, routes: choose("ROUTES", phpWasmOwnedRefinementEntryRoutes) };
};

const definitions = Object.freeze({
	"owned-subtype": Object.freeze({
		root: "tests/fixtures/onboarding/owned-subtypes", leanModule: "Owned"
		, module: "LeanOwnedSubtypes", probe: "echo_record"
		, settings: Object.freeze({
			npm: Object.freeze({ name: "@lean-bridge-test/owned-refinement-entry-subtype", version: "1.0.0" })
			, composer: Object.freeze({ name: "lean-bridge-test/owned-refinement-entry-subtype", version: "1.0.0" })
		})
	})
	, "owned-checked-record": Object.freeze({
		root: ownedCheckedRecordFixture, leanModule: "OwnedCheckedRecords"
		, module: "LeanOwnedCheckedRecords", probe: "echo_claim"
		, settings: Object.freeze({
			npm: Object.freeze({ name: "@lean-bridge-test/owned-refinement-entry-checked", version: "1.0.0" })
			, composer: Object.freeze({ name: "lean-bridge-test/owned-refinement-entry-checked", version: "1.0.0" })
		})
	})
});

const checkedNames = Object.freeze([
	"newTicket", "serial", "echoBooking", "echoClaim", "echoGrant"
	, "pairClaim", "transferClaim"
]);
const q = name => `OwnedCheckedRecords.${name}`;

const checkedOrdinaryConfiguration = spec => {
	const base = structuredClone(ownedCheckedRecordJavaScriptConfiguration("ordinary"));
	const claim = base.contracts[q("echoClaim")];
	const grant = structuredClone(claim);
	grant.parameters[0].refinement = ownedCheckedRecordTrees.grant(q("mkGrant"), q("checkedPositive"));
	base.exports = checkedNames.map(q);
	base.arities = {};
	base.contracts = Object.fromEntries([
		"echoBooking", "echoClaim", "pairClaim", "transferClaim"
	].map(name => [q(name), base.contracts[q(name)]]).concat([[q("echoGrant"), grant]]));
	base.targets = { "php-wasm": { ...spec.settings, hostCallbacks: false } };
	return base;
};

const checkedReview = () => {
	const base = ownedCheckedRecordJavaScriptReviewedIr();
	const full = ownedCheckedRecordReviewedIr();
	const type = name => (name === "Grant" ? full : base).types.find(item => item.name === name);
	const declaration = name => (name === "echoGrant" ? full : base).declarations.find(item => item.name === name);
	base.types = ["Ticket", "Window", "Booking", "Claim", "Grant"].map(type);
	base.declarations = checkedNames.map(declaration);
	base.errors = [];
	assert.ok(base.types.every(Boolean) && base.declarations.every(Boolean));
	return base;
};

/**
 * Return exact author configuration, review and package coordinates.
 *
 * @param family - One closed owned refinement family.
 * @param route - Ordinary extraction or independent review.
 */
export const phpWasmOwnedRefinementEntryFixture = async (family, route) => {
	assert.ok(phpWasmOwnedRefinementEntryFamilies.includes(family));
	assert.ok(phpWasmOwnedRefinementEntryRoutes.includes(route));
	const spec = definitions[family];
	let configuration, review;
	if(family === "owned-subtype")
	{
		const original = JSON.parse(await readFile(`${spec.root}/lean-bridge.exports.json`, "utf8"));
		configuration = route === "ordinary" ? {
			...original, targets: { "php-wasm": { ...spec.settings, hostCallbacks: false } }
		} : { schemaVersion: 1, modules: original.modules
			, targets: { "php-wasm": { ...spec.settings, hostCallbacks: false } } };
		review = ownedSubtypePackageReviewedIr();
	}
	else
	{
		configuration = route === "ordinary" ? checkedOrdinaryConfiguration(spec)
			: { schemaVersion: 1, modules: [spec.leanModule]
				, targets: { "php-wasm": { ...spec.settings, hostCallbacks: false } } };
		review = checkedReview();
	}
	return { ...spec, family, route, configuration, review
		, verify: model => assert.equal(reviewedContractDifference(review, model.bindingIr), null) };
};

/**
 * Read one tracked compact caller and change only lexical strictness.
 *
 * @param family - One closed owned refinement family.
 * @param strictness - Weak or strict lexical PHP mode.
 */
export const phpWasmOwnedRefinementEntryCaller = async (family, strictness) => {
	assert.ok(phpWasmOwnedRefinementEntryFamilies.includes(family));
	assert.ok(["weak", "strict"].includes(strictness));
	const source = await readFile(`tests/fixtures/php-wasm-refinement-entry/${family}.php`, "utf8");
	const declaration = "declare(strict_types=0);";
	assert.equal(source.split(declaration).length - 1, 1);
	return source.replace(declaration, `declare(strict_types=${strictness === "strict" ? 1 : 0});`);
};

/**
 * Bind an independently authored owned plan to one installed arrangement.
 *
 * @param family - One closed owned refinement family.
 * @param arrangement - Embedded or Composer installation.
 * @param entryProbe - Compiler identities and independent call plan.
 */
export const phpWasmOwnedRefinementEntryRequest = (family, arrangement, entryProbe) => {
	assert.ok(phpWasmOwnedRefinementEntryFamilies.includes(family));
	assert.ok(["embedded", "composer"].includes(arrangement));
	assert.equal(entryProbe.family, family); assert.equal(entryProbe.scope, "separate-instrumented-probe");
	const spec = definitions[family];
	return canonicalJson({
		module: spec.module, operations: { probe: spec.probe }
		, autoload: arrangement === "composer" ? "vendor/autoload.php"
			: `vendor/${spec.settings.composer.name}/bootstrap.php`
		, entryProbe
	});
};

/**
 * Exact compact observation, independent of marker counts.
 *
 * @param family - One closed owned refinement family.
 * @param cases - Independently authored calls executed by the consumer.
 */
export const phpWasmOwnedRefinementEntryExpected = (family, cases) => {
	assert.ok(phpWasmOwnedRefinementEntryFamilies.includes(family));
	assert.ok(Array.isArray(cases) && cases.length > 0);
	return { checks: cases.length, family, word_bits: 32, php: "8.4.1" };
};
