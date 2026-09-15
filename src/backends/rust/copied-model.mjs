/**
 * Admit concrete copied Rust APIs from the shared native semantic model.
 *
 * @file
 */
import { compilePrimitiveCSurface } from "../c/primitive-surface.mjs";

const reserved = new Set("dispatch invoke handle token __runtime std num_bigint sha2 as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while abstract become box do final gen macro override priv typeof unsized virtual yield try union Error Result Ok Err Vec String BigUint BigInt Sign Option Some None Drop Copy Clone Send Sync Default".split(" "));
const scalars = { unit: "()", bool: "bool", uint8: "u8", uint16: "u16", uint32: "u32", uint64: "u64", int8: "i8", int16: "i16", int32: "i32", int64: "i64", float32: "f32", float64: "f64", string: "String", bytes: "Vec<u8>", nat: "BigUint", int: "BigInt" };
const privateTypes = new Set("Native NativeError Scope Owner Output OnceLock AtomicU32 Ordering assets u8 u16 u32 u64 u128 i8 i16 i32 i64 i128 f32 f64 str usize isize char".split(" "));

/**
 * Validate canonical Cargo coordinates without silently renaming them.
 *
 * @param settings - Optional Cargo name and version.
 */
export const validateOrdinaryCargoSettings = (settings = {}) => {
	if(settings.name !== undefined && (settings.name.length > 64 || !/^[a-z][a-z0-9]*(?:[-_][a-z0-9]+)*$/.test(settings.name) || reserved.has(settings.name.replaceAll("-", "_")))) throw new TypeError("Cargo name must be a lowercase crate coordinate of at most 64 characters");
	if(settings.version !== undefined && (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(settings.version) || settings.version.length > 100 || settings.version.split("+")[0].split("-").slice(1).join("-").split(".").some(part => /^0\d+$/.test(part)))) throw new TypeError("Cargo version must be an exact canonical semantic version");
};

/**
 * Derive public value types and private C-compatible layouts.
 *
 * @param ir - Compiler-derived Binding IR.
 */
export const compileCopiedRustModel = ir => {
	const surface = compilePrimitiveCSurface(ir), names = new Set(reserved);
	const fail = (declaration, message) => {
		const source = declaration.source?.extensions?.["lean-lang.org/source-position"];
		throw Object.assign(new TypeError(`${source ? `${source.path}:${source.startLine}:${source.startColumn}: ` : ""}${declaration.id}: ${message}`), { code: "unsupported-rust-signature", details: { declaration: declaration.id, source: source ?? null } });
	};
	for(const copy of surface.copies)
	{
		if(copy.record)
		{
			copy.publicName = copy.record.name;
			if(names.has(copy.publicName) || privateTypes.has(copy.publicName) || /^T\d+$/.test(copy.publicName)) fail(ir.declarations[0], `Rust record name collides: ${copy.publicName}`);
			names.add(copy.publicName);
			for(const field of copy.fields) if(reserved.has(field.name)) fail(ir.declarations[0], `Rust field is reserved: ${field.name}`);
		}
		copy.publicType = copy.record ? copy.publicName : copy.element ? `Vec<${copy.element.publicType}>` : scalars[copy.ref.name];
		copy.ctype = copy.aggregate ? `T${copy.index}` : copy.ref.name === "unit" ? "u8" : copy.publicType;
		copy.inputType = copy.ref.name === "string" ? "&str" : copy.ref.name === "bytes" ? "&[u8]" : copy.element ? `&[${copy.element.publicType}]` : copy.aggregate ? `&${copy.publicType}` : copy.publicType;
	}
	for(const fn of surface.functions)
	{
		if(names.has(fn.field)) fail(fn.declaration, `Rust function name collides: ${fn.field}`);
		names.add(fn.field);
		for(const parameter of fn.parameters) if(reserved.has(parameter.name)) fail(fn.declaration, `Rust parameter is reserved: ${parameter.name}`);
	}
	return { ir, surface, hasBigints: surface.copies.some(copy => ["nat", "int"].includes(copy.ref.name)) };
};
