/** @file Generate a reactor and application world from the compiler-selected Lean declarations. */
import {renderCanonicalFutureProducer} from "./canonical-future.mjs";
import {canonicalSupervisor} from "./canonical-supervisor.mjs";
import {witVariantMember} from "./copied-variants.mjs";

const fail=reason=>{throw new TypeError("Canonical WIT: "+reason);};
const types={bool: ["bool","bool","BOOL","boolean"],float32: ["f32","float","F32","f32"],float64: ["f64","double","F64","f64"]};
for(const [lean,wit,tag] of [["int","s","S"],["uint","u","U"]])
    for(const n of [8,16,32,64]) types[lean+n]=[wit+n,lean+n+"_t",tag+n,wit+n];
const scalar=s=>s?.ownership==="copy" && s.type?.kind==="primitive" && Object.hasOwn(types,s.type.name)?types[s.type.name]:fail("expected a copied numeric or Boolean value");
const marker="lean-bridge-guest-slot-v1";
const method=(d,e,i,names)=>{
	if(d.kind!=="function" || d.owner!==null || d.source?.producer!=="lean" || !e || d.source.declaration!==e.declaration
        || !["pure","BaseIO"].includes(e.effect) || d.source.extensions["lean-lang.org/effect"]!==e.effect
        || d.failure.mode!=="none" || d.failure.unexpected!=="poison-runtime" || d.failure.errors.length || d.capabilities.length
        || e.hostMembers?.length || e.taskIO || e.stepError || e.error || !/^[a-z][a-z0-9_]*$/u.test(e.name)
        || e.parameters.length!==d.parameters.length || d.parameters.length>16) fail("unsupported export "+d.name);
	const task=d.resultMode==="promise";
	if(task ? e.delivery!=="task" : d.resultMode!=="value" || e.delivery) fail("delivery does not match Lean: "+d.name);
	const name=witVariantMember(d.name,names,fail),scope=new Set();
	const args=d.parameters.map(p=>({name: witVariantMember(p.name,scope,fail),t: scalar(p)}));
	const out=scalar(d.result),params=args.map(p=>'(param "'+p.name+'" '+p.t[0]+')').join(" ");
	const producer=task && renderCanonicalFutureProducer(d,64,args.map(p=>p.name)).replace("(component","(component $producer"+i);
	const id=String(i),port="m"+id;
	return {id,port,name,native: e.name,args,out,params,producer,task};
};
/**
 * Assemble the shaped producer and a replaceable, type-checked guest section.
 *
 * @param options - Public coordinates and exports reconciled by compileHostSources.
 * @param options.name - Validated WIT package name.
 * @param options.version - WIT package version.
 * @param options.api - Reconciled public Binding IR.
 * @param options.entries - Declarations selected by the Lean compiler.
 * @param options.prefix - C provider symbol prefix.
 */
export const canonicalAppModel=({name,version,api,entries,prefix})=>{
	if(!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(name) || !/^[a-z][a-z0-9_]*$/u.test(prefix)
        || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u.test(version)) fail("invalid package coordinates");
	if(entries.length!==api.declarations.length || entries.length>64 || api.types.length || api.errors.length) fail("unsupported declaration set");
	const names=new Set(["run"]),methods=api.declarations.map((d,i)=>method(d,entries[i],i,names));
	const tasks=methods.filter(x=>x.task);if(!tasks.length) fail("select at least one Task");
	const innerType=m=>m.task?"(future "+m.out[0]+")":m.out[0];
	const wit="package lean-bridge:"+name+"@"+version+";\n\nworld application {\n"+methods.map(m=>"  import %"+m.name+": func("
        +m.args.map(a=>"%"+a.name+": "+a.t[0]).join(", ")+") -> "+(m.task?"future<"+m.out[0]+">":m.out[0])+";").join("\n")
        +"\n  export run: async func() -> s64;\n}\n";
	const stub='(component $guest (@custom "'+marker+'" "1")\n'+methods.map(m=>'(import "'+m.name+'" (func '+m.params+' (result '+innerType(m)+')))').join("\n")
        +'\n(core module $m (func (export "run") (result i32) unreachable) (func (export "cb") (param i32 i32 i32) (result i32) unreachable)) (core instance $i (instantiate $m)) '
        +'(func (export "run") async (result s64) (canon lift (core func $i "run") async (callback (func $i "cb")))))';
	const wat="(component\n"+methods.map(m=>'(import "'+m.port+'" (func $m'+m.id+" "+m.params+" (result "+(m.task?"u32":m.out[0])+")))").join("\n")+"\n"
        +tasks.map(m=>m.producer+'\n(instance $p'+m.id+' (instantiate $producer'+m.id+' (with "begin" (func $m'+m.id+'))))').join("\n")+"\n"+stub
        +'\n(instance $app (instantiate $guest '+methods.map(m=>'(with "'+m.name+'" '+(m.task?'(func $p'+m.id+' "start")':'(func $m'+m.id+')')+')').join(" ")+'))\n'
        +canonicalSupervisor+"\n"+tasks.map(m=>["deliver","reap"].map(k=>'(export "'+k+'-'+m.port+'" (func $p'+m.id+' "'+k+'"))').join("\n")).join("\n")+"\n)";
	return {methods,tasks,wit,wat,guestContract:stub,prefix};
};
/**
 * Return bytes outside the unique replaceable, top-level nested component.
 * Wasmtime validates the assembled binary, including every guest import.
 *
 * @param bytes - Trusted wasm-tools output for our generated template.
 */
