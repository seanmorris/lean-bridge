/**
 * Admit concrete copied values and share C spellings across native targets.
 *
 * @file
 */
import { cIdentifier, compileCProjectionModel, describeCFunction, describeCType } from "./generate.mjs";
import { componentScalarTypes, fixedPlatformInteger } from "../../abi/component-scalars.mjs";

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
 * @param options - Fixed compiled Lean profile, independent of the consumer process.
 * @param options.wordBits - Lean machine-word width; native-library-v1 uses 64.
 * @param options.callables - Admit the synchronous primitive callable adapter for implemented host projections.
 * @param options.compounds - Admit options, results and binary products only for implemented host projections.
 * @param options.lists - Admit copied Lists only for implemented host projections.
 */
export const compilePrimitiveCSurface = (ir, { wordBits = 64, callables = false, compounds = false, lists = false } = {}) => {
	if(![32, 64].includes(wordBits)) throw new TypeError("Copied platform integers require a 32-bit or 64-bit compiled target");
	const copies = new Map(), visiting = new Set(), typeNames = new Set(reserved), cTypeNames = new Set();
	const callbacks = new Map();
	const callback = ref => ref.kind === "named" && ir.types.find(type => type.id === ref.id && type.kind === "callback");
	const representation = (ref, declaration, depth = 0) => {
		if(depth > 32) rejectPrimitiveSurface(declaration, "C/C++ copied values must be acyclic and at most 32 types deep");
		const definition = ref.kind === "named" && ir.types.find(type => type.id === ref.id);
		if(definition?.kind === "alias")
		{
			if(definition.typeParameters.length || definition.representation !== "copied" || definition.mutability !== "immutable")
				rejectPrimitiveSurface(declaration, "C/C++ aliases require concrete immutable copied targets");
			return representation(definition.target, declaration, depth + 1);
		}
		return ref.kind === "apply" ? { ...ref, arguments: ref.arguments.map(argument => representation(argument, declaration, depth + 1)) } : ref;
	};
	const visit = (ref, declaration, depth = 0) => {
		ref = representation(ref, declaration, depth);
		const key = typeKey(ref);
		if(depth > 32 || visiting.has(key)) rejectPrimitiveSurface(declaration, "C/C++ copied values must be acyclic and at most 32 types deep");
		if(copies.has(key)) return copies.get(key);
		visiting.add(key);
		let fields = [], element = null, record = null, compound = null;
		if(ref.kind === "primitive" && componentScalarTypes.includes(ref.name)) { /* Closed copied leaf. */ }
		else if(ref.kind === "apply" && (ref.constructor === "array" || lists && ref.constructor === "list") && ref.arguments.length === 1) element = visit(ref.arguments[0], declaration, depth + 1);
		else if(compounds && ref.kind === "apply" && ["option", "result", "tuple"].includes(ref.constructor) && ref.arguments.length === (ref.constructor === "option" ? 1 : 2))
		{
			compound = ref.constructor;
			fields = ref.arguments.map((argument, i) => ({ name: { option: ["value"], result: ["ok", "error"], tuple: ["fst", "snd"] }[compound][i], type: visit(argument, declaration, depth + 1) }));
		}
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
		} else rejectPrimitiveSurface(declaration, `this native projection requires concrete copied primitives, arrays or acyclic records${compounds ? ", options, results and binary products" : "; compound values are not implemented for this target"}`);
		visiting.delete(key);
		const copy = { ref, scalarName: fixedPlatformInteger(ref.name, wordBits), ...describeCType(ir, ref), fields, element, record, compound, index: copies.size };
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
		const hasCallback = callables && declaration.parameters.some(site => callback(site.type));
		if(declaration.kind !== "function" || declaration.receiver || declaration.typeParameters.length
			|| declaration.resultMode !== "value"
			|| [...declaration.effects].sort().join(",") !== (hasCallback ? "fails,host-call" : ""))
			rejectPrimitiveSurface(declaration, "ordinary C/C++ adapters require concrete, pure, copied parameters and results");
		if(hasCallback && (declaration.failure.mode !== "declared" || declaration.failure.errors.join(",") !== "error:native-callback"
			|| declaration.failure.unexpected !== "poison-runtime")) rejectPrimitiveSurface(declaration, "C callbacks require the native callback failure policy");
		for(const site of [...declaration.parameters, declaration.result])
		{
			const type = callables && callback(site.type);
			if(!type)
			{
				if(site.ownership !== "copy") rejectPrimitiveSurface(declaration, "C/C++ copied values require copy ownership");
				visit(site.type, declaration); continue;
			}
			const result = site === declaration.result, callable = type.callable;
			if(site.ownership !== (result ? "lease" : "borrow") || site.lifetime?.scope !== (result ? "explicit" : "call")
				|| site.lifetime.anchor !== null || callable.resultMode !== "value"
				|| callable.invocation !== "many" || callable.reentry !== "same-agent" || callable.selfDisposal !== "defer"
				|| !callable.parameters.length || callable.parameters.length > 16
				|| [...callable.effects].sort().join(",") !== "fails,host-call"
				|| callable.failure.mode !== "declared" || callable.failure.errors.join(",") !== "error:native-callback"
				|| callable.failure.unexpected !== "poison-runtime")
				rejectPrimitiveSurface(declaration, "C callbacks require synchronous primitive signatures, call borrows and explicit closure leases");
			for(const value of [...callable.parameters, callable.result])
			{
				if(value.type.kind !== "primitive" || value.ownership !== "copy" || value.lifetime !== null)
					rejectPrimitiveSurface(declaration, "C callbacks currently require copied primitive parameters and results");
				visit(value.type, declaration);
			}
			const parameterNames = new Set(["context", "self", "out", "error"]);
			for(const parameter of callable.parameters)
			{
				const name = cIdentifier(parameter.name);
				if(!safe(name) || parameterNames.has(name) || parameter.optional || parameter.default !== null || parameter.mutability !== "immutable")
					rejectPrimitiveSurface(declaration, "C callback parameters require distinct, non-reserved names and immutable required values");
				parameterNames.add(name);
			}
			callbacks.set(type.id, { ...describeCType(ir, site.type), field: cIdentifier(type.name), type });
		}
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
	return { ...compileCProjectionModel(ir), prefix: functions[0].prefix, functions, callbacks, copies: [...copies.values()], copy: ref => copies.get(typeKey(representation(ref))) };
};
