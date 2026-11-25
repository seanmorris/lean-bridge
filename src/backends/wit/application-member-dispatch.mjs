/** @file Generate application member conversions between Wasmtime and the compiled Lean owner domain. */
import { hostDeclarationName } from "../../abi/host-member-names.mjs";
import { cIdentifier } from "../c/generate.mjs";
import { cHostCodecs } from "../c/host-codecs.mjs";
import { witConversionPrelude } from "./copied-conversions.mjs";

const witName = name => name.replaceAll("-", "_");
const encode = (k,a) => {
	if(k==="string" || k==="bytes") return `w[0]=(uintptr_t)${a}.data;w[1]=${a}.len;w[3]=1;`;
	if(k==="nat" || k==="int") return `w[0]=(uintptr_t)${a}.data;w[1]=${a}.len;w[2]=${a}.negative;w[3]=2;`;
	if(k==="float32" || k==="float64") return `memcpy(w,&${a},sizeof(${a}));`;
	return `w[0]=(uint64_t)${a};`;
};
const decode = (k,type) => {
	if(["int","nat","string","bytes"].includes(k))
	{
		const integer=k==="int" || k==="nat",size=integer?8:1;
		return `void *data=NULL;if(w[1]){if(!lb_charge(&scope,w[1],${size}) || !(data=malloc(w[1]*${size})))goto done;memcpy(data,(void *)(uintptr_t)w[0],w[1]*${size});}
        *out=(${type}){data,w[1]${integer?",w[2]!=0":""}};`;
	}
	if(k==="float32" || k==="float64")return "memcpy(out,w,sizeof(*out));";
	return "*out=("+type+")w[0];";
};

/**
 * Reuse the native facade's checked carrier definitions and WIT's bounded
 * value codecs. No method table, resource rep, or exception index is supplied
 * by the application. Outbound non-borrows are independent guest owners.
 *
 * @param options - Captured project, validated source model and emitted WIT.
 */