export const splitCanonicalTemplate=bytes=>{
	const ident=Buffer.from([0,97,115,109,13,0,1,0]),offsets=[];
	// The trusted builder writes this small custom section. Match its entire
	// payload, not an identifier or similarly named section elsewhere in Wasm.
	const expected=Buffer.concat([Buffer.from([marker.length]),Buffer.from(marker),Buffer.from("1")]);
	const visit=(buf,fn)=>{
		if(!buf.subarray(0,8).equals(ident)) fail("expected a component");
		let pos=8;
		while(pos<buf.length)
		{
			const at=pos,kind=buf[pos++];let len=0,shift=0,b;
			do
			{
				if(pos>=buf.length || shift>28) fail("malformed template section");
				b=buf[pos++];if(shift===28 && b>15) fail("oversized template section");
				len+=(b&127)*2**shift;shift+=7;
			}while(b&128);
			const end=pos+len;if(end>buf.length) fail("truncated template section");
			fn(kind,buf.subarray(pos,end),at,end);pos=end;
		}
	};
	visit(bytes,(kind,data,at,end)=>{
		if(kind===4) visit(data,(id,payload)=>{
			if(id===0 && payload.equals(expected)) offsets.push([at,end]);
		});
	});
	if(offsets.length!==1) fail("missing or ambiguous guest slot");
	return [bytes.subarray(0,offsets[0][0]),bytes.subarray(offsets[0][1])];
};

/**
 * Generate type-safe bridge callbacks for the release's private C provider.
 *
 * @param model - Reconciled method signatures and portable scalar representations.
 */
export const canonicalNativeHooks=model=>{
	const p=model.prefix,lines=[],registrations=[];
	for(const m of model.methods)
	{
		const n=p+"_"+m.native,id=m.id,idx=model.tasks.indexOf(m),[,ctype,tag,member]=m.out;
		if(m.task) lines.push(`static ${n}_handle owners_${id}[LB_SLOTS];
static bool take_${id}(void *ptr,wasmtime_component_val_t *v) {
    ${ctype} x; if (${n}_take(ptr,&x)!=${p}_OK) return false;
    v->kind=WASMTIME_COMPONENT_${tag}; v->of.${member}=x; return true;
}
static void close_${id}(void *ptr) { (void)${n}_close(ptr); }`);
		const args=m.args.map((a,i)=>"args["+i+"].of."+a.t[3]);
		lines.push(`static wasmtime_error_t *hook_${id}(void *data,wasmtime_context_t *ctx,const wasmtime_component_func_type_t *type,
    wasmtime_component_val_t *args,size_t argc,wasmtime_component_val_t *out,size_t retc) {
    (void)ctx;(void)type;(void)args;(void)data;
    if (!accepting) return wasmtime_error_new("native calls require a running guest");
    if (argc!=${args.length} || retc!=1${m.args.map((a,i)=>" || args["+i+"].kind!=WASMTIME_COMPONENT_"+a.t[2]).join("")}) return wasmtime_error_new("unexpected canonical argument");
    ${m.task?`lb_cf_reactor *r=&drivers[${idx}]; unsigned key=lb_cf_reserve(r);
    if (!key) return wasmtime_error_new("canonical future capacity exhausted");
    ${n}_handle *owner=&owners_${id}[key-1]; *owner=(${n}_handle){0};
    if (${n}_start(${[...args,"owner"].join(",")})!=${p}_OK) return wasmtime_error_new("native Lean task start failed");
    int fd=-1; ${p}_status rc=${n}_poll(*owner,&fd);
    if (!((rc==${p}_OK && fd==-1) || (rc==${p}_PENDING && fd>=0)) || !lb_cf_arm(r,key,fd,owner,take_${id},close_${id})) {
        (void)${n}_close(owner);return wasmtime_error_new("could not register native Lean task");
    }
    out->kind=WASMTIME_COMPONENT_U32;out->of.u32=key;`:`${ctype} value;
    if (${n}_call(${[...args,"&value"].join(",")})!=${p}_OK) return wasmtime_error_new("native Lean call failed");
    out->kind=WASMTIME_COMPONENT_${tag}; out->of.${member}=value;`}
    return NULL;
}`);
		registrations.push(`check(wasmtime_component_linker_instance_add_func(root,"${m.port}",${m.port.length},hook_${id},NULL,NULL));`);
	}
	lines.push("static void link_hooks(wasmtime_component_linker_instance_t *root) {\n"+registrations.join("\n")+"\n}",
		"static const char *const methods[LB_METHODS]={"+model.tasks.map(m=>JSON.stringify(m.port)).join(",")+"};");
	return lines.join("\n");
};
