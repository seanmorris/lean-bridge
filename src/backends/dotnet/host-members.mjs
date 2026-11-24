/** @file Bind exact CLR members from a checked Lean host-import contract. */
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../capsule/node.mjs";
import { nativeHostSelection } from "../../analyze/host-export-model.mjs";
import { generateLeanHostObjectAdapters, hostMemberSymbol } from "../lean/host-object.mjs";

const scalar = { unit: "void", bool: "bool", char: "System.Text.Rune"
	, uint8: "byte", int8: "sbyte", uint16: "ushort", int16: "short"
	, uint32: "uint", int32: "int", uint64: "ulong", int64: "long"
	, usize: "nuint", isize: "nint", float32: "float", float64: "double"
	, bytes: "byte[]", string: "string", nat: "System.Numerics.BigInteger"
	, int: "System.Numerics.BigInteger" };
const fail = why => { throw new TypeError("Invalid CLR host member: " + why); };
const pascal = s => s.split("_").filter(Boolean).map(p => p[0].toUpperCase() + p.slice(1)).join("");
/**
 * Generate a private binder; compiled applications never expose slot IDs or raw handles.
 *
 * @param ir - Validated target-specific host imports.
 */
export const generateDotnetHostMembers = async ir => {
	generateLeanHostObjectAdapters(ir); nativeHostSelection(ir, "dotnet");
	const types = ir.types;
	if(types.length > 64 || types.some(t => t.host.dynamic || !["weak-canonical", "strong-canonical"].includes(t.host.identity))) fail("unsupported nominal class");
	const site = s => {
		const r = s.type, index = types.findIndex(t => r.kind === "named" && t.id === r.id);
		if(index >= 0) return { kind: "nominal", index, token: "types[" + index + "]" };
		if(r.kind !== "primitive" || !Object.hasOwn(scalar, r.name) || s.ownership !== "copy" || s.lifetime !== null) fail("expected a copied scalar or nominal class");
		return { kind: r.name, token: "typeof(" + scalar[r.name] + ")" };
	};
	const render = s => 'new HostMembers.Site("' + s.kind + '", ' + s.token + ")";
	const members = types.flatMap((t, i) => ir.declarations.filter(d => d.owner === t.id).map(d => {
		const mode = d.kind === "property" ? d.parameters.length ? "set" : "get" : ({ constructor: "new", method: "instance", "static-method": "static" })[d.kind];
		const instance = ["set", "get", "instance"].includes(mode);
		if(!mode || d.resultMode !== "value" || d.typeParameters.length || d.parameters.length > 63
			|| !/^[A-Za-z][A-Za-z0-9_]*$/u.test(d.name) || instance !== Boolean(d.receiver) || (instance && site(d.receiver).index !== i)
			|| d.parameters.some(p => p.optional || p.default !== null)) fail(d.id);
		const params = d.parameters.map(site), out = site(d.result);
		if((mode === "new" && out.index !== i) || (mode === "set" && (params.length !== 1 || out.kind !== "unit" || params[0].kind === "unit"))) fail(d.id);
		const name = pascal(d.name), fields = ["types[" + i + "]", JSON.stringify(mode), JSON.stringify(name), render(out), ...params.map(render)];
		return { id: d.id, owner: i, mode, name, params, out, symbol: hostMemberSymbol("dotnet", t, d), spec: "new HostMembers.Spec(" + fields.join(", ") + ")" };
	}));
	const implementation = await readFile(new URL("./host-members.cs", import.meta.url), "utf8");
	const contract = `internal static class HostContract {
    internal static HostMembers Bind(params System.Type[] supplied) {
        var types=(System.Type[])supplied.Clone();
        if(types.Length!=${types.length}) throw new System.ArgumentException("Wrong number of host classes");
        return new HostMembers(types, ${members.map(m => m.spec).join(",\n            ")});
    }
}
`;
	const kinds = types.map(t => ({ key: sha256(canonicalJson([ir.component.id, t.id, t.resource.kindId])), strong: t.host.identity === "strong-canonical" }));
	return { implementation, contract, members, kinds };
};
