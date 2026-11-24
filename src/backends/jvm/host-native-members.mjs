/** @file Generate Lean external definitions that call JVM host members. */
import { generateJvmHostMembers } from "./host-members.mjs";

const fail = message => { throw new TypeError("JVM host provider: " + message); };
const machine = { unit: ["lean_object *", "", "UNIT"]
	, char: ["uint32_t", "uint32", "CHAR"]
	, bool: ["uint8_t", "small", "BOOL"]
	, float32: ["float", "float32", "FLOAT32"]
	, float64: ["double", "float", "FLOAT64"]
	, usize: ["size_t", "usize", "USIZE"], isize: ["size_t", "usize", "ISIZE"] };
for(const bits of [8, 16, 32, 64]) for(const prefix of ["uint", "int"])
	machine[prefix + bits] = ["uint" + bits + "_t", bits < 32 ? "small" : "uint" + bits, prefix.toUpperCase() + bits];
for(const t of ["string", "bytes", "nat", "int"]) machine[t] = ["lean_object *", "", t.toUpperCase()];

/**
 * Resolve an admitted site to its real Lean C representation and private wire tag.
 *
 * @param types - Host resources in declaration order.
 * @param ref - Compiler-reconciled site type.
 */
export const jvmHostCarrier = (types, ref) => {
	const i = ref?.kind === "named" ? types.findIndex(t => t.id === ref.id) : -1;
	if(i >= 0) return { kind: "nominal", index: i, code: "(JH_NOMINAL+" + i + ")", c: "lean_object *", box: v => v, unbox: v => v };
	if(ref?.kind !== "primitive" || !Object.hasOwn(machine, ref.name)) fail("unsupported carrier " + JSON.stringify(ref));
	const [c, f, code] = machine[ref.name], call = (prefix, v) => !f ? v : prefix + (f === "small" ? "" : "_" + f) + "(" + v + ")";
	return { kind: ref.name, code: "JH_" + code, c, box: v => call("lean_box", v), unbox: v => call("lean_unbox", v) };
};

const anchorSite = (d, sites, out) => {
	if(d.result.ownership !== "borrow") return -1;
	const l = d.result.lifetime;
	const ix = l?.scope === "receiver" && d.receiver && l.anchor === "receiver" ? 0
		: l?.scope === "parameter" ? sites.findIndex(s => s !== d.receiver && s.name === l.anchor) : -1;
	if(out.kind !== "nominal" || ix < 0 || sites[ix].type.kind !== "named") fail("unanchored borrowed member result");
	return ix;
};
const checkSite = (s, c, result) => {
	if(c.kind !== "nominal")
	{ if(s.ownership !== "copy" || s.lifetime !== null) fail("invalid scalar lifetime"); return; }
	if(result && s.ownership === "borrow") return;
	const l = s.lifetime, allowed = s.ownership === "borrow" ? l?.scope === "call"
		: ["lease", "transfer"].includes(s.ownership) && (l?.scope === "explicit" || (!result && l?.scope === "call"));
	if(!allowed || l.anchor !== null) fail("invalid nominal lifetime");
};

/**
 * Emit the exact C ABI declared by the checked Lean module. Each locally
 * boxed value and each owned Lean argument has a single cleanup epilogue.
 *
 * @param ir - The original validated host import contract.
 */
export const generateJvmNativeMembers = async ir => {
	const model = await generateJvmHostMembers(ir), types = ir.types, protos = [], bodies = [];
	for(const [slot, m] of model.members.entries())
	{
		const d = ir.declarations.find(d => d.id === m.id), sites = [...d.receiver ? [d.receiver] : [], ...d.parameters];
		const values = sites.map(s => jvmHostCarrier(types, s.type)), out = jvmHostCarrier(types, d.result.type);
		if(values.length > 64) fail("too many host arguments");
		sites.forEach((s, i) => checkSite(s, values[i], false)); checkSite(d.result, out, true);
		const anchor = anchorSite(d, sites, out), n = values.length;
		const proto = "lean_object *" + m.symbol + "(" + (values.map((c, i) => c.c + " v" + i).join(", ") || "void") + ")";
		protos.push(proto + ";");
		bodies.push(`${proto} {
    lb_jh_frame *f=lb_jh_current(); lean_object *io=NULL;
    lean_object *values[${Math.max(1, n)}]={${values.map((c, i) => c.box("v" + i)).join(",") || "NULL"}};
    if (!f || !jh_session) { io=lean_io_result_mk_error(lean_mk_io_user_error(lean_mk_string("no active JVM host binding"))); goto done; }
    JNIEnv *e=f->env;
    if ((*e)->PushLocalFrame(e,32) < 0) { io=lb_jh_catch(f); goto done; }
    jobject owner=NULL; jclass cls=(*e)->FindClass(e,"java/lang/Object"); if (!cls) goto fault;
    jobjectArray args=(*e)->NewObjectArray(e,${n},cls,NULL); if (!args) goto fault;
    ${values.map((c, i) => `{ jobject v=jh_to(f,jh_session,${c.code},values[${i}]); if ((*e)->ExceptionCheck(e)) goto fault;
        (*e)->SetObjectArrayElement(e,args,${i},v); if ((*e)->ExceptionCheck(e)) goto fault;
        ${i === anchor ? "owner=v;" : "if(v) (*e)->DeleteLocalRef(e,v);"} }`).join("\n    ")}
    jclass binding=(*e)->GetObjectClass(e,f->binder); if (!binding) goto fault;
    jmethodID invoke=(*e)->GetMethodID(e,binding,"invokeWire","(I[Ljava/lang/Object;)Ljava/lang/Object;"); if (!invoke) goto fault;
    jobject answer=lb_jh_invoke(f,invoke,${slot},args); if ((*e)->ExceptionCheck(e)) goto fault;
    lean_object *v=jh_from(f,jh_session,${out.code},answer,owner); if (!v) goto fault;
    ${out.kind === "nominal" ? "LB_JHD(admit)(v); " : ""}io=lean_io_result_mk_ok(v); goto pop;
fault: io=lb_jh_catch(f);
pop: (*e)->PopLocalFrame(e,NULL);
done:
    ${values.map((c, i) => c.c !== "lean_object *" || sites[i].ownership !== "borrow" ? "lean_dec(values[" + i + "]);" : "").join(" ")}
    return io;
}`);
	}
	const native = "#include \"host-wire.h\"\nstatic _Thread_local lb_jhd_session *jh_session;\n" + bodies.join("\n");
	return { ...model, header: protos.join("\n"), native
		, helpers: ["nat", "int"].map(k => `@[export lb_jh_${k}_text] def ${k}Text (v : ${k === "nat" ? "Nat" : "Int"}) : String := toString v`).join("\n") };
};
