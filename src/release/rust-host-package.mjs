/** @file Publish two Cargo crates from captured Rust host declarations and actual Lean object code. */
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { hashBindingIr } from "../binding-ir/canonical.mjs";
import { compileCHostComponent } from "../build/c-host-component.mjs";
import { readVerifiedNativeRuntime, validateNativeElf } from "../build/native-artifacts.mjs";
import { processBuildRunner } from "../build/process-runner.mjs";
import { sha256 } from "../capsule/node.mjs";
import { writeRustTaskRelease } from "./rust-task-package.mjs";

/**
 * Verify the component, domain and SDK bytes that the Rust loader embeds.
 *
 * @param o - Captured source, verified SDK directory, release coordinates and staging directory.
 */
export const buildRustHostPackage = async o => {
	const {workRoot,runtimeRoot,environment,signal}=o, app=await mkdtemp(join(workRoot,".rust-host-"));
	try
	{
		const b=await compileCHostComponent({...o,app,target: "cargo",workerTransport: true});
		const {manifest,identity: runtimeIdentity}=await readVerifiedNativeRuntime(runtimeRoot);
		if(runtimeIdentity!==b.runtimeIdentity) throw new Error("Rust host SDK changed during compilation");
		const floor=environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR??"2.38";
		if(!/^2\.(?:3[0-9]|[4-9][0-9])$/u.test(floor)) throw new TypeError("Invalid Rust host glibc floor");
		const files=new Map();
		for(const lib of [b.component,b.domain,...b.workerLedger?[b.workerLedger]:[],"libleanshared.so","liblean_bridge_native.so"])
		{
			const path="lib/"+lib,sdk=manifest.files[path],file=sdk?join(runtimeRoot,path):join(app,lib);
			const bytes=await readFile(file);validateNativeElf(bytes);
			if(sha256(bytes)!==(sdk?.sha256??b.binaries[lib]) || !sdk && bytes.includes(Buffer.from(workRoot))) throw new Error("Rust host ELF provenance mismatch: "+lib);
			const r=await processBuildRunner.capture({command: "readelf",args: ["--version-info",file],cwd: app,env: environment,signal});
			for(const m of r.stdout.matchAll(/GLIBC_(\d+)\.(\d+)(?:\.(\d+))?/gu))
				if(+m[1]>2 || +m[1]===2 && (+m[2]>+floor.slice(2) || +m[2]===+floor.slice(2) && Number(m[3])>0)) throw new Error(lib+" exceeds glibc "+floor);
			files.set(path,bytes);
		}
		const gen={entryLean: await readFile(join(app,"BridgeRustExports.lean")),header: await readFile(join(app,"entry-abi.h"))};
		if(b.workerWire) gen.workerLean=await readFile(join(app,"BridgeCAsync.lean"));
		return await writeRustTaskRelease({...o,host: {ir: o.ir,model: b.model,domain: b.domain,domainId: b.domainId,wire: b.workerWire,ledger: b.workerLedger},prefix: b.prefix,entries: b.entries,api: b.api,evidence: b.evidence,files,floor,gen,manifest,runtimeIdentity,bindingIrSha256: hashBindingIr(b.api),componentIdentity: b.identity});
	} finally
	{ await rm(app,{recursive: true,force: true}); }
};
