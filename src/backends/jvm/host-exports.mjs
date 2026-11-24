/** @file Compile checked application host exports into synchronous Lean and JNI entry points. */
import { generateJvmNativeMembers, jvmHostCarrier } from "./host-native-members.mjs";

const qual = /^(?:[A-Za-z_][A-Za-z0-9_]*\.)*[A-Za-z_][A-Za-z0-9_]*$/u;
const fail = message => { throw new TypeError("JVM host exports: " + message); };
const primitive = { unit: "Unit", bool: "Bool", bytes: "ByteArray"
	, char: "Char", string: "String"
	, int: "Int"
	, nat: "Nat"
	, usize: "USize"
	, isize: "ISize"
	, float32: "Float32"
	, float64: "Float" };
for(const bits of [8, 16, 32, 64]) for(const [k, l] of [["int", "Int"], ["uint", "UInt"]]) primitive[k + bits] = l + bits;
const either = t => t?.kind === "apply" && t.constructor === "result" && t.arguments?.length === 2;
const leanType = (types, ref) => {
	if(either(ref)) return "(_root_.Except " + leanType(types, ref.arguments[1]) + " " + leanType(types, ref.arguments[0]) + ")";
	const c = jvmHostCarrier(types, ref);
	return c.kind === "nominal" ? "_root_.LeanBridge.Host.Jvm." + types[c.index].name : "_root_." + primitive[c.kind];
};

/**
 * Use compiler-derived entries only. A generated native prototype is also
 * compiled against the Lean-generated C, including its precise ownership ABI.
 *
 * @param o - Captured import contract, application modules/entries and content-addressed component identity.
 */
