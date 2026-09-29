/**
 * Exact Linux x86-64 public C layouts for resource-aware Ruby conversions.
 *
 * @file
 */
import { generateOwnedRubyValues } from "./owned-values.mjs";

const primitives = {
	unit: [1, "C"], bool: [1, "C"], char: [4, "L<"]
	, uint8: [1, "C"], uint16: [2, "S<"], uint32: [4, "L<"], uint64: [8, "Q<"]
	, int8: [1, "c"], int16: [2, "s<"], int32: [4, "l<"], int64: [8, "q<"]
	, usize: [8, "Q<"], isize: [8, "q<"]
	, float32: [4, "e"], float64: [8, "E"]
};
const align = (size, boundary) => Math.ceil(size / boundary) * boundary;

/**
 * Compute C union padding without unfolding recursive nominal definitions.
 * Scalar and identity leaves stay inline; non-leaf fields use C indirection.
 * Independent C compiler probes must verify these Fiddle storage assumptions.
 *
 * @param ir - Concrete ownership-aware Binding IR.
 * @param options - Explicit C transport capabilities.
 */
export const compileOwnedRubyLayout = (ir, options = {}) => {
	const values = generateOwnedRubyValues(ir, options);
	const types = values.types.map(node => ({ ...node
		, aggregate: !node.scalar && !node.integer && !node.identity
		, fields: node.fields.map(field => ({ ...field }))
		, cases: node.cases.map(branch => ({ ...branch, fields: branch.fields.map(field => ({ ...field })) })) }));
	const table = new Map(types.map(node => [node.id, node]));
	const fields = (members, start = 0) => {
		let size = start, alignment = 1;
		for(const field of members)
		{
			const child = table.get(field.type);
			const boundary = field.pointer ? 8 : child.alignment, width = field.pointer ? 8 : child.size;
			if(!boundary || !width) throw new TypeError("Owned Ruby has an unresolved inline dependency");
			field.offset = align(size, boundary); size = field.offset + width;
			alignment = Math.max(alignment, boundary);
		}
		return { size: Math.max(1, align(size, alignment)), alignment };
	};
	for(const node of [...types].sort((a, b) => Number(b.leaf) - Number(a.leaf)))
	{
		if(!node.aggregate)
		{
			const [size, pack] = node.identity || node.integer ? [8, "Q<"] : primitives[node.name];
			Object.assign(node, { size, alignment: size, pack });
		}
		else if(node.kind === "primitive" || node.element)
			Object.assign(node, { size: 16, alignment: 8, dataOffset: 0, lengthOffset: 8 });
		else if(node.kind === "variant")
		{
			for(const branch of node.cases) Object.assign(branch, fields(branch.fields));
			const boundary = Math.max(1, ...node.cases.map(branch => branch.alignment));
			const payloadSize = align(Math.max(1, ...node.cases.map(branch => branch.size)), boundary);
			node.alignment = Math.max(4, boundary); node.kindOffset = 0;
			node.payloadOffset = align(4, boundary);
			node.size = align(node.payloadOffset + payloadSize, node.alignment);
		}
		else
		{
			const flagged = ["option", "result"].includes(node.kind);
			if(flagged) node.flagOffset = 0;
			Object.assign(node, fields(node.fields, flagged ? 1 : 0));
		}
	}
	const callbackLayouts = values.c.callbacks.map(callback => ({
		id: callback.id, name: `${table.get(callback.id).cName}_host`
		, size: 32, alignment: 8
		, fields: ["call", "context", "closure", "recovery"].map((name, index) => ({ name, offset: index * 8 }))
	}));
	return { ...values, types, valuesSource: values.source, callbackLayouts
		, mpz: { size: 16, alignment: 8, allocated: 0, length: 4, data: 8 } };
};
