/**
 * Typed Lean wrappers for copied callback values and owned returned closures.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { componentGraphRefinementValidators, componentRecursiveLeanSource } from "./component-recursive-lean.mjs";
import { componentRecursiveAbi, componentRecursiveDispatch } from "../abi/component-recursive-abi.mjs";
import {
	assertComponentStructuredCallableAbi, componentStructuredCallbackDirection, componentStructuredClosureRefuses
} from "../abi/component-structured-callables.mjs";
import { componentStructuredCallableDefaults } from "./component-structured-callable-defaults.mjs";
import { componentRefinedCall, componentRefinementGuards, componentCarrierRefinementValidators, componentRefinementConversion } from "./component-refinements.mjs";
import { componentRefinementMirrors, hasComponentNominalRefinements } from "./component-refinement-mirrors.mjs";

const primitive = { unit: "Unit", bool: "Bool", char: "Char"
	, nat: "Nat", int: "Int"
	, uint8: "UInt8", uint16: "UInt16", uint32: "UInt32", uint64: "UInt64"
	, int8: "Int8", int16: "Int16", int32: "Int32", int64: "Int64"
	, usize: "USize", isize: "ISize"
	, string: "String", bytes: "ByteArray"
	, float32: "Float32", float64: "Float" };

/**
 * Render an authenticated copied root or top-level callback identity.
 *
 * @param type - Concrete source type reference.
 * @param callbacks - Authenticated callable signatures for identity roots.
 * @param refinement - Optional scalar or structural Fin constraints.
 * @param hostProjection - Compiler-authenticated HostNull wrapper and constructors.
 */
export const componentStructuredLeanType = (type, callbacks = new Map(), refinement = null, hostProjection = null) => {
	if(refinement?.kind === "fin") return `(_root_.Fin ${refinement.bound})`;
	if(type.kind === "primitive") return `_root_.${primitive[type.name]}`;
	if(type.kind === "named")
	{
		const signature = callbacks.get(type.id);
		return signature ? `(${[...signature.parameters, signature.result].map((type, index) => componentStructuredLeanType(type, new Map(),
			index < signature.parameters.length ? signature.refinements?.parameters[index] : signature.refinements?.result, hostProjection)).join(" → ")})`
			: `_root_.${type.id.slice(5)}`;
	}
	const children = type.arguments.map((type, index) => componentStructuredLeanType(type, new Map(), refinement?.arguments[index], hostProjection));
	if(type.constructor === "tuple") return `(${children.join(" × ")})`;
	if(type.constructor === "result") return `(_root_.Except ${children[1]} ${children[0]})`;
	if(type.constructor === "host-null")
	{
		if(!hostProjection) throw new TypeError("HostNull type lacks its compiler-authenticated Lean projection");
		return `(_root_.${hostProjection.name} ${children[0]})`;
	}
	return `(_root_.${{ array: "Array", list: "List", option: "Option" }[type.constructor]} ${children[0]})`;
};

/**
 * Remove nominal Fin trees already enforced by the copied graph codec. Direct
 * scalar and structural Fin refinements remain adapter checks; constructor-
 * selecting nominal trees remain visible so the unsupported route fails closed.
 *
 * @param abi - Authenticated structured callable descriptor.
 * @returns {(signature: object, value: (object | null | undefined)) => (object | null)} A signature-refinement sanitizer.
 */
