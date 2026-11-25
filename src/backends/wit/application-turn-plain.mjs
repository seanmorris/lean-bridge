/** @file Canonical tasks with owned results, returned Excepts or declared factory errors. */
import {witTurnFutureDrive} from "./application-turn-future.mjs";

/**
 * A rejected EIO factory has no future writer. Its temporary native row owns
 * the original failure only until Wasm has copied the resource. A returned
 * Except, in contrast, is data delivered through the regular future.
 *
 * @param m - Source-checked nominal input, result/fault slot and effect.
 * @param writer - Canonical writer emitted for the same declaration.
 */
export const witTurnPlainGraph=(m,writer)=>{
	const {a,z,param,shape}=m,ret=shape==="returned",factory=shape==="factory",owned=shape==="owned";
	if(!ret && !factory && !owned)throw new TypeError("Expected owned, returned or factory task");
	const slots=[...new Set([a,z])],types=slots.map(i=>`(import "r${i}" (type $r${i} (sub resource)))`).join(" ");
	const supply=slots.map(i=>`(with "r${i}" (type $r${i}))`).join(" ");
	const turn='(param "op" u32) (param "key" u32) (param "left" u64) (param "right" u64) (result (tuple u32 u32 u64 u64))';
	const fs=[["pin",`(param "value" (borrow $r${a})) (result u64)`,"(param i32) (result i64)","lease-k"+a]
		, ["copy",`(param "ticket" u64) (result (option (own $r${z})))`,"(param i64 i32)","copy-k"+z]
		, ["same",'(param "kind" u32) (param "left" u64) (param "right" u64) (result bool)',"(param i32 i64 i64) (result i32)","same-lease"]
		, ["release",'(param "kind" u32) (param "ticket" u64) (result bool)',"(param i32 i64) (result i32)","release-lease"]];
	const choice=`(result u32 (error (own $r${z})))`,begin=factory?choice:"u32",payload=ret?choice:owned?`(own $r${z})`:"u32";
	const act=(op,key)=>`(call $drive (i32.const ${op}) ${key} (i64.const 0) (i64.const 0))`;
	return `(component ${types}
      (import "turn" (func $turn ${turn}))
      (import "leases" (instance $v ${fs.map(([,t,,n])=>`(export "${n}" (func ${t}))`).join(" ")}))
      (component $ports ${types}
        (import "turn" (func $turn ${turn})) ${fs.map(([n,t])=>`(import "${n}" (func $${n} ${t}))`).join(" ")}
        (core module $m (memory (export "m") 1)) (core instance $m (instantiate $m))
        (core func $turn (canon lower (func $turn) (memory $m "m"))) (core func $end (canon resource.drop $r${a}))
        ${fs.map(([n])=>`(core func $${n} (canon lower (func $${n}) (memory $m "m")))`).join(" ")}
        (core module $body (import "" "m" (memory 1)) (import "" "turn" (func $turn (param i32 i32 i64 i64 i32)))
          (import "" "end" (func $end (param i32))) ${fs.map(([n,,t])=>`(import "" "${n}" (func $${n} ${t}))`).join(" ")}
          ${witTurnFutureDrive(null)}
          (func $owned (param $ticket i64) (result i32)
            (call $copy (local.get $ticket) (i32.const 32)) (if (i32.ne (i32.load8_u (i32.const 32)) (i32.const 1)) (then unreachable))
            (i32.load (i32.const 36)))
          (func $number (param $v i64) (result i32) (if (i64.gt_u (local.get $v) (i64.const 0xffffffff)) (then unreachable)) (i32.wrap_i64 (local.get $v)))
          (func (export "begin") (param i32) (result i32) (local $token i64) (local $key i32) (local $v i32)
            (local.set $token (call $pin (local.get 0))) (call $end (local.get 0)) (if (i64.eqz (local.get $token)) (then unreachable))
            (call $drive (i32.const 0) (i32.const 0) (local.get $token) (i64.const 0)) (local.set $key (i32.load (i32.const 4)))
            (local.set $token (i64.load (i32.const 8)))
            ${factory?`(if (i64.eqz (local.get $token)) (then (i32.store (i32.const 64) (i32.const 0)) (i32.store (i32.const 68) (local.get $key)))
              (else (local.set $v (call $owned (local.get $token))) ${act(4,"(local.get $key)")}
                (i32.store (i32.const 64) (i32.const 1)) (i32.store (i32.const 68) (local.get $v)))) (i32.const 64)`
				:"(if (i64.ne (local.get $token) (i64.const 0)) (then unreachable)) (local.get $key)"})
          (func (export "peek") (param $key i32) (result i32) (local $tag i32) (local $v i64) (local $result i32)
            ${act(2,"(local.get $key)")} (local.set $tag (i32.load (i32.const 4))) (local.set $v (i64.load (i32.const 8)))
            ${ret?`(if (i32.gt_u (local.get $tag) (i32.const 1)) (then unreachable))
              (local.set $result (if (result i32) (local.get $tag) (then (call $owned (local.get $v))) (else (call $number (local.get $v)))))
              (i32.store (i32.const 64) (local.get $tag)) (i32.store (i32.const 68) (local.get $result)) (i32.const 64)`
				:`(if (local.get $tag) (then unreachable)) (call ${owned?"$owned":"$number"} (local.get $v))`})
          (func (export "poll") (param i32) (result i32) ${act(1,"(local.get 0)")} (i32.load (i32.const 4)))
          (func (export "close") (param i32) ${act(4,"(local.get 0)")}) (func (export "drain") ${act(5,"(i32.const 0)")}))
        (core instance $i (instantiate $body (with "" (instance (export "m" (memory $m "m")) (export "end" (func $end)) (export "turn" (func $turn))
          ${fs.map(([n])=>`(export "${n}" (func $${n}))`).join(" ")}))))
        (func (export "begin") (param "${param}" (borrow $r${a})) (result ${begin}) (canon lift (core func $i "begin") (memory $m "m")))
        (func (export "peek") (param "key" u32) (result ${payload}) (canon lift (core func $i "peek") (memory $m "m")))
        (func (export "poll") (param "key" u32) (result bool) (canon lift (core func $i "poll")))
        (func (export "close") (param "key" u32) (canon lift (core func $i "close")))
        (func (export "drain") (canon lift (core func $i "drain"))))
      ${writer.replace("(component","(component $writer")}
      (instance $p (instantiate $ports ${supply} (with "turn" (func $turn)) ${fs.map(([n,,,field])=>`(with "${n}" (func $v "${field}"))`).join(" ")}))
      (instance $w (instantiate $writer ${supply} (with "begin" (func $p "begin")) (with "peek" (func $p "peek"))))
      ${["start","deliver","reap","retire"].map(n=>`(export "${n}" (func $w "${n}"))`).join(" ")}
      ${["poll","close","drain"].map(n=>`(export "${n}" (func $p "${n}"))`).join(" ")})`;
};