export const generateJvmHostExports = async o => {
	const { ir, entries, modules, identity } = o, types = ir.types;
	if(!/^[a-f0-9]{64}$/u.test(identity) || !modules.length || modules.some(n => !qual.test(n)) || !entries.length) fail("invalid component inputs");
	const model = await generateJvmNativeMembers(ir), header = [model.header], defs = [], bodies = [], outputs = [];
	const toWire = type => {
		if(!either(type)) return "jh_to(f,jh_session," + jvmHostCarrier(types, type).code + ",v)";
		const a = toWire(type.arguments[0]), b = toWire(type.arguments[1]), fn = "jh_nested_" + outputs.length;
		outputs.push(`static jobject ${fn}(lb_jh_frame *f,lean_object *v) {
    int ok=lean_obj_tag(v)==1; v=lean_ctor_get(v,0);
    jobject payload=ok ? ${a} : ${b}; return jh_pair(f,ok ? 0 : 1,payload);
}`);
		return fn + "(f,v)";
	};
	for(const [i, d] of entries.entries())
	{
		if(!qual.test(d.declaration) || d.delivery || !["IO", "EIO", "BaseIO", "pure"].includes(d.effect)
			|| d.parameters.length > 64 || (d.effect === "pure" && !either(d.result))) fail("unsupported synchronous declaration " + d.declaration);
		const args = d.parameters.map(p => jvmHostCarrier(types, p.type)), params = args.map((_, j) => "v" + j);
		const result = leanType(types, d.result), eio = d.effect === "EIO", fn = "lb_jh_export_" + i;
		const ret = eio ? "(_root_.Except " + leanType(types, d.error) + " " + result + ")" : result;
		const call = "(_root_." + d.declaration + (params.length ? " " + params.join(" ") : "") + ")";
		defs.push(`@[export ${fn}] def execute${i} ${params.map((n, j) => "(" + n + " : " + leanType(types, d.parameters[j].type) + ")").join(" ")} : IO ${ret} := ${eio ? "EIO.toIO' " : d.effect === "pure" ? "pure " : ""}${call}`);
		header.push("extern lean_object *" + fn + "(" + (args.map(c => c.c).join(",") || "void") + ");");
		const ok = toWire(d.result), err = eio && toWire(d.error);
		bodies.push(`static jobject jh_entry_${i}(lb_jh_frame *f) {
    JNIEnv *e=f->env; jobject answer=NULL; lean_object *io=NULL, *values[${Math.max(args.length, 1)}]={0};
    if (!f->input || (*e)->GetArrayLength(e,(jobjectArray)f->input)!=${args.length}) { jh_bad(e); return NULL; }
    ${args.map((c, j) => `{ jobject arg=(*e)->GetObjectArrayElement(e,(jobjectArray)f->input,${j}); if ((*e)->ExceptionCheck(e)) goto done;
      values[${j}]=jh_from(f,jh_session,${c.code},arg,NULL); if (arg) (*e)->DeleteLocalRef(e,arg); if (!values[${j}]) goto done; }`).join("\n    ")}
    ${args.map((c, j) => c.kind === "nominal" ? "LB_JHD(admit)(values[" + j + "]);" : "").join(" ")}
    ${args.map((c, j) => c.c === "lean_object *" ? "lean_inc(values[" + j + "]);" : "").join(" ")}
    io=${fn}(${args.map((c, j) => c.unbox("values[" + j + "]")).join(",")}); lean_object *v=lean_ctor_get(io,0);
    if (!lean_io_result_is_ok(io)) {
        if (!lb_jh_rethrow(f,v)) { lean_inc(v); lean_object *str=lb_jh_error_text(v);
            jobject msg=jh_to(f,jh_session,JH_STRING,str); lean_dec(str); answer=jh_pair(f,2,msg); }
    } else { ${eio ? `int ok=lean_obj_tag(v)==1; v=lean_ctor_get(v,0); jobject payload=ok ? ${ok} : ${err}; answer=jh_pair(f,ok ? 0 : 1,payload);` : `jobject payload=${ok}; answer=jh_pair(f,0,payload);`} }
done:
    if (io) lean_dec(io);
    for (int i=0;i<${args.length};i++) if (values[i]) lean_dec(values[i]);
    return answer;
}`);
	}
	const prefix = "lb_jvm_host_" + identity;
	const entryLean = [...modules.map(m => "import " + m)
		, "import LeanBridge.Host.Jvm", "namespace BridgeJvmExports"
		, model.helpers
		, "@[export lb_jh_error_text] def errorText (e : IO.Error) : String := toString e"
		, ...defs
		, "end BridgeJvmExports"
		, ""].join("\n");
	header.push("extern lean_object *lb_jh_error_text(lean_object *);", "extern lean_object *initialize_BridgeJvmExports(uint8_t);");
	const source = `#include "lean_bridge_native_runtime.h"
#include "entry-abi.h"
${model.native}
static const char component[]="jvmhost:${identity}";
static const lb_jhd_spec specs[]={${model.kinds.map(k => "{" + JSON.stringify(k.key) + "," + Number(k.strong) + "}").join(",")}};
static void *init(uint8_t b) { return initialize_BridgeJvmExports(b); }
static int available(void) { return lean_bridge_native_component_ready(component); }
static jobject jh_pair(lb_jh_frame *f,jlong tag,jobject payload) {
    JNIEnv *e=f->env; if ((*e)->ExceptionCheck(e)) return NULL;
    jclass obj=(*e)->FindClass(e,"java/lang/Object"); if (!obj) return NULL;
    jobjectArray pair=(*e)->NewObjectArray(e,2,obj,NULL); if (!pair) return NULL;
    jobject status=jh_word(e,(uint64_t)tag); if ((*e)->ExceptionCheck(e)) return NULL;
    (*e)->SetObjectArrayElement(e,pair,0,status); if ((*e)->ExceptionCheck(e)) return NULL;
    (*e)->SetObjectArrayElement(e,pair,1,payload); return pair;
}
${outputs.join("\n")}
${bodies.join("\n")}
static jobject execute(lb_jh_frame *f,void *ptr) {
    jint op=*(jint *)ptr;
    if(op==-2) {
        if (!lean_bridge_native_component_initialize(component,init))
            jh_raise(f->env,"java/lang/IllegalStateException","Lean component initialization failed");
        else LB_JHD(open)(f,component,specs,${types.length});
        return NULL;
    }
    if(op==-1) { LB_JHD(close)(f,component); return NULL; }
    f->available=available; f->retire=lean_bridge_native_runtime_retire;
    if (!lb_jh_guard(f)) return NULL;
    lb_jhd_session *s=LB_JHD(enter)(f,component); if(!s) return NULL;
    lb_jhd_session *outer=jh_session; jh_session=s; jobject answer=NULL;
    switch(op) { ${entries.map((_, i) => "case " + i + ": answer=jh_entry_" + i + "(f); break;").join(" ")} default: jh_bad(f->env); }
    jh_session=outer; LB_JHD(leave)(f,s); return answer;
}
__attribute__((visibility("default"))) jobject ${prefix}_call(JNIEnv *e,jobject port,jint op,jobjectArray args) {
    return lb_jh_call(e,port,args,execute,&op);
}
`;
	return { entryLean, source, header: '#include <lean/lean.h>\n' + header.join("\n"), prefix, model };
};
