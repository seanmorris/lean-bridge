/** @file Typed Wasm ports for Lean cursors whose result owners live in a guest. */

/**
 * Turn completion is scalar. A real canonical stream is constructed separately
 * by canonicalStream; only its private begin/act/peek hooks use this protocol.
 * Stage the outgoing resource before acknowledging native result disposal.
 *
 * @param m - Reconciled cursor declaration, original nominal slots and checked step error.
 */
export const witTurnCursorPorts=m=>{
	const {input: a,owner: z,err,param}=m,typed=err!==null;
	const kinds=[...new Set([a,z,...typed?[err]:[]])];
	const fs=[["pin",`(param "value" (borrow $r${a})) (result u64)`,"(param i32) (result i64)"]
		, ["turn",'(param "op" u32) (param "key" u32) (param "value" u64) (result (tuple u32 u32 u64 u64))',"(param i32 i32 i64 i32)"]
		, ["release-lease",'(param "kind" u32) (param "ticket" u64) (result bool)',"(param i32 i64) (result i32)"]
		, ["same-lease",'(param "kind" u32) (param "left" u64) (param "right" u64) (result bool)',"(param i32 i64 i64) (result i32)"]
		, ...[...new Set([z,...typed?[err]:[]])].map(i=>["copy-k"+i,`(param "ticket" u64) (result (option (own $r${i})))`,"(param i64 i32)"])];
	const copy=i=>`(call $copy-k${i} (i64.load (i32.const 8)) (i32.const 32))`;
	return `(component
      ${kinds.map(i=>`(import "r${i}" (type $r${i} (sub resource)))`).join(" ")}
      ${fs.map(([n,t])=>`(import "${n}" (func $${n} ${t}))`).join("\n")}
      (core module $mem (memory (export "m") 1)) (core instance $mem (instantiate $mem))
      ${fs.map(([n])=>`(core func $${n} (canon lower (func $${n}) (memory $mem "m")))`).join("\n")}
      (core func $drop (canon resource.drop $r${a}))
      (core module $body (import "" "m" (memory 1)) (import "" "drop" (func $drop (param i32)))
        ${fs.map(([n,,sig])=>`(import "" "${n}" (func $${n} ${sig}))`).join("\n")}
        (func $drive (param $op i32) (param $key i32) (param $token i64) (local $kind i32) (local $reply i32)
          (call $turn (local.get $op) (local.get $key) (local.get $token) (i32.const 0))
          (loop $wait
            (if (i32.eqz (i32.load (i32.const 0))) (then (return)))
            (local.set $kind (i32.load (i32.const 4)))
            (if (i32.eq (i32.load (i32.const 0)) (i32.const 1)) (then
              (local.set $reply (call $release-lease (local.get $kind) (i64.load (i32.const 8))))
              (if (i32.eqz (local.get $reply)) (then unreachable)))
              (else (if (i32.ne (i32.load (i32.const 0)) (i32.const 2)) (then unreachable))
                (local.set $reply (call $same-lease (local.get $kind) (i64.load (i32.const 8)) (i64.load (i32.const 16))))))
            (call $turn (i32.const 6) (local.get $reply) (i64.const 0) (i32.const 0)) (br $wait)))
        (func (export "drain") (call $drive (i32.const 7) (i32.const 0) (i64.const 0)))
        (func (export "begin") (param $arg i32) (result i32) (local $lease i64)
          (local.set $lease (call $pin (local.get $arg))) (call $drop (local.get $arg))
          (if (i64.eqz (local.get $lease)) (then unreachable))
          (call $drive (i32.const 0) (i32.const 0) (local.get $lease)) (i32.load (i32.const 4)))
        (func (export "act") (param $key i32) (param $op i32) (result i32)
          (if (i32.gt_u (local.get $op) (i32.const 2)) (then unreachable))
          (call $drive (i32.add (local.get $op) (i32.const 1)) (local.get $key) (i64.const 0)) (i32.load (i32.const 4)))
        (func (export "peek") (param $key i32) (result i32) (local $tag i32) (local $owned i32)
          (call $drive (i32.const 4) (local.get $key) (i64.const 0)) (local.set $tag (i32.load (i32.const 4)))
          (if (i32.gt_u (local.get $tag) (i32.const ${typed?1:0})) (then unreachable))
          ${typed?`(if (local.get $tag) (then ${copy(err)}) (else ${copy(z)}))`:copy(z)}
          (if (i32.eqz (i32.load8_u (i32.const 32))) (then unreachable)) (local.set $owned (i32.load (i32.const 36)))
          (call $drive (i32.const 5) (local.get $key) (i64.const 0))
          ${typed?"(i32.store8 (i32.const 32) (local.get $tag)) (i32.store (i32.const 36) (local.get $owned)) (i32.const 32)":"(local.get $owned)"}))
      (core instance $i (instantiate $body (with "" (instance (export "m" (memory $mem "m")) (export "drop" (func $drop))
        ${fs.map(([n])=>`(export "${n}" (func $${n}))`).join(" ")}))))
      (func (export "drain") (canon lift (core func $i "drain")))
      (func (export "begin") (param "${param}" (borrow $r${a})) (result u32) (canon lift (core func $i "begin")))
      (func (export "act") (param "key" u32) (param "op" u32) (result u32) (canon lift (core func $i "act")))
      (func (export "peek") (param "key" u32) (result ${typed?`(result (own $r${z}) (error (own $r${err})))`:`(own $r${z})`})
        (canon lift (core func $i "peek") (memory $mem "m"))))`;
};

