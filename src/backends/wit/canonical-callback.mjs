/** @file Forward a native task's owned request to a guest-defined callback in the store owner's turn. */
import {canonicalArena} from "./canonical-arena.mjs";
import {canonicalResult,canonicalString,canonicalValue} from "./canonical-values.mjs";
import {checkedWitCallbackSites} from "./task-callback-table.mjs";

// A canonical result uses memory even for a scalar success: the declared
// failure is a string. The signed subword cases must be sign-extended.
const loadValue=(t,offset)=>{
	const at=n=>`offset=${offset+n} (local.get $frame)`;
	if(t.dynamic) return `(i32.load ${at(0)}) (i32.load ${at(4)})`;
	const op=t.size<4?"i32.load"+t.size*8+"_"+(t.wat.startsWith("s")?"s":"u"):t.flat[0]+".load";
	return `(${op} ${at(0)})`;
};

/**
 * Bind Wasm responders to the *same* request resources and allowance sites as
 * the compiled native task. This component is private to the store owner. A
 * guest registration is nominal per signature and can be reused at several
 * binders (including ones with different limits). Requests never can.
 *
 * @param model - The authenticated result of compileWitTaskResources.
 */
export const canonicalCallbackBindings=model=>{
	if(model.methods.length!==model.wire.methods.length) throw new TypeError("Missing native task method");
	const signatures=[],sites=[],unique=new Set();
	for(const [method,m] of model.methods.entries()) for(const r of checkedWitCallbackSites(m,model.wire.methods[method]))
	{
		const arg=canonicalValue({kind: "primitive",name: r.arg}),reply=canonicalValue({kind: "primitive",name: r.reply});
		if(!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(r.resource) || unique.has(r.resource)
			|| r.read!=="read-"+r.resource || r.resolve!=="reply-"+r.resource || r.reject!=="fail-"+r.resource)
			throw new TypeError("Invalid nominal WIT callback request");
		unique.add(r.resource);
		const name="callback-"+r.arg+"-to-"+r.reply;
		let s=signatures.find(v=>v.name===name);
		if(!s)
		{
			s={name,arg,reply,id: signatures.length,carrier: {arg: r.arg,reply: r.reply}};
			signatures.push(s);
		}
		sites.push({method,request: r,signature: s.id,id: sites.length});
	}
	if(!sites.length) throw new TypeError("Expected at least one retained WIT callback");
	const providerWit="interface callbacks {\n"+signatures.map(s=>
		`  resource ${s.name};\n  retain-${s.name}: func(value: borrow<${s.name}>) -> own<${s.name}>;\n`
		+`  invoke-${s.name}: func(self: borrow<${s.name}>, value: ${s.arg.wit}) -> result<${s.reply.wit}, string>;`).join("\n")+"\n}";
	const providerType=signatures.map(s=>`
    (export "${s.name}" (type $reg${s.id} (sub resource)))
    (export "retain-${s.name}" (func (param "value" (borrow $reg${s.id})) (result (own $reg${s.id}))))
    (export "invoke-${s.name}" (func (param "self" (borrow $reg${s.id})) (param "value" ${s.arg.wat})
      (result ${canonicalResult(s.reply,canonicalString).wat})))`).join("");
	const nativeType=sites.map(({request: r,id,signature})=>{
		const {arg,reply}=signatures[signature];
		return `(export "${r.resource}" (type $req${id} (sub resource)))
    (export "${r.read}" (func (param "request" (borrow $req${id})) (result ${arg.wat})))
    (export "${r.resolve}" (func (param "request" (own $req${id})) (param "value" ${reply.wat}) (result bool)))
    (export "${r.reject}" (func (param "request" (own $req${id})) (param "message" string) (result bool)))`;
	}).join("\n    ");
	const wat=`(component
  (import "native" (instance $native ${nativeType})) (import "callbacks" (instance $callbacks ${providerType}))
  ${signatures.map(s=>`(alias export $callbacks "${s.name}" (type $reg${s.id}))\n  `
			+canonicalCallbackResponder(s.carrier)
				.replace("(component", "(component $sig"+s.id)).join("\n  ")}
  ${sites.map(({request: r,id,signature: j})=>`(alias export $native "${r.resource}" (type $req${id}))
  (instance $site${id} (instantiate $sig${j} (with "registration" (type $reg${j})) (with "request" (type $req${id}))
    (with "invoke" (func $callbacks "invoke-${signatures[j].name}")) (with "read" (func $native "${r.read}"))
    (with "resolve" (func $native "${r.resolve}")) (with "reject" (func $native "${r.reject}"))))
  (export "dispatch-${r.resource}" (func $site${id} "dispatch"))`).join("\n  ")}
)`;
	// The actual checked task component owns the request types. Importing an
	// identically shaped second host interface would create different resources.
	const graph=`(component
  (import "${model.importName}" (instance $native ${model.nativeType}))
  (import "callbacks" (instance $provider ${providerType}))
  ${model.wat.replace("(component","(component $tasks")}
  (instance $tasks (instantiate $tasks (with "${model.importName}" (instance $native))))
  (alias export $tasks "${model.exportName}" (instance $api))
  ${wat.replace("(component","(component $responders")}
  (instance $dispatchers (instantiate $responders (with "native" (instance $api)) (with "callbacks" (instance $provider))))
  (export "tasks" (instance $api)) (export "dispatchers" (instance $dispatchers)))`;
	return {signatures,sites,providerWit,providerType,wat,graph};
};

