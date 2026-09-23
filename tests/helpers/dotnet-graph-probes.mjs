/**
 * Independent C layout observations and C# graph conversion instrumentation.
 *
 * @file
 */
import { nativeRecursiveReviewedIr } from "./native-recursive-reviewed.mjs";

/** Add recursive records through Option and Result to the independent contract. */
export const dotnetConversionIr = () => {
	const ir = nativeRecursiveReviewedIr(), template = ir.types.find(type => type.name === "Scalars");
	for(const [name, constructor] of [["Link", "option"], ["ResultLink", "result"]])
	{
		const root = { kind: "named", id: `lean:Recursive.${name}` };
		ir.types.push({ ...template, id: root.id, name
			, fields: [{ ...template.fields[0], name: "next"
				, type: { kind: "apply", constructor, arguments: [root, ...constructor === "result" ? [{ kind: "primitive", name: "string" }] : []] } }] });
		const fn = ir.declarations[0];
		ir.declarations.push({ ...structuredClone(fn)
			, id: `lean:Recursive.echo${name}`
			, name: `echo${name}`, overloadKey: `echo${name}`
			, parameters: [{ ...fn.parameters[0], type: root }]
			, result: { ...fn.result, type: root } });
	}
	return ir;
};

/** Public names must not capture qualified CLR leaves or private adapter names. */
export const dotnetCollisionIr = () => {
	const ir = dotnetConversionIr();
	const names = { Scalars: "System", Tree: "GraphRuntime", Spine: "Utf8"
		, Marker: "GraphInvalidNative", Envelope: "GraphLimit"
		, LeftTree: "BigInteger", RightTree: "Rune"
		, Wide: "ValueTuple", EmptyRecord: "NativeMemory", Link: "V" };
	for(const type of ir.types) type.name = names[type.name] ?? type.name;
	return ir;
};

/**
 * Compare sizeof, alignment and field offsets from two independent compilers.
 *
 * @param model - C# graph layouts and emitted unmanaged type names.
 */
export const dotnetGraphLayoutProbe = model => {
	const c = [], cs = [];
	for(const node of model.types)
	{
		c.push(`sizeof(${node.name})`, `_Alignof(${node.name})`);
		cs.push(`(nuint)sizeof(${node.raw})`, `Alignment<${node.raw}>()`);
		if(!node.aggregate) continue;
		const fields = [["_bridge_owner", "Owner"], ["_bridge_release", "Release"]];
		if(node.kind === "primitive" || node.element) fields.push(["data", "Data"], ["length", "Length"]);
		if(node.ref.name === "int") fields.push(["negative", "Negative"]);
		if(node.kind === "variant") fields.push(["kind", "Kind"], ["cases", "Cases"]);
		if(node.kind === "option") fields.push(["has_value", "Flag"]);
		if(node.kind === "result") fields.push(["is_ok", "Flag"]);
		for(const [i, field] of node.fields.entries()) fields.push([field.name, `Field${i}`]);
		for(const [native, managed] of fields)
		{
			c.push(`offsetof(${node.name}, ${native})`);
			cs.push(`Offset<${node.raw}>("${managed}")`);
		}
		for(const [j, branch] of node.cases.entries()) for(const [k, field] of branch.fields.entries())
		{
			c.push(`offsetof(${node.name}, cases.${branch.name}.${field.name})`);
			cs.push(`Offset<${node.raw}>("Cases") + Offset<GraphCase${node.index}_${j}>("Field${k}")`);
		}
	}
	return {
		count: c.length
		, c: `static const size_t layout[] = {${c.join(", ")}};\nsize_t graph_fixture_layout_count(void) { return sizeof(layout)/sizeof(*layout); }\nsize_t graph_fixture_layout(size_t i) { return layout[i]; }\n`
		, source: `    internal static nuint[] Layout() => new nuint[] { ${cs.join(", ")} };
    [System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential)]
    private struct Aligned<T> where T : unmanaged { internal byte Before; internal T Value; }
    private static nuint Alignment<T>() where T : unmanaged => (nuint)(sizeof(Aligned<T>) - sizeof(T));
    private static nuint Offset<T>(string field) where T : unmanaged => (nuint)System.Runtime.InteropServices.Marshal.OffsetOf<T>(field);
` };
};

/**
 * Private typed callers use the same generated call path as the later package.
 *
 * @param model - Generated conversions.
 * @param options - Select independently compiled Lean exports.
 * @param options.compiledLean - Use actual carriers and the shared runtime.
 */
