/** @file Generate a reactor and application world from the compiler-selected Lean declarations. */
import {isDeepStrictEqual as equal} from "node:util";
import {canonicalValue,canonicalResult,canonicalString,canonicalEncode,canonicalArguments} from "./canonical-values.mjs";
import {renderCanonicalFutureProducer,richCanonicalFuture} from "./canonical-future.mjs";
import {canonicalStream,streamAction} from "./canonical-stream.mjs";
import {canonicalSupervisor} from "./canonical-supervisor.mjs";
import {witVariantMember} from "./copied-variants.mjs";

const fail=reason=>{throw new TypeError("Canonical WIT: "+reason);};
const marker="lean-bridge-guest-slot-v1";
const method=(d,e,i,names,errors,used,emitProducer=true)=>{
	const ext=d.source?.extensions,stream=d.resultMode==="async-iterator",future=d.resultMode==="promise",asynchronous=stream||future;
	if(d.kind!=="function" || d.owner!==null || d.source?.producer!=="lean" || !e || d.source.declaration!==e.declaration
        || !["pure","BaseIO","IO","EIO"].includes(e.effect) || ext?.["lean-lang.org/effect"]!==e.effect
        || d.failure.unexpected!=="poison-runtime" || d.capabilities.length || e.hostMembers?.length || ext["lean-bridge.dev/host-members"]?.length
        || (!stream && (e.stepError || e.protocol || ext["lean-bridge.dev/pull-protocol"])) || !/^[a-z][a-z0-9_]*$/u.test(e.name) || e.parameters.length!==d.parameters.length
        || (future ? e.delivery!=="task" || ext["lean-lang.org/delivery"]!=="Task" : ext["lean-lang.org/delivery"]!==undefined)
        || (stream ? e.delivery!=="async-iterator" || e.protocol?.open!==e.declaration || !equal(e.protocol,ext["lean-bridge.dev/pull-protocol"]) : !future && (e.delivery || d.resultMode!=="value"))
        || ext["lean-bridge.dev/task-failure"]!==(e.taskIO?"IO.Error":undefined) || (e.taskIO && !future)) fail("unsupported export "+d.name);
	const error=(id,type)=>{
		const def=errors.get(id);if(!def || def.category!=="domain" || !equal(def.payload,type)) fail("invalid error definition: "+id);
		ids.push(id);used.add(id);return type===null?canonicalString:canonicalValue(type);
	};
	const ids=[],failure=e.effect==="EIO" && e.error?error("error:EIO."+e.declaration,e.error)
		:e.effect==="IO"?error("error:IO.Error",null):null;
	if((e.effect==="EIO")!==Boolean(e.error)) fail("missing or unexpected typed error");
	const terminal=e.taskIO?error("error:TaskIO.Error",null):null;
	if(ext["lean-bridge.dev/step-failure"]!==(e.stepIO?"IO.Error":undefined)
		|| (e.stepIO && (!stream || e.stepError || e.stepIO!==true))) fail("invalid cursor IO failure contract: "+d.name);
	const step=e.stepIO || e.stepError?error("error:AsyncStep."+e.declaration,e.stepError??null):null;
	if(!equal([...ids].sort(),[...d.failure.errors].sort()) || d.failure.mode!==(ids.length?"declared":"none")) fail("invalid failure contract: "+d.name);
	const shape=(s,t)=>{
		if(s.ownership!=="copy" || !equal(s.type,t)) fail("canonical ABI disagrees with Lean: "+d.name);
		return canonicalValue(t);
	};
	const name=witVariantMember(d.name,names,fail),scope=new Set();
	const args=d.parameters.map((p,j)=>({name: witVariantMember(p.name,scope,fail),t: shape(p,e.parameters[j].type)}));
	if(args.some(a=>!a.t.flat) || args.reduce((n,a)=>n+a.t.flat.length,0)>16) fail("unsupported canonical parameters");
	const out=shape(d.result,e.result),payload=(terminal||step)?canonicalResult(out,terminal||step):out;
	const params=args.map(a=>'(param "'+a.name+'" '+a.t.wat+')').join(" ");
	const rich=!!(stream || failure || terminal || !out.member || out.wat==="char" || args.some(a=>!a.t.member || a.t.wat==="char"));
	const m={id: String(i),port: "m"+i,name,native: e.name,args,out,params,asynchronous,stream,step,stepIO: e.stepIO===true,failure,terminal,payload,rich,effect: e.effect};
	const w=asynchronous?(stream?"stream":"future")+"<"+payload.wit+">":out.wit,t=asynchronous?"$future"+i:out.wat,begin=asynchronous?"u32":out.wat;
	m.wit=failure?"result<"+w+", "+failure.wit+">":w;
	m.wat=failure?"(result "+t+" (error "+failure.wat+"))":t;
	m.begin=failure?"(result "+begin+" (error "+failure.wat+"))":begin;
	m.producer=emitProducer && asynchronous && (stream?canonicalStream(m,64):rich?richCanonicalFuture(m,64):renderCanonicalFutureProducer(d,64,args.map(p=>p.name))).replace("(component","(component $producer"+i);
	return m;
};
/**
 * Reconcile one copied worker in an application that also declares resources.
 * Other methods' resource types and error definitions belong to those methods.
 *
 * @param d - Reviewed or source-derived public declaration.
 * @param e - Independently compiled method.
 * @param errors - Error definitions in the same public interface.
 */
