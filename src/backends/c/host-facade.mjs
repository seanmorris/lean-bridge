/** @file Generate the public typed C binding and adapt its named members to compiled Lean. */
import {cIdentifier} from "./generate.mjs";
import {hostDeclarationName} from "../../abi/host-member-names.mjs";
import {cHostCodecs} from "./host-codecs.mjs";
import {cHostWorkers} from "./host-worker-api.mjs";

/**
 * The application sees ordinary C member function pointers, typed references
 * and structured errors. Only this generated file knows private operation slots.
 *
 * @param o - Checked C package coordinate, native kernel and authenticated host imports.
 */
export const cHostFacade=o=>{
	const {ir,entries,model,identity,prefix}=o;
	const p=cIdentifier(o.name)+"_",guard="LB_C_PUBLIC_"+identity.toUpperCase(),defs=[],code=[],symbols=[];
	const used=new Set(),reserve=n=>{if(used.has(n)) throw new TypeError("C host public name collision: "+n);used.add(n);return n;};
	const names=["binding","hosts","status","diagnostic","view","buffer","integer","integer_view"];
	names.forEach(reserve);
	{
		defs.push("typedef struct { uint64_t _private[2]; } "+p+"binding;",
			"typedef enum { "+["OK","INVALID","STALE","LIMIT","UNAVAILABLE","IO_ERROR","DECLARED_ERROR","HOST_ERROR","BUSY",...o.workerWire?["PENDING","END","IDLE","CANCELLED","CALLBACK_ERROR","CALLBACK_CLOSED","TASK_IO_ERROR","STEP_ERROR","STEP_IO_ERROR"]:[]].map(x=>p+x).join(", ")+" } "+p+"status;",
			"typedef struct { const uint8_t *data; size_t len; } "+p+"view;",
			"typedef struct { uint8_t *data; size_t len; } "+p+"buffer;",
			"typedef struct { const uint64_t *data; size_t len; bool negative; } "+p+"integer_view;",
			"typedef struct { uint64_t *data; size_t len; bool negative; } "+p+"integer;",
			"typedef struct { uint32_t host_code; "+p+"buffer message; "+(o.workerWire?"void *payload; void (*dispose_payload)(void *); ":"")+"} "+p+"diagnostic;");
	}
	const add=(suffix,ret,args,body)=>{
		reserve(suffix);const n=p+suffix,decl=ret+" "+n+"("+args+")"; defs.push(decl+";");symbols.push(n);
		code.push('__attribute__((visibility("default"))) '+decl+" {\n"+body+"\n}");
	};
	add("diagnostic_clear","void",p+"diagnostic *d",o.workerWire?"if(d){"+p+"diagnostic v=*d;*d=("+p+"diagnostic){0};free(v.message.data);if(v.dispose_payload)v.dispose_payload(v.payload);}":"if(d) { free(d->message.data); *d=("+p+"diagnostic){0}; }");
	for(const x of ["buffer","integer"]) add(x+"_clear","void",p+x+" *v","if(v) { free(v->data); *v=("+p+x+"){0}; }");
	const {scalar,byRef}=cHostCodecs(ir,model.kinds,p,defs);
	model.kinds.forEach((k,i)=>{
		const label=reserve(cIdentifier(k.name)),type=p+label,tag="lb_c_host_type_"+k.key,check=JSON.stringify(k.key);
		defs.push("#ifndef "+tag.toUpperCase(),"#define "+tag.toUpperCase(),"typedef struct { uint64_t _private[2]; } "+tag+";","#endif","typedef "+tag+" "+type+";");
		const v=scalar(i),fresh=v.empty("*out");
		add(label+"_adopt",p+"status","void *data, void (*dispose)(void *), "+type+" *out",
			`if(!out || !${fresh}) return ${p}INVALID; lb_cr_ref r={0}; int c=LB_CR(adopt)(${check},data,(lb_cr_fn)dispose,dispose?lb_dispose:NULL,&r);
    if(!c) *out=(${type}){{r.domain,r.ticket}}; return lb_status(c);`);
		add(label+"_data",p+"status",type+" ref, void **data","return lb_status(LB_CR(get)("+check+","+v.raw("ref")+",data));");
		add(label+"_clone",p+"status",type+" ref, "+type+" *out",`if(!out || !${fresh}) return ${p}INVALID; lb_cr_ref r={0}; int c=LB_CR(clone)(${check},${v.raw("ref")},&r); if(!c) *out=(${type}){{r.domain,r.ticket}}; return lb_status(c);`);
		add(label+"_drop",p+"status",type+" *ref",`if(!ref) return ${p}INVALID; lb_cr_ref r=${v.raw("*ref")}; int c=LB_CR(drop)(${check},&r); if(!c) *ref=(${type}){0}; return lb_status(c);`);
		add(label+"_same",p+"status",type+" a, "+type+" b, bool *equal",`if(!equal) return ${p}INVALID; int eq=0,c=LB_CR(same)(${check},${v.raw("a")},${v.raw("b")},&eq); if(!c) *equal=eq!=0; return lb_status(c);`);
	});
	const fields=[],cases=[],labels=new Set();
	for(const [i,m] of model.members.entries())
	{
		const d=ir.declarations.find(e=>e.id===m.id), label=cIdentifier(model.kinds[m.owner].name)+"_"+cIdentifier(hostDeclarationName(d));
		if(labels.has(label)) throw new TypeError("C host member collision: "+label);labels.add(label);
		const args=m.args.map(scalar),result=scalar(m.result),hasResult=m.result!=="unit";
		fields.push("    uint32_t (*"+label+")("+["void *context",...args.map((v,j)=>v.arg+" a"+j),...hasResult?[result.type+" *out"]:[]].join(", ")+");");
		const bad=()=>"goto done;",ownedInput=args.map((a,j)=>a.nominal && m.inputOwnership[j]!=="borrow");
		const cleanup=args.flatMap((a,j)=>a.nominal?[(ownedInput[j]?"if(!called) ":"")+a.clear("a"+j)]:[]);
		cases.push(`case ${i}: {
    if(n!=${args.length}) return 2;
    int rc=2; bool called=false; size_t budget=0; uint32_t err=0;
    ${args.map((v,j)=>v.arg+" a"+j+"={0};").join(" ")}
    ${hasResult?result.type+" result={0};":""}
    ${args.map((a,j)=>a.nominal?`{ lb_cr_ref borrowed={0},own={0}; if(LB_CR(lift)(${a.key},w[${3*j}],&borrowed) || LB_CR(clone)(${a.key},borrowed,&own)) goto done_${i}; a${j}=(${a.type}){{own.domain,own.ticket}}; }`:a.unpack("a"+j,"w+"+3*j,bad,{borrowed: true})).join("\n    ")}
    called=true; err=s->methods.${label}(${["s->context",...args.map((_,j)=>"a"+j),...hasResult?["&result"]:[]].join(",")});
    ${result.dyn?"scope->buffer=result.data;":""}
    ${o.cpp?"if(err==UINT32_MAX) goto done_"+i+";\n    ":""}if(err) { *fault=err; rc=1; goto done_${i}; }
    ${result.nominal?`{ lb_cr_ref own={0}; if(LB_CR(clone)(${result.key},${result.raw("result")},&own)) goto done_${i}; scope->key=${result.key}; scope->temp=own; out[0]=own.ticket; }`
		:hasResult?result.pack("result","out",()=>("goto done_"+i+";")):"out[0]=0;"}
    rc=0;
done_${i}:
    ${result.nominal && (o.cpp || m.resultOwnership!=="borrow")?result.clear("result"):""}
    ${cleanup.join(" ")} (void)called; (void)budget; return rc;
}`);
	}
	if(!fields.length) throw new TypeError("C host requires members");
	defs.push("typedef struct {\n"+fields.join("\n")+"\n} "+p+"hosts;");
	const binding=p+"binding",br=v=>"(lb_cr_ref){("+v+")._private[0],("+v+")._private[1]}";
	add("with_hosts",p+"status","const "+p+"hosts *methods, void *context, "+binding+" *out",
		`if(!methods || !out || out->_private[0] || out->_private[1] || ${[...labels].map(n=>"!methods->"+n).join(" || ")}) return ${p}INVALID;
    lb_app *app=calloc(1,sizeof *app); if(!app) return ${p}LIMIT; app->methods=*methods; app->context=context;
    lb_cr_ref r={0}; int c=LB_CR(binding)(lb_component_key,app,(lb_cr_fn)free,lb_dispose,&r);
    if(c) { free(app); return lb_status(c); }
    lb_scope scope={.binding=r,.app=app}; uint64_t words[4]={0}; uint8_t tags[65]={0}; uint32_t fault=0;
    int rc=${prefix}_call((uintptr_t)&scope,lb_dispatch,-2,NULL,0,words,tags,&fault);
    if(rc) { LB_CR(binding_drop)(lb_component_key,&r); return lb_native(rc); }
    *out=(${binding}){{r.domain,r.ticket}}; return ${p}OK;`);
	add("close",p+"status",binding+" *binding",
		`if(!binding) return ${p}INVALID; lb_cr_ref r=${br("*binding")}; void *app=NULL; int c=LB_CR(binding_get)(lb_component_key,r,&app);
    if(c) return lb_status(c); if(((lb_app *)app)->depth) return ${p}BUSY;
    lb_scope scope={.binding=r,.app=app}; uint64_t w[4]={0}; uint8_t tags[65]={0}; uint32_t fault=0;
    ${o.workerWire?"scope.app->closing=true;while(scope.app->jobs)lw_finish(scope.app->jobs);\n    ":""}++scope.app->depth; int rc=${prefix}_call((uintptr_t)&scope,lb_dispatch,-1,NULL,0,w,tags,&fault); --scope.app->depth;
    if(rc) return lb_native(rc); c=LB_CR(binding_drop)(lb_component_key,&r); if(!c) *binding=(${binding}){0}; return lb_status(c);`);
	for(const [i,e] of entries.entries())
	{
		const name=cIdentifier(e.name),a=e.parameters.map(t=>byRef(t.type,name+"_arg")),r=byRef(e.result,name+"_value"),err=e.effect==="EIO" && byRef(e.error,name+"_failure");
		if(e.result.kind==="apply") add(name+"_value_clear","void",r.type+" *v","if(v) { "+r.clear("*v")+" *v=("+r.type+"){0}; }");
		if(err && e.error.kind==="apply") add(name+"_failure_clear","void",err.type+" *v","if(v) { "+err.clear("*v")+" *v=("+err.type+"){0}; }");
		const params=[binding+" binding",...a.map((v,j)=>v.arg+" a"+j),r.type+" *value",...err?[err.type+" *failure"]:[],p+"diagnostic *diag"];
		const bad=c=>"return lb_status("+c+");",retired=()=>"lean_bridge_native_runtime_retire(); status="+p+"UNAVAILABLE; goto exit;";
		add(name,p+"status",params.join(", "),`if(!value || !${r.empty("*value")} || ${o.workerWire?"!lw_empty(diag)":"!diag || diag->message.data || diag->message.len"}${err?" || !failure || !"+err.empty("*failure"):""}) return ${p}INVALID;
    lb_cr_ref binding_ref=${br("binding")}; void *app=NULL; int c=LB_CR(binding_get)(lb_component_key,binding_ref,&app); if(c) return lb_status(c);
    ${o.workerWire?"if(((lb_app*)app)->closing) return "+p+"BUSY;\n    ":""}if(((lb_app*)app)->depth>=64) return ${p}LIMIT;
    size_t budget=0; uint64_t w[${Math.max(1,a.length*3)}]={0},out[4]={0}; uint8_t tags[65]={0}; uint32_t fault=0;
    ${a.map((v,j)=>v.pack("a"+j,"w+"+3*j,bad)).join("\n    ")}
    lb_scope scope={.binding=binding_ref,.app=app}; ++scope.app->depth;
    int rc=${prefix}_call((uintptr_t)&scope,lb_dispatch,${i},w,${a.length},out,tags,&fault);
    ${p}status status=lb_native(rc); (void)budget;
    if(!rc) { ${r.unpack("*value","out",retired)} out[3]=0; }
    ${err?"else if(rc==3) { "+err.unpack("*failure","out",retired)+" out[3]=0; }":""}
    else if(rc==4) { diag->message=(${p}buffer){(uint8_t *)(uintptr_t)out[0],out[1]}; out[3]=0; }
    else if(rc==13) diag->host_code=fault;
    goto exit;
exit: ${prefix}_clear(out); lb_reset(&scope); --scope.app->depth; return status;`);
	}
	const worker=o.workerWire?cHostWorkers(o,{p,byRef,add,reserve,defs}):"";
	const header="#ifndef "+guard+"\n#define "+guard+"\n#include <stdbool.h>\n#include <stddef.h>\n#include <stdint.h>\n#ifdef __cplusplus\nextern \"C\" {\n#endif\n"+defs.join("\n")+"\n#ifdef __cplusplus\n}\n#endif\n#endif\n";
	const source=`#include "public.h"
#include "host-registry.h"
static const char lb_component_key[]="${identity}";
static const char *const lb_keys[]={${model.kinds.map(k=>JSON.stringify(k.key)).join(",")}};
typedef struct { ${p}hosts methods; void *context; unsigned depth; ${o.workerWire?"struct lw_job *jobs; bool closing;":""}} lb_app;
typedef struct { lb_cr_ref binding,temp; lb_app *app; const char *key; void *buffer; } lb_scope;
static void lb_reset(lb_scope *s) { free(s->buffer); s->buffer=NULL; if(s->temp.ticket) LB_CR(drop)(s->key,&s->temp); }
static void lb_dispose(lb_cr_fn fn,void *ptr) { ((void (*)(void *))fn)(ptr); }
static ${p}status lb_status(int c) { switch(c) {case CR_OK:return ${p}OK;case CR_STALE:return ${p}STALE;case CR_LIMIT:return ${p}LIMIT;case CR_INVALID:return ${p}INVALID;default:return ${p}UNAVAILABLE;} }
static ${p}status lb_native(int c) { switch(c) {case 0:return ${p}OK;case 3:return ${p}DECLARED_ERROR;case 4:return ${p}IO_ERROR;case 5:return ${p}INVALID;case 11:case 12:return ${p}LIMIT;case 13:return ${p}HOST_ERROR;case 14:return ${p}BUSY;default:return ${p}UNAVAILABLE;} }
#include "host-copied.h"
static int lb_dispatch(uint64_t id,int32_t op,const uint64_t *w,size_t n,uint64_t *out,uint32_t *fault) {
    lb_scope *scope=(lb_scope *)(uintptr_t)id; lb_app *s=scope->app;
    if(op<0) return LB_CR(refop)(scope->binding.ticket,lb_keys,${model.kinds.length},op,w,n,out);
    lb_reset(scope);
    switch(op) { ${cases.join("\n")} default: return 2; }
}
${worker?worker+"\n":""}${code.join("\n")}
`;
	return {header,source,symbols,prefix: p};
};
