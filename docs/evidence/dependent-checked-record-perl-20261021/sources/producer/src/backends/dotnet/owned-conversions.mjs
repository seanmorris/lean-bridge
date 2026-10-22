/**
 * Typed C# snapshots and readers for resource-bearing native values.
 *
 * @file
 */
import { generateOwnedDotnetValues } from "./owned-values.mjs";
import { ownedDotnetConversionSupport } from "./owned-conversion-runtime.mjs";
import { ownedDotnetScalar } from "./owned-scalars.mjs";

/**
 * Conversion does not load libraries or publish a package. Call adapters supply
 * verified resource factories and an owning result or expiring callback lease.
 *
 * @param ir - Concrete compiler-authenticated ownership contract.
 * @param options - Explicit transport capabilities.
 */
export const generateOwnedDotnetConversions = (ir, options = {}) => {
	const model = generateOwnedDotnetValues(ir, options);
	const runtime = ownedDotnetConversionSupport(model.c.functions.some(fn => fn.transfers?.length), model.wholeOwners);
	const nodes = new Map(model.types.map(node => [node.id, node])), names = new Map();
	const type = id => {
		if(names.has(id)) return names.get(id);
		const node = nodes.get(id);
		const name = node.kind === "primitive" ? node.name === "unit" ? "_V.Unit" : node.publicType
			: node.name ? `_V.${node.publicType}` : node.element ? `${type(node.element)}[]`
				: node.kind === "tuple" ? `(${node.fields.map(field => type(field.type)).join(", ")})`
					: `_V.${node.kind === "option" ? "Option" : "Result"}<${node.fields.map(field => type(field.type)).join(", ")}>`;
		names.set(id, name); return name;
	};
	let budget = 16 * 1024 * 1024 - model.source.length - model.layout.rawSource.length - runtime.length;
	for(const node of nodes.values())
	{
		budget -= 4096 + type(node.id).length * 16;
		for(const field of [...node.fields, ...node.cases.flatMap(branch => branch.fields)]) budget -= 256 + type(field.type).length * 6 + field.publicName.length * 4;
		for(const branch of node.cases) budget -= 1024 + branch.publicName.length * 8;
		if(budget < 0) throw new TypeError("Owned C# conversion source exceeds 16 MiB");
	}
	const finite = new Set();
	for(let changed = true; changed;)
	{
		changed = false;
		for(const node of nodes.values())
		{
			const all = fields => fields.every(field => finite.has(field.type));
			const inhabited = node.identity || node.kind === "primitive" || node.element || node.kind === "option"
				|| (node.kind === "variant" ? node.cases.some(branch => all(branch.fields)) : node.kind === "result" ? node.fields.some(field => finite.has(field.type)) : all(node.fields));
			if(inhabited && !finite.has(node.id))
			{ finite.add(node.id); changed = true; }
		}
	}
	const methods = [];
	for(const node of nodes.values())
	{
		const input = [], output = [], raw = node.raw, publicType = type(node.id);
		const put = (field, source, target) => {
			const child = nodes.get(field.type);
			const expression = `Write${child.index}(${source}, scope, depth + 1, ${field.pointer ? "true" : "false"})`;
			return `${target} = ${field.pointer ? `scope.Store(${expression})` : expression};`;
		};
		const get = (field, source) => {
			const child = nodes.get(field.type);
			return `Read${child.index}(${field.pointer ? `(${child.raw}*)${source}` : `&${source}`}, scope, depth + 1, ${field.pointer ? "true" : "false"})`;
		};
		if(!finite.has(node.id))
		{
			input.push('throw new global::System.ArgumentException("The declared type has no finite value");');
			output.push('throw new OwnedInvalidNative("Uninhabited native value");');
		}
		else if(node.identity)
		{
			input.push("global::System.ArgumentNullException.ThrowIfNull(value);", "return scope.Root(value.Handle);");
			output.push("scope.Storage(128); Checkpoint();"
				, "var handle = new OwnedHandle(scope.Lease(), *value);"
				, `try { Checkpoint(); return scope.Factories.Value${node.index}(handle); }`
				, "catch { handle.Dispose(); throw; }");
		}
		else if(node.kind === "primitive")
		{
			const scalar = ownedDotnetScalar(node); input.push(...scalar.input); output.push(...scalar.output);
		}
		else if(node.element)
		{
			const child = nodes.get(node.element), element = type(node.element);
			input.push("global::System.ArgumentNullException.ThrowIfNull(value);"
				, 'if (value.Length > scope.Nodes) throw new OwnedLimit("Ownership node limit exceeded");'
				, `scope.Native((nuint)value.Length, (nuint)sizeof(${child.raw}));`
				, `var data = scope.Allocate<${child.raw}>((nuint)value.Length);`
				, "for (int index = 0; index < value.Length; index++)", "{"
				, `    var child = Write${child.index}(value[index], scope, depth + 1, false);`
				, `    if (!scope.CheckOnly) ((${child.raw}*)data)[index] = child;`, "}"
				, `return new ${raw} { Data = data, Length = (nuint)value.Length };`);
			output.push('if (value->Length > (nuint)scope.Nodes) throw new OwnedLimit("Ownership node limit exceeded");'
				, `scope.Native(value->Length, (nuint)sizeof(${child.raw}));`
				, `scope.Storage(value->Length, (nuint)global::System.Runtime.CompilerServices.Unsafe.SizeOf<${element}>()); scope.Storage(32);`
				, `var data = Checked<${child.raw}>(value->Data, value->Length, ${child.alignment});`, "Checkpoint();"
				, `var result = new ${element.replace(/(\[\])+$/u, "")}[checked((int)value->Length)]${element.match(/(\[\])+$/u)?.[0] ?? ""};`
				, `for (int index = 0; index < result.Length; index++) result[index] = Read${child.index}(&data[index], scope, depth + 1, false);`
				, "return result;");
		}
		else if(node.kind === "variant")
		{
			for(const [index, branch] of node.cases.entries())
			{
				input.push(`if (value is _V.${branch.publicName} branch${index})`, "{", `    var result = new ${raw} { Kind = ${index} };`
					, ...branch.fields.map(field => `    ${put(field, `branch${index}.${field.publicName}`, `result.Cases.${branch.rawName}.${field.rawName}`)}`), "    return result;", "}");
				output.push(`if (value->Kind == ${index})`, "{", `    scope.Storage(${32 + branch.fields.length * 16}); Checkpoint();`
					, `    return new _V.${branch.publicName}(${branch.fields.map(field => get(field, `value->Cases.${branch.rawName}.${field.rawName}`)).join(", ")});`, "}");
			}
			input.push(`throw new global::System.ArgumentException("Expected a named ${node.publicType} constructor");`);
			output.push(`throw new OwnedInvalidNative("Invalid native ${node.publicType} constructor");`);
		}
		else if(["option", "result"].includes(node.kind))
		{
			const option = node.kind === "option";
			input.push(`var result = default(${raw});`);
			if(option)
			{
				input.push("if (value.IsNone) return result;");
				output.push(`if (value->Flag == 0) return ${publicType}.None;`);
			}
			else input.push('if (!value.IsInitialized) throw new global::System.ArgumentException("Construct Result.Ok or Result.Err before calling Lean");');
			for(const [index, field] of node.fields.entries())
			{
				const flag = index ? 0 : 1;
				input.push(`if (value.${option ? "IsSome" : index ? "IsError" : "IsOk"})`, "{", `    result.Flag = ${flag};`
					, `    ${put(field, index ? "value.Error" : "value.Value", `result.${field.rawName}`)}`, "    return result;", "}");
				output.push(`if (value->Flag == ${flag})`, "{", `    scope.Storage((nuint)global::System.Runtime.CompilerServices.Unsafe.SizeOf<${publicType}>()); Checkpoint();`
					, `    return ${publicType}.${option ? "Some" : index ? "Err" : "Ok"}(${get(field, `value->${field.rawName}`)});`, "}");
			}
			input.push('throw new global::System.ArgumentException("Invalid ownership branch");');
			output.push('throw new OwnedInvalidNative("Invalid native ownership flag");');
		}
		else
		{
			const tuple = node.kind === "tuple";
			if(!tuple) input.push("global::System.ArgumentNullException.ThrowIfNull(value);");
			input.push(`var result = default(${raw});`
				, ...node.fields.map((field, index) => put(field, `value.${tuple ? `Item${index + 1}` : field.publicName}`, `result.${field.rawName}`)), "return result;");
			const fields = node.fields.map(field => get(field, `value->${field.rawName}`)).join(", ");
			output.push(`scope.Storage(${tuple ? `(nuint)global::System.Runtime.CompilerServices.Unsafe.SizeOf<${publicType}>()` : 32 + node.fields.length * 16}); Checkpoint();`
				, `return ${tuple ? `(${fields})` : `new ${publicType}(${fields})`};`);
		}
		const track = ["record", "variant", "array", "list"].includes(node.kind);
		methods.push(`    internal static ${raw} Write${node.index}(${publicType} value, OwnedValueScope scope, int depth = 0, bool storage = true)
    {
        object? identity = ${track ? "value" : "null"};
        scope.Enter(identity, depth, sizeof(${raw}), storage);
        try
        {
${input.map(line => `            ${line}`).join("\n")}
        }
        finally { scope.Leave(identity); }
    }
    internal static ${publicType} Read${node.index}(${raw}* value, OwnedValueScope scope, int depth = 0, bool storage = true)
    {
        Checked<${raw}>((nint)value, 1, ${node.alignment});
        scope.Enter(${node.index}, (nuint)value, depth, sizeof(${raw}), storage);
        try
        {
${output.map(line => `            ${line}`).join("\n")}
        }
        finally { scope.Leave(${node.index}, (nuint)value); }
    }`);
	}
	const identities = model.types.filter(node => node.identity);
	const factories = `internal sealed class OwnedFactories
{
${identities.map(node => `    internal readonly global::System.Func<OwnedHandle, ${type(node.id)}> Value${node.index};`).join("\n")}
    internal OwnedFactories(${identities.map(node => `global::System.Func<OwnedHandle, ${type(node.id)}> value${node.index}`).join(", ")})
    {
${identities.map(node => `        global::System.ArgumentNullException.ThrowIfNull(value${node.index}); Value${node.index} = value${node.index};`).join("\n")}
    }
}
`;
	const source = `using _V = global::${model.namespace};
namespace ${model.namespace}.Interop;
${model.layout.rawSource}
${factories}
${runtime}
internal static unsafe partial class OwnedConvert
{
${methods.join("\n")}
}
`;
	if(source.length + model.source.length > 16 * 1024 * 1024) throw new TypeError("Owned C# conversion source exceeds 16 MiB");
	return { ...model, valuesSource: model.source, source
		, nativeTypes: model.types.map(node => ({ id: node.id, index: node.index, raw: node.raw, publicType: type(node.id) })) };
};