export const canonicalCopiedWorker=(d,e,errors)=>{
	const x=d.source.extensions,phases=e.delivery==="async-iterator"?{call: [],pull: [],close: []}:{call: []};
	if(!e.delivery || !equal(x["lean-bridge.dev/host-member-phases"],phases) || !equal(x["lean-bridge.dev/host-members"],[])
		|| ["lean-bridge.dev/error-payload-site","lean-bridge.dev/step-error-payload-site"].some(k=>Object.hasOwn(x,k))
		|| !d.parameters.every((s,i)=>s.name===e.parameters[i]?.name && s.lifetime===null && s.mutability==="immutable" && s.optional===false && s.default===null)
		|| d.result.lifetime!==null)
		fail("invalid copied worker sites: "+d.name);
	return method(d,e,0,new Set(),new Map(errors.map(v=>[v.id,v])),new Set(),false);
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
	if(entries.length!==api.declarations.length || entries.length>64 || api.types.length) fail("unsupported declaration set");
	const errors=new Map(api.errors.map(e=>[e.id,e])),used=new Set();
	const names=new Set(["run"]),methods=api.declarations.map((d,i)=>method(d,entries[i],i,names,errors,used));
	if(used.size!==api.errors.length) fail("unused or duplicate error definition");
	const channels=methods.filter(x=>x.asynchronous);if(!channels.length) fail("select at least one Task or cursor");
	const wit="package lean-bridge:"+name+"@"+version+";\n\nworld application {\n"+methods.map(m=>"  import %"+m.name+": func("
        +m.args.map(a=>"%"+a.name+": "+a.t.wit).join(", ")+") -> "+m.wit+";").join("\n")
        +"\n  export run: async func() -> s64;\n}\n";
	const stub='(component $guest (@custom "'+marker+'" "1")\n'+channels.map(m=>"(type $future"+m.id+" ("+(m.stream?"stream":"future")+" "+m.payload.wat+"))").join("\n")+"\n"+methods.map(m=>'(import "'+m.name+'" (func '+m.params+' (result '+m.wat+')))').join("\n")
        +'\n(core module $m (func (export "run") (result i32) unreachable) (func (export "cb") (param i32 i32 i32) (result i32) unreachable)) (core instance $i (instantiate $m)) '
        +'(func (export "run") async (result s64) (canon lift (core func $i "run") async (callback (func $i "cb")))))';
	const wat="(component\n"+methods.map(m=>'(import "'+m.port+'" (func $m'+m.id+" "+m.params+" (result "+m.begin+")))"+(m.asynchronous && m.rich?'\n(import "read-'+m.port+'" (func $read'+m.id+' (param "key" u32) (result '+m.payload.wat+')))':"")+(m.stream?'\n(import "act-'+m.port+'" (func $act'+m.id+' (param "key" u32) (param "op" u32) (result u32)))':"")).join("\n")+"\n"
        +channels.map(m=>m.producer+'\n(instance $p'+m.id+' (instantiate $producer'+m.id+' (with "begin" (func $m'+m.id+'))'+(m.rich?' (with "peek" (func $read'+m.id+'))':"")+(m.stream?' (with "act" (func $act'+m.id+'))':"")+'))').join("\n")+"\n"+stub
        +'\n(instance $app (instantiate $guest '+methods.map(m=>'(with "'+m.name+'" '+(m.asynchronous?'(func $p'+m.id+' "start")':'(func $m'+m.id+')')+')').join(" ")+'))\n'
        +canonicalSupervisor+"\n"+channels.map(m=>(m.stream?["pump"]:["deliver","reap"]).map(k=>'(export "'+k+'-'+m.port+'" (func $p'+m.id+' "'+k+'"))').join("\n")).join("\n")+"\n)";
	return {methods,channels,wit,wat,guestContract: stub,prefix};
};
/**
 * Return bytes outside the unique replaceable, top-level nested component.
 * Wasmtime validates the assembled binary, including every guest import.
 *
 * @param bytes - Trusted wasm-tools output for our generated template.
 */
