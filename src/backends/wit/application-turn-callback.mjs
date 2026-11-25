/** @file Private Wasm responder for a source-selected, guest-owned callback. */

/**
 * Only the defining guest invokes a registration. Temporary owners keep its
 * receiver and argument alive through re-entry; stage the original result
 * (including an uncloneable exception) before releasing either temporary.
 *
 * @param m - Reconciled input, result, exception and registration kind indexes.
 */
export const witTurnCallbackInvoke=m=>{
	const {a,z,err,cb}=m;
	const slots=[...new Set([a,z,err,cb])];
	const fs=[
		...[[cb,"registration"],[a,"argument"]].map(([i,n])=>[n,`(param "ticket" u64) (result (option (own $r${i})))`,"(param i64 i32)"])
		, ...[[z,"value"],[err,"error"]].map(([i,n])=>[n,`(param "value" (own $r${i})) (result u64)`,"(param i32) (result i64)"])
		, ["invoke",`(param "self" (borrow $r${cb})) (param "value" (borrow $r${a})) (result (result (own $r${z}) (error (own $r${err}))))`,"(param i32 i32 i32)"]];
	return `(component
      ${slots.map(i=>`(import "r${i}" (type $r${i} (sub resource)))`).join(" ")}
      ${fs.map(([n,t])=>`(import "${n}" (func $${n} ${t}))`).join("\n")}
      (core module $mem (memory (export "m") 1)) (core instance $m (instantiate $mem))
      ${fs.map(([n])=>`(core func $${n} (canon lower (func $${n}) (memory $m "m")))`).join("\n")}
      (core func $end-cb (canon resource.drop $r${cb})) (core func $end-arg (canon resource.drop $r${a}))
      (core module $body (import "" "m" (memory 1))
        ${fs.map(([n,,sig])=>`(import "" "${n}" (func $${n} ${sig}))`).join("\n")}
        (import "" "end-cb" (func $end-cb (param i32))) (import "" "end-arg" (func $end-arg (param i32)))
        (func $read (result i32) (if (i32.ne (i32.load8_u (i32.const 0)) (i32.const 1)) (then unreachable)) (i32.load (i32.const 4)))
        (func (export "invoke") (param $registration i64) (param $argument i64) (result i32)
          (local $c i32) (local $a i32) (local $failed i32) (local $token i64)
          (call $registration (local.get $registration) (i32.const 0)) (local.set $c (call $read))
          (call $argument (local.get $argument) (i32.const 0)) (local.set $a (call $read))
          (call $invoke (local.get $c) (local.get $a) (i32.const 0))
          (local.set $failed (i32.load8_u (i32.const 0)))
          (local.set $token (if (result i64) (local.get $failed)
            (then (call $error (i32.load (i32.const 4)))) (else (call $value (i32.load (i32.const 4))))))
          (call $end-arg (local.get $a)) (call $end-cb (local.get $c))
          (if (i64.eqz (local.get $token)) (then unreachable))
          (i32.store8 (i32.const 0) (local.get $failed)) (i64.store (i32.const 8) (local.get $token)) (i32.const 0)))
      (core instance $i (instantiate $body (with "" (instance (export "m" (memory $m "m"))
        ${fs.map(([n])=>`(export "${n}" (func $${n}))`).join(" ")}
        (export "end-cb" (func $end-cb)) (export "end-arg" (func $end-arg))))))
      (func (export "invoke") (param "registration" u64) (param "argument" u64) (result (result u64 (error u64)))
        (canon lift (core func $i "invoke") (memory $m "m"))))`;
};

/**
 * Install the generated C callback on the native registry owner. No store
 * access occurs on this thread. The native task owns its registration until
 * closure disposal, even when the caller immediately drops its own handle.
 *
 * @param o - Source-derived C prefix, signature names and nominal slots.
 */
