/**
 * Build a native Composer distribution from the compiled synchronous IO wire.
 *
 * @file
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { composerPackageMetadata } from "../analyze/package-metadata.mjs";
import { brickMathRequirement } from "../backends/php/brick-math.mjs";
import { compilePhpSyncSurface, compilePhpTaskSurface } from "../backends/php/io-surface.mjs";
import { generatePhpIOPort } from "../backends/php/io-port.mjs";
import { generatePhpIOFiles } from "../backends/php/io-package.mjs";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { processBuildRunner } from "../build/process-runner.mjs";
import { taskResourceLedger } from "../build/task-resource-ledger.mjs";
import { createDeterministicZip } from "./deterministic-zip.mjs";
import { writePackageSetReceipt } from "./package-set-receipt.mjs";

/**
 * Reconcile the public signatures again before packaging the exact compiled
 * bytes. The consumer installs a ZIP; there is no PHP-side compilation step.
 *
 * @param o - Compiled artifacts, host configuration and source evidence.
 */
export const writePhpIORelease=async o=>{
	const {name,version,api,evidence,bindingIrSha256,componentIdentity,runtimeIdentity,manifest,files,projectContract}=o;
	const tasks=!projectContract.synchronousIO, surface=tasks ? compilePhpTaskSurface : compilePhpSyncSurface;
	const model=surface({name,version,api,evidence,bindingIrSha256}),port=generatePhpIOPort(model);
	if(model.prefix!==o.prefix||canonicalJson(model.wire)!==canonicalJson(o.wire)||canonicalJson(port)!==canonicalJson(o.phpPort))
		throw new TypeError("PHP IO packaging differs from compiled port");
	const library="lib"+model.prefix+".so",libraries={};
	const nativeLedger = model.leases.size ? await taskResourceLedger(runtimeIdentity) : null;
	if((nativeLedger?.id ?? null) !== (o.ledgerId ?? null)) throw new TypeError("PHP IO uses an unexpected lease library");
	for(const n of ["libleanshared.so","liblean_bridge_native.so",...nativeLedger ? [nativeLedger.name] : [],library])
	{
		const path="lib/"+n,b=files.get(path); if(!b) throw new Error("Missing compiled PHP dependency: "+n);
		const h=sha256(b); if(n!==library && n!==nativeLedger?.name && manifest.files[path]?.sha256!==h) throw new Error("PHP native runtime changed: "+n);
		libraries[n]=h;
	}
	if(files.size!==Object.keys(libraries).length) throw new Error("Unexpected PHP synchronous IO library");
	const profile=tasks ? "native-php-task-v1" : "native-php-io-v1";
	const ledger = nativeLedger && { id: nativeLedger.id, library: nativeLedger.name, sha256: libraries[nativeLedger.name] };
	const asset={componentId: api.component.id,componentIdentity,runtimeIdentity,library,libraries,...ledger ? { ledger } : {}};
	const generated=await generatePhpIOFiles(model,asset);
	return writePhpCompiledDistribution(o, { tasks, profile, namespace: model.namespace, libraries, generated, port, ledger });
};

/**
 * Assemble one deterministic Composer ZIP and hash its complete library/source inventory.
 *
 * @param o - Verified artifacts and publisher workspace.
 * @param distribution - Generated facade, loader and checked ABI for the selected profile.
 */
