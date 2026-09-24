/**
 * Java FFM layouts for the finite native copied-graph ABI.
 *
 * @file
 */
import { generateCopiedJvmGraphValues } from "./copied-graph-values.mjs";

const primitives = {
	unit: ["BYTE", 1], bool: ["BYTE", 1], char: ["INT", 4]
	, uint8: ["BYTE", 1], uint16: ["SHORT", 2], uint32: ["INT", 4]
	, uint64: ["LONG", 8], int8: ["BYTE", 1], int16: ["SHORT", 2]
	, int32: ["INT", 4], int64: ["LONG", 8], usize: ["LONG", 8]
	, isize: ["LONG", 8], float32: ["FLOAT", 4], float64: ["DOUBLE", 8]
};
const align = (size, boundary) => Math.ceil(size / boundary) * boundary;
const memory = "java.lang.foreign.MemoryLayout", value = "java.lang.foreign.ValueLayout";

/**
 * Compute numeric offsets independently of the emitted FFM layout objects.
 * Named FFM members support independent offsetof/sizeof/alignment comparisons.
 *
 * @param ir - Concrete, copied Binding IR.
 */
export const compileCopiedJvmGraphLayout = ir => {
	const model = generateCopiedJvmGraphValues(ir);
	const types = model.types.map(node => ({ ...node, layoutName: `N${node.index}`
		, fields: node.fields.map(field => ({ ...field }))
		, cases: node.cases.map(branch => ({ ...branch, fields: branch.fields.map(field => ({ ...field })) })) }));
	const nodes = new Map(types.map(node => [node.id, node]));
	const fields = (items, start) => {
		let size = start, alignment = 1;
		for(const field of items)
		{
			const child = nodes.get(field.type), boundary = field.storage === "pointer" ? 8 : child.alignment;
			const width = field.storage === "pointer" ? 8 : child.size;
			if(!boundary || !width) throw new TypeError("Unresolved Java graph layout dependency");
			field.offset = align(size, boundary); size = field.offset + width; alignment = Math.max(alignment, boundary);
		}
		return { size: Math.max(1, align(size, alignment)), alignment };
	};
	const members = items => items.map(field => `${field.storage === "pointer" ? `${value}.ADDRESS` : nodes.get(field.type).layoutName}.withName("${field.name}")`);
	const declarations = [];
	for(const id of model.layout.order)
	{
		const node = nodes.get(id), layout = [];
		if(!node.aggregate)
		{
			node.size = primitives[node.ref.name][1]; node.alignment = node.size;
			declarations.push(`    static final ${memory} ${node.layoutName} = ${value}.JAVA_${primitives[node.ref.name][0]};`);
			continue;
		}
		node.alignment = 8; node.ownerOffset = 0; node.releaseOffset = 8;
		layout.push(`${value}.ADDRESS.withName("_bridge_owner")`, `${value}.ADDRESS.withName("_bridge_release")`);
		if(node.kind === "primitive" || node.element)
		{
			node.dataOffset = 16; node.lengthOffset = 24; node.size = node.ref.name === "int" ? 40 : 32;
			layout.push(`${value}.ADDRESS.withName("data")`, `${value}.JAVA_LONG.withName("length")`);
			if(node.ref.name === "int")
			{ node.negativeOffset = 32; layout.push(`${value}.JAVA_BYTE.withName("negative")`); }
		} else if(node.kind === "variant")
		{
			node.kindOffset = 16;
			for(const branch of node.cases) Object.assign(branch, fields(branch.fields, 0));
			const alignment = Math.max(1, ...node.cases.map(branch => branch.alignment));
			node.payloadOffset = align(20, alignment);
			node.size = align(node.payloadOffset + align(Math.max(1, ...node.cases.map(branch => branch.size)), alignment), 8);
			for(const [index, branch] of node.cases.entries())
				declarations.push(`    private static ${memory} case${node.index}_${index}() { return struct(${members(branch.fields).join(", ") || `${value}.JAVA_BYTE.withName("empty")`}).withName("${branch.name}"); }`);
			layout.push(`${value}.JAVA_INT.withName("kind")`, `${memory}.unionLayout(${node.cases.map((_, index) => `case${node.index}_${index}()`).join(", ")}).withName("cases")`);
		} else
		{
			const flagged = ["option", "result"].includes(node.kind);
			if(flagged)
			{ node.flagOffset = 16; layout.push(`${value}.JAVA_BYTE.withName("${node.kind === "option" ? "has_value" : "is_ok"}")`); }
			node.size = align(fields(node.fields, flagged ? 17 : 16).size, 8); layout.push(...members(node.fields));
		}
		declarations.push(`    private static ${memory} make${node.index}() { return struct(${layout.join(", ")}); }\n    static final ${memory} ${node.layoutName} = make${node.index}();`);
	}
	const layoutSource = `package ${model.namespace};

final class _GraphLayouts {
    private _GraphLayouts() { }
    private static ${memory} struct(${memory}... fields) {
        var values = new java.util.ArrayList<${memory}>();
        long size = 0, alignment = 1;
        for (var field : fields) {
            long padding = (field.byteAlignment() - size % field.byteAlignment()) % field.byteAlignment();
            if (padding != 0) values.add(${memory}.paddingLayout(padding));
            values.add(field); size += padding + field.byteSize(); alignment = java.lang.Math.max(alignment, field.byteAlignment());
        }
        long padding = (alignment - size % alignment) % alignment;
        if (padding != 0) values.add(${memory}.paddingLayout(padding));
        return ${memory}.structLayout(values.toArray(${memory}[]::new));
    }
${declarations.join("\n")}
}
`;
	return { ...model, types, layoutSource };
};
