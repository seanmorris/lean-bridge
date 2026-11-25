/** @file Generate the application-facing Lean entry module and wasm32 host-call dispatcher. */
import {readFileSync} from "node:fs";
import { componentScalarTypes } from "../../abi/component-scalars.mjs";
import { hostCallMagic, javaScriptHostIOAbi } from "../../abi/component-host-io.mjs";
import { generateJavaScriptHostExterns, javaScriptHostCarrier } from "./host-wasm-externs.mjs";

const qual=/^(?:[A-Za-z][A-Za-z0-9_]*\.)*[A-Za-z][A-Za-z0-9_]*$(?![\s\S])/u;
const scalar={unit: "Unit",bool: "Bool",char: "Char",bytes: "ByteArray"
	, string: "String",nat: "Nat",int: "Int"
	, usize: "USize",isize: "ISize",float32: "Float32",float64: "Float"};
for(const bits of [8,16,32,64]) for(const [key,name] of [["int","Int"],["uint","UInt"]]) scalar[key+bits]=name+bits;
const leaf=t=>typeof t==="number"?64+t:componentScalarTypes.indexOf(t);
/**
 * Project the same checked functions into Lean exports and a private control
 * symbol. The public wire receives actual JS objects while their Lean owner
 * is still live; it never publishes a native pointer or owning buffer.
 *
 * @param options - Captured modules, public and host IR, immutable build identity.
 */
