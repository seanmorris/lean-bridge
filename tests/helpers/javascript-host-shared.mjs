/** @file Compare actual Lean wrapper identity between independently compiled Wasm components. */
import assert from "node:assert/strict";
import {copyFile,mkdir,readFile,writeFile} from "node:fs/promises";
import {join,resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {generateJavaScriptHostExterns} from "../../src/backends/javascript/host-wasm-externs.mjs";
import {generateLeanHostObjectAdapters} from "../../src/backends/lean/host-object.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {installWasmHostDomain} from "../../src/runtime/wasm-host-loader.mjs";

const symbols=["token","wrap","admit","enter","leave","error","control"].map(n=>"lb_jsh_domain_"+n+"_v1");
/**
 * Run the same independent binaries in both orders on distinct fresh heaps.
 *
 * @param o - Prepared local producer, target headers and initialized-runtime artifacts.
 */
export const checkSharedHostWasm = async o => {
	const {app,run,lean,emcc,target,runtime,input,oracle}=o;
	const ir=JSON.parse(await readFile(join(input,"lean-bridge.hosts.json")));
	const strong=structuredClone(ir.types[0]); strong.name="Token";strong.id="host:meter.Token";
	strong.resource.kindId="resource:meter.Token"; strong.host.identity="strong-canonical";ir.types.push(strong);
	const ident=structuredClone(ir.declarations.find(d=>d.name==="identity"));
	ident.owner=ident.receiver.type.id=ident.result.type.id=strong.id;
	ident.id=strong.id+".identity";ident.overloadKey=ident.source.declaration="Token.identity";ir.declarations.push(ident);
	const assets=resolve("src/backends/javascript"), scalar=resolve("poc/lean-link-spike");
	const flags=["-O1","-g0","-fPIC","-fwasm-exceptions","-fvisibility=hidden","-DLEAN_EMSCRIPTEN","-I",join(target,"cmake/include"),"-I",assets,"-I",scalar];
	const link=["-O1","-fwasm-exceptions","-sSIDE_MODULE=2","-Wl,--no-entry"];
	await run(emcc,[...flags,"-c",join(assets,"host-wasm-domain.c"),"-o","domain.o"]);
	await run(emcc,[...link,...symbols.map(s=>"-Wl,--export="+s),"domain.o","-o","domain.wasm"]);
	const broker=await readFile(join(app,"domain.wasm")), components=[];
	for(const unit of ["Alpha","Beta"])
	{
		const dir=join(app,unit), host="LeanBridge/Host/Javascript", id=sha256(canonicalJson([unit,ir]));
		const gen=generateJavaScriptHostExterns(ir,id), control="lb_"+unit+"_control";
		await mkdir(join(dir,"LeanBridge/Host"),{recursive: true});
		await writeFile(join(dir,host+".lean"),generateLeanHostObjectAdapters(ir)[host+".lean"]);
		await writeFile(join(dir,unit+".lean"),`import LeanBridge.Host.Javascript
open LeanBridge.Host.Javascript
namespace ${unit}
@[export lb_${unit}_box] def callBox (x : Box) (n : UInt32) : IO Box := do
  x.setLevel n
  let val ← x.read
  unless val == n do throw (IO.userError "setter did not update the host")
  x.identity
@[export lb_${unit}_strong] def callStrong (x : Token) : IO Token := x.identity
end ${unit}
`);
		await writeFile(join(dir,"renames.h"),gen.renames);
		await writeFile(join(dir,"members.inc"),gen.source);
		await writeFile(join(dir,"service.inc"),gen.service);
		await copyFile(join(oracle,"shared-entry.c"),join(dir,"entry.c"));
		for(const [m,c] of [[host,"host"],[unit,"app"]]) await run(lean,["-j1","-o",m+".olean","-c",c+".c",m+".lean"],dir);
		const defs=["-DPROBE_INIT=initialize_"+unit,"-DPROBE_BOX=lb_"+unit+"_box","-DPROBE_STRONG=lb_"+unit+"_strong","-DPROBE_KIND="+gen.prefix+"kind","-DPROBE_CONTROL="+control];
		for(const n of ["app","entry"]) await run(emcc,[...flags,...defs,"-include","renames.h","-c",n+".c","-o",n+".o"],dir);
		await run(emcc,[...link,"-Wl,--export="+control,"entry.o","app.o","-o","component.wasm"],dir);
		components.push({id,model: gen.model,control,bytes: await readFile(join(dir,"component.wasm"))});
	}
	const {default: create}=await import(pathToFileURL(join(runtime,"main.mjs")));
	const main=await readFile(join(runtime,"main.wasm"));
	for(const order of [components,components.toReversed()])
	{
		const wasm=await create({wasmBinary: main});assert.equal(wasm._bridge_lean_runtime_init(),1);
		const pending=installWasmHostDomain(wasm,broker);
		assert.equal(installWasmHostDomain(wasm,broker),pending);
		assert.throws(()=>installWasmHostDomain(wasm,Uint8Array.of(1)),/Conflicting/);
		const domain=await pending;
		for(const c of order)
		{
			const path="/"+c.id+".wasm";wasm.FS.writeFile(path,c.bytes);
			try
			{ await wasm.loadDynamicLibrary(path,{global: true,loadAsync: true,nodelete: true}); }
			finally
			{ wasm.FS.unlink(path); }
		}
		await exerciseDomain(wasm,domain,order);
	}
};

const exerciseDomain = async (wasm,domain,[a,b]) => {
	/** Real JavaScript class shared by two component bindings. */
	class Box
	{
		/** Return the same application instance. */
		identity() { return this; }
		/** Read the side effect performed by the compiled caller. */
		read() { return this.level; }
	}
	/** Separate class for the explicitly admitted strong kind. */
	class Token extends Box {}
	const obj=new Box();obj.level=0;
	let bindings=0;
	const supplied=Object.defineProperties({},{
		Box: {get: ()=>{ bindings++;return Box; }},Token: {value: Token}
	});
	const first=domain.bind(a.id,a.model,supplied), second=domain.bind(b.id,b.model,supplied);
	assert.equal(bindings,2);
	assert.throws(()=>domain.bind(a.id,a.model,{Box,Token: Box}),/incompatible/);
	const call=(c,s,op,k,v,value=0,expected=0)=>s.during(()=>{
		const token=v?s.pin(k,v):0, p=wasm._malloc(128)>>>0;
		assert.ok(p);
		try
		{
			wasm.HEAP8.fill(0,p,p+128);wasm.HEAP8.set(new TextEncoder().encode(c.control+"\0"),p+64);
			const field=(i,num)=>new DataView(wasm.HEAP8.buffer).setUint32(p+4*i,num,true);
			const get=i=>new DataView(wasm.HEAP8.buffer).getUint32(p+4*i,true);
			field(3,op);field(4,k);field(5,token);field(6,expected);field(7,value);
			const code=wasm._bridge_scalar_call(p+64,p);
			if(get(11)) throw domain.takeError(get(11)).error;
			assert.equal(code,0);
			if(op<=2 || op===6)
			{ assert.equal(s.resolve(k,get(8)),v);assert.equal(get(10),1); }
			return {token: get(8),address: get(9)};
		} finally
		{ if(token)s.release(token);wasm._free(p); }
	});
	const local=new Token(), tmp=call(a,first,6,1,local);
	assert.equal(domain.live(),0,"a transient strong object was never publicly admitted");
	first.during(()=>assert.throws(()=>first.resolve(1,tmp.token),/stale/));
	const initial=call(a,first,2,0,obj,13);
	assert.equal(domain.live(),1);
	call(a,first,4,0);
	assert.equal(domain.live(),0,"dropping the last weak Lean reference retires its host token");
	const x=call(a,first,2,0,obj,21);
	assert.notEqual(x.token,initial.token);
	assert.equal(obj.level,21);assert.equal(domain.live(),1);
	assert.equal(call(b,second,1,0,obj,42,x.address).token,x.token);
	assert.equal(obj.level,42);
	second.during(()=>assert.throws(()=>second.resolve(1,x.token),/wrong-kind/));
	const other=new Box();other.level=0;
	assert.notEqual(call(b,second,1,0,other,7).address,x.address);
	assert.equal(domain.live(),1);
	const strong=new Token(), left=call(a,first,1,1,strong);
	assert.equal(call(b,second,1,1,strong,0,left.address).token,left.token);
	assert.equal(domain.live(),2);
	const old=Object.getPrototypeOf(obj);
	Object.setPrototypeOf(obj,null);
	assert.throws(()=>call(b,second,1,0,obj),/wrong host class/);Object.setPrototypeOf(obj,old);
	const failure=new Error("host method"), read=obj.read;
	obj.read=()=>{throw failure;};
	assert.throws(()=>call(b,second,1,0,obj),e=>e===failure);obj.read=read;
	assert.equal(domain.heldErrors(),0);
	const innerFailure=new Error("inner component"), inner=new Box();inner.level=0;
	inner.read=()=>{throw innerFailure;};
	obj.read=()=>{
		assert.throws(()=>call(a,first,1,0,inner,65),e=>e===innerFailure);
		assert.throws(()=>second.close(),/active/);
		assert.equal(call(a,first,1,0,other,66).token>0,true);
		return obj.level;
	};
	assert.equal(call(b,second,1,0,obj,67,x.address).token,x.token);
	assert.equal(other.level,66);obj.read=read;
	assert.equal(domain.heldErrors(),0);
	first.during(()=>assert.throws(()=>first.close(),/active/));
	assert.equal(second.close(),true); assert.equal(domain.live(),2);
	assert.equal(call(a,first,1,0,obj,68,x.address).token,x.token);
	assert.equal(call(a,first,1,1,strong,0,left.address).token,left.token);
	assert.equal(first.close(),true); assert.equal(domain.live(),0);
	assert.throws(()=>first.during(()=>0),/closed/);
	const rebound=domain.bind(a.id,a.model,{Box,Token});
	assert.equal(call(a,rebound,3,0).token,0,"saved Lean value must be stale after final unbind");
	call(a,rebound,4,0);
	rebound.during(()=>assert.throws(()=>rebound.resolve(0,x.token),/stale/));
	assert.notEqual(call(a,rebound,1,0,obj,19).token,x.token);
	assert.equal(domain.live(),0);assert.equal(rebound.close(),true);assert.equal(rebound.close(),false);
};