export const witTurnCallbackHost=o=>{
	const {prefix: p,sigs,errorKind: err}=o;
	return `#ifndef LB_WIT_TURN_CALLBACKS_H
#define LB_WIT_TURN_CALLBACKS_H
#include "application-turn-cursor.h"
#include <stdlib.h>
static inline bool lb_tcb_take_error(lb_tc_refs *s,${p}diagnostic *d,uint64_t *ticket){
    if(!d || d->dispose_payload!=lb_tc_dispose || !lb_tc_token(s,${err},d->payload,ticket))return false;
    lb_tc_ref *r=d->payload;*r=(lb_tc_ref){0};d->dispose_payload=NULL;d->payload=NULL;return true;
}
${sigs.map(({a,z,input,output,callback},i)=>{
	const f="lb_tcb_"+callback,n=p+callback;
	return `typedef struct {lb_tc_refs *pool;lb_tc_ref *registration;} ${f};
static void ${f}_dispose(void *ptr){
    ${f} *c=ptr;lb_tc_dispose(c->registration);free(c);
}
static ${p}status ${f}_call(void *ptr,${p}${input} arg,${p}${output} *out,${p}diagnostic *d){
    ${f} *c=ptr;void *raw=NULL;uint64_t arg_ticket=0,reg_ticket=0;lb_wit_message reply={0};
    if(!out || !d || ${p}${input}_data(arg,&raw)!=${p}OK || !lb_tc_token(c->pool,${a},raw,&arg_ticket) ||
       !lb_tc_token(c->pool,${err+1+i},c->registration,&reg_ticket))return ${p}INVALID;
    if(!lb_wit_turn_request(c->pool->turns,(lb_wit_message){LB_TC_INVOKE,{${i},reg_ticket,arg_ticket}},&reply) ||
       reply.op!=LB_TC_CALLBACK_REPLY || reply.words[0]>1 || !reply.words[1] || reply.words[2])return ${p}INVALID;
    if(reply.words[0]){
        lb_tc_ref *fault=lb_tc_own(c->pool,${err},reply.words[1]);if(!fault)return ${p}LIMIT;
        d->payload=fault;d->dispose_payload=lb_tc_dispose;return ${p}CALLBACK_ERROR;
    }
    lb_tc_ref *r=lb_tc_acquire(c->pool,${z},reply.words[1]);if(!r)return ${p}INVALID;
    return ${p}${output}_adopt(r,lb_tc_dispose,out);
}
static inline bool ${f}_adopt(lb_tc_refs *pool,uint64_t token,${n} *out){
    lb_tc_ref *r=lb_tc_own(pool,${err+1+i},token);if(!r)return false;
    ${f} *c=malloc(sizeof *c);if(!c){lb_tc_dispose(r);return false;}
    *c=(${f}){pool,r};
    if(${n}_new(${f}_call,c,${f}_dispose,out)!=${p}OK){${f}_dispose(c);return false;}
    return true;
}`;
}).join("\n")}
#endif
`;
};

/**
 * Generate a native owner-side task channel. Poll is the only operation that
 * drives a queued callback. Returning a borrowed readiness fd does not invoke
 * it. Keep the native owner/diagnostic until the canonical writer has copied
 * its payload, or until abandonment. No guest pointer crosses the turn.
 *
 * @param m - Reconciled source task and retained-callback signature.
 */
