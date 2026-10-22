/**
 * Independent exact call plans for synchronous PHP-Wasm callback entry probes.
 * Compiler output supplies identities; this file supplies semantic order.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	phpWasmCallbackEntryKinds, validatePhpWasmCallbackEntrySelection
} from "./php-wasm-callback-entry-c.mjs";
import { phpWasmCallbackEntryFamilies } from "./php-wasm-callback-entry-source-fixtures.mjs";

const counts = entries => Object.fromEntries(phpWasmCallbackEntryKinds.map(kind => [
	kind, entries.filter(item => item.kind === kind).length
]));

/**
 * Build one exact expected control matrix from authenticated identities.
 *
 * @param family - Fin or checked-record callback family.
 * @param selected - Compiler-authenticated entry identities.
 */
export const phpWasmCallbackEntryPlan = (family, selected) => {
	assert.ok(phpWasmCallbackEntryFamilies.includes(family));
	validatePhpWasmCallbackEntrySelection(selected);
	const find = (kind, label) => {
		const values = selected.filter(item => item.kind === kind && item.label === label);
		assert.equal(values.length, 1, `${kind}/${label}`);
		return { kind, label };
	};
	const call = (publicName, entries) => ({ publicName, entries, counts: counts(entries) });
	const top = (name, middle = []) => call(name, [
		find("adapter", `${name}:native`), find("adapter", `${name}:lean`)
		, ...middle, find("cleanup", `${name}:cleanup`)
	]);
	const maker = name => top(name, [find("source", name)]);
	const closure = (name, constructors = []) => call(`${name}:invoke`, [
		find("adapter", `${name}:closure:native`)
		, find("adapter", `${name}:closure:lean`)
		, ...constructors
		, find("closure", `${name}:body`)
		, find("cleanup", `${name}:invoke:cleanup`)
	]);
	const constructor = (namespace, name) => find("constructor", `${namespace}.${name}`);
	const callback = (name, { calls = 1, recovery = [], reply = [], rejected = false } = {}) => {
		const entries = [
			find("adapter", `${name}:native`), find("adapter", `${name}:lean`)
			, find("recovery", `${name}:recovery:lean`)
			, find("recovery", `${name}:recovery:native`)
			, ...recovery, find("source", name)
		];
		for(let index = 0; index < calls; ++index) entries.push(
			find("callback", `${name}:callback:lean`)
			, find("callback", `${name}:callback:native`)
			, find("callback", `${name}:callback:zend`)
			, ...reply
		);
		if(rejected) entries.push(
			find("rejection", `${name}:rejection:lean`)
			, find("rejection", `${name}:rejection:native`)
		);
		entries.push(find("cleanup", `${name}:cleanup`));
		return call(name, entries);
	};
	let cases;
	if(family === "callback-fin")
	{
		const scaler = "ReviewedCallbacks.scaler";
		const counter = "ReviewedCallbacks.counter";
		const visit = "ReviewedCallbacks.visit";
		const three = "ReviewedCallbacks.three";
		cases = [
			{ control: "closure-input", outcome: "accepted"
				, calls: [maker(scaler), closure(scaler)] }
			, { control: "closure-input-refusal", outcome: "refused", calls: [] }
			, { control: "closure-input-recovery", outcome: "accepted"
				, calls: [closure(scaler)] }
			, { control: "closure-result", outcome: "accepted"
				, calls: [maker(counter), closure(counter)] }
			, { control: "host-arguments", outcome: "accepted"
				, calls: [callback(visit, { calls: 5 })] }
			, { control: "invalid-recovery", outcome: "refused", calls: [] }
			, { control: "actual-reply-rejection", outcome: "refused"
				, calls: [callback(three, { rejected: true })] }
			, { control: "later-call-recovery", outcome: "accepted"
				, calls: [callback(three)] }
		];
	}
	else
	{
		const namespace = "CallbackCheckedRecords";
		const interval = [constructor(namespace, "mkInterval")];
		const weighted = [constructor(namespace, "checkedPositive")
			, constructor(namespace, "mkWeighted")];
		const host = `${namespace}.callHost`, mixedHost = `${namespace}.callHostMixed`;
		const nestedHost = `${namespace}.callHostNested`;
		const closureName = `${namespace}.makeClosure`;
		const mixedClosure = `${namespace}.makeMixedClosure`;
		const nestedClosure = `${namespace}.makeNestedClosure`;
		cases = [
			{ control: "host-reply", outcome: "accepted"
				, calls: [callback(host, { recovery: interval, reply: interval })] }
			, { control: "invalid-recovery", outcome: "refused", calls: [] }
			, { control: "actual-reply-rejection", outcome: "refused"
				, calls: [callback(host, { recovery: interval, rejected: true })] }
			, { control: "later-call-recovery", outcome: "accepted"
				, calls: [callback(host, { recovery: interval, reply: interval })] }
			, { control: "mixed-host", outcome: "accepted"
				, calls: [callback(mixedHost, { recovery: interval, reply: interval })] }
			, { control: "nested-subtype", outcome: "accepted"
				, calls: [callback(nestedHost, { recovery: weighted, reply: weighted })] }
			, { control: "closure-input", outcome: "accepted"
				, calls: [maker(closureName), closure(closureName, interval)] }
			, { control: "closure-input-refusal", outcome: "refused", calls: [] }
			, { control: "closure-input-recovery", outcome: "accepted"
				, calls: [closure(closureName, interval)] }
			, { control: "mixed-closure", outcome: "accepted"
				, calls: [maker(mixedClosure), closure(mixedClosure, interval)] }
			, { control: "nested-closure", outcome: "accepted"
				, calls: [maker(nestedClosure), closure(nestedClosure, weighted)] }
		];
	}
	assert.ok(cases.some(item => item.outcome === "refused" && item.calls.length === 0));
	assert.ok(cases.some(item => item.outcome === "refused" && item.calls.length > 0));
	assert.ok(cases.some(item => item.calls.some(value => value.counts.callback > 0)));
	assert.ok(cases.some(item => item.calls.some(value => value.counts.closure > 0)));
	assert.ok(cases.every(item => item.calls.every(value => value.counts.cleanup === 1)));
	assert.equal(new Set(cases.map(item => item.control)).size, cases.length);
	return { scope: "separate-instrumented-probe", family
		, selected: structuredClone(selected), cases };
};