export const witApplicationDispatch = options => {
	const {ir,model,entries,descriptor,name}=options,p=cIdentifier(name)+"_";
	const {contract}=descriptor, {scalar,byRef}=cHostCodecs(ir,model.kinds,p,[]);
	const bodies=[],fields=[];
	const key=i=>JSON.stringify(contract.resources[i].key);
	for(const [i,r] of contract.resources.entries())
	{
		const t=scalar(i).type;
		bodies.push(`static inline bool lwit_adopt_${i}(void *o,void (*dispose)(void *),void *out){return ${t}_adopt(o,dispose,out)==${p}OK;}`);
		bodies.push(`static inline lwit_owner *lwit_from_${witName(r.name)}(lwit_members *m,${t} ref){
    void *data=NULL;return ${t}_data(ref,&data)==${p}OK?lwit_unwrap(&m->kinds[${i}],${key(i)},data):NULL;
}`);
		bodies.push(`static inline bool lwit_accept_${i}(lwit_bridge *b,lb_val *value,${t} *out){
    ${t} produced={0};if(!out || !${scalar(i).empty("*out")})return false;
    if(lwit_intern(&b->members.kinds[${i}],${key(i)},value,lwit_adopt_${i},&produced)){*out=produced;return true;}
    (void)${t}_drop(&produced);return false;
}
static inline bool lwit_import_${witName(r.name)}(lwit_bridge *b,lwit_owner *owner,${t} *out){
    if(!b || !out || !${scalar(i).empty("*out")} || !lwit_is(&b->members.kinds[${i}],owner))return false;
    lb_val value={0};if(!lwit_give(owner,&value))return false;
    bool ok=lwit_accept_${i}(b,&value,out);
    if(value.kind==WASMTIME_COMPONENT_RESOURCE && value.of.resource && lwit_open(b->members.store)){
        if(!lwit_no_error(wasmtime_component_resource_any_drop(b->members.store->ctx,value.of.resource)))b->members.store->failed=true;
    }
    wasmtime_component_val_delete(&value);return ok;
}
static inline wasmtime_error_t *lwit_export_${witName(r.name)}(lwit_bridge *b,${t} ref,lwit_owner *out){
    if(!b)return wasmtime_error_new("missing WIT application binding");
    return lwit_retain(&b->members.kinds[${i}],lwit_from_${witName(r.name)}(&b->members,ref),out);
}`);
	}
	for(const [i,m] of contract.methods.entries())
	{
		const d=ir.declarations.find(v=>v.id===m.id), native=model.members.find(v=>v.id===m.id);
		const label=cIdentifier(model.kinds[native.owner].name)+"_"+cIdentifier(hostDeclarationName(d));
		const args=m.inputs.map((a,j)=>scalar(a.kind).arg+" a"+j);
		const result=scalar(m.result),has=m.result!=="unit",params=["void *ctx",...args,...has?[result.type+" *out"]:[]];
		const owned=m.inputs.flatMap((a,j)=>typeof a.kind==="number" && a.ownership!=="borrow"?[j]:[]);
		const ins=m.inputs.map((a,j)=>{
			if(typeof a.kind!=="number")return `{uint64_t w[4]={0};${encode(a.kind,"a"+j)}if(lb_output(LB_${a.kind.toUpperCase()},w,&scope,&args[${j}])!=LB_GOOD)goto done;}`;
			const r=contract.resources[a.kind],v="args["+j+"]";
			return `{lwit_owner *o=lwit_from_${witName(r.name)}(&b->members,a${j});if(!o)goto done;
        ${a.ownership==="borrow"?`${v}.kind=WASMTIME_COMPONENT_RESOURCE;${v}.of.resource=wasmtime_component_resource_any_clone(o->any);`:`if(!lwit_no_error(lwit_retain(&b->members.kinds[${a.kind}],o,&stage${j})))goto done;`}}`;
		});
		const convert=!has?"if(value)goto done;":typeof m.result==="number"
			?`if(!lwit_accept_${m.result}(b,value,out))goto done;`
			:`{uint64_t w[3]={0};if(!value || !lb_input(LB_${m.result.toUpperCase()},value,&scope,w))goto done;${decode(m.result,result.type)}}`;
		const f=m.error?`if(reply.kind!=WASMTIME_COMPONENT_RESULT)goto done;
    value=reply.of.result.val;
    if(!reply.of.result.is_ok){code=lwit_capture(b->frame,s,b->members.error,value);goto done;}`:`value=${has?"&reply":"NULL"};`;
		fields.push("."+label+"=lwit_invoke_"+i);
		bodies.push(`static uint32_t lwit_invoke_${i}(${params.join(",")}){
    lwit_bridge *b=ctx;lwit_store *s=b->members.store;uint32_t code=UINT32_MAX;
    lb_scope scope={.remaining=16u*1024u*1024u};
    lb_val args[${Math.max(args.length,1)}]={0},reply={0},*value=NULL;
    ${owned.map(j=>"lwit_owner stage"+j+"={0};").join("")}
    if(!lwit_open(s) || !b->frame)goto done;
    ${ins.join("\n    ")}
    ${owned.map(j=>`if(!lwit_give(&stage${j},&args[${j}]))goto done;`).join("\n    ")}
    {wasmtime_error_t *e=wasmtime_component_func_call(&b->members.on_${witName(m.resource)}.m_${witName(m.name)},s->ctx,args,${args.length},&reply,${has||m.error?1:0});
     if(!lwit_no_error(e) || !lwit_open(s))goto done;}
    ${f}
    ${convert}
    code=0;
done:
    if(code==UINT32_MAX)s->failed=true;
    ${owned.map(j=>`(void)lwit_no_error(lwit_drop(&stage${j}));(void)${scalar(m.inputs[j].kind).type}_drop(&a${j});`).join("\n    ")}
    ${args.map((_,j)=>`wasmtime_component_val_delete(&args[${j}]);`).join("\n    ")}
    wasmtime_component_val_delete(&reply);lb_scope_close(&scope);return lwit_open(s)?code:UINT32_MAX;
}`);
	}
	const sync=entries.map(e=>{
		const n=cIdentifier(e.name),a=e.parameters.map(t=>byRef(t.type,n+"_arg")),r=byRef(e.result,n+"_value");
		const err=e.effect==="EIO" && byRef(e.error,n+"_failure");
		const params=["lwit_bridge *b",...a.map((v,j)=>v.arg+" a"+j),r.type+" *value",...err?[err.type+" *failure"]:[],"lwit_owner *original",p+"diagnostic *diag"];
		const validate=e.parameters.flatMap((param,j)=>{
			if(param.type.kind!=="named")return [];
			const resource=contract.resources.find(v=>v.id===param.type.id);
			if(!resource)throw new TypeError("Unbound WIT application object: "+param.type.id);
			return [`if(!lwit_from_${witName(resource.name)}(&b->members,a${j}))return ${p}INVALID;`];
		});
		return `static inline ${p}status lwit_sync_${n}(${params.join(",")}){
    if(!b || !original || original->source || original->any || !diag || !value || !${r.empty("*value")}${err?" || !failure || (void *)value==(void *)failure || !"+err.empty("*failure"):""})return ${p}INVALID;
    lwit_store *s=b->members.store;if(!lwit_open(s))return ${p}UNAVAILABLE;
    ${validate.join("\n    ")}
    if(s->active>=64)return ${p}LIMIT;
    ${r.type} produced={0};${err?err.type+" rejected={0};":""}
    lwit_call_frame frame={.parent=b->frame};b->frame=&frame;++s->active;
    ${p}status status=${p}${n}(${["b->binding",...a.map((_,j)=>"a"+j),"&produced",...err?["&rejected"]:[],"diag"].join(",")});
    uint32_t id=status==${p}HOST_ERROR?diag->host_code:0;
    if(status==${p}HOST_ERROR)diag->host_code=0;
    if(!lwit_finish_frame(&frame,id,original) || (status==${p}HOST_ERROR && !id))s->failed=true;
    b->frame=frame.parent;
    if(lwit_open(s) && status==${p}OK)*value=produced;else {${r.clear("produced")}}
    ${err?"if(lwit_open(s) && status=="+p+"DECLARED_ERROR)*failure=rejected;else {"+err.clear("rejected")+"}":""}
    if(!lwit_open(s)){(void)lwit_no_error(lwit_drop(original));status=${p}UNAVAILABLE;}
    --s->active;return status;
}`;
	});
	return `/* Private generated Wasmtime / native Lean application binding. */
#include "public.h"
#include "application-members.h"
#include "application-member-runtime.h"
${witConversionPrelude}
#include "sync-io-values.h"
typedef struct { lwit_members members; ${p}binding binding; lwit_call_frame *frame; } lwit_bridge;
${bodies.join("\n")}
static inline bool lwit_bridge_open(lwit_store *s,lwit_bridge *b){
    (void)lb_input;(void)lb_output;(void)lb_result;
    if(!b || !lwit_members_bind(s,&b->members))return false;
    const ${p}hosts methods={${fields.join(",")}};
    if(${p}with_hosts(&methods,b,&b->binding)==${p}OK)return true;
    lwit_members_clear(&b->members);return false;
}
static inline ${p}status lwit_bridge_close(lwit_bridge *b){
    if(!b || !b->members.store)return ${p}INVALID;
    if(b->frame || b->members.store->active)return ${p}BUSY;
    ${p}status rc=${p}close(&b->binding);if(rc==${p}OK)lwit_members_clear(&b->members);
    return rc;
}
${sync.join("\n")}
`;
};
