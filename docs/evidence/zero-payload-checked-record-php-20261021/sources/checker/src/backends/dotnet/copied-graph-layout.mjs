/**
 * Blittable C# storage for the finite, compiler-authenticated native graph ABI.
 *
 * @file
 */
import { generateCopiedDotnetGraphValues } from "./copied-graph-values.mjs";

const primitives = {
	unit: ["byte", 1], bool: ["byte", 1], char: ["uint", 4]
	, uint8: ["byte", 1], uint16: ["ushort", 2], uint32: ["uint", 4]
	, uint64: ["ulong", 8], int8: ["sbyte", 1], int16: ["short", 2]
	, int32: ["int", 4], int64: ["long", 8], usize: ["ulong", 8]
	, isize: ["long", 8], float32: ["float", 4], float64: ["double", 8]
};
const align = (size, boundary) => Math.ceil(size / boundary) * boundary;

/**
 * Keep native structs separate from public records. Cyclic or oversized native
 * edges use pointers; explicit unions contain only unmanaged, finite structs.
 *
 * @param ir - Concrete copied Binding IR.
 */
export const compileCopiedDotnetGraphLayout = ir => {
	const values = generateCopiedDotnetGraphValues(ir);
	const types = values.types.map(node => ({ ...node
		, raw: node.aggregate ? `GraphRaw${node.index}` : primitives[node.ref.name][0]
		, fields: node.fields.map(field => ({ ...field }))
		, cases: node.cases.map(branch => ({ ...branch, fields: branch.fields.map(field => ({ ...field })) })) }));
	const nodes = new Map(types.map(node => [node.id, node]));
	const fields = (items, start) => {
		let size = start, alignment = 1;
		for(const field of items)
		{
			const child = nodes.get(field.type), boundary = field.storage === "pointer" ? 8 : child.alignment;
			const width = field.storage === "pointer" ? 8 : child.size;
			if(!boundary || !width) throw new TypeError("Unresolved C# graph layout dependency");
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
			node.size = primitives[node.ref.name][1]; node.alignment = node.size; continue;
		}
		node.alignment = 8; node.ownerOffset = 0; node.releaseOffset = 8;
		if(node.kind === "primitive" || node.element)
		{
			node.dataOffset = 16; node.lengthOffset = 24; node.size = node.ref.name === "int" ? 40 : 32;
			if(node.ref.name === "int") node.negativeOffset = 32;
		} else if(node.kind === "variant")
		{
			node.kindOffset = 16;
			for(const branch of node.cases) Object.assign(branch, fields(branch.fields, 0));
			const alignment = Math.max(1, ...node.cases.map(branch => branch.alignment));
			node.payloadOffset = align(20, alignment);
			node.size = align(node.payloadOffset + align(Math.max(1, ...node.cases.map(branch => branch.size)), alignment), 8);
		} else
		{
			const flagged = ["option", "result"].includes(node.kind);
			if(flagged) node.flagOffset = 16;
			node.size = align(fields(node.fields, flagged ? 17 : 16).size, 8);
		}
	}
	const sequential = "[global::System.Runtime.InteropServices.StructLayout(global::System.Runtime.InteropServices.LayoutKind.Sequential)]";
	const member = (field, index) => `    internal ${field.storage === "pointer" ? "nint" : nodes.get(field.type).raw} Field${index};`;
	const lines = [];
	for(const node of types.filter(node => node.aggregate))
	{
		const i = node.index;
		if(node.kind === "variant")
		{
			for(const [j, branch] of node.cases.entries()) lines.push(sequential, `internal struct GraphCase${i}_${j}`, "{"
				, ...branch.fields.length ? branch.fields.map(member) : ["    internal byte Empty;"], "}");
			lines.push("[global::System.Runtime.InteropServices.StructLayout(global::System.Runtime.InteropServices.LayoutKind.Explicit)]", `internal struct GraphUnion${i}`, "{"
				, ...node.cases.map((_, j) => `    [global::System.Runtime.InteropServices.FieldOffset(0)] internal GraphCase${i}_${j} Case${j};`), "}");
		}
		lines.push(sequential, `internal struct ${node.raw}`, "{", "    internal nint Owner;", "    internal nint Release;");
		if(node.kind === "primitive" || node.element)
		{
			lines.push("    internal nint Data;", "    internal nuint Length;");
			if(node.ref.name === "int") lines.push("    internal byte Negative;");
		} else if(node.kind === "variant") lines.push("    internal uint Kind;", `    internal GraphUnion${i} Cases;`);
		else
		{
			if(["option", "result"].includes(node.kind)) lines.push("    internal byte Flag;");
			lines.push(...node.fields.map(member));
		}
		lines.push("}", "");
	}
	return { ...values, valuesSource: values.source, types, rawSource: lines.join("\n") };
};
