/** @file Resolve a JVM host contract into private, exact-signature Java adapters. */
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../capsule/node.mjs";
import { nativeHostSelection } from "../../analyze/host-export-model.mjs";
import { generateLeanHostObjectAdapters, hostDeclarationName, hostMemberSymbol } from "../lean/host-object.mjs";

const java = { bool: "boolean", char: "int", uint8: "int", uint16: "int"
	, uint32: "long"
	, uint64: "java.math.BigInteger"
	, int8: "byte"
	, int16: "short"
	, int32: "int"
	, int64: "long"
	, usize: "java.math.BigInteger"
	, isize: "long"
	, nat: "java.math.BigInteger"
	, int: "java.math.BigInteger"
	, float32: "float", float64: "double", bytes: "byte[]", string: "String" };
const fail = reason => { throw new TypeError("Unsupported JVM host member: " + reason); };
const quote = JSON.stringify;

/**
 * Produce the private Java dispatch table and matching native symbol order.
 * Object kinds are represented by bound class tokens, never class-name lookup.
 *
 * @param ir - The host import contract used to generate the checked Lean module.
 */
export const generateJvmHostMembers = async ir => {
	generateLeanHostObjectAdapters(ir);
	nativeHostSelection(ir, "jvm");
	const types = ir.types;
	if(!types.length || types.length > 64 || new Set(types.map(t => t.resource.kindId)).size !== types.length) fail("expected distinct nominal kinds");
	const kinds = types.map(t => ({ key: sha256(canonicalJson([ir.component.id, t.id, t.resource.kindId])), strong: t.host.identity === "strong-canonical" }));
	if(types.some(t => t.host.dynamic || !["weak-canonical", "strong-canonical"].includes(t.host.identity))) fail("dynamic or unknown identity");
	const site = (s, result = false) => {
		const ref = s.type, i = ref.kind === "named" ? types.findIndex(t => t.id === ref.id) : -1;
		if(i >= 0) return { kind: "nominal", token: "types[" + i + "]", index: i };
		if(ref.kind !== "primitive" || s.ownership !== "copy" || s.lifetime !== null) fail("expected copied scalar or nominal object");
		if(ref.name === "unit") return { kind: "unit", token: result ? "void.class" : "unit" };
		if(!Object.hasOwn(java, ref.name)) fail("unknown scalar " + ref.name);
		return { kind: ref.name, token: java[ref.name] + ".class" };
	};
	const render = s => "new HostMembers.Site(" + quote(s.kind) + ", " + s.token + ")";
	const members = types.flatMap((t, i) => ir.declarations.filter(d => d.owner === t.id).map(d => {
		const mode = ({ constructor: "new", property: "instance", method: "instance", "static-method": "static" })[d.kind];
		if(!mode || d.resultMode !== "value" || d.typeParameters.length || d.parameters.some(p => p.optional || p.default !== null)
			|| !/^[A-Za-z_][A-Za-z0-9_]*$/u.test(d.name) || Boolean(d.receiver) !== (mode === "instance")
			|| (d.receiver && site(d.receiver).index !== i)) fail("invalid synchronous member " + d.id);
		const params = d.parameters.map(s => site(s)), out = site(d.result, true);
		if((mode === "new" && out.index !== i) || (d.kind === "property" && (params.length > 1 || (params.length && out.kind !== "unit")))) fail("invalid constructor or property");
		const name = hostDeclarationName(d);
		const fields = ["types[" + i + "]", quote(mode), quote(name), ...[out, ...params].map(render)];
		const spec = "new HostMembers.Spec(" + fields.join(", ") + ")";
		return { id: d.id, symbol: hostMemberSymbol("jvm", t, d), name, mode, owner: i, params, out, spec };
	}));
	const implementation = await readFile(new URL("./host-members.java", import.meta.url), "utf8");
	const contract = `final class HostContract {
    private HostContract() {}
    static HostMembers bind(Class<?> unit, Class<?>... supplied) {
        Class<?>[] types = supplied.clone();
        if (types.length != ${types.length}) throw new IllegalArgumentException("wrong number of nominal host classes");
        for (Class<?> t : types) if (t == null || t.isPrimitive() || t.isArray()) throw new IllegalArgumentException("expected host class");
        if (unit == null || unit.isPrimitive() || unit.isArray()) throw new IllegalArgumentException("expected component Unit class");
        return new HostMembers(types,
            ${members.map(m => m.spec).join(",\n            ")}
        );
    }
}
`;
	return { implementation, contract, members, kinds };
};