export const componentStructuredRuntimeRefinements = abi => {
	assertComponentStructuredCallableAbi(abi);
	const definitions = new Map(abi.types.map(type => [type.id, type]));
	const constraints = new Map((abi.nominalRefinements ?? []).map(entry => [entry.id, entry.refinement]));
	const combine = (left, right) => {
		if(left === null || left === undefined) return right ?? null;
		if(right === null || right === undefined) return left;
		if(canonicalJson(left) !== canonicalJson(right)) throw new TypeError("Conflicting callable nominal Fin refinements");
		return left;
	};
	const visit = (tree, type, shared = null, seen = new Set()) => {
		if(tree === null || tree === undefined) return null;
		if(type.kind === "named")
		{
			const definition = definitions.get(type.id);
			if(!definition || seen.has(type.id)) return tree;
			const declared = constraints.get(type.id);
			const own = definition.kind === "alias" ? declared?.target ?? null : declared ?? null;
			const expected = combine(shared, own), inner = new Set([...seen, type.id]);
			if(definition.kind === "alias") return visit(tree, definition.target, expected, inner);
			if(definition.kind === "record" && tree.kind === "record")
			{
				const fields = tree.fields.map((field, index) => ({ ...field
					, refinement: visit(field.refinement, definition.fields[index].type, expected?.kind === "record" ? expected.fields[index] : null, inner) }));
				return fields.every(field => field.refinement === null) ? null : { ...tree, fields };
			}
			if(definition.kind === "variant" && tree.kind === "variant")
			{
				const cases = tree.cases.map((branch, index) => ({ ...branch
					, fields: branch.fields.map((field, position) => ({ ...field
						, refinement: visit(field.refinement, definition.cases[index].fields[position].type
							, expected?.kind === "variant" ? expected.cases[index][position] : null, inner) })) }));
				return cases.every(branch => branch.fields.every(field => field.refinement === null)) ? null : { ...tree, cases };
			}
			return tree;
		}
		if(type.kind === "apply" && tree.kind === type.constructor)
		{
			const expected = shared?.kind === tree.kind ? shared.arguments : [];
			const arguments_ = tree.arguments.map((child, index) => visit(child, type.arguments[index], expected[index] ?? null, seen));
			return arguments_.every(child => child === null) ? null : { ...tree, arguments: arguments_ };
		}
		return shared !== null && canonicalJson(tree) === canonicalJson(shared) ? null : tree;
	};
	return (signature, value) => {
		if(value === null || value === undefined) return null;
		const parameters = value.parameters.map((tree, index) => visit(tree, signature.parameters[index]));
		const result = visit(value.result, signature.result);
		return parameters.some(Boolean) || result ? { parameters, result } : null;
	};
};

/**
 * Build an internal codec root catalog, not public compiled declarations.
 *
 * @param abi - Authenticated copied-payload callable descriptor.
 */
export const componentStructuredCopiedView = abi => {
	assertComponentStructuredCallableAbi(abi);
	const identities = new Set(abi.callbacks.map(type => type.id));
	const roots = new Map();
	for(const signature of [...abi.exports, ...abi.callbacks])
		for(const type of [...signature.parameters, signature.result])
			if(!identities.has(type.id)) roots.set(JSON.stringify(type), type);
	const entries = [...roots.values()], exports = [];
	for(let start = 0; start < entries.length; start += 32)
		exports.push({ bindingId: `copied-payload:${start / 32}`
			, symbol: start ? `lean_bridge_${sha256(`${abi.exports[0].symbol}:copied-payload:${start}`).slice(0, 24)}` : abi.exports[0].symbol
			, parameters: entries.slice(start, start + 32)
			, result: { kind: "primitive", name: "unit" }, resultMode: "value" });
	return { version: componentRecursiveAbi, dispatch: componentRecursiveDispatch, types: abi.types, exports };
};

/**
 * Share one collision-resistant helper prefix between the Lean and C generators.
 *
 * @param abi - Component descriptor containing its exported symbol namespace.
 * @param signature - Authenticated callback signature and key.
 */
export const componentStructuredCallablePrefix = (abi, signature) => `${abi.exports[0].symbol}_structured_${signature.key}`;

/**
 * Derive erased payload mirrors and normalized constructor trees for every export and
 * callback site of a structured callable component. A checked record crosses a callback
 * as its mirror; a host callback produces its arguments and consumes its reply, a leased
 * closure the reverse, so each callback site is normalized for its own producer. Components
 * without checked records or nominal selections keep their previous mirror-free layout.
 *
 * @param abi - Authenticated copied-payload callable descriptor.
 * @param sourceExports - Compiler-selected exports with public per-use refinement trees.
 * @param directions - Callback identity to host/closure/null direction.
 * @param nominalRefinements - Compiler-owned shared Fin constraints in nominal layouts.
 * @param hostProjection - Compiler-authenticated HostNull wrapper and constructors.
 */
