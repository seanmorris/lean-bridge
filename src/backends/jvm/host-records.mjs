/** @file Project source-checked host-object records into typed Java objects and JNI field arrays. */

// Written only into a provider which actually returns a record. Charge every
// copied byte before creating its JVM array, including decimal Int/Nat text.
export const jniRecordLeaf = `static jobject jh_record_leaf(lb_jh_frame *f,int k,lean_object *v,size_t *left) {
    if (k!=JH_BYTES && k!=JH_STRING && k!=JH_NAT && k!=JH_INT) return jh_to(f,jh_session,k,v);
    lean_object *text=NULL;
    if (k==JH_NAT || k==JH_INT) {
        lean_inc(v); text=k==JH_NAT ? lb_jh_nat_text(v) : lb_jh_int_text(v); v=text;
    }
    size_t n=k==JH_BYTES ? lean_sarray_size(v) : lean_string_size(v)-1;
    jobject answer=NULL;
    if (n>*left) jh_raise(f->env,"java/lang/IllegalArgumentException","record copy budget exceeded");
    else { *left-=n; answer=jh_bytes(f->env,k==JH_BYTES ? (const char *)lean_sarray_cptr(v) : lean_string_cstr(v),n); }
    if (text) lean_dec(text);
    return answer;
}`;

/**
 * Walk a private nested Prod produced by Lean projections, not the public
 * structure's heap layout. JNI locals never keep a partially exported row alive.
 *
 * @param fn - Private compiler-generated function name.
 * @param codes - Known wire code for each ordered leaf.
 */
export const jniRecordWriter = (fn, codes) => `static jobject ${fn}(lb_jh_frame *f,lean_object *v) {
    JNIEnv *e=f->env; jclass obj=(*e)->FindClass(e,"java/lang/Object"); if(!obj) return NULL;
    jobjectArray row=(*e)->NewObjectArray(e,${codes.length},obj,NULL); (*e)->DeleteLocalRef(e,obj);
    if (!row) return NULL;
    size_t left=16*1024*1024;
    const int codes[]={${codes.join(",")}};
    for(size_t i=0;i<${codes.length};i++) {
        jobject field=jh_record_leaf(f,codes[i],lean_ctor_get(v,0),&left);
        if(!(*e)->ExceptionCheck(e)) (*e)->SetObjectArrayElement(e,row,(jsize)i,field);
        if(field) (*e)->DeleteLocalRef(e,field);
        if((*e)->ExceptionCheck(e)) { (*e)->DeleteLocalRef(e,row); return NULL; }
        v=lean_ctor_get(v,1);
    }
    return row;
}`;

/**
 * Generate one AutoCloseable class with typed, read-only JavaBean properties
 * (also idiomatic Kotlin getters). Disposing it releases only its own references.
 *
 * @param api - Verified public interface.
 * @param g - Package type parameters for imported application classes.
 * @param leaf - Public leaf type spelling.
 * @param java - Add a source file in the package namespace.
 * @param occupied - Reserved and already generated Java class names.
 */
export const jvmHostRecords = (api, g, leaf, java, occupied) => {
	const entries = new Map();
	const reserved = new Set([
		...g.slice(1, -1).split(","), "Bound", "Fields", "HostFunctions"
		, "HostTaskScope", "HostWorkerFrame"
		, "String"
		, "Object"
		, "Class"
		, "Throwable"
		, "Exception"
		, "RuntimeException"
		, "IllegalStateException"
		, "IllegalArgumentException"
		, "Integer"
		, "Long"
		, "Boolean"
		, "Double"
		, "Float"
		, "Short"
		, "Byte"
		, "Void"
		, "System"
		, "AutoCloseable"
		, "Override"
		, "FunctionalInterface"]);
	for(const t of (api.types ?? []).filter(t => t.kind === "record"))
	{
		const name = t.name;
		if(!/^[A-Z][A-Za-z0-9_]*$/u.test(name) || reserved.has(name) || occupied.has(name)) throw new TypeError("Invalid JVM record name: " + name);
		occupied.add(name);
		const seen = new Set(["getClass"]);
		const fields = t.fields.map((f, i) => {
			const getter = "get" + f.name.split("_").map(p => p.charAt(0).toUpperCase() + p.slice(1)).join("");
			if(!/^get[A-Z][A-Za-z0-9]*$/u.test(getter) || seen.has(getter)) throw new TypeError("Colliding JVM record getter: " + getter);
			seen.add(getter); return {ref: f.type, type: leaf(f.type), getter, slot: "f" + i};
		});
		if(!fields.length || fields.length > 64 || !fields.some(f => f.ref.kind === "named")) throw new TypeError("Invalid JVM application record fields");
		const args = fields.map(f => f.type + " " + f.slot).join(",");
		const copy = f => f.ref.name === "bytes" ? f.slot + ".clone()" : f.slot;
		const check = f => /^(int|long|double|float|byte|short|boolean)$/u.test(f.type) ? f.slot : "java.util.Objects.requireNonNull(" + f.slot + ")";
		java(name, `public final class ${name}${g} implements AutoCloseable {
    static final class Fields${g} {
${fields.map(f => "        final " + f.type + " " + f.slot + ";").join("\n")}
        Fields(${args}) { ${fields.map(f => "this." + f.slot + "=" + check(f) + ";").join(" ")} }
    }
    private volatile Fields${g} held;
    private ${name}(Fields${g} initial) { held=initial; }
    public ${name}(${args}) { this(new Fields<>(${fields.map(copy).join(",")})); }
    static ${g} ${name}${g} fromNative(${args}) { return new ${name}<>(new Fields<>(${fields.map(f => f.slot).join(",")})); }
    Fields${g} snapshot() { var row=held; if(row==null) throw new IllegalStateException("closed ${name}"); return row; }
${fields.map(f => "    public " + f.type + " " + f.getter + "() { return snapshot()." + f.slot + (f.ref.name === "bytes" ? ".clone()" : "") + "; }").join("\n")}
    @Override public void close() { held=null; }
}
`);
		entries.set(t.source.declaration, {name, pub: name + g, fields, read: "readHostRecord" + entries.size});
	}
	return entries;
};