export const witTurnRelayHost=m=>{
	const {p,n,callback,a,z,input,output}=m,f="lb_tf_"+n,j=p+n;
	return `#include "application-turn-callbacks.h"
typedef struct {${j}_handle job;${output} value;${p}diagnostic diag;unsigned arm;bool used,peeked;} ${f}_row;
typedef struct {${f}_row rows[64];} ${f};
static inline bool ${f}_close(${f}_row *r){
    bool ok=${j}_close(&r->job)==${p}OK;
    if(r->arm==1 && ${output}_drop(&r->value)!=${p}OK)ok=false;
    ${p}diagnostic_clear(&r->diag);*r=(${f}_row){0};return ok;
}
static inline bool ${f}_shutdown(${f} *s){
    bool ok=true;for(unsigned i=0;i<64;i++)if(s->rows[i].used && !${f}_close(&s->rows[i]))ok=false;return ok;
}
static inline bool ${f}_call(${f} *s,lb_tc_refs *refs,${p}binding binding,lb_wit_message in,lb_wit_message *out){
    uint64_t key=in.words[0];*out=(lb_wit_message){.op=LB_TC_DONE};
    if(in.op==LB_TF_DRAIN)return !key && !in.words[1] && !in.words[2] && lb_tc_flush(refs);
    if(in.op==LB_TF_OPEN){
        if(key || !in.words[1] || !in.words[2])return false;
        unsigned i=0;while(i<64 && s->rows[i].used)i++;
        if(i==64){(void)lb_tc_release(refs,${a},in.words[1]);(void)lb_tc_release(refs,${m.cb},in.words[2]);return false;}
        ${f}_row *r=&s->rows[i];r->used=true;${input} arg={0};${p}${callback} cb={0};
        bool registered=lb_tcb_${callback}_adopt(refs,in.words[2],&cb),valid=false,ok=false;
        lb_tc_ref *ref=registered?lb_tc_acquire(refs,${a},in.words[1]):NULL;
        if(ref)valid=${input}_adopt(ref,lb_tc_dispose,&arg)==${p}OK;
        if(valid)ok=${j}_start(binding,arg,cb,&r->job,&r->diag)==${p}OK;
        if(valid && ${input}_drop(&arg)!=${p}OK)ok=false;
        if(registered && ${p}${callback}_drop(&cb)!=${p}OK)ok=false;
        int fd=-1;if(ok){${p}status rc=${j}_wakeup(r->job,&fd);ok=(rc==${p}OK && fd==-1) || (rc==${p}PENDING && fd>=0);}
        if(!ok){(void)${f}_close(r);return false;}
        out->words[0]=i+1;out->words[2]=fd<0?0:(uint64_t)fd+1;return lb_tc_flush(refs);
    }
    if(!key || key>64 || in.words[2] || (in.op!=LB_TF_TEXT && in.words[1]))return false;
    ${f}_row *r=&s->rows[key-1];if(!r->used)return false;
    if(in.op==LB_TF_CLOSE)return ${f}_close(r) && lb_tc_flush(refs);
    if(in.op==LB_TF_POLL){
        if(r->arm)return false;
        int fd=-1;${p}status rc=${j}_poll(r->job,&fd);
        if(rc==${p}PENDING){if(fd<0)return false;out->words[2]=(uint64_t)fd+1;return lb_tc_flush(refs);}
        if(rc!=${p}OK || fd!=-1)return false;
        rc=${j}_take(&r->job,&r->value,&r->diag);
        if(rc==${p}OK)r->arm=1;
        else if(rc==${p}CALLBACK_ERROR && r->diag.dispose_payload==lb_tc_dispose && r->diag.payload)r->arm=2;
        else if(rc==${p}TASK_IO_ERROR && !r->diag.payload && r->diag.message.len<=16777216 &&
                (!r->diag.message.len || r->diag.message.data))r->arm=3;
        else return false;
        out->words[0]=1;
    }else if(in.op==LB_TF_PEEK){
        if(!r->arm || r->peeked)return false;
        out->words[0]=r->arm-1;
        if(r->arm==1){void *v=NULL;if(${output}_data(r->value,&v)!=${p}OK || !lb_tc_token(refs,${z},v,&out->words[1]))return false;}
        else if(r->arm==2){if(!lb_tcb_take_error(refs,&r->diag,&out->words[1]))return false;}
        else out->words[1]=r->diag.message.len;
        r->peeked=true;
    }else if(in.op==LB_TF_TEXT){
        uint64_t pos=in.words[1];if(!r->peeked || r->arm!=3 || pos>=r->diag.message.len)return false;
        unsigned nbytes=(unsigned)(r->diag.message.len-pos);if(nbytes>16)nbytes=16;
        out->words[0]=nbytes;for(unsigned i=0;i<nbytes;i++)out->words[1+i/8]|=(uint64_t)r->diag.message.data[pos+i]<<(8*(i%8));
        return true; /* No guest call can interrupt copying a text payload. */
    }else return false;
    return lb_tc_flush(refs);
}
`;
};
