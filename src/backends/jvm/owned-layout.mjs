/**
 * Private Java FFM layouts for the explicitly owned native value ABI.
 *
 * @file
 */
import { generateOwnedCValues } from "../c/owned-values.mjs";

const primitives = {
	unit: ["BYTE", "byte", 1], bool: ["BYTE", "byte", 1], char: ["INT", "int", 4]
	, uint8: ["BYTE", "byte", 1], uint16: ["SHORT", "short", 2]
	, uint32: ["INT", "int", 4], uint64: ["LONG", "long", 8]
	, int8: ["BYTE", "byte", 1], int16: ["SHORT", "short", 2]
	, int32: ["INT", "int", 4], int64: ["LONG", "long", 8]
	, usize: ["LONG", "long", 8], isize: ["LONG", "long", 8]
	, float32: ["FLOAT", "float", 4], float64: ["DOUBLE", "double", 8]
};
const align = (size, boundary) => Math.ceil(size / boundary) * boundary;
const memory = "java.lang.foreign.MemoryLayout", value = "java.lang.foreign.ValueLayout";

/**
 * Calculate numeric offsets independently of the emitted FFM layout objects.
 * Resource and closure leaves carry opaque pointers; GMP values are read-only
 * pointers. Aggregate children use indirection, keeping nominal recursion finite.
 *
 * @param ir - Concrete compiler-authenticated ownership contract.
 * @param options - Explicit transport capabilities.
 * @param options.transferredInputs - Enable consuming input leases.
 * @param options.anchoredResults - Enable original-owner borrowed results.
 */
export const compileOwnedJvmLayout = (ir, { transferredInputs = false, anchoredResults = false } = {}) => {
	const c = generateOwnedCValues(ir, { hostCallbacks: true, transferredInputs, anchoredResults });
	const types = c.nodes.map(node => ({ ...node
		, aggregate: !node.scalar && !node.integer && !node.identity
		, layoutName: `O${node.index}`
		, raw: node.scalar ? primitives[node.name][1] : "java.lang.foreign.MemorySegment"
		, fields: node.fields.map(field => ({ ...field }))
		, cases: node.cases.map((branch, index) => ({ ...branch
			, layoutName: `C${node.index}_${index}`
			, fields: branch.fields.map(field => ({ ...field })) })) }));
	const table = new Map(types.map(node => [node.id, node]));
	const fields = (members, start = 0) => {
		let size = start, alignment = 1;
		for(const field of members)
		{
			const child = table.get(field.type);
			const boundary = field.pointer ? 8 : child.alignment;
			const width = field.pointer ? 8 : child.size;
			if(!boundary || !width) throw new TypeError("Owned JVM has an unresolved inline layout dependency");
			field.offset = align(size, boundary); size = field.offset + width;
			alignment = Math.max(alignment, boundary);
		}
		return { size: Math.max(1, align(size, alignment)), alignment };
	};
	const members = items => items.map(field => `${field.pointer ? value + ".ADDRESS" : table.get(field.type).layoutName}.withName("${field.name}")`);
	const declarations = [];
	for(const node of [...types].sort((a, b) => Number(b.leaf) - Number(a.leaf)))
	{
		if(!node.aggregate)
		{
			node.size = node.integer || node.identity ? 8 : primitives[node.name][2];
			node.alignment = node.size;
			node.valueLayout = node.integer || node.identity ? value + ".ADDRESS" : value + ".JAVA_" + primitives[node.name][0];
			declarations.push(`    static final ${memory} ${node.layoutName} = ${node.valueLayout};`);
			continue;
		}
		const layout = [];
		if(node.element || node.kind === "primitive")
		{
			Object.assign(node, { size: 16, alignment: 8, dataOffset: 0, lengthOffset: 8 });
			layout.push(`${value}.ADDRESS.withName("data")`, `${value}.JAVA_LONG.withName("length")`);
		}
		else if(node.kind === "variant")
		{
			for(const branch of node.cases) Object.assign(branch, fields(branch.fields));
			const boundary = Math.max(1, ...node.cases.map(branch => branch.alignment));
			const payloadSize = align(Math.max(1, ...node.cases.map(branch => branch.size)), boundary);
			node.alignment = Math.max(4, boundary); node.kindOffset = 0;
			node.payloadOffset = align(4, boundary);
			node.size = align(node.payloadOffset + payloadSize, node.alignment);
			for(const branch of node.cases)
				declarations.push(`    static final ${memory} ${branch.layoutName} = struct(${members(branch.fields).join(", ") || value + '.JAVA_BYTE.withName("empty")'});`);
			layout.push(`${value}.JAVA_INT.withName("kind")`
				, `${memory}.unionLayout(${node.cases.map(branch => `${branch.layoutName}.withName("${branch.name}")`).join(", ")}).withName("cases")`);
		}
		else
		{
			const flagged = ["option", "result"].includes(node.kind);
			if(flagged)
			{
				node.flagOffset = 0;
				layout.push(`${value}.JAVA_BYTE.withName("${node.kind === "option" ? "has_value" : "is_ok"}")`);
			}
			Object.assign(node, fields(node.fields, flagged ? 1 : 0));
			layout.push(...members(node.fields));
			if(!layout.length) layout.push(`${value}.JAVA_BYTE.withName("empty")`);
		}
		declarations.push(`    static final ${memory} ${node.layoutName} = struct(${layout.join(", ")});`);
	}
	const callbackLayouts = c.callbacks.map(callback => ({
		id: callback.id, name: `${table.get(callback.id).cName}_host`
		, layoutName: `H${table.get(callback.id).index}`, size: 32, alignment: 8
		, fields: ["call", "context", "closure", "recovery"].map((name, index) => ({ name, offset: index * 8 }))
	}));
	for(const callback of callbackLayouts)
		declarations.push(`    static final ${memory} ${callback.layoutName} = struct(${callback.fields.map(field => `${value}.ADDRESS.withName("${field.name}")`).join(", ")});`);
	declarations.push(`    static final ${memory} MPZ = struct(${value}.JAVA_INT.withName("allocated"), ${value}.JAVA_INT.withName("length"), ${value}.ADDRESS.withName("data"));`);
	const namespace = `org.leanbridge.${c.prefix}`;
	const layoutSource = `package ${namespace};

final class _OwnedLayouts {
    private _OwnedLayouts() { }
    private static ${memory} struct(${memory}... fields) {
        var values = new java.util.ArrayList<${memory}>();
        long size = 0, alignment = 1;
        for (var field : fields) {
            long padding = (field.byteAlignment() - size % field.byteAlignment()) % field.byteAlignment();
            if (padding != 0) values.add(${memory}.paddingLayout(padding));
            values.add(field); size += padding + field.byteSize();
            alignment = java.lang.Math.max(alignment, field.byteAlignment());
        }
        long padding = (alignment - size % alignment) % alignment;
        if (padding != 0) values.add(${memory}.paddingLayout(padding));
        return ${memory}.structLayout(values.toArray(${memory}[]::new));
    }
${declarations.join("\n")}
}
`;
	return { c, types, namespace, layoutSource, callbackLayouts
		, mpz: { size: 16, alignment: 8, allocated: 0, length: 4, data: 8 } };
};
