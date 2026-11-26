/** @file Downstream Budget guest: only the published task methods, real future readers and its own captures. */
const cb="callback-uint32-to-uint32";
const names=["single","pair","probe","retry","race","during-start","checked","start","replace"];
const issues=n=>[
	["cancelled",""],["worker-failed","string"]
	, ...["during-start","start","checked"].includes(n)?[["factory-failed",n==="checked"?"u32":"string"]]:[]
	, ...["during-start","start"].includes(n)?[["factory-callback-failed","string"]]:[]
	, ["worker-callback-failed","string"],["callback-already-invoked",""]
];
// Method, argument, provider modes, expected branch, expected payload, calls.
const policy="callback-already-invoked",message="message";
const cases=[
	["single",41,[0],"ready",42,1],["pair",40,[0,0],"ready",42,2]
	, ["probe",1,[0,0],policy,null,3],["retry",1,[1],policy,null,1]
	, ["single",1,[1],"worker-callback-failed",message,1]
	, ["during-start",1,[1],"factory-callback-failed",message,1]
	, ["during-start",1,[0],policy,null,1]
	, ["start",0,[0],"factory-failed",message,0]
	, ["replace",1,[0],"worker-failed",message,1]
	, ["checked",0,[0],"factory-failed",73,0]
	, ["checked",1,[0],policy,null,1]
	, ...Array.from({length: 16},(_,n)=>["race",n,[0],policy,null,1])
];

