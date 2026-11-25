/** @file Build relocatable, independently loadable adapters for compiled WIT worker packages. */
import {copyFile,readFile,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {canonicalJson,sha256} from "../capsule/node.mjs";
import {cIdentifier} from "../backends/c/generate.mjs";
import {witPackageScheduler} from "../backends/wit/application-command.mjs";
import {witApplicationExchange} from "../backends/wit/application-exchange.mjs";
import {witTurnOwners} from "../backends/wit/application-turn-owners.mjs";
import {canonicalSupervisorComponent} from "../backends/wit/canonical-supervisor.mjs";
import {witPeerTypeSection,witPeerVault} from "./wit-peer-package.mjs";

const asset=n=>new URL("../backends/wit/"+n,import.meta.url);
/**
 * Each DSO carries that package's actual compiler-selected Wasm adapters
 * and native operations. Downstream composition needs no compiler or parser.
 *
 * @param o - Verified worker build, fixed application template, SDK and native runtime.
 */
export const compileWitAsyncPeer=async o=>{
	const {app,out,b,name,cc,sdk,wasm,run,runtimeRoot,template}=o;
	const path=n=>join(out,n),read=n=>readFile(join(app,n),"utf8");
	const ops=JSON.parse(await read("operations-layout.json")),delivery=JSON.parse(await read("object-delivery.json"));
	const callbacks=template.roles.includes("callbacks")?JSON.parse(await read("object-callbacks.json")):null;
	const obj=b.witImports,methods=template.methods,p=cIdentifier(name)+"_",bytes=new Map();
	if(!methods.length || !b.domainId || !b.runtimeIdentity)throw new Error("Missing compiled WIT worker domain");
	const cli=(...args)=>run(wasm,args,out);
	const parse=async(key,source)=>{
		const id="peer-worker-"+key;
		await writeFile(path(id+".wat"),source,{flag: "wx"});
		await cli("parse",id+".wat","-o",id+".wasm");
		await cli("validate","--features","cm-async,cm-async-builtins",id+".wasm");
		return readFile(path(id+".wasm"));
	};
	const sched=witPackageScheduler(await read("turn-sync-ports.wat"),methods);
	bytes.set("scheduler_type",witPeerTypeSection(await parse("scheduler","(component (type "+sched.type+"))")));
	bytes.set("cells",await parse("cells",witPeerVault(obj,(await cli("print","cells.wasm")).stdout)));
	bytes.set("base",await parse("base",witTurnOwners(obj,null)));
	bytes.set("members",await parse("members",await read("turn-members.wat")));
	bytes.set("turn",await parse("turn",await read("turn-native.wat")));
	bytes.set("facade",await readFile(path("api.wasm")));
	if(callbacks)bytes.set("owners",await parse("owners",witTurnOwners(obj,callbacks)));
	bytes.set("jobs",await parse("jobs",await read("object-turn-tasks.wat")));
	bytes.set("supervisor",await parse("supervisor",canonicalSupervisorComponent));
	const abiFiles=["application-async-peer.h","application-turn.h","application-turn-wait.h"];
	const abi=sha256(canonicalJson([o.sdkIdentity,...await Promise.all(abiFiles.map(async n=>sha256(await readFile(asset(n)))))]));
	const compat=sha256(canonicalJson([b.runtimeIdentity,b.domainId,obj.identity,...["cells","base","members"].map(n=>sha256(bytes.get(n)))]));
	const names=[abi,compat,obj.interfaceName,witApplicationExchange(obj).name
		, ops.nativeName,ops.publicName,template.transport,delivery.publicName
		, callbacks?.interfaceName];
	const progs=["scheduler_type","cells","base","members","turn","facade","owners","jobs","supervisor"];
	const controlNames=methods.flatMap(m=>(m.shape==="stream"?["pump","retire","drain"]:["poll","deliver","reap","retire","close","drain"]).map(s=>m.name+"-"+s));
	const header=["#define LB_AP_NAMES "+names.map(s=>s?JSON.stringify(s):"NULL").join(",")
		, "#define LB_AP_PROGRAMS "+progs.map(n=>bytes.has(n)?`{${n},sizeof ${n}}`:"{NULL,0}").join(",")
		, ...Array.from(bytes,([n,v])=>"static const uint8_t "+n+"[]={"+[...v].join(",")+"};")
		, "static const lb_ap_channel channels[]={"+methods.map(m=>'{'+JSON.stringify("turn-"+m.name)+','+(m.copied?JSON.stringify("copied-"+m.name):"NULL")+'}').join(",")+"};"
		, "static const char *const controls[]={"+controlNames.map(s=>JSON.stringify(s)).join(",")+"};"];
	await writeFile(path("peer-worker-data.h"),header.join("\n"),{flag: "wx"});
	await writeFile(path("peer-abi.h"),"#define LB_PEER_ABI "+JSON.stringify(abi)+"\n",{flag: "wx"});
	await writeFile(path("peer-worker-binding.h"),`#include "application-turn-sync-host.h"
#include "application-turn-tasks.h"
#define LB_BINDING ${p}binding
#define LB_OPEN ${p}with_hosts
#define LB_CLOSE ${p}close
#define LB_OK ${p}OK
`,{flag: "wx"});
	const sources=["application-peer-bytes.h","application-peer-io.h"
		, "application-async-peer.h","application-async-graph.h"
		, "application-async-plugin.c","application-async-command.c"];
	for(const n of sources)await copyFile(asset(n),path(n));
	const flags=["-std=gnu11","-O1","-g0","-pthread","-Wall","-Wextra","-Werror"
		, "-I"+app,"-I"+join(sdk,"include"),"-ffile-prefix-map="+out+"=/build/peer"];
	const runner="lean-bridge-wit-run",plugin="lean-bridge-wit-async-peer.so";
	await run(cc,[...flags,"-fPIC","-fvisibility=hidden","-shared"
		, "-ffile-prefix-map="+app+"=/build/provider","application-async-plugin.c"
		, "-L"+app,"-L"+join(sdk,"lib"),"-l:"+b.component,"-lwasmtime"
		, "-Wl,-z,defs,-z,now,--build-id=none,-rpath,$ORIGIN","-Wl,-rpath-link,"+app
		, "-Wl,-rpath-link,"+join(runtimeRoot,"lib"),"-o",plugin],out);
	await run(cc,[...flags,"application-async-command.c","-L"+join(sdk,"lib")
		, "-lwasmtime","-ldl","-Wl,-z,now,--build-id=none,-rpath,$ORIGIN/../lib"
		, "-o",runner],out);
	return {runner,plugin};
};
