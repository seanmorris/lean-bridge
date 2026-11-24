/** @file Project a compiled pull cursor as a lazy Component Model stream. */
import {canonicalArena} from "./canonical-arena.mjs";

/**
 * Generate a producer; one CPU step per pump, one pending Lean pull per reader.
 *
 * @param m - Checked cursor, item, factory and step error layouts.
 * @param slots - Limit on independently owned readers.
 */
export const canonicalStream=(m,slots)=>{
	const {params,failure,payload}=m,flat=m.args.flatMap(a=>a.t.flat);
	const args=flat.map(t=>"(param "+t+")").join(" "),locals=flat.map((_,i)=>"(local.get "+i+")").join(" ");
	const begin=failure?"(result u32 (error "+failure.wat+"))":"u32",result=failure?"(result $t (error "+failure.wat+"))":"$t";
	if(failure?.size>160) throw new TypeError("Canonical factory result exceeds scratch layout");
	const at=failure && 64+Math.max(4,failure.align),shift=Math.ceil(Math.log2(32+payload.size)),pages=Math.ceil((1024+(slots+1)*2**shift)/65536);
	const core=payload.flat?.length===1?payload.flat[0]:null,store=core && core+".store"+(payload.size<4?payload.size*8:"");
	const opts='(memory $mem "m") (realloc (func $mem "realloc"))';
	const functions=["begin","peek","act","new","write","drop","set","join","poll","del"];
	return `(component
  (type $t (stream ${payload.wat}))
  (import "begin" (func $begin ${params} (result ${begin})))
  (import "peek" (func $peek (param "key" u32) (result ${payload.wat})))
  (import "act" (func $act (param "key" u32) (param "op" u32) (result u32)))
  ${canonicalArena(pages*65536,pages)}
  (core instance $mem (instantiate $mem))
  (core func $begin (canon lower (func $begin) ${opts})) (core func $peek (canon lower (func $peek) ${opts}))
  (core func $act (canon lower (func $act))) (core func $new (canon stream.new $t))
  (core func $write (canon stream.write $t async (memory $mem "m"))) (core func $drop (canon stream.drop-writable $t))
  (core func $set (canon waitable-set.new)) (core func $join (canon waitable.join))
  (core func $poll (canon waitable-set.poll (memory $mem "m"))) (core func $del (canon waitable-set.drop))
  (core module $m
    (import "" "m" (memory 1))
    (import "" "begin" (func $begin ${args} ${failure?"(param i32)":"(result i32)"}))
    (import "" "act" (func $act (param i32 i32) (result i32)))
    (import "" "peek" (func $peek (param i32) ${core?"(result "+core+")":"(param i32)"}))
    (import "" "new" (func $new (result i64))) (import "" "write" (func $write (param i32 i32 i32) (result i32)))
    (import "" "drop" (func $drop (param i32))) (import "" "set" (func $set (result i32)))
    (import "" "join" (func $join (param i32 i32))) (import "" "poll" (func $poll (param i32 i32) (result i32))) (import "" "del" (func $del (param i32)))
    (import "" "release" (func $release (param i32))) (import "" "select" (func $select (param i32)))
    ;; At row offsets 0/4: writer/wait set; 8: allocation group; 12: phase
    ;; (1 idle, 2 waiting for demand, 3 waiting for a write); 16: outstanding pull; 20: last frame.
    (func $row (param $k i32) (result i32)
      (if (i32.ge_u (i32.sub (local.get $k) (i32.const 1)) (i32.const ${slots})) (then unreachable))
      (i32.add (i32.const 1024) (i32.shl (local.get $k) (i32.const ${shift}))))
    (func (export "start") ${args} (result i32) (local $p i32) (local $pair i64)
      ${failure?`(call $begin ${locals} (i32.const 64)) (if (i32.load8_u (i32.const 64)) (then (return (i32.const 64))))
      (local.set $p (call $row (i32.load (i32.const ${at}))))`:`(local.set $p (call $row (call $begin ${locals})))`}
      (if (i32.load offset=12 (local.get $p)) (then unreachable))
      (local.set $pair (call $new)) (i32.store (local.get $p) (i32.wrap_i64 (i64.shr_u (local.get $pair) (i64.const 32))))
      (i32.store offset=4 (local.get $p) (call $set))
      (call $join (i32.load (local.get $p)) (i32.load offset=4 (local.get $p)))
      (i32.store offset=12 (local.get $p) (i32.const 1))
      ${failure?`(i32.store (i32.const ${at}) (i32.wrap_i64 (local.get $pair))) (i32.const 64)`:"(i32.wrap_i64 (local.get $pair))"})
    (func (export "post") (param i32) (call $release (i32.const 12)))
    (func $close (param $p i32) (param $k i32) (result i32)
      (drop (call $act (local.get $k) (i32.const 2)))
      (call $drop (i32.load (local.get $p))) (call $del (i32.load offset=4 (local.get $p)))
      (call $release (i32.add (local.get $p) (i32.const 8)))
      (memory.fill (local.get $p) (i32.const 0) (i32.const 32)) (i32.const 2))
    (func $ack (param $p i32) (param $k i32) (param $rc i32) (result i32)
      (if (i32.eq (local.get $rc) (i32.const -1)) (then (i32.store offset=12 (local.get $p) (i32.const 3)) (return (i32.const 0))))
      (if (i32.or (i32.eq (local.get $rc) (i32.const 1)) (i32.eq (local.get $rc) (i32.const 17))) (then (return (call $close (local.get $p) (local.get $k)))))
      (if (i32.ne (local.get $rc) (i32.const 16)) (then unreachable))
      (if (i32.load offset=20 (local.get $p)) (then (return (call $close (local.get $p) (local.get $k)))))
      (call $release (i32.add (local.get $p) (i32.const 8)))
      (i32.store offset=12 (local.get $p) (i32.const 1)) (i32.const 2))
    (func (export "pump") (param $k i32) (result i32) (local $p i32) (local $rc i32)
      (local.set $p (call $row (local.get $k)))
      (if (i32.ge_u (i32.load offset=12 (local.get $p)) (i32.const 2))
        (then (local.set $rc (call $poll (i32.load offset=4 (local.get $p)) (i32.const 0)))
          (if (i32.eqz (local.get $rc)) (then (return (i32.const 0))))
          (if (i32.or (i32.ne (local.get $rc) (i32.const 3)) (i32.ne (i32.load (i32.const 0)) (i32.load (local.get $p)))) (then unreachable))
          (local.set $rc (i32.load (i32.const 4)))
          (if (i32.eq (i32.load offset=12 (local.get $p)) (i32.const 3)) (then (return (call $ack (local.get $p) (local.get $k) (local.get $rc)))))
          ;; A readiness event can outlive a cancelled read. Recheck now, before advancing Lean.
          (if (i32.eqz (local.get $rc)) (then (local.set $rc (call $write (i32.load (local.get $p)) (i32.add (local.get $p) (i32.const 32)) (i32.const 0))))))
        (else (local.set $rc (call $write (i32.load (local.get $p)) (i32.add (local.get $p) (i32.const 32)) (i32.const 0)))))
      (if (i32.eq (local.get $rc) (i32.const -1)) (then (i32.store offset=12 (local.get $p) (i32.const 2)) (return (i32.const 0))))
      (if (i32.eq (local.get $rc) (i32.const 1)) (then (return (call $close (local.get $p) (local.get $k)))))
      (if (local.get $rc) (then unreachable))
      (i32.store offset=12 (local.get $p) (i32.const 1))
      (if (i32.eqz (i32.load offset=16 (local.get $p))) (then (drop (call $act (local.get $k) (i32.const 0))) (i32.store offset=16 (local.get $p) (i32.const 1))))
      (local.set $rc (call $act (local.get $k) (i32.const 1)))
      (if (i32.eqz (local.get $rc)) (then (return (i32.const 1))))
      (if (i32.eq (local.get $rc) (i32.const 2)) (then (return (call $close (local.get $p) (local.get $k)))))
      (if (i32.gt_u (local.get $rc) (i32.const 3)) (then unreachable))
      (i32.store offset=16 (local.get $p) (i32.const 0)) (i32.store offset=20 (local.get $p) (i32.eq (local.get $rc) (i32.const 3)))
      (call $select (i32.add (local.get $p) (i32.const 8)))
      ${core?`(${store} offset=32 (local.get $p) (call $peek (local.get $k)))`:"(call $peek (local.get $k) (i32.add (local.get $p) (i32.const 32)))"}
      (call $select (i32.const 12))
      (call $ack (local.get $p) (local.get $k) (call $write (i32.load (local.get $p)) (i32.add (local.get $p) (i32.const 32)) (i32.const 1)))))
  (core instance $i (instantiate $m (with "" (instance (export "m" (memory $mem "m"))
    (export "select" (func $mem "select")) (export "release" (func $mem "release"))
    ${functions.map(n=>'(export "'+n+'" (func $'+n+'))').join(" ")}))))
  (func (export "start") ${params} (result ${result}) (canon lift (core func $i "start") ${opts} (post-return (func $i "post"))))
  (func (export "pump") (param "key" u32) (result u32) (canon lift (core func $i "pump"))))`;
};

