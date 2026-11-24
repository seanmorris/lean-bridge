/** @file Emit the exact Lean C externs that call copied CLR members through a scoped frame. */
import { generateDotnetHostMembers } from "./host-members.mjs";

const carrier = k => {
	let c = "lean_object *", box = v => v;
	const fixed = /^(?:u?int)(8|16|32|64)$/u.exec(k);
	const width = k === "bool" ? 8 : k === "char" ? 32 : fixed ? Number(fixed[1]) : null;
	if(width)
	{ c = "uint" + width + "_t"; box = v => (width < 32 ? "lean_box" : "lean_box_uint" + width) + "(" + v + ")"; }
	else if(["isize", "usize"].includes(k))
	{ c = "size_t"; box = v => "lean_box_usize(" + v + ")"; }
	else if(k === "float32" || k === "float64")
	{ c = k === "float32" ? "float" : "double"; box = v => (k === "float32" ? "lean_box_float32" : "lean_box_float") + "(" + v + ")"; }
	else if(!["unit", "nat", "int", "string", "bytes"].includes(k)) throw new TypeError("Unsupported CLR copied member site " + k);
	return { c, box, tag: "DN_" + k.toUpperCase() };
};
/**
 * Bind each managed callback slot to the source contract's exact Lean external symbol.
 *
 * @param ir - Checked imports in the selected CLR component.
 */
export const generateDotnetNativeMembers = async ir => {
	const model = await generateDotnetHostMembers(ir), headers = [], bodies = [];
	for(const [slot, m] of model.members.entries())
	{
		const receiver = m.mode === "new" || m.mode === "static" ? [] : [{ kind: "nominal" }];
		const sites = [...receiver, ...m.params].map(p => carrier(p.kind)), out = carrier(m.out.kind), n = sites.length;
		const proto = "lean_object *" + m.symbol + "(" + (sites.map((s, i) => s.c + " a" + i).join(",") || "void") + ")";
		headers.push(proto + ";");
		bodies.push(`${proto} {
    lean_object *v[${Math.max(1, n)}]={${sites.map((s, i) => s.box("a" + i)).join(",") || "NULL"}};
    uint64_t input[${Math.max(1, 3 * n)}]={0}, out[3]={0}; size_t budget=0;
    lb_dn_int_integer heap[${Math.max(1, n)}]={0}; lean_object *answer=NULL;
    ${sites.map((s, i) => `if(!dn_put(${s.tag},v[${i}],input+${3*i},&budget,heap+${i})) goto budget_error;`).join("\n    ")}
    answer=lb_dn_member(${slot},input,${n},out);
    if(!answer) {
        lean_object *result=dn_get(${out.tag},out);
        answer=result ? lean_io_result_mk_ok(result) : lb_dn_corrupt();
    }
    goto done;
budget_error: answer=lean_io_result_mk_error(lean_mk_io_user_error(lean_mk_string("CLR host copy budget exceeded or unavailable")));
done: for(size_t i=0;i<${n};i++){ lb_dn_int_integer_dispose(heap+i); lean_dec(v[i]); }
    return answer;
}`);
	}
	return { ...model, header: '#include <lean/lean.h>\n' + headers.join("\n"), native: '#include "host-wire.h"\n' + bodies.join("\n") };
};
