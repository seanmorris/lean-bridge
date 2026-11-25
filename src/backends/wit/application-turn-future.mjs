/** @file Canonical future bridge for a Lean task with a retained guest callback. */

/**
 * Keep the signature and writer from the checked declaration. The native
 * owner parks when it needs the callback; only this component invokes the
 * defining guest. The consumer receives an ordinary canonical future.
 *
 * @param m - Source-checked task coordinates and private signature slot.
 * @param writer - Canonical future from the same source declaration.
 */
export const witTurnRelayGraph=(m,writer)=>{
	const {a,z,err,cb,idx,param,callbackParam}=m,slots=[...new Set([a,z,err,cb])];
	const types=slots.map(i=>`(import "r${i}" (type $r${i} (sub resource)))`).join(" ")
		+` (type $v (variant (case "callback" (own $r${err})) (case "io" string))) (import "failure" (type $failure (eq $v)))`;
	const supply=slots.map(i=>`(with "r${i}" (type $r${i}))`).join(" ")+' (with "failure" (type $failure))';
	const turn='(param "op" u32) (param "key" u32) (param "left" u64) (param "right" u64) (result (tuple u32 u32 u64 u64))';
	const invoke='(param "registration" u64) (param "argument" u64) (result (result u64 (error u64)))';
	const fs=[
		["turn",turn,"(param i32 i32 i64 i64 i32)"]
		, ["invoke",invoke,"(param i64 i64 i32)"]
		, ...[[a,"box"],[cb,"reg"]].map(([i,n])=>["pin-"+n,`(param "value" (borrow $r${i})) (result u64)`,"(param i32) (result i64)","lease-k"+i])
		, ["copy",`(param "ticket" u64) (result (option (own $r${z})))`,"(param i64 i32)","copy-k"+z]
		, ["fault",`(param "ticket" u64) (result (option (own $r${err})))`,"(param i64 i32)","take-k"+err]
		, ["release",'(param "kind" u32) (param "ticket" u64) (result bool)',"(param i32 i64) (result i32)","release-lease"]
		, ["same",'(param "kind" u32) (param "left" u64) (param "right" u64) (result bool)',"(param i32 i64 i64) (result i32)","same-lease"]];
	const args=`(param "${param}" (borrow $r${a})) (param "${callbackParam}" (borrow $r${cb}))`;
	return `(component ${types}
      (import "leases" (instance $leases ${fs.filter(f=>f[3]).map(([,t,,field])=>`(export "${field}" (func ${t}))`).join(" ")}))
      (import "turn" (func $turn ${turn})) (import "invoke" (func $invoke ${invoke}))
      (component $ports ${types} ${fs.map(([n,t])=>`(import "${n}" (func $${n} ${t}))`).join(" ")}
        (core module $mem (memory (export "m") 1 257)) (core instance $m (instantiate $mem))
        ${fs.map(([n])=>`(core func $${n} (canon lower (func $${n}) (memory $m "m")))`).join(" ")}
        (core func $end-a (canon resource.drop $r${a})) (core func $end-c (canon resource.drop $r${cb}))
        (core module $body (import "" "m" (memory 1 257))
          (import "" "end-a" (func $end-a (param i32))) (import "" "end-c" (func $end-c (param i32)))
          ${fs.map(([n,,sig])=>`(import "" "${n}" (func $${n} ${sig}))`).join(" ")}
          (func $drive (param $op i32) (param $key i32) (param $x i64) (param $y i64)
            (local $kind i32) (local $rc i32)
            (loop $next
              (call $turn (local.get $op) (local.get $key) (local.get $x) (local.get $y) (i32.const 0))
              (local.set $op (i32.load (i32.const 0))) (if (i32.eqz (local.get $op)) (then (return)))
              (local.set $kind (i32.load (i32.const 4))) (local.set $x (i64.load (i32.const 8))) (local.set $y (i64.load (i32.const 16)))
              (if (i32.eq (local.get $op) (i32.const 3)) (then
                (if (i32.ne (local.get $kind) (i32.const ${idx})) (then unreachable))
                (call $invoke (local.get $x) (local.get $y) (i32.const 32))
                (local.set $key (i32.load8_u (i32.const 32))) (local.set $x (i64.load (i32.const 40)))
                (local.set $op (i32.const 8))) (else
                (if (i32.eq (local.get $op) (i32.const 1)) (then
                  (local.set $rc (call $release (local.get $kind) (local.get $x))) (if (i32.eqz (local.get $rc)) (then unreachable)))
                  (else (if (i32.ne (local.get $op) (i32.const 2)) (then unreachable))
                    (local.set $rc (call $same (local.get $kind) (local.get $x) (local.get $y)))))
                (local.set $key (local.get $rc)) (local.set $x (i64.const 0)) (local.set $op (i32.const 6))))
              (local.set $y (i64.const 0)) (br $next)))
          (func (export "begin") (param i32 i32) (result i32) (local $a i64) (local $c i64)
            (local.set $a (call $pin-box (local.get 0))) (call $end-a (local.get 0))
            (local.set $c (call $pin-reg (local.get 1))) (call $end-c (local.get 1))
            (if (i32.or (i64.eqz (local.get $a)) (i64.eqz (local.get $c))) (then unreachable))
            (call $drive (i32.const 0) (i32.const 0) (local.get $a) (local.get $c)) (i32.load (i32.const 4)))
          (func (export "poll") (param i32) (result i32)
            (call $drive (i32.const 1) (local.get 0) (i64.const 0) (i64.const 0)) (i32.load (i32.const 4)))
          (func (export "close") (param i32) (call $drive (i32.const 4) (local.get 0) (i64.const 0) (i64.const 0)))
          (func (export "drain") (call $drive (i32.const 5) (i32.const 0) (i64.const 0) (i64.const 0)))
          (func (export "peek") (param $key i32) (result i32) (local $arm i32) (local $v i64) (local $n i32) (local $pos i32) (local $pages i32)
            (call $drive (i32.const 2) (local.get $key) (i64.const 0) (i64.const 0))
            (local.set $arm (i32.load (i32.const 4))) (local.set $v (i64.load (i32.const 8)))
            (if (i32.lt_u (local.get $arm) (i32.const 2)) (then
              (if (local.get $arm) (then (call $fault (local.get $v) (i32.const 32))) (else (call $copy (local.get $v) (i32.const 32))))
              (if (i32.ne (i32.load8_u (i32.const 32)) (i32.const 1)) (then unreachable))
              (i32.store8 (i32.const 64) (local.get $arm)) (i32.store (i32.const 68) (i32.const 0))
              (i32.store (select (i32.const 72) (i32.const 68) (local.get $arm)) (i32.load (i32.const 36))))
              (else
                (if (i32.or (i32.ne (local.get $arm) (i32.const 2)) (i64.gt_u (local.get $v) (i64.const 16777216))) (then unreachable))
                (local.set $n (i32.wrap_i64 (local.get $v))) (local.set $pages (i32.shr_u (i32.add (local.get $n) (i32.const 65807)) (i32.const 16)))
                (if (i32.gt_u (local.get $pages) (memory.size)) (then
                  (if (i32.eq (memory.grow (i32.sub (local.get $pages) (memory.size))) (i32.const -1)) (then unreachable))))
                (block $done (loop $chunk (br_if $done (i32.ge_u (local.get $pos) (local.get $n)))
                  (call $drive (i32.const 3) (local.get $key) (i64.extend_i32_u (local.get $pos)) (i64.const 0))
                  (if (i32.ne (i32.load (i32.const 4)) (select (i32.const 16) (i32.sub (local.get $n) (local.get $pos))
                    (i32.gt_u (i32.sub (local.get $n) (local.get $pos)) (i32.const 16)))) (then unreachable))
                  (i64.store offset=256 (local.get $pos) (i64.load (i32.const 8))) (i64.store offset=264 (local.get $pos) (i64.load (i32.const 16)))
                  (local.set $pos (i32.add (local.get $pos) (i32.const 16))) (br $chunk)))
                (i32.store8 (i32.const 64) (i32.const 1)) (i32.store8 (i32.const 68) (i32.const 1))
                (i32.store (i32.const 72) (i32.const 256)) (i32.store (i32.const 76) (local.get $n))))
            (i32.const 64)))
        (core instance $i (instantiate $body (with "" (instance (export "m" (memory $m "m"))
          (export "end-c" (func $end-c)) (export "end-a" (func $end-a))
          ${fs.map(([n])=>`(export "${n}" (func $${n}))`).join(" ")}))))
        (func (export "begin") ${args} (result u32) (canon lift (core func $i "begin")))
        (func (export "peek") (param "key" u32) (result (result (own $r${z}) (error $failure))) (canon lift (core func $i "peek") (memory $m "m")))
        (func (export "poll") (param "key" u32) (result bool) (canon lift (core func $i "poll")))
        (func (export "close") (param "key" u32) (canon lift (core func $i "close")))
        (func (export "drain") (canon lift (core func $i "drain"))))
      ${writer.replace("(component","(component $writer")}
      (instance $p (instantiate $ports ${supply} (with "invoke" (func $invoke)) (with "turn" (func $turn))
        ${fs.filter(f=>f[3]).map(([n,,,field])=>`(with "${n}" (func $leases "${field}"))`).join(" ")}))
      (instance $q (instantiate $writer ${supply} (with "begin" (func $p "begin")) (with "peek" (func $p "peek"))))
      ${["start","deliver","reap","retire"].map(n=>`(export "${n}" (func $q "${n}"))`).join(" ")}
      ${["poll","close","drain"].map(n=>`(export "${n}" (func $p "${n}"))`).join(" ")})`;
};
