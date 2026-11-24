/** @file Project a checked owner-agent host-object component as an npm ESM and TypeScript API. */
import {javaScriptHostMembers} from "./host-members.mjs";
import {javaScriptHostIOAbi} from "../../abi/component-host-io.mjs";
import {javaScriptTaskAbi} from "../../abi/javascript-wasm-tasks.mjs";

const q=JSON.stringify;
const ts=t=>typeof t==="number"?"_I"+t:Array.isArray(t)?"(Readonly<{ok: "+ts(t[0])+"}> | Readonly<{error: "+ts(t[1])+"}>)"
	:({unit: "undefined",bool: "boolean",char: "string",string: "string"
		, bytes: "Uint8Array"
		, nat: "bigint",int: "bigint",int64: "bigint",uint64: "bigint"})[t]??"number";
const params=(args,names=[],render=ts)=>args.map((t,i)=>(/^[a-z][a-z0-9_]*$/u.test(names[i]??"")?"arg_"+names[i]:"arg"+i)+": "+render(t,i)).join(", ");

/**
 * The caller supplies actual application classes, so a returned nominal is
 * the inferred instance type, not a generated wrapper or raw handle. Only
 * the runtime's declared-error branch constructs a package error.
 *
 * @param api - Compiler-elaborated public IR.
 * @param ir - Authored host-member declarations.
 * @param identity - Compiled component identity.
 * @param options - Select task delivery and an asynchronously draining binding.
 */
