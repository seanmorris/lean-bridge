/** @file Compile source-checked host imports and public exports into a prepared NuGet release. */
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { generateDotnetHostExports } from "../backends/dotnet/host-exports.mjs";
import {hostPublicHash} from "../analyze/host-records.mjs";
import { compileDotnetHostDomain } from "../build/dotnet-host-domain.mjs";
import { dotnetHostTaskKernel, stageDotnetHostTasks } from "../build/dotnet-host-task-kernel.mjs";
import { compileHostSources } from "../build/host-elaboration.mjs";
import { readVerifiedNativeRuntime, validateNativeElf } from "../build/native-artifacts.mjs";
import { processBuildRunner } from "../build/process-runner.mjs";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { writeDotnetIORelease } from "./dotnet-io-package.mjs";

/**
 * Link the actual application and its generated CLR externs to the authenticated
 * shared runtime. No compiler or separate bridge library is needed by the app.
 *
 * @param o - Checked source selection, target coordinates, tools and private staging.
 */
export const buildDotnetHostPackage = async o => {
	const { ir, projectContract, workRoot, runtimeRoot, leanPrefix, environment, signal } = o;
	if(!ir || projectContract.leanResources.length) throw new TypeError("CLR host imports require a checked class contract; separate Lean-owned resource definitions are not supported in this package");
	const app = await mkdtemp(join(workRoot, ".dotnet-host-")), cc = environment.CC ?? "cc";
	const run = (command, args, cwd = app, env = environment) => processBuildRunner.capture({ command, args, cwd, env, signal });
	const save = (name, data) => writeFile(join(app, name), data, { flag: "wx" });
	try
	{
		const { identity: runtimeIdentity, manifest } = await readVerifiedNativeRuntime(runtimeRoot);
		const checked=await compileHostSources({ ...o, target: "nuget", app, run });
		const {api,objects,evidence,env}=checked, entries=checked.entries.filter(e=>!e.delivery);
		const kernel=checked.entries.some(e=>e.delivery)?await dotnetHostTaskKernel({checked,ir,runtimeIdentity,modules: projectContract.modules,name: o.name}):null;
		const domain = await compileDotnetHostDomain({ app, runtimeRoot, runtimeIdentity, leanPrefix, cc, run });
		const options = { ir, entries, modules: projectContract.modules, dotnetTaskLeases: Boolean(kernel) }, baseline = await generateDotnetHostExports({ ...options, identity: "0".repeat(64) });
		const hashes = {};
		if(entries.some(e=>e.result.kind==="io-closure"))
			hashes["dotnet/host-functions.cs"]=sha256(await readFile(new URL("../backends/dotnet/host-functions.cs",import.meta.url)));
		if(kernel) for(const f of ["host-worker-api.mjs","task-delivery.cs","task-loop.cs","task-callbacks.cs","host-task-scope.cs","host-worker-frame.cs"])
			hashes["dotnet/"+f]=sha256(await readFile(new URL("../backends/dotnet/"+f,import.meta.url)));
		for(const file of ["dotnet/host-wire.h", "c/task-integers.h", "dotnet/host-wire.cs", "dotnet/host-api.mjs", "dotnet/sync-io.mjs", "dotnet/sync-wire.cs", "dotnet/verified-assets.mjs", "dotnet/copied-conversions.mjs"])
		{
			const bytes = await readFile(new URL("../backends/" + file, import.meta.url)); hashes[file] = sha256(bytes);
			if(file.endsWith(".h")) await save(file.split("/").at(-1), bytes);
		}
		if(api.types.some(t=>t.kind==="record")) hashes["dotnet/host-records.mjs"]=sha256(await readFile(new URL("../backends/dotnet/host-records.mjs",import.meta.url)));
		const componentIdentity = sha256(canonicalJson({ api, evidence
			, domain: domain.id, runtimeIdentity, hashes
			, source: baseline.source, header: baseline.header, entry: baseline.entryLean
			, members: baseline.model.implementation
			, ...kernel?{worker: kernel.fingerprint}:{}
			, contract: baseline.model.contract
			, name: o.name
			, version: o.version }));
		const gen = await generateDotnetHostExports({ ...options, identity: componentIdentity }), { prefix } = gen;
		const library = "lib" + prefix + ".so";
		await save("BridgeDotnetExports.lean", gen.entryLean); await save("entry-abi.h", gen.header); await save("provider.c", gen.source);
		await run(join(leanPrefix, "bin/lean"), ["-j1", "-c", "entry.c", "BridgeDotnetExports.lean"], app, env);
		const units = [];
		if(kernel) units.push(...await stageDotnetHostTasks({kernel,identity: componentIdentity,app,save,run,cc,leanPrefix,runtimeRoot,env}));
		for(const [i, c] of [...objects, "entry.c"].entries())
		{
			const name = "checked" + i + ".c"; await save(name, '#include "' + c + '"\n#include "entry-abi.h"\n'); units.push(name);
		}
		const symbols=[prefix+"_call",prefix+"_clear",...kernel?[prefix+"_visit",prefix+"_object",...kernel.wire.symbols]:[]];
		await save("provider.map", "{ global: "+symbols.join("; ")+"; local: *; };\n");
		await run(cc, ["-std=gnu11", "-O2", "-g0", "-DNDEBUG"
			, "-shared", "-fPIC", "-fvisibility=hidden"
			, "-Werror=incompatible-pointer-types"
			, "-Werror=implicit-function-declaration"
			, "-ffile-prefix-map=" + app + "=/build/lean-bridge/host"
			, ...domain.includes
			, "-I" + join(runtimeRoot, "include")
			, domain.flag
			, ...kernel?[kernel.ledger.flag]:[]
			, ...units
			, "provider.c"
			, "host-frame.c"
			, "-L."
			, "-l:" + domain.name
			, ...kernel?["-l:"+kernel.ledger.name]:[]
			, "-L" + join(runtimeRoot, "lib")
			, "-lleanshared"
			, "-llean_bridge_native"
			, "-Wl,--version-script=provider.map"
			, "-Wl,-z,defs,-z,nodelete"
			, "-Wl,--build-id=none"
			, "-Wl,-rpath,$ORIGIN"
			, "-Wl,-soname," + library
			, "-o"
			, library]);
		const floor = environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? "2.38";
		if(!/^2\.(?:3[0-9]|[4-9][0-9])$/u.test(floor)) throw new TypeError("Invalid CLR host glibc floor");
		const files = new Map();
		for(const n of ["libleanshared.so", "liblean_bridge_native.so", domain.name, library,...kernel?[kernel.ledger.name]:[]])
		{
			const path = "lib/" + n, sdk = manifest.files[path], file = sdk ? join(runtimeRoot, path) : join(app, n);
			const bytes = await readFile(file); validateNativeElf(bytes);
			if(sdk ? sha256(bytes) !== sdk.sha256 : bytes.includes(Buffer.from(resolve(workRoot)))) throw new Error("Invalid CLR host binary provenance: " + n);
			for(const m of (await run("readelf", ["--version-info", file])).stdout.matchAll(/GLIBC_(\d+)\.(\d+)(?:\.(\d+))?/gu))
				if(+m[1] > 2 || (+m[1] === 2 && (+m[2] > +floor.slice(2) || (+m[2] === +floor.slice(2) && +m[3] > 0)))) throw new Error(n + " exceeds glibc " + floor);
			files.set(path, bytes);
		}
		const host = { ir, domain, entries, model: gen.model,...kernel?{workerWire: kernel.wire}:{} };
		return await writeDotnetIORelease({ ...o, host, prefix, files, api, evidence, runtimeIdentity, componentIdentity, bindingIrSha256: hostPublicHash(api), manifest, floor,ledgerId: kernel?.ledger.id });
	} finally
	{ await rm(app, { recursive: true, force: true }); }
};
