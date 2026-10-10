/**
 * Finite, nominal C# declarations for recursive copied values. Native conversion
 * and installed NuGet admission are verified separately from these declarations.
 *
 * @file
 */
import { compileCopiedCGraphLayout } from "../c/copied-graph-layout.mjs";
import { dotnetGraphCompoundTypes, dotnetGraphEquality } from "./copied-graph-equality.mjs";

const pascal = value => value.split(/[^A-Za-z0-9]+/).filter(Boolean).map(part => part[0].toUpperCase() + part.slice(1)).join("");
const suffix = value => value.match(/_+$/)?.[0] ?? "";
const reserved = new Set(("Api Unit Option Result LeanBridgeException LeanClosure Interop GraphValues IGraphValue GraphScope GraphBudget GraphOwner GraphOutput GraphLifecycle Scope Native Runtime NativeError Equals GetHashCode GetType ToString ReferenceEquals MemberwiseClone Clone EqualityContract PrintMembers Deconstruct").split(" "));
const members = new Set("Equals GetHashCode GetType ToString ReferenceEquals MemberwiseClone Clone EqualityContract PrintMembers Deconstruct".split(" "));
const scalars = {
	unit: "Unit"
	, bool: "bool"
	, uint8: "byte"
	, uint16: "ushort"
	, uint32: "uint"
	, uint64: "ulong"
	, int8: "sbyte"
	, int16: "short"
	, int32: "int"
	, int64: "long"
	, usize: "ulong"
	, isize: "long"
	, float32: "float", float64: "double", string: "string", bytes: "byte[]"
	, nat: "global::System.Numerics.BigInteger"
	, int: "global::System.Numerics.BigInteger"
	, char: "global::System.Text.Rune"
};
const xml = value => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/**
 * Preserve nominal recursion and transparent aliases without tree unfolding.
 * C# has no exported transparent type aliases. Expanded structural CLR types
 * therefore have explicit depth/text limits, checked before emitting source.
 *
 * @param ir - Compiler-authorized pure copied Binding IR.
 */
