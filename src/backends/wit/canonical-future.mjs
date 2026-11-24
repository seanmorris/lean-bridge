/** @file Render a canonical future producer with private, bounded per-store writer ownership. */
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
 */
export const renderCanonicalFutureProducer=(d,slots=64)=>{
	if(d?.kind!=="function" || d.source?.producer!=="lean" || d.resultMode!=="promise" || d.source?.extensions?.["lean-lang.org/delivery"]!=="Task"
		|| !["pure","BaseIO"].includes(d.source.extensions["lean-lang.org/effect"])
		|| !Array.isArray(d.parameters) || d.parameters.length>16 || d.failure?.mode!=="none" || d.failure.unexpected!=="poison-runtime" || d.capabilities.length || !Number.isSafeInteger(slots) || slots<1 || slots>1024)
		throw new TypeError("Expected an infallible in-memory Lean task");
	const [wat,core,width]=scalar(d.result),store=core+".store"+(width<4?width*8:"");
	const args=d.parameters.map(scalar), params=args.map(([w],i)=>'(param "arg'+i+'" '+w+')').join(" ");
	const lower=args.map(([,c])=>"(param "+c+")").join(" "),locals=args.map((_,i)=>"(local.get "+i+")").join(" ");
	return `(component
  (import "begin" (func $begin ${params} (result u32)))
  (type $t (future ${wat}))
  (core module $mem (memory (export "m") 1))
  (core instance $mem (instantiate $mem))
  (core func $begin (canon lower (func $begin)))
  (core func $new (canon future.new $t))
  (core func $write (canon future.write $t async (memory $mem "m")))
  (core func $drop (canon future.drop-writable $t))
  (core func $sets (canon waitable-set.new))
  (core func $join (canon waitable.join))
  (core func $poll (canon waitable-set.poll (memory $mem "m")))
  (core func $drop-set (canon waitable-set.drop))
  (core module $m
    (import "" "m" (memory 1))
    (import "" "begin" (func $begin ${lower} (result i32)))
    (import "" "new" (func $new (result i64)))
    (import "" "write" (func $write (param i32 i32) (result i32)))
    (import "" "drop" (func $drop (param i32)))
    (import "" "sets" (func $sets (result i32)))
    (import "" "join" (func $join (param i32 i32)))
    (import "" "poll" (func $poll (param i32 i32) (result i32)))
    (import "" "drop-set" (func $drop-set (param i32)))
    (global $set (mut i32) (i32.const 0))
    (global $waiting (mut i32) (i32.const 0))
    (func $row (param $key i32) (result i32)
      (if (i32.ge_u (i32.sub (local.get $key) (i32.const 1)) (i32.const ${slots})) (then unreachable))
      (i32.shl (local.get $key) (i32.const 4)))
    (func $free (param $p i32)
      (call $drop (i32.load (local.get $p)))
      (i64.store (local.get $p) (i64.const 0)))
    (func (export "start") ${lower} (result i32) (local $p i32) (local $pair i64)
      (local.set $p (call $row (call $begin ${locals})))
      (if (i32.load offset=4 (local.get $p)) (then unreachable))
      (local.set $pair (call $new))
      (i32.store (local.get $p) (i32.wrap_i64 (i64.shr_u (local.get $pair) (i64.const 32))))
      (i32.store offset=4 (local.get $p) (i32.const 1))
      (i32.wrap_i64 (local.get $pair)))
    (func (export "deliver") (param $key i32) (param $v ${core}) (result i32) (local $p i32) (local $rc i32)
      (local.set $p (call $row (local.get $key)))
      (if (i32.ne (i32.load offset=4 (local.get $p)) (i32.const 1)) (then unreachable))
      (${store} offset=8 (local.get $p) (local.get $v))
      (local.set $rc (call $write (i32.load (local.get $p)) (i32.add (local.get $p) (i32.const 8))))
      (if (i32.eq (local.get $rc) (i32.const -1))
        (then
          (if (i32.eqz (global.get $waiting)) (then (global.set $set (call $sets))))
          (call $join (i32.load (local.get $p)) (global.get $set))
          (global.set $waiting (i32.add (global.get $waiting) (i32.const 1)))
          (i32.store offset=4 (local.get $p) (i32.const 2))
          (return (i32.const 2))))
      (if (i32.gt_u (local.get $rc) (i32.const 1)) (then unreachable))
      (call $free (local.get $p)) (local.get $rc))
    (func (export "reap") (result i32) (local $key i32) (local $p i32) (local $event i32)
      (if (i32.eqz (global.get $waiting)) (then (return (i32.const 0))))
      (local.set $event (call $poll (global.get $set) (i32.const 0)))
      (if (i32.eqz (local.get $event)) (then (return (i32.const 0))))
      (if (i32.or (i32.ne (local.get $event) (i32.const 5)) (i32.gt_u (i32.load (i32.const 4)) (i32.const 1))) (then unreachable))
      (loop $find
        (local.set $key (i32.add (local.get $key) (i32.const 1)))
        (local.set $p (call $row (local.get $key)))
        (br_if $find (i32.or (i32.ne (i32.load offset=4 (local.get $p)) (i32.const 2))
          (i32.ne (i32.load (local.get $p)) (i32.load (i32.const 0))))))
      (call $free (local.get $p))
      (global.set $waiting (i32.sub (global.get $waiting) (i32.const 1)))
      (if (i32.eqz (global.get $waiting)) (then (call $drop-set (global.get $set))))
      (local.get $key)))
  (core instance $i (instantiate $m (with "" (instance (export "m" (memory $mem "m"))
    (export "begin" (func $begin)) (export "new" (func $new)) (export "write" (func $write))
    (export "drop" (func $drop)) (export "sets" (func $sets)) (export "join" (func $join))
    (export "poll" (func $poll)) (export "drop-set" (func $drop-set))))))
  (func (export "start") ${params} (result $t) (canon lift (core func $i "start")))
  (func (export "deliver") (param "key" u32) (param "value" ${wat}) (result u32) (canon lift (core func $i "deliver")))
  (func (export "reap") (result u32) (canon lift (core func $i "reap"))))`;
};
