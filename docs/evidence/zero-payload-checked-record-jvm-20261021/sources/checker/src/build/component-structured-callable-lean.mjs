/**
 * Typed Lean wrappers for copied callback values and owned returned closures.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { componentRecursiveLeanSource } from "./component-recursive-lean.mjs";
import { componentRecursiveAbi, componentRecursiveDispatch } from "../abi/component-recursive-abi.mjs";
import { assertComponentStructuredCallableAbi } from "../abi/component-structured-callables.mjs";
import { componentStructuredCallableDefaults } from "./component-structured-callable-defaults.mjs";
import { componentRefinedCall, componentRefinementGuards, componentCarrierRefinementValidators, componentRefinementConversion } from "./component-refinements.mjs";
import { hasComponentNominalRefinements } from "./component-refinement-mirrors.mjs";
import { callbackSubtypeDirection } from "../abi/refinements.mjs";

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
 */
export const componentStructuredLeanType = (type, callbacks = new Map(), refinement = null) => {
	if(refinement?.kind === "fin") return `(_root_.Fin ${refinement.bound})`;
	if(type.kind === "primitive") return `_root_.${primitive[type.name]}`;
	if(type.kind === "named")
	{
		const signature = callbacks.get(type.id);
		return signature ? `(${[...signature.parameters, signature.result].map((type, index) => componentStructuredLeanType(type, new Map(),
			index < signature.parameters.length ? signature.refinements?.parameters[index] : signature.refinements?.result)).join(" → ")})`
			: `_root_.${type.id.slice(5)}`;
	}
	const children = type.arguments.map((type, index) => componentStructuredLeanType(type, new Map(), refinement?.arguments[index]));
	if(type.constructor === "tuple") return `(${children.join(" × ")})`;
	if(type.constructor === "result") return `(_root_.Except ${children[1]} ${children[0]})`;
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
 * Generate total Array-carried wrappers without relying on source object layout.
 *
 * @param abi - Authenticated copied-payload callable descriptor.
 * @param sourceExports - Compiler-selected declarations, symbols and applications.
 */
export const componentStructuredCallableLeanSource = (abi, sourceExports) => {
	assertComponentStructuredCallableAbi(abi);
	const callbacks = new Map(abi.callbacks.map(type => [type.id, type]));
	const nominalRefinements = abi.nominalRefinements ?? [];
	const runtimeRefinements = componentStructuredRuntimeRefinements(abi);
	const callbackRefinements = new Map(abi.callbacks.map(type => [type.id, runtimeRefinements(type, type.refinements)]));
	const callbackDirections = new Map(abi.callbacks.map(type => [type.id
		, callbackSubtypeDirection(type, type.refinements, abi.types)]));
	for(const [id, value] of callbackRefinements) if(callbackDirections.get(id) === null
		&& value && [...value.parameters, value.result].some(hasComponentNominalRefinements))
		throw new TypeError("Nominal Subtype selections cannot share a component with callbacks yet");
	const wireCallbackType = signature => {
		const direction = callbackDirections.get(signature.id);
		if(direction === "host") return "_root_.USize";
		if(direction === "closure") return `(${[...signature.parameters.map(type => componentStructuredLeanType(type))
			, `(_root_.Option ${componentStructuredLeanType(signature.result)})`].join(" → ")})`;
		return componentStructuredLeanType({ kind: "named", id: signature.id }, callbacks);
	};
	const carrier = type => `(_root_.Array ${type.kind === "named" && callbacks.has(type.id)
		? wireCallbackType(callbacks.get(type.id)) : componentStructuredLeanType(type, callbacks)})`;
	const constrained = nominalRefinements.length > 0 || [...callbackRefinements.values()].some(Boolean);
	const defaults = componentStructuredCallableDefaults(abi.types, nominalRefinements);
	const lines = [...componentRecursiveLeanSource(componentStructuredCopiedView(abi), [], componentStructuredLeanType, nominalRefinements), ...defaults.declarations];
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
			continue;
		}
		const fallback = defaults.expression(signature.result, refinements?.result);
		const validators = (symbol, parameters, selected) => componentCarrierRefinementValidators({
			symbol
			, wrapper: `checked_${key}_${symbol.endsWith("result") ? "result" : "frame"}`
			, parameters: parameters.map(type => ({ leanType: componentStructuredLeanType(type) }))
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
		const lambdaParameters = names.map((name, index) => refinements ? `(${name} : ${componentStructuredLeanType(signature.parameters[index], new Map(), refinements.parameters[index])})` : name);
		const invocation = `carrierValue (invoke_${key} token ${invokeArguments})`;
		const result = refinements?.result ? `(show _root_.Option ${componentStructuredLeanType(signature.result, new Map(), refinements.result)} from do let value : ${componentStructuredLeanType(signature.result)} ← ${invocation}; ${componentRefinementConversion(refinements.result, "value")})` : invocation;
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
		const refinements = runtimeRefinements(signature, sourceItem.refinements);
		if(refinements && [...refinements.parameters, refinements.result].some(hasComponentNominalRefinements))
			throw new TypeError("Nominal Subtype selections cannot share a component with callbacks yet");
		const base = { ...sourceItem };
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
			const arguments_ = resultCallback.parameters.map((type, index) => `(_bridgeCallbackResult_${index} : ${componentStructuredLeanType(type)})`);
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
