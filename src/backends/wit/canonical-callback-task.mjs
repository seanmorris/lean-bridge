/** @file Give a callback-bearing Lean task a canonical future without exposing its private request protocol. */
import {canonicalArena} from "./canonical-arena.mjs";
import {richCanonicalFuture} from "./canonical-future.mjs";
import {canonicalResult,canonicalValue} from "./canonical-values.mjs";

const align=(n,a)=>Math.ceil(n/a)*a;
const word={flat: ["i32"],size: 4,align: 4};
const copied=t=>t.compound==="result"?canonicalResult(...t.fields.map(f=>copied(f.type)))
	:canonicalValue({kind: "primitive",name: t.scalarName});
const layout=cases=>{
	const a=Math.max(1,...cases.map(c=>c.t?.align??1)),size=Math.max(0,...cases.map(c=>c.t?.size??0));
	const tag=cases.length<=256?1:2,boundary=Math.max(a,tag),offset=align(tag,a);
	return {align: boundary,size: align(offset+size,boundary),offset,tag};
};
const variant=cases=>"(variant "+cases.map(c=>'(case "'+c.name+'"'+(c.t?" "+c.t.wat:"")+")").join(" ")+")";

/**
 * Carry the source parameter order and the poll variant's **actual** tag
 * order through the lowering. Factory, worker, callback, and policy failures
 * must remain different even when they carry the same string.
 *
 * @param model - Authenticated native task and observation model.
 * @param bindings - Request sites bound to their guest registration types.
 */
export const canonicalCallbackTaskPlans=(model,bindings)=>{
	const taken=new Set([...model.callbackTasks.map(t=>t.label),...bindings.signatures.map(s=>s.name)]);
	return model.callbackTasks.map(c=>{
		const sites=bindings.sites.filter(s=>s.method===c.method),bySlot=n=>sites.find(s=>s.request.slot===n);
		const regs=[...new Set(sites.map(s=>s.signature))],success=canonicalValue(c.result);
		let flat=0;
		const args=c.params.map(p=>{
			const site=p.callback===undefined?null:bySlot(p.callback);
			const t=site?{...word,wat: "(borrow $r"+site.signature+")",wit: "borrow<"+bindings.signatures[site.signature].name+">"}:canonicalValue(p.type);
			const start=flat;flat+=t.flat.length;return {name: p.name,t,site,start};
		});
		if(flat>16) throw new TypeError("Canonical task parameter flattening exceeds 16 values");
		const failureCases=[],cases=c.observation.cases.map(({witName: name,payload},tag)=>{
			const site=sites.find(s=>s.request.state===name);
			const t=site?{...word,wat: "(own $req"+site.id+")"}:payload?copied(payload):null;
			const entry={tag,name,t,site};
			if(!site && !["pending","closed","ready"].includes(name))
{
				entry.failure=failureCases.length;failureCases.push({name: name==="failed"?"worker-failed":name,t});
}
			return entry;
		});
		let failureName=c.label+"-failure";while(taken.has(failureName))failureName="task-"+failureName;taken.add(failureName);
		const failure={...layout(failureCases),wit: failureName,wat: "$failure"};
		const result=canonicalResult(success,failure),params=args.map(a=>`(param "${a.name}" ${a.t.wat})`).join(" ");
		const types=`(type $failure-base ${variant(failureCases)}) (import "failure" (type $failure (eq $failure-base)))`;
		const borrows=args.filter(a=>a.site).map(a=>[a.start,a.site.signature]);
		const ownership={slots: regs,borrows,abandon: ""};
		const writer=richCanonicalFuture({params,args,payload: result,valueTypes: types,ownership},64);
		const shapes={observationLayout: layout(cases),observationVariant: variant(cases),failureVariant: variant(failureCases)};
		return {...c,...shapes,sites,regs,args,params,cases,failureCases,failure,result,types,writer};
	});
};

/**
 * Own the task and retained registrations for each future's entire active
 * lifetime. Keep terminal payload bytes alive until the separate canonical
 * writer has copied them; do not recycle a key while a write is parked.
 *
 * @param p - A compiler-derived callback task plan.
 */
