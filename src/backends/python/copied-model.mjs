/**
 * Admit source-named Python APIs backed by the shared copied-value C ABI.
 *
 * @file
 */
import { compilePrimitiveCSurface } from "../c/primitive-surface.mjs";

const reserved = new Set("False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case type list tuple str bytes bytearray int float bool object len range super property staticmethod classmethod isinstance getattr setattr dataclass abs ord chr sum min max enumerate callable BaseException Exception RuntimeError TypeError ValueError MemoryError ImportError LeanBridgeError LeanClosure Some Option Ok Err Result invoke dispatch handle token".split(" "));
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
	const surface = compilePrimitiveCSurface(ir, { callables: true, compounds: true, lists: true, variants: true }), packageDir = `lean_${surface.prefix}`;
	const fail = (declaration, message) => {
		const source = declaration?.source?.extensions?.["lean-lang.org/source-position"];
		throw Object.assign(new TypeError(`${source ? `${source.path}:${source.startLine}:${source.startColumn}: ` : ""}${declaration?.id ?? ir.component.id}: ${message}`), { code: "unsupported-python-signature", details: { declaration: declaration?.id ?? null, source: source ?? null } });
	};
	const names = new Set(reserved);
	for(const copy of surface.copies)
	{
		copy.ctype = copy.aggregate ? `_T${copy.index}` : `_c.${primitive[copy.scalarName][1]}`;
		if(copy.record || copy.variant)
		{
			copy.publicName = (copy.record || copy.variant).name;
			if(names.has(copy.publicName)) fail(ir.declarations[0], `Python ${copy.variant ? "variant" : "record"} name collides: ${copy.publicName}`);
			names.add(copy.publicName);
			const members = new Set();
			for(const field of copy.fields)
			{
				field.publicName = reserved.has(field.name) ? `${field.name}_` : field.name;
				if(members.has(field.publicName)) fail(ir.declarations[0], `Python record field name collides: ${field.publicName}`);
				members.add(field.publicName);
			}
		}
		if(copy.variant)
		{
			for(const branch of copy.cases)
			{
				branch.publicName = copy.publicName + branch.name.split("_").map(part => part ? part[0].toUpperCase() + part.slice(1) : "_").join("");
				if(names.has(branch.publicName)) fail(ir.declarations[0], `Python constructor name collides: ${branch.publicName}`);
				names.add(branch.publicName);
				const members = new Set();
				for(const field of branch.fields)
				{
					field.publicName = reserved.has(field.name) || field.name === "kind" ? `${field.name}_` : field.name;
					if(members.has(field.publicName)) fail(ir.declarations[0], `Python variant field name collides: ${field.publicName}`);
					members.add(field.publicName);
				}
			}
		}
		const compoundType = field => copy.compound === "option" ? `Option[${copy.fields[0].type[field]}]`
			: `${copy.compound === "result" ? "Result" : "tuple"}[${copy.fields.map(child => child.type[field]).join(", ")}]`;
		copy.publicType = copy.record || copy.variant ? copy.publicName : copy.compound ? compoundType("publicType") : copy.element ? `tuple[${copy.element.publicType}, ...]` : primitive[copy.scalarName][0];
		copy.publicTypeCost = copy.record ? 1 : copy.variant ? copy.cases.length + 1
			: copy.compound ? 4 + copy.fields.reduce((sum, field) => sum + field.type.publicTypeCost, 0)
				: copy.element ? 2 + copy.element.publicTypeCost : 1;
		const publicExpression = copy.publicType;
		if(copy.publicTypeCost > 128 && !copy.record && !copy.variant)
		{
			copy.publicExpression = publicExpression;
			copy.publicType = `_Value${copy.index}`;
			copy.publicTypeCost = 1;
		}
		const inputExpression = copy.compound ? compoundType("inputType") : copy.element
			? `tuple[${copy.element.inputType}, ...] | list[${copy.element.inputType}]` : copy.publicType;
		copy.inputTypeCost = copy.compound ? 4 + copy.fields.reduce((sum, field) => sum + field.type.inputTypeCost, 0)
			: copy.element ? 4 + 2 * copy.element.inputTypeCost : copy.publicTypeCost;
		copy.inputExpression = copy.element ? inputExpression : null;
		copy.inputType = copy.element ? `_Array${copy.index}` : inputExpression;
		if(copy.publicExpression && inputExpression === publicExpression)
		{
			copy.inputType = copy.publicType;
			copy.inputTypeCost = 1;
		} else if(copy.inputTypeCost > 128 && !copy.record && !copy.variant)
		{
			copy.inputExpression = inputExpression;
			copy.inputType = copy.element ? `_Array${copy.index}` : `_Input${copy.index}`;
			copy.inputTypeCost = 1;
			copy.inputTypeAlias = true;
		}
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
	for(const alias of surface.aliases)
	{
		if(names.has(alias.definition.name)) fail(ir.declarations[0], `Python alias name collides: ${alias.definition.name}`);
		names.add(alias.definition.name);
	}
	return { ir, surface, packageDir, requiresTypeAliases: surface.copies.some(copy => copy.publicExpression || copy.inputTypeAlias) };
};
