/** @file Emit the checked synchronous Lean exports and private native owner entry. */
import { wordHostCarrier } from "./word-host-members.mjs";

const qual = /^(?:[A-Za-z_][A-Za-z0-9_]*\.)*[A-Za-z_][A-Za-z0-9_]*$/u;
const sum = t => t?.kind === "apply" && t.constructor === "result" && t.arguments?.length === 2;
const primitives = { unit: "Unit", bool: "Bool", bytes: "ByteArray", char: "Char", string: "String", int: "Int", nat: "Nat", usize: "USize", isize: "ISize", float32: "Float32", float64: "Float" };
for(const bits of [8, 16, 32, 64]) for(const [k, l] of [["int", "Int"], ["uint", "UInt"]]) primitives[k + bits] = l + bits;

/**
 * Bind the compiler's IO/EIO/pure-Except entries to a fixed private call table.
 *
 * @param o - Reconciled application declarations, imports and component identity.
 * @param model - Validated member externs, private type keys, and ownership policy.
 * @param target - Select an isolated package symbol prefix and Lean namespace.
 */
export const emitWordHostExports = (o, model, target) => {
	const name = target === "php" ? "Php" : target === "dotnet" ? "Dotnet" : null;
	if(!name) throw new TypeError("Unknown native host owner");
	const module = "Bridge" + name + "Exports", host = "LeanBridge.Host." + name;
	const { ir, entries, modules, identity } = o;
	const taskObjects = target==="php" && o.phpTaskLeases===true;
	const clrWorkers = target==="dotnet" && o.dotnetTaskLeases===true;
	if(clrWorkers && (model.workerKeys?.length!==ir.types.length || model.workerKeys.some(k=>!/^[a-f0-9]{64}$/u.test(k)))) throw new TypeError("Invalid CLR worker transport keys");
	if(!/^[a-f0-9]{64}$/u.test(identity) || !modules.length || modules.some(m => !qual.test(m)) || (!entries.length && !taskObjects && !clrWorkers))
		throw new TypeError("Invalid native host component");
	const prefix = "lb_" + target + "_host_" + identity;
	const header = [model.header], defs = [], methods = [], outputs = [];
	const lean = (t, depth = 0) => {
		if(depth > 64) throw new TypeError("native host result exceeds 64 nested branches");
		if(sum(t)) return "(_root_.Except " + lean(t.arguments[1], depth + 1) + " " + lean(t.arguments[0], depth + 1) + ")";
		const c = wordHostCarrier(ir.types, t); return c.index === undefined ? "_root_." + primitives[t.name] : "_root_." + host + "." + ir.types[c.index].name;
	};
	const output = (t, depth = 0) => {
		if(!sum(t))
		{
			const c = wordHostCarrier(ir.types, t);
			return c.index === undefined ? "dn_output(" + c.tag + ",v,out)" : "(out[0]=LB_DND(export)(f,s," + c.index + ",v)) ? 0 : 14";
		}
		const a = output(t.arguments[0], depth + 1), b = output(t.arguments[1], depth + 1), name = "dn_result_" + outputs.length;
		outputs.push(`static int ${name}(lb_dn_frame *f,lb_dnd_session *s,lean_object *v,uint64_t *out,uint8_t *tags) {
    int ok=lean_obj_tag(v)==1; tags[${depth}]=ok; v=lean_ctor_get(v,0);
    return ok ? (${a}) : (${b});
}`);
		return name + "(f,s,v,out,tags)";
	};
	for(const [i, e] of entries.entries())
	{
		if(!qual.test(e.declaration) || e.delivery || !["pure", "BaseIO", "IO", "EIO"].includes(e.effect) || e.parameters.length > 64 || (e.effect === "pure" && !clrWorkers && !sum(e.result)))
			throw new TypeError("Invalid synchronous native export: " + e.declaration);
		const args = e.parameters.map(p => wordHostCarrier(ir.types, p.type)), eio = e.effect === "EIO";
		const ret = lean(e.result), n = args.length, fn = "lb_dn_export_" + i;
		const params = e.parameters.map((p, j) => "(v" + j + " : " + lean(p.type) + ")").join(" ");
		const r = eio ? "(_root_.Except " + lean(e.error) + " " + ret + ")" : ret;
		const call = "(_root_." + e.declaration + args.map((_, j) => " v" + j).join("") + ")";
		defs.push(`@[export ${fn}] def execute${i} ${params} : IO ${r} := ${eio ? "EIO.toIO' " : e.effect === "pure" ? "pure " : ""}${call}`);
		header.push("extern lean_object *" + fn + "(" + (args.map(c => c.c).join(",") || "void") + ");");
		const ok = output(e.result), err = eio && output(e.error);
		methods.push(`static int dn_call_${i}(lb_dn_frame *f,lb_dnd_session *s,const uint64_t *arg,size_t n,uint64_t *out,uint8_t *tags,uint32_t *fault) {
    if(n!=${n} || (n && !arg)) return 5;
    lean_object *a[${Math.max(1,n)}]={0}, *io=NULL; int status=5;
    ${args.map((c, j) => c.index === undefined ? `if(!(a[${j}]=dn_get(${c.tag},arg+${3*j}))) goto done;` : `if(arg[${3*j+1}] || arg[${3*j+2}] || !(a[${j}]=LB_DND(wrap)(f,s,${c.index},arg[${3*j}],0))) goto done;`).join("\n    ")}
    ${args.flatMap((c,j) => c.index === undefined ? [] : ["LB_DND(admit)(a[" + j + "]);"]).join(" ")}
    ${args.flatMap((c,j) => c.c === "lean_object *" ? ["lean_inc(a[" + j + "]);"] : []).join(" ")}
    io=${fn}(${args.map((c,j) => c.unbox("a[" + j + "]")).join(",")}); lean_object *v=lean_ctor_get(io,0);
    if(f->fatal) status=10;
    else if(!lean_io_result_is_ok(io)) {
        if((*fault=lb_dn_original(f,v))) status=13;
        else { lean_inc(v); lean_object *msg=lb_dn_error_text(v); status=dn_output(DN_STRING,msg,out); lean_dec(msg); if(!status) status=4; }
    } else {
        ${eio ? `int success=lean_obj_tag(v)==1; v=lean_ctor_get(v,0); status=success ? (${ok}) : (${err}); if(!success && !status) status=3;` : `status=${ok};`}
    }
done: if(io) lean_dec(io); for(size_t j=0;j<n;j++) if(a[j]) lean_dec(a[j]); return status;
}`);
	}
	header.push("extern lean_object *lb_dn_error_text(lean_object *);", "extern lean_object *initialize_" + module + "(uint8_t);");
	const entryLean = [...modules.map(m => "import " + m), "import " + host, "namespace " + module, "@[export lb_dn_error_text] def errorText (e : IO.Error) : String := toString e", ...defs, "end " + module, ""].join("\n");
	const clrHeader=clrWorkers?`static const char *const worker_keys[]={${model.workerKeys.map(k=>JSON.stringify(k)).join(",")}};
#define LB_CLR_VISIT ${prefix}_visit
#define LB_CLR_OBJECT ${prefix}_object
#include "worker-owner.h"
`:"";
	const source = `#include "lean_bridge_native_runtime.h"
#include "entry-abi.h"
#include "host-domain.h"
${model.native}
static const char component[]="${target}host:${identity}";
static const lb_dnd_spec specs[]={${model.kinds.map(k => "{" + JSON.stringify(k.key) + "," + Number(k.strong) + "}").join(",")}};
${clrHeader}${taskObjects?'#include "host-task-leases.h"\n':""}static void *init(uint8_t b) { return initialize_${module}(b); }
static int available(void) { return lean_bridge_native_component_ready(component); }
/* A public result outlives the Lean IO object; never return pointers into it. */
static int dn_output(int kind,lean_object *v,uint64_t *out) {
    uint64_t w[3]={0}; size_t budget=0; lb_dn_int_integer heap={0};
    if(!dn_put(kind,v,w,&budget,&heap)) { lb_dn_int_integer_dispose(&heap); return 12; }
    if(kind==DN_BYTES || kind==DN_STRING) {
        void *p=w[1] ? malloc(w[1]) : NULL; if(w[1] && !p) return 11;
        if(w[1]) memcpy(p,(const void *)(uintptr_t)w[0],w[1]); w[0]=(uintptr_t)p; out[3]=1;
    } else if(kind==DN_NAT || kind==DN_INT) out[3]=2; /* transfer allocated limbs */
    memcpy(out,w,sizeof(w)); return 0;
}
__attribute__((visibility("default"))) void ${prefix}_clear(uint64_t *out) {
    if(out) { if(out[3]==1 || out[3]==2) free((void *)(uintptr_t)out[0]); memset(out,0,4*sizeof(*out)); }
}
${outputs.join("\n")}
${methods.join("\n")}
__attribute__((visibility("default"))) int ${prefix}_call(uint64_t id,lb_dn_dispatch dispatch,int op,const uint64_t *args,size_t n,uint64_t *out,uint8_t *tags,uint32_t *fault) {
    if(!lean_bridge_native_process_valid() || !out || !tags || !fault) return 10;
    lb_dn_frame f; int status=lb_dn_enter(&f,id,dispatch,lean_bridge_native_runtime_retire);
    if(status) return status==LB_DN_WRONG_THREAD ? 9 : 10;
    *fault=0;
    if(op==-2 || op==-1) {
        int code=op==-1 ? LB_DND(close)(&f,component) : lean_bridge_native_component_initialize(component,init) ? LB_DND(open)(&f,component,specs,${ir.types.length}) : DN_DOMAIN_FATAL;
        status=code==DN_BOUND ? 0 : code==DN_INCOMPATIBLE ? 5 : code==DN_ACTIVE ? 14 : 10;
    } else if(!lean_bridge_native_component_ready(component)${taskObjects?" && op!=PHP_HOST_SWEEP":""}) status=10;
    else {
        lb_dnd_session *s=LB_DND(enter)(&f,component); if(!s) status=14;
        else { f.domain_session=s; f.available=available;
            switch(op) { ${taskObjects?"case PHP_HOST_SWEEP: status=n ? 5 : 0; break; case PHP_HOST_PIN: case PHP_HOST_RESOLVE: case PHP_HOST_ADMIT: status=php_host_lease(&f,s,op,args,n,out); break; ":""}${entries.map((_,i) => "case " + i + ": status=dn_call_" + i + "(&f,s,args,n,out,tags,fault); break;").join(" ")} default: status=5; }
            LB_DND(leave)(&f,s);
        }
    }
    if(f.fatal || (${taskObjects?"(op>=0 || (op<=PHP_HOST_PIN && op!=PHP_HOST_SWEEP))":"op>=0"} && !lean_bridge_native_component_ready(component))) status=10;
    lb_dn_leave(&f); return status;
}
`;
	return { entryLean, header: header.join("\n"), model, prefix, source };
};
