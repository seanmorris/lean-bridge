/**
 * Admit ordinary Ruby APIs and compute the copied Linux C layouts.
 *
 * @file
 */
import { compilePrimitiveCSurface } from "../c/primitive-surface.mjs";

const pascal = name => name.split("_").map(part => part[0].toUpperCase() + part.slice(1)).join("");
const variantName = name => name.split("_").filter(Boolean).map(part => part[0].toUpperCase() + part.slice(1)).join("") + (name.match(/_+$/)?.[0] ?? "");
const reserved = new Set(("Native Unit UNIT LeanBridgeError Object String Array Integer Float Fiddle Gem File Digest Thread Mutex Ractor Encoding RangeError TypeError StandardError Exception Kernel Struct Module Class nil true false self super class module def end begin rescue ensure return yield alias and or not if unless while until case when then else elsif for in do break next redo retry undef defined initialize new send public_send method_missing object_id class freeze frozen hash eql equal dup clone tap then inspect to_s respond_to const_get const_set module_function private_constant").split(" "));
const types = { char: ["INT", "L<", 4], unit: ["CHAR", "C", 1], bool: ["CHAR", "C", 1], uint8: ["CHAR", "C", 1], uint16: ["SHORT", "S<", 2], uint32: ["INT", "L<", 4], uint64: ["LONG_LONG", "Q<", 8], int8: ["CHAR", "c", 1], int16: ["SHORT", "s<", 2], int32: ["INT", "l<", 4], int64: ["LONG_LONG", "q<", 8], float32: ["FLOAT", "e", 4], float64: ["DOUBLE", "E", 8] };
for(const name of ["Scope", "Lease", "LeanClosure", "Monitor", "Process", "ObjectSpace", "ArgumentError", "LocalJumpError", "EncodingError", "NoMemoryError", "LoadError", "NativeCopiedRuntimeV1", "RUBY_ENGINE", "RUBY_VERSION", "RUBY_PLATFORM", "raise"]) reserved.add(name);
const align = (size, boundary) => Math.ceil(size / boundary) * boundary;

/**
 * Derive source-named Ruby functions, records and private C field offsets.
 *
 * @param ir - Compiler-authorized Binding IR.
 */
export const compileCopiedRubyModel = ir => {
	const surface = compilePrimitiveCSurface(ir, { callables: true, structuredCallables: true, compounds: true, lists: true, variants: true }), componentName = pascal(surface.prefix);
	const fail = (declaration, message) => {
		const source = declaration?.source?.extensions?.["lean-lang.org/source-position"];
		throw Object.assign(new TypeError(`${source ? `${source.path}:${source.startLine}:${source.startColumn}: ` : ""}${declaration?.id ?? ir.component.id}: ${message}`), { code: "unsupported-ruby-signature", details: { declaration: declaration?.id ?? null, source: source ?? null } });
	};
	if(reserved.has(componentName)) fail(ir.declarations[0], "Ruby component name collides with a generated constant");
	const compounds = [...surface.copies.some(copy => copy.compound === "option") ? ["Some"] : []
		, ...surface.copies.some(copy => copy.compound === "result") ? ["Ok", "Err"] : []];
	if(compounds.includes(componentName)) fail(ir.declarations[0], "Ruby component name collides with a compound constructor");
	const names = new Set([...reserved, componentName, ...compounds]);
	for(const copy of surface.copies)
	{
		copy.ffi = copy.aggregate ? "VOIDP" : types[copy.scalarName][0];
		copy.pack = copy.aggregate ? null : types[copy.scalarName][1];
		if(copy.variant)
		{
			copy.publicName = variantName(copy.variant.name);
			if(!/^[A-Z][A-Za-z0-9_]*$/.test(copy.publicName) || names.has(copy.publicName)) fail(ir.declarations[0], `Ruby variant name collides or is invalid: ${copy.publicName}`);
			names.add(copy.publicName);
			const constructors = new Set(); let payloadSize = 1, payloadAlignment = 1;
			for(const [index, branch] of copy.cases.entries())
			{
				const name = variantName(copy.variant.cases[index].name);
				if(!/^[A-Z][A-Za-z0-9_]*$/.test(name) || constructors.has(name)) fail(ir.declarations[0], `Ruby constructor name collides or is invalid: ${name}`);
				constructors.add(name); branch.publicName = `${copy.publicName}::${name}`;
				let size = 0, alignment = 1;
				for(const field of branch.fields)
				{
					if(reserved.has(field.name) || ["deconstruct", "deconstruct_keys"].includes(field.name)) fail(ir.declarations[0], `Ruby variant field name collides: ${field.name}`);
					field.offset = align(size, field.type.alignment);
					size = field.offset + field.type.size; alignment = Math.max(alignment, field.type.alignment);
				}
				branch.alignment = alignment; branch.size = Math.max(1, align(size, alignment));
				payloadSize = Math.max(payloadSize, branch.size); payloadAlignment = Math.max(payloadAlignment, alignment);
			}
			copy.payloadOffset = align(4, payloadAlignment);
			copy.alignment = Math.max(4, payloadAlignment);
			copy.size = align(copy.payloadOffset + align(payloadSize, payloadAlignment), copy.alignment);
		} else if(copy.record || copy.compound)
		{
			if(copy.record)
			{
				copy.publicName = pascal(copy.record.name);
				if(names.has(copy.publicName)) fail(ir.declarations[0], `Ruby record name collides: ${copy.publicName}`);
				names.add(copy.publicName);
			}
			let size = copy.compound && copy.compound !== "tuple" ? 1 : 0, alignment = 1;
			for(const field of copy.fields)
			{
				if(reserved.has(field.name) || ["deconstruct", "deconstruct_keys"].includes(field.name)) fail(ir.declarations[0], `Ruby record field name collides: ${field.name}`);
				field.offset = align(size, field.type.alignment);
				size = field.offset + field.type.size; alignment = Math.max(alignment, field.type.alignment);
			}
			copy.alignment = alignment; copy.size = Math.max(1, align(size, alignment));
		} else
		{
			copy.alignment = copy.aggregate ? 8 : types[copy.scalarName][2];
			copy.size = copy.aggregate ? copy.scalarName === "int" ? 40 : 32 : copy.alignment;
		}
	}
	for(const [index, value] of [...surface.callbacks.values()].entries()) Object.assign(value, { index, ffi: "VOIDP", size: 8 });
	for(const fn of surface.functions)
		// Ruby permits qualified methods such as Enumerator#next. Keep keyword
		// record fields rejected because their initializer uses local variables.
		if(reserved.has(fn.field) && fn.field !== "next") fail(fn.declaration, `Ruby function name collides: ${fn.field}`);
	return { ir, surface, componentName, namespace: `LeanBridge::${componentName}`, requirePath: `lean_bridge/${surface.prefix}` };
};

/**
 * Require exact RubyGems coordinates without silent version normalization.
 *
 * @param settings - Optional gem name and version.
 */
export const validateOrdinaryRubySettings = (settings = {}) => {
	if(settings.name !== undefined && (settings.name.length > 100 || !/^[a-z][a-z0-9]*(?:[-_][a-z0-9]+)*$/.test(settings.name))) throw new TypeError("RubyGems name must be a lowercase gem coordinate of at most 100 characters");
	if(settings.version !== undefined && !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\.[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)*)?$/.test(settings.version)) throw new TypeError("RubyGems version must be an exact three-part version with an optional dot-separated prerelease");
};
