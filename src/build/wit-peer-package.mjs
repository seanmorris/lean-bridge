/** @file Compile a package's public WIT facade and native binding for use in a shared Wasmtime store. */
import {copyFile,readFile,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {canonicalJson,sha256} from "../capsule/node.mjs";
import {witApplicationExchange} from "../backends/wit/application-exchange.mjs";
import {cIdentifier} from "../backends/c/generate.mjs";

const asset=n=>new URL("../backends/wit/"+n,import.meta.url);
// Preserve the compiler's complete, self-contained instance type. In the
// outer graph each peer contributes exactly one top-level type index.
const typeSection=bytes=>{
	let result=null,at=8;
	while(at<bytes.length)
	{
		const start=at,kind=bytes[at++];let n=0,shift=0,octet;
		do
		{
			if(at>=bytes.length || shift>28)throw new Error("Invalid WIT peer type section");
			octet=bytes[at++];n+=(octet&127)*2**shift;shift+=7;
		}while(octet&128);
		if(n>bytes.length-at)throw new Error("Truncated WIT peer type section");
		if(kind!==0)
		{
			if(result || kind!==7 || n<2 || bytes[at]!==1 || bytes[at+1]!==0x42)throw new Error("Expected one WIT peer instance type");
			result=bytes.subarray(start,at+n);
		}
		at+=n;
	}
	if(!result)throw new Error("Missing WIT peer type");
	return result;
};

/**
 * Generate one cell table bound to the actual defining instance. All peers
 * receive this same exchange, while the downstream guest sees only public APIs.
 *
 * @param descriptor - Authenticated guest object contract.
 * @param cells - Compiled WIT canonical resource exchange as component text.
 */
export const witPeerVault=(descriptor,cells)=>{
	const obj=descriptor.interfaceName,x=witApplicationExchange(descriptor);
	return ["(component"
		, `(import "${obj}" (instance $owner ${x.slots.map(s=>`(export "${s.type}" (type (sub resource)))`).join(" ")}))`
		, ...x.slots.map(s=>`(alias export $owner "${s.type}" (type $${s.alias}))`)
		, cells.replace("(component","(component $cells-code")
		, `(instance $cells (instantiate $cells-code (with "${obj}" (instance $owner)) ${x.slots.map(s=>`(with "${s.alias}" (type $${s.alias}))`).join(" ")}))`
		, "(instance $x "+x.slots.flatMap(s=>[`(export "${s.alias}" (type $${s.alias}))`,...[s.put,s.take].map(f=>`(export "${f}" (func $cells "${f}"))`)]).join(" ")+")"
		, `(export "${x.name}" (instance $x)))`].join("\n");
};

/**
 * Build a package-local adapter DSO. The runner uses only SDK-checked
 * component bytes and this package's independently compiled Lean entry points.
 *
 * @param o - Verified synchronous publisher build, launcher staging and SDK paths.
 */
export const compileWitPeerPackage=async o=>{
	const {app,out,b,name,cc,sdk,wasm,run,runtimeRoot}=o,local=n=>join(out,n);
	const ops=JSON.parse(await readFile(join(app,"operations-layout.json"))),obj=b.witImports;
	const cli=(...args)=>run(wasm,args,out);
	const parse=async(id,wat)=>{
		await writeFile(local(id+".wat"),wat,{flag: "wx"});await cli("parse",id+".wat","-o",id+".wasm");
		await cli("validate",id+".wasm");return readFile(local(id+".wasm"));
	};
	const types=typeSection(await parse("peer-type","(component (type "+ops.nativeType+"))"));
	const vault=await parse("peer-vault",witPeerVault(obj,(await cli("print","cells.wasm")).stdout));
	const digest=async n=>sha256(await readFile(asset(n)));
	const abi=sha256(canonicalJson([o.sdkIdentity,...await Promise.all(["application-peer.h","application-object-store.h","application-member-runtime.h"].map(digest))]));
	const compat=sha256(canonicalJson([b.runtimeIdentity,b.domainId,obj.identity]));
	await writeFile(local("peer-abi.h"),"#define LB_PEER_ABI "+JSON.stringify(abi)+"\n",{flag: "wx"});
	const names=[abi,compat,obj.interfaceName,witApplicationExchange(obj).name,ops.nativeName,ops.publicName].map(s=>JSON.stringify(s)).join(",");
	const data=(id,bytes)=>"static const uint8_t "+id+"[]={"+[...bytes].join(",")+"};";
	const header=["#define LB_PEER_NAMES "+names
		, "#define LB_PEER_OK "+cIdentifier(name)+"_OK"
		, data("native_type",types),data("vault",vault)
		, data("facade",await readFile(local("api.wasm")))];
	await writeFile(local("peer-data.h"),header.join("\n"),{flag: "wx"});
	for(const n of ["application-peer.h","application-peer-plugin.c"])await copyFile(asset(n),local(n));
	const plugin="lean-bridge-wit-peer.so";
	const flags=["-std=gnu11","-O1","-g0","-Wall","-Wextra","-Werror","-I"+app,"-I"+join(sdk,"include"),"-ffile-prefix-map="+out+"=/build/peer"];
	await run(cc,[...flags,"-fPIC","-fvisibility=hidden","-shared"
		, "-ffile-prefix-map="+app+"=/build/provider","application-peer-plugin.c"
		, "-L"+app,"-L"+join(sdk,"lib"),"-l:"+b.component,"-lwasmtime"
		, "-Wl,-z,defs,-z,now,--build-id=none,-rpath,$ORIGIN"
		, "-Wl,-rpath-link,"+app,"-Wl,-rpath-link,"+join(runtimeRoot,"lib")
		, "-o",plugin],out);
	for(const n of ["application-peer-graph.h","application-peer-command.c"])await copyFile(asset(n),local(n));
	const runner="lean-bridge-wit-run";
	await run(cc,[...flags,"application-peer-command.c","-L"+join(sdk,"lib")
		, "-lwasmtime","-ldl","-Wl,-z,now,--build-id=none,-rpath,$ORIGIN/../lib"
		, "-o",runner],out);
	return {plugin,runner};
};
