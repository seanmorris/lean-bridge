/** @file Ship original guest-owned WIT objects with their compiled synchronous or canonical asynchronous Lean application. */
import {mkdtemp,mkdir,readFile,rm,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {hashBindingIr} from "../binding-ir/canonical.mjs";
import {canonicalJson,sha256} from "../capsule/node.mjs";
import {compileCHostComponent} from "../build/c-host-component.mjs";
import {readVerifiedNativeRuntime,validateNativeElf} from "../build/native-artifacts.mjs";
import {processBuildRunner} from "../build/process-runner.mjs";
import {buildWitApplicationTemplate,compileWitApplicationCommand} from "../build/wit-application-template.mjs";
import {compileWitPeerPackage} from "../build/wit-peer-package.mjs";
import {canonicalWasmtimeIdentity,snapshotSdk} from "./wit-canonical-package.mjs";
import {createDeterministicTarGzFromFiles} from "./deterministic-archive.mjs";
import {writePackageSetReceipt} from "./package-set-receipt.mjs";

const target="wit-wasi",share="share/lean-bridge";
const digest=b=>({bytes: b.length,sha256: sha256(b)});
/**
 * Ship the complete selected world. Mixed packages include the same compiled
 * synchronous operations, plus their canonical future and stream interfaces.
 *
 * @param o - Captured Lean project, import IR, private staging and pinned SDK.
 */
export const buildWitObjectPackage=async o=>{
	const {name,version,projectContract: contract,runtimeRoot,environment,signal}=o;
	if(!contract?.ir || contract.leanResources?.length)throw new TypeError("Expected application-owned WIT objects");
	const mixed=Boolean(contract.taskExports?.length || contract.asyncIterators?.length);
	const profile=mixed?"native-wit-object-task-v1":"native-wit-object-io-v1";
	const app=await mkdtemp(join(o.workRoot,".wit-object-")),out=join(app,"command"),sdk=join(app,"sdk");
	try
	{
		await mkdir(out);
		const b=await compileCHostComponent({...o,app,target,workerTransport: mixed,publicWorkers: mixed});
		const {identity: runtimeIdentity,manifest}=await readVerifiedNativeRuntime(runtimeRoot);
		if(b.runtimeIdentity!==runtimeIdentity)throw new Error("WIT application runtime changed during compilation");
		const run=(command,args,cwd)=>processBuildRunner.capture({command,args,cwd,env: environment,signal});
		const sdkFiles=await snapshotSdk(environment.LEAN_BRIDGE_ASYNC_WASMTIME_C_API,sdk);
		const common={app,out,b,name,version,wasm: environment.LEAN_BRIDGE_WASM_TOOLS??"wasm-tools",run};
		const template=await buildWitApplicationTemplate(common);
		if(Boolean(template.methods.length)!==mixed)throw new Error("Selected task declarations differ from WIT release template");
		const binary=await compileWitApplicationCommand({...common,template,cc: environment.CC??"cc",sdk,runtimeRoot});
		const files=new Map(),floor=environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR??"2.38";
		if(!/^2\.(?:3[0-9]|[4-9][0-9])$/u.test(floor))throw new TypeError("Invalid WIT object glibc floor");
		const addElf=async(path,file,expected)=>{
			const bytes=await readFile(file);validateNativeElf(bytes);
			if((expected && sha256(bytes)!==expected) || bytes.includes(Buffer.from(app)))throw new Error("WIT ELF provenance mismatch: "+path);
			const {stdout}=await run("readelf",["--version-info",file],out);
			for(const m of stdout.matchAll(/GLIBC_(\d+)\.(\d+)(?:\.(\d+))?/gu))
				if(+m[1]>2 || +m[1]===2 && (+m[2]>+floor.slice(2) || +m[2]===+floor.slice(2) && Number(m[3])>0))throw new Error(path+" exceeds glibc "+floor);
			files.set(path,bytes);
		};
		await addElf("bin/"+binary,join(out,binary));
		const peer=mixed?null:await compileWitPeerPackage({...common,cc: environment.CC??"cc",sdk,runtimeRoot,sdkIdentity: canonicalWasmtimeIdentity});
		if(peer)
		{await addElf("bin/"+peer.runner,join(out,peer.runner));await addElf("lib/"+peer.plugin,join(out,peer.plugin));}
		await addElf("lib/libwasmtime.so",join(sdk,"lib/libwasmtime.so"),sha256(sdkFiles.get("lib/libwasmtime.so")));
		for(const [lib,hash] of Object.entries(b.binaries))await addElf("lib/"+lib,join(app,lib),hash);
		for(const [path,meta] of Object.entries(manifest.files))if(path.startsWith("lib/"))await addElf(path,join(runtimeRoot,path),meta.sha256);
		for(const [path,value] of Object.entries(template.publicFiles))files.set("wit/"+path,value);
		const bindingIrSha256=hashBindingIr(b.api),review=contract.review;
		files.set(share+"/binding-ir.json",canonicalJson(b.api));files.set(share+"/elaboration.json",canonicalJson(b.evidence));
		files.set(share+"/runtime.json",canonicalJson(manifest));files.set(share+"/host-imports.json",contract.hostImportsSource);
		if(review)
		{
			if(review.sha256!==b.evidence.reviewedSourceSha256 || sha256(review.source)!==review.sha256 || review.semanticSha256!==bindingIrSha256)throw new Error("Reviewed WIT declarations differ from compiled source");
			files.set(share+"/reviewed.binding-ir.json",review.source);
		}
		files.set(share+"/licenses/Wasmtime-LICENSE",sdkFiles.get("LICENSE"));
		files.set(share+"/licenses/LeanBridge-LICENSE",await readFile(new URL("../../LICENSE",import.meta.url)));
		for(const n of ["LICENSE","LICENSES"])files.set(share+"/licenses/Lean-"+n,await readFile(join(o.leanPrefix,n)));
		for(const [n,bytes] of Object.entries(contract.notices))files.set(share+"/licenses/"+n,bytes);
		files.set("package-metadata.json",canonicalJson(contract.metadata??{}));
		files.set("README.md",`# ${name} ${version}\n\nBuild an object provider for the owner world in wit/deps/objects.wit and an application for the application world in wit/.${template.roles.includes("callbacks")?" Build a callback provider for the registrations world in wit/.":""} Extract the entire archive, then run:\n\n    bin/${binary} ${template.roles.map(role=>role+".wasm").join(" ")}\n\nThe program prints the signed 64-bit result of the application's ${mixed?"asynchronous":"synchronous"} run function. Its WIT imports use the provider's own resources and the compiled Lean operations. All native libraries are included for Linux x86-64 with glibc ${floor} or later. Running the package requires neither a Lean compiler, a Wasm SDK nor a network connection.\n`);
		const peerIdentity=peer?{peerRunner: sha256(files.get("bin/"+peer.runner)),peerAdapter: sha256(files.get("lib/"+peer.plugin))}:{};
		const commandIdentity=sha256(canonicalJson({component: b.identity,template: template.parts.map(sha256),roles: template.roles,runner: sha256(files.get("bin/"+binary)),wasmtime: canonicalWasmtimeIdentity,...peerIdentity}));
		if(peer)files.set("README.md",files.get("README.md")+"\nTo use compatible synchronous packages together, pass their installed directories in any order:\n\n    bin/lean-bridge-wit-run /path/to/first /path/to/second -- objects.wasm application.wasm\n\nBoth APIs operate on the same defining object instance. Only load trusted native packages.\n");
		const records=[...files].map(([path,value])=>({path,bytes: Buffer.from(value),mode: path.startsWith("bin/")?0o755:0o644}));
		const inner={
			schemaVersion: 1
			, kind: "lean-bridge-wit-object-package"
			, profile
			, name
			, version
			, component: b.api.component
			, componentIdentity: commandIdentity
			, runtimeIdentity
			, bindingIrSha256
			, hostDomain: b.domain
			, library: b.component
			, hostImportsSourceSha256: b.evidence.hostImportsSourceSha256
			, wasmtime: canonicalWasmtimeIdentity
			, glibcMinimumVersion: floor
			, command: "bin/"+binary
			, world: "wit/application.wit"
			, inputs: template.roles
			, ...(review?{reviewedSourceSha256: review.sha256}:{})
			, files: Object.fromEntries(records.map(f=>[f.path,digest(f.bytes)]))};
		records.push({path: "lean-bridge-package.json",mode: 0o644,bytes: Buffer.from(canonicalJson(inner))});
		const base=name+"-"+version+"-wit-wasi",archive=base+".tar.gz";
		const packed=createDeterministicTarGzFromFiles({sourceDateEpoch: 1,files: records.map(f=>({...f,path: base+"/"+f.path}))});
		await writeFile(join(o.output,archive),packed,{flag: "wx"});
		const receipt=await writePackageSetReceipt({
			root: o.workRoot
			, component: b.api.component,source: {treeSha256: contract.sourceTreeSha256}
			, profiles: [{id: profile,bindingIrSha256,runtimeIdentity}],signal
			, packages: [{target,ecosystem: target,name,version,profile,role: "component",runtimeIdentity,runtimeDelivery: "embedded",requires: [],artifacts: [{path: "archives/"+archive,...digest(packed)}]}]});
		return {receipt,api: b.api,evidence: b.evidence,bindingIrSha256,runtimeIdentity};
	}finally
	{await rm(app,{recursive: true,force: true});}
};
