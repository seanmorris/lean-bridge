/** @file Emit Lean's synchronous application-host symbols for a wasm32 side module. */
import { componentScalarTypes } from "../../abi/component-scalars.mjs";
import { javaScriptHostMembers } from "./host-members.mjs";

// These are Lean C carriers, not the application's JavaScript types. Signed
// fixed-width arguments use the same unsigned bit carrier in Lean-generated C.
/**
 * Determine the actual Lean C argument type and its boxing operation.
 *
 * @param type - Checked scalar name or nominal kind index.
 */
export const javaScriptHostCarrier = type => {
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
 * @param options - Select the owner-dispatched pthread ABI for a task component.
 */
export const generateJavaScriptHostExterns = (ir, identity, options={}) => {
	if(!/^[a-f0-9]{64}$(?![\s\S])/u.test(identity)) throw new TypeError("Invalid JavaScript host component identity");
	const model = javaScriptHostMembers(ir), prefix = "lb_jsh_" + identity + "_";
	const names = [], entries = [], declarations = [];
	const invoke=options.threaded ? "lb_jst_member_v1("+JSON.stringify(identity)+"," : "lb_host_invoke(";
	for(const [slot, m] of model.members.entries())
	{
		const args = m.args.map(javaScriptHostCarrier), n = args.length, name = prefix + "member_" + slot;
		names.push("#define " + m.symbol + " " + name);
		const signature = "lean_object *" + name + "(" + (args.map(([c], i) => c + " a" + i).join(",") || "void") + ")";
		declarations.push(signature + ";");
		entries.push(signature + " {"
			, "    static const uint8_t tags[] = {" + (m.args.map(tag).join(",") || 0) + "};"
			, "    lean_object *values[] = {" + (args.map(([, box], i) => box ? box + "(a" + i + ")" : "a" + i).join(",") || "NULL") + "};"
			, "    lean_object *io = "+invoke + [slot, n, "tags", tag(m.result), m.anchor ?? -1, "values"].join(",") + ");"
			, ...args.flatMap(([, box], i) => box || m.inputOwnership[i] !== "borrow" ? ["    lean_dec(values[" + i + "]);"] : [])
			, "    return io;", "}");
	}
	if(options.threaded) return {model,prefix,service: ""
		, renames: names.join("\n")+"\n"
		, declarations: declarations.join("\n")+"\n"
		, source: ['#include <lean/lean.h>'
			, 'extern lean_obj_res lb_jst_member_v1(const char *,unsigned,unsigned,const uint8_t *,unsigned,int,lean_object **);'
			, ...entries].join("\n")+"\n"};
	const hooks = ["token", "wrap", "send", "finish", "error"].map(name => "#define lb_host_" + name + " " + prefix + name);
	const js = 'Module["lbJshDomainV1"]', id = JSON.stringify(identity);
	const service = `#include "host-wasm-domain.h"
#include <emscripten.h>
EM_JS(uint32_t, ${prefix}kind, (unsigned i), { return ${js}.kind(${id},i>>>0); });
EM_JS(uint32_t, ${prefix}send, (unsigned slot,unsigned n,const bridge_scalar_slot *args,bridge_scalar_slot *reply), {
    return ${js}.send(${id},slot>>>0,n>>>0,args>>>0,reply>>>0);
});
EM_JS(void, ${prefix}finish, (bridge_scalar_slot *reply), { ${js}.finish(${id},reply>>>0); });
EM_JS(uint32_t, ${prefix}record, (unsigned status,const bridge_scalar_slot *reply), {
    return ${js}.record(${id},status>>>0,reply>>>0);
});
uint32_t ${prefix}token(uint32_t kind,b_lean_obj_arg o) {
    return lb_jsh_domain_token_v1(${prefix}kind(kind),o);
}
lean_obj_res ${prefix}wrap(uint32_t kind,uint32_t token,b_lean_obj_arg anchor) {
    return lb_jsh_domain_wrap_v1(${prefix}kind(kind),token,anchor);
}
lean_obj_res ${prefix}error(uint32_t status,const bridge_scalar_slot *reply) {
    return lb_jsh_domain_error_v1(status,${prefix}record(status,reply));
}
`;
	return {model, prefix
		, service
		, renames: names.join("\n") + "\n"
		, declarations: declarations.join("\n") + "\n"
		, source: [...hooks, '#include "host-wasm-wire.h"', ...entries].join("\n") + "\n"};
};
