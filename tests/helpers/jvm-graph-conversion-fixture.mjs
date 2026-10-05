/**
 * Independently declared graph inputs and native/JVM layout observations.
 *
 * @file
 */
import { nativeRecursiveReviewedIr } from "./native-recursive-reviewed.mjs";

/** Recursive optional and result-bearing records supplement the common corpus. */
export const jvmGraphConversionIr = () => {
	const ir = nativeRecursiveReviewedIr(), record = ir.types.find(type => type.name === "Scalars");
	for(const [name, constructor] of [["Link", "option"], ["ResultLink", "result"]])
	{
		const type = { kind: "named", id: `lean:Recursive.${name}` }, fn = ir.declarations[0];
		ir.types.push({ ...structuredClone(record), id: type.id, name
			, fields: [{ ...record.fields[0], name: "next", type: { kind: "apply", constructor, arguments: [type, ...constructor === "result" ? [{ kind: "primitive", name: "string" }] : []] } }] });
		ir.declarations.push({ ...structuredClone(fn)
			, id: `lean:Recursive.echo${name}`
			, name: `echo${name}`, overloadKey: `echo${name}`
			, parameters: [{ ...fn.parameters[0], type }]
			, result: { ...fn.result, type } });
	}
	return ir;
};

/**
 * Compare the C compiler and Java FFM with separately computed numeric offsets.
 *
 * @param model - Finite Java graph layout model.
 */
export const jvmGraphLayoutProbe = model => {
	const c = [], java = [], expected = [];
	const path = (node, names) => `_GraphLayouts.${node.layoutName}.byteOffset(${names.map(name => `java.lang.foreign.MemoryLayout.PathElement.groupElement("${name}")`).join(", ")})`;
	for(const node of model.types)
	{
		c.push(`sizeof(${node.name})`, `_Alignof(${node.name})`);
		java.push(`_GraphLayouts.${node.layoutName}.byteSize()`, `_GraphLayouts.${node.layoutName}.byteAlignment()`);
		expected.push(node.size, node.alignment);
		if(!node.aggregate) continue;
		const fields = [["_bridge_owner", node.ownerOffset], ["_bridge_release", node.releaseOffset]];
		if(node.kind === "primitive" || node.element) fields.push(["data", node.dataOffset], ["length", node.lengthOffset]);
		if(node.ref.name === "int") fields.push(["negative", node.negativeOffset]);
		if(node.kind === "variant") fields.push(["kind", node.kindOffset], ["cases", node.payloadOffset]);
		if(node.kind === "option") fields.push(["has_value", node.flagOffset]);
		if(node.kind === "result") fields.push(["is_ok", node.flagOffset]);
		for(const field of node.fields) fields.push([field.name, field.offset]);
		for(const [name, offset] of fields)
		{ c.push(`offsetof(${node.name}, ${name})`); java.push(path(node, [name])); expected.push(offset); }
		for(const branch of node.cases) for(const field of branch.fields)
		{
			c.push(`offsetof(${node.name}, cases.${branch.name}.${field.name})`);
			java.push(path(node, ["cases", branch.name, field.name])); expected.push(node.payloadOffset + field.offset);
		}
	}
	return { count: c.length, expected
		, c: `static const size_t graph_layout[] = { ${c.join(", ")} };\nsize_t graph_fixture_layout_count(void) { return sizeof(graph_layout)/sizeof(*graph_layout); }\nsize_t graph_fixture_layout(size_t index) { return graph_layout[index]; }\n`
		, java: `static long[] layouts() { return new long[] { ${java.join(", ")} }; }\nstatic long[] expectedLayouts() { return new long[] { ${expected.join(", ")} }; }\n` };
};

/**
 * Generate test-only typed callers without replacing any conversion body.
 *
 * @param model - Generated Java conversions.
 * @param options - Select real Lean carriers or the independent C fixture.
 * @param options.compiledLean - Call freshly compiled Lean exports.
 */