export const generateJavaScriptHostExports = options => {
	const {api,hosts,identity,modules,phpWasm=false}=options, abi=javaScriptHostIOAbi(api,hosts,identity,phpWasm);
	if(!modules?.length || modules.some(m=>!qual.test(m)) || abi.methods.some(m=>!qual.test(m.declaration)))
		throw new TypeError("Invalid Lean export names");
	const imports=generateJavaScriptHostExterns(hosts,identity,{zend: phpWasm}), {prefix}=imports, module="BridgeJsHost"+identity;
	const hostModule=phpWasm?"LeanBridge.Host.Php":"LeanBridge.Host.Javascript";
	const closure=t=>t!==null && typeof t==="object" && !Array.isArray(t);
	const type=t=>closure(t)?"("+type(t.argument)+" → _root_.IO "+type(t.reply)+")":Array.isArray(t)?"(_root_.Except "+type(t[1])+" "+type(t[0])+")"
		:"_root_."+(typeof t==="number"?hostModule+"."+hosts.types[t].name:scalar[t]);
	const nodes=[], byShape=new Map();
	const index=t=>{
		const key=JSON.stringify(t); if(byShape.has(key)) return byShape.get(key);
		const row=Array.isArray(t)?[-1,index(t[0]),index(t[1])]:[leaf(t),0,0];
		const i=nodes.length; nodes.push(row);byShape.set(key,i);return i;
	};
	const stringNode=index("string"), leans=[], headers=[], wires=[], cases=[];
	const total=abi.methods.length, functions=abi.methods.some(m=>closure(m.result));
	for(const [i,m] of abi.methods.entries())
	{
		const factory=closure(m.result);
		const sym=prefix+"export_"+i, c=m.args.map(javaScriptHostCarrier), vars=m.args.map((_,j)=>"v"+j);
		const call="(_root_."+m.declaration+(vars.length?" "+vars.join(" "):"")+")";
		const ret=m.effect==="EIO"?"(_root_.Except "+type(m.error)+" "+type(m.result)+")":type(m.result);
		leans.push("@[export "+sym+"] def invoke"+i+" "+m.args.map((t,j)=>"(v"+j+" : "+type(t)+")").join(" ")
			+" : _root_.IO "+ret+" := "+({IO: "",EIO: "EIO.toIO' ",BaseIO: "liftM ",pure: "pure "})[m.effect]+call);
		headers.push("extern lean_object *"+sym+"("+(c.map(([ctype])=>ctype).join(",") || "void")+");");
		const unbox=c.map(([,box],j)=>box?box.replace("lean_box","lean_unbox")+"(v["+j+"])":"v["+j+"]");
		wires.push("static lean_object *invoke_"+i+"(lean_object **v,lean_object *fn) { (void)fn; "
			+c.flatMap(([,box],j)=>box?[]:["lean_inc(v["+j+"]);"]).join(" ")+" return "+sym+"("+unbox.join(",")+"); }");
		cases.push("case "+i+": { static const uint8_t tags[]={"+(m.args.map(leaf).join(",") || 0)+"}; return pub_call(f,"
			+[m.args.length,"tags",factory?-1:index(m.result),m.effect==="EIO"?index(m.error):-1,"invoke_"+i,factory?i:-1,-1].join(",")+"); }");
		if(factory)
		{
			const {argument,reply}=m.result,[ctype,box]=javaScriptHostCarrier(argument),apply=sym+"_apply";
			leans.push("@[export "+apply+"] def apply"+i+" (f : "+type(m.result)+") (v : "+type(argument)+") : _root_.IO "+type(reply)+" := f v");
			headers.push("extern lean_object *"+apply+"(lean_object *, "+ctype+");");
			wires.push("static lean_object *apply_"+i+"(lean_object **v,lean_object *fn) { lean_inc(fn); "
				+(box?"":"lean_inc(v[0]); ")+"return "+apply+"(fn,"+(box?box.replace("lean_box","lean_unbox")+"(v[0])":"v[0]")+"); }");
			cases.push("case "+(total+i)+": { static const uint8_t tags[]={"+leaf(argument)+"}; return pub_call(f,1,tags,"
				+index(reply)+",-1,apply_"+i+",-1,"+i+"); }"
			,"case "+(2*total+i)+": return pub_drop(f,"+i+");");
		}
	}
	const entryLean=[...new Set([...modules,hostModule].map(m=>"import "+m))
		, "namespace "+module, ...leans
		, "@[export "+prefix+"error_text] def errorText (e : IO.Error) : String := toString e"
		, "end "+module
		, ""].join("\n");
	const header=[...headers,"extern lean_object *"+prefix+"error_text(lean_object *);","extern lean_object *initialize_"+module+"(uint8_t);"].join("\n")+"\n";
	const control=['#include "component_scalar.h"'
		, '#include "host-wasm-domain.h"'
		, "#include <stdlib.h>","#include <emscripten.h>",header
		, "extern uint32_t "+prefix+"kind(uint32_t);"
		, "EM_JS(uint32_t,"+prefix+"deliver,(uint32_t *f,unsigned ch,const uint8_t *tags,unsigned count,const bridge_scalar_slot *out),{return Module.lbJshDomainV1.deliver("
			+JSON.stringify(identity)+",f>>>0,ch>>>0,tags>>>0,count>>>0,out>>>0);});"
		, "#define PUB_DELIVER "+prefix+"deliver"
		, "#define PUB_KIND "+prefix+"kind"
		, "#define PUB_INIT initialize_"+module
		, "#define PUB_TEXT "+prefix+"error_text"
		, "#define PUB_STRING "+stringNode
		, "#define PUB_MAGIC "+hostCallMagic+"u"
		, "static const int32_t pub_nodes[][3]={"+nodes.map(n=>"{"+n.join(",")+"}").join(",")+"};"
		, ...functions?["#include <string.h>","#define DN_HOST_FIXED_WASM_ALLOCATOR 1","#define PUB_FUNCTIONS 1","typedef void lb_dnd_session;",readFileSync(new URL("../native/word-host-closures.h",import.meta.url),"utf8")]:[]
		, '#include "host-wasm-public.h"', ...wires
		, '__attribute__((visibility("default"))) uint32_t '+abi.controlSymbol+'(uint32_t *f) {'
		, "if (!pub_frame(f)) return 4; switch(f[3]) {"
		, ...cases
		, ...functions?["case "+(3*total)+": if(f[1]!=32 || !f[5] || f[6] || f[7]) return 4; dn_closure_retire(f[5],dn_serial); return 0;"]:[]
		, "default: return 4; } }"
		, ""].join("\n");
	return {abi,imports,module,entryLean,header,control};
};