export const componentStructuredCallableMirrors = (abi, sourceExports, directions, nominalRefinements = [], hostProjection = null) => {
	const callbacks = new Map(abi.callbacks.map(type => [type.id, type]));
	const trees = value => value ? [...value.parameters, value.result] : [];
	const needed = abi.types.some(type => type.kind === "record" && type.erased)
		|| abi.callbacks.some(type => trees(type.refinements).some(hasComponentNominalRefinements))
		|| sourceExports.some(item => trees(item.refinements).some(hasComponentNominalRefinements));
	if(!needed) return null;
	const identity = type => type.kind === "named" && callbacks.has(type.id);
	const unit = { kind: "primitive", name: "unit" };
	const site = type => identity(type) ? unit : type;
	const exports = [], items = [];
	for(const signature of abi.exports)
	{
		const item = sourceExports.find(value => value.bindingId === signature.bindingId);
		exports.push({
			bindingId: signature.bindingId, symbol: signature.symbol
			, parameters: signature.parameters.map(site), result: site(signature.result)
			, resultMode: "value"
		});
		items.push({
			bindingId: signature.bindingId, symbol: signature.symbol
			, parameters: signature.parameters.map(() => ({ leanType: "" }))
			, ...(item?.refinements ? { refinements: item.refinements } : {})
		});
	}
	for(const callback of abi.callbacks)
	{
		const symbol = `lean_bridge_${sha256(`${abi.exports[0].symbol}\0callback\0${callback.key}`).slice(0, 24)}`;
		const host = directions.get(callback.id) === "host";
		exports.push({
			bindingId: callback.id, symbol
			, parameters: callback.parameters.map(site), result: site(callback.result)
			, resultMode: "value"
		});
		items.push({
			bindingId: callback.id, symbol
			, parameters: callback.parameters.map(() => ({ leanType: "" }))
			, ...(callback.refinements ? { refinements: callback.refinements } : {})
			, produced: { parameters: callback.parameters.map(() => host), result: !host }
		});
	}
	const leanType = (type, callbacks = new Map(), refinement = null) => componentStructuredLeanType(type, callbacks, refinement, hostProjection);
	const mirrors = componentRefinementMirrors({ ...componentStructuredCopiedView(abi), exports }, items, leanType, nominalRefinements, hostProjection);
	const empty = value => !value || [...value.parameters, value.result].every(tree => tree === null);
	const sites = new Map(mirrors.sites.map(entry => [entry.bindingId, entry]));
	return {
		...mirrors
		, refinementsFor: bindingId => {
			const value = sites.get(bindingId)?.refinements;
			return empty(value) ? null : value;
		}
		, siteFor: bindingId => sites.get(bindingId)
	};
};

/**
 * Normalize the argument trees of every returned closure that refuses checked arguments, from
 * the descriptor alone, so its Lean leaf checks and the native diagnostic walkers share one tree
 * and one leaf identity. Each site is normalized exactly as componentStructuredCallableMirrors
 * normalizes that closure's site; the walk order is the closure's own conversion order.
 *
 * @param abi - Authenticated copied-payload callable descriptor.
 * @param options - Backend-specific callback-role recovery controls.
 * @param options.finDirections - Recover Fin-only callback roles from exports.
 * @param options.hostProjection - Compiler-authenticated HostNull wrapper and constructors.
 */
export const componentStructuredClosureRefusals = (abi, { finDirections = false, hostProjection = null } = {}) => {
	const closures = abi.callbacks.filter(signature => componentStructuredClosureRefuses(abi, signature, finDirections));
	if(!closures.length) return null;
	const callbacks = new Set(abi.callbacks.map(type => type.id));
	const unit = { kind: "primitive", name: "unit" };
	const site = type => type.kind === "named" && callbacks.has(type.id) ? unit : type;
	const symbol = signature =>
		`lean_bridge_${sha256(`${abi.exports[0].symbol}\0callback\0${signature.key}`).slice(0, 24)}`;
	const exports = closures.map(signature => ({
		bindingId: signature.id, symbol: symbol(signature)
		, parameters: signature.parameters.map(site)
		, result: site(signature.result), resultMode: "value"
	}));
	const items = closures.map(signature => ({
		bindingId: signature.id, symbol: symbol(signature)
		, parameters: signature.parameters.map(() => ({ leanType: "" }))
		, refinements: signature.refinements
		, produced: { parameters: signature.parameters.map(() => false), result: true }
	}));
	const view = { ...componentStructuredCopiedView(abi), exports };
	const leanType = (type, callbacks = new Map(), refinement = null) => componentStructuredLeanType(type, callbacks, refinement, hostProjection);
	const mirrors = componentRefinementMirrors(view, items, leanType, abi.nominalRefinements ?? [], hostProjection);
	const sites = closures.map((signature, index) => ({
		signature, bindingId: signature.id
		, symbol: `${componentStructuredCallablePrefix(abi, signature)}_closure`
		, wrapper: `closure_${signature.key}`
		, refinements: mirrors.sites[index].refinements
	}));
	return { cycles: mirrors.cycles, sites };
};

