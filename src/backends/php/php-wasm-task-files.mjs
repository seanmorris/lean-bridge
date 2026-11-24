/** @file Generate typed PHP functions, owned awaitables and a PHP-Wasm host descriptor for a compiled Lean worker. */
import {readFile} from "node:fs/promises";
import {javaScriptTaskAbi} from "../../abi/javascript-wasm-tasks.mjs";
import {phpWasmHostMembers} from "./host-members.mjs";
import {bundledBrickMath} from "./brick-math.mjs";
import {validateOrdinaryPhpSettings} from "./copied-model.mjs";
import {phpClassName,phpFieldName,reservedPhpNames} from "./copied-names.mjs";
import {phpIOPublicDeclarations} from "./io-package.mjs";
import {phpWasmCopiedType} from "./io-surface.mjs";
import {phpConversionBudget,phpScalarCodec} from "./copied-support.mjs";
import {phpValueSemantics} from "./copied-equality.mjs";

const read=file=>readFile(new URL(file,import.meta.url),"utf8");
const q=s=>"'"+s.replaceAll("\\","\\\\").replaceAll("'","\\'")+"'";
const shape=k=>Array.isArray(k)?"["+k.map(shape).join(",")+"]":q(k);
const pascal=s=>s.split(/[-_]+/u).map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join("");
const fail=s=>{throw new TypeError("PHP-Wasm tasks: "+s);};
/**
 * Derive all method and failure shapes from the same authenticated IR as the worker.
 *
 * @param api - Compiled and reconciled public Binding IR.
 * @param componentIdentity - Exact component fingerprint.
 * @param composer - Validated Composer coordinate; also determines the PHP mount path.
 * @param worker - Checked private scheduler interface derived from the same Lean entries.
 * @param imports - Optional captured declarations of application PHP classes.
 */
