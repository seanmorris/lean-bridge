/**
 * Typed, bounded C# readers and writers for the finite native copied graph ABI.
 *
 * @file
 */
import { compileCopiedDotnetGraphLayout } from "./copied-graph-layout.mjs";
import { dotnetGraphRuntime, dotnetGraphException } from "./copied-graph-runtime.mjs";
import { dotnetGraphScalar } from "./copied-graph-scalars.mjs";

/**
 * Generate private adapters. Loading, authenticated package admission and public
 * API forwarding are separate from these directly executable conversion methods.
 *
 * @param ir - Concrete copied Binding IR.
 */
export const generateCopiedDotnetGraphConversions = ir => {
	const model = compileCopiedDotnetGraphLayout(ir), nodes = new Map(model.types.map(node => [node.id, node]));
	const publicTypes = new Map();
	const publicType = id => {
		if(publicTypes.has(id)) return publicTypes.get(id);
		const node = nodes.get(id);
		const result = node.ref.kind === "named" ? `_V.${node.publicType}`
			: node.kind === "primitive" ? node.ref.name === "unit" ? "_V.Unit" : node.publicType
				: node.element ? `${publicType(node.element)}[]`
					: node.kind === "tuple" ? `(${node.fields.map(field => publicType(field.type)).join(", ")})`
						: `_V.${node.kind === "option" ? "Option" : "Result"}<${node.fields.map(field => publicType(field.type)).join(", ")}>`;
		publicTypes.set(id, result); return result;
	};
	// A small IR can repeat a large structural CLR spelling in many signatures.
	// Charge those repetitions before constructing source lists or method bodies.
	let sourceBudget = 16 * 1024 * 1024;
	const reserve = bytes => {
		sourceBudget -= bytes;
		if(sourceBudget < 0) throw new TypeError("Invalid C# copied graph: generated converters exceed 16 MiB");
	};
	reserve(model.valuesSource.length + model.rawSource.length + dotnetGraphRuntime.length);
	for(const node of nodes.values())
	{
		reserve(4096 + publicType(node.id).length * 12);
		for(const branch of node.cases) reserve(1024 + branch.publicName.length * 8);
		for(const field of [...node.fields, ...node.cases.flatMap(branch => branch.fields)])
			reserve(512 + field.publicName.length * 4);
	}
	for(const fn of model.functions)
	{
		reserve(2048 + fn.publicName.length * 4 + publicType(fn.result).length * 4);
		for(const id of fn.parameters) reserve(256 + publicType(id).length * 4);
	}
	const finite = new Set();
	for(let changed = true; changed;)
	{
		changed = false;
		for(const node of nodes.values())
		{
			const all = fields => fields.every(field => finite.has(field.type));
			const inhabited = node.kind === "primitive" || node.element || node.kind === "option"
				|| (node.kind === "variant" ? node.cases.some(branch => all(branch.fields)) : node.kind === "result" ? node.fields.some(field => finite.has(field.type)) : all(node.fields));
			if(!finite.has(node.id) && inhabited)
			{ finite.add(node.id); changed = true; }
		}
	}
	const methods = [];
	for(const node of nodes.values())
	{
		const i = node.index, raw = node.raw, type = publicType(node.id), input = [], output = [];
		const inputField = (field, source, destination) => {
			const child = nodes.get(field.type), expression = `Write${child.index}(${source}, scope, depth + 1, ${field.storage === "pointer" ? "true" : "false"})`;
			return `${destination} = ${field.storage === "pointer" ? `scope.Store(${expression})` : expression};`;
		};
		const outputField = (field, source) => {
			const child = nodes.get(field.type);
			return `Read${child.index}(${field.storage === "pointer" ? `(${child.raw}*)${source}` : `&${source}`}, scope, depth + 1, ${field.storage === "pointer" ? "true" : "false"})`;
		};
		if(!finite.has(node.id))
		{
			input.push('throw new global::System.ArgumentException("The declared type has no finite copied value");');
			output.push('throw new GraphInvalidNative("Uninhabited native copied value");');
		} else if(node.kind === "primitive")
		{
			const scalar = dotnetGraphScalar(node); input.push(...scalar.input); output.push(...scalar.output);
		} else if(node.element)
		{
			const child = nodes.get(node.element), element = publicType(node.element);
			input.push("global::System.ArgumentNullException.ThrowIfNull(value);"
				, 'if (value.Length > scope.Nodes) throw new GraphLimit("Copied graph node limit exceeded");'
				, `scope.Native((nuint)value.Length, (nuint)sizeof(${child.raw}));`
				, `var data = scope.Allocate<${child.raw}>((nuint)value.Length);`
				, "for (int index = 0; index < value.Length; index++)", "{"
				, `    var child = Write${child.index}(value[index], scope, depth + 1, false);`
				, `    if (!scope.CheckOnly) ((${child.raw}*)data)[index] = child;`, "}"
				, `return new ${raw} { Data = data, Length = (nuint)value.Length };`);
			output.push('if (value->Length > (nuint)scope.Nodes) throw new GraphLimit("Copied graph node limit exceeded");'
				, `scope.Native(value->Length, (nuint)sizeof(${child.raw}));`
				, `scope.Storage(value->Length, (nuint)global::System.Runtime.CompilerServices.Unsafe.SizeOf<${element}>()); scope.Storage(32);`
				, `var data = Checked<${child.raw}>(value->Data, value->Length, ${child.alignment});`, "Checkpoint();"
				, `var result = new ${element.replace(/(\[\])+$/, "")}[checked((int)value->Length)]${element.match(/(\[\])+$/)?.[0] ?? ""};`
				, `for (int index = 0; index < result.Length; index++) result[index] = Read${child.index}(&data[index], scope, depth + 1, false);`
				, "return result;");
		} else if(node.kind === "variant")
		{
			for(const [j, branch] of node.cases.entries())
			{
				input.push(`if (value is _V.${branch.publicName} branch${j})`, "{", `    var result = new ${raw} { Kind = ${j} };`
					, ...branch.fields.map((field, k) => `    ${inputField(field, `branch${j}.${field.publicName}`, `result.Cases.Case${j}.Field${k}`)}`), "    return result;", "}");
				output.push(`if (value->Kind == ${j})`, "{", `    scope.Storage(${32 + branch.fields.length * 16}); Checkpoint();`
					, `    return new _V.${branch.publicName}(${branch.fields.map((field, k) => outputField(field, `value->Cases.Case${j}.Field${k}`)).join(", ")});`, "}");
			}
			input.push(`throw new global::System.ArgumentException("Expected a named ${node.publicType} constructor");`);
			output.push(`throw new GraphInvalidNative("Invalid native ${node.publicType} constructor");`);
		} else if(node.kind === "option" || node.kind === "result")
		{
			const option = node.kind === "option";
			input.push(`var result = default(${raw});`);
			if(option)
			{
				input.push("if (value.IsNone) return result;");
				output.push(`if (value->Flag == 0) return ${type}.None;`);
			} else input.push('if (!value.IsInitialized) throw new global::System.ArgumentException("Construct Result.Ok or Result.Err before calling Lean");');
			for(const [j, field] of node.fields.entries())
			{
				const test = option || !j ? "value.IsSome" : "value.IsError", flag = j ? 0 : 1;
				input.push(`if (${option ? test : j ? "value.IsError" : "value.IsOk"})`, "{", `    result.Flag = ${flag};`
					, `    ${inputField(field, j ? "value.Error" : "value.Value", `result.Field${j}`)}`, "    return result;", "}");
				output.push(`if (value->Flag == ${flag})`, "{", `    scope.Storage((nuint)global::System.Runtime.CompilerServices.Unsafe.SizeOf<${type}>()); Checkpoint();`
					, `    return ${type}.${option ? "Some" : j ? "Err" : "Ok"}(${outputField(field, `value->Field${j}`)});`, "}");
			}
			input.push('throw new global::System.ArgumentException("Invalid copied branch");');
			output.push('throw new GraphInvalidNative("Invalid native compound flag");');
		} else
		{
			const tuple = node.kind === "tuple";
			if(!tuple) input.push("global::System.ArgumentNullException.ThrowIfNull(value);");
			input.push(`var result = default(${raw});`, ...node.fields.map((field, j) => inputField(field, `value.${tuple ? `Item${j + 1}` : field.publicName}`, `result.Field${j}`)), "return result;");
			const fields = node.fields.map((field, j) => outputField(field, `value->Field${j}`)).join(", ");
			output.push(`scope.Storage(${tuple ? `(nuint)global::System.Runtime.CompilerServices.Unsafe.SizeOf<${type}>()` : 32 + node.fields.length * 16}); Checkpoint();`
				, `return ${tuple ? `(${fields})` : `new ${type}(${fields})`};`);
		}
		const track = ["record", "variant", "array", "list"].includes(node.kind);
		methods.push(`    internal static ${raw} Write${i}(${type} value, GraphScope scope, int depth = 0, bool storage = true)
    {
        object? identity = ${track ? "value" : "null"};
        scope.Enter(identity, depth, sizeof(${raw}), storage);
        try
        {
${input.map(line => `            ${line}`).join("\n")}
        }
        finally { scope.Leave(identity); }
    }
    internal static ${type} Read${i}(${raw}* value, GraphScope scope, int depth = 0, bool storage = true)
    {
        Checked<${raw}>((nint)value, 1, ${node.alignment});
        scope.Enter(${i}, (nuint)value, depth, sizeof(${raw}), storage);
        try
        {
${output.map(line => `            ${line}`).join("\n")}
        }
        finally { scope.Leave(${i}, (nuint)value); }
    }`);
	}
	const calls = model.functions.map(fn => {
		const parameters = fn.parameters.map(id => nodes.get(id)), result = nodes.get(fn.result);
		const pointer = `delegate* unmanaged[Cdecl]<${[...parameters.map(node => `${node.raw}*`), `${result.raw}*`, "uint"].join(", ")}>`;
		return `    internal static ${publicType(result.id)} Call${fn.publicName}(${pointer} invoke, GraphLifecycle lifecycle${parameters.map((node, i) => `, ${publicType(node.id)} arg${i}`).join("")})
    {
        using (var check = new GraphScope(true))
        {
${parameters.map((node, i) => `            Write${node.index}(arg${i}, check);`).join("\n")}
        }
        using var scope = new GraphScope();
        var output = default(${result.raw});
${result.kind === "variant" ? "        output.Kind = uint.MaxValue;\n" : ""}        try
        {
${parameters.map((node, i) => `            var input${i} = Write${node.index}(arg${i}, scope);`).join("\n")}
            if (invoke == null) throw new global::System.ArgumentNullException(nameof(invoke));
            lifecycle.Before();
            Status(invoke(${[...parameters.map((_, i) => `&input${i}`), "&output"].join(", ")}));
            var result = Read${result.index}(&output, scope);
            Checkpoint(); lifecycle.After();
            return result;
        }
        catch (GraphInvalidNative error)
        {
            lifecycle.Poison();
            throw new LeanBridgeException(4, error.Message, error);
        }
        finally
        {
${result.aggregate ? "            Clear(ref output.Owner, ref output.Release);" : "            // Scalar outputs own no arena."}
        }
    }`;
	});
	return { ...model, valuesSource: model.valuesSource + "\n" + dotnetGraphException
		, source: `using _V = global::${model.namespace};\nnamespace ${model.namespace}.Interop;\n\n${model.rawSource}\n${dotnetGraphRuntime}\ninternal static unsafe partial class GraphRuntime\n{\n${methods.join("\n")}\n${calls.join("\n")}\n}\n`
		, nativeTypes: model.types.map(node => ({ id: node.id, index: node.index, raw: node.raw, publicType: publicType(node.id) })) };
};