/**
 * Generate total Array-carried wrappers without relying on source object layout.
 *
 * @param abi - Authenticated copied-payload callable descriptor.
 * @param sourceExports - Compiler-selected declarations, symbols and applications.
 * @param options - Backend-specific callback-role recovery controls.
 * @param options.finDirections - Recover Fin-only callback roles from exports.
 * @param options.hostProjection - Compiler-authenticated HostNull wrapper and constructors.
 */
export const componentStructuredCallableLeanSource = (abi, sourceExports, { finDirections = false, hostProjection = null } = {}) => {
	assertComponentStructuredCallableAbi(abi);
	const structuredType = (type, callbacks = new Map(), refinement = null) => componentStructuredLeanType(type, callbacks, refinement, hostProjection);
	const callbacks = new Map(abi.callbacks.map(type => [type.id, type]));
	const nominalRefinements = abi.nominalRefinements ?? [];
	const runtimeRefinements = componentStructuredRuntimeRefinements(abi);
	const callbackDirections = new Map(abi.callbacks.map(type => [type.id
		, componentStructuredCallbackDirection(abi, type, finDirections)]));
	const refusals = componentStructuredClosureRefusals(abi, { finDirections, hostProjection });
	const definitions = new Map(abi.types.map(type => [type.id, type]));
	const conversion = componentStructuredCallableMirrors(abi, sourceExports, callbackDirections, nominalRefinements, hostProjection);
	const callbackRefinements = new Map(abi.callbacks.map(type => [type.id
		, conversion ? conversion.refinementsFor(type.id) : runtimeRefinements(type, type.refinements)]));
	for(const [id, value] of callbackRefinements) if(!conversion && callbackDirections.get(id) === null
		&& value && [...value.parameters, value.result].some(hasComponentNominalRefinements))
		throw new TypeError("Nominal Subtype selections cannot share a component with callbacks yet");
	// Wire types: a checked record crosses as its erased mirror wherever mirrors exist.
	const wire = type => type.kind === "named" && callbacks.has(type.id)
		? wireCallbackType(callbacks.get(type.id))
		: conversion ? conversion.renderType(type) : structuredType(type, callbacks);
	const wireCallbackType = signature => {
		const direction = callbackDirections.get(signature.id);
		if(direction === "host") return "_root_.USize";
		if(direction === "closure") return `(${[...signature.parameters.map(wire)
			, `(_root_.Option ${wire(signature.result)})`].join(" → ")})`;
		return structuredType({ kind: "named", id: signature.id }, callbacks);
	};
	const carrier = type => `(_root_.Array ${wire(type)})`;
	const constrained = nominalRefinements.length > 0 || [...callbackRefinements.values()].some(Boolean);
	const defaults = componentStructuredCallableDefaults(abi.types, nominalRefinements
		, new Set([...conversion?.names ?? []].map(name => `lean:${name}`)), hostProjection);
	const lines = [
		...componentRecursiveLeanSource(componentStructuredCopiedView(abi), [], structuredType
			, nominalRefinements, { ...(conversion ? { conversion, emitSites: false } : {}), hostProjection })
		, ...defaults.declarations
	];
	const checked = (names, body) => ["carrierResult (do", ...names.map(name => `  let ${name} ← carrierValue ${name}`), `  pure (${body})`, ")"];
	for(const signature of abi.callbacks)
	{
		const key = signature.key, prefix = componentStructuredCallablePrefix(abi, signature);
		const direction = callbackDirections.get(signature.id);
		const names = signature.parameters.map((_, index) => `a${index}`);
		const parameters = signature.parameters.map((type, index) => `(${names[index]} : ${carrier(type)})`).join(" ");
		const closure = carrier({ kind: "named", id: signature.id });
		const refinements = callbackRefinements.get(signature.id);
		if(direction === "host")
		{
			lines.push(`@[extern "${prefix}_invoke"]`
				, `opaque invoke_${key} (token : _root_.USize) ${parameters} : ${carrier(signature.result)} := #[]`, ""
				, `@[extern "${prefix}_recovery"]`
				, `opaque recovery_${key} (token : _root_.USize) : ${carrier(signature.result)} := #[]`, ""
				, `@[extern "${prefix}_reject"]`
				, `opaque reject_${key} (token : _root_.USize) (recovery : ${carrier(signature.result)}) : ${carrier(signature.result)} := recovery`, ""
				, `@[export ${prefix}_wrap]`
				, `def wrap_${key} (token : _root_.USize) : ${closure} := #[token]`, "");
			continue;
		}
		if(direction === "closure")
		{
			const application = ["carrierResult (do"
				, ...["closure", ...names].map(name => `  let ${name} ← carrierValue ${name}`)
				, `  let result ← closure ${names.join(" ")}`
				, "  pure result", ")"];
			lines.push(`@[export ${prefix}_apply]`
				, `def apply_${key} (closure : ${closure}) ${parameters} : ${carrier(signature.result)} :=`
				, ...application.map(line => `  ${line}`), "");
			// After apply refuses, native callers locate the first refused leaf with these pure
			// per-leaf checks; apply itself is unchanged.
			const refusal = refusals?.sites.find(item => item.bindingId === signature.id);
			if(refusal) refusal.refinements.parameters.forEach((tree, index) => lines.push(...componentGraphRefinementValidators(
				refusal, index, tree, signature.parameters[index], definitions, refusals.cycles, carrier)));
			continue;
		}
		const fallback = defaults.expression(
			signature.result
			, runtimeRefinements(signature, signature.refinements)?.result
		);
		const validators = (symbol, parameters, selected) => componentCarrierRefinementValidators({
			symbol
			, wrapper: `checked_${key}_${symbol.endsWith("result") ? "result" : "frame"}`
			, parameters: parameters.map(type => ({ leanType: wire(type) }))
			, refinements: { parameters: selected, result: null }
		}, true);
		if(refinements)
		{
			lines.push(...validators(`${prefix}_frame`, signature.parameters, refinements.parameters));
			if(refinements.result) lines.push(...validators(`${prefix}_result`, [signature.result], [refinements.result]));
		}
		const invokeArguments = names.map((name, index) => `#[${refinements?.parameters[index] ? `wire_${name}` : name}]`).join(" ");
		const projections = names.flatMap((name, index) => refinements?.parameters[index]
			? [`    let wire_${name} := ${componentRefinementConversion(refinements.parameters[index], name, false)}`] : []);
		const lambdaParameters = names.map((name, index) => refinements ? `(${name} : ${structuredType(signature.parameters[index], new Map(), refinements.parameters[index])})` : name);
		const invocation = `carrierValue (invoke_${key} token ${invokeArguments})`;
		const result = refinements?.result ? `(show _root_.Option ${structuredType(signature.result, new Map(), refinements.result)} from do let value : ${structuredType(signature.result)} ← ${invocation}; ${componentRefinementConversion(refinements.result, "value")})` : invocation;
		const application = refinements ? ["carrierResult (do"
			, ...["closure", ...names].map(name => `  let ${name} ← carrierValue ${name}`)
			, ...refinements.parameters.flatMap((refinement, index) => refinement ? [`  let ${names[index]} ← ${componentRefinementConversion(refinement, names[index])}`] : [])
			, `  let result := closure ${names.join(" ")}`
			, `  pure (${componentRefinementConversion(refinements.result, "result", false)})`
			, ")"] : checked(["closure", ...names], `closure ${names.join(" ")}`);
		lines.push(`@[extern "${prefix}_invoke"]`
			, `opaque invoke_${key} (token : _root_.USize) ${parameters} : ${carrier(signature.result)} := #[]`, ""
			, `@[export ${prefix}_wrap]`
			, `def wrap_${key} (token : _root_.USize) : ${closure} :=`
			, `  #[fun ${lambdaParameters.join(" ")} =>`
			, ...projections
			, `    match ${result} with`
			, `    | .none => ${fallback}`, "    | .some value => value]", ""
			, `@[export ${prefix}_apply]`
			, `def apply_${key} (closure : ${closure}) ${parameters} : ${carrier(signature.result)} :=`
			, ...application.map(line => `  ${line}`), "");
	}
	if(sourceExports.length !== abi.exports.length) throw new TypeError("Structured source export count mismatch");
	const seen = new Set();
	for(const sourceItem of sourceExports)
	{
		const signature = abi.exports.find(signature => signature.bindingId === sourceItem.bindingId);
		if(!signature || seen.has(sourceItem.bindingId) || sourceItem.symbol !== signature.symbol) throw new TypeError("Structured source export identity mismatch");
		const refinements = conversion ? conversion.refinementsFor(signature.bindingId) : runtimeRefinements(signature, sourceItem.refinements);
		if(!conversion && refinements && [...refinements.parameters, refinements.result].some(hasComponentNominalRefinements))
			throw new TypeError("Nominal Subtype selections cannot share a component with callbacks yet");
		// Compiler-adapter exports carry rendered Lean parameter types, while native and
		// PHP-Wasm projections deliberately retain only compiler metadata. Validators
		// must therefore derive their carrier types from the authenticated private ABI,
		// not from an optional host-projection field.
		const base = { ...sourceItem
			, parameters: signature.parameters.map(type => ({ leanType: wire(type) })) };
		delete base.refinements;
		const item = refinements ? { ...base, refinements } : base;
		lines.push(...componentCarrierRefinementValidators(item, constrained));
		seen.add(item.bindingId);
		const names = signature.parameters.map((_, index) => `a${index}`);
		const parameters = signature.parameters.map((type, index) => `(${names[index]} : ${carrier(type)})`).join(" ");
		const preflight = [], sourceArguments = [...names];
		for(const [index, type] of signature.parameters.entries())
		{
			if(type.kind !== "named" || callbackDirections.get(type.id) !== "host") continue;
			const callback = callbacks.get(type.id), refinements = callbackRefinements.get(type.id), key = callback.key;
			const raw = `_bridgeRecoveryRaw${index}`, recovery = `_bridgeRecovery${index}`;
			preflight.push(`  let ${raw} ← carrierValue (recovery_${key} ${names[index]})`
				, `  let ${recovery} ← ${componentRefinementConversion(refinements.result, raw)}`);
			const arguments_ = callback.parameters.map((_, position) => `_bridgeCallback${index}_${position}`);
			const wire = arguments_.map((name, position) => `#[${refinements.parameters[position]
				? componentRefinementConversion(refinements.parameters[position], name, false) : name}]`).join(" ");
			const rawResult = `_bridgeCallbackResult${index}`;
			const checkedResult = componentRefinementConversion(refinements.result, rawResult);
			const rejected = `(match (do let value ← carrierValue (reject_${key} ${names[index]} #[${raw}]); ${componentRefinementConversion(refinements.result, "value")}) with | .some value => value | .none => ${recovery})`;
			sourceArguments[index] = `(fun ${arguments_.join(" ")} => match (do let ${rawResult} ← carrierValue (invoke_${key} ${names[index]} ${wire}); ${checkedResult}) with | .some value => value | .none => ${rejected})`;
		}
		const refined = componentRefinedCall(item, sourceArguments, true);
		const resultCallback = signature.result.kind === "named" ? callbacks.get(signature.result.id) : null;
		let success = `pure (${refined.call})`;
		if(resultCallback && callbackDirections.get(resultCallback.id) === "closure")
		{
			const refinements = callbackRefinements.get(resultCallback.id);
			const arguments_ = resultCallback.parameters.map((type, index) => `(_bridgeCallbackResult_${index} : ${wire(type)})`);
			const conversions = resultCallback.parameters.flatMap((_, index) => refinements.parameters[index]
				? [`let _bridgeCallbackChecked_${index} ← ${componentRefinementConversion(refinements.parameters[index], `_bridgeCallbackResult_${index}`)}`] : []);
			const applied = resultCallback.parameters.map((_, index) => refinements.parameters[index]
				? `_bridgeCallbackChecked_${index}` : `_bridgeCallbackResult_${index}`).join(" ");
			const projected = componentRefinementConversion(refinements.result, `_bridgeClosure ${applied}`, false);
			success = `do let _bridgeClosure := ${refined.call}; pure (fun ${arguments_.join(" ")} => do ${[...conversions, `pure (${projected})`].join("; ")})`;
		}
		const body = componentRefinementGuards(refined.guards, success, ".none");
		lines.push(`@[export ${item.symbol}_lean]`
			, `def ${item.wrapper} ${parameters || "(_bridgeUnit : _root_.Unit)"} : ${carrier(signature.result)} :=`
			, ...["carrierResult (do", ...names.map(name => `  let ${name} ← carrierValue ${name}`), ...preflight, ...body.split("\n").map(line => `  ${line}`), ")"].map(line => `  ${line}`), "");
	}
	return lines;
};
