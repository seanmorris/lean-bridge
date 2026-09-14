/**
 * Admit ordinary Ruby APIs and compute the copied Linux C layouts.
 *
 * @file
 */
import { compilePrimitiveCSurface } from "../c/primitive-surface.mjs";

const pascal = name => name.split("_").map(part => part[0].toUpperCase() + part.slice(1)).join("");
const reserved = new Set(("Native Unit UNIT LeanBridgeError Object String Array Integer Float Fiddle Gem File Digest Thread Mutex Ractor Encoding RangeError TypeError StandardError Exception Kernel Struct Module Class nil true false self super class module def end begin rescue ensure return yield alias and or not if unless while until case when then else elsif for in do break next redo retry undef defined initialize new send public_send method_missing object_id class freeze frozen hash eql equal dup clone tap then inspect to_s respond_to const_get const_set module_function private_constant").split(" "));
const types = { unit: ["CHAR", "C", 1], bool: ["CHAR", "C", 1], uint8: ["CHAR", "C", 1], uint16: ["SHORT", "S<", 2], uint32: ["INT", "L<", 4], uint64: ["LONG_LONG", "Q<", 8], int8: ["CHAR", "c", 1], int16: ["SHORT", "s<", 2], int32: ["INT", "l<", 4], int64: ["LONG_LONG", "q<", 8], float32: ["FLOAT", "e", 4], float64: ["DOUBLE", "E", 8] };
for(const name of ["Scope", "EncodingError", "NoMemoryError", "LoadError", "NativeCopiedRuntimeV1", "RUBY_ENGINE", "RUBY_VERSION", "RUBY_PLATFORM"]) reserved.add(name);
const align = (size, boundary) => Math.ceil(size / boundary) * boundary;

/**
 * Derive source-named Ruby functions, records and private C field offsets.
 *
 * @param ir - Compiler-authorized Binding IR.
 */
export const compileCopiedRubyModel = ir => {
	const surface = compilePrimitiveCSurface(ir), componentName = pascal(surface.prefix);
	const fail = (declaration, message) => {
		const source = declaration?.source?.extensions?.["lean-lang.org/source-position"];
		throw Object.assign(new TypeError(`${source ? `${source.path}:${source.startLine}:${source.startColumn}: ` : ""}${declaration?.id ?? ir.component.id}: ${message}`), { code: "unsupported-ruby-signature", details: { declaration: declaration?.id ?? null, source: source ?? null } });
	};
	if(reserved.has(componentName)) fail(ir.declarations[0], "Ruby component name collides with a generated constant");
	const names = new Set([...reserved, componentName]);
	for(const copy of surface.copies)
	{
		copy.ffi = copy.aggregate ? "VOIDP" : types[copy.ref.name][0];
		copy.pack = copy.aggregate ? null : types[copy.ref.name][1];
		if(copy.record)
		{
			copy.publicName = pascal(copy.record.name);
			if(names.has(copy.publicName)) fail(ir.declarations[0], `Ruby record name collides: ${copy.publicName}`);
			names.add(copy.publicName);
			let size = 0, alignment = 1;
			for(const field of copy.fields)
			{
				if(reserved.has(field.name)) fail(ir.declarations[0], `Ruby record field name collides: ${field.name}`);
				field.offset = align(size, field.type.alignment);
				size = field.offset + field.type.size; alignment = Math.max(alignment, field.type.alignment);
			}
			copy.alignment = alignment; copy.size = Math.max(1, align(size, alignment));
		} else
		{
			copy.alignment = copy.aggregate ? 8 : types[copy.ref.name][2];
			copy.size = copy.aggregate ? copy.ref.name === "int" ? 40 : 32 : copy.alignment;
		}
	}
	for(const fn of surface.functions)
		if(reserved.has(fn.field)) fail(fn.declaration, `Ruby function name collides: ${fn.field}`);
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
