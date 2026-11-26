/** @file Build native facade replays against authenticated component and private GMP inputs. */
import assert from "node:assert/strict";
import {copyFile,link,mkdir,readFile,realpath} from "node:fs/promises";
import {basename,join,resolve} from "node:path";
import {generateOwnedCPackage} from "../../src/backends/c/owned-package.mjs";
import {generateOwnedDotnetPackage} from "../../src/backends/dotnet/owned-package.mjs";
import {generateOwnedJvmPackage} from "../../src/backends/jvm/owned-package.mjs";
import {nativeCallbackHeader} from "../../src/backends/native/callback-broker.mjs";
import {linuxBrokerHeader} from "../../src/backends/native/runtime-broker.mjs";
import {ownedDotnetAdapterSources} from "../../src/build/owned-dotnet-artifacts.mjs";
import {ownedJvmAdapterSources} from "../../src/build/owned-jvm-artifacts.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";
import {generateOwnedPhpPackage} from "../../src/backends/php/owned-package.mjs";
import {ownedPhpAdapterSources} from "../../src/build/owned-php-artifacts.mjs";
const env=process.env,digest=async p=>sha256(await readFile(p));
const readJson=async p=>JSON.parse(await readFile(p));
/**
 * Borrow only GMP and the broker header from the verified NuGet release,
 * not its application model, component, binding or clients.
 *
 * @param work - Temporary staging directory.
 * @param source - Authenticated native component and runtime.
 * @param run - Process runner.
 */
export const privateGmp=async(work,source,run)=>{
	const donor=resolve(env.LEAN_BRIDGE_FRAME_GMP_HANDOFF);
	const pin=await readJson(join("docs/evidence/dotnet-function-fields-20261126",basename(donor)+".json"));
	const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(donor,"package-set-receipt.json")});
	assert.equal(result.receiptSha256,pin.receiptSha256);const [pkg]=receipt.packages;
	assert.deepEqual(pkg.artifacts,[pin.archive]);assert.equal(pkg.target,"nuget");
	assert.equal(pkg.runtimeIdentity,source.component.runtimeIdentity);
	const archive=join(donor,pin.archive.path),member=async path=>JSON.parse(await run("unzip",["-p",archive,path]));
	const inventory=await member("lean-bridge/package-receipt.json"),runtime=await member("lean-bridge/runtime.json");
	const lib="libgmp-lean-bridge.so.10",key="runtimes/linux-x64/native/"+lib;
	const hdr="lean-bridge/adapter/gmp/include/gmp.h";
	await run("unzip",["-j","-q",archive,key,hdr,"-d",work]);
	for(const k of [key,hdr]) assert.equal(await digest(join(work,basename(k))),inventory.files[k].sha256);
	const header=linuxBrokerHeader.replace("#ifdef __cplusplus\n}",nativeCallbackHeader+"\n#ifdef __cplusplus\n}");
	assert.equal(sha256(header),runtime.files["include/lean_bridge_native_runtime.h"].sha256);
	await saveLakeFile(work,"lean_bridge_native_runtime.h",header);
	for(const n of ["libleanshared.so","liblean_bridge_native.so"])
		assert.equal(await digest(join(source.lib,n)),runtime.files["lib/"+n].sha256);
	return {lib,donorReceipt: result.receiptSha256};
};
/**
 * Link one native adapter, independently of the package installation test.
 *
 * @param o - Verified source, GMP files, work directory and process runner.
 * @param target - Native host projection.
 */
export const buildFrameFacade=async(o,target)=>{
	const {work,source,privateLib,run}=o, {metadata,component,model}=source;
	const jvm=target==="jvm",php=target==="php";
	const generator={dotnet: generateOwnedDotnetPackage,jvm: generateOwnedJvmPackage,php: generateOwnedPhpPackage}[target];
	const ir=model.bindingIr, projection=generator(ir);
	const c=generateOwnedCPackage({metadata,sourceIdentity: model.sourceIdentity
		, component: model.component,valueCopies: Boolean(projection.c.copies?.length)
		, hostCallbacks: true});
	assert.ok(c.values.callbackArgumentViews && projection.canonicalEquality && !projection.wholeOwners);
	const prefix=c.values.prefix,library="lib"+prefix+"_"+target+".so",stage=join(work,target);
	const adapter=join(stage,"adapter"),native=join(stage,"native"),libraries={};
	await mkdir(native,{recursive: true});
	const inputs=[component.library,"liblean_bridge_native.so","libleanshared.so",privateLib];
	for(const n of inputs)
	{
		const path=await realpath(n===privateLib?join(work,n):join(source.lib,n));
		try
		{await link(path,join(native,n));}
		catch(e)
		{
			if(e.code!=="EXDEV") throw e;
			await copyFile(path,join(native,n));
		}
		libraries[n]=await digest(path);
	}
	assert.equal(libraries[component.library],component.nativeLibrary.sha256);
	const files=(php?ownedPhpAdapterSources:jvm?ownedJvmAdapterSources:ownedDotnetAdapterSources)(c,projection);
	for(const [n,v] of Object.entries(files)) await saveLakeFile(adapter,n,v);
	const flags=["-O1","-g0","-fPIC","-Wall","-Wextra","-Werror","-Iinclude","-Iinternal","-I"+work,"-I"+join(env.LEAN_BRIDGE_LEAN_PREFIX,"include")];
	if(jvm) flags.push("-I"+join(env.JAVA_HOME,"include"),"-I"+join(env.JAVA_HOME,"include/linux"));
	await run(env.CC??"cc",["-std=c11",...flags,"-c","src/"+prefix+"-"+target+".c","-o","api.o"],adapter);
	if(!php) await run(env.CXX??"c++",["-std=c++17",...flags,"-c","src/"+prefix+"-"+target+"-thread-exit.cpp","-o","guard.o"],adapter);
	const linkArgs=["-shared","-pthread","api.o",...php?[]:["guard.o"],"-L"+native
		, "-Wl,--no-as-needed",...inputs.map(n=>"-l:"+n),"-Wl,-z,defs,-z,nodelete"
		, "-Wl,-rpath,$ORIGIN","-Wl,-soname,"+library,"-o",join(native,library)];
	await run(env.CXX??"c++",linkArgs,adapter);
	libraries[library]=await digest(join(native,library));
	const pkg=generator(ir,{componentId: ir.component.id
		, componentReceiptSha256: sha256(canonicalJson(component))
		, runtimeIdentity: component.runtimeIdentity
		, ownedValues: projection.contract,library,libraries});
	return {stage,native,pkg};
};
