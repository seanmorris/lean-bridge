/** @file Project compiler-checked worker carriers to the application's actual CLR classes. */
import { canonicalJson } from "../../capsule/node.mjs";
import { dotnetWorkerKinds } from "./host-members.mjs";
import { dotnetScalarArgument, dotnetScalarResult, dotnetScalarType, dotnetTaskParameters, renderDotnetTaskMethod } from "./sync-io.mjs";

const fail=what=>{throw new TypeError("Invalid CLR worker contract: "+what);};
const same=(a,b)=>canonicalJson(a)===canonicalJson(b);
const includesHost=t=>Array.isArray(t)?t.some(includesHost):typeof t==="string"&&t.startsWith("host:");
/**
 * Resolve every public parameter, thrown payload and callback against the
 * authored nominal kinds, not a generated method name or an untyped handle.
 *
 * @param o - Compiled task wire, reviewed public IR, captured class declarations and release assets.
 */
export const dotnetHostWorkerApi = o => {
	const {wire,api,ir,assembly,g,constraints,names,evidence,prefix}=o;
	const kinds=dotnetWorkerKinds(ir), byId=new Map(), byWire=new Map();
	if(!wire.wait || !wire.methods.length || wire.leases?.length!==kinds.length || !/^[a-f0-9]{64}$/u.test(evidence.ledgerId)
		|| !evidence.libraries["liblb_task_resources_"+evidence.ledgerId+".so"]) fail("unverified native ledger");
	for(const [i,k] of kinds.entries())
	{
		const w=wire.leases[i], cs="T"+i, h="host:"+k.hash;
		if(!w.host || w.name!==k.name || w.hash!==k.hash || w.type!==h || w.tag!==3+i || w.symbol!==wire.clear.slice(0,-6)+"_lease_"+i) fail(k.id);
		byId.set(k.id,h);byWire.set(h,{cs,i,tag: w.tag});
	}
	const shape=r=>r?.kind==="primitive"?r.name:r?.kind==="named"?byId.get(r.id):r?.kind==="apply" && r.constructor==="result" && r.arguments.length===2?r.arguments.map(shape):null;
	const type=t=>Array.isArray(t)?`Result<${t.map(type).join(",")}>`:byWire.get(t)?.cs??dotnetScalarType(t);
	const decode=(t,n=0)=>{
		if(Array.isArray(t)) return `(Tag(tags[${n}]) ? ${type(t)}.Ok(${decode(t[0],n+1)}) : ${type(t)}.Err(${decode(t[1],n+1)}))`;
		const k=byWire.get(t);return k?`HostWorkerFrame.Output<${k.cs}>(${k.i},${k.tag},output)`:dotnetScalarResult(t);
	};
	const args=(t,v,i)=>byWire.has(t)?`HostWorkerFrame.Input(${byWire.get(t).i},${v},input+${3*i});`:dotnetScalarArgument(t,v,i);
	const codecs={type,args,decode,keep: ()=>"",drain: ""};
	const site=(ref,t)=>{
		if(!ref || !same(shape(ref.type),t)) fail("mismatched carrier");
		const owned=includesHost(t);
		if(ref.ownership!==(owned?"lease":"copy") || (owned ? ref.lifetime?.scope!=="explicit" || ref.lifetime.anchor!==null : ref.lifetime!==null)) fail("mismatched ownership");
	};
	const boundPub=[],staticPub=[],impl=[], declarations=new Set();
	for(const [i,m] of wire.methods.entries())
	{
		const d=api.declarations.find(x=>x.source.declaration===m.declaration),method=m.name.split("_").map(n=>n.charAt(0).toUpperCase()+n.slice(1)).join("");
		if(!d || declarations.has(d.id) || d.name!==m.name || !["task","async-iterator"].includes(m.delivery) || d.resultMode!==(m.delivery==="task"?"promise":m.delivery)
			|| !/^[A-Z][A-Za-z0-9]*$/u.test(method) || names.has(method) || ["Api","BindHosts"].includes(method) || d.parameters.length!==m.args.length) fail(m.name);
		declarations.add(d.id);names.add(method);site(d.result,m.result);
		m.args.forEach((t,j)=>{if(t!=="callback") site(d.parameters[j],t);});
		for(const [j,from,to] of m.callbacks??[])
		{
			const cb=api.types.find(t=>t.id===d.parameters[j]?.type.id)?.callable;
			if(!cb || cb.invocation!=="many") fail("unverified delegate");
			site(cb.parameters[0],from); site(cb.result,to);
		}
		const ext = d.source.extensions;
		const expectedError = (id, t, key) => {
			const error = api.errors.find(e => e.id === id);
			if(!d.failure.errors.includes(id) || !error || !same(shape(error.payload), t)) fail(id);
			if(includesHost(t)) site(ext[key], t);
			else if(Object.hasOwn(ext, key)) fail(key);
		};
		if(ext["lean-lang.org/effect"] !== m.effect) fail("mismatched effect");
		if(m.effect === "EIO") expectedError("error:EIO." + m.declaration, m.error, "lean-bridge.dev/error-payload-site");
		if(m.delivery === "async-iterator")
		{
			if(ext["lean-bridge.dev/pull-protocol"]?.next !== m.stepDeclaration
				|| Boolean(m.stepIO) !== (ext["lean-bridge.dev/step-failure"] === "IO.Error")) fail("mismatched cursor step");
			const id = "error:AsyncStep." + m.declaration;
			if(m.stepIO)
			{
				if(m.terminal !== "string" || !d.failure.errors.includes(id) || api.errors.find(e => e.id === id)?.payload !== null)
					fail("invalid terminal IO failure");
			}
			else if(m.terminal) expectedError(id, m.terminal, "lean-bridge.dev/step-error-payload-site");
		}
		const bound=[m.args,m.result,m.error,m.terminal,m.callbacks??[]].some(includesHost)?{g,constraints}:null;
		const params=d.parameters.map(x=>x.name);
		if(params.some(n=>!/^[a-z][a-z0-9_]*$/u.test(n)) || new Set(params).size!==params.length) fail("parameter names");
		const argTypes=dotnetTaskParameters(m,d,api,type,shape), signature=argTypes.map((t,j)=>t+" @"+params[j]).join(", ");
		const rendered=renderDotnetTaskMethod({m,i,params,argTypes,signature,method,runtimeClass: "global::"+assembly+".Wire",assembly,wire,codecs,bound});
		(bound?boundPub:staticPub).push(rendered.pub);impl.push(rendered.impl);
	}
	const workerImpl = `    private const string WaitOpen="${wire.wait.open}", WaitClose="${wire.wait.close}";
    internal sealed class BoundWorker(HostMembers binding,HostTaskScope scope) {
        internal HostTaskScope Scope => scope;
        internal T Visit<T>(Func<T> body) => scope.Invoke(() => HostWorkerFrame.Run(binding,Symbol("${prefix}_visit"),Symbol("${prefix}_object"),Status,body));
        internal void Visit(Action body) => Visit(() => {body(); return 0;});
    }
${impl.join("\n")}`;
	return { boundPub, staticPub, impl: workerImpl };
};
