/** @file Prepare a native Composer host-object package from freshly checked Lean sources. */
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { generatePhpHostFiles } from "../backends/php/host-api.mjs";
import { generatePhpHostExports } from "../backends/php/host-exports.mjs";
import { hostPublicHash } from "../analyze/host-records.mjs";
import { readVerifiedNativeRuntime, validateNativeElf } from "../build/native-artifacts.mjs";
import { compilePhpHostComponent,compilePhpHostTaskComponent } from "../build/php-host-component.mjs";
import { processBuildRunner } from "../build/process-runner.mjs";
import { sha256 } from "../capsule/node.mjs";
import { writePhpCompiledDistribution } from "./php-io-package.mjs";

/**
 * Package only the component and registry matching the compiled checksums, plus
 * the two libraries belonging to the verified SDK. Apply the same glibc floor
 * to every ELF, not just to the newly generated component.
 *
 * @param o - Captured source, runtime, Composer coordinates, outputs and cancellation signal.
 */
export const buildPhpHostPackage = async o => {
	const app = await mkdtemp(join(o.workRoot, ".php-host-"));
	try
	{
		const tasks=Boolean(o.projectContract.taskExports?.length || o.projectContract.asyncIterators?.length);
		const linked = await (tasks?compilePhpHostTaskComponent:compilePhpHostComponent)({ ...o, app });
		const { manifest, identity } = await readVerifiedNativeRuntime(o.runtimeRoot);
		if(identity !== linked.runtimeIdentity) throw new Error("PHP host runtime changed after compilation");
		const floor = o.environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? "2.38";
		if(!/^2\.(?:3[0-9]|[4-9][0-9])$/u.test(floor)) throw new TypeError("Invalid PHP host glibc floor");
		const files = new Map(), libraries = {};
		for(const n of ["libleanshared.so","liblean_bridge_native.so",linked.domain,...tasks?[linked.task.ledger]:[],linked.component])
		{
			const path = "lib/"+n, dep=manifest.files[path], file=dep ? join(o.runtimeRoot,path) : join(app,n);
			const bytes=await readFile(file), hash=sha256(bytes); validateNativeElf(bytes);
			if(hash !== (dep?.sha256 ?? linked.binaries[n]) || !dep && bytes.includes(Buffer.from(app)))
				throw new Error("PHP host binary provenance mismatch: "+n);
			const {stdout}=await processBuildRunner.capture({command: "readelf",args: ["--version-info",file],cwd: app,env: o.environment,signal: o.signal});
			for(const m of stdout.matchAll(/GLIBC_(\d+)\.(\d+)(?:\.(\d+))?/gu))
				if(+m[1]>2 || +m[1]===2 && (+m[2]>+floor.slice(2) || +m[2]===+floor.slice(2) && Number(m[3])>0))
					throw new Error(n+" exceeds glibc "+floor);
			libraries[n]=hash; files.set(path,bytes);
		}
		const {files: generated, namespace}=await generatePhpHostFiles(linked,o.ir,manifest,o.projectContract.review);
		const port=generatePhpHostExports({ir: o.ir,entries: linked.entries.filter(e=>!e.delivery),modules: o.projectContract.modules,identity: linked.identity,phpTaskLeases: tasks});
		const workerSources={};
		if(tasks) for(const f of ["BridgeCAsync.lean","task-adapter.c","host-wire.c","host-task-leases.h"])
			workerSources[f]=await readFile(join(app,f));
		const metadata={...o,api: linked.api,evidence: linked.evidence
			, bindingIrSha256: hostPublicHash(linked.api)
			, componentIdentity: linked.identity
			, runtimeIdentity: identity
			, files
			, manifest
			, floor};
		return await writePhpCompiledDistribution(metadata,{tasks,host: true,profile: tasks?"native-php-host-task-v1":"native-php-host-v1",generated,namespace,libraries,port,taskPort: linked.task?.port,workerSources});
	} finally
	{ await rm(app,{recursive: true,force: true}); }
};
