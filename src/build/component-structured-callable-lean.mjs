/**
 * Typed Lean wrappers for copied callback values and owned returned closures.
 *
 * @file
 */
import { sha256 } from "../capsule/node.mjs";
import { componentRecursiveLeanSource } from "./component-recursive-lean.mjs";
import { componentRecursiveAbi, componentRecursiveDispatch } from "../abi/component-recursive-abi.mjs";
import { assertComponentStructuredCallableAbi } from "../abi/component-structured-callables.mjs";
import { componentStructuredCallableDefaults } from "./component-structured-callable-defaults.mjs";

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
 */
export const componentStructuredLeanType = (type, callbacks = new Map()) => {
	if(type.kind === "primitive") return `_root_.${primitive[type.name]}`;
	if(type.kind === "named")
	{
		const signature = callbacks.get(type.id);
		return signature ? `(${[...signature.parameters, signature.result].map(type => componentStructuredLeanType(type)).join(" → ")})`
			: `_root_.${type.id.slice(5)}`;
	}
	const children = type.arguments.map(type => componentStructuredLeanType(type));
	if(type.constructor === "tuple") return `(${children.join(" × ")})`;
	if(type.constructor === "result") return `(_root_.Except ${children[1]} ${children[0]})`;
	return `(_root_.${{ array: "Array", list: "List", option: "Option" }[type.constructor]} ${children[0]})`;
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
	const carrier = type => `(_root_.Array ${componentStructuredLeanType(type, callbacks)})`;
	const defaults = componentStructuredCallableDefaults(abi.types);
	const lines = [...componentRecursiveLeanSource(componentStructuredCopiedView(abi), [], componentStructuredLeanType), ...defaults.declarations];
	const checked = (names, body) => ["carrierResult (do", ...names.map(name => `  let ${name} ← carrierValue ${name}`), `  pure (${body})`, ")"];
	for(const signature of abi.callbacks)
	{
		const key = signature.key, prefix = componentStructuredCallablePrefix(abi, signature);
		const names = signature.parameters.map((_, index) => `a${index}`);
		const parameters = signature.parameters.map((type, index) => `(${names[index]} : ${carrier(type)})`).join(" ");
		const closure = carrier({ kind: "named", id: signature.id });
		const fallback = defaults.expression(signature.result);
		lines.push(`@[extern "${prefix}_invoke"]`
			, `opaque invoke_${key} (token : _root_.USize) ${parameters} : ${carrier(signature.result)} := #[]`, ""
			, `@[export ${prefix}_wrap]`
			, `def wrap_${key} (token : _root_.USize) : ${closure} :=`
			, `  #[fun ${names.join(" ")} =>`
			, `    match carrierValue (invoke_${key} token ${names.map(name => `#[${name}]`).join(" ")}) with`
			, `    | .none => ${fallback}`, "    | .some value => value]", ""
			, `@[export ${prefix}_apply]`
			, `def apply_${key} (closure : ${closure}) ${parameters} : ${carrier(signature.result)} :=`
			, ...checked(["closure", ...names], `closure ${names.join(" ")}`).map(line => `  ${line}`), "");
	}
	if(sourceExports.length !== abi.exports.length) throw new TypeError("Structured source export count mismatch");
	const seen = new Set();
	for(const item of sourceExports)
	{
		const signature = abi.exports.find(signature => signature.bindingId === item.bindingId);
		if(!signature || seen.has(item.bindingId) || item.symbol !== signature.symbol) throw new TypeError("Structured source export identity mismatch");
		seen.add(item.bindingId);
		const names = signature.parameters.map((_, index) => `a${index}`);
		const parameters = signature.parameters.map((type, index) => `(${names[index]} : ${carrier(type)})`).join(" ");
		const call = `${item.sourceApplication ? `(${item.sourceApplication})` : `_root_.${item.sourceDeclaration}`} ${names.join(" ")}`;
		lines.push(`@[export ${item.symbol}_lean]`
			, `def ${item.wrapper} ${parameters || "(_bridgeUnit : _root_.Unit)"} : ${carrier(signature.result)} :=`
			, ...checked(names, call).map(line => `  ${line}`), "");
	}
	return lines;
};
