/** @file Render a canonical future producer with private, bounded per-store writer ownership. */
import {canonicalArena} from "./canonical-arena.mjs";
const scalars={bool: ["bool","i32",1]
	, uint8: ["u8","i32",1]
	, uint16: ["u16","i32",2]
	, uint32: ["u32","i32",4]
	, uint64: ["u64","i64",8]
	, int8: ["s8","i32",1]
	, int16: ["s16","i32",2]
	, int32: ["s32","i32",4]
	, int64: ["s64","i64",8]
	, float32: ["f32","f32",4]
	, float64: ["f64","f64",8]};
const scalar=site=>{
	const t=site?.type;
	if(t?.kind!=="primitive" || site.ownership!=="copy" || !Object.hasOwn(scalars,t.name)) throw new TypeError("Expected a copied canonical scalar");
	return scalars[t.name];
};
/**
 * Project one infallible, source-checked task to a synchronous factory returning
 * a canonical future. Only the embedding gets the private delivery/cleanup ports.
 *
 * @param d - Compiled Binding IR function declaration.
 * @param slots - Maximum independently owned operations in this component instance.
 * @param labels - Optional checked public parameter names.
 */
export const renderCanonicalFutureProducer=(d,slots=64,labels=d?.parameters?.map((_,i)=>"arg"+i))=>{
	if(d?.kind!=="function" || d.source?.producer!=="lean" || d.resultMode!=="promise" || d.source?.extensions?.["lean-lang.org/delivery"]!=="Task"
		|| !["pure","BaseIO"].includes(d.source.extensions["lean-lang.org/effect"])
		|| !Array.isArray(d.parameters) || d.parameters.length>16 || d.failure?.mode!=="none" || d.failure.unexpected!=="poison-runtime" || d.capabilities.length || !Number.isSafeInteger(slots) || slots<1 || slots>1024)
		throw new TypeError("Expected an infallible in-memory Lean task");
	const [wat,core,width]=scalar(d.result),store=core+".store"+(width<4?width*8:"");
	if(!Array.isArray(labels) || labels.length!==d.parameters.length || new Set(labels).size!==labels.length || labels.some(x=>typeof x!=="string" || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(x))) throw new TypeError("Invalid canonical parameter labels");
	const args=d.parameters.map(scalar), params=args.map(([w],i)=>'(param "'+labels[i]+'" '+w+')').join(" ");
	const lower=args.map(([,c])=>"(param "+c+")").join(" "),locals=args.map((_,i)=>"(local.get "+i+")").join(" ");
	return producerWat({wat,core,store,params,lower,locals,slots});
};
/**
 * Render a checked Task whose payload or factory requires canonical memory.
 *
 * @param m - Reconciled canonical method, payload and factory error layout.
 * @param slots - Number of outstanding native or unacknowledged writes.
 */