export const dotnetGraphProbeSource = (model, { compiledLean = false } = {}) => {
	const types = new Map(model.nativeTypes.map(type => [type.id, type]));
	return `using System;
using System.Runtime.InteropServices;
using _V = global::${model.namespace};
using ${model.namespace}.Interop;

internal static unsafe class GraphProbe
{
    internal static nint Handle;
    internal static nint Symbol(string name) => NativeLibrary.GetExport(Handle, "graph_fixture_" + name);
    internal static GraphLifecycle Lifecycle => new((delegate* unmanaged[Cdecl]<uint>)Symbol("initialize"), (delegate* unmanaged[Cdecl]<int>)Symbol("ready"), (delegate* unmanaged[Cdecl]<void>)Symbol("retire"));
${compiledLean ? `    internal static void Reset(nuint fail = 0, nuint bad = 0, uint mode = 0) => ((delegate* unmanaged[Cdecl]<nuint, nuint, uint, void>)Symbol("reset"))(fail, bad, mode);
    internal static void Release() => ((delegate* unmanaged[Cdecl]<void>)Symbol("release"))();
    internal static void Detach() => ((delegate* unmanaged[Cdecl]<void>)Symbol("detach"))();`
	: '    internal static void Reset(uint mode = 0) { ((delegate* unmanaged[Cdecl]<uint, void>)Symbol("reset"))(mode); ((delegate* unmanaged[Cdecl]<void>)Symbol("reset_lifecycle"))(); }'}
    internal static uint Count(string name) => ((delegate* unmanaged[Cdecl]<uint>)Symbol(name))();
    internal static void Retire() => ((delegate* unmanaged[Cdecl]<void>)Symbol("retire"))();
${model.functions.map(fn => {
		const params = fn.parameters.map(id => types.get(id)), result = types.get(fn.result);
		const name = fn.name.slice(model.layout.prefix.length + 1);
		const symbol = { echo_link: "link", echo_result_link: "result_link" }[name] ?? name;
		const address = compiledLean && name !== "tree" ? `NativeLibrary.GetExport(Handle, "${fn.name}_graph")` : `Symbol("${symbol}")`;
		return `    internal static ${result.publicType} ${fn.publicName}(${params.map((node, i) => `${node.publicType} arg${i}`).join(", ")}) => GraphRuntime.Call${fn.publicName}((delegate* unmanaged[Cdecl]<${[...params.map(node => `${node.raw}*`), `${result.raw}*`, "uint"].join(", ")}>)${address}, Lifecycle${params.map((_, i) => `, arg${i}`).join("")});`;
}).join("\n")}
${dotnetGraphLayoutProbe(model).source}
}
`;
};

/**
 * Replace only test seams, preserving every generated conversion and call body.
 *
 * @param source - Exact generated conversion source.
 */
export const instrumentDotnetGraphs = source => source.replace("internal static void Checkpoint() { }", "internal static void Checkpoint() { global::GraphFaults.Hit(); }")
	.replaceAll("global::System.Runtime.InteropServices.NativeMemory.AllocZeroed", "global::GraphFaults.Allocate")
	.replaceAll("global::System.Runtime.InteropServices.NativeMemory.Free", "global::GraphFaults.Free");

/**
 * Supply simple owned native results beyond the separately authored scalar probe.
 *
 * @param model - Exact C types for the fixture's extra echoes.
 */
export const dotnetGraphNativeExtras = model => {
	const types = new Map(model.types.map(node => [node.id, node]));
	const existing = new Set(["scalars", "tree", "spine", "marker", "echo_link", "echo_result_link", "envelope"]);
	const echoes = model.functions.filter(fn => !existing.has(fn.name.slice(model.layout.prefix.length + 1)) && fn.parameters.length === 1 && fn.parameters[0] === fn.result);
	return `${echoes.map(fn => `ECHO(${fn.name.slice(model.layout.prefix.length + 1)}, ${types.get(fn.result).name})`).join("\n")}
static uint32_t initialized, retired;
void graph_fixture_reset_lifecycle(void) { initialized = retired = 0; }
uint32_t graph_fixture_initialize(void) { ++initialized; return retired ? 5 : 0; }
int graph_fixture_ready(void) { return !retired; }
void graph_fixture_retire(void) { retired = 1; }
uint32_t graph_fixture_initialized(void) { return initialized; }
uint32_t graph_fixture_retired(void) { return retired; }
`;
};