export const generateCopiedDotnetGraphValues = ir => {
	const layout = compileCopiedCGraphLayout(ir), componentName = pascal(layout.prefix);
	const fail = message => { throw new TypeError(`Invalid C# copied graph: ${message}`); };
	if(reserved.has(componentName)) fail(`reserved component name: ${componentName}`);
	const definitions = new Map(ir.types.map(type => [type.id, type]));
	const names = new Map(), occupied = new Set([...reserved, componentName]);
	const claim = name => {
		if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(name) || occupied.has(name) || /^(?:N|B|V|GraphRaw)\d+$/.test(name)) fail(`reserved or duplicate name: ${name}`);
		occupied.add(name); return name;
	};
	for(const definition of [...ir.types].sort((a, b) => a.id.localeCompare(b.id)))
		if(definition.kind !== "alias") names.set(definition.id, claim(pascal(definition.name)));
	const nodes = new Map(layout.nodes.map(node => [node.id, node])), types = new Map();
	let structuralText = 0;
	const type = id => {
		if(types.has(id)) return types.get(id);
		const node = nodes.get(id);
		if(node.ref.kind === "named") return { name: names.get(node.ref.id), depth: 0 };
		if(node.kind === "primitive") return { name: scalars[node.ref.name], depth: 0 };
		const pending = [{ id, ready: false }];
		while(pending.length)
		{
			const entry = pending.pop();
			if(types.has(entry.id)) continue;
			const current = nodes.get(entry.id);
			if(current.ref.kind === "named")
			{ types.set(entry.id, { name: names.get(current.ref.id), depth: 0 }); continue; }
			if(current.kind === "primitive")
			{ types.set(entry.id, { name: scalars[current.ref.name], depth: 0 }); continue; }
			const children = current.element ? [current.element] : current.fields.map(field => field.type);
			if(!entry.ready)
			{
				pending.push({ id: entry.id, ready: true });
				for(const child of children) if(!types.has(child)) pending.push({ id: child, ready: false });
				continue;
			}
			const arguments_ = children.map(child => types.get(child)), depth = 1 + Math.max(...arguments_.map(child => child.depth));
			if(depth > 32 || arguments_.reduce((sum, child) => sum + child.name.length, 0) > 65500)
				fail("expanded CLR structural type exceeds 32 container levels or 65536 characters; introduce a named record or variant");
			const name = current.element ? `${arguments_[0].name}[]`
				: current.kind === "tuple" ? `(${arguments_.map(child => child.name).join(", ")})`
					: `${current.kind === "option" ? "Option" : "Result"}<${arguments_.map(child => child.name).join(", ")}>`;
			structuralText += name.length;
			if(structuralText > 4 * 1024 * 1024) fail("expanded CLR type catalog exceeds 4 MiB");
			types.set(entry.id, { name, depth });
		}
		return types.get(id);
	};
	const fields = (values, owner, variant) => {
		const seen = new Set([...members, owner]);
		return values.map(field => {
			const publicName = pascal(field.sourceName) + (variant ? suffix(field.sourceName) : "");
			if(seen.has(publicName)) fail(`duplicate or reserved field: ${owner}.${publicName}`);
			seen.add(publicName); return { ...field, publicName };
		});
	};
	const models = layout.nodes.map((node, index) => ({
		...node
		, index
		, publicType: type(node.id).name
		, fields: fields(node.fields, type(node.id).name, false)
		, cases: node.cases.map(branch => {
			const publicName = claim(type(node.id).name + pascal(branch.sourceName) + suffix(branch.sourceName));
			return { ...branch, publicName, fields: fields(branch.fields, publicName, true) };
		})
	}));
	const functionNames = new Set([...members, "Api"]);
	const functions = layout.roots.map(root => {
		const publicName = pascal(root.name.slice(layout.prefix.length + 1));
		if(functionNames.has(publicName)) fail(`duplicate or reserved function: ${publicName}`);
		functionNames.add(publicName); return { ...root, publicName };
	});
	const contractType = ref => ref.kind === "primitive" ? ref.name : ref.kind === "named" ? definitions.get(ref.id).name
		: `${ref.constructor}<${ref.arguments.map(contractType).join(", ")}>`;
	const aliases = layout.aliases.map(alias => {
		const definition = definitions.get(alias.id);
		return {
			id: alias.id
			, name: definition.name
			, target: structuredClone(definition.target)
			, contractType: contractType(definition.target)
			, managedType: type(alias.target).name };
	});
	let declarationBudget = 4 * 1024 * 1024 - dotnetGraphCompoundTypes.length - dotnetGraphEquality.length - 1024;
	const reserve = count => {
		declarationBudget -= count;
		if(declarationBudget < 0) fail("generated declarations exceed 4 MiB");
	};
	// Account for repeated type spellings before constructing parameter lists.
	// A compact graph can otherwise expand into gigabytes of C# source text.
	for(const node of models)
	{
		if(node.kind === "record") reserve(1024 + node.publicType.length * 8);
		if(node.kind === "variant") reserve(1024 + node.publicType.length * 8 + node.cases.reduce((sum, branch) => sum + 1024 + branch.publicName.length * 8, 0));
		for(const field of [...node.fields, ...node.cases.flatMap(branch => branch.fields)])
			reserve(64 + type(field.type).name.length + field.publicName.length * 2);
	}
	for(const alias of aliases) reserve(64 + alias.name.length + alias.contractType.length + alias.managedType.length);
	const record = (name, values, parent = null) => `public sealed record ${name}(${values.map(field => `${type(field.type).name} ${field.publicName}`).join(", ")}) : ${parent ? `${parent}, ` : ""}IGraphValue
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
}
`;
	const source = `namespace LeanBridge.${componentName};

/// <summary>The sole runtime value of Lean Unit.</summary>
public readonly record struct Unit;

${dotnetGraphCompoundTypes}
${models.filter(node => ["record", "variant"].includes(node.kind)).map(node => node.kind === "record"
	? `/// <summary>A copied Lean record with init-only properties.</summary>\n${record(node.publicType, node.fields)}`
	: `/// <summary>A copied Lean variant. Construct a sealed named case.</summary>
public abstract record ${node.publicType}
{
    private protected ${node.publicType}() { }
    protected ${node.publicType}(${node.publicType} original)
    {
        // C# requires a protected record copy constructor. Reject an external
        // derived record that tries to use it as an alternate public constructor.
        if (${node.cases.map(branch => `GetType() != typeof(${branch.publicName})`).join(" && ") || "true"})
            throw new global::System.ArgumentException("Unknown copied variant constructor");
    }
}
${node.cases.map(branch => `/// <summary>The ${xml(branch.sourceName)} case of ${xml(node.publicType)}.</summary>\n${record(branch.publicName, branch.fields, node.publicType)}`).join("\n")}`).join("\n")}
${aliases.map(alias => `// Lean alias ${alias.name} = ${alias.contractType}; C#: ${alias.managedType}`).join("\n")}

${dotnetGraphEquality}`;
	if(source.length > 4 * 1024 * 1024) fail("generated declarations exceed 4 MiB");
	return { layout, namespace: `LeanBridge.${componentName}`, assembly: `LeanBridge.${componentName}`, source, types: models, functions, aliases };
};
