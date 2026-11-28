/** @file Emit private Linux x86-64 host member calls using the scoped three-word callback ABI. */

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
	else if(!["unit", "nat", "int", "string", "bytes"].includes(k)) throw new TypeError("Unsupported native copied member site " + k);
	return { c, box, tag: "DN_" + k.toUpperCase(), unbox: v => box(v).replace(/^lean_box/u, "lean_unbox") };
};
/**
 * Resolve a compiler-reconciled host site to the exact Lean C carrier.
 *
 * @param types - The declared host kinds.
 * @param ref - A concrete binding type reference.
 */
export const wordHostCarrier = (types, ref) => {
	const index = ref?.kind === "named" ? types.findIndex(t => t.id === ref.id) : -1;
	if(index >= 0) return { c: "lean_object *", index, unbox: v => v };
	if(ref?.kind !== "primitive") throw new TypeError("Unknown native host export type");
	return carrier(ref.name);
};
/**
 * Bind each managed callback slot to the source contract's exact Lean external symbol.
 *
 * @param ir - Checked imports in the selected component.
 * @param model - Target-validated members in dispatch-slot order.
 * @param target - Native owner profile; private frame symbols are hidden per component.
 */
export const emitWordHostMembers = (ir, model, target) => {
	const label = target === "dotnet" ? "CLR" : target === "php" ? "PHP" : target === "c" ? "C" : target === "cpp" ? "C++" : target === "rust" ? "Rust" : target === "wit-wasi" ? "WIT/WASI" : null;
	if(!label) throw new TypeError("Unknown native host owner");
	const headers = [], bodies = []; let hasNominal = false;
	for(const [slot, m] of model.members.entries())
	{
		const d = ir.declarations.find(v => v.id === m.id);
		const refs = [...d.receiver ? [d.receiver] : [], ...d.parameters];
		const abi = site => {
			const c = wordHostCarrier(ir.types, site.type);
			return c.index === undefined ? c : { ...c, box: v => v };
		};
		const sites = refs.map(abi), out = abi(d.result), n = sites.length;
		if([...sites, out].some(s => s.index !== undefined)) hasNominal = true;
		const anchored = d.result.ownership === "borrow", lifetime = d.result.lifetime;
		const anchor = !anchored ? -1 : lifetime?.scope === "receiver" && lifetime.anchor === "receiver" && d.receiver ? 0
			: lifetime?.scope === "parameter" ? refs.findIndex(r => r !== d.receiver && r.name === lifetime.anchor) : -1;
		if(anchored && (anchor < 0 || sites[anchor].index === undefined || out.index === undefined)) throw new TypeError("Unanchored native host member result");
		for(const [i, s] of [...sites, out].entries()) if(s.index !== undefined)
		{
			const r = refs[i] ?? d.result, l = r.lifetime, result = i === n;
			const ok = r.ownership === "borrow" ? (result ? anchored : l?.scope === "call" && l.anchor === null)
				: ["lease", "transfer"].includes(r.ownership) && (l?.scope === "explicit" || (!result && l?.scope === "call")) && l.anchor === null;
			if(!ok) throw new TypeError("Invalid native nominal ownership for " + d.id);
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
budget_error: answer=lean_io_result_mk_error(lean_mk_io_user_error(lean_mk_string("${label} host copy budget exceeded or unavailable")));
    goto done;
stale: answer=lean_io_result_mk_error(lean_mk_io_user_error(lean_mk_string("stale or wrong-kind ${label} host reference")));
done: for(size_t i=0;i<${n};i++) lb_dn_int_integer_dispose(heap+i);
    ${sites.map((s, i) => s.index === undefined || refs[i].ownership !== "borrow" ? `lean_dec(v[${i}]);` : "").join(" ")}
    return answer;
}`);
	}
	return { ...model, header: '#include <lean/lean.h>\n' + headers.join("\n"), native: '#include "host-wire.h"\n' + (hasNominal ? '#include "host-domain.h"\n' : "") + bodies.join("\n") };
};
