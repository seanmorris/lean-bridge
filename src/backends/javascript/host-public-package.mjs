/** @file Project a checked owner-agent host-object component as an npm ESM and TypeScript API. */
import {javaScriptHostMembers} from "./host-members.mjs";
import {javaScriptHostIOAbi} from "../../abi/component-host-io.mjs";

const q=JSON.stringify;
const ts=t=>typeof t==="number"?"_I"+t:Array.isArray(t)?"(Readonly<{ok: "+ts(t[0])+"}> | Readonly<{error: "+ts(t[1])+"}>)"
	:({unit: "undefined",bool: "boolean",char: "string",string: "string"
		, bytes: "Uint8Array"
		, nat: "bigint",int: "bigint",int64: "bigint",uint64: "bigint"})[t]??"number";
const params=(args,names=[])=>args.map((t,i)=>(/^[a-z][a-z0-9_]*$/u.test(names[i]??"")?"arg_"+names[i]:"arg"+i)+": "+ts(t)).join(", ");

/**
 * The caller supplies actual application classes, so a returned nominal is
 * the inferred instance type, not a generated wrapper or raw handle. Only
 * the runtime's declared-error branch constructs a package error.
 *
 * @param api - Compiler-elaborated public IR.
 * @param ir - Authored host-member declarations.
 * @param identity - Compiled component identity.
 */
export const generateJavaScriptHostPackage = (api,ir,identity) => {
	const abi=javaScriptHostIOAbi(api,ir,identity),{kinds,members}=javaScriptHostMembers(ir);
	const js=['import {runtime} from "./internal/runtime.mjs";'],dts=[],names=new Set(["withHosts"]);
	const ids=kinds.map((_,i)=>"_I"+i),args="<"+ids.join(", ")+">",bases=kinds.map((_,i)=>ids[i]+" extends _Host"+i+args);
	const errors=[];
	for(const e of api.errors)
	{
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
		"export function withHosts(classes) { return runtime.withHosts(classes, (id, payload) => new (errors.get(id))(payload)); }");
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
		dts.push("  "+q(m.name)+"("+params(m.args,api.declarations[i].parameters.map(p=>p.name))+"): "+ts(m.result)+";");
	dts.push("  dispose(): boolean;","};");
	const metadata={type: "module",sideEffects: true,types: "./index.d.ts"
		, exports: {".": {types: "./index.d.ts",import: "./index.mjs",default: "./index.mjs"}}
		, files: ["index.mjs","index.d.ts","README.md","binding-manifest.json","internal"]};
	return {"index.mjs": js.join("\n")+"\n","index.d.ts": dts.join("\n")+"\n"
		, "binding-manifest.json": JSON.stringify({schemaVersion: 1
			, component: api.component.id,bindingIrSha256: abi.bindingIrSha256
			, hostIrSha256: abi.hostIrSha256
			, exports: [...names]
			, boundMethods: abi.methods.map(m=>m.name)},null,2)+"\n"
		, "README.md": "# "+api.component.name+"\n\nImport `withHosts` and pass your application classes ("+kinds.map(k=>k.name).join(", ")+"). Call the returned methods and release the binding with `dispose()`. The package loads its shared Wasm runtime automatically.\n"
		, "package.json": JSON.stringify(metadata,null,2)+"\n"};
};
