/** @file Compose independent producer and consumer instances for real canonical channel execution. */
// Each component has its own memory and handle table. Only the readable end
// crosses the component boundary; the producer keeps its writer private.
/**
 * Build an instrumented channel; the native future obtains its value from a parked Lean task.
 *
 * @param kind - Canonical future or stream.
 * @param native - Import the signed native Lean producer.
 */
export const canonicalChannelFixture=(kind,native=false)=>{
	if(!["future","stream"].includes(kind) || (native && kind!=="future")) throw new TypeError("No such canonical-channel fixture");
	const scalar=native?"s64":"u32",core=native?"i64":"i32";
	const begin=native?'(import "begin" (func $begin (param "value" s64))) (core func $begin (canon lower (func $begin)))':"";
	const resume=native?'(import "resume" (func $resume (result s64))) (core func $resume (canon lower (func $resume)))':"";
	const host=native?'(import "begin" (func $begin (param "value" s64))) (import "resume" (func $resume (result s64)))':"";
	const stream=kind==="stream",count=stream?" i32":"",one=stream?" (i32.const 1)":"";
	const memory='(core module $mem (memory (export "m") 1)) (core instance $mem (instantiate $mem))';
	const op=(name,options="")=>`(core func $${name} (canon ${kind}.${name} $t ${options}))`;
	const type=`(type $t (${kind} ${scalar}))`;
	return `(component ${host}
  (component $producer
    ${type} ${memory} ${begin} ${resume}
    ${op("new")} ${op("write",'async (memory $mem "m")')} ${op("drop-writable")}
    (core module $m
      (import "" "m" (memory 1))
      (import "" "new" (func $new (result i64)))
      (import "" "write" (func $write (param i32 i32${count}) (result i32)))
      (import "" "drop" (func $drop (param i32)))
      ${native?'(import "" "begin" (func $begin (param i64))) (import "" "resume" (func $resume (result i64)))':""}
      (global $writer (mut i32) (i32.const 0))
      (func (export "open") (param $v ${core}) (result i32) (local $pair i64)
        ${native?"(call $begin (local.get $v))":""}
        (local.set $pair (call $new))
        (global.set $writer (i32.wrap_i64 (i64.shr_u (local.get $pair) (i64.const 32))))
        (i32.wrap_i64 (local.get $pair)))
      (func (export "send") (param $v ${core}) (result i32)
        (${core}.store (i32.const 16) ${native?"(call $resume)":"(local.get $v)"})
        (call $write (global.get $writer) (i32.const 16)${one}))
      (func (export "close") (call $drop (global.get $writer))))
    (core instance $i (instantiate $m (with "" (instance
      ${native?'(export "begin" (func $begin)) (export "resume" (func $resume))':""}
      (export "m" (memory $mem "m")) (export "new" (func $new))
      (export "write" (func $write)) (export "drop" (func $drop-writable))))))
    (func (export "open") (param "value" ${scalar}) (result $t) (canon lift (core func $i "open")))
    (func (export "send") (param "value" ${scalar}) (result u32) (canon lift (core func $i "send")))
    (func (export "close") (canon lift (core func $i "close"))))
  (instance $p (instantiate $producer ${native?'(with "begin" (func $begin)) (with "resume" (func $resume))':""}))
  (component $consumer
    ${type} ${memory}
    (import "open" (func $open (param "value" ${scalar}) (result $t)))
    (import "send" (func $send (param "value" ${scalar}) (result u32)))
    (import "close" (func $close))
    (core func $open (canon lower (func $open)))
    (core func $send (canon lower (func $send)))
    (core func $close (canon lower (func $close)))
    ${op("read",'async (memory $mem "m")')} ${op("drop-readable")} ${op("cancel-read","async")}
    (core func $new-set (canon waitable-set.new))
    (core func $join (canon waitable.join))
    (core func $wait (canon waitable-set.poll (memory $mem "m")))
    (core func $drop-set (canon waitable-set.drop))
    (core module $m
      (import "" "m" (memory 1))
      (import "" "open" (func $open (param ${core}) (result i32)))
      (import "" "send" (func $send (param ${core}) (result i32)))
      (import "" "close" (func $close))
      (import "" "read" (func $read (param i32 i32${count}) (result i32)))
      (import "" "drop" (func $drop (param i32)))
      (import "" "cancel" (func $cancel (param i32) (result i32)))
      (import "" "set" (func $set (result i32)))
      (import "" "join" (func $join (param i32 i32)))
      (import "" "wait" (func $wait (param i32 i32) (result i32)))
      (import "" "drop-set" (func $drop-set (param i32)))
      (func (export "run") (param $v ${core}) (result ${core}) (local $r i32) (local $s i32)
        (local.set $r (call $open (local.get $v))) (local.set $s (call $set))
        (if (i32.ne (call $read (local.get $r) (i32.const 32)${one}) (i32.const -1)) (then unreachable))
        (if (i32.ne (call $cancel (local.get $r)) (i32.const 2)) (then unreachable))
        (if (i32.ne (call $read (local.get $r) (i32.const 32)${one}) (i32.const -1)) (then unreachable))
        (call $join (local.get $r) (local.get $s))
        (drop (call $send (local.get $v)))
        (if (i32.ne (call $wait (local.get $s) (i32.const 64)) (i32.const ${stream?2:4})) (then unreachable))
        (if (i32.ne (i32.load (i32.const 64)) (local.get $r)) (then unreachable))
        ${stream?`(if (i32.ne (call $read (local.get $r) (i32.const 40) (i32.const 1)) (i32.const -1)) (then unreachable))
        (drop (call $send (i32.xor (local.get $v) (i32.const 127))))
        (if (i32.ne (call $wait (local.get $s) (i32.const 64)) (i32.const 2)) (then unreachable))
        (if (i32.ne (i32.load (i32.const 40)) (i32.xor (local.get $v) (i32.const 127))) (then unreachable))`:""}
        (call $close)
        ${stream?'(if (i32.ne (call $read (local.get $r) (i32.const 40) (i32.const 1)) (i32.const 1)) (then unreachable))':""}
        (call $drop (local.get $r)) (call $drop-set (local.get $s))
        ${!native?`(local.set $r (call $open (local.get $v)))
        (call $drop (local.get $r))
        (if (i32.ne (call $send (local.get $v)) (i32.const 1)) (then unreachable))
        (call $close)`:""}
        (${core}.load (i32.const 32))))
    (core instance $i (instantiate $m (with "" (instance (export "m" (memory $mem "m"))
      (export "open" (func $open)) (export "send" (func $send)) (export "close" (func $close))
      (export "read" (func $read)) (export "drop" (func $drop-readable))
      (export "cancel" (func $cancel-read)) (export "set" (func $new-set)) (export "join" (func $join)) (export "wait" (func $wait))
      (export "drop-set" (func $drop-set))))))
    (func (export "run") (param "value" ${scalar}) (result ${scalar}) (canon lift (core func $i "run"))))
  (instance $c (instantiate $consumer (with "open" (func $p "open"))
    (with "send" (func $p "send")) (with "close" (func $p "close"))))
  (export "run" (func $c "run"))) `;
};
