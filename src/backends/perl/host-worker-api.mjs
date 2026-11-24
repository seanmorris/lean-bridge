/** @file Render class-bearing XS and Perl scheduler methods from the checked CPAN interface. */
import { canonicalJson } from "../../capsule/node.mjs";
import { projectPerlNames } from "./naming.mjs";
import { perlWorkerScalarCodecs } from "./sync-io.mjs";
import { taskDeclarations, taskModules, taskXs } from "./task-xs.mjs";

const fail=s=>{ throw new TypeError("Invalid Perl object worker: "+s); };
const same=(a,b)=>canonicalJson(a)===canonicalJson(b);
const host=t=>Array.isArray(t)?t.some(host):typeof t==="string" && t.startsWith("host:");
/**
 * Match the carrier at every argument, success, callback and declared failure
 * before generating XS. A scalar-only method does not require with_hosts.
 *
 * @param o - Compiler-authenticated wire, import kinds and public Binding IR.
 */
export const perlHostWorkerApi=({api,wire,kinds,name,assets})=>{
	const methods=projectPerlNames(name,wire.methods), byId=new Map(), byType=new Map();
	if(!wire.wait || wire.leases?.length!==kinds.length) fail("lease ledger");
	for(const [i,k] of kinds.entries())
	{
		const r=wire.leases[i], label="host:"+k.hash;
		if(!r.host || r.name!==k.name || r.tag!==i+3 || r.hash!==k.hash || r.type!==label || r.symbol!==wire.clear.slice(0,-6)+"_lease_"+i) fail(k.name);
		byId.set(k.id,label); byType.set(label,i);
	}
	const type=r=>{
		if(r?.kind==="primitive") return r.name;
		if(r?.kind==="named" && byId.has(r.id)) return byId.get(r.id);
		if(r?.kind==="apply" && r.constructor==="result" && r.arguments.length===2) return r.arguments.map(type);
		return fail("unrecognized public type");
	};
	const site=(p,t)=>{
		if(!same(type(p?.type),t) || p.ownership!==(host(t)?"lease":"copy")
			|| (host(t)?p.lifetime?.scope!=="explicit" || p.lifetime.anchor!==null:p.lifetime!==null)) fail("worker ownership");
	};
	const scalar=perlWorkerScalarCodecs();
	const input=(t,i)=>byType.has(t)?`phw_input(aTHX_ ${byType.get(t)},v${i},a+${i*3});`:scalar.input(t,i);
	const value=(t,ns,i=0)=>Array.isArray(t)
		?`(tags[${i}]==1 ? lbp_branch(aTHX_ "${ns}::Ok",${value(t[0],ns,i+1)}) : tags[${i}]==0 ? lbp_branch(aTHX_ "${ns}::Err",${value(t[1],ns,i+1)}) : (croak("Invalid native Except tag"),&PL_sv_undef))`
		:byType.has(t)?`phw_output(aTHX_ ${byType.get(t)},out)`:scalar.value(t,ns,i);
	const xs=[],scoped=new Set(), names=new Set(api.declarations.filter(d=>d.resultMode==="value").map(d=>d.name));
	for(const [i,m] of methods.entries())
	{
		const d=api.declarations.find(d=>d.source.declaration===m.declaration), stream=m.delivery==="async-iterator";
		if(!d || d.name!==m.publicName || d.name!==m.name || m.name==="with_hosts" || names.has(m.name)
			|| d.resultMode!==(stream?"async-iterator":"promise") || (!stream && m.delivery!=="task")
			|| m.args.length!==d.parameters.length) fail(m.declaration);
		names.add(m.name); const ext=d.source.extensions, errors=new Set(), slots=new Set();
		if(m.effect!==ext["lean-lang.org/effect"]) fail("effect");
		for(const [j,a,b] of m.callbacks??[])
		{
			const p=d.parameters[j], t=api.types.find(x=>x.id===p?.type?.id), c=t?.callable;
			if(stream || slots.has(j) || m.args[j]!=="callback" || p?.ownership!=="lease" || p.lifetime?.scope!=="explicit" || p.lifetime.anchor!==null
				|| t?.source.extensions["lean-bridge.dev/callback-scheduler"]!=="owner-event-loop"
				|| c?.invocation!=="many" || c.reentry!=="same-agent" || c.selfDisposal!=="defer" || c.resultMode!=="value"
				|| c.parameters.length!==1 || c.failure.mode!=="declared" || c.failure.unexpected!=="poison-runtime"
				|| !same(c.failure.errors,["error:PerlCallbackException"])) fail("retained callback");
			site(c.parameters[0],a); site(c.result,b); slots.add(j);
		}
		m.args.forEach((a,j)=>{ if(!slots.has(j)) site(d.parameters[j],a); }); site(d.result,m.result);
		const typed=(id,t,field)=>{
			errors.add(id);
			if(!same(type(api.errors.find(e=>e.id===id)?.payload),t)) fail(id);
			if(host(t)) site(ext[field],t); else if(Object.hasOwn(ext,field)) fail(field);
		};
		if(m.effect==="EIO") typed("error:EIO."+m.declaration,m.error,"lean-bridge.dev/error-payload-site");
		else if(m.effect==="IO") errors.add("error:IO.Error");
		const terminal=ext["lean-bridge.dev/task-failure"]==="IO.Error";
		if(terminal) errors.add("error:TaskIO.Error");
		if(slots.size && (m.effect==="IO" || terminal)) errors.add("error:PerlCallbackException");
		if(stream)
		{
			if(m.stepDeclaration!==ext["lean-bridge.dev/pull-protocol"]?.next || Boolean(m.stepIO)!==(ext["lean-bridge.dev/step-failure"]==="IO.Error")) fail("cursor step");
			const id="error:AsyncStep."+m.declaration;
			if(m.stepIO)
			{
				if(m.terminal!=="string" || api.errors.find(e=>e.id===id)?.payload!==null) fail(id);
				errors.add(id);
			}
			else if(m.terminal) typed(id,m.terminal,"lean-bridge.dev/step-error-payload-site");
		}
		if(!same([...errors].sort(),[...d.failure.errors].sort())) fail("declared errors");
		const bound=host([m.args,m.result,m.error,m.terminal,m.callbacks??[]]);
		const commit=(t,j)=>byType.has(t)?`phw_admit(aTHX_ ${byType.get(t)},a+${3*j});`:"";
		const replies=(m.callbacks??[]).filter(([, ,t])=>byType.has(t));
		const scope=bound?{enter: " lbp_host_enter(aTHX_ ph_session);"
			, start: " phw_track(aTHX_ o); "+m.args.map(commit).join(" ")
			, reply: replies.map(([slot,,t])=>`if (slot==${slot}) { ${commit(t,0)} } `).join("")}:null;
		if(bound) scoped.add(m.name);
		xs.push(taskXs(m,name,i,input,value,scope));
	}
	return {prelude: `extern void ${wire.clear}(uint64_t *);\nstatic void lbs_clear(pTHX_ void *frame) { ${wire.clear}((uint64_t *)frame); Safefree(frame); }\n${taskDeclarations(wire)}\n`
		, xs: xs.join("\n"), module: assets.scopeModule.replaceAll("__LBNS__",name)+"\n"+taskModules(name,methods,assets,scoped)};
};
