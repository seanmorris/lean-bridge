/** @file Generate typed PHP functions, owned awaitables and a PHP-Wasm host descriptor for a compiled Lean worker. */
import {readFile} from "node:fs/promises";
import {javaScriptTaskAbi} from "../../abi/javascript-wasm-tasks.mjs";
import {bundledBrickMath} from "./brick-math.mjs";
import {validateOrdinaryPhpSettings} from "./copied-model.mjs";
import {phpClassName,phpFieldName} from "./copied-names.mjs";
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
 */
export const generatePhpWasmTaskFiles=async(api,componentIdentity,composer,worker=api)=>{
	validateOrdinaryPhpSettings(composer);
	const abi=javaScriptTaskAbi(worker,componentIdentity), callbacks=abi.methods.some(m=>m.callbacks);
	if(abi.leases?.length) fail("heap leases need a PHP identity contract");
	if(callbacks && (!api.errors.some(e=>e.id==="error:PhpCallbackException") || api.types.filter(t=>t.kind==="callback").some(t=>t.callable?.resultMode!=="value"))) fail("expected synchronous PHP callback contract");
	if(!/^[A-Za-z][A-Za-z0-9]*(?:[-_][A-Za-z0-9]+)*$/u.test(api.component.name)) fail("invalid component namespace");
	const ns="Lean"+pascal(api.component.name), key="lb_task_"+componentIdentity, defs=[],classes=new Set(["bytes","leanbridgeerror","taskcancelled","declaredfailure","ok","err","awaitable","pullstream"]),fns=new Set();
	const added=new Set();
	if(callbacks) for(const name of ["callbackclosed","retainedcallback"]) classes.add(name);
	const add=(cls,body,share=false)=>{if(share && added.has(cls)) return;
		if(classes.has(cls.toLowerCase())) fail("PHP class collision: "+cls);
		classes.add(cls.toLowerCase());added.add(cls);defs.push(body);};
	const branches=abi.methods.some(m=>[m.result,m.error,m.terminal].some(Array.isArray))?["Ok","Err"]:[];
	const funcs=abi.methods.map((m,i)=>{
		const name=phpClassName(m.name);
		if(!/^[A-Za-z][A-Za-z0-9_]*$/u.test(name) || fns.has(name.toLowerCase())) fail("invalid or colliding function: "+name);
		fns.add(name.toLowerCase());
		const args=api.declarations[i].parameters.map(p=>"$"+phpFieldName(p.name,fail)), type=phpWasmCopiedType(m.result), base=pascal(name);
		const err=(cls,decl,k)=>{if(!k) return "null";
			add(cls,"final class "+cls+" extends DeclaredFailure {}",cls==="IOError" || cls==="TaskIOError");
			return "["+cls+"::class,"+q(decl)+","+shape(k)+"]";};
		const start=err(m.effect==="IO"?"IOError":base+"Error",m.declaration,m.error);
		const terminal=err(m.delivery==="async-iterator"?base+"StepError":"TaskIOError",m.stepDeclaration??m.declaration,m.terminal);
		const cls=m.delivery==="task"?base+"Task":m.delivery?"PullStream":null;
		if(m.delivery==="task") add(cls,"final class "+cls+" extends Awaitable { public function await(): "+type+" { return $this->take(); } }");
		const specs=new Map((m.callbacks??[]).map(([slot,input,output])=>[slot,"callable("+phpWasmCopiedType(input)+"): "+phpWasmCopiedType(output)]));
		const callbackSpec="["+(m.callbacks??[]).map(([i,input,output])=>"["+i+","+q(input)+","+q(output)+"]").join(",")+"]";
		return "/** "+args.map((a,j)=>"@param "+(specs.get(j)??phpWasmCopiedType(m.args[j]))+" "+a).join(" ")+" @return "+(m.delivery==="async-iterator"?"PullStream<"+type+">":cls??type)+" */\nfunction "+name+"("+args.map((a,i)=>(specs.has(i)?"callable ":"mixed ")+a).join(", ")+"): "+(cls??type)+" {\n"
			+"    if (func_num_args()!=="+args.length+") throw new \\ArgumentCountError('Unexpected argument count');\n"
			+"    return Internal\\Port::call("+[q(key+"_"+i),"["+args.join(",")+"]","["+m.args.map(q).join(",")+"]",m.delivery?q(m.delivery):"null",cls?cls+"::class":"null",q(m.declaration),shape(m.result),start,terminal,callbackSpec].join(",")+");\n}";
	});
	const php={"bootstrap.php": "<?php\nrequire_once __DIR__.'/dependencies/brick-math/autoload.php';\nrequire_once __DIR__.'/src/Api.php';\n"
		, "src/Api.php": "<?php\ndeclare(strict_types=1);\nnamespace "+ns+";\nrequire_once __DIR__.'/Internal.php';\nrequire_once __DIR__.'/Delivery.php';\n"+phpIOPublicDeclarations([],branches)+"\n"+defs.join("\n")+"\n"+funcs.join("\n")+"\n"
		, "src/Internal.php": "<?php\ndeclare(strict_types=1);\nnamespace "+ns+"\\Internal;\nrequire_once __DIR__.'/Wire.php';\nrequire_once __DIR__.'/Port.php';\n"+phpConversionBudget+"\n"+phpScalarCodec+"\n"+phpValueSemantics({namespace: ns,branches,surface: {copies: []}})+"\n",
		...bundledBrickMath()};
	for(const [path,file] of [["src/Delivery.php","php-wasm-task-delivery.php"],["src/Port.php","php-wasm-task-port.php"],["src/Wire.php","php-wasm-io-codec.php"],["src/Pump.php","php-wasm-task-pump.php"]]) php[path]=(await read(file)).replaceAll("__LB_PUBLIC__",ns);
	php["src/Api.php"]+="\nrequire_once __DIR__.'/Pump.php';\n";
	if(callbacks)
	{php["src/Callbacks.php"]=(await read("php-wasm-task-callbacks.php")).replaceAll("__LB_PUBLIC__",ns);php["src/Api.php"]+="\nrequire_once __DIR__.'/Callbacks.php';\n";}
	const root="/vendor/"+composer.name+"/",files={};
	const urls=Object.keys(php).sort().map(p=>"{path:"+JSON.stringify(root+p)+",url:new URL("+JSON.stringify("./php/"+p)+",import.meta.url)}");
	const exportHost="import {createPhpTaskDescriptor} from './bridge/backends/php/php-wasm-task-owner.mjs';\nimport {loadTaskComponent} from '@lean-bridge/runtime';\nimport bindings from './component.mjs';\n"
		+"const owner=createPhpTaskDescriptor("+JSON.stringify({namespace: ns,key,methods: abi.methods})+",bindings,["+urls.join(",")+"],loadTaskComponent);\n"
		+"export const autoload="+JSON.stringify(root+"bootstrap.php")+";\nconst extensions=Object.freeze({getLibs:()=>[],getFiles:php=>{owner.getFiles(php);return [];}});\nexport default Object.freeze({...owner,extensions,autoload});\n";
	for(const [p,v] of Object.entries(php)) files["php/"+p]=v;
	for(const path of ["abi/component-scalars.mjs","backends/php/php-wasm-task-owner.mjs","backends/php/php-wasm-task-mailbox.mjs","backends/php/php-wasm-task-wire.mjs"]) files["bridge/"+path]=await read("../../"+path);
	files["index.mjs"]=exportHost;return {files,php,namespace: ns,autoload: root+"bootstrap.php"};
};
