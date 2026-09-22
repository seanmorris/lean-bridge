/**
 * Admit copied JVM APIs and calculate the Linux x86-64 C value layouts.
 *
 * @file
 */
import { compilePrimitiveCSurface } from "../c/primitive-surface.mjs";

const pascal = name => name.split(/[^A-Za-z0-9]+/).filter(Boolean).map(part => part[0].toUpperCase() + part.slice(1)).join("");
const camel = name => { const value = pascal(name); return value[0].toLowerCase() + value.slice(1); };
const reserved = new Set(("Api Unit Runtime NativeAssets Scope LeanBridgeException Object String System Class Record Throwable Error Exception RuntimeException IllegalArgumentException IllegalStateException ExceptionInInitializerError UnsupportedOperationException NullPointerException AssertionError BigInteger Objects Arrays Math Byte Short Integer Long Float Double Character Boolean MemorySegment Arena Linker FunctionDescriptor SymbolLookup MethodHandle ByteBuffer CharBuffer StandardCharsets CodingErrorAction CharacterCodingException IOException InputStream OutputStream Files Path MessageDigest HexFormat PosixFilePermissions Properties equals hashCode toString getClass clone finalize notify notifyAll wait").split(" "));
const keywords = new Set(("abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null record sealed permits var yield").split(" "));
const fieldName = name => {
	const result = camel(name) + (name.match(/_+$/)?.[0] ?? "");
	return keywords.has(result) ? `${result}_` : result;
};
const publicTypes = { char: "int", unit: "Unit", bool: "boolean", uint8: "int", uint16: "int", uint32: "long", uint64: "java.math.BigInteger", int8: "byte", int16: "short", int32: "int", int64: "long", nat: "java.math.BigInteger", int: "java.math.BigInteger", float32: "float", float64: "double", string: "String", bytes: "byte[]" };
const nativeTypes = { char: "int", unit: "byte", bool: "byte", uint8: "byte", uint16: "short", uint32: "int", uint64: "long", int8: "byte", int16: "short", int32: "int", int64: "long", float32: "float", float64: "double" };
const widths = { byte: 1, short: 2, int: 4, long: 8, float: 4, double: 8 };
const align = (size, boundary) => Math.ceil(size / boundary) * boundary;

/**
 * Validate copied source types and calculate their Java names and C layouts.
 *
 * @param ir - Compiler-authorized Binding IR.
 */