export const canonicalCallbackController=p=>{
	const {sites,regs,args,cases,failure,result,observationLayout: o}=p;
	const obs=align(16+4*sites.length,o.align),out=align(obs+o.size,result.align);
	const stride=align(out+result.size,8),pages=Math.ceil((1024+65*stride)/65536);
	const at=n=>`(i32.add (local.get $p) (i32.const ${n}))`;
	const sig=args.filter(a=>!a.site).map(a=>`(param "${a.name}" ${a.t.wat})`).join(" ");
	const input=args.flatMap(a=>a.t.flat).join(" ");
	const normal=args.filter(a=>!a.site),nativeLocals=normal.flatMap(a=>a.t.flat.map((_,j)=>"(local.get "+(a.start+j)+")")).join(" ");
	const imports=[
		["start",sig+" (result (own $task))",`(param ${normal.flatMap(a=>a.t.flat).join(" ")}) (result i32)`]
		, ["poll",'(param "task" (borrow $task)) (result $obs)',"(param i32 i32)"]
		, ...regs.map(i=>["retain-"+i,`(param "value" (borrow $r${i})) (result (own $r${i}))`,"(param i32) (result i32)"])
		, ...sites.map(s=>["dispatch-"+s.id,`(param "registration" (borrow $r${s.signature})) (param "request" (own $req${s.id})) (result bool)`,"(param i32 i32) (result i32)"])
	];
	const block=c=>{
		const tagged=body=>`(if (i32.eq (local.get $tag) (i32.const ${c.tag})) (then ${body}))`;
		if(c.name==="pending")return tagged("(return (i32.const 1))");
		if(c.name==="closed")return ""; // An active, privately owned task cannot already have been taken.
		if(c.site)return tagged(`(drop (call $dispatch-${c.site.id} (i32.load ${at(16+4*sites.indexOf(c.site))}) (i32.load ${at(obs+o.offset)}))) (return (i32.const 2))`);
		const bad=c.failure!==undefined,start=out+result.align+(bad?failure.offset:0);
		return tagged(`(i32.store8 ${at(out)} (i32.const ${bad?1:0}))
          ${bad?`(i32.store8 ${at(out+result.align)} (i32.const ${c.failure}))`:""}
          ${c.t?`(memory.copy ${at(start)} ${at(obs+o.offset)} (i32.const ${c.t.size}))`:""}
          (i32.store (local.get $p) (i32.const 2)) (return (i32.const 3))`);
	};
	const opts='(memory $mem "m") (realloc (func $mem "realloc"))';
	const drops=[["drop-task","$task"],...regs.map(i=>["drop-"+i,"$r"+i])];
	return `(component
  (import "task" (type $task (sub resource)))
  ${sites.map(s=>`(import "req${s.id}" (type $req${s.id} (sub resource)))`).join("\n  ")}
  ${regs.map(i=>`(import "r${i}" (type $r${i} (sub resource)))`).join("\n  ")}
  (type $obs-base ${p.observationVariant}) (import "observation" (type $obs (eq $obs-base)))
  ${p.types}
  ${imports.map(([n,t])=>`(import "${n}" (func $${n} ${t}))`).join("\n  ")}
  ${canonicalArena(pages*65536,pages)} (core instance $mem (instantiate $mem))
  ${imports.map(([n])=>`(core func $${n} (canon lower (func $${n}) ${opts}))`).join("\n  ")}
  ${drops.map(([n,t])=>`(core func $${n} (canon resource.drop ${t}))`).join("\n  ")}
  (core module $body
    (import "" "m" (memory 1))
    (import "" "select" (func $select (param i32))) (import "" "release" (func $release (param i32)))
    ${[...imports,...drops.map(([n])=>[n,"","(param i32)"])].map(([n,,t])=>`(import "" "${n}" (func $${n} ${t}))`).join("\n    ")}
    (func $row (param $key i32) (result i32)
      (if (i32.ge_u (i32.sub (local.get $key) (i32.const 1)) (i32.const 64)) (then unreachable))
      (i32.add (i32.const 1024) (i32.mul (local.get $key) (i32.const ${stride}))))
    (func (export "begin") (param ${input}) (result i32) (local $key i32) (local $p i32)
      (loop $find (local.set $key (i32.add (local.get $key) (i32.const 1))) (local.set $p (call $row (local.get $key)))
        (br_if $find (i32.load (local.get $p))))
      (i32.store (local.get $p) (i32.const 1))
      ${sites.map((s,j)=>{const a=args.find(v=>v.site===s);return `(i32.store ${at(16+4*j)} (call $retain-${s.signature} (local.get ${a.start}))) (call $drop-${s.signature} (local.get ${a.start}))`;}).join("\n      ")}
      (i32.store ${at(4)} (call $start ${nativeLocals})) (local.get $key))
    (func (export "step") (param $key i32) (result i32) (local $p i32) (local $tag i32)
      (local.set $p (call $row (local.get $key)))
      (if (i32.ne (i32.load (local.get $p)) (i32.const 1)) (then (return (i32.const 0))))
      (call $select ${at(8)}) (call $poll (i32.load ${at(4)}) ${at(obs)}) (call $select (i32.const 12))
      (local.set $tag (i32.load${o.tag*8}_u ${at(obs)}))
      ${cases.map(block).join("\n      ")} unreachable)
    (func (export "peek") (param $key i32) (result i32) (local $p i32)
      (local.set $p (call $row (local.get $key))) (if (i32.ne (i32.load (local.get $p)) (i32.const 2)) (then unreachable)) ${at(out)})
    (func (export "state") (param i32) (result i32) (i32.load (call $row (local.get 0))))
    (func (export "finish") (param $key i32) (param $park i32) (local $p i32) (local $phase i32)
      (local.set $p (call $row (local.get $key))) (local.set $phase (i32.load (local.get $p)))
      (if (i32.eqz (local.get $phase)) (then unreachable))
      (if (i32.and (local.get $park) (i32.ne (local.get $phase) (i32.const 2))) (then unreachable))
      (if (i32.ne (local.get $phase) (i32.const 3)) (then
        (call $drop-task (i32.load ${at(4)}))
        ${sites.map((s,j)=>`(call $drop-${s.signature} (i32.load ${at(16+4*j)}))`).join("\n        ")}
        (call $release ${at(8)})))
      (i32.store (local.get $p) (select (i32.const 3) (i32.const 0) (local.get $park))))
    (func (export "post") (param i32) (call $release (i32.const 12))))
  (core instance $body (instantiate $body (with "" (instance (export "m" (memory $mem "m"))
    (export "select" (func $mem "select")) (export "release" (func $mem "release"))
    ${[...imports,...drops].map(([n])=>`(export "${n}" (func $${n}))`).join(" ")}))))
  (func (export "begin") ${p.params} (result u32) (canon lift (core func $body "begin") ${opts} (post-return (func $body "post"))))
  (func (export "step") (param "key" u32) (result u32) (canon lift (core func $body "step")))
  (func (export "state") (param "key" u32) (result u32) (canon lift (core func $body "state")))
  (func (export "peek") (param "key" u32) (result ${result.wat}) (canon lift (core func $body "peek") (memory $mem "m")))
  (func (export "finish") (param "key" u32) (param "park" bool) (canon lift (core func $body "finish"))))`;
};

