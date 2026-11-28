/** @file Build the two replaceable guest slots and the private native scheduling hooks. */
import {readFile,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {canonicalJson} from "../capsule/node.mjs";
import {canonicalCallbackBindings} from "../backends/wit/canonical-callback.mjs";
import {canonicalCallbackFutures} from "../backends/wit/canonical-callback-task.mjs";
import {splitWitApplicationSlots} from "../backends/wit/canonical-app.mjs";
import {canonicalSupervisor} from "../backends/wit/canonical-supervisor.mjs";
import {renderWitTaskImports} from "../backends/wit/task-host.mjs";
import {compileWitTaskResources} from "../backends/wit/task-model.mjs";

const witness=`(component (core module $m (func (export "run") (result i32) unreachable)
    (func (export "cb") (param i32 i32 i32) (result i32) unreachable)) (core instance $i (instantiate $m))
    (func (export "run") async (result s64) (canon lift (core func $i "run") async (callback (func $i "cb")))))`;
const replaceable=(wat,id)=>wat.trimStart().replace(/^\(component(?:\s+\$[^\s()]+)?/u,
	'(component $'+id+' (@custom "lean-bridge-guest-slot-v1" "'+id+'")');

/**
 * Assemble and validate the graph *before* removing the replaceable sections.
 * Never put the provider witness or application stub into the installed driver.
 *
 * @param o - Package stage with compiler-authenticated IR, wire and checked SDK.
 * @param tools - Pinned wasm-tools executable.
 */
export const prepareCanonicalCallbackPackage=async(o,tools)=>{
	const {app,api,evidence,entries,bindingIrSha256,name,version,run}=o;
	const m=compileWitTaskResources({api,evidence,bindingIrSha256,settings: {name,version}});
	if(m.prefix!==o.prefix || canonicalJson(m.wire)!==canonicalJson(o.wire)) throw new Error("Canonical task wire differs from its compiled provider");
	const bindings=canonicalCallbackBindings(m),f=canonicalCallbackFutures(m,bindings);
	if(f.plans.length!==entries.length || f.plans.some((p,i)=>p.method!==i || m.methods[i].declaration!==entries[i].declaration))
		throw new Error("Canonical callback package would omit a declaration");
	const save=(n,v)=>writeFile(join(app,n),v,{flag: "wx"}),cli=(...args)=>run(tools,args,app);
	await save("application.wit",f.wit);
	await cli("component","embed","application.wit","--world","callback-provider","--dummy","-o","provider.core");
	await cli("component","new","provider.core","-o","provider.wasm");
	const provider=(await cli("print","provider.wasm")).stdout;
	const pkg="lean-bridge:"+name+"/",v="@"+version,cb=pkg+"callbacks"+v,apiName=pkg+"callback-tasks"+v;
	const wat=`(component
  (import "${m.importName}" (instance $native ${m.nativeType}))
  ${replaceable(provider,"callbacks")} (instance $guest-cb (instantiate $callbacks))
  (alias export $guest-cb "${cb}" (instance $provider))
  ${f.wat.replace("(component","(component $tasks")}
  (instance $instance (instantiate $tasks (with "${m.importName}" (instance $native)) (with "callbacks" (instance $provider))))
  (alias export $instance "callback-tasks" (instance $api))
  ${replaceable(witness,"application")}
  (instance $app (instantiate $application (with "${cb}" (instance $provider)) (with "${apiName}" (instance $api))))
  ${canonicalSupervisor}
  ${f.plans.flatMap(p=>["turn","shutdown"].map(n=>`(export "${n}-m${p.method}" (func $instance "${n}-m${p.method}"))`)).join("\n  ")})`;
	await save("canonical.wat",wat);await cli("parse","canonical.wat","-o","canonical.wasm");
	await cli("validate","--features","cm-async,cm-async-builtins","canonical.wasm");
	const template=await readFile(join(app,"canonical.wasm")),parts=splitWitApplicationSlots(template,["callbacks","application"]);
	const packageHeader=`#define LB_INPUTS 2
#define LB_METHODS ${f.plans.length}
static const char *const input_roles[]={"callbacks","application"};
${parts.map((b,i)=>"static const uint8_t part"+i+"[]={"+(b.length?[...b].join(","):"0")+"};").join("\n")}
static const struct {const uint8_t *p;size_t n;} fixed[]={${parts.map((b,i)=>"{part"+i+","+b.length+"}").join(",")}};
`;
	const hooks=await renderWitTaskImports(m);
	const asset=n=>readFile(new URL("../backends/wit/"+n,import.meta.url));
	const driver=await asset("canonical-callback-command.c"),reactor=await asset("application-command-inputs.h");
	await save("callback-package.h",packageHeader);await save("task-host.h",hooks);
	await save("canonical-command.c",driver);await save("application-command-inputs.h",reactor);
	return {wit: f.wit,template,hooks,driver,reactor};
};
