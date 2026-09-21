/**
 * Admit ordinary copied-value APIs and define their C# projection.
 *
 * @file
 */
import { compilePrimitiveCSurface } from "../c/primitive-surface.mjs";

const pascal = name => name.split(/[^A-Za-z0-9]+/).filter(Boolean).map(part => part[0].toUpperCase() + part.slice(1)).join("");
const reserved = new Set(["Api", "Unit", "LeanBridgeException", "LeanClosure", "Interop", "Equals", "GetHashCode", "GetType", "ToString", "ReferenceEquals", "Clone", "EqualityContract", "PrintMembers", "Deconstruct"]);
const runtimeNames = new Set(("Scope Native Runtime NativeError ArgumentException ArgumentNullException ArgumentOutOfRangeException InvalidOperationException OutOfMemoryException PlatformNotSupportedException DllNotFoundException IDisposable StructLayout LayoutKind DllImport CallingConvention UTF8Encoding Span ReadOnlySpan IntPtr NativeMemory NativeLibrary RuntimeInformation Architecture OperatingSystem BitConverter AppDomain Tuple File Path Convert StringComparison").split(" "));
const scalar = { char: "global::System.Text.Rune", unit: "Unit", bool: "bool", uint8: "byte", uint16: "ushort", uint32: "uint", uint64: "ulong", int8: "sbyte", int16: "short", int32: "int", int64: "long", float32: "float", float64: "double", string: "string", bytes: "byte[]", nat: "global::System.Numerics.BigInteger", int: "global::System.Numerics.BigInteger" };

/**
 * Build a closed projection over the checked native C surface.
 *
 * @param ir - Compiler-authorized Binding IR.
 */
export const compileCopiedDotnetModel = ir => {
	const surface = compilePrimitiveCSurface(ir, { callables: true, compounds: true, lists: true, variants: true }), componentName = pascal(surface.prefix);
	const fail = (declaration, message) => {
		const source = declaration?.source?.extensions?.["lean-lang.org/source-position"];
		throw Object.assign(new TypeError(`${source ? `${source.path}:${source.startLine}:${source.startColumn}: ` : ""}${declaration?.id ?? ir.component.id}: ${message}`), { code: "unsupported-dotnet-signature", details: { declaration: declaration?.id ?? null, source: source ?? null } });
	};
	if(!/^[A-Za-z][A-Za-z0-9]*$/.test(componentName) || reserved.has(componentName)) fail(null, "Component name collides with the generated C# namespace");
	const names = new Set(reserved);
	if(surface.copies.some(copy => copy.compound)) for(const name of ["Option", "Result"]) names.add(name);
	for(const copy of surface.copies.filter(copy => copy.record || copy.variant))
	{
		copy.publicName = pascal((copy.record || copy.variant).name);
		if(names.has(copy.publicName) || runtimeNames.has(copy.publicName) || /^(?:(?:N|B|V|Callback)\d+|C\d+_?\d+)$/.test(copy.publicName) || ["CallbackFrame", "ClosureLease", "ActiveCall", "ProcessGuard", "Marshal", "Exception", "Math"].includes(copy.publicName)) fail(ir.declarations[0], `C# ${copy.variant ? "variant" : "record"} name collides with a generated identifier: ${copy.publicName}`);
		names.add(copy.publicName);
		const fields = new Set([...reserved, copy.publicName]);
		for(const field of copy.fields)
		{
			field.publicName = pascal(field.name);
			if(fields.has(field.publicName)) fail(ir.declarations[0], `C# record field name collides: ${field.publicName}`);
			fields.add(field.publicName);
		}
		if(copy.variant)
			for(const [index, branch] of copy.cases.entries())
			{
				const source = copy.variant.cases[index];
				branch.publicName = copy.publicName + pascal(source.name) + (source.name.match(/_+$/)?.[0] ?? "");
				if(names.has(branch.publicName) || runtimeNames.has(branch.publicName)) fail(ir.declarations[0], `C# constructor name collides: ${branch.publicName}`);
				names.add(branch.publicName);
				const members = new Set(["Equals", "GetHashCode", "GetType", "ToString", "ReferenceEquals", "MemberwiseClone", "Clone", "EqualityContract", "PrintMembers", "Deconstruct", branch.publicName]);
				for(const [i, field] of branch.fields.entries())
				{
					field.publicName = pascal(source.fields[i].name) + (source.fields[i].name.match(/_+$/)?.[0] ?? "");
					if(members.has(field.publicName)) fail(ir.declarations[0], `C# variant field name collides: ${field.publicName}`);
					members.add(field.publicName);
				}
			}
	}
	const functionNames = new Set(reserved);
	for(const fn of surface.functions)
	{
		fn.publicName = pascal(fn.field);
		if(functionNames.has(fn.publicName)) fail(fn.declaration, `C# function name collides: ${fn.publicName}`);
		functionNames.add(fn.publicName);
	}
	const publicType = copy => copy.type?.callable ? copy.delegateType : copy.record || copy.variant ? copy.publicName
		: copy.compound ? copy.compound === "tuple" ? `(${copy.fields.map(field => publicType(field.type)).join(", ")})`
			: `${copy.compound === "option" ? "Option" : "Result"}<${copy.fields.map(field => publicType(field.type)).join(", ")}>`
			: copy.element ? `${publicType(copy.element)}[]` : scalar[copy.scalarName];
	const nativeType = copy => copy.type?.callable ? `B${copy.index}` : copy.aggregate ? `N${copy.index}` : ["unit", "bool"].includes(copy.scalarName) ? "byte" : copy.scalarName === "char" ? "uint" : scalar[copy.scalarName];
	for(const [index, callback] of [...surface.callbacks.values()].entries())
	{
		callback.index = index;
		const signature = callback.type.callable, result = surface.copy(signature.result.type);
		const types = signature.parameters.map(site => publicType(surface.copy(site.type)));
		callback.delegateType = result.scalarName === "unit" ? `global::System.Action<${types.join(", ")}>` : `global::System.Func<${[...types, publicType(result)].join(", ")}>`;
	}
	return { ir, surface, componentName, namespace: `LeanBridge.${componentName}`, assembly: `LeanBridge.${componentName}`, publicType, nativeType };
};

/**
 * Validate exact NuGet coordinates before invoking any compiler.
 *
 * @param settings - Optional package name and version.
 */
export const validateOrdinaryNugetSettings = (settings = {}) => {
	if(settings.name !== undefined && (settings.name.length > 100 || !/^[A-Za-z][A-Za-z0-9]*(?:[_.-][A-Za-z0-9]+)*$/.test(settings.name))) throw new TypeError("NuGet package name must be an ASCII package ID of at most 100 characters");
	if(settings.version !== undefined && !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[A-Za-z0-9]+(?:\.[A-Za-z0-9]+)*)?$/.test(settings.version)) throw new TypeError("NuGet package version must be an exact three-part version without build metadata or normalization");
};
