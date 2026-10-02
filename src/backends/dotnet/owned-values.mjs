/**
 * Nominal C# values and typed closures for explicit ownership contracts.
 *
 * @file
 */
import { compileOwnedDotnetLayout } from "./owned-layout.mjs";
import { dotnetGraphCompoundTypes, dotnetGraphEquality } from "./copied-graph-equality.mjs";
import { ownedDotnetWholeValues } from "./owned-borrows.mjs";
import { ownedDotnetReceiverDeclarations } from "./owned-receivers.mjs";
import { ownedDotnetCallbackArguments, ownedDotnetCallbackResult } from "./owned-callback-arguments.mjs";

const pascal = value => value.split(/[^A-Za-z0-9]+/u).filter(Boolean).map(part => part[0].toUpperCase() + part.slice(1)).join("");
const suffix = value => value.match(/_+$/u)?.[0] ?? "";
const members = new Set("Equals GetHashCode GetType ToString ReferenceEquals MemberwiseClone Clone EqualityContract PrintMembers Deconstruct".split(" "));
const reserved = new Set([...members, ..."Api Unit Option Result LeanBridgeException Interop GraphValues IGraphValue IOwnedValue OwnedCallbacks".split(" ")]);
const scalar = {
	unit: "Unit", bool: "bool", char: "global::System.Text.Rune"
	, nat: "global::System.Numerics.BigInteger"
	, int: "global::System.Numerics.BigInteger"
	, uint8: "byte", uint16: "ushort", uint32: "uint", uint64: "ulong"
	, int8: "sbyte", int16: "short", int32: "int", int64: "long"
	, usize: "ulong", isize: "long", float32: "float", float64: "double"
	, string: "string", bytes: "byte[]"
};

/**
 * Keep callback inputs nominal instead of expanding higher-order delegate types.
 * A host delegate receives borrowed Lean closure wrappers; a returned closure's
 * Invoke accepts host delegates. AsCallback bridges these two directions.
 *
 * @param ir - Concrete compiler-authenticated ownership contract.
 * @param options - Explicit transport capabilities.
 */