/**
 * Keep each typed native result alive through its canonical copy. An immediate
 * declared failure owns no task; cancellation never calls take on a dropped row.
 *
 * @param m - Reconciled effect, task and original native types.
 */
export const witTurnPlainHost=m=>{
	const {p,n,input,output,fault,a,z,shape}=m,j=p+n,f="lb_tf_"+n,ret=shape==="returned",factory=shape==="factory",owned=shape==="owned";
	return `#include "application-turn-cursor.h"
typedef struct {${j}_handle job;${output} value;${factory?fault+" failure;":""} bool used,ready,rejected,peeked;} ${f}_row;
typedef struct {${f}_row rows[64];} ${f};
static inline bool ${f}_close(${f}_row *r){
    bool ok=${j}_close(&r->job)==${p}OK;
    ${owned?`if(r->ready && ${output}_drop(&r->value)!=${p}OK)ok=false;`:ret?`if(r->ready)${j}_value_clear(&r->value);`:`if(r->rejected && ${fault}_drop(&r->failure)!=${p}OK)ok=false;`}
    *r=(${f}_row){0};return ok;
}
static inline bool ${f}_shutdown(${f} *s){
    bool ok=true;for(unsigned i=0;i<64;i++)if(s->rows[i].used && !${f}_close(&s->rows[i]))ok=false;return ok;
}
static inline bool ${f}_call(${f} *s,lb_tc_refs *refs,${p}binding binding,lb_wit_message in,lb_wit_message *out){
    uint64_t k=in.words[0];*out=(lb_wit_message){.op=LB_TC_DONE};
    if(in.op==LB_TF_DRAIN)return !k && !in.words[1] && !in.words[2] && lb_tc_flush(refs);
    if(in.op==LB_TF_OPEN){
        if(k || !in.words[1] || in.words[2])return false;
        unsigned i=0;while(i<64 && s->rows[i].used)i++;
        if(i==64){(void)lb_tc_release(refs,${a},in.words[1]);return false;}
        ${f}_row *r=&s->rows[i];r->used=true;${input} arg={0};${p}diagnostic d={0};int fd=-1;
        lb_tc_ref *ref=lb_tc_acquire(refs,${a},in.words[1]);
        bool ok=ref && ${input}_adopt(ref,lb_tc_dispose,&arg)==${p}OK;
        if(ok){
            ${p}status rc=${j}_start(binding,arg,&r->job,${factory?"&r->failure,":""}&d);
            ${factory?`r->rejected=rc==${p}DECLARED_ERROR;`:""}ok=rc==${p}OK || r->rejected;
            if(${input}_drop(&arg)!=${p}OK)ok=false;
            ${factory?`if(ok && r->rejected){void *raw=NULL;ok=${fault}_data(r->failure,&raw)==${p}OK && lb_tc_token(refs,${z},raw,&out->words[1]);}`:""}
            if(ok && !r->rejected){rc=${j}_poll(r->job,&fd);ok=(rc==${p}OK && fd==-1) || (rc==${p}PENDING && fd>=0);}
        }
        ${p}diagnostic_clear(&d);if(!ok){(void)${f}_close(r);return false;}
        out->words[0]=i+1;out->words[2]=fd<0?0:(uint64_t)fd+1;return lb_tc_flush(refs);
    }
    if(!k || k>64 || in.words[1] || in.words[2])return false;
    ${f}_row *r=&s->rows[k-1];if(!r->used)return false;
    if(in.op==LB_TF_CLOSE)return ${f}_close(r) && lb_tc_flush(refs);
    if(r->rejected)return false;
    if(in.op==LB_TF_POLL){
        if(r->ready)return false;
        int fd=-1;${p}status rc=${j}_poll(r->job,&fd);
        if(rc==${p}PENDING){if(fd<0)return false;out->words[2]=(uint64_t)fd+1;return lb_tc_flush(refs);}
        if(rc!=${p}OK || fd!=-1)return false;
        ${p}diagnostic d={0};rc=${j}_take(&r->job,&r->value,&d);${p}diagnostic_clear(&d);if(rc!=${p}OK)return false;
        r->ready=true;out->words[0]=1;
    }else if(in.op==LB_TF_PEEK){
        if(!r->ready || r->peeked)return false;
        ${factory?"out->words[1]=r->value;":owned?`void *raw=NULL;if(${output}_data(r->value,&raw)!=${p}OK || !lb_tc_token(refs,${z},raw,&out->words[1]))return false;`
			:`if(r->value.ok)out->words[1]=r->value.value;else{
            void *raw=NULL;if(${m.nominal}_data(r->value.error,&raw)!=${p}OK || !lb_tc_token(refs,${z},raw,&out->words[1]))return false;
            out->words[0]=1;
        }`}
        r->peeked=true;
    }else return false;
    return lb_tc_flush(refs);
}
`;
};