/**
 * Link the source-selected canonical stream and its typed turn ports together.
 * The caller supplies original resource types and the corresponding private
 * owner table. Only start is a consumer export; pump and retire belong to the
 * embedding. No public operation transports a lease number.
 *
 * @param m - Checked stream layout.
 * @param ports - Generated typed lease ports.
 * @param stream - Canonical stream from the matching checked declaration.
 */
export const witTurnCursorGraph=(m,ports,stream)=>{
	const {input: a,owner: z,err}=m,outputs=[...new Set([z,...err===null?[]:[err]])],kinds=[...new Set([a,...outputs])];
	const port=(n,sig)=>`(export "${n}" (func ${sig}))`;
	const fs=[port("lease-k"+a,`(param "value" (borrow $r${a})) (result u64)`)
		, port("release-lease",'(param "kind" u32) (param "ticket" u64) (result bool)')
		, port("same-lease",'(param "kind" u32) (param "left" u64) (param "right" u64) (result bool)')
		, ...outputs.map(i=>port("copy-k"+i,`(param "ticket" u64) (result (option (own $r${i})))`))];
	const types=kinds.map(i=>`(with "r${i}" (type $r${i}))`).join(" ");
	const inputs=["release-lease","same-lease",...outputs.map(i=>"copy-k"+i)];
	return `(component ${kinds.map(i=>`(import "r${i}" (type $r${i} (sub resource)))`).join(" ")}
      (import "leases" (instance $v ${fs.join(" ")}))
      (import "turn" (func $turn (param "op" u32) (param "key" u32) (param "value" u64) (result (tuple u32 u32 u64 u64))))
      ${ports.replace("(component","(component $ports")} ${stream.replace("(component","(component $stream")}
      (instance $p (instantiate $ports ${types} (with "pin" (func $v "lease-k${a}")) (with "turn" (func $turn))
        ${inputs.map(n=>`(with "${n}" (func $v "${n}"))`).join(" ")}))
      (instance $s (instantiate $stream ${types} (with "begin" (func $p "begin")) (with "peek" (func $p "peek")) (with "act" (func $p "act"))))
      (export "start" (func $s "start")) (export "pump" (func $s "pump")) (export "retire" (func $s "retire")) (export "drain" (func $p "drain")))`;
};

/**
 * Keep the real typed native result alive until the Wasm port has copied its
 * owner. Coordinates and C symbols come from the same checked worker entry.
 *
 * @param m - Reconciled method layout and native C types for input/item/error.
 */
