/** @file Generate the application-facing Lean entry module and wasm32 host-call dispatcher. */
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
	const {api,hosts,identity,modules}=options, abi=javaScriptHostIOAbi(api,hosts,identity);
	if(!modules?.length || modules.some(m=>!qual.test(m)) || abi.methods.some(m=>!qual.test(m.declaration)))
		throw new TypeError("Invalid Lean export names");
	const imports=generateJavaScriptHostExterns(hosts,identity), {prefix}=imports, module="BridgeJsHost"+identity;
	const type=t=>Array.isArray(t)?"(_root_.Except "+type(t[1])+" "+type(t[0])+")"
		:"_root_."+(typeof t==="number"?"LeanBridge.Host.Javascript."+hosts.types[t].name:scalar[t]);
	const nodes=[], byShape=new Map();
	const index=t=>{
		const key=JSON.stringify(t); if(byShape.has(key)) return byShape.get(key);
		const row=Array.isArray(t)?[-1,index(t[0]),index(t[1])]:[leaf(t),0,0];
		const i=nodes.length; nodes.push(row);byShape.set(key,i);return i;
	};
	const stringNode=index("string"), leans=[], headers=[], wires=[], cases=[];
	for(const [i,m] of abi.methods.entries())
	{
		const sym=prefix+"export_"+i, c=m.args.map(javaScriptHostCarrier), vars=m.args.map((_,j)=>"v"+j);
		const call="(_root_."+m.declaration+(vars.length?" "+vars.join(" "):"")+")";
		const ret=m.effect==="EIO"?"(_root_.Except "+type(m.error)+" "+type(m.result)+")":type(m.result);
		leans.push("@[export "+sym+"] def invoke"+i+" "+m.args.map((t,j)=>"(v"+j+" : "+type(t)+")").join(" ")
			+" : _root_.IO "+ret+" := "+({IO: "",EIO: "EIO.toIO' ",BaseIO: "liftM ",pure: "pure "})[m.effect]+call);
		headers.push("extern lean_object *"+sym+"("+(c.map(([ctype])=>ctype).join(",") || "void")+");");
		const unbox=c.map(([,box],j)=>box?box.replace("lean_box","lean_unbox")+"(v["+j+"])":"v["+j+"]");
		wires.push("static lean_object *invoke_"+i+"(lean_object **v) { "
			+c.flatMap(([,box],j)=>box?[]:["lean_inc(v["+j+"]);"]).join(" ")+" return "+sym+"("+unbox.join(",")+"); }");
		cases.push("case "+i+": { static const uint8_t tags[]={"+(m.args.map(leaf).join(",") || 0)+"}; return pub_call(f,"
			+[m.args.length,"tags",index(m.result),m.effect==="EIO"?index(m.error):-1,"invoke_"+i].join(",")+"); }");
	}
	const entryLean=[...new Set([...modules,"LeanBridge.Host.Javascript"].map(m=>"import "+m))
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
		, '#include "host-wasm-public.h"', ...wires
		, '__attribute__((visibility("default"))) uint32_t '+abi.controlSymbol+'(uint32_t *f) {'
		, "if (!pub_frame(f)) return 4; switch(f[3]) {"
		, ...cases
		, "default: return 4; } }"
		, ""].join("\n");
	return {abi,imports,module,entryLean,header,control};
};