export const jvmGraphProbe = (model, { compiledLean = false } = {}) => {
	const nodes = new Map(model.types.map(node => [node.id, node]));
	return `package ${model.namespace};
final class GraphProbe {
    private GraphProbe() { }
    static java.lang.foreign.SymbolLookup symbols;
    static java.lang.invoke.MethodHandle symbol(String name, java.lang.foreign.FunctionDescriptor descriptor) {
        return java.lang.foreign.Linker.nativeLinker().downcallHandle(symbols.find(name).orElseThrow(), descriptor);
    }
    static java.lang.invoke.MethodHandle boundSymbol(String name, int parameters) {
        java.lang.foreign.MemoryLayout[] arguments = new java.lang.foreign.MemoryLayout[parameters];
        java.util.Arrays.fill(arguments, java.lang.foreign.ValueLayout.ADDRESS);
        return symbol(name, java.lang.foreign.FunctionDescriptor.of(java.lang.foreign.ValueLayout.JAVA_INT, arguments));
    }
    static java.lang.invoke.MethodHandle nativeSymbol(String name, int parameters) { return boundSymbol("graph_fixture_" + name, parameters); }
    static final _GraphRuntime.Lifecycle lifecycle = new _GraphRuntime.Lifecycle() {
        public void before() { _GraphRuntime.status(count("initialize")); }
        public void after() { if (count("ready") == 0) throw new LeanBridgeException(5, "Lean runtime unavailable", null); }
        public void poison() { invokeVoid("retire"); }
    };
    static java.lang.invoke.MethodHandle clear;
    static int type(Class<?> value) {
        for (var node : _GraphTypes.NODES) if (node.kind() > 1 && node.hostType() == value) return node.id();
        throw new IllegalArgumentException(value.getName());
    }
    static int function(int type) {
        for (int index = 0; index < _GraphTypes.PARAMETERS.length; index++)
            if (_GraphTypes.PARAMETERS[index].length == 1 && _GraphTypes.PARAMETERS[index][0] == type && _GraphTypes.RESULTS[index] == type) return index;
        throw new IllegalArgumentException("No echo for type " + type);
    }
    static _GraphRuntime.Target target(String name, int count) { return new _GraphRuntime.Target(nativeSymbol(name, count), clear, lifecycle); }
    static int count(String name) {
        try { return (int)symbol("graph_fixture_" + name, java.lang.foreign.FunctionDescriptor.of(java.lang.foreign.ValueLayout.JAVA_INT)).invokeExact(); }
        catch (Throwable error) { throw new AssertionError(error); }
    }
    static void invokeVoid(String name) {
        try { symbol("graph_fixture_" + name, java.lang.foreign.FunctionDescriptor.ofVoid()).invokeExact(); }
        catch (Throwable error) { throw new AssertionError(error); }
    }
${compiledLean ? `    static void reset(long fail, long bad, int mode) {
        try { symbol("graph_fixture_reset", java.lang.foreign.FunctionDescriptor.ofVoid(java.lang.foreign.ValueLayout.JAVA_LONG, java.lang.foreign.ValueLayout.JAVA_LONG, java.lang.foreign.ValueLayout.JAVA_INT)).invokeExact(fail, bad, mode); }
        catch (Throwable error) { throw new AssertionError(error); }
    }` : `    static void reset(int mode) {
        try { symbol("graph_fixture_reset", java.lang.foreign.FunctionDescriptor.ofVoid(java.lang.foreign.ValueLayout.JAVA_INT)).invokeExact(mode); }
        catch (Throwable error) { throw new AssertionError(error); }
        invokeVoid("reset_lifecycle");
    }`}
${model.functions.map((fn, index) => {
		const name = fn.name.slice(model.layout.prefix.length + 1), symbol = { echo_link: "link", echo_result_link: "result_link" }[name] ?? name;
		const target = compiledLean && name !== "tree" ? `new _GraphRuntime.Target(boundSymbol("${fn.name}_graph", ${fn.parameters.length + 1}), clear, lifecycle)` : `target("${symbol}", ${fn.parameters.length + 1})`;
		return `    @SuppressWarnings("unchecked") static ${nodes.get(fn.result).publicType} ${fn.publicName}(${fn.parameters.map((id, i) => `${nodes.get(id).publicType} arg${i}`).join(", ")}) { return (${nodes.get(fn.result).publicType})_GraphRuntime.call(${index}, ${target}${fn.parameters.map((_, i) => `, (Object)arg${i}`).join("")}); }`;
}).join("\n")}
${jvmGraphLayoutProbe(model).java}
}
`;
};
