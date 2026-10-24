/**
 * Source-only controls for independently specified owned entry order.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { phpWasmOwnedRefinementEntryPlan } from "./php-wasm-owned-refinement-entry-plan.mjs";
import { phpWasmReducedArityTargets } from "./php-wasm-entry-call-targets.mjs";
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
		, "transfer.finish"
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
		, "owned:refine_claim", "OwnedCheckedRecords.mkClaim", "transfer.finish"
	]);
	assert.deepEqual(labels(plan.cases.find(value => value.control === "grant-positive-refusal")), [
		"identity.borrow", "echoGrant:native", "owned:refine_grant"
		, "OwnedCheckedRecords.checkedPositive", "transfer.finish"
	]);
	assert.deepEqual(labels(plan.cases.find(value => value.control === "grant-record-refusal")).slice(-3), [
		"OwnedCheckedRecords.checkedPositive", "OwnedCheckedRecords.mkGrant"
		, "transfer.finish"
	]);
	const moved = labels(plan.cases.find(value => value.control === "transfer-accepted"));
	assert.deepEqual(moved.slice(0, 4), [
		"transfer.begin", "identity.borrow", "transfer.reserve", "transfer.commit"
	]);
	assert.ok(moved.indexOf("owner.consume") < moved.indexOf("transferClaim:lean"));
	assert.equal(moved.at(-1), "transfer.finish");
	for(const value of plan.cases)
		assert.equal(labels(value).filter(label => label === "transfer.finish").length, 1, value.control);
	for(const value of plan.cases)
		assert.equal(labels(value).at(-1), "transfer.finish", `${value.control} closes its input leases`);
});

test("owned plans omit only an authenticated reduced-arity source marker", async () => {
	const { plan, selected, lean } = await fixture("owned-checked-record");
	const pair = selected.find(item => item.kind === "source" && item.label === "OwnedCheckedRecords.pairClaim");
	const target = { ...pair, target: "l_OwnedCheckedRecords_pairClaim___redArg" };
	const reduced = phpWasmOwnedRefinementEntryPlan("owned-checked-record", selected, lean, { reducedArity: [target] });
	assert.deepEqual(reduced.reducedArity, [target]);
	const valid = reduced.cases.find(value => value.control === "pair-valid");
	assert.deepEqual(valid.reducedArity, [pair.label]);
	assert.deepEqual(labels(valid), labels(plan.cases.find(value => value.control === "pair-valid"))
		.filter(label => label !== pair.label));
	assert.equal(valid.call.counts.source, 0);
	assert.equal(Object.hasOwn(reduced.cases.find(value => value.control === "pair-second-refusal"), "reducedArity"), false);
	assert.ok(reduced.cases.filter(value => value.control !== "pair-valid").every(value => !Object.hasOwn(value, "reducedArity")));
	for(const reducedArity of [
		[{ ...target, target: "l_OwnedCheckedRecords_echoClaim___redArg" }]
		, [{ ...target, target: "l_OwnedCheckedRecords_pairClaim" }]
		, [{ ...target, kind: "constructor" }], [{ ...target, symbol: "missing" }]
		, [target, target]
		, [{ ...pair }]
	]) assert.throws(() => phpWasmOwnedRefinementEntryPlan("owned-checked-record", selected, lean, { reducedArity }));
	assert.throws(() => phpWasmOwnedRefinementEntryPlan("owned-checked-record", selected, lean
		, { reducedArity: [target], globalDefinitions: [pair] }), /one classification/u);
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

test("reduced-arity call targets are classified from compiled adapter and wrapper call sites", () => {
	const source = { symbol: "lb_source_pair", kind: "source", label: "Probe.pair" };
	const direct = { symbol: "lb_source_echo", kind: "source", label: "Probe.echo" };
	const selected = [
		{ symbol: "lgo_call0", kind: "public", label: "pair" }
		, { symbol: "lean_bridge_adapter_lean", kind: "adapter", label: "pair:lean" }
		, source, direct
	];
	const target = "l_Probe_pair___redArg", delegate = `v_r = ${target}(v_x);`, call = `v_r = ${target}(v_b);`;
	const module = `LEAN_EXPORT lean_object* ${target}(lean_object* v_x){
_start:
{
return v_x;
}
}
LEAN_EXPORT lean_object* lb_source_pair(lean_object* v_unused, lean_object* v_x){
_start:
{
lean_object* v_r;
${delegate}
return v_r;
}
}
LEAN_EXPORT lean_object* lb_source_echo(lean_object* v_x){
_start:
{
return v_x;
}
}
`;
	const adapter = `lean_object* ${target}(lean_object*);
lean_object* lb_source_echo(lean_object*);
LEAN_EXPORT lean_object* lean_bridge_adapter_lean(lean_object* v_a, lean_object* v_b){
_start:
{
lean_object* v_r;
${call}
v_r = lb_source_echo(v_r);
/* lb_source_pair(v_a, v_b); */ return v_r;
}
}
`;
	const swap = (text, from, to) => {
		assert.ok(text.includes(from), from); return text.replace(from, to);
	};
	const probe = text => ({ name: "1-Probe.c", text }), glue = text => ({ name: "2-adapter.c", text });
	const classify = (lean, generated, options) => phpWasmReducedArityTargets([lean, generated], selected, options);
	const expected = [{ ...source, target }];
	assert.deepEqual(classify(probe(module), glue(adapter)), expected);
	for(const caller of [
		"v_r = lb_source_pair(v_a, v_b);"
		, "v_r = consume(lb_source_pair(v_a, v_b));"
		, "if (lb_source_pair(v_a, v_b)) v_r = v_b;"
		, "v_r = (lean_object*)lb_source_pair(v_a, v_b);"
		, "v_r = lean_apply(&lb_source_pair, v_b);"
	]) assert.deepEqual(classify(probe(module), glue(swap(adapter, call, caller))), [], caller);
	const valued = module.replace(/LEAN_EXPORT lean_object\* lb_source_echo[^]*$/u
		, "LEAN_EXPORT lean_object* lb_source_echo;\n");
	assert.deepEqual(classify(probe(valued), glue(adapter), { globalDefinitions: [direct] }), expected);
	const boxed = `${module}LEAN_EXPORT lean_object* ${target}___boxed(lean_object* v_x){
return ${target}(v_x);
}
`;
	assert.deepEqual(classify(probe(boxed), glue(adapter)), expected, "Lean's boxed target wrapper is classified");
	const faults = {
		"wrapper with no reduced-arity delegate": () => [probe(swap(module, delegate, "v_r = v_x;")), glue(adapter)]
		, "target without an adapter caller": () => [probe(module), glue(swap(adapter, call, "v_r = v_b;"))]
		, "delegate to another declaration": () => [
			probe(swap(module, delegate, "v_r = l_Probe_other___redArg(v_x);"))
			, glue(adapter)
		]
		, "duplicate marked definition": () => [
			probe(module), glue(adapter)
			, { name: "3-copy.c", text: "LEAN_EXPORT lean_object* lb_source_pair(lean_object* v_x){ return v_x; }\n" }
		]
		, "missing reduced-arity definition": () => [
			probe(swap(module, `LEAN_EXPORT lean_object* ${target}(lean_object* v_x){`, "static int unused(void){"))
			, glue(adapter)
		]
		, "unnamed input": () => [{ name: "Probe.c", text: module }, glue(adapter)]
		, "unclassified same-file target caller": () => [
			probe(`${module}lean_object* other(lean_object* v_x){ return ${target}(v_x); }\n`)
			, glue(adapter)
		]
		, "suffix lookalike adapter call": () => [probe(module), glue(swap(adapter, call, `v_r = ${target}X(v_b);`))]
		, "prefix lookalike adapter call": () => [probe(module), glue(swap(adapter, call, `v_r = x${target}(v_b);`))]
		, "multiple specialized delegates": () => [
			probe(swap(module, delegate, `v_r = ${target}(l_Probe_pair___lambda(v_x));`))
			, glue(adapter)
		]
		, "target called outside a selected adapter": () => [
			probe(module)
			, glue(swap(adapter, "lean_bridge_adapter_lean(", "unselected_adapter("))
		]
	};
	for(const [label, inputs] of Object.entries(faults))
		assert.throws(() => phpWasmReducedArityTargets(inputs(), selected), label);
});
