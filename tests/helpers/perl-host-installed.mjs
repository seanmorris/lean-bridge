/** @file Verify a pair of local CPAN releases without the producer or its environment. */
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {copyFile,mkdir,mkdtemp,readFile,rename,rm,statfs,symlink} from "node:fs/promises";
import {join,resolve} from "node:path";
import {promisify} from "node:util";
import {sha256} from "../../src/capsule/node.mjs";
import {nativeArtifactPaths} from "../../src/build/native-artifacts.mjs";
import {installCpanArchive} from "../../src/release/cpan-install.mjs";
const exec=promisify(execFile);
/**
 * Install into a fresh prefix, check the observed install modes, relocate it
 * and run real application calls in two new processes in opposite load orders.
 *
 * @param o - Archives keyed by package, installation mode and scratch directory.
 * @param o.scratch - Writable parent for the short-lived installation.
 * @param o.set - Paths to the verified runtime, Workshop and Peer archives.
 * @param o.route - Ordinary or independently reviewed author route.
 * @param o.interpreter - Perl executable whose ABI is being checked.
 * @param o.workerDeps - Independent Future and IO::Async installation for class-bearing workers.
 * @param o.componentMode - Override the default install mode to test both modes on each source route.
 */
export const checkInstalledPerlHostPair = async ({scratch,set,route,interpreter,workerDeps=null,componentMode=route==="reviewed"?"build-xs":"prebuilt-only"}) => {
	assert.ok(["build-xs","prebuilt-only"].includes(componentMode));
	const fs=await statfs(scratch); if(fs.bavail*fs.bsize<500*1024**2) throw new Error("Need 500 MiB for an isolated CPAN consumer");
	const work=await mkdtemp(join(scratch,"consumer-")), original=join(work,"prefix"), relocated=join(work,"relocated"), tools=join(work,"tools");
	try
	{
		const perl=(await exec(interpreter,["-e","print $^X"])).stdout.trim();
		assert.ok(perl.startsWith("/"));
		await mkdir(tools);
		const programs=["make","tar","gzip","sh","cp","mv","rm","chmod","mkdir","touch","true"];
		if(componentMode==="build-xs") programs.push("cc","gcc","x86_64-linux-gnu-gcc","as","ld");
		for(const cmd of programs) await symlink("/usr/bin/"+cmd,join(tools,cmd));
		const dependencies=workerDeps?{PERL5LIB: workerDeps}:{};
		const clean={...dependencies,PATH: tools,LD_BIND_NOW: "1"
			, LEAN_NUM_THREADS: "1"
			, MAKEFLAGS: "-j1"
			, CC: "/unavailable/compiler"
			, CXX: "/unavailable/compiler"
			, LEAN_BRIDGE_LEAN_PREFIX: "/unavailable/lean"
			, LEAN_BRIDGE_NATIVE_ROOT: "/unavailable/runtime"};
		for(const key of ["runtime","Workshop","Peer"])
		{
			const mode=key==="runtime"?"prebuilt-only":componentMode;
			try
			{
				const environment=mode==="build-xs"?{...clean,CC: "/usr/bin/cc",LD: "/usr/bin/cc"}:clean;
				await installCpanArchive({archive: set[key]
					, workingRoot: work
					, prefix: original
					, perl,mode,environment});
			}
			catch(e)
			{throw new Error([e.message,e.details?.stderr,e.details?.stdout].filter(Boolean).join("\n"),{cause: e});}
		}
		await rename(original,relocated);
		const lib=join(relocated,"lib/perl5"), paths=await nativeArtifactPaths(lib);
		const receipts=paths.filter(n=>n.endsWith("/install-receipt.json"));
		assert.equal(receipts.length,3);
		const checked=new Set(), installedXsDigests={};
		for(const path of receipts)
		{
			const receipt=JSON.parse(await readFile(join(lib,path)));
			const name=path.split("/").at(-2), arch=receipt.abi.archname;
			assert.equal(path,arch+"/LeanBridge/"+name+"/install-receipt.json");
			checked.add(name);
			assert.equal(receipt.operation,componentMode==="build-xs" && name!=="Runtime"?"generated-xs-only":"prebuilt-xs");
			const installedXs=join(lib,arch,"auto/LeanBridge",name,name+".so");
			assert.equal(sha256(await readFile(installedXs)),receipt.outputSha256);
			installedXsDigests[name]=receipt.outputSha256;
		}
		assert.deepEqual([...checked].sort(),["Peer","Runtime","Workshop"]);
		const client=join(work,"client.pl");await copyFile(resolve("tests/fixtures",workerDeps?"perl-host-workers":"perl-host-meter","installed-pair.pl"),client);
		const clientEnv={...dependencies,PATH: "/unavailable",LD_BIND_NOW: "1",LEAN_NUM_THREADS: "1",EXPECT_PERL_LIB: lib};
		const errorClient=join(work,"error-owner.pl"), errorOwners=[];
		if(!workerDeps) await copyFile(resolve("tests/fixtures/perl-host-meter/error-owner.pl"),errorClient);
		for(const order of [["Workshop","Peer"],["Peer","Workshop"]])
		{
			const r=await exec(perl,["-I"+lib,client,...order],{cwd: work,env: clientEnv,timeout: 90000});
			assert.equal(r.stderr,"");assert.match(r.stdout,workerDeps?/load order and sibling shutdown passed/u:/errors and reentry passed/u);
			if(!workerDeps) {
				const check=await exec(perl,["-I"+lib,errorClient,...order],{cwd:work,env:clientEnv,timeout:90000});
				assert.equal(check.stderr,"");
				const result=JSON.parse(check.stdout);
				assert.deepEqual(result,{peer:order[0],thrower:order[1],before:23,after:42,weakCleared:1,destructions:1,peerAfter:37});
				errorOwners.push(result);
			}
		}
		if(workerDeps)
		{
			await copyFile(resolve("tests/fixtures/perl-host-workers/public.pl"),join(work,"public.pl"));
			const r=await exec(perl,["-I"+lib,join(work,"public.pl")],{cwd: work,env: clientEnv,timeout: 90000});
			assert.equal(r.stderr,""); assert.match(r.stdout,/demand, reentry and scoped cancellation/u);
		}
		else return {componentMode,installedXsDigests,originalClientSha256:sha256(await readFile(client)),
			clientSha256:sha256(await readFile(errorClient)),errorOwners};
	} finally
	{await rm(work,{recursive: true,force: true});}
};