export const splitCanonicalTemplate=bytes=>splitWitApplicationSlots(bytes,["1"]);

/**
 * Keep only the compiler-owned bytes between the replaceable component
 * sections. The object owner, optional callback provider and application
 * must occur exactly once, in that order. Ignore deeper nested components:
 * a marker in a dependency is not a slot in the package template.
 *
 * @param bytes - A binary component emitted by the publisher.
 * @param roles - Ordered identifiers in the generated private custom sections.
 */
export const splitWitApplicationSlots=(bytes,roles)=>{
	const ident=Buffer.from([0,97,115,109,13,0,1,0]),pieces=[];
	if(!roles.length || new Set(roles).size!==roles.length)fail("invalid guest slot inventory");
	const prefix=Buffer.concat([Buffer.from([marker.length]),Buffer.from(marker)]);
	const expected=roles.map(role=>Buffer.concat([prefix,Buffer.from(role)]));
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
	let previous=0;
	visit(bytes,(kind,data,at,end)=>{
		if(kind!==4)return;
		visit(data,(id,payload)=>{
			if(id!==0 || !payload.subarray(0,prefix.length).equals(prefix))return;
			if(at<previous || !expected[pieces.length]?.equals(payload))fail("unexpected or ambiguous guest slot");
			pieces.push(bytes.subarray(previous,at));previous=end;
		});
	});
	if(pieces.length!==roles.length)fail("missing guest slot");
	return [...pieces,bytes.subarray(previous)];
};

/**
 * Generate type-safe bridge callbacks for the release's private C provider.
 *
 * @param model - Reconciled method signatures and portable scalar representations.
 */