export const generatePhpWasmTaskFiles=async(api,componentIdentity,composer,worker=api,imports=null)=>{
	validateOrdinaryPhpSettings(composer);
	const zend=imports!==null,model=zend?phpWasmHostMembers(imports):null;
	const abi=javaScriptTaskAbi(worker,componentIdentity,imports,zend), callbacks=abi.methods.some(m=>m.callbacks);
	const leases=abi.leases??[],publicTypes=new Map(leases.map(r=>[r.type,phpClassName(r.name)]));
	const hostTypes=new Set(abi.hostKinds?.map(k=>k.type)),phpType=k=>{
		if(Array.isArray(k))
		{k.forEach(phpType);return "Ok|Err";}
		return publicTypes.get(k)??(hostTypes.has(k)?"object":phpWasmCopiedType(k));
	};
	if(callbacks && (!api.errors.some(e=>e.id==="error:PhpCallbackException") || api.types.filter(t=>t.kind==="callback").some(t=>t.callable?.resultMode!=="value"))) fail("expected synchronous PHP callback contract");
	if(!/^[A-Za-z][A-Za-z0-9]*(?:[-_][A-Za-z0-9]+)*$/u.test(api.component.name)) fail("invalid component namespace");
	const ns="Lean"+pascal(api.component.name), key="lb_task_"+componentIdentity, defs=[],classes=new Set(["bytes","leanbridgeerror","taskcancelled","declaredfailure","ok","err","awaitable","pullstream"]),fns=new Set();
	const added=new Set();
	if(zend)
	{classes.add("boundapi");for(const name of ["bind","entry","close","retain"]) fns.add(name);}
	if(callbacks) for(const name of ["callbackclosed","retainedcallback"]) classes.add(name);
	const add=(cls,body,share=false)=>{if(share && added.has(cls)) return;
		if(classes.has(cls.toLowerCase())) fail("PHP class collision: "+cls);
		classes.add(cls.toLowerCase());added.add(cls);defs.push(body);};
	for(const name of publicTypes.values())
	{
		if(!/^[A-Za-z][A-Za-z0-9_]*$/u.test(name) || reservedPhpNames.has(name.toLowerCase()) || classes.has(name.toLowerCase())) fail("Invalid or colliding resource class: "+name);
		classes.add(name.toLowerCase());
	}
	const branches=abi.methods.some(m=>[m.result,m.error,m.terminal].some(Array.isArray))?["Ok","Err"]:[];
	const funcs=abi.methods.map((m,i)=>{
		const name=phpClassName(m.name);
		if(!/^[A-Za-z][A-Za-z0-9_]*$/u.test(name) || fns.has(name.toLowerCase())) fail("invalid or colliding function: "+name);
		fns.add(name.toLowerCase());
		const args=api.declarations[i].parameters.map(p=>"$"+phpFieldName(p.name,fail)), type=phpType(m.result), base=pascal(name);
		const err=(cls,decl,k)=>{if(!k) return "null";
			add(cls,"final class "+cls+" extends DeclaredFailure {}",cls==="IOError" || cls==="TaskIOError");
			return "["+cls+"::class,"+q(decl)+","+shape(k)+"]";};
		const start=err(m.effect==="IO"?"IOError":base+"Error",m.declaration,m.error);
		const terminal=err(m.delivery==="async-iterator"?base+"StepError":"TaskIOError",m.stepDeclaration??m.declaration,m.terminal);
		const cls=m.delivery==="task"?base+"Task":m.delivery?"PullStream":null;
		if(m.delivery==="task") add(cls,"final class "+cls+" extends Awaitable { public function await(): "+type+" { return $this->take(); } }");
		const specs=new Map((m.callbacks??[]).map(([slot,input,output])=>[slot,"callable("+phpType(input)+"): "+phpType(output)]));
		const callbackSpec="["+(m.callbacks??[]).map(([i,input,output])=>"["+i+","+q(input)+","+q(output)+"]").join(",")+"]";
		if(zend && name.startsWith("__")) fail("Reserved PHP binding method: "+name);
		const submit=zend?"$this->entry("+i+")":q(key+"_"+i);
		const parameters=[submit
			, "["+args.join(",")+"]"
			, "["+m.args.map(q).join(",")+"]"
			, m.delivery?q(m.delivery):"null"
			, cls?cls+"::class":"null"
			, q(m.declaration),shape(m.result),start,terminal,callbackSpec];
		if(zend) parameters.push("$this->domain",m.hostPhases.call.length?"$this->members":"null","$this");
		const call="Internal\\Port::call("+parameters.join(",")+")";
		return "/** "+args.map((a,j)=>"@param "+(specs.get(j)??phpType(m.args[j]))+" "+a).join(" ")+" @return "+(m.delivery==="async-iterator"?"PullStream<"+type+">":cls??type)+" */\n"+(zend?"public ":"")+"function "+name+"("+args.map((a,i)=>(specs.has(i)?"callable":publicTypes.get(m.args[i])??(hostTypes.has(m.args[i])?"object":"mixed"))+" "+a).join(", ")+"): "+(cls??type)+" {\n"
			+"    if (func_num_args()!=="+args.length+") throw new \\ArgumentCountError('Unexpected argument count');\n"
			+"    return "+(zend && m.delivery?"$this->retain("+call+")":call)+";\n}";
	});
	const php={"bootstrap.php": "<?php\nrequire_once __DIR__.'/dependencies/brick-math/autoload.php';\nrequire_once __DIR__.'/src/Api.php';\n"
		, "src/Api.php": "<?php\ndeclare(strict_types=1);\nnamespace "+ns+";\nrequire_once __DIR__.'/Internal.php';\nrequire_once __DIR__.'/Delivery.php';\n"+phpIOPublicDeclarations([],branches)+"\n"+defs.join("\n")+"\n"+(zend?"":funcs.join("\n"))+"\n"
		, "src/Internal.php": "<?php\ndeclare(strict_types=1);\nnamespace "+ns+"\\Internal;\nrequire_once __DIR__.'/Wire.php';\nrequire_once __DIR__.'/Port.php';\n"+phpConversionBudget+"\n"+phpScalarCodec+"\n"+phpValueSemantics({namespace: ns,branches,surface: {copies: []}})+"\n",
		...bundledBrickMath()};
	for(const [path,file] of [["src/Delivery.php","php-wasm-task-delivery.php"],["src/Port.php","php-wasm-task-port.php"],["src/Wire.php","php-wasm-io-codec.php"],["src/Pump.php","php-wasm-task-pump.php"]]) php[path]=(await read(file)).replaceAll("__LB_PUBLIC__",ns);
	if(leases.length)
	{
		const canonical=r=>"LeanBridge\\WasmHeapV1\\H"+r.hash;
		php["src/Leases.php"]=(await read("php-wasm-task-leases.php"))+leases.map(r=>"\nif (!class_exists(H"+r.hash+"::class,false)) { final class H"+r.hash+" extends Lease {} }\nclass_alias(H"+r.hash+"::class,"+q(ns+"\\"+publicTypes.get(r.type))+");\n").join("");
		php["src/Port.php"]=php["src/Port.php"].replace("/*__LB_LEASES__*/[]","["+leases.map(r=>q(r.type)+"=>"+q(canonical(r))).join(",")+"]");
		php["src/Api.php"]+="\nrequire_once __DIR__.'/Leases.php';\n";
	}
	php["src/Api.php"]+="\nrequire_once __DIR__.'/Pump.php';\n";
	if(callbacks)
	{php["src/Callbacks.php"]=(await read("php-wasm-task-callbacks.php")).replaceAll("__LB_PUBLIC__",ns);php["src/Api.php"]+="\nrequire_once __DIR__.'/Callbacks.php';\n";}
	if(zend)
	{
		for(const [name,asset] of [["Objects","php-wasm-task-objects"],["Members","host-members"],["ZendMembers","php-wasm-members"],["BoundApi","php-wasm-bound-api"]])
		{
			php["src/"+name+".php"]=(await read(asset+".php")).replaceAll("__LB_PUBLIC__",ns);
			php["src/Api.php"]+="require_once __DIR__.'/".concat(name,".php';\n");
		}
		php["src/BoundApi.php"]=php["src/BoundApi.php"].replace("__LB_MODEL__",()=>JSON.stringify(model)).replace("__LB_BIND__",key+"_bind")
			.replace("__LB_METHODS__",()=>funcs.join("\n"));
	}
	const root="/vendor/"+composer.name+"/",files={};
	const urls=Object.keys(php).sort().map(p=>"{path:"+JSON.stringify(root+p)+",url:new URL("+JSON.stringify("./php/"+p)+",import.meta.url)}");
	const descriptor=zend?"createPhpZendDescriptor":"createPhpTaskDescriptor",bridge=zend?"php-wasm-zend-descriptor":"php-wasm-task-owner";
	const exportHost="import {"+descriptor+"} from './bridge/backends/php/"+bridge+".mjs';\nimport {loadTaskComponent} from '@lean-bridge/runtime';\n"
		+(zend?"import {runtime as bindings} from './internal/runtime.mjs';\n":"import bindings from './component.mjs';\n")
		+"const owner="+descriptor+"("+JSON.stringify({namespace: ns,key,methods: abi.methods,leases,...zend?{model}:{}})+",bindings,["+urls.join(",")+"],loadTaskComponent);\n"
		+"export const autoload="+JSON.stringify(root+"bootstrap.php")+";\nconst extensions=Object.freeze({getLibs:()=>[],getFiles:php=>{owner.getFiles(php);return [];}});\nexport default Object.freeze({...owner,extensions,autoload});\n";
	for(const [p,v] of Object.entries(php)) files["php/"+p]=v;
	for(const path of ["abi/component-scalars.mjs","backends/php/php-wasm-task-owner.mjs","backends/php/php-wasm-task-mailbox.mjs","backends/php/php-wasm-task-wire.mjs","backends/php/php-wasm-task-leases.mjs"]) files["bridge/"+path]=await read("../../"+path);
	if(zend) for(const name of ["php-wasm-zend-descriptor","php-wasm-member-owner","php-wasm-task-objects"])
		files["bridge/backends/php/"+name+".mjs"]=await read(name+".mjs");
	files["index.mjs"]=exportHost;return {files,php,namespace: ns,autoload: root+"bootstrap.php"};
};
