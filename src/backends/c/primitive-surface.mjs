/**
 * Admit concrete copied primitives and share C spellings across native targets.
 *
 * @file
 */
import { compileCProjectionModel, describeCFunction } from "./generate.mjs";
import { componentScalarTypes } from "../../abi/component-scalars.mjs";

const keywords = new Set(("alignas alignof and and_eq asm atomic_cancel atomic_commit atomic_noexcept auto bitand bitor bool break case catch char char8_t char16_t char32_t class compl concept const consteval constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do double dynamic_cast else enum explicit export extern false float for friend goto if inline int long mutable namespace new noexcept not not_eq nullptr operator or or_eq private protected public register reinterpret_cast requires return short signed sizeof static static_assert static_cast struct switch template this thread_local throw true try typedef typeid typename union unsigned using virtual void volatile wchar_t while xor xor_eq restrict _Alignas _Alignof _Atomic _Bool _Complex _Generic _Imaginary _Noreturn _Static_assert _Thread_local").split(" "));
const safe = name => /^[a-z][a-z0-9_]*$/.test(name) && !name.includes("__") && !keywords.has(name);
const reserved = new Set(["initialize", "runtime", "runtime_v1", "runtime_install_v1", "ready", "fail", "attempted_runtime", "initialization_failure", "error", "error_code", "status", "string", "bytes", "nat", "int", "string_clear", "bytes_clear", "nat_clear", "int_clear", "detail"]);

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
	const primitive = site => site.type.kind === "primitive" && componentScalarTypes.includes(site.type.name);
	for(const declaration of ir.declarations)
	{
		if(declaration.kind !== "function" || declaration.receiver || declaration.typeParameters.length
			|| declaration.resultMode !== "value" || declaration.effects.length
			|| ![...declaration.parameters, declaration.result].every(site => primitive(site) && site.ownership === "copy"))
			rejectPrimitiveSurface(declaration, "ordinary C/C++ adapters currently require concrete, pure, copied primitive parameters and results");
	}
	const names = new Set();
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
	return { ...compileCProjectionModel(ir), prefix: functions[0].prefix, functions };
};
