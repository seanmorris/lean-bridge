/**
 * Blittable C# views of the explicit-ownership native C ABI.
 *
 * @file
 */
import { generateOwnedCValues } from "../c/owned-values.mjs";

const primitives = {
	unit: ["byte", 1], bool: ["byte", 1], char: ["uint", 4]
	, uint8: ["byte", 1], uint16: ["ushort", 2], uint32: ["uint", 4]
	, uint64: ["ulong", 8], int8: ["sbyte", 1], int16: ["short", 2]
	, int32: ["int", 4], int64: ["long", 8], usize: ["ulong", 8]
	, isize: ["long", 8], float32: ["float", 4], float64: ["double", 8]
};
const align = (size, boundary) => Math.ceil(size / boundary) * boundary;

/**
 * Derive finite C# layouts without unfolding nominal recursion. Resource and
 * closure identities are pointer-width opaque keys, not copied record fields.
 * Nat and Int use read-only GMP pointers and never share managed allocators.
 *
 * @param ir - Concrete compiler-authenticated ownership contract.
 * @param options - Explicit transport capabilities.
 * @param options.transferredInputs - Admit consuming input leases.
 * @param options.anchoredResults - Admit original-owner result borrows.
 */
export const compileOwnedDotnetLayout = (ir, { transferredInputs = false, anchoredResults = false } = {}) => {
	const c = generateOwnedCValues(ir, { hostCallbacks: true, transferredInputs, anchoredResults });
	const types = c.nodes.map(node => ({ ...node
		, aggregate: !node.scalar && !node.integer && !node.identity
		, raw: node.identity || node.integer ? "nint" : node.scalar ? primitives[node.name][0] : `OwnedRaw${node.index}`
		, fields: node.fields.map((field, index) => ({ ...field, rawName: `Field${index}` }))
		, cases: node.cases.map((branch, index) => ({ ...branch
			, raw: `OwnedCase${node.index}_${index}`, rawName: `Case${index}`
			, fields: branch.fields.map((field, index) => ({ ...field, rawName: `Field${index}` })) })) }));
	const table = new Map(types.map(node => [node.id, node]));
	const fields = (members, start = 0) => {
		let size = start, alignment = 1;
		for(const field of members)
		{
			const child = table.get(field.type);
			const boundary = field.pointer ? 8 : child.alignment, width = field.pointer ? 8 : child.size;
			if(!boundary || !width) throw new TypeError("Owned C# has an unresolved inline layout dependency");
			field.offset = align(size, boundary); size = field.offset + width;
			alignment = Math.max(alignment, boundary);
		}
		return { size: Math.max(1, align(size, alignment)), alignment };
	};
	for(const node of [...types].sort((a, b) => Number(b.leaf) - Number(a.leaf)))
	{
		if(!node.aggregate)
		{
			node.size = node.integer || node.identity ? 8 : primitives[node.name][1];
			node.alignment = node.size;
		}
		else if(node.element || node.kind === "primitive")
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
	const sequential = "[global::System.Runtime.InteropServices.StructLayout(global::System.Runtime.InteropServices.LayoutKind.Sequential)]";
	const field = item => `    internal ${item.pointer ? "nint" : table.get(item.type).raw} ${item.rawName};`;
	const lines = [];
	for(const node of types.filter(node => node.aggregate))
	{
		if(node.kind === "variant")
		{
			for(const branch of node.cases) lines.push(sequential, `internal struct ${branch.raw}`, "{"
				, ...branch.fields.length ? branch.fields.map(field) : ["    internal byte Empty;"], "}");
			lines.push("[global::System.Runtime.InteropServices.StructLayout(global::System.Runtime.InteropServices.LayoutKind.Explicit)]"
				, `internal struct OwnedUnion${node.index}`, "{"
				, ...node.cases.map(branch => `    [global::System.Runtime.InteropServices.FieldOffset(0)] internal ${branch.raw} ${branch.rawName};`), "}");
		}
		lines.push(sequential, `internal struct ${node.raw}`, "{");
		if(node.element || node.kind === "primitive") lines.push("    internal nint Data;", "    internal nuint Length;");
		else if(node.kind === "variant") lines.push("    internal uint Kind;", `    internal OwnedUnion${node.index} Cases;`);
		else
		{
			if(["option", "result"].includes(node.kind)) lines.push("    internal byte Flag;");
			lines.push(...node.fields.map(field));
			if(!node.fields.length) lines.push("    internal byte Empty;");
		}
		lines.push("}");
	}
	const callbackLayouts = c.callbacks.map(callback => ({
		id: callback.id, name: `${table.get(callback.id).cName}_host`
		, raw: `OwnedCallback${table.get(callback.id).index}`, size: 32, alignment: 8
		, fields: ["call", "context", "closure", "recovery"].map((name, index) => ({
			name, rawName: name[0].toUpperCase() + name.slice(1), offset: index * 8
		}))
	}));
	for(const callback of callbackLayouts) lines.push(sequential, `internal struct ${callback.raw}`, "{"
		, ...callback.fields.map(field => `    internal nint ${field.rawName};`), "}");
	lines.push(sequential, "internal struct OwnedMpz", "{", "    internal int Allocated;", "    internal int Length;", "    internal nint Data;", "}");
	return { c, types, rawSource: lines.join("\n") + "\n", callbackLayouts
		, mpz: { size: 16, alignment: 8, allocated: 0, length: 4, data: 8 } };
};
