/** @file Project a checked, callback-bearing Lean task into a canonical guest future. */
import { canonicalArena } from "./canonical-arena.mjs";
import { richCanonicalFuture } from "./canonical-future.mjs";

/**
 * The start adapter retains the two independent guest borrows. Completion
 * moves only the selected box or exception, or copies the terminal IO text.
 * Native imports see no resource representation and no guest pointers.
 *
 * @param m - Checked method, resource slots and original parameter names.
 */
export const relayComponents=m=>{
	const {a,z,err,cb,param,callbackParam,capacity}=m;
	const slots=[...new Set([a,z,err,cb])];
	const valueTypes=`(type $shape (variant (case "callback" (own $r${err})) (case "io" string)))
  (import "failure" (type $failure (eq $shape)))
  (type $success (own $r${z})) (type $payload (result $success (error $failure)))`;
	const params=`(param "${param}" (borrow $r${a})) (param "${callbackParam}" (borrow $r${cb}))`;
	const abandon=`(if (i32.eqz (i32.load8_u offset=16 (local.get $p)))
          (then (call $drop-r${z} (i32.load offset=20 (local.get $p))))
          (else (if (i32.eqz (i32.load8_u offset=20 (local.get $p)))
            (then (call $drop-r${err} (i32.load offset=24 (local.get $p)))))))`;
	const future=richCanonicalFuture({
		params
		, valueTypes
		, args: [a,cb].map(()=>({t: {flat: ["i32"]}}))
		, payload: {wat: "$payload",size: 16,align: 4,flat: ["i32","i32","i32","i32"]}
		, ownership: {slots,borrows: [[0,a],[1,cb]],abandon}},capacity);
	const funcs=[
		...[[a,""],[cb,"-callback"]].flatMap(([i,s])=>[
			["retain"+s,`(param "value" (borrow $r${i})) (result (own $r${i}))`,"(param i32) (result i32)"]
			, ["put"+s,`(param "value" (own $r${i}))`,"(param i32)"]])
		, ["take",`(result (own $r${z}))`,"(result i32)"]
		, ["take-error",`(result (own $r${err}))`,"(result i32)"]
		, ["start-native","(result u32)","(result i32)"]
		, ["stage",'(param "key" u32) (result (result u32 (error string)))',"(param i32 i32)"]];
	const ports=`(component
  ${slots.map(i=>`(import "r${i}" (type $r${i} (sub resource)))`).join("\n  ")}
  ${valueTypes}
  ${funcs.map(([n,t])=>`(import "${n}" (func $${n} ${t}))`).join("\n  ")}
  ${canonicalArena(65536,1)} (core instance $mem (instantiate $mem))
  ${funcs.map(([n])=>`(core func $${n} (canon lower (func $${n})${n==="stage"?' (memory $mem "m") (realloc (func $mem "realloc"))':""}))`).join("\n  ")}
  (core func $end (canon resource.drop $r${a})) (core func $end-cb (canon resource.drop $r${cb}))
  (core module $m (import "" "m" (memory 1)) (import "" "end" (func $end (param i32)))
    (import "" "end-cb" (func $end-cb (param i32))) (import "" "release" (func $release (param i32)))
    ${funcs.map(([n,,t])=>`(import "" "${n}" (func $${n} ${t}))`).join("\n    ")}
    (func (export "begin") (param i32 i32) (result i32)
      (call $put (call $retain (local.get 0))) (call $end (local.get 0))
      (call $put-callback (call $retain-callback (local.get 1))) (call $end-cb (local.get 1))
      (call $start-native))
    (func (export "peek") (param i32) (result i32)
      (call $stage (local.get 0) (i32.const 32))
      (i32.store8 (i32.const 64) (i32.const 1))
      (if (i32.load8_u (i32.const 32)) (then
        (i32.store8 (i32.const 68) (i32.const 1)) (memory.copy (i32.const 72) (i32.const 36) (i32.const 8)))
        (else (if (i32.load (i32.const 36)) (then
          (if (i32.ne (i32.load (i32.const 36)) (i32.const 1)) (then unreachable))
          (i32.store8 (i32.const 68) (i32.const 0)) (i32.store (i32.const 72) (call $take-error)))
          (else (i32.store8 (i32.const 64) (i32.const 0)) (i32.store (i32.const 68) (call $take))))))
      (i32.const 64))
    (func (export "post") (param i32) (call $release (i32.const 12))))
  (core instance $i (instantiate $m (with "" (instance (export "m" (memory $mem "m"))
    (export "end" (func $end)) (export "end-cb" (func $end-cb)) (export "release" (func $mem "release"))
    ${funcs.map(([n])=>`(export "${n}" (func $${n}))`).join(" ")}))))
  (func (export "begin") ${params} (result u32) (canon lift (core func $i "begin")))
  (func (export "peek") (param "key" u32) (result $payload) (canon lift (core func $i "peek") (memory $mem "m") (post-return (func $i "post")))))`;
	return {ports,future};
};
