/**
 * Admit source-named Python APIs backed by the shared copied-value C ABI.
 *
 * @file
 */
import { compilePrimitiveCSurface } from "../c/primitive-surface.mjs";

const reserved = new Set("False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case type list tuple str bytes bytearray int float bool object len range super property staticmethod classmethod isinstance getattr setattr dataclass abs ord chr sum min max enumerate callable BaseException Exception RuntimeError TypeError ValueError MemoryError ImportError LeanBridgeError LeanClosure invoke dispatch handle token".split(" "));
const primitive = { char: ["str", "c_uint32"], unit: ["None", "c_uint8"], bool: ["bool", "c_bool"], uint8: ["int", "c_uint8"], uint16: ["int", "c_uint16"], uint32: ["int", "c_uint32"], uint64: ["int", "c_uint64"], int8: ["int", "c_int8"], int16: ["int", "c_int16"], int32: ["int", "c_int32"], int64: ["int", "c_int64"], float32: ["float", "c_float"], float64: ["float", "c_double"], nat: ["int"], int: ["int"], string: ["str"], bytes: ["bytes"] };

/**
 * Validate exact distribution coordinates rather than normalize author choices.
 *
 * @param settings - Optional PyPI name and PEP 440 version.
 */
export const validateOrdinaryPythonSettings = (settings = {}) => {
	if(settings.name !== undefined && (settings.name.length > 100 || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(settings.name))) throw new TypeError("PyPI name must be a lowercase hyphen-separated coordinate of at most 100 characters");
	if(settings.version !== undefined && !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:(?:a|b|rc)(?:0|[1-9]\d*))?(?:\.post(?:0|[1-9]\d*))?(?:\.dev(?:0|[1-9]\d*))?(?:\+[a-z0-9]+(?:\.[a-z0-9]+)*)?$/.test(settings.version)) throw new TypeError("PyPI version must be an exact normalized three-part PEP 440 version");
	if(settings.version?.split("+")[1]?.split(".").some(part => /^0\d+$/.test(part))) throw new TypeError("PyPI local version numbers must not contain leading zeros");
};

/**
 * Derive typed functions, records and private ctypes descriptions.
 *
 * @param ir - Authoritative compiler-derived Binding IR.
 */
export const compileCopiedPythonModel = ir => {
	const surface = compilePrimitiveCSurface(ir, { callables: true }), packageDir = `lean_${surface.prefix}`;
	const fail = (declaration, message) => {
		const source = declaration?.source?.extensions?.["lean-lang.org/source-position"];
		throw Object.assign(new TypeError(`${source ? `${source.path}:${source.startLine}:${source.startColumn}: ` : ""}${declaration?.id ?? ir.component.id}: ${message}`), { code: "unsupported-python-signature", details: { declaration: declaration?.id ?? null, source: source ?? null } });
	};
	const names = new Set(reserved);
	for(const copy of surface.copies)
	{
		copy.ctype = copy.aggregate ? `_T${copy.index}` : `_c.${primitive[copy.scalarName][1]}`;
		if(copy.record)
		{
			copy.publicName = copy.record.name;
			if(names.has(copy.publicName)) fail(ir.declarations[0], `Python record name collides: ${copy.publicName}`);
			names.add(copy.publicName);
			for(const field of copy.fields) if(reserved.has(field.name)) fail(ir.declarations[0], `Python field name is reserved: ${field.name}`);
		}
		copy.publicType = copy.record ? copy.publicName : copy.element ? `tuple[${copy.element.publicType}, ...]` : primitive[copy.scalarName][0];
		copy.inputType = copy.element ? `_Array${copy.index}` : copy.publicType;
		copy.inputExpression = copy.element ? `tuple[${copy.element.inputType}, ...] | list[${copy.element.inputType}]` : null;
	}
	for(const [index, callback] of [...surface.callbacks.values()].entries())
	{
		const signature = callback.type.callable;
		callback.index = index;
		callback.ctype = `_B${index}`;
		callback.inputType = `_Callable[[${signature.parameters.map(site => surface.copy(site.type).inputType).join(", ")}], ${surface.copy(signature.result.type).publicType}]`;
		callback.publicType = `LeanClosure[[${signature.parameters.map(site => surface.copy(site.type).inputType).join(", ")}], ${surface.copy(signature.result.type).publicType}]`;
	}
	for(const fn of surface.functions)
	{
		if(names.has(fn.field)) fail(fn.declaration, `Python function name is reserved or duplicated: ${fn.field}`);
		names.add(fn.field);
		for(const parameter of fn.parameters) if(reserved.has(parameter.name)) fail(fn.declaration, `Python parameter name is reserved: ${parameter.name}`);
	}
	return { ir, surface, packageDir };
};