/**
 * Generate the native half of one cursor, including its exact item and step error codecs.
 *
 * @param m - Reconciled cursor.
 * @param p - Generated C status and buffer prefix.
 * @param n - Generated C cursor symbol.
 * @param encoded - Emit a Wasmtime-owned value and dispose any native copy.
 */
export const streamAction=(m,p,n,encoded)=>`static wasmtime_error_t *stream_${m.id}(void *data,wasmtime_context_t *ctx,const wasmtime_component_func_type_t *type,
    wasmtime_component_val_t *args,size_t argc,wasmtime_component_val_t *out,size_t retc) {
    (void)type; lb_cf_reactor *r=data;
    if (!accepting || r->ctx!=ctx || argc!=2 || retc!=1 || args[0].kind!=WASMTIME_COMPONENT_U32 || args[1].kind!=WASMTIME_COMPONENT_U32)
        return wasmtime_error_new("invalid cursor operation");
    unsigned key=args[0].of.u32,op=args[1].of.u32;
    if (!key || key>r->capacity || r->rows[key-1].phase!=LB_CF_STREAM) return wasmtime_error_new("unknown cursor");
    lb_cf_row *row=&r->rows[key-1]; ${n}_handle *owner=row->owner;
    out->kind=WASMTIME_COMPONENT_U32; out->of.u32=0;
    if (op==2) {
        if (owner && ${n}_close(owner)!=${p}_OK) return wasmtime_error_new("could not close cursor");
        *row=(lb_cf_row){0}; return NULL;
    }
    if (!owner) return wasmtime_error_new("cursor already ended");
    if (op==0) {
        if (row->requested || ${n}_pull(*owner)!=${p}_OK) return wasmtime_error_new("could not request cursor item");
        row->requested=true; return NULL;
    }
    if (op!=1 || !row->requested || r->staged) return wasmtime_error_new("no matching cursor demand");
    int fd=-1; ${p}_status rc=${n}_poll(*owner,&fd); row->fd=fd;
    if (rc==${p}_PENDING && fd>=0) return NULL;
    if (rc!=${p}_OK || fd!=-1) return wasmtime_error_new("invalid cursor readiness notification");
    ${n}_value item={0}; ${m.step?n+"_step_error error={0};":""}
    rc=${n}_take(owner,&item${m.step?",&error":""}); row->requested=false; row->fd=-1;
    if (rc==${p}_END) {row->owner=NULL; out->of.u32=2; return NULL;}
    wasmtime_component_val_t *v=&r->stream_value;
    ${m.step?`if (rc==${p}_TYPED_ERROR) { row->owner=NULL;
        wasmtime_component_val_t *e=lb_child(v,false); ${encoded(m.step,"error","e",n+"_step_error_dispose")}
        out->of.u32=3;
    } else `:""}if (rc==${p}_OK) {
        ${m.step?"v=lb_child(v,true);":""} ${encoded(m.out,"item","v",n+"_value_dispose")} out->of.u32=1;
    } else return wasmtime_error_new("could not take cursor item");
    r->staged=&r->stream_value; r->staged_key=key; return NULL;
}`;