/**
 * One nominal request from compileWitTaskResources. Reading it borrows;
 * exactly one of resolve/reject consumes it, even if its task was canceled
 * and settlement returns false. Registration lifetime and call allowance
 * belong to the task, not to this adapter or the reusable signature.
 *
 * @param request - Reconciled callback argument and result scalar names.
 */
export const canonicalCallbackResponder=request=>{
	const arg=canonicalValue({kind: "primitive",name: request.arg});
	const reply=canonicalValue({kind: "primitive",name: request.reply});
	const result=canonicalResult(reply,canonicalString);
	const input=`(param "request" (borrow $request)) (result ${arg.wat})`;
	const invoke=`(param "self" (borrow $registration)) (param "value" ${arg.wat}) (result ${result.wat})`;
	const resolve=`(param "request" (own $request)) (param "value" ${reply.wat}) (result bool)`;
	const reject='(param "request" (own $request)) (param "message" string) (result bool)';
	const fns=[["read",input,arg.dynamic?"(param i32 i32)":`(param i32) (result ${arg.flat[0]})`]
		, ["invoke",invoke,`(param i32 ${arg.flat.join(" ")} i32)`]
		, ["resolve",resolve,`(param i32 ${reply.flat.join(" ")}) (result i32)`]
		, ["reject",reject,"(param i32 i32 i32) (result i32)"]];
	const captured=arg.dynamic?loadValue(arg,8):"(call $read (local.get $req))";
	const options='(memory $mem "m") (realloc (func $mem "realloc"))';
	return `(component
  (import "registration" (type $registration (sub resource)))
  (import "request" (type $request (sub resource)))
  ${fns.map(([n,t])=>`(import "${n}" (func $${n} ${t}))`).join("\n  ")}
  ${canonicalArena(65536,1)}
  (core instance $mem (instantiate $mem))
  ${fns.map(([n])=>`(core func $${n} (canon lower (func $${n}) ${options}))`).join("\n  ")}
  (core func $end (canon resource.drop $registration))
  (core module $body
    (import "" "m" (memory 1))
    (import "" "select" (func $select (param i32)))
    (import "" "release" (func $release (param i32)))
    (import "" "end" (func $end (param i32)))
    ${fns.map(([n,,t])=>`(import "" "${n}" (func $${n} ${t}))`).join("\n    ")}
    (global $depth (mut i32) (i32.const 0))
    (func (export "dispatch") (param $reg i32) (param $req i32) (result i32)
      (local $frame i32) (local $settled i32)
      (if (i32.ge_u (global.get $depth) (i32.const 64)) (then unreachable))
      (local.set $frame (i32.add (i32.const 1024) (i32.shl (global.get $depth) (i32.const 6))))
      (global.set $depth (i32.add (global.get $depth) (i32.const 1)))
      (call $select (local.get $frame))
      ${arg.dynamic?"(call $read (local.get $req) (i32.add (local.get $frame) (i32.const 8)))":""}
      (call $invoke (local.get $reg) ${captured} (i32.add (local.get $frame) (i32.const 24)))
      (local.set $settled (if (result i32) (i32.load8_u offset=24 (local.get $frame))
        (then (call $reject (local.get $req) ${loadValue(canonicalString,24+result.align)}))
        (else (call $resolve (local.get $req) ${loadValue(reply,24+result.align)}))))
      (call $end (local.get $reg))
      (call $release (local.get $frame))
      (global.set $depth (i32.sub (global.get $depth) (i32.const 1)))
      (call $select (select (i32.sub (local.get $frame) (i32.const 64)) (i32.const 12) (global.get $depth)))
      (local.get $settled)))
  (core instance $body (instantiate $body (with "" (instance
    (export "m" (memory $mem "m")) (export "select" (func $mem "select")) (export "release" (func $mem "release"))
    (export "end" (func $end)) ${fns.map(([n])=>`(export "${n}" (func $${n}))`).join(" ")}))))
  (func (export "dispatch") (param "registration" (borrow $registration)) (param "request" (own $request))
    (result bool) (canon lift (core func $body "dispatch"))))`;
};
