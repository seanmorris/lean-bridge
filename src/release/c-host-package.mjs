/** @file Package compiled application-owned C members for downstream C11 clients. */
import {mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {cIdentifier} from "../backends/c/generate.mjs";
import {boostSources} from "../backends/cpp/boost.mjs";
import {hashBindingIr} from "../binding-ir/canonical.mjs";
import {compileCHostComponent} from "../build/c-host-component.mjs";
import {readVerifiedNativeRuntime,validateNativeElf} from "../build/native-artifacts.mjs";
import {processBuildRunner} from "../build/process-runner.mjs";
import {canonicalJson,sha256} from "../capsule/node.mjs";
import {createDeterministicTarGzFromFiles} from "./deterministic-archive.mjs";
import {validateNativeCSettings} from "./native-c-family.mjs";
import {writePackageSetReceipt} from "./package-set-receipt.mjs";

/**
 * Publish a relocatable header, shared libraries and pkg-config/CMake imports.
 * Recheck the compiled bytes and the complete embedded SDK library inventory.
 *
 * @param o - Captured Lake project, verified SDK, target coordinates and release root.
 */
export const buildCHostPackage=async o=>{
	const {name,version,projectContract: contract,workRoot}=o;
	validateNativeCSettings({name,version});
	const {target}=o,cpp=target==="cpp";
	if(!["c","cpp"].includes(target) || !name || !version) throw new TypeError("Expected C/C++ host coordinates");
	const app=await mkdtemp(join(workRoot,".c-host-"));
	try
	{
		const b=await compileCHostComponent({...o,app,workerTransport: !cpp,publicWorkers: !cpp});
		const {manifest,identity: runtimeIdentity}=await readVerifiedNativeRuntime(o.runtimeRoot);
		if(runtimeIdentity!==b.runtimeIdentity) throw new Error("C host runtime changed during compilation");
		const floor=o.environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR??"2.38";
		if(!/^2\.(?:3[0-9]|[4-9][0-9])$/u.test(floor)) throw new TypeError("Invalid C host glibc floor");
		const files=new Map();
		for(const path of ["lib/"+b.component,"lib/"+b.domain,...b.workerLedger?["lib/"+b.workerLedger]:[],...Object.keys(manifest.files).filter(p=>p.startsWith("lib/"))])
		{
			const sdk=manifest.files[path],file=sdk?join(o.runtimeRoot,path):join(app,path.slice(4));
			const bytes=await readFile(file); validateNativeElf(bytes);
			if(sha256(bytes)!==(sdk?.sha256??b.binaries[path.slice(4)]) || !sdk && bytes.includes(Buffer.from(app)))
				throw new Error("C host binary provenance mismatch: "+path);
			const {stdout}=await processBuildRunner.capture({command: "readelf",args: ["--version-info",file],cwd: app,env: o.environment,signal: o.signal});
			for(const m of stdout.matchAll(/GLIBC_(\d+)\.(\d+)(?:\.(\d+))?/gu))
				if(+m[1]>2 || +m[1]===2 && (+m[2]>+floor.slice(2) || +m[2]===+floor.slice(2) && Number(m[3])>0)) throw new Error(path+" exceeds glibc "+floor);
			files.set(path,bytes);
		}
		const p=cIdentifier(name),share="share/lean-bridge",profile=cpp?"native-cpp-host-v1":"native-c-host-v1";
		const cmakePackage="LeanBridge"+p.split("_").map(s=>s[0].toUpperCase()+s.slice(1)).join(""),cmakeTarget="LeanBridge::"+p;
		files.set("include/"+p+(cpp?".hpp":".h"),b.publicHeader);
		for(const [path,bytes] of Object.entries(b.support??{})) files.set("include/"+path,bytes);
		const big=cpp && b.publicHeader.includes("#include <boost/multiprecision/cpp_int.hpp>");
		if(big) for(const [path,bytes] of Object.entries(boostSources())) files.set(path,bytes);
		files.set("lib/pkgconfig/"+name+".pc",[
			"prefix=${pcfiledir}/../.."
			, "libdir=${prefix}/lib"
			, "includedir=${prefix}/include"
			, "Name: "+name
			, "Description: Compiled Lean application-owned "+(cpp?"C++":"C")+" members"
			, "Version: "+version
			, "Libs: -L${libdir} -Wl,-rpath,${libdir} -l:"+b.component+(cpp?" -l:"+b.domain:"")
			, "Cflags: -I${includedir}"+(big?" -DBOOST_MP_STANDALONE":"")
			, ""
		].join("\n"));
		files.set("lib/cmake/"+cmakePackage+"/"+cmakePackage+"Config.cmake",[
			"if(NOT TARGET "+cmakeTarget+")"
			, '  get_filename_component(_lb_root "${CMAKE_CURRENT_LIST_DIR}/../../.." ABSOLUTE)'
			, "  add_library("+cmakeTarget+" SHARED IMPORTED)"
			, ...cpp?['  set_target_properties('+cmakeTarget+' PROPERTIES INTERFACE_COMPILE_FEATURES "cxx_std_20" INTERFACE_LINK_LIBRARIES "${_lb_root}/lib/'+b.domain+'"'+(big?' INTERFACE_COMPILE_DEFINITIONS "BOOST_MP_STANDALONE"':'')+')']:[]
			, '  set_target_properties('+cmakeTarget+' PROPERTIES IMPORTED_LOCATION "${_lb_root}/lib/'+b.component+'" INTERFACE_INCLUDE_DIRECTORIES "${_lb_root}/include")'
			, "  unset(_lb_root)"
			, "endif()"
			, ""
		].join("\n"));
		files.set(share+"/binding-ir.json",canonicalJson(b.api));
		files.set(share+"/host-imports.json",contract.hostImportsSource);
		files.set(share+"/elaboration.json",canonicalJson(b.evidence));
		files.set(share+"/generated.lean",await readFile(join(app,cpp?"BridgeCppExports.lean":"BridgeCExports.lean")));
		files.set(share+"/runtime.json",canonicalJson(manifest));
		if(b.workerWire) files.set(share+"/generated-workers.lean",await readFile(join(app,"BridgeCAsync.lean")));
		files.set(share+"/licenses/LeanBridge-LICENSE",await readFile(new URL("../../LICENSE",import.meta.url)));
		for(const f of ["LICENSE","LICENSES"]) files.set(share+"/licenses/Lean-"+f,await readFile(join(o.leanPrefix,f)));
		for(const [path,bytes] of Object.entries(contract.notices)) files.set(share+"/licenses/"+path,bytes);
		files.set("package-metadata.json",canonicalJson(contract.metadata??{}));
		if(cpp) files.set("README.md","# "+name+" "+version+"\n\nInclude "+p+".hpp. Instantiate lean_bridge::"+p+"::Binding with your application classes in the template parameter order of the header. Constructors use std::make_shared; methods and properties call the named C++ members. The binding preserves std::shared_ptr identity and rethrows the original member exception. Use the main process thread to call or close it. Destruction on another thread queues closure until the next owner call or lean_bridge::sync_v1::drain_host_closes(). Link pkg-config "+name+" or CMake "+cmakeTarget+". This Linux x86-64 C++20 release includes the shared runtime and requires a compatible libstdc++ ABI.\n");
		else files.set("README.md","# "+name+" "+version+"\n\nInclude "+p+".h and link using pkg-config "+name+" or CMake target "+cmakeTarget+" (Linux x86-64, glibc "+floor+"+). The runtime is included.\n\nRegister a table of C members with "+p+"_with_hosts on the main thread. A member returns zero on success or an application error code. Close the binding before freeing its context. Zero-initialize bindings, owners, aggregate outputs, and diagnostics; clear them with the matching public function before reuse. Adopt a payload with a destructor or NULL. Assignment aliases an owner; clone it for an independent lease. Members borrow receivers for the call. Return a clone for a leased result, not the borrowed receiver. Copied member outputs with a nonempty buffer transfer malloc-compatible storage. Returned Except is data; a thrown EIO and a host callback failure have distinct statuses.\n"+(b.workerWire?"\nStart object tasks and cursors on their binding. Poll on the process main thread; wait for readability on the borrowed descriptor without reading or closing it. Pull one stream item at a time. Close early to cancel. Retained callbacks run during poll; clone a borrowed object to return it. Callback drop releases your handle; close revokes the callback. A callback error may transfer a malloc-owned message and a payload with its destructor into a diagnostic. Clear the diagnostic after use.\n":""));
		const records=[...files].map(([path,v])=>({path,bytes: Buffer.isBuffer(v)?v:Buffer.from(v),mode: 0o644}));
		const inventory=Object.fromEntries(records.map(f=>[f.path,{bytes: f.bytes.length,sha256: sha256(f.bytes)}]));
		const bindingIrSha256=hashBindingIr(b.api),component=contract.component;
		const pkg={
			schemaVersion: 1
			, kind: "lean-bridge-native-c-package"
			, ecosystem: target
			, name, version, component, profile
			, componentIdentity: b.identity
			, runtimeIdentity, bindingIrSha256
			, hostImportsSourceSha256: b.evidence.hostImportsSourceSha256
			, hostDomain: b.domain
			, ...b.workerLedger?{workerLedger:b.workerLedger}:{}
			, library: b.component
			, ...cpp?{cppHostAbi: b.abi,cppStandard: 20}:{}
			, glibcMinimumVersion: floor
			, cmakePackage, cmakeTarget
			, pkgConfig: name
			, files: inventory
		};
		records.push({path: "lean-bridge-package.json",mode: 0o644,bytes: Buffer.from(canonicalJson(pkg))});
		const root=name+"-"+version+"-"+target,archive=root+".tar.gz";
		const data=createDeterministicTarGzFromFiles({files: records.map(f=>({...f,path: root+"/"+f.path})),sourceDateEpoch: 1});
		await writeFile(join(o.output,archive),data,{flag: "wx"});
		const receipt=await writePackageSetReceipt({
			root: workRoot
			, component
			, source: {treeSha256: contract.sourceTreeSha256}
			, profiles: [{id: profile,bindingIrSha256,runtimeIdentity}]
			, signal: o.signal
			, packages: [{
				target
				, ecosystem: target
				, name, version, profile
				, role: "component"
				, runtimeIdentity
				, runtimeDelivery: "embedded"
				, requires: []
				, artifacts: [{path: "archives/"+archive,bytes: data.length,sha256: sha256(data)}]
			}]
		});
		return {receipt,api: b.api,evidence: b.evidence,bindingIrSha256,runtimeIdentity};
	} finally
	{await rm(app,{recursive: true,force: true});}
};