// Separate component instances are intentional: the writer's delivery calls
// back into the controller to copy a staged result. Neither instance can be
// synchronously re-entered while still on its own stack.
const coordinator=`(component
  (import "step" (func $step (param "key" u32) (result u32)))
  (import "state" (func $state (param "key" u32) (result u32)))
  (import "finish" (func $finish (param "key" u32) (param "park" bool)))
  (import "deliver" (func $deliver (param "key" u32) (result u32)))
  (import "reap" (func $reap (result u32))) (import "retire" (func $retire (param "key" u32)))
  ${["step","state","finish","deliver","reap","retire"].map(n=>`(core func $${n} (canon lower (func $${n})))`).join(" ")}
  (core module $m
    (import "" "step" (func $step (param i32) (result i32))) (import "" "state" (func $state (param i32) (result i32)))
    (import "" "finish" (func $finish (param i32 i32)))
    (import "" "deliver" (func $deliver (param i32) (result i32)))
    (import "" "reap" (func $reap (result i32))) (import "" "retire" (func $retire (param i32)))
    (func (export "turn") (result i32) (local $k i32) (local $s i32) (local $work i32)
      ;; Observe abandoned readers *before* making any guest callback.
      (block $done (loop $acks (local.set $k (call $reap)) (br_if $done (i32.eqz (local.get $k)))
        (call $finish (local.get $k) (i32.const 0)) (br $acks)))
      (loop $rows (local.set $k (i32.add (local.get $k) (i32.const 1)))
        (local.set $s (call $step (local.get $k)))
        (if (i32.eq (local.get $s) (i32.const 3)) (then
          (call $finish (local.get $k) (i32.eq (call $deliver (local.get $k)) (i32.const 2)))))
        (if (i32.gt_u (local.get $s) (local.get $work)) (then (local.set $work (local.get $s))))
        (br_if $rows (i32.lt_u (local.get $k) (i32.const 64))))
      (local.get $work))
    (func (export "shutdown") (local $k i32) (local $s i32)
      (loop $rows (local.set $k (i32.add (local.get $k) (i32.const 1)))
        (local.set $s (call $state (local.get $k)))
        (if (local.get $s) (then
          (if (i32.eq (local.get $s) (i32.const 3)) (then (call $retire (local.get $k))))
          (call $finish (local.get $k) (i32.const 0))))
        (br_if $rows (i32.lt_u (local.get $k) (i32.const 64))))))
  (core instance $i (instantiate $m (with "" (instance
    ${["step","state","finish","deliver","reap","retire"].map(n=>`(export "${n}" (func $${n}))`).join(" ")}))))
  (func (export "turn") (result u32) (canon lift (core func $i "turn")))
  (func (export "shutdown") (canon lift (core func $i "shutdown"))))`;

