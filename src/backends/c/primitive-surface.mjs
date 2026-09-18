/**
 * Admit concrete copied values and share C spellings across native targets.
 *
 * @file
 */
import { cIdentifier, compileCProjectionModel, describeCFunction, describeCType } from "./generate.mjs";
import { componentScalarTypes } from "../../abi/component-scalars.mjs";

const keywords = new Set(("alignas alignof and and_eq asm atomic_cancel atomic_commit atomic_noexcept auto bitand bitor bool break case catch char char8_t char16_t char32_t class compl concept const consteval constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do double dynamic_cast else enum explicit export extern false float for friend goto if inline int long mutable namespace new noexcept not not_eq nullptr operator or or_eq private protected public register reinterpret_cast requires return short signed sizeof static static_assert static_cast struct switch template this thread_local throw true try typedef typeid typename union unsigned using virtual void volatile wchar_t while xor xor_eq restrict _Alignas _Alignof _Atomic _Bool _Complex _Generic _Imaginary _Noreturn _Static_assert _Thread_local").split(" "));
const safe = name => /^[a-z][a-z0-9_]*$/.test(name) && !name.includes("__") && !keywords.has(name);
const reserved = new Set(["initialize", "runtime", "runtime_v1", "runtime_install_v1", "ready", "fail", "attempted_runtime", "initialization_failure", "error", "error_code", "status", "string", "bytes", "nat", "int", "string_clear", "bytes_clear", "nat_clear", "int_clear", "detail"]);
const typeKey = ref => ref.kind === "primitive" ? `primitive:${ref.name}` : ref.kind === "named" ? `named:${ref.id}` : `${ref.constructor}(${(ref.arguments ?? []).map(typeKey).join(",")})`;

/**
 * Report an unsupported target at its original Lean declaration.
 *
 * @param declaration - Canonical source declaration.
 * @param message - Target admission diagnostic.
 */
export const rejectPrimitiveSurface = (declaration, message) => {
	const source = declaration?.source?.extensions?.["lean-lang.org/source-position"];
	throw Object.assign(new TypeError(`${source ? `${source.path}:${source.startLine}:${source.startColumn}: ` : ""}${declaration?.id ?? "C/C++"}: ${message}`), {
		code: "unsupported-native-c-signature"
		, details: { declaration: declaration?.id ?? null, source: source ?? null }
	});
};

/**
 * Validate every selected function; never silently drop an export.
 *
 * @param ir - Authoritative canonical Binding IR.
 */
export const compilePrimitiveCSurface = ir => {
	const copies = new Map(), visiting = new Set(), typeNames = new Set(reserved), cTypeNames = new Set();
	const visit = (ref, declaration, depth = 0) => {
		const key = typeKey(ref);
		if(depth > 32 || visiting.has(key)) rejectPrimitiveSurface(declaration, "C/C++ copied values must be acyclic and at most 32 types deep");
		if(copies.has(key)) return copies.get(key);
		visiting.add(key);
		let fields = [], element = null, record = null;
		if(ref.kind === "primitive" && componentScalarTypes.includes(ref.name)) { /* Closed copied leaf. */ }
		else if(ref.kind === "apply" && ref.constructor === "array" && ref.arguments.length === 1) element = visit(ref.arguments[0], declaration, depth + 1);
		else if(ref.kind === "named" && (record = ir.types.find(type => type.id === ref.id))?.kind === "record" && !record.typeParameters.length)
		{
			const name = cIdentifier(record.name), names = new Set();
			if(!safe(name) || typeNames.has(name) || !/^[A-Za-z][A-Za-z0-9_]*$/.test(record.name)) rejectPrimitiveSurface(declaration, "C/C++ record name collides with a generated or reserved identifier");
			typeNames.add(name); typeNames.add(`${name}_clear`);
			fields = record.fields.map(field => {
				const name = cIdentifier(field.name);
				if(!safe(name) || names.has(name)) rejectPrimitiveSurface(declaration, `C/C++ record field is reserved or duplicated: ${field.name}`);
				names.add(name);
				return { name, type: visit(field.type, declaration, depth + 1) };
			});
		} else rejectPrimitiveSurface(declaration, "ordinary C/C++ adapters require concrete, pure, copied primitives, arrays or acyclic records");
		visiting.delete(key);
		const copy = { ref, ...describeCType(ir, ref), fields, element, record, index: copies.size };
		if(copy.aggregate)
		{
			if(cTypeNames.has(copy.name) || cTypeNames.has(`${copy.name}_clear`)) rejectPrimitiveSurface(declaration, "C/C++ copied type name collides with another generated type");
			cTypeNames.add(copy.name); cTypeNames.add(`${copy.name}_clear`);
		}
		copies.set(key, copy);
		return copy;
	};
	for(const declaration of ir.declarations)
	{
		if(declaration.kind !== "function" || declaration.receiver || declaration.typeParameters.length
			|| declaration.resultMode !== "value" || declaration.effects.length
			|| ![...declaration.parameters, declaration.result].every(site => site.ownership === "copy"))
			rejectPrimitiveSurface(declaration, "ordinary C/C++ adapters require concrete, pure, copied parameters and results");
		for(const site of [...declaration.parameters, declaration.result]) visit(site.type, declaration);
	}
	const names = new Set([...copies.values()].filter(copy => copy.aggregate).flatMap(copy => [copy.name, `${copy.name}_clear`]));
	const functions = ir.declarations.map(declaration => {
		const surface = describeCFunction(ir, declaration);
		if(!safe(surface.prefix) || !safe(surface.field) || reserved.has(surface.field) || names.has(surface.name)
			|| ["lean_bridge_native", "leanshared"].includes(surface.prefix) || ir.component.id.length >= 160)
			rejectPrimitiveSurface(declaration, "C/C++ export name collides with a generated or reserved identifier");
		names.add(surface.name);
		const parameters = new Set(["context", "out", "error"]);
		for(const { name } of surface.parameters)
		{
			if(!safe(name) || parameters.has(name)) rejectPrimitiveSurface(declaration, `C/C++ parameter name is reserved or duplicated: ${name}`);
			parameters.add(name);
		}
		return { ...surface, declaration };
	});
	return { ...compileCProjectionModel(ir), prefix: functions[0].prefix, functions, copies: [...copies.values()], copy: ref => copies.get(typeKey(ref)) };
};