export const richCanonicalFuture=(m,slots)=>{
	const payload=m.payload,core=payload.flat?.length===1?payload.flat[0]:null;
	const lower=m.args.flatMap(a=>a.t.flat).map(c=>"(param "+c+")").join(" ");
	return producerWat({wat: payload.wat,core
		, store: core && core+".store"+(payload.size<4?payload.size*8:"")
		, params: m.params
		, lower
		, locals: m.args.flatMap(a=>a.t.flat).map((_,i)=>"(local.get "+i+")").join(" ")
		, slots
		, rich: m});
};
const producerWat=({wat,core,store,params,lower,locals,slots,rich})=>{
	const ownership=rich?.ownership;
	const types=ownership?.slots.map(i=>`(import "r${i}" (type $r${i} (sub resource)))`).join("\n  ")??"";
	const destructors=ownership?.slots.map(i=>`(core func $drop-r${i} (canon resource.drop $r${i}))`).join("\n  ")??"";
	const dropImports=ownership?.slots.map(i=>`(import "" "drop-r${i}" (func $drop-r${i} (param i32)))`).join("\n    ")??"";
	const dropLinks=ownership?.slots.map(i=>`(export "drop-r${i}" (func $drop-r${i}))`).join(" ")??"";
	const endBorrows=ownership?.borrows.map(([arg,kind])=>`(call $drop-r${kind} (local.get ${arg}))`).join(" ")??"";
	// A closed reader does not accept the value of a pending write. Copied
	// bytes can be freed with the row; a canonical owner must be dropped.
	const abandon=ownership?.abandon??"";
	const failure=rich?.failure, begin=failure?"(result u32 (error "+failure.wat+"))":"u32";
	const dest=failure && 64+Math.max(4,failure.align);
	if(failure?.size>160) throw new TypeError("Canonical factory result exceeds scratch layout");
	const shift=rich?Math.ceil(Math.log2(16+rich.payload.size)):4;
	const pages=1+Math.ceil((1024+(slots+1)*2**shift)/65536);
	const options=rich?' (memory $mem "m") (realloc (func $mem "realloc"))':"";
	const payloadAt=rich?16:8;
	return `(component
  ${types?types+"\n  ":""}${rich?.valueTypes?rich.valueTypes+"\n  ":""}(import "begin" (func $begin ${params} (result ${begin})))
  ${rich?'(import "peek" (func $peek (param "key" u32) (result '+wat+')))':""}
  (type $t (future ${wat}))
  ${rich?canonicalArena(pages*65536,pages):'(core module $mem (memory (export "m") 1))'}
  (core instance $mem (instantiate $mem))
  ${destructors?destructors+"\n  ":""}(core func $begin (canon lower (func $begin)${options}))
  ${rich?'(core func $peek (canon lower (func $peek)'+options+'))':""}
  (core func $new (canon future.new $t))
  (core func $write (canon future.write $t async (memory $mem "m")))
  ${ownership?'(core func $cancel (canon future.cancel-write $t))\n  ':""}(core func $drop (canon future.drop-writable $t))
  (core func $sets (canon waitable-set.new))
  (core func $join (canon waitable.join))
  (core func $poll (canon waitable-set.poll (memory $mem "m")))
  (core func $drop-set (canon waitable-set.drop))
  (core module $m
    (import "" "m" (memory 1))
    ${dropImports?dropImports+"\n    ":""}(import "" "begin" (func $begin ${lower} ${failure?"(param i32)":"(result i32)"}))
    ${rich?'(import "" "peek" (func $peek (param i32) '+(core?"(result "+core+")":"(param i32)")+')) (import "" "select" (func $select (param i32))) (import "" "release" (func $release (param i32)))':""}
    (import "" "new" (func $new (result i64)))
    (import "" "write" (func $write (param i32 i32) (result i32)))
    ${ownership?'(import "" "cancel" (func $cancel (param i32) (result i32)))\n    ':""}(import "" "drop" (func $drop (param i32)))
    (import "" "sets" (func $sets (result i32)))
    (import "" "join" (func $join (param i32 i32)))
    (import "" "poll" (func $poll (param i32 i32) (result i32)))
    (import "" "drop-set" (func $drop-set (param i32)))
    (global $set (mut i32) (i32.const 0))
    (global $waiting (mut i32) (i32.const 0))
    (func $row (param $key i32) (result i32)
      (if (i32.ge_u (i32.sub (local.get $key) (i32.const 1)) (i32.const ${slots})) (then unreachable))
      (i32.add (i32.const ${rich?1024:0}) (i32.shl (local.get $key) (i32.const ${shift}))))
    (func $free (param $p i32)
      (call $drop (i32.load (local.get $p)))
      ${rich?"(call $release (i32.add (local.get $p) (i32.const 8)))":""}
      (i64.store (local.get $p) (i64.const 0))
      (global.set $waiting (i32.sub (global.get $waiting) (i32.const 1)))
      (if (i32.eqz (global.get $waiting)) (then (call $drop-set (global.get $set)))))
    (func (export "start") ${lower} (result i32) (local $p i32) (local $pair i64)
      ${failure?`(call $begin ${locals} (i32.const 64))${endBorrows?" "+endBorrows:""}
      (if (i32.load8_u (i32.const 64)) (then (return (i32.const 64))))
      (local.set $p (call $row (i32.load (i32.const ${dest}))))`:`(local.set $p (call $row (call $begin ${locals})))${endBorrows?" "+endBorrows:""}`}
      (if (i32.load offset=4 (local.get $p)) (then unreachable))
      (local.set $pair (call $new))
      (i32.store (local.get $p) (i32.wrap_i64 (i64.shr_u (local.get $pair) (i64.const 32))))
      (i32.store offset=4 (local.get $p) (i32.const 1))
      ;; An idle future writer receives DROPPED even before it has a value to
      ;; write. Register before returning the reader, while Lean may be parked.
      (if (i32.eqz (global.get $waiting)) (then (global.set $set (call $sets))))
      (call $join (i32.load (local.get $p)) (global.get $set))
      (global.set $waiting (i32.add (global.get $waiting) (i32.const 1)))
      ${failure?`(i32.store (i32.const ${dest}) (i32.wrap_i64 (local.get $pair))) (i32.const 64)`:"(i32.wrap_i64 (local.get $pair))"})
    ${rich?'(func (export "post") (param i32) (call $release (i32.const 12)))':""}
    (func (export "deliver") (param $key i32) ${rich?"":"(param $v "+core+")"} (result i32) (local $p i32) (local $rc i32)
      (local.set $p (call $row (local.get $key)))
      (if (i32.ne (i32.load offset=4 (local.get $p)) (i32.const 1)) (then unreachable))
      ${rich?`(call $select (i32.add (local.get $p) (i32.const 8)))
      ${core?`(${store} offset=16 (local.get $p) (call $peek (local.get $key)))`:"(call $peek (local.get $key) (i32.add (local.get $p) (i32.const 16)))"}
      (call $select (i32.const 12))`:`(${store} offset=8 (local.get $p) (local.get $v))`}
      (local.set $rc (call $write (i32.load (local.get $p)) (i32.add (local.get $p) (i32.const ${payloadAt}))))
      (if (i32.eq (local.get $rc) (i32.const -1))
        (then
          (i32.store offset=4 (local.get $p) (i32.const 2))
          (return (i32.const 2))))
      (if (i32.gt_u (local.get $rc) (i32.const 1)) (then unreachable))
      ${abandon?`(if (local.get $rc) (then ${abandon}))\n      `:""}(call $free (local.get $p)) (local.get $rc))
    (func (export "reap") (result i32) (local $key i32) (local $p i32) (local $event i32)
      (if (i32.eqz (global.get $waiting)) (then (return (i32.const 0))))
      (local.set $event (call $poll (global.get $set) (i32.const 0)))
      (if (i32.eqz (local.get $event)) (then (return (i32.const 0))))
      (if (i32.or (i32.ne (local.get $event) (i32.const 5)) (i32.gt_u (i32.load (i32.const 4)) (i32.const 1))) (then unreachable))
      (loop $find
        (local.set $key (i32.add (local.get $key) (i32.const 1)))
        (local.set $p (call $row (local.get $key)))
        (br_if $find (i32.or (i32.eqz (i32.load offset=4 (local.get $p)))
          (i32.ne (i32.load (local.get $p)) (i32.load (i32.const 0))))))
      ;; Only reader drop can acknowledge a writer that has issued no write.
      (if (i32.and (i32.eq (i32.load offset=4 (local.get $p)) (i32.const 1))
                   (i32.ne (i32.load (i32.const 4)) (i32.const 1))) (then unreachable))
      ${abandon?`(if (i32.and (i32.eq (i32.load offset=4 (local.get $p)) (i32.const 2)) (i32.load (i32.const 4))) (then ${abandon}))\n      `:""}(call $free (local.get $p))
      (local.get $key))${ownership?`
    ;; Only during store teardown: reclaim an unread owned payload. A
    ;; cancelled writer with a live reader cannot be dropped unwritten;
    ;; its empty endpoint dies with the store, after the guest object drop.
    (func (export "retire") (param $key i32) (local $p i32) (local $rc i32)
      (local.set $p (call $row (local.get $key)))
      (if (i32.ne (i32.load offset=4 (local.get $p)) (i32.const 2)) (then unreachable))
      (call $join (i32.load (local.get $p)) (i32.const 0))
      (local.set $rc (call $cancel (i32.load (local.get $p))))
      (if (i32.gt_u (local.get $rc) (i32.const 2)) (then unreachable))
      (if (local.get $rc) (then ${abandon}))
      (if (i32.ne (local.get $rc) (i32.const 2)) (then (call $free (local.get $p)))
        (else (call $release (i32.add (local.get $p) (i32.const 8))) (i32.store offset=4 (local.get $p) (i32.const 3)))))`:""})
  (core instance $i (instantiate $m (with "" (instance (export "m" (memory $mem "m"))
    ${rich?'(export "peek" (func $peek)) (export "select" (func $mem "select")) (export "release" (func $mem "release"))':""}
    ${dropLinks?dropLinks+"\n    ":""}(export "begin" (func $begin)) (export "new" (func $new)) (export "write" (func $write))
    ${ownership?'(export "cancel" (func $cancel)) ':""}(export "drop" (func $drop)) (export "sets" (func $sets)) (export "join" (func $join))
    (export "poll" (func $poll)) (export "drop-set" (func $drop-set))))))
  (func (export "start") ${params} (result ${failure?"(result $t (error "+failure.wat+"))":"$t"}) (canon lift (core func $i "start")${options}${rich?' (post-return (func $i "post"))':""}))
  (func (export "deliver") (param "key" u32) ${rich?"":'(param "value" '+wat+')'} (result u32) (canon lift (core func $i "deliver")))
  (func (export "reap") (result u32) (canon lift (core func $i "reap")))${ownership?'\n  (func (export "retire") (param "key" u32) (canon lift (core func $i "retire")))':""})`;
};
