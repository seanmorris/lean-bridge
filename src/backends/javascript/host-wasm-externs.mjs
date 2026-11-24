/** @file Emit Lean's synchronous application-host symbols for a wasm32 side module. */
import { componentScalarTypes } from "../../abi/component-scalars.mjs";
import { javaScriptHostMembers } from "./host-members.mjs";

// These are Lean C carriers, not the application's JavaScript types. Signed
// fixed-width arguments use the same unsigned bit carrier in Lean-generated C.
const carrier = type => {
	if(typeof type === "number" || ["unit", "nat", "int", "string", "bytes"].includes(type))
		return ["lean_object *", null];
	if(type === "float32" || type === "float64")
		return type === "float32" ? ["float", "lean_box_float32"] : ["double", "lean_box_float"];
	if(type === "usize" || type === "isize") return ["size_t", "lean_box_usize"];
	const width = type === "bool" ? 8 : type === "char" ? 32 : Number(type.match(/\d+$/u)[0]);
	return ["uint" + width + "_t", width < 32 ? "lean_box" : "lean_box_uint" + width];
};
const tag = type => typeof type === "number" ? 64 + type : componentScalarTypes.indexOf(type);

/**
 * Generate only private component entry points. Force-include renames when
 * compiling every Lean source so two packages importing the same contract
 * cannot interpose on each other's provider. The domain hooks sit outside
 * the entry shims: canonical identity and error frames belong to the heap.
 *
 * @param ir - Checked application host declarations.
 * @param identity - Immutable component build identity.
 */
export const generateJavaScriptHostExterns = (ir, identity) => {
	if(!/^[a-f0-9]{64}$(?![\s\S])/u.test(identity)) throw new TypeError("Invalid JavaScript host component identity");
	const model = javaScriptHostMembers(ir), prefix = "lb_jsh_" + identity + "_";
	const names = [], entries = [], declarations = [];
	for(const [slot, m] of model.members.entries())
	{
		const args = m.args.map(carrier), n = args.length, name = prefix + "member_" + slot;
		names.push("#define " + m.symbol + " " + name);
		const signature = "lean_object *" + name + "(" + (args.map(([c], i) => c + " a" + i).join(",") || "void") + ")";
		declarations.push(signature + ";");
		entries.push(signature + " {"
			, "    static const uint8_t tags[] = {" + (m.args.map(tag).join(",") || 0) + "};"
			, "    lean_object *values[] = {" + (args.map(([, box], i) => box ? box + "(a" + i + ")" : "a" + i).join(",") || "NULL") + "};"
			, "    lean_object *io = lb_host_invoke(" + [slot, n, "tags", tag(m.result), m.anchor ?? -1, "values"].join(",") + ");"
			, ...args.flatMap(([, box], i) => box || m.inputOwnership[i] !== "borrow" ? ["    lean_dec(values[" + i + "]);"] : [])
			, "    return io;", "}");
	}
	const hooks = ["token", "wrap", "send", "finish", "error"].map(name => "#define lb_host_" + name + " " + prefix + name);
	return {model, prefix
		, renames: names.join("\n") + "\n"
		, declarations: declarations.join("\n") + "\n"
		, source: [...hooks, '#include "host-wasm-wire.h"', ...entries].join("\n") + "\n"};
};
