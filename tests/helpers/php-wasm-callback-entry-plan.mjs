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
 * @param family - Fin, checked-record or Subtype callback family.
 * @param selected - Compiler-authenticated entry identities.
 * @param validatorConstructors - Compiler-derived constructor of each closure refusal validator.
 */
export const phpWasmCallbackEntryPlan = (family, selected, validatorConstructors = {}) => {
	assert.ok(phpWasmCallbackEntryFamilies.includes(family));
	validatePhpWasmCallbackEntrySelection(selected);
	const find = (kind, label) => {
		const values = selected.filter(item => item.kind === kind && item.label === label);
		assert.equal(values.length, 1, `${kind}/${label}`);
		return { kind, label };
	};
	const findPrefix = (kind, prefix) => {
		const values = selected.filter(
			item => item.kind === kind && item.label.startsWith(prefix)
		);
		assert.equal(values.length, 1, `${kind}/${prefix}*`);
		return { kind, label: values[0].label };
	};
	// A closure with several checked leaves has one refusal validator per leaf; the native walker
	// reaches them in field order, so a refusal names the validator of the leaf that refused.
	const leafValidator = (name, constructor) => {
		const values = selected.filter(item => item.kind === "validator"
			&& item.label.startsWith(`${name}:callback_validator:closure_graph_refinement_`)
			&& validatorConstructors[item.label] === constructor);
		assert.equal(values.length, 1, `validator/${name}/${constructor}`);
		return { kind: "validator", label: values[0].label };
	};
	const call = (publicName, entries) => ({ publicName, entries, counts: counts(entries) });
	const top = (name, middle = []) => call(name, [
		find("adapter", `${name}:native`), find("adapter", `${name}:lean`)
		, ...middle, find("cleanup", `${name}:cleanup`)
	]);
	const maker = name => top(name);
	const closure = (
		name, constructors = [], includeSource = true, includeBody = true
	) => call(`${name}:invoke`, [
		find("adapter", `${name}:closure:native`)
		, find("adapter", `${name}:closure:lean`)
		, ...includeSource ? [find("source", name)] : [], ...constructors
		, ...includeBody ? [find("closure", `${name}:body`)] : []
		, find("cleanup", `${name}:invoke:cleanup`)
	]);
	const closureRefusal = (name, constructors = []) => call(`${name}:invoke`, [
		find("adapter", `${name}:closure:native`)
		, find("adapter", `${name}:closure:lean`)
		, ...constructors
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
			, ...recovery
		);
		entries.push(find("cleanup", `${name}:cleanup`));
		return call(name, entries);
	};
	const recoveryRefusal = (name, recovery = []) => call(name, [
		find("adapter", `${name}:native`), find("adapter", `${name}:lean`)
		, find("recovery", `${name}:recovery:lean`)
		, find("recovery", `${name}:recovery:native`)
		, ...recovery, find("cleanup", `${name}:cleanup`)
	]);
	let cases;
	if(family === "callback-fin")
	{
		const scaler = "ReviewedCallbacks.scaler";
		const counter = "ReviewedCallbacks.counter";
		const visit = "ReviewedCallbacks.visit";
		const three = "ReviewedCallbacks.three";
		const tiles = "ReviewedCallbacks.tiles", tileMaker = "ReviewedCallbacks.tileMaker";
		cases = [
			{ control: "closure-input", outcome: "accepted"
				, calls: [maker(scaler), closure(scaler)] }
			, { control: "closure-input-refusal", outcome: "refused"
				, calls: [closureRefusal(scaler)] }
			, { control: "closure-input-recovery", outcome: "accepted"
				, calls: [closure(scaler)] }
			, { control: "closure-result", outcome: "accepted"
				, calls: [maker(counter), closure(counter)] }
			, { control: "host-arguments", outcome: "accepted"
				, calls: [callback(visit, { calls: 5 })] }
			, { control: "invalid-recovery", outcome: "refused"
				, calls: [recoveryRefusal(three)] }
			, { control: "actual-reply-rejection", outcome: "refused"
				, calls: [callback(three, { rejected: true })] }
			, { control: "later-call-recovery", outcome: "accepted"
				, calls: [callback(three)] }
			// Tile values mix a checked Fin field with a plain Nat field. Building the closure
			// runs no source, but the hosted trace shows each accepted invocation of the Unit-
			// argument tiles running its marked source before the body; the Fin field refuses
			// in the closure adapter, before either runs.
			, { control: "mixed-closure-input", outcome: "accepted"
				, calls: [maker(tiles), closure(tiles)] }
			, { control: "mixed-closure-input-refusal", outcome: "refused"
				, calls: [closureRefusal(tiles)] }
			, { control: "mixed-closure-input-recovery", outcome: "accepted"
				, calls: [closure(tiles)] }
			// Like counter, tileMaker binds its start argument and runs its source on application.
			, { control: "mixed-closure-result", outcome: "accepted"
				, calls: [maker(tileMaker), closure(tileMaker)] }
		];
	}
	else if(family === "callback-checked-record")
	{
		const namespace = "CallbackCheckedRecords";
		const interval = [constructor(namespace, "mkInterval")];
		const positive = constructor(namespace, "checkedPositive");
		const weighted = [constructor(namespace, "checkedPositive")
			, constructor(namespace, "mkWeighted")];
		const host = `${namespace}.callHost`, mixedHost = `${namespace}.callHostMixed`;
		const nestedHost = `${namespace}.callHostNested`;
		const closureName = `${namespace}.makeClosure`;
		const mixedClosure = `${namespace}.makeMixedClosure`;
		const nestedClosure = `${namespace}.makeNestedClosure`;
		const closureValidator = findPrefix(
			"validator", `${closureName}:callback_validator:closure_graph_refinement_`
		);
		cases = [
			{ control: "host-reply", outcome: "accepted"
				, calls: [callback(host, { recovery: interval, reply: interval })] }
			, { control: "invalid-recovery", outcome: "refused"
				, calls: [recoveryRefusal(host, interval)] }
			, { control: "actual-reply-rejection", outcome: "refused"
				, calls: [callback(host, { recovery: interval
					, reply: interval, rejected: true })] }
			, { control: "later-call-recovery", outcome: "accepted"
				, calls: [callback(host, { recovery: interval, reply: interval })] }
			, { control: "mixed-host", outcome: "accepted"
				, calls: [callback(mixedHost, { recovery: interval, reply: interval })] }
			, { control: "nested-subtype", outcome: "accepted"
				, calls: [callback(nestedHost, { recovery: weighted, reply: weighted })] }
			, { control: "closure-input", outcome: "accepted"
				, calls: [maker(closureName), closure(closureName, interval, false)] }
			, { control: "closure-input-refusal", outcome: "refused"
				, calls: [
					closureRefusal(closureName, [
						...interval, closureValidator, ...interval
					])
				]
			}
			, { control: "closure-input-recovery", outcome: "accepted"
				, calls: [closure(closureName, interval, false)] }
			, { control: "mixed-closure", outcome: "accepted"
				, calls: [maker(mixedClosure)
					, closure(mixedClosure, interval, false, false)] }
			, { control: "nested-closure", outcome: "accepted"
				, calls: [maker(nestedClosure), closure(nestedClosure, weighted, false)] }
			// The selected Subtype payload field refuses before its enclosing record constructor runs.
			, { control: "nested-invalid-recovery", outcome: "refused"
				, calls: [recoveryRefusal(nestedHost, [positive])] }
			, { control: "nested-reply-rejection", outcome: "refused"
				, calls: [callback(nestedHost, { recovery: weighted
					, reply: [positive], rejected: true })] }
			, { control: "nested-closure-refusal", outcome: "refused"
				, calls: [
					closureRefusal(nestedClosure, [
						positive
						, leafValidator(nestedClosure, `${namespace}.checkedPositive`)
						, positive
					])
				]
			}
		];
	}
	else
	{
		const namespace = "CallbackSubtypes";
		const positive = [constructor(namespace, "checkedPositive")];
		const host = `${namespace}.callHost`, mixedHost = `${namespace}.callHostMixed`;
		const closureName = `${namespace}.makeClosure`;
		const mixedClosure = `${namespace}.makeMixedClosure`;
		const refusal = name => closureRefusal(name, [
			...positive, leafValidator(name, `${namespace}.checkedPositive`), ...positive
		]);
		cases = [
			{ control: "host-reply", outcome: "accepted"
				, calls: [callback(host, { recovery: positive, reply: positive })] }
			, { control: "invalid-recovery", outcome: "refused"
				, calls: [recoveryRefusal(host, positive)] }
			, { control: "actual-reply-rejection", outcome: "refused"
				, calls: [callback(host, { recovery: positive
					, reply: positive, rejected: true })] }
			, { control: "later-call-recovery", outcome: "accepted"
				, calls: [callback(host, { recovery: positive, reply: positive })] }
			, { control: "mixed-host", outcome: "accepted"
				, calls: [callback(mixedHost, { recovery: positive, reply: positive })] }
			, { control: "closure-input", outcome: "accepted"
				, calls: [maker(closureName), closure(closureName, positive, false)] }
			, { control: "closure-input-refusal", outcome: "refused"
				, calls: [refusal(closureName)] }
			, { control: "closure-input-recovery", outcome: "accepted"
				, calls: [closure(closureName, positive, false)] }
			// Lean drops the unused marker, so the mixed closure applies its reduced body
			// rather than the exported probe body, as the checked-record mixed closure does.
			, { control: "mixed-closure", outcome: "accepted"
				, calls: [maker(mixedClosure)
					, closure(mixedClosure, positive, false, false)] }
			, { control: "mixed-closure-refusal", outcome: "refused"
				, calls: [refusal(mixedClosure)] }
		];
	}
	assert.ok(cases.some(item => item.outcome === "refused"));
	assert.ok(cases.filter(item => item.outcome === "refused")
		.every(item => item.calls.length > 0));
	assert.ok(cases.some(item => item.calls.some(value => value.counts.callback > 0)));
	assert.ok(cases.some(item => item.calls.some(value => value.counts.closure > 0)));
	assert.ok(cases.every(item => item.calls.every(value => value.counts.cleanup === 1)));
	assert.equal(new Set(cases.map(item => item.control)).size, cases.length);
	return { scope: "separate-instrumented-probe", family
		, selected: structuredClone(selected), cases };
};