export const compileCopiedJvmModel = ir => {
	const surface = compilePrimitiveCSurface(ir, { callables: true, compounds: true, lists: true, variants: true });
	const fail = (declaration, message) => {
		const source = declaration?.source?.extensions?.["lean-lang.org/source-position"];
		throw Object.assign(new TypeError(`${source ? `${source.path}:${source.startLine}:${source.startColumn}: ` : ""}${declaration?.id ?? ir.component.id}: ${message}`), { code: "unsupported-jvm-signature", details: { declaration: declaration?.id ?? null, source: source ?? null } });
	};
	if(keywords.has(surface.prefix)) fail(ir.declarations[0], "Java package name is a reserved word");
	const names = new Set(reserved);
	if(surface.copies.some(copy => copy.compound)) for(const name of ["Option", "Result", "Pair"]) names.add(name);
	for(const copy of surface.copies)
	{
		copy.nativeType = copy.aggregate ? "MemorySegment" : nativeTypes[copy.scalarName];
		copy.layout = copy.aggregate ? "ADDRESS" : `JAVA_${copy.nativeType.toUpperCase()}`;
		if(copy.variant)
		{
			copy.publicName = pascal(copy.variant.name);
			if(names.has(copy.publicName)) fail(ir.declarations[0], `Java variant name collides: ${copy.publicName}`);
			names.add(copy.publicName);
			let payloadSize = 1, payloadAlignment = 1;
			for(const [index, branch] of copy.cases.entries())
			{
				const source = copy.variant.cases[index];
				branch.publicName = copy.publicName + pascal(source.name) + (source.name.match(/_+$/)?.[0] ?? "");
				if(names.has(branch.publicName)) fail(ir.declarations[0], `Java constructor name collides: ${branch.publicName}`);
				names.add(branch.publicName);
				const fields = new Set(); let size = 0, alignment = 1;
				for(const [i, field] of branch.fields.entries())
				{
					const name = source.fields[i].name;
					field.publicName = fieldName(name);
					if(fields.has(field.publicName) || reserved.has(field.publicName)) fail(ir.declarations[0], `Java variant field name collides: ${field.publicName}`);
					fields.add(field.publicName);
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
				if(names.has(copy.publicName)) fail(ir.declarations[0], `Java record name collides: ${copy.publicName}`);
				names.add(copy.publicName);
			}
			const fields = new Set();
			let size = copy.compound && copy.compound !== "tuple" ? 1 : 0, alignment = 1;
			for(const [index, field] of copy.fields.entries())
			{
				field.publicName = fieldName(copy.record ? copy.record.fields[index].name : field.name);
				if(fields.has(field.publicName) || reserved.has(field.publicName)) fail(ir.declarations[0], `Java field name collides: ${field.publicName}`);
				fields.add(field.publicName);
				field.offset = align(size, field.type.alignment);
				size = field.offset + field.type.size; alignment = Math.max(alignment, field.type.alignment);
			}
			copy.alignment = alignment; copy.size = Math.max(1, align(size, alignment));
		} else
		{
			copy.alignment = copy.aggregate ? 8 : widths[copy.nativeType];
			copy.size = copy.aggregate ? copy.scalarName === "int" ? 40 : 32 : copy.alignment;
		}
	}
	const functionNames = new Set();
	for(const fn of surface.functions)
	{
		fn.publicName = camel(fn.field);
		if(functionNames.has(fn.publicName) || reserved.has(fn.publicName) || keywords.has(fn.publicName)) fail(fn.declaration, `Java function name collides: ${fn.publicName}`);
		functionNames.add(fn.publicName);
	}
	const primitiveName = name => ({ uint8: "UInt8", uint16: "UInt16", uint32: "UInt32", uint64: "UInt64", usize: "USize", isize: "ISize" })[name] ?? pascal(name);
	for(const [index, callback] of [...surface.callbacks.values()].entries())
	{
		callback.index = index;
		const signature = callback.type.callable;
		callback.publicName = `Fn${signature.parameters.map(site => primitiveName(site.type.name)).join("")}To${primitiveName(signature.result.type.name)}`;
		if(names.has(callback.publicName)) fail(ir.declarations[0], `Java callable name collides: ${callback.publicName}`);
		names.add(callback.publicName);
		Object.assign(callback, { nativeType: "MemorySegment", layout: "ADDRESS", size: 8, alignment: 8 });
	}
	const wrapper = copy => ({ option: "Option", result: "Result", tuple: "Pair" })[copy.compound];
	const boxed = type => ({ boolean: "Boolean", byte: "Byte", short: "Short", int: "Integer", long: "Long", float: "Float", double: "Double" })[type] ?? type;
	const publicType = copy => copy.type?.callable ? copy.publicName : copy.record || copy.variant ? copy.publicName
		: copy.compound ? `${wrapper(copy)}<${copy.fields.map(field => boxed(publicType(field.type))).join(", ")}>`
			: copy.element ? `${publicType(copy.element)}[]` : publicTypes[copy.scalarName];
	const erasedType = copy => copy.compound ? wrapper(copy) : copy.element ? `${erasedType(copy.element)}[]` : publicType(copy);
	return { ir, surface, namespace: `org.leanbridge.${surface.prefix}`, publicType, erasedType };
};

/**
 * Reject unsafe coordinates and mutable version selectors.
 *
 * @param settings - Optional groupId:artifactId and exact release version.
 */
export const validateOrdinaryMavenSettings = (settings = {}) => {
	if(settings.name !== undefined && (settings.name.length > 200 || !/^[a-z][a-z0-9]*(?:[.][a-z][a-z0-9]*)*:[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/.test(settings.name))) throw new TypeError("Maven name must be a lowercase groupId:artifactId coordinate");
	if(settings.version !== undefined && (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[A-Za-z0-9]+(?:[.-][A-Za-z0-9]+)*)?$/.test(settings.version) || /snapshot/i.test(settings.version))) throw new TypeError("Maven version must be an exact three-part non-SNAPSHOT release");
};