export const generateJavaScriptHostPackage = (api,ir,identity,options={}) => {
	const threaded=options.threaded===true;
	const abi=threaded?javaScriptTaskAbi(api,identity,ir):javaScriptHostIOAbi(api,ir,identity),{kinds,members}=javaScriptHostMembers(ir);
	const js=['import {runtime} from "./internal/runtime.mjs";'],dts=[],names=new Set(["withHosts"]);
	const ids=kinds.map((_,i)=>"_I"+i),args="<"+ids.join(", ")+">",bases=kinds.map((_,i)=>ids[i]+" extends _Host"+i+args);
	const errors=[];
	const render=t=>Array.isArray(t)?"(Readonly<{ok: "+render(t[0])+"}> | Readonly<{error: "+render(t[1])+"}>)"
		: typeof t==="string" && t.startsWith("host:")?"_I"+abi.hostKinds.find(k=>k.type===t).index
			: typeof t==="string" && t.startsWith("lease:")?abi.leases.find(k=>k.type===t).name:ts(t);
	for(const r of abi.leases??[])
	{
		if(names.has(r.name) || !/^[A-Za-z][A-Za-z0-9_]*$/u.test(r.name)) throw new Error("Conflicting task resource "+r.name);
		names.add(r.name);js.push("export const "+r.name+"=runtime.resourceClass("+q(r.type)+");");
		dts.push("export interface "+r.name+" extends importLease<"+q(r.hash)+"> {}","export declare const "+r.name+": {readonly prototype: "+r.name+"};");
	}
	if(abi.leases?.length) dts.unshift('import type {LeanTaskLease as importLease} from "@lean-bridge/runtime";');
	for(const e of api.errors)
	{
		if(threaded)
		{
			if(e.id==="error:JavaScriptHostException") continue;
			const cb=e.id==="error:JavaScriptCallbackError",m=abi.methods.find(m=>[m.startId,m.terminalId].includes(e.id));
			if(!cb && !m || !/^[A-Z][A-Za-z0-9_]*$/u.test(e.name) || names.has(e.name)) throw new Error("Invalid threaded host error: "+e.name);
			const payload=e.payload?render(m.startId===e.id?m.error:m.terminal):null;
			const generic=payload && /_I\d+/u.test(payload)?"<"+ids.map(i=>i+" extends object = object").join(", ")+">":"";
			names.add(e.name);errors.push([e.id,e.name]);
			js.push("export class "+e.name+" extends globalThis.Error {",
				"  constructor(failure) { const {payload,phase}=failure.details; super("+(!payload&&!cb?"payload":q(e.documentation.summary))+",{cause:"+(cb?"payload":"failure")+"}); this.name="+q(e.name)+"; this.code="+q(e.id)+"; this.phase=phase;"+(payload?" this.payload=payload;":"")+" }","}");
			dts.push("export declare class "+e.name+generic+" extends Error {","  private constructor();","  readonly code: "+q(e.id)+";"
				,'  readonly phase: '+(cb?'"factory" | "task"':'"call" | "factory" | "task" | "step"')+";",...payload?["  readonly payload: "+payload+";"]:[],"}");
			continue;
		}
		const m=abi.methods.find(method=>method.errorId===e.id);
		if(!m) continue; // Unchanged host exceptions are delivered as-is, with no wrapper.
		if(!/^[A-Z][A-Za-z0-9_]*$/u.test(e.name) || names.has(e.name)) throw new Error("Conflicting public host error "+e.name);
		names.add(e.name);errors.push([e.id,e.name]);
		const io=m.effect==="IO", typed=!io && /_I\d+/u.test(ts(m.error));
		js.push("export class "+e.name+" extends globalThis.Error {",
			"  constructor(payload) { super("+ (io?"payload":q(e.documentation.summary))+"); this.name="+q(e.name)+"; this.code="+q(e.id)+";"+(io?"":" this.payload=payload;")+" }","}");
		const generics=typed?"<"+ids.map(id=>id+" extends object = object").join(", ")+">":"";
		dts.push("export declare class "+e.name+generics+" extends globalThis.Error {",
			"  readonly code: "+q(e.id)+";", ...io?[]:["  readonly payload: "+ts(m.error)+";"],
			"  constructor(payload: "+(io?"string":ts(m.error))+");","}");
	}
	js.push("const errors = new Map(["+errors.map(([id,name])=>"["+q(id)+","+name+"]").join(",")+"]);",
		"export function withHosts(classes) { return runtime.withHosts(classes, "+(threaded?"failure => new (errors.get(failure.details.errorId))(failure)":"(id, payload) => new (errors.get(id))(payload)") + "); }");
	const constructorTypes=[];
	for(const [i,k] of kinds.entries())
	{
		const instance=[],statics=["readonly prototype: "+ids[i]+";"];
		for(const m of members.filter(row=>row.owner===i))
		{
			const name=q(m.name), self=["method","get","set"].includes(m.op), values=self?m.args.slice(1):m.args;
			if(m.op==="constructor") statics.push("new ("+params(values)+"): "+ids[i]+";");
			else if(m.op==="get") instance.push("get "+name+"(): "+ts(m.result)+";");
			else if(m.op==="set") instance.push("set "+name+"("+params(values)+");");
			else (self?instance:statics).push(name+"("+params(values)+"): "+(m.result==="unit"?"void":ts(m.result))+";");
		}
		dts.push("interface _Host"+i+args+" { "+instance.join(" ")+" }");
		constructorTypes.push("readonly "+q(k.name)+": Function & { "+statics.join(" ")+" };");
	}
	dts.push("export declare function withHosts<"+bases.join(", ")+">(classes: { "+constructorTypes.join(" ")+" }): {");
	for(const [i,m] of abi.methods.entries())
	{
		const value=render(m.result),result=m.delivery==="task"?"Promise<"+value+"> & {cancel(): boolean}"
			:m.delivery==="async-iterator"?"AsyncIterableIterator<"+value+"> & {return(value?: unknown): Promise<IteratorResult<"+value+">>}":value;
		const arg=(t,j)=>{
			if(t!=="callback")return render(t);
			const [,a,r]=m.callbacks.find(([i])=>i===j),reply=r==="unit"?"void":render(r);
			return "(value: "+render(a)+") => "+reply+" | PromiseLike<"+reply+">";
		};
		dts.push("  "+q(m.name)+"("+params(m.args,api.declarations[i].parameters.map(p=>p.name),arg)+"): "+result+";");
	}
	dts.push("  dispose(): "+(threaded?"Promise<void>":"boolean")+";","};");
	const metadata={type: "module",sideEffects: true,types: "./index.d.ts"
		, exports: {".": {types: "./index.d.ts",import: "./index.mjs",default: "./index.mjs"}}
		, files: ["index.mjs","index.d.ts","README.md","binding-manifest.json","internal"]};
	return {"index.mjs": js.join("\n")+"\n","index.d.ts": dts.join("\n")+"\n"
		, "binding-manifest.json": JSON.stringify({schemaVersion: 1
			, component: api.component.id,bindingIrSha256: abi.bindingIrSha256
			, hostIrSha256: abi.hostIrSha256
			, exports: [...names]
			, boundMethods: abi.methods.map(m=>m.name)},null,2)+"\n"
		, "README.md": "# "+api.component.name+"\n\nImport `withHosts` and pass your application classes ("+kinds.map(k=>k.name).join(", ")+"). Call the returned methods and release the binding with "+(threaded?"`await binding.dispose()`. One live binding per component can share its runtime with other components.":"`dispose()`.")+" The package loads its shared Wasm runtime automatically.\n"
		, "package.json": JSON.stringify(metadata,null,2)+"\n"};
};
