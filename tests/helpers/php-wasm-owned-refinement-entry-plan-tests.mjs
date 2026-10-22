/**
 * Source-only controls for independently specified owned entry order.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { phpWasmOwnedRefinementEntryPlan } from "./php-wasm-owned-refinement-entry-plan.mjs";
import { phpWasmOwnedRefinementEntrySourceFixture } from "./php-wasm-owned-refinement-entry-source-fixtures.mjs";

const transferHooks = [
	["lgo_identity_input", "identity.borrow"]
	, ["lgo_input_reserve", "transfer.reserve"]
	, ["lgo_input_begin", "transfer.begin"]
	, ["lgo_input_commit", "transfer.commit"]
	, ["lb_owned_scope_transfer_many", "owner.move"]
	, ["lgo_input_consume", "owner.consume"]
	, ["lgo_inputs_finish", "transfer.finish"]
];
const familyNames = {
	"owned-subtype": ["newTicket", "echoRecord", "echoRecordAlternate", "transferRecord"]
	, "owned-checked-record": [
		"newTicket"
		, "echoBooking"
		, "echoClaim"
		, "pairClaim"
		, "echoGrant"
		, "transferClaim"
	]
};
const validators = {
	"owned-subtype": [
		["refine_count", ["checkedCount"]]
		, ["refine_alternate", ["checkedCountAlternate"]]
	]
	, "owned-checked-record": [
		["refine_window", ["mkWindow"]]
		, ["refine_claim", ["mkClaim"]]
		, ["refine_grant", ["checkedPositive", "mkGrant"]]
	]
};

const fixture = async family => {
	const authored = await phpWasmOwnedRefinementEntrySourceFixture(family);
	const namespace = family === "owned-subtype" ? "Owned" : "OwnedCheckedRecords";
	const selected = [...authored.entries];
	for(const [index, name] of familyNames[family].entries())
	{
		selected.push({ symbol: `lgo_call${index}`, kind: "public", label: name });
		selected.push({ symbol: `native_${index}`, kind: "adapter", label: `${name}:native` });
		selected.push({ symbol: `lean_${index}`, kind: "adapter", label: `${name}:lean` });
	}
	let lean = "";
	for(const [symbol, constructors] of validators[family])
	{
		selected.push({ symbol, kind: "validator", label: `owned:${symbol}` });
		lean += `@[export ${symbol}]\ndef ${symbol} := do\n`;
		for(const name of constructors) lean += `  _root_.${namespace}.${name}\n`;
	}
	selected.push(...transferHooks.map(([symbol, label]) => ({ symbol, kind: "adapter", label })));
	return { plan: phpWasmOwnedRefinementEntryPlan(family, selected, lean), selected, lean };
};
const labels = value => value.call.entries.map(entry => entry.label);

test("owned Subtype plan distinguishes per-site checks and pre-source transfer order", async () => {
	const { plan } = await fixture("owned-subtype");
	assert.deepEqual(plan.cases.map(value => value.control), [
		"setup-owner", "borrow-valid", "borrow-refusal", "borrow-recovery"
		, "alternate-valid", "alternate-refusal", "setup-transfer-owner"
		, "transfer-refusal", "transfer-accepted"
	]);
	const alternate = plan.cases.find(value => value.control === "alternate-valid");
	assert.deepEqual(labels(alternate), [
		"identity.borrow", "echoRecordAlternate:native", "owned:refine_alternate"
		, "Owned.checkedCountAlternate", "echoRecordAlternate:lean"
		, "Owned.checkedCountAlternate", "Owned.echoRecordAlternate"
	]);
	const refused = plan.cases.find(value => value.control === "transfer-refusal");
	assert.deepEqual(labels(refused), [
		"transfer.begin", "identity.borrow", "transfer.reserve", "transfer.commit"
		, "transferRecord:native", "owned:refine_count", "Owned.checkedCount"
		, "transfer.finish"
	]);
	const accepted = plan.cases.find(value => value.control === "transfer-accepted");
	assert.ok(labels(accepted).indexOf("owner.move") < labels(accepted).indexOf("transferRecord:lean"));
	assert.ok(labels(accepted).indexOf("owner.consume") < labels(accepted).indexOf("Owned.transferRecord"));
	assert.equal(labels(accepted).at(-1), "transfer.finish");
});

test("owned checked-record plan preserves first-refusal, nested and transfer order", async () => {
	const { plan } = await fixture("owned-checked-record");
	assert.deepEqual(plan.cases.map(value => value.control), [
		"setup-owner"
		, "booking-valid"
		, "booking-refusal"
		, "claim-valid"
		, "claim-refusal"
		, "claim-recovery", "pair-valid", "pair-second-refusal", "grant-valid"
		, "grant-positive-refusal", "grant-record-refusal", "setup-transfer-owner"
		, "transfer-refusal", "transfer-accepted"
	]);
	assert.deepEqual(labels(plan.cases.find(value => value.control === "pair-second-refusal")), [
		"identity.borrow", "identity.borrow", "pairClaim:native"
		, "owned:refine_window", "OwnedCheckedRecords.mkWindow"
		, "owned:refine_claim", "OwnedCheckedRecords.mkClaim"
	]);
	assert.deepEqual(labels(plan.cases.find(value => value.control === "grant-positive-refusal")), [
		"identity.borrow", "echoGrant:native", "owned:refine_grant"
		, "OwnedCheckedRecords.checkedPositive"
	]);
	assert.deepEqual(labels(plan.cases.find(value => value.control === "grant-record-refusal")).slice(-2), [
		"OwnedCheckedRecords.checkedPositive", "OwnedCheckedRecords.mkGrant"
	]);
	const moved = labels(plan.cases.find(value => value.control === "transfer-accepted"));
	assert.deepEqual(moved.slice(0, 4), [
		"transfer.begin", "identity.borrow", "transfer.reserve", "transfer.commit"
	]);
	assert.ok(moved.indexOf("owner.consume") < moved.indexOf("transferClaim:lean"));
	assert.equal(moved.at(-1), "transfer.finish");
});

test("owned plan refuses compiler identity and validator-definition drift", async () => {
	for(const family of Object.keys(familyNames))
	{
		const { selected, lean } = await fixture(family);
		assert.throws(() => phpWasmOwnedRefinementEntryPlan(family
			, selected.filter(item => item.label !== "owner.consume"), lean));
		assert.throws(() => phpWasmOwnedRefinementEntryPlan(family, selected
			, lean.replace("_root_.", "_root_.Drift.")));
	}
});
