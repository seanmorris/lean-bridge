/**
 * Nominal C# owners expose checked methods and actual read-only properties.
 *
 * @file
 */
import { ownedDotnetCallbackArguments } from "./owned-callback-arguments.mjs";

const reserved = new Set("Get Share Retain IsClosed Dispose Guard Handle SameIdentity Invoke AsCallback Invocation RawInvocation CallFromHost Equals GetHashCode GetType ToString ReferenceEquals MemberwiseClone Clone EqualityContract PrintMembers Deconstruct".split(" "));

/**
 * Keep the receiver alive through native calls, including callback-triggered GC.
 * Only original whole owners may supply an anchoring or consuming receiver.
 *
 * @param model - Typed public values and authenticated receiver declarations.
 */
export const ownedDotnetReceiverDeclarations = model => {
	const { c, types, functions } = model;
	const nodes = new Map(types.map(node => [node.id, node]));
	const raw = new Map(), owners = [];
	const resultType = id => {
		const node = nodes.get(id);
		return node.name === "unit" ? "void" : node.representation === "copied"
			? node.publicType : node.ownerType ?? `Value<${node.publicType}>`;
	};
	const parameterType = (fn, index) => {
		const node = nodes.get(fn.parameters[index]);
		return c.hostArgument?.(fn, index) && !fn.nativeCallbacks?.includes(index) ? node.delegateType
			: fn.anchor === index || fn.transfers?.includes(index) ? `Value<${node.publicType}>` : node.publicType;
	};
	const member = (fn, whole) => {
		const args = fn.parameters.slice(1).map((_, index) => `arg${index + 1}`);
		const receiver = whole && fn.anchor !== 0 && !fn.transfers?.includes(0) ? "Get()" : "this";
		const call = `Api.${fn.publicName}(${[receiver, ...args].join(", ")})`;
		const property = fn.receiverKind === "property", unit = nodes.get(fn.result).name === "unit";
		const result = property && unit ? "Unit" : resultType(fn.result);
		const invoke = unit ? `${call};${property ? " return default(Unit);" : ""}` : `return ${call};`;
		const comment = fn.transfers?.includes(0)
			? "    /// <summary>Consumes this original owner at the Lean call boundary. Shared aliases close; independent retains survive.</summary>\n" : "";
		return `${comment}    public ${result} ${fn.publicName}${property ? "" : `(${args.map((name, index) => `${parameterType(fn, index + 1)} ${name}`).join(", ")})`}
    {
${property ? "        get\n        {\n" : ""}\
        ${property ? "    " : ""}try { ${invoke} }
        ${property ? "    " : ""}finally { global::System.GC.KeepAlive(this); }
${property ? "        }\n" : ""}\
    }
`;
	};
	for(const node of types.filter(node => node.ownerType))
	{
		const members = functions.filter(fn => fn.receiver === 0 && fn.parameters[0] === node.id);
		const claimed = new Set([...reserved, node.publicType, node.ownerType]);
		for(const fn of members)
		{
			if(claimed.has(fn.publicName)) throw new TypeError(`C# receiver member is reserved or duplicated: ${node.ownerType}.${fn.publicName}`);
			claimed.add(fn.publicName);
		}
		if(node.identity) raw.set(node.id, members.filter(fn => fn.anchor !== 0 && !fn.transfers?.includes(0))
			.flatMap(fn => ownedDotnetCallbackArguments(c, fn).map(variant => member(variant, false))).join(""));
		owners.push(`/// <summary>A checked ${node.publicType} owner with its exported Lean members.</summary>
public sealed class ${node.ownerType} : Value<${node.publicType}>
{
    private readonly global::System.Func<${node.publicType}, ${node.ownerType}> copy;
    internal ${node.ownerType}(Interop.OwnedLease lease, ${node.publicType} value, global::System.Func<${node.publicType}, ${node.ownerType}> copy)
        : base(lease, value, copy) { this.copy = copy; }
    public override ${node.ownerType} Share()
    {
        try { return new(Guard.Lease, Get(), copy); }
        finally { global::System.GC.KeepAlive(this); }
    }
    public override ${node.ownerType} Retain() => (${node.ownerType})base.Retain();
${members.flatMap(fn => ownedDotnetCallbackArguments(c, fn).map(variant => member(variant, true))).join("")}\
}`);
	}
	return { raw, source: owners.join("\n\n") };
};
