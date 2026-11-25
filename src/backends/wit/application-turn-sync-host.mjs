/** @file Invoke every synchronous Lean export on the same native owner as its tasks. */
import {cIdentifier} from "../c/generate.mjs";
import {cHostCodecs} from "../c/host-codecs.mjs";
import {hostDeclarationName} from "../../abi/host-member-names.mjs";
import {witConversionPrelude} from "./copied-conversions.mjs";
import {witMemberEncode,witMemberDecode} from "./application-member-dispatch.mjs";
import {witOpEmit,witOpInbound} from "./application-operation-host.mjs";

/**
 * The C facade owns the actual values; only its copied carriers and opaque
 * guest leases are staged while a method is suspended. A frame retains all
 * original guest failures until the *compiled Lean code* selects one.
 *
 * @param o - Reconciled operation, host-member and compiled facade inventories.
 */
export const witTurnSyncHost=o=>{
	const {ir,model,operations,name}=o,{contract,methods}=operations,p=cIdentifier(name)+"_";
	const {scalar,byRef}=cHostCodecs(ir,model.kinds,p,[]),resources=contract.resources,err=resources.length;
	const code=[],members=[];
	for(const [i] of resources.entries())
	{
		const c=scalar(i).type;
		code.push(`static inline bool lb_ts_import${i}(lb_ts_bus *b,const lb_val *v,${c} *out){
    uint64_t t=0;if(!lb_ts_read_token(v,&t))return false;
    lb_tc_ref *r=lb_tc_acquire(b->refs,${i},t);return r && ${c}_adopt(r,lb_tc_dispose,out)==${p}OK;
}
static inline bool lb_ts_token${i}(lb_ts_bus *b,${c} value,uint64_t *ticket){
    void *ptr=NULL;return ${c}_data(value,&ptr)==${p}OK && lb_tc_token(b->refs,${i},ptr,ticket);
}`);
	}
	for(const [i,m] of contract.methods.entries())
	{
		const d=ir.declarations.find(v=>v.id===m.id),native=model.members.find(v=>v.id===m.id);
		const field=cIdentifier(model.kinds[native.owner].name)+"_"+cIdentifier(hostDeclarationName(d));
		const result=scalar(m.result),has=m.result!=="unit",ts=m.inputs.map(a=>scalar(a.kind));
		const sig=["void *ctx",...ts.map((t,j)=>t.arg+" a"+j),...has?[result.type+" *out"]:[]].join(",");
		const fill=m.inputs.map((a,j)=>typeof a.kind==="number"?`if(!lb_ts_token${a.kind}(b,a${j},&token))goto done;
    v[${j}]=(lb_val){.kind=WASMTIME_COMPONENT_U64,.of.u64=token};`:a.kind==="unit"?`if(a${j})goto done;v[${j}]=(lb_val){.kind=WASMTIME_COMPONENT_U8,.of.u8=0};`
			:`{uint64_t w[4]={0};${witMemberEncode(a.kind,"a"+j)}if(lb_output(LB_${a.kind.toUpperCase()},w,&scope,v+${j})!=LB_GOOD)goto done;}`);
		const release=m.inputs.flatMap((a,j)=>typeof a.kind==="number" && a.ownership!=="borrow"?[`if(${ts[j].type}_drop(&a${j})!=${p}OK)rc=UINT32_MAX;`]:[]);
		const decode=!has?(m.error?"if(value)goto done;":""):typeof m.result==="number"?`if(!lb_ts_import${m.result}(b,value,out))goto done;`
			:`{uint64_t w[3]={0};if(!value || !lb_input(LB_${m.result.toUpperCase()},value,&scope,w))goto done;${witMemberDecode(m.result,result.type)}}`;
		members.push("."+field+"=lb_ts_member"+i);
		code.push(`static uint32_t lb_ts_member${i}(${sig}){
    lb_ts_bus *b=ctx;lb_scope scope={.remaining=16u*1024u*1024u};uint32_t rc=UINT32_MAX;uint64_t token=0;(void)token;
    lb_val v[${Math.max(1,ts.length)}]={0},reply={0},*value=&reply;(void)value;
    if(!b || b->poisoned || !b->frame)goto done;
    ${fill.join("\n    ")}
    if(!lb_ts_member(b,${i},v,${ts.length},&reply))goto done;
    ${m.error?`if(reply.kind!=WASMTIME_COMPONENT_RESULT)goto done;
    value=reply.of.result.val;if(!reply.of.result.is_ok){rc=lb_ts_capture(b,value);goto done;}`:""}
    ${decode}
    rc=0;
done:
    ${release.join("\n    ")}
    ${ts.map((_,j)=>"wasmtime_component_val_delete(v+"+j+");").join("")}
    wasmtime_component_val_delete(&reply);lb_scope_close(&scope);if(rc==UINT32_MAX && b)b->poisoned=true;return rc;
}`);
	}
	const ports=[["answer","LB_TS_ANSWER",0],...contract.methods.flatMap((_,i)=>[["args-m"+i,"LB_TS_ARGS",i],["reply-m"+i,"LB_TS_REPLY",i]])];
	const ops=[];
	for(const m of methods)
	{
		const e=m.entry,n=cIdentifier(e.name),r=byRef(e.result,n+"_value"),f=e.error&&byRef(e.error,n+"_failure");
		const args=e.parameters.map(a=>byRef(a.type,n+"_arg")),names=args.map((_,j)=>"a"+j);
		const nominal=(k,v,d)=>`{uint64_t ticket=0;if(!lb_ts_token${k}(b,${v},&ticket) || !lb_ts_clone(b,${k},ticket,${d}))goto done;}`;
		const emit=(t,v,d)=>witOpEmit(t,v,d,resources,0,nominal);
		const success=emit(m.result,"value","dest"),failure=emit(m.declared??{k: "string"},m.declared?"failure":"diag.message","detail");
		const owned=m.params.flatMap(({type},j)=>type.slot==null?[]:[{j,kind: type.slot}]);
		ops.push("lb_ts_op"+m.index);ports.push(["begin-f"+m.index,"LB_TS_BEGIN",m.index],["take-f"+m.index,"LB_TS_TAKE",m.index]);
		code.push(`static bool lb_ts_op${m.index}(lb_ts_bus *b,${p}binding binding,lb_ts_slot *slot){
    lb_scope scope={.remaining=16u*1024u*1024u};lb_val result={0},*dest=&result,*fault_out=NULL;uint32_t fault_id=0;
    bool ok=false,invalid=false;${p}diagnostic diag={0};${r.type} value={0};${f?f.type+" failure={0};":""}
    ${args.map((a,j)=>a.arg+" a"+j+"={0};").join("")}
    if(slot->args.kind!=WASMTIME_COMPONENT_TUPLE || slot->args.of.tuple.size!=${args.length})goto done;
    ${m.params.flatMap(({type: t},j)=>t.slot==null?[witOpInbound(t,names[j],args[j].arg,"slot->args.of.tuple.data["+j+"]")]:[]).join("\n    ")}
    ${owned.map(({j,kind})=>`if(!lb_ts_import${kind}(b,slot->args.of.tuple.data+${j},&a${j}))goto done;`).join("\n    ")}
    ${p}status rc=${p}${n}(${["binding",...names,"&value",...f?["&failure"]:[],"&diag"].join(",")});
    if(b->poisoned)goto done;
    ${m.errors.length?`if(lb_result(&result,rc==${p}OK,&dest,&scope)!=LB_GOOD)goto done;
    if(rc==${p}OK){${success}}else {lb_val *detail=dest;
        ${m.member?`if(lb_result(dest,rc==${p}HOST_ERROR,&detail,&scope)!=LB_GOOD)goto done;
        if(rc==${p}HOST_ERROR){fault_id=diag.host_code;if(!fault_id)goto done;fault_out=detail;}
        else `:""}if(rc==${p}${f?"DECLARED_ERROR":"IO_ERROR"}){${failure}}else goto done;}`:`if(rc!=${p}OK)goto done;
    ${success}`}
    ok=true;
done:
    if(invalid){
        ok=true;${owned.map(({j,kind})=>`if(ok && !lb_ts_discard_input(b,${kind},slot->args.of.tuple.data+${j}))ok=false;`).join("\n        ")}
    }else{
        ${owned.map(({j})=>`if(${args[j].type}_drop(&a${j})!=${p}OK)ok=false;`).join("\n        ")}
    }
    ${r.clear("value")}${f?f.clear("failure"):""}${p}diagnostic_clear(&diag);
    if(!lb_ts_finish(b,${err},fault_id,fault_out) || !lb_tc_flush(b->refs) || b->poisoned)ok=false;
    lb_scope_close(&scope);
    if(ok && invalid)slot->invalid="invalid WIT argument or conversion limit: ${m.name}";
    if(ok && !invalid)slot->result=result;else wasmtime_component_val_delete(&result);return ok;
}`);
	}
	return `#ifndef LB_WIT_APPLICATION_TURN_SYNC_HOST_H
#define LB_WIT_APPLICATION_TURN_SYNC_HOST_H
#include <stdlib.h>
#include <string.h>
#include <wasmtime.h>
#include "public.h"
${witConversionPrelude}
#include "sync-io-values.h"
#include "application-turn-sync.h"
${code.join("\n")}
static const ${p}hosts lb_ts_hosts={${members.join(",")}};
enum {${[...methods.map(m=>"LB_TS_I_"+cIdentifier(m.entry.name)),"LB_TS_COUNT"].join(",")}};
static bool (*const lb_ts_operations[])(lb_ts_bus *,${p}binding,lb_ts_slot *)={${ops.length?ops.join(","):"NULL"}};
static inline bool lb_ts_dispatch(lb_ts_bus *b,${p}binding binding,lb_wit_message in,lb_wit_message *out){
    if(!b || b->poisoned || in.op!=LB_TS_ENTER || in.words[0]>=LB_WIT_TURN_DEPTH || ${methods.length?"in.words[1]>=LB_TS_COUNT":"true"} || in.words[2])return false;
    unsigned k=(unsigned)in.words[0],i=(unsigned)in.words[1];lb_ts_slot *s=b->slots+k;
    if(!s->occupied || s->method!=i || (b->frame && b->frame->index>=k))return false;
    lb_ts_frame frame={.parent=b->frame,.index=k};b->frame=&frame;
    bool ok=lb_ts_operations[i](b,binding,s);b->frame=frame.parent;
    if(!ok)b->poisoned=true;
    *out=(lb_wit_message){.op=LB_TC_DONE,.words={k}};return ok;
}
#include "application-turn-sync-link.h"
typedef struct {lb_ts_control ctl;lb_ts_hook hooks[${ports.length}];} lb_ts_linker;
static inline wasmtime_error_t *lb_ts_link(lb_ts_linker *l,lb_ts_bus *b,lb_wit_turns *turns,wasmtime_component_linker_instance_t *root){
    if(!l || l->ctl.bus || !b || !turns || !root)return wasmtime_error_new("invalid sync binding");
    l->ctl.bus=b;l->ctl.turns=turns;wasmtime_component_linker_instance_t *ns=NULL;
    wasmtime_error_t *e=wasmtime_component_linker_instance_add_instance(root,"sync-ports",10,&ns);if(e)return e;
    static const struct {const char *n;unsigned action,i;} spec[]={${ports.map(([n,a,i])=>`{"${n}",${a},${i}}`).join(",")}};
    for(unsigned j=0;j<${ports.length} && !e;j++){l->hooks[j]=(lb_ts_hook){&l->ctl,spec[j].action,spec[j].i};
        e=wasmtime_component_linker_instance_add_func(ns,spec[j].n,strlen(spec[j].n),lb_ts_step,l->hooks+j,NULL);}
    wasmtime_component_linker_instance_delete(ns);return e;
}
#endif
`;
};