export const writePhpCompiledDistribution = async (o, distribution) => {
	const {name,version,api,evidence,bindingIrSha256,componentIdentity,runtimeIdentity,manifest,files,workRoot,projectContract}=o;
	const {tasks,profile,namespace,libraries,generated,port,ledger,host}=distribution;
	const root=join(workRoot,"packages/php-native/composer"),inventory={};
	const save=async(path,bytes)=>{
		await mkdir(dirname(join(root,path)),{recursive: true}); await writeFile(join(root,path),bytes,{flag: "wx"});
		inventory[path]={bytes: Buffer.byteLength(bytes),sha256: sha256(bytes)};
	};
	for(const [p,b] of Object.entries(generated))
	{
		await save(p,b);
		await processBuildRunner.capture({command: o.environment.LEAN_BRIDGE_PHP??"php",args: ["-n","-l",p],cwd: root,env: o.environment,signal: o.signal});
	}
	for(const n of Object.keys(libraries)) await save("native/linux-x64/"+n,files.get("lib/"+n));
	for(const [p,b] of Object.entries(projectContract.notices)) await save("licenses/"+p,b);
	await save("licenses/Lean-LICENSE",await readFile(join(o.leanPrefix,"LICENSE")));
	await save("licenses/Lean-LICENSES",await readFile(join(o.leanPrefix,"LICENSES")));
	await save("licenses/LeanBridge-LICENSE",await readFile(new URL("../../LICENSE",import.meta.url)));
	if(host)
	{
		await save("lean-bridge/host-imports.json", projectContract.hostImportsSource);
		await save("lean-bridge/host-provider.c",port.source); await save("lean-bridge/entry-abi.h",port.header);
		await save("lean-bridge/BridgePhpExports.lean",port.entryLean);
	} else
	{ await save("lean-bridge/port.c",port.source); await save("lean-bridge/php-io-port.h",port.header); }
	await save("lean-bridge/binding-ir.json",canonicalJson(api)); await save("lean-bridge/elaboration.json",canonicalJson(evidence));
	await save("lean-bridge/runtime.json",canonicalJson(manifest));
	const usage=host ? "Bind application classes with withHosts(['Box' => YourClass::class]), call methods on the binding and close it in finally. Substitute the class names from your host contract. Original PHP exceptions, Lean IO errors and declared EIO failures remain distinct." : tasks ? "Tasks return Amp futures; call ->await() to receive a result. Iterate pull streams with foreach. Pass an Amp cancellation token to the generated function to cancel the operation; passing one only to await cancels that wait. Composer installs Amp and Revolt. No compiler is required." : "Calls execute synchronously on the original Linux x86-64 PHP CLI thread. IO errors and typed EIO exceptions are distinct from returned Ok/Err values. The native runtime is included; no compiler or event loop is required.";
	await save("README.md","# "+name+"\n\nInstall with Composer and call the functions in "+namespace+". "+usage+" Requires PHP 8.2+ NTS, FFI and glibc "+o.floor+"+.\n");
	const glibcMinimumVersion = o.floor;
	const bridge = { profile, namespace, platform: "linux-x86_64", glibcMinimumVersion };
	const require = { php: ">=8.2 <9", "ext-ffi": "*", ...brickMathRequirement, ...tasks ? { "amphp/amp": "^3.1", "revolt/event-loop": "^1.0" } : {} };
	const metadata = composerPackageMetadata(projectContract.metadata??{});
	const autoload = { files: ["src/Api.php"] }, extra = { "lean-bridge": bridge };
	const description = host ? "Compiled Lean calls on application-defined PHP classes" : tasks ? "Compiled Lean tasks and pull streams for PHP" : "Synchronous compiled Lean functions for PHP";
	const composer = { name, version, type: "library", description, ...metadata, require, autoload, extra };
	await save("composer.json",canonicalJson(composer));
	const source = { treeSha256: projectContract.sourceTreeSha256 };
	const kind = host ? "lean-bridge-native-php-host" : tasks ? "lean-bridge-native-php-task" : "lean-bridge-native-php-io";
	const component = { schemaVersion: 1, kind
		, profile, component: api.component, name, version, namespace, bindingIrSha256
		, componentIdentity, runtimeIdentity, sourceTreeSha256: source.treeSha256
		, glibcMinimumVersion
		, libraries
		, files: inventory, ...ledger ? { ledger } : {} };
	await save("lean-bridge/package-receipt.json",canonicalJson(component));
	const filename=name.replace("/","-")+"-"+version+"-linux-x86_64.zip";
	const bytes=await createDeterministicZip({directory: root,sourceDateEpoch: 315532800});
	await writeFile(join(o.output,filename),bytes,{flag: "wx"});
	const artifacts = [{ path: "archives/"+filename, bytes: bytes.length, sha256: sha256(bytes) }];
	const pkg = { target: "php-native", ecosystem: "composer", name, version
		, profile, role: "component", runtimeIdentity, runtimeDelivery: "embedded"
		, requires: [], artifacts };
	const profiles = [{ id: profile, bindingIrSha256, runtimeIdentity }];
	const receipt = await writePackageSetReceipt({ root: workRoot, component: api.component, source, profiles, signal: o.signal, packages: [pkg] });
	return {receipt,api,evidence,runtimeIdentity,bindingIrSha256};
};