export const canonicalNativeHooks=model=>{
	const p=model.prefix,lines=[],registrations=[];
	const register=(port,hook,data="NULL")=>registrations.push(`check(wasmtime_component_linker_instance_add_func(root,"${port}",${port.length},${hook},${data},NULL));`);
	const encoded=(shape,src,dest,dispose)=>canonicalEncode(shape,src,dest)+(shape.dynamic?` ${dispose}(&${src});`:"");
	for(const m of model.methods)
	{
		const n=p+"_"+m.native,id=m.id,idx=model.channels.indexOf(m),{out,failure,terminal}=m;
		if(m.asynchronous) lines.push(`static ${n}_handle owners_${id}[LB_SLOTS];\nstatic void close_${id}(void *ptr) { (void)${n}_close(ptr); }`);
		if(m.asynchronous && !m.stream) lines.push(`
static bool take_${id}(void *ptr,wasmtime_component_val_t *v) {
    ${n}_value x={0}; ${terminal?p+"_buffer msg={0};":""}
    ${p}_status rc=${n}_take(ptr,&x${terminal?",&msg":""});
    ${terminal?`if (rc==${p}_IO_ERROR) { wasmtime_component_val_t *err=lb_child(v,false);
        ${encoded(terminal,"msg","err",p+"_buffer_dispose")} return true; }`:""}
    if (rc!=${p}_OK) return false;
    ${terminal?"v=lb_child(v,true);":""} ${encoded(out,"x","v",n+"_value_dispose")} return true;
}`);
		if(m.stream) lines.push(streamAction(m,p,n,encoded));
		const {values: args,setup,cleanup}=canonicalArguments(m.args,p);
		const typed=m.effect==="EIO",dispose=typed?n+"_start_error_dispose":p+"_buffer_dispose";
		lines.push(`static wasmtime_error_t *hook_${id}(void *data,wasmtime_context_t *ctx,const wasmtime_component_func_type_t *type,
    wasmtime_component_val_t *args,size_t argc,wasmtime_component_val_t *out,size_t retc) {
    (void)ctx;(void)type;(void)args;(void)data;
    if (!accepting) return wasmtime_error_new("native calls require a running guest");
    if (argc!=${args.length} || retc!=1${m.args.map((a,i)=>" || args["+i+"].kind!=WASMTIME_COMPONENT_"+a.t.tag).join("")}) return wasmtime_error_new("unexpected canonical argument");
    ${setup}
    ${failure?(typed?n+"_start_error":p+"_buffer")+" error={0};":""}
    ${m.asynchronous?`lb_cf_reactor *r=&drivers[${idx}]; unsigned key=lb_cf_reserve(r);
    if (!key) { ${cleanup} return wasmtime_error_new("canonical future capacity exhausted"); }
    ${n}_handle *owner=&owners_${id}[key-1]; *owner=(${n}_handle){0};`:`${n}_value value={0};`}
    ${p}_status rc=${n}_${m.asynchronous?"start":"call"}(${[...args,m.asynchronous?"owner":"&value",...failure?["&error"]:[]].join(",")});
    ${cleanup}
    if (rc!=${p}_OK) {
        ${m.asynchronous?"r->rows[key-1]=(lb_cf_row){0};":""}
        ${failure?`if (rc==${p}_${typed?"TYPED_ERROR":"IO_ERROR"}) { wasmtime_component_val_t *err=lb_child(out,false);
            ${encoded(failure,"error","err",dispose)} return NULL; }`:""}
        return wasmtime_error_new("unexpected native Lean failure");
    }
    ${failure?"out=lb_child(out,true);":""}
    ${m.asynchronous?`${m.stream?`r->rows[key-1]=(lb_cf_row){.phase=LB_CF_STREAM,.fd=-1,.owner=owner,.close=close_${id}};`:`int fd=-1; rc=${n}_poll(*owner,&fd);
    if (!((rc==${p}_OK && fd==-1) || (rc==${p}_PENDING && fd>=0)) || !lb_cf_arm(r,key,fd,owner,take_${id},close_${id})) {
        (void)${n}_close(owner);return wasmtime_error_new("could not register native Lean task");
    }`}
    out->kind=WASMTIME_COMPONENT_U32;out->of.u32=key;`:encoded(out,"value","out",n+"_value_dispose")}
    return NULL;
}`);
		register(m.port,"hook_"+id);
		if(m.stream) register("act-"+m.port,"stream_"+id,"&drivers["+idx+"]");
		if(m.asynchronous && m.rich) register("read-"+m.port,"lb_peek","&drivers["+idx+"]");
	}
	lines.push("static void link_hooks(wasmtime_component_linker_instance_t *root) {\n"+registrations.join("\n")+"\n}",
		"static const bool stream_methods[LB_METHODS]={"+model.channels.map(m=>m.stream?"true":"false").join(",")+"};",
		"static const bool pull_methods[LB_METHODS]={"+model.channels.map(m=>m.rich?"true":"false").join(",")+"};",
		"static const char *const methods[LB_METHODS]={"+model.channels.map(m=>JSON.stringify(m.port)).join(",")+"};");
	return lines.join("\n");
};