export const generateOwnedDotnetValues = (ir, options = {}) => {
	const layout = compileOwnedDotnetLayout(ir, options), c = layout.c;
	const anchored = [...c.functions, ...c.callbacks].some(fn => fn.anchor !== undefined);
	const callbackReplies = Boolean(c.hostArgument) && c.callbacks.some(fn => fn.anchor !== undefined);
	const receivers = c.functions.some(fn => fn.receiver === 0), wholeOwners = anchored || receivers;
	const component = pascal(c.prefix), names = new Map();
	const occupied = new Set(reserved), fail = message => { throw new TypeError(`Invalid owned C# values: ${message}`); };
	if(wholeOwners) occupied.add("Value");
	if(callbackReplies) occupied.add("CallbackResult");
	const claim = name => {
		if(!/^[A-Z][A-Za-z0-9_]*$/u.test(name) || occupied.has(name)) fail(`reserved or duplicate name: ${name}`);
		occupied.add(name); return name;
	};
	claim(component);
	for(const node of layout.types) if(node.kind !== "primitive" && node.name)
		names.set(node.id, claim(node.kind === "callback"
			? pascal(node.cName.slice(c.prefix.length + 1, -2)) + "Closure" : pascal(node.name)));
	const delegates = new Map(layout.types.filter(node => node.kind === "callback")
		.map(node => [node.id, claim(names.get(node.id) + "Callback")]));
	const table = new Map(layout.types.map(node => [node.id, node])), cached = new Map();
	let text = 0;
	const type = id => {
		const pending = [{ id, ready: false }];
		while(pending.length)
		{
			const entry = pending.pop();
			if(cached.has(entry.id)) continue;
			const node = table.get(entry.id);
			if(names.has(entry.id) || node.kind === "primitive")
			{ cached.set(entry.id, { name: names.get(entry.id) ?? scalar[node.name], depth: 0 }); continue; }
			const children = node.element ? [node.element] : node.fields.map(field => field.type);
			if(!entry.ready)
			{
				pending.push({ id: entry.id, ready: true });
				for(const child of children) if(!cached.has(child)) pending.push({ id: child, ready: false });
				continue;
			}
			const args = children.map(child => cached.get(child));
			const depth = 1 + Math.max(...args.map(child => child.depth));
			if(depth > 32 || args.reduce((sum, child) => sum + child.name.length, 0) > 65500)
				fail("expanded CLR structural type exceeds 32 levels or 65536 characters; introduce a named record or variant");
			const name = node.element ? `${args[0].name}[]` : node.kind === "tuple"
				? `(${args.map(child => child.name).join(", ")})`
				: `${node.kind === "option" ? "Option" : "Result"}<${args.map(child => child.name).join(", ")}>`;
			text += name.length;
			if(text > 4 * 1024 * 1024) fail("expanded CLR type catalog exceeds 4 MiB");
			cached.set(entry.id, { name, depth });
		}
		return cached.get(id).name;
	};
	const fields = (values, owner, variant = false) => {
		const seen = new Set([...members, owner]);
		return values.map(field => {
			const publicName = pascal(field.sourceName) + (variant ? suffix(field.sourceName) : "");
			if(seen.has(publicName)) fail(`reserved or duplicate field: ${owner}.${publicName}`);
			seen.add(publicName); return { ...field, publicName };
		});
	};
	const types = layout.types.map(node => ({ ...node, publicType: type(node.id)
		, delegateType: delegates.get(node.id) ?? null
		, fields: fields(node.fields, type(node.id))
		, cases: node.cases.map(branch => {
			const publicName = claim(type(node.id) + pascal(branch.sourceName) + suffix(branch.sourceName));
			return { ...branch, publicName, fields: fields(branch.fields, publicName, true) };
		})
	}));
	const methods = new Set([...members, "Api"]);
	const functions = c.functions.map(fn => {
		const publicName = pascal(fn.cName.slice(c.prefix.length + 1));
		if(methods.has(publicName)) fail(`reserved or duplicate function: ${publicName}`);
		methods.add(publicName); return { ...fn, publicName
			, ...fn.receiver === 0 ? { receiverKind: ir.declarations.find(item => item.id === fn.id).kind } : {} };
	});
	if(receivers) for(const node of types)
		if(functions.some(fn => fn.receiver === 0 && fn.parameters[0] === node.id)) node.ownerType = claim(node.publicType + "Value");
	const receiverDeclarations = ownedDotnetReceiverDeclarations({ c, types, functions });
	const definitions = new Map(ir.types.map(node => [node.id, node]));
	const contract = ref => ref.kind === "primitive" ? ref.name : ref.kind === "named"
		? definitions.get(ref.id).name : `${ref.constructor}<${ref.arguments.map(contract).join(", ")}>`;
	const aliases = c.native.aliases.map(alias => ({ ...alias
		, name: definitions.get(alias.id).name, managedType: type(alias.target)
		, contractType: contract(definitions.get(alias.id).target) }));
	const callbacks = c.callbacks.map(fn => {
		const invocations = ownedDotnetCallbackArguments(c, fn).map((variant, index) => ({
			fn: variant, suffix: index ? `Native${index}` : ""
			, parameters: fn.parameters.slice(1).map((id, position) => c.hostArgument?.(fn, position + 1) && !variant.nativeCallbacks?.includes(position + 1) ? delegates.get(id)
				: fn.anchor === position + 1 ? `Value<${type(id)}>` : type(id))
		}));
		return { ...fn
		, publicType: type(fn.id), delegateType: delegates.get(fn.id)
		, returnType: table.get(fn.result).name === "unit" ? "void" : type(fn.result)
		, hostReturnType: callbackReplies && fn.anchor !== undefined ? `CallbackResult<${type(fn.result)}>` : table.get(fn.result).name === "unit" ? "void" : type(fn.result)
		, ...wholeOwners ? { invokeReturnType: table.get(fn.result).representation !== "copied" ? types.find(node => node.id === fn.result).ownerType ?? `Value<${type(fn.result)}>` : table.get(fn.result).name === "unit" ? "void" : type(fn.result) } : {}
		, hostParameters: fn.parameters.slice(1).map(type)
		, invokeParameters: invocations[0].parameters, invocations };
	});
	let budget = 4 * 1024 * 1024 - dotnetGraphCompoundTypes.length - dotnetGraphEquality.length;
	const reserve = count => { budget -= count; if(budget < 0) fail("generated declarations exceed 4 MiB"); };
	for(const node of types)
	{
		reserve(2048 + node.publicType.length * 16);
		for(const field of [...node.fields, ...node.cases.flatMap(branch => branch.fields)]) reserve(128 + type(field.type).length * 4 + field.publicName.length * 4);
		for(const branch of node.cases) reserve(1024 + branch.publicName.length * 10);
	}
	for(const fn of callbacks) for(const invocation of fn.invocations)
		reserve(2048 + fn.returnType.length * 8 + [...fn.hostParameters, ...invocation.parameters].reduce((sum, name) => sum + name.length * 8, 0));
	for(const alias of aliases) reserve(128 + alias.name.length + alias.contractType.length + alias.managedType.length);
	const record = (name, values, parent = null) => `public sealed record ${name}(${values.map(field => `${type(field.type)} ${field.publicName}`).join(", ")}) : ${parent ? `${parent}, ` : ""}IGraphValue
{
    int IGraphValue.GraphTag => 0;
    int IGraphValue.GraphCount => ${values.length};
    object? IGraphValue.GraphField(int index) => index switch
    {
${values.map((field, index) => `        ${index} => ${field.publicName},`).join("\n")}
        _ => throw new global::System.ArgumentOutOfRangeException(nameof(index))
    };
    public bool Equals(${name}? other) => GraphValues.Equal(this, other);
    public override int GetHashCode() => GraphValues.Hash(this);
    public override string ToString() => GraphValues.Format(this);
}`;
	const declarations = types.filter(node => names.has(node.id)).map(node => {
		const name = node.publicType;
		if(node.identity)
		{
			const fn = callbacks.find(fn => fn.id === node.id), rawBridge = wholeOwners && fn && fn.anchor === undefined;
			const rawParams = fn?.invocations.at(-1).parameters.map((type, index) => `${type} arg${index}`).join(", ");
			return `/// <summary>A thread-bound Lean ${fn ? "closure" : "resource"}. Retain creates an independent owner.</summary>
public sealed class ${name} : global::System.IDisposable, IOwnedValue
{
    internal readonly Interop.OwnedHandle Handle;
    private readonly global::System.Func<Interop.OwnedHandle, ${name}> retain;${anchored ? "\n    private readonly global::System.Func<Interop.OwnedHandle, Interop.OwnedHandle, bool> equal;" : ""}
${fn ? `${fn.invocations.map(invocation => `    internal delegate ${fn.invokeReturnType ?? fn.returnType} Invocation${invocation.suffix}(${invocation.parameters.map((type, index) => `${type} arg${index}`).join(", ")});
    private readonly Invocation${invocation.suffix} invoke${invocation.suffix};
`).join("")}${rawBridge ? `    internal delegate ${fn.returnType} RawInvocation(${rawParams});
    private readonly RawInvocation rawInvoke;
` : ""}` : ""}    internal ${name}(Interop.OwnedHandle handle, global::System.Func<Interop.OwnedHandle, ${name}> retain${fn ? fn.invocations.map(invocation => `, Invocation${invocation.suffix} invoke${invocation.suffix}`).join("") : ""}${anchored ? ", global::System.Func<Interop.OwnedHandle, Interop.OwnedHandle, bool> equal" : ""}${rawBridge ? ", RawInvocation rawInvoke" : ""})
    { Handle = handle; this.retain = retain;${fn ? fn.invocations.map(invocation => ` this.invoke${invocation.suffix} = invoke${invocation.suffix};`).join("") : ""}${anchored ? " this.equal = equal;" : ""}${rawBridge ? " this.rawInvoke = rawInvoke;" : ""} }
    public bool IsClosed => Handle.IsClosed;
    public void Dispose() => Handle.Dispose();
    public ${name} Retain() => retain(Handle);
${anchored ? `    public bool SameIdentity(${name} other)
    {
        global::System.ArgumentNullException.ThrowIfNull(other);
        return equal(Handle, other.Handle);
    }
    public override bool Equals(object? other)
    {
        Handle.Raw(Handle.Lease.State);
        return other is ${name} value && equal(Handle, value.Handle);
    }
    bool IOwnedValue.OwnedEquals(object? other) => Equals(other);
    public override int GetHashCode() => throw new global::System.NotSupportedException("Lean resources cannot be dictionary keys");
` : ""}\
${fn ? `${fn.invocations.map(invocation => `    public ${fn.invokeReturnType ?? fn.returnType} Invoke(${invocation.parameters.map((type, index) => `${type} arg${index}`).join(", ")}) => invoke${invocation.suffix}(${invocation.parameters.map((_, i) => `arg${i}`).join(", ")});
`).join("")}\
${fn.anchor === undefined ? `\
    private ${fn.returnType} CallFromHost(${fn.hostParameters.map((type, i) => `${type} arg${i}`).join(", ")}) => ${wholeOwners ? "rawInvoke" : "Invoke"}(${fn.parameters.slice(1).map((id, i) => `arg${i}${c.hostArgument?.(fn, i + 1) ? ".AsCallback" : ""}`).join(", ")});
    public ${fn.delegateType} AsCallback => CallFromHost;
` : `    public ${name} AsCallback => this;\n`}\
` : ""}${receiverDeclarations.raw.get(node.id) ?? ""}}`;
		}
		if(node.kind === "record") return record(name, node.fields);
		return `public abstract record ${name}
{
    private protected ${name}() { }
    protected ${name}(${name} original)
    {
        if (${node.cases.map(branch => `GetType() != typeof(${branch.publicName})`).join(" && ") || "true"})
            throw new global::System.ArgumentException("Unknown Lean variant constructor");
    }
}
${node.cases.map(branch => record(branch.publicName, branch.fields, name)).join("\n")}`;
	});
	// Resource leaves compare wrapper identity, including after disposal. Value
	// equality never calls native code or silently creates a retained resource.
	let equality = dotnetGraphEquality.replace("value is not (null or Unit", "value is not (IOwnedValue or null or Unit");
	if(anchored) equality = equality.replace("else equal &= global::System.Object.Equals(x.Value, y.Value);", "else if (x.Value is IOwnedValue resource) equal &= resource.OwnedEquals(y.Value);\n            else equal &= global::System.Object.Equals(x.Value, y.Value);");
	const source = `namespace LeanBridge.${component};

public readonly record struct Unit;
internal interface IOwnedValue {${anchored ? " bool OwnedEquals(object? other); " : " "}}
${wholeOwners ? receivers ? ownedDotnetWholeValues.replace("public sealed class Value<T>", "public class Value<T>").replaceAll("public Value<T>", "public virtual Value<T>") : ownedDotnetWholeValues : ""}\
${callbackReplies ? ownedDotnetCallbackResult : ""}\
${dotnetGraphCompoundTypes}
${callbacks.map(fn => `public delegate ${fn.hostReturnType} ${fn.delegateType}(${fn.hostParameters.map((type, index) => `${type} arg${index}`).join(", ")});`).join("\n")}
${declarations.join("\n\n")}
${receivers ? receiverDeclarations.source + "\n" : ""}\
${aliases.map(alias => `// Lean alias ${alias.name} = ${alias.contractType}; C#: ${alias.managedType}`).join("\n")}
${equality}`;
	if(source.length > 4 * 1024 * 1024) fail("generated declarations exceed 4 MiB");
	return { layout, c, types, functions, callbacks, aliases, source
		, wholeOwners
		, namespace: `LeanBridge.${component}`, assembly: `LeanBridge.${component}` };
};