/** An application, not a scheduler: await the supplied future and inspect its result. */
export const canonicalBudgetGuest=()=>{
	const repeated=n=>["pair","probe"].includes(n);
	const startDefs=names.map(n=>{
		const v=issues(n).map(([s,t])=>'(case "'+s+'"'+(t?" "+t:"")+")").join(" ");
		return `(type $base-${n} (variant ${v})) (export "${n}-failure" (type $e-${n} (eq $base-${n})))
      (export "${n}" (func (param "n" u32) (param "f" (borrow $type)) ${repeated(n)?'(param "g" (borrow $type))':""}
        (result (future (result u32 (error $e-${n}))))))`;
	}).join("\n");
	const funcs=names.flatMap(n=>[[n,`(param i32 i32${repeated(n)?" i32":""}) (result i32)`]
		, ["read-"+n,"(param i32 i32) (result i32)"],["drop-"+n,"(param i32)"]]);
	const imports=[...funcs
		, ["make","(param i32) (result i32)"]
		, ["release","(param i32)"]
		, ["live","(result i32)"],["calls","(result i32)"],["set","(result i32)"]
		, ["join","(param i32 i32)"],["end","(param i32)"],["ret","(param i64)"]];
	const get=p=>"(i32.load (i32.const "+p+"))",byte=p=>"(i32.load8_u (i32.const "+p+"))";
	return `(component
  (import "lean-bridge:budget/callbacks@1.0.0" (instance $provider (export "${cb}" (type $r (sub resource)))
    (export "make" (func (param "fail" bool) (result (own $r)))) (export "live" (func (result u32))) (export "calls" (func (result u32)))))
  (alias export $provider "${cb}" (type $r))
  (import "lean-bridge:budget/callback-tasks@1.0.0" (instance $tasks
    (export "${cb}" (type $type (eq $r))) ${startDefs}))
  (core module $storage (memory (export "m") 1)
    (func (export "alloc") (param i32 i32 i32 i32) (result i32)
      (if (i32.gt_u (local.get 3) (i32.const 256)) (then unreachable)) (i32.const 512)))
  (core instance $m (instantiate $storage))
  ${names.map(n=>`(alias export $tasks "${n}-failure" (type $error-${n})) (type $f-${n} (future (result u32 (error $error-${n}))))
  (core func $${n} (canon lower (func $tasks "${n}"))) (core func $drop-${n} (canon future.drop-readable $f-${n}))
  (core func $read-${n} (canon future.read $f-${n} async (memory $m "m") (realloc (func $m "alloc"))))`).join("\n")}
  ${["make","live","calls"].map(n=>`(core func $${n} (canon lower (func $provider "${n}")))`).join(" ")}
  (core func $release (canon resource.drop $r)) (core func $set (canon waitable-set.new))
  (core func $join (canon waitable.join)) (core func $end (canon waitable-set.drop)) (core func $ret (canon task.return (result s64)))
  (core module $app (import "" "m" (memory 1))
    ${imports.map(([n,t])=>`(import "" "${n}" (func $${n} ${t}))`).join(" ")}
    (global $phase (mut i32) (i32.const 0)) (global $set (mut i32) (i32.const 0))
    (global $reader (mut i32) (i32.const 0)) (global $before (mut i32) (i32.const 0))
    (func $eq (param i32 i32) (if (i32.ne (local.get 0) (local.get 1)) (then unreachable)))
    (func $message (param $p i32)
      (call $eq (i32.load offset=4 (local.get $p)) (i32.const 24))
      ${Array.from({length: 6},(_,i)=>`(call $eq (i32.load offset=${i*4} (i32.load (local.get $p))) (i32.const ${Buffer.from(policy).readUInt32LE(i*4)}))`).join("\n      ")})
    (func $next (result i32) (local $reg i32)
      (global.set $before (call $calls))
      ${cases.map(([name,n,modes],i)=>`(if (i32.eq (global.get $phase) (i32.const ${i})) (then
        (local.set $reg (call $make (i32.const ${modes[0]})))
        (global.set $reader (call $${name} (i32.const ${n}) (local.get $reg) ${modes.length===2?"(local.get $reg)":""}))
        (call $release (local.get $reg)) (call $eq (call $live) (i32.const ${modes.length+(i===0?1:0)}))
        (call $eq (call $read-${name} (global.get $reader) (i32.const 32)) (i32.const -1))
        (call $join (global.get $reader) (global.get $set))
        (return (i32.or (i32.const 2) (i32.shl (global.get $set) (i32.const 4))))))`).join("\n      ")}
      (call $end (global.get $set)) (call $ret (i64.const ${cases.length})) (i32.const 0))
    (func (export "run") (result i32) (local $reg i32) (global.set $set (call $set))
      ;; Drop a reader without requesting any result. No callback may escape.
      (local.set $reg (call $make (i32.const 0))) (call $drop-single (call $single (i32.const 17) (local.get $reg)))
      (call $release (local.get $reg)) (call $next))
    (func (export "cb") (param $kind i32) (param $id i32) (param $status i32) (result i32)
      (call $eq (local.get $kind) (i32.const 4)) (call $eq (local.get $id) (global.get $reader))
      (call $eq (local.get $status) (i32.const 0)) (call $eq (call $live) (i32.const 0))
      ${cases.map(([n,,,branch,payload,count],i)=>`(if (i32.eq (global.get $phase) (i32.const ${i})) (then
        (call $drop-${n} (local.get $id))
        (call $eq (i32.sub (call $calls) (global.get $before)) (i32.const ${count}))
        (call $eq ${byte(32)} (i32.const ${branch==="ready"?0:1}))
        ${branch==="ready"?"":`(call $eq ${byte(36)} (i32.const ${issues(n).findIndex(([s])=>s===branch)}))`}
        ${payload===message?"(call $message (i32.const 40))":typeof payload==="number"?`(call $eq ${get(branch==="ready"?36:40)} (i32.const ${payload}))`:""}
        (global.set $phase (i32.add (global.get $phase) (i32.const 1))) (return (call $next))))`).join("\n      ")} unreachable))
  (core instance $a (instantiate $app (with "" (instance (export "m" (memory $m "m"))
    ${imports.map(([n])=>`(export "${n}" (func $${n}))`).join(" ")}))))
  (func (export "run") async (result s64) (canon lift (core func $a "run") async (callback (func $a "cb")))))`;
};