/**
 * Wire the authenticated native world, defining guest, resource owners and
 * genuine future writers. The application imports only the tasks and public
 * callback types; the two driver operations per method are for the embedding.
 *
 * @param model - Authenticated task resources.
 * @param bindings - Native registration and dispatch graph.
 */
export const canonicalCallbackFutures=(model,bindings)=>{
	const plans=canonicalCallbackTaskPlans(model,bindings);
	if(!plans.length) throw new TypeError("No canonical callback tasks");
	const interfaces=plans.map(p=>{
		const variants=p.failureCases.map(c=>"%"+c.name+(c.t?"("+c.t.wit+")":""));
		return `  variant %${p.failure.wit} { ${variants.join(", ")} }\n  %${p.label}: func(`
			+p.args.map(a=>"%"+a.name+": "+a.t.wit).join(", ")+") -> future<"+p.result.wit+">;";
	}).join("\n");
	const wit=`package lean-bridge:${model.name}@${model.version};\n\n${bindings.providerWit}\n\ninterface callback-tasks {
  use callbacks.{${bindings.signatures.map(s=>s.name).join(", ")}};
${interfaces}
}
world callback-provider { export callbacks; }
world application { import callbacks; import callback-tasks; export run: async func() -> s64; }
`;
	const wat=`(component
  (import "${model.importName}" (instance $native ${model.nativeType}))
  (import "callbacks" (instance $provider ${bindings.providerType}))
  ${bindings.graph.replace("(component","(component $graph")}
  (instance $g (instantiate $graph (with "${model.importName}" (instance $native)) (with "callbacks" (instance $provider))))
  (alias export $g "tasks" (instance $api)) (alias export $g "dispatchers" (instance $dispatchers))
  ${bindings.signatures.map(s=>`(alias export $provider "${s.name}" (type $r${s.id}))`).join(" ")}
  ${coordinator.replace("(component","(component $driver")}
  ${plans.map(p=>{
		const i=p.method,m=model.methods[i];
		const regs=p.regs.map(j=>`(with "r${j}" (type $r${j}))`).join(" ");
		return `(type $f${i} ${p.failureVariant})
  (alias export $api "${m.resource}" (type $task${i})) (alias export $api "${p.observation.witName}" (type $obs${i}))
  ${p.sites.map(s=>`(alias export $api "${s.request.resource}" (type $req${s.id}))`).join(" ")}
  ${canonicalCallbackController(p).replace("(component","(component $controller"+i)}
  (instance $c${i} (instantiate $controller${i} (with "failure" (type $f${i})) (with "observation" (type $obs${i}))
    (with "task" (type $task${i})) (with "start" (func $api "${m.start}")) (with "poll" (func $api "${m.poll}"))
    ${p.sites.map(s=>`(with "req${s.id}" (type $req${s.id})) (with "dispatch-${s.id}" (func $dispatchers "dispatch-${s.request.resource}"))`).join(" ")}
    ${regs} ${p.regs.map(j=>`(with "retain-${j}" (func $provider "retain-${bindings.signatures[j].name}"))`).join(" ")}))
  ${p.writer.replace("(component","(component $writer"+i)}
  (instance $w${i} (instantiate $writer${i} ${regs} (with "failure" (type $f${i})) (with "begin" (func $c${i} "begin")) (with "peek" (func $c${i} "peek"))))
  (instance $d${i} (instantiate $driver
    ${["step","state","finish"].map(n=>`(with "${n}" (func $c${i} "${n}"))`).join(" ")}
    ${["deliver","reap","retire"].map(n=>`(with "${n}" (func $w${i} "${n}"))`).join(" ")}))
  (export "turn-m${i}" (func $d${i} "turn")) (export "shutdown-m${i}" (func $d${i} "shutdown"))`;
  }).join("\n  ")}
  (instance $methods
    ${bindings.signatures.map(s=>`(export "${s.name}" (type $r${s.id}))`).join(" ")}
    ${plans.map(p=>`(export "${p.failure.wit}" (type $f${p.method})) (export "${p.label}" (func $w${p.method} "start"))`).join(" ")})
  (export "callback-tasks" (instance $methods)))`;
	return {wat,wit,plans};
};
