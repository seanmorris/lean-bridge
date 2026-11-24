/** @file Emit the exact Lean C externs that call CLR members through a scoped frame. */
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
		const d = ir.declarations.find(v => v.id === m.id);
		const refs = [...d.receiver ? [d.receiver] : [], ...d.parameters];
		const receiver = d.receiver ? [{ kind: "nominal", index: m.owner }] : [];
		const abi = p => p.kind === "nominal" ? { c: "lean_object *", box: v => v, index: p.index } : carrier(p.kind);
		const sites = [...receiver, ...m.params].map(abi), out = abi(m.out), n = sites.length;
		const anchored = d.result.ownership === "borrow", lifetime = d.result.lifetime;
		const anchor = !anchored ? -1 : lifetime?.scope === "receiver" && lifetime.anchor === "receiver" && d.receiver ? 0
			: lifetime?.scope === "parameter" ? refs.findIndex(r => r !== d.receiver && r.name === lifetime.anchor) : -1;
		if(anchored && (anchor < 0 || sites[anchor].index === undefined || out.index === undefined)) throw new TypeError("Unanchored CLR host member result");
		for(const [i, s] of [...sites, out].entries()) if(s.index !== undefined)
		{
			const r = refs[i] ?? d.result, l = r.lifetime, result = i === n;
			const ok = r.ownership === "borrow" ? (result ? anchored : l?.scope === "call" && l.anchor === null)
				: ["lease", "transfer"].includes(r.ownership) && (l?.scope === "explicit" || (!result && l?.scope === "call")) && l.anchor === null;
			if(!ok) throw new TypeError("Invalid CLR nominal ownership for " + d.id);
		}
		const proto = "lean_object *" + m.symbol + "(" + (sites.map((s, i) => s.c + " a" + i).join(",") || "void") + ")";
		headers.push(proto + ";");
		bodies.push(`${proto} {
    lean_object *v[${Math.max(1, n)}]={${sites.map((s, i) => s.box("a" + i)).join(",") || "NULL"}};
    uint64_t input[${Math.max(1, 3 * n)}]={0}, out[3]={0}; size_t budget=0;
    lb_dn_int_integer heap[${Math.max(1, n)}]={0}; lean_object *answer=NULL;
    ${sites.map((s, i) => s.index === undefined ? `if(!dn_put(${s.tag},v[${i}],input+${3*i},&budget,heap+${i})) goto budget_error;`
		: `if(!lb_dn_current() || !(input[${3*i}]=LB_DND(object)(lb_dn_current()->domain_session,${s.index},v[${i}]))) goto stale;`).join("\n    ")}
    answer=lb_dn_member(${slot},input,${n},out);
    if(!answer) {
        ${out.index === undefined ? `lean_object *result=dn_get(${out.tag},out);`
			: `lb_dn_frame *f=lb_dn_current();
        lean_object *result=(!f || out[1] || out[2]) ? NULL : LB_DND(wrap)(f,f->domain_session,${out.index},out[0],${anchor >= 0 ? "input[" + 3*anchor + "]" : "0"});
        if(result) LB_DND(admit)(result);`}
        answer=result ? lean_io_result_mk_ok(result) : lb_dn_corrupt();
    }
    goto done;
budget_error: answer=lean_io_result_mk_error(lean_mk_io_user_error(lean_mk_string("CLR host copy budget exceeded or unavailable")));
    goto done;
stale: answer=lean_io_result_mk_error(lean_mk_io_user_error(lean_mk_string("stale or wrong-kind CLR host reference")));
done: for(size_t i=0;i<${n};i++) lb_dn_int_integer_dispose(heap+i);
    ${sites.map((s, i) => s.index === undefined || refs[i].ownership !== "borrow" ? `lean_dec(v[${i}]);` : "").join(" ")}
    return answer;
}`);
	}
	const hasNominal = model.members.some(m => !["static", "new"].includes(m.mode) || [m.out, ...m.params].some(s => s.index !== undefined));
	return { ...model, header: '#include <lean/lean.h>\n' + headers.join("\n"), native: '#include "host-wire.h"\n' + (hasNominal ? '#include "host-domain.h"\n' : "") + bodies.join("\n") };
};
