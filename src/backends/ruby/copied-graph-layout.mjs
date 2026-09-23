/**
 * Exact Linux x86-64 C storage for finite Ruby copied graph conversions.
 *
 * @file
 */
import { generateCopiedRubyGraphValues } from "./copied-graph-values.mjs";

const primitives = {
	unit: [1, "C"], bool: [1, "C"], char: [4, "L<"]
	, uint8: [1, "C"], uint16: [2, "S<"], uint32: [4, "L<"], uint64: [8, "Q<"]
	, int8: [1, "c"], int16: [2, "s<"], int32: [4, "l<"], int64: [8, "q<"]
	, usize: [8, "Q<"], isize: [8, "q<"]
	, float32: [4, "e"], float64: [8, "E"]
};
const align = (size, boundary) => Math.ceil(size / boundary) * boundary;

/**
 * Compute union padding and inline/pointer field offsets without unfolding a
 * recursive type. Independent compiler probes check these host assumptions.
 *
 * @param ir - Pure concrete copied Binding IR.
 */
export const compileCopiedRubyGraphLayout = ir => {
	const values = generateCopiedRubyGraphValues(ir);
	const types = values.types.map(node => ({ ...node
		, fields: node.fields.map(field => ({ ...field }))
		, cases: node.cases.map(branch => ({ ...branch, fields: branch.fields.map(field => ({ ...field })) })) }));
	const nodes = new Map(types.map(node => [node.id, node]));
	const fields = (members, start = 0) => {
		let size = start, alignment = 1;
		for(const field of members)
		{
			const child = nodes.get(field.type);
			const boundary = field.storage === "pointer" ? 8 : child.alignment;
			const width = field.storage === "pointer" ? 8 : child.size;
			if(!boundary || !width) throw new TypeError("Ruby graph has an unresolved inline dependency");
			field.offset = align(size, boundary); size = field.offset + width;
			alignment = Math.max(alignment, boundary);
		}
		return { size: Math.max(1, align(size, alignment)), alignment };
	};
	for(const id of values.layout.order)
	{
		const node = nodes.get(id);
		if(!node.aggregate)
		{
			const [size, pack] = primitives[node.ref.name];
			Object.assign(node, { size, alignment: size, pack }); continue;
		}
		node.alignment = 8; node.ownerOffset = 0; node.releaseOffset = 8;
		if(node.kind === "primitive" || node.element)
		{
			node.dataOffset = 16; node.lengthOffset = 24; node.size = node.ref.name === "int" ? 40 : 32;
			if(node.ref.name === "int") node.negativeOffset = 32;
		} else if(node.kind === "variant")
		{
			node.kindOffset = 16;
			for(const branch of node.cases) Object.assign(branch, fields(branch.fields));
			const boundary = Math.max(1, ...node.cases.map(branch => branch.alignment));
			const payloadSize = align(Math.max(1, ...node.cases.map(branch => branch.size)), boundary);
			node.payloadOffset = align(20, boundary);
			node.size = align(node.payloadOffset + payloadSize, node.alignment);
		} else
		{
			const flagged = ["option", "result"].includes(node.kind);
			if(flagged) node.flagOffset = 16;
			node.size = align(fields(node.fields, flagged ? 17 : 16).size, node.alignment);
		}
	}
	return { ...values, valuesSource: values.source, types };
};
