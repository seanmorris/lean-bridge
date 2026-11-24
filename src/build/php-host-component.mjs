/** @file Link checked Lean exports and synchronous native PHP member externs into an isolated component. */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { generatePhpHostExports } from "../backends/php/host-exports.mjs";
import { wordHostFrame } from "../backends/native/word-host-frame.mjs";
import { compileHostSources } from "./host-elaboration.mjs";
import { readVerifiedNativeRuntime, validateNativeElf } from "./native-artifacts.mjs";
import { processBuildRunner } from "./process-runner.mjs";
import { phpHostTaskKernel, stagePhpHostTasks } from "./php-host-task-kernel.mjs";

/**
 * Compile in a new, caller-owned staging directory. The two shared libraries
 * stay separate: independently published components must agree on one registry.
 *
 * @param o - Captured PHP project, verified native SDK, toolchain and private staging.
 */
export const compilePhpHostComponent = o => compile(o,false);
/**
 * Compile the private object-aware native kernel; not yet a Composer handoff.
 *
 * @param o - Captured PHP project and native SDK, as for the member compiler.
 */
export const compilePhpHostTaskComponent = o => compile(o,true);
const compile = async (o,taskObjects) => {
	const { app, ir, projectContract, runtimeRoot, leanPrefix, environment, signal } = o;
	if(!ir || !projectContract || !projectContract.modules?.length || !projectContract.hostImportsSource
		|| Boolean(projectContract.taskExports?.length || projectContract.asyncIterators?.length)!==taskObjects || projectContract.leanResources?.length)
		throw new TypeError("Expected synchronous PHP host imports with no independent resource or scheduler");
	const run = (command, args, cwd = app, env = environment) => processBuildRunner.capture({ command, args, cwd, env, signal });
	const save = (name, data) => writeFile(join(app, name), data, { flag: "wx" });
	const sdk = await readVerifiedNativeRuntime(runtimeRoot);
	const checked = await compileHostSources({ ...o, target: "php-native", run });
	const hashes = {}, domainParts = {};
	const assets = ["dotnet/host-domain.c", "dotnet/host-domain.h"
		, "dotnet/host-frame.h", "native/host-frame.c"
		, "dotnet/host-wire.h"
		, "c/task-integers.h"
		, "php/host-refs.php"
		, "php/host-words.php"
		, "php/host-frame.php"
		, "php/host-members.php"
		, "php/io-codec.php"
		, "php/copied-support.mjs"
		, "php/copied-assets.mjs"
		, "php/host-api.mjs", "php/io-package.mjs", "php/copied-equality.mjs"];
	if(taskObjects) assets.push("php/host-task-api.mjs","php/host-task-objects.php","php/host-tasks.php","php/io-callbacks.php","php/io-delivery.php");
	for(const name of assets)
	{
		const bytes = name === "native/host-frame.c" ? await wordHostFrame("php") : await readFile(new URL("../backends/" + name, import.meta.url));
		hashes[name] = sha256(bytes);
		if(name.startsWith("dotnet/host-domain.") || name === "dotnet/host-frame.h" || name === "php/host-refs.php" || name === "php/host-frame.php")
			domainParts[name] = hashes[name];
		if(/\.[ch]$/u.test(name)) await save(name.split("/").at(-1), bytes);
	}
	const runtimeIdentity = sdk.identity, domainId = sha256(canonicalJson({ runtimeIdentity, domainParts }));
	const domain = "liblb_php_host_domain_" + runtimeIdentity + ".so", domainFlag = "-DLB_DN_DOMAIN_PREFIX=lb_php_d_" + domainId + "_";
	const kernel=taskObjects && await phpHostTaskKernel({ir,checked,runtimeIdentity,modules: projectContract.modules,name: o.name});
	const spec = { ir, entries: checked.entries.filter(e=>!e.delivery), modules: projectContract.modules,phpTaskLeases: taskObjects };
	const baseline = generatePhpHostExports({ ...spec, identity: "0".repeat(64) });
	const identity = sha256(canonicalJson({ runtimeIdentity, domainId, hashes
		, api: checked.api, evidence: checked.evidence
		, header: baseline.header
		, source: baseline.source
		, ...kernel ? {taskKernel: kernel.fingerprint} : {}
		, entry: baseline.entryLean
		, name: o.name
		, version: o.version }));
	const gen = generatePhpHostExports({ ...spec, identity }), component = "lib" + gen.prefix + ".so";
	const flags = ["-std=gnu11", "-O1", "-g0", "-DNDEBUG"
		, "-shared", "-fPIC", "-fvisibility=hidden"
		, "-Werror=implicit-function-declaration"
		, "-Werror=incompatible-pointer-types"
		, "-ffile-prefix-map=" + app + "=/build/lean-bridge/php"
		, "-I" + join(leanPrefix, "include")
		, "-I" + join(runtimeRoot, "include"), domainFlag];
	const libs = ["-L" + join(runtimeRoot, "lib"), "-lleanshared", "-Wl,-z,defs,-z,nodelete", "-Wl,--build-id=none", "-Wl,-rpath,$ORIGIN"];
	const cc = environment.CC ?? "cc";
	await run(cc, [...flags, "host-domain.c", ...libs, "-Wl,-soname," + domain, "-o", domain]);
	const taskUnits=kernel ? await stagePhpHostTasks({kernel,identity,save,run,app,cc,leanPrefix,runtimeRoot,env: checked.env}) : [];
	await save("BridgePhpExports.lean", gen.entryLean); await save("entry-abi.h", gen.header); await save("provider.c", gen.source);
	await run(join(leanPrefix, "bin/lean"), ["-j1", "-c", "entry.c", "BridgePhpExports.lean"], app, checked.env);
	const units = [];
	for(const [index, object] of [...checked.objects, "entry.c"].entries())
	{
		const file = "checked" + index + ".c"; await save(file, '#include "' + object + '"\n#include "entry-abi.h"\n'); units.push(file);
	}
	const extraSymbols=kernel?" "+kernel.port.symbols.join("; ")+";":"";
	await save("provider.map", "{ global: " + gen.prefix + "_call; " + gen.prefix + "_clear;"+extraSymbols+" local: *; };\n");
	await run(cc, [...flags, ...units, ...taskUnits
		, "provider.c", "host-frame.c", "-L."
		, ...kernel?[kernel.ledger.flag,"-l:"+kernel.ledger.name,"-pthread"]:[]
		, "-l:" + domain, ...libs, "-llean_bridge_native"
		, "-Wl,--version-script=provider.map"
		, "-Wl,-soname," + component
		, "-o"
		, component]);
	const binaries = {};
	for(const name of [component, domain,...kernel?[kernel.ledger.name]:[]])
	{
		const bytes = await readFile(join(app, name)); validateNativeElf(bytes); binaries[name] = sha256(bytes);
	}
	return { api: checked.api, evidence: checked.evidence
		, entries: checked.entries, runtimeIdentity, identity
		, prefix: gen.prefix
		, component
		, domain
		, ...kernel?{task: {coordinate: o.name,methods: kernel.methods,port: kernel.port,ledger: kernel.ledger.name}}:{}
		, binaries
		, kinds: gen.model.kinds
		, members: gen.model.members };
};
