/** @file Call compiled copied-value tasks and cursors on the application's native owner. */
import {cIdentifier} from "../c/generate.mjs";
import {witOpEmit,witOpInbound} from "./application-operation-host.mjs";

const carrier=t=>t.kind==="apply"?{left: carrier(t.arguments[0]),right: carrier(t.arguments[1])}:{k: t.name};
const encode=(t,src,dest)=>witOpEmit(carrier(t),src,dest,[],0);
const string={kind: "primitive",name: "string"};
/**
 * Generate the owner-thread operations for one task or cursor.
 *
 * @param o - Compiler-checked native value, error, parameter and symbol inventory.
 * @param o.e - Selected native entry and its factory and delivery error contracts.
 * @param o.byRef - Resolve a Lean type to its C ABI and destructor.
 * @param o.p - Package symbol prefix.
 */
export const copiedWorkerHost=({e,byRef,p})=>{
	const n=cIdentifier(e.name),j=p+n,f="lb_cp_"+n,stream=e.delivery==="async-iterator";
	const args=e.parameters.map(q=>byRef(q.type,n+"_arg")),value=byRef(e.result,n+"_value");
	const err=e.error && byRef(e.error,n+"_failure"),step=e.stepError && byRef(e.stepError,n+"_step_failure");
	const failure=err || e.effect==="IO",terminal=step || e.stepIO || e.taskIO;
	return `#include "application-turn-copied-link.h"
typedef struct {${j}_handle job;lb_val payload;bool used,demand,staged,ended;} ${f}_row;
typedef struct {lb_cp_wire wire;${f}_row rows[64];} ${f};
static inline bool ${f}_close(${f}_row *r){
    bool ok=${j}_close(&r->job)==${p}OK;wasmtime_component_val_delete(&r->payload);*r=(${f}_row){0};return ok;
}
static inline bool ${f}_shutdown(${f} *s){
    bool ok=true;for(unsigned i=0;i<64;i++)if(s->rows[i].used && !${f}_close(s->rows+i))ok=false;
    return ok;
}
static inline bool ${f}_start(${f} *s,${p}binding binding,lb_wit_message *out){
    lb_cp_wire *w=&s->wire;lb_scope scope={.remaining=16u*1024u*1024u};${p}diagnostic diag={0};
    bool invalid=false,ok=false;lb_val *dest=&w->reply;${err?err.type+" error={0};":""}
    ${args.map((a,i)=>a.arg+" a"+i+"={0};").join("")}
    if(w->count!=${args.length})goto done;
    ${args.map((a,i)=>witOpInbound(carrier(e.parameters[i].type),"a"+i,a.arg,"s->wire.args["+i+"]")).join("\n    ")}
    unsigned i=0;while(i<64 && s->rows[i].used)++i;
    if(i==64){w->error="copied worker capacity exhausted";ok=true;goto done;}
    ${f}_row *r=s->rows+i;
    ${p}status rc=${j}_start(binding,${[...args.map((_,i)=>"a"+i),"&r->job",...err?["&error"]:[],"&diag"].join(", ")});
    if(rc==${p}OK)r->used=true;
    ${failure?`if(rc!=${p}OK && rc!=${p}${err?"DECLARED_ERROR":"IO_ERROR"})goto done;
    if(lb_result(&w->reply,rc==${p}OK,&dest,&scope)!=LB_GOOD)goto done;
    if(rc!=${p}OK){${encode(e.error??string,err?"error":"diag.message","dest")}ok=true;goto done;}`:`if(rc!=${p}OK)goto done;`}
    ${stream?"":`int fd=-1;rc=${j}_poll(r->job,&fd);
    if(!((rc==${p}OK && fd==-1) || (rc==${p}PENDING && fd>=0)))goto done;
    out->words[1]=(uint64_t)(fd+1LL);`}
    out->words[0]=i+1;*dest=(lb_val){.kind=WASMTIME_COMPONENT_U32,.of.u32=i+1};ok=true;
done:
    ${err?err.clear("error"):""}${p}diagnostic_clear(&diag);lb_scope_close(&scope);
    if(invalid){w->error="invalid WIT argument or conversion limit: ${n}";return true;}return ok;
}
static inline bool ${f}_check(${f}_row *r,lb_wit_message *out){
    if(r->ended || r->staged${stream?" || !r->demand":""})return false;
    int fd=-1;${p}status rc=${j}_poll(r->job,&fd);
    if(rc==${p}PENDING && fd>=0){out->words[1]=(uint64_t)fd+1;return true;}
    if(rc!=${p}OK || fd!=-1)return false;
    ${value.type} value={0};${step?step.type+" failure={0};":""}${p}diagnostic diag={0};
    lb_scope scope={.remaining=16u*1024u*1024u};lb_val *dest=&r->payload;bool ok=false;
    rc=${j}_take(&r->job,&value,${step?"&failure,":""}&diag);r->demand=false;
    ${stream?`if(rc==${p}END){r->ended=true;out->words[0]=2;ok=true;goto done;}`:""}
    ${terminal?`if(rc!=${p}OK && rc!=${p}${step?"STEP_ERROR":stream?"STEP_IO_ERROR":"TASK_IO_ERROR"})goto done;
    if(lb_result(&r->payload,rc==${p}OK,&dest,&scope)!=LB_GOOD)goto done;
    if(rc!=${p}OK){${encode(e.stepError??string,step?"failure":"diag.message","dest")}}else `:`if(rc!=${p}OK)goto done;
    `}{${encode(e.result,"value","dest")}}
    out->words[0]=${stream?"rc=="+p+"OK?1:3":"1"};r->ended=${stream?"rc!="+p+"OK":"true"};r->staged=true;ok=true;
done:
    ${value.clear("value")}${step?step.clear("failure"):""}${p}diagnostic_clear(&diag);lb_scope_close(&scope);return ok;
}
static inline bool ${f}_call(${f} *s,lb_tc_refs *refs,${p}binding binding,lb_wit_message in,lb_wit_message *out){
    uint64_t k=in.words[0];*out=(lb_wit_message){.op=LB_TC_DONE};
    if(in.words[1] || in.words[2])return false;
    if(in.op==${stream?"LB_TC_DRAIN":"LB_TF_DRAIN"})return !k && lb_tc_flush(refs);
    if(!s->wire.busy)return false;
    if(in.op==LB_CP_START)return !k && ${f}_start(s,binding,out);
    if(!k || k>64 || !s->rows[k-1].used)return false;
    ${f}_row *r=&s->rows[k-1];
    if(in.op==LB_CP_CLOSE)return ${f}_close(r);
    if(in.op==LB_CP_CHECK)return ${f}_check(r,out);
    ${stream?`if(in.op==LB_CP_PULL){
        if(r->ended || r->staged || r->demand || ${j}_pull(r->job)!=${p}OK)return false;
        r->demand=true;return true;
    }`:""}
    if(in.op!=LB_CP_PEEK || !r->staged)return false;
    s->wire.reply=r->payload;r->payload=(lb_val){0};r->staged=false;return true;
}
`;
};