export const witTurnCursorHost=m=>{
	const {p,n,input,output,fault,a,z,err}=m,j=p+n,f="lb_tc_"+n,typed=err!==null;
	return `#include "application-turn-cursor.h"
typedef struct {${j}_handle cursor; ${output} item; ${typed?fault+" error;":""}
    unsigned state; bool occupied,demand,terminal; int fd;} ${f}_row;
typedef struct { ${f}_row rows[64]; } ${f};
static inline bool ${f}_clear(${f}_row *r){
    bool ok=${j}_close(&r->cursor)==${p}OK;
    if((r->state==1 || r->state==3) && ${output}_drop(&r->item)!=${p}OK)ok=false;
    ${typed?`if((r->state==2 || r->state==4) && ${fault}_drop(&r->error)!=${p}OK)ok=false;`:""}
    *r=(${f}_row){0};return ok;
}
static inline bool ${f}_shutdown(${f} *s){
    bool ok=true;for(unsigned i=0;i<64;i++)if(s->rows[i].occupied && !${f}_clear(&s->rows[i]))ok=false;return ok;
}
static inline bool ${f}_call(${f} *s,lb_tc_refs *refs,${p}binding binding,lb_wit_message in,lb_wit_message *out){
    uint64_t k=in.words[0];unsigned op=in.op;*out=(lb_wit_message){.op=LB_TC_DONE};
    if(op==LB_TC_DRAIN)return !k && !in.words[1] && lb_tc_flush(refs);
    if(op==LB_TC_OPEN){
        if(k || !in.words[1])return false;
        unsigned i=0;while(i<64 && s->rows[i].occupied)i++;
        if(i==64){(void)lb_tc_release(refs,${a},in.words[1]);return false;}
        /* Comparing or releasing a guest lease below can open another
           cursor on this same factory before the outer open returns. */
        ${f}_row *r=&s->rows[i];r->occupied=true;r->fd=-1;
        lb_tc_ref *ref=lb_tc_acquire(refs,${a},in.words[1]);${input} arg={0};${p}diagnostic d={0};
        if(!ref || ${input}_adopt(ref,lb_tc_dispose,&arg)!=${p}OK){*r=(${f}_row){0};return false;}
        bool ok=${j}_start(binding,arg,&r->cursor,&d)==${p}OK;
        ${p}diagnostic_clear(&d);if(${input}_drop(&arg)!=${p}OK)ok=false;
        if(!ok){(void)${f}_clear(r);return false;}
        out->words[0]=i+1;return lb_tc_flush(refs);
    }
    if(!k || k>64 || in.words[1])return false;
    ${f}_row *r=&s->rows[k-1];if(!r->occupied)return false;
    if(op==LB_TC_CLOSE)return ${f}_clear(r) && lb_tc_flush(refs);
    if(op==LB_TC_PULL){
        if(r->demand || r->terminal || r->state || ${j}_pull(r->cursor)!=${p}OK)return false;
        r->demand=true;
    }else if(op==LB_TC_CHECK){
        if(!r->demand || r->terminal || r->state)return false;
        int fd=-1;${p}status rc=${j}_poll(r->cursor,&fd);r->fd=fd;
        if(rc==${p}PENDING){if(fd<0)return false;out->words[2]=(uint64_t)fd+1;return true;}
        if(rc!=${p}OK || fd!=-1)return false;
        ${p}diagnostic d={0};rc=${j}_take(&r->cursor,&r->item,${typed?"&r->error,":""}&d);
        ${p}diagnostic_clear(&d);r->demand=false;
        if(rc==${p}END){r->terminal=true;out->words[0]=2;}
        else if(rc==${p}OK){r->state=1;out->words[0]=1;}
        ${typed?`else if(rc==${p}STEP_ERROR){r->state=2;r->terminal=true;out->words[0]=3;}`:""}
        else return false;
    }else if(op==LB_TC_PEEK){
        if(!r->state || r->state>2)return false;
        void *ptr=NULL;unsigned kind=${z};
        ${typed?`if(r->state==2){kind=${err};if(${fault}_data(r->error,&ptr)!=${p}OK)return false;}else `:""}
        if(${output}_data(r->item,&ptr)!=${p}OK)return false;
        out->words[0]=r->state-1;if(!lb_tc_token(refs,kind,ptr,&out->words[1]))return false;
        r->state+=2;
    }else if(op==LB_TC_ACK){
        if(r->state<3 || r->state>4)return false;
        if(r->state==3 && ${output}_drop(&r->item)!=${p}OK)return false;
        ${typed?`if(r->state==4 && ${fault}_drop(&r->error)!=${p}OK)return false;`:""}
        r->state=0;
    }else return false;
    return lb_tc_flush(refs);
}
`;
};
