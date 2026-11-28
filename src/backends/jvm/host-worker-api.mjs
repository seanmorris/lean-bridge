/** @file Typed Java futures, Kotlin suspend functions and demand-driven streams with host-class carriers. */
import { canonicalJson } from "../../capsule/node.mjs";
import { jvmWorkerKinds } from "./host-members.mjs";
import { jvmIOIdentifier, jvmWorkerScalarInput, jvmWorkerScalarOutput, jvmWorkerScalarType } from "./sync-io.mjs";

const fail = message => { throw new TypeError("Invalid JVM worker contract: " + message); };
const host = t => Array.isArray(t) ? t.some(host) : typeof t === "string" && t.startsWith("host:");
const same = (a,b) => canonicalJson(a)===canonicalJson(b);
/**
 * Render only methods whose runtime shape agrees with the independently
 * checked public interface. Scalar-only workers have no application binding.
 *
 * @param o - Checked public IR, class contract, native wire and Java error emitter.
 */
export const jvmHostWorkerApi = o => {
	const { api, ir, ns, wire, evidence, names, errorClass } = o;
	const byType=new Map(), byId=new Map(), kinds=jvmWorkerKinds(ir);
	if(!wire.wait || !wire.methods.length || wire.leases?.length!==kinds.length || !/^[a-f0-9]{64}$/u.test(evidence.ledgerId)
		|| !/^[a-f0-9]{64}$/u.test(evidence.libraries["liblb_task_resources_"+evidence.ledgerId+".so"])) fail("unauthenticated ledger");
	for(const [i,k] of kinds.entries())
	{
		const w=wire.leases[i], h="host:"+k.hash;
		if(!w.host || w.type!==h || w.hash!==k.hash || w.tag!==3+i || w.name!==k.name || w.symbol!==wire.clear.slice(0,-6)+"_lease_"+i) fail("class "+k.name);
		byId.set(k.id,h); byType.set(h,i);
	}
	const shape = r => {
		if(r?.kind==="primitive") return r.name;
		if(r?.kind==="named" && byId.has(r.id)) return byId.get(r.id);
		if(r?.kind==="apply" && r.constructor==="result" && r.arguments.length===2) return r.arguments.map(shape);
		return fail("unsupported public type");
	};
	const site=(ref,t)=>{
		if(!same(shape(ref?.type),t) || ref.ownership!==(host(t)?"lease":"copy")
			|| (host(t) ? ref.lifetime?.scope!=="explicit" || ref.lifetime.anchor!==null : ref.lifetime!==null)) fail("worker ownership");
	};
	const type=(t,kotlin=false,inner=false)=>{
		if(Array.isArray(t)) return (kotlin?ns+".":"")+"Result<"+t.map(v=>type(v,kotlin,true)).join(",")+">";
		return byType.has(t)?"T"+byType.get(t):jvmWorkerScalarType(t,ns,kotlin,inner);
	};
	const encode=(t,j,v)=>byType.has(t)?`f.host.input(${j},type${byType.get(t)},${v});`:jvmWorkerScalarInput(t,j,v);
	const decode=(t,depth=0)=>Array.isArray(t)?`(f.tag(${depth}) ? new Result.Ok<>(${decode(t[0],depth+1)}) : new Result.Err<>(${decode(t[1],depth+1)}))`
		:byType.has(t)?`f.host.output(type${byType.get(t)})`:jvmWorkerScalarOutput(t);
	const direct=[], bound=[], ktDirect=[], ktBound=[];
	for(const [i,m] of wire.methods.entries())
	{
		const d=api.declarations.find(x=>x.source.declaration===m.declaration), stream=m.delivery==="async-iterator", name=jvmIOIdentifier(m.name);
		if(!d || d.name!==m.name || d.resultMode!==(stream?"async-iterator":"promise") || (!stream && m.delivery!=="task")
			|| names.has(name) || !/^[a-z][a-zA-Z0-9_]*$/u.test(name) || m.args.length!==d.parameters.length) fail(m.declaration);
		names.add(name); site(d.result,m.result);
		const ext=d.source.extensions, decl=JSON.stringify(m.declaration), slots=new Map();
		if(ext["lean-lang.org/effect"]!==m.effect) fail("effect");
		for(const [j,a,b] of m.callbacks??[])
		{
			const param=d.parameters[j], t=api.types.find(x=>x.id===param?.type?.id), cb=t?.callable;
			if(stream || slots.has(j) || m.args[j]!=="callback" || param.ownership!=="lease" || param.lifetime?.scope!=="explicit"
				|| t.kind!=="callback" || t.source.extensions["lean-bridge.dev/callback-scheduler"]!=="jvm-virtual-thread"
				|| cb?.invocation!=="many" || cb.selfDisposal!=="defer" || cb.reentry!=="same-agent" || cb.resultMode!=="value"
				|| cb.parameters.length!==1 || cb.failure.unexpected!=="poison-runtime" || !same(cb.failure.errors,["error:JvmCallbackException"])) fail("retained callback");
			site(cb.parameters[0],a); site(cb.result,b);
			const input=a!=="unit", output=b!=="unit", ja=type(a,false,true), jb=type(b,false,true);
			const java=input?output?`java.util.function.Function<${ja},${jb}>`:`java.util.function.Consumer<${ja}>`:output?`java.util.function.Supplier<${jb}>`:"Runnable";
			const k="("+(input?type(a,true):"")+") -> "+(output?type(b,true):"kotlin.Unit");
			const invoke="a"+j+"."+(input?output?"apply(v)":"accept(v)":output?"get()":"run()");
			const fn=output?invoke:"{ "+invoke+"; return Unit.INSTANCE; }";
			slots.set(j,{java,k,bind: `CallbackPort.<${ja},${jb}>bind(f->${decode(a)},v->${fn},(f,v)->{ ${encode(b,0,"v")} })`});
		}
		m.args.forEach((t,j)=>{ if(t==="callback" && !slots.has(j)) fail("callback slot"); if(!slots.has(j)) site(d.parameters[j],t); });
		const scoped=[m.args,m.result,m.error,m.terminal,m.callbacks??[]].some(host);
		const error=(id,t,field,suffix,source)=>{
			const ref=api.errors.find(e=>e.id===id)?.payload;
			if(!d.failure.errors.includes(id) || !same(shape(ref),t)) fail(id);
			if(host(t)) site(ext[field],t); else if(Object.hasOwn(ext,field)) fail(field);
			const ex=name[0].toUpperCase()+name.slice(1)+suffix;
			errorClass(ex,ref,source); return `if (status==3) throw new ${ex}(${decode(t)});`;
		};
		const start=m.effect==="EIO"?error("error:EIO."+m.declaration,m.error,"lean-bridge.dev/error-payload-site","Error",decl)
			:m.effect==="IO"?`if (status==${slots.size?13:4}) throw new LeanIOException(${decl},f.text());`:"";
		let terminal="";
		if(stream)
		{
			if(m.stepDeclaration!==ext["lean-bridge.dev/pull-protocol"]?.next || Boolean(m.stepIO)!==(ext["lean-bridge.dev/step-failure"]==="IO.Error")) fail("cursor step");
			const id="error:AsyncStep."+m.declaration, step=JSON.stringify(m.stepDeclaration);
			if(m.stepIO)
			{
				if(m.terminal!=="string" || !d.failure.errors.includes(id) || api.errors.find(e=>e.id===id)?.payload!==null) fail(id);
				terminal=`if (status==4) throw new LeanIOException(${step},f.text());`;
			}
			else if(m.terminal) terminal=error(id,m.terminal,"lean-bridge.dev/step-error-payload-site","StepError",step);
		}
		else if(ext["lean-bridge.dev/task-failure"]==="IO.Error") terminal=`if (status==4) throw new TaskIOException(${decl},f.text());`;
		const args=m.args.map((t,j)=>(slots.get(j)?.java??type(t))+" a"+j).join(", ");
		const params=d.parameters.map(p=>p.name);
		if(params.some(s=>!/^[a-z][a-z0-9_]*$/u.test(s)) || new Set(params).size!==params.length) fail("parameter names");
		const esc=s=>"\u0060"+s+"\u0060", ktArgs=params.map((s,j)=>esc(s)+": "+(slots.get(j)?.k??type(m.args[j],true))).join(", ");
		const call=(scoped?"binding":ns+".Api")+"."+esc(name)+"("+params.map(esc).join(",")+")";
		const value=type(m.result,false,true), unit=m.result==="unit", kt=unit?"kotlin.Unit":type(m.result,true);
		const bytes=stream?m.args.flatMap((t,j)=>t==="bytes"?[j]:[]):[];
		const freeze=bytes.length?"int remaining=16*1024*1024; "+bytes.map(j=>`if(a${j}.length>remaining) throw new IllegalArgumentException("Lean conversion limit exceeded"); remaining-=a${j}.length;`).join(" ")+" "+bytes.map(j=>`var copy${j}=a${j}.clone();`).join(" "):"";
		const init=m.args.map((t,j)=>slots.has(j)?"java.util.Objects.requireNonNull(a"+j+");":encode(t,j,(bytes.includes(j)?"copy":"a")+j)).join(" ");
		const take=`${stream?"if(status==2) return null;":""} ${terminal} Wire.success(status); return ${decode(m.result)};`;
		const port=slots.size?`new CallbackPort<${value}>(${i},${m.args.length},${m.tagBytes},f->{ ${init} },(f,status,state)->{ if(status==14) throw state.original(f.scalar()); ${start} ${take} },new CallbackPort.Slot[]{${m.args.map((_,j)=>slots.get(j)?.bind??"null").join(",")}})`
			:`new TaskPort<${value}>(${i},${m.args.length},${m.tagBytes}, f->{ ${init} },(f,status)->{ ${start} Wire.success(status); },(f,status)->{ ${take} })`;
		const expr=stream?(scoped?"scope":"Delivery")+".stream(()->"+port+")":"Delivery.task("+port+(scoped?".bound(scope)":"")+")";
		(scoped?bound:direct).push(`        public ${scoped?"":"static "}java.util.concurrent.${stream?"Flow.Publisher":"CompletableFuture"}<${value}> ${name}(${args}) {
            ${freeze} return ${expr};
        }`);
		const kbody=stream?" = "+call+".asLeanFlow()"+(unit?".map { kotlin.Unit }":""):unit?" { "+call+".await() }":" = "+call+".await()";
		(scoped?ktBound:ktDirect).push(`    ${scoped?"":"@JvmStatic "}${stream?"":"suspend "}fun ${esc(name)}(${ktArgs}): ${stream?"kotlinx.coroutines.flow.Flow<"+kt+">":kt}${kbody}`);
	}
	return {direct,bound,ktDirect,ktBound};
};
