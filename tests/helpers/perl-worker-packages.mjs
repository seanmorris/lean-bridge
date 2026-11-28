/** @file Build CPAN worker releases with the installed CLI and run fresh relocated Perl consumers. */
import assert from "node:assert/strict";
import { access, copyFile, link, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCliNpmPackage } from "../../src/release/cli-npm-package.mjs";
import { readVerifiedCpanPackage } from "../../src/release/cpan-package.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { verifyPerlHostFiles } from "../../src/release/perl-host-payload.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";
import { checkInstalledPerlHostPair } from "./perl-host-installed.mjs";
import { preparePerlWorkerProject } from "./perl-worker-project.mjs";

const receiptName="package-set-receipt.json";
const verify=dir=>readVerifiedPackageSetReceipt({receiptPath: join(dir,receiptName)});
const readJson=async path=>JSON.parse(await readFile(path,"utf8"));
const preserve=async (from,to)=>{
	await mkdir(dirname(to),{recursive: true});
	try
	{ await link(from,to); }
	catch(e)
	{ if(e.code!=="EXDEV") throw e; await copyFile(from,to); }
};
const checkTampering=async (manifest,files)=>{
	const installer=await readFile("src/backends/perl/Build.pm","utf8");
	for(const name of ["Component.xs","task-wire.h","host-worker-xs.h"])
	{
		const bad=new Map(files);
		bad.set(name,Buffer.concat([files.get(name),Buffer.from("\n")]));
		await assert.rejects(verifyPerlHostFiles(manifest,bad,installer),/generated payload differs/u);
	}
	const key="lib/"+manifest.module.replaceAll("::","/")+"/native/"+manifest.hostImports.resourceLedger.library;
	const bad=new Map(files), bytes=Buffer.from(files.get(key));
	bytes[bytes.length-1]^=1; bad.set(key,bytes);
	await assert.rejects(verifyPerlHostFiles(manifest,bad,installer),/worker library or ledger differs/u);
	const unselected=new Map(files), evidence=JSON.parse(files.get("elaboration.json"));
	delete evidence.selection.perlTaskObjects; unselected.set("elaboration.json",Buffer.from(canonicalJson(evidence)));
	await assert.rejects(verifyPerlHostFiles(manifest,unselected,installer),/source evidence differs/u);
};

test("installed ordinary and reviewed CPAN workers share objects without sharing cancellation",{timeout: 7_200_000},async t=>{
	const root=await mkdtemp(join(tmpdir(),"perl-worker-publish-"));
	t.after(()=>rm(root,{recursive: true,force: true}));
	const perls=JSON.parse(process.env.LEAN_BRIDGE_PERLS??'["perl"]'), workerDeps=process.env.LEAN_BRIDGE_PERL_TASK_DEPS;
	assert.ok(workerDeps,"Set LEAN_BRIDGE_PERL_TASK_DEPS to the installed Future and IO::Async library directory");
	const env={...process.env,PERL5LIB: workerDeps,LEAN_BRIDGE_PERLS: JSON.stringify(perls)};
	const keep=process.env.LEAN_BRIDGE_PERL_WORKER_HANDOFFS;
	const releases=await mkdtemp(join(keep??root,"perl-worker-releases-"));
	if(keep)t.diagnostic("retained handoffs: "+releases);
	const candidate=await buildCliNpmPackage({outputRoot: join(root,"candidate")}), tools=join(root,"tools");
	await run("npm",["install","--offline","--prefix",tools,"--ignore-scripts","--no-audit","--no-fund","--cache",join(root,"cache"),candidate.archive],root,env);
	await rm(candidate.output,{recursive: true});
	const cli=join(tools,"node_modules/.bin/lean-bridge"), seen=new Map(), packs=new Map();
	let firstProvider=null, sharedLedger=null;
	for(const route of ["ordinary","peer","reviewed","rejected"])
	{
		const project=join(root,"author-"+route), out=join(root,"stage"), dest=join(releases,route);
		const cfg=await preparePerlWorkerProject(project,route==="peer");
		await copyFile(resolve("LICENSE"),join(project,"LICENSE"));
		let review=null;
		if(route==="reviewed" || route==="rejected")
		{
			const ir=await readJson(join(releases,"ordinary/binding-ir.json"));
			if(route==="rejected") delete ir.declarations.find(d=>d.source.declaration==="Jobs.refuse").source.extensions["lean-bridge.dev/error-payload-site"];
			review=canonicalJson(ir); await writeFile(join(project,"public.binding-ir.json"),review);
			delete cfg.exports; await writeFile(join(project,"lean-bridge.exports.json"),canonicalJson(cfg));
		}
		const publish=()=>run(process.execPath,[cli,"build","--project",project,"--target","cpan","--output",out,"--json","--progress","none"],root,env,1_200_000);
		if(route==="rejected")
		{
			await assert.rejects(publish(),/Reviewed API differs from compiled host exports/u);
			await assert.rejects(access(join(out,receiptName)),{code: "ENOENT"});
			break;
		}
		await publish();
		const {receipt,result}=await verify(out), ev=await readJson(join(out,"host-export-evidence.json"));
		assert.equal(ev.selection.perlTaskObjects,true); assert.equal(ev.sourceTreeSha256,receipt.source.treeSha256);
		assert.equal(ev.hostImportsSourceSha256,sha256(await readFile(join(project,"lean-bridge.hosts.json"))));
		assert.equal(ev.reviewedSourceSha256,review===null?null:sha256(review));
		assert.deepEqual(result.profiles,["native-perl-task-v1"]);
		const {manifest,files}=await readVerifiedCpanPackage(join(out,"packages/component"));
		assert.equal(manifest.hostImports.profile,"native-perl-task-v1"); assert.equal(manifest.prebuilt.length,perls.length);
		const native="lib/"+manifest.module.replaceAll("::","/")+"/native/"+manifest.hostImports.library;
		if(route==="ordinary")
		{
			await checkTampering(manifest,files);
			firstProvider=files.get(native); sharedLedger=manifest.hostImports.resourceLedger;
		}
		else
		{
			assert.deepEqual(manifest.hostImports.resourceLedger,sharedLedger);
			const swapped=new Map(files); swapped.set(native,firstProvider);
			await assert.rejects(verifyPerlHostFiles(manifest,swapped,await readFile("src/backends/perl/Build.pm","utf8"))
				,/library or ledger differs|native image does not identify/u);
		}
		for(const file of [receiptName,receiptName+".sha256","binding-ir.json","host-export-evidence.json"]) await preserve(join(out,file),join(dest,file));
		const pack={}; packs.set(route,pack);
		for(const pkg of receipt.packages)
		{
			assert.equal(pkg.artifacts.length,1);
			const [a]=pkg.artifacts, path=join(dest,a.path);
			await preserve(seen.get(a.sha256)??join(out,a.path),path);
			seen.set(a.sha256,path); pack[pkg.role]=path; pack[pkg.role+"Sha"]=a.sha256;
		}
		assert.equal((await verify(dest)).result.receiptSha256,result.receiptSha256);
		t.diagnostic(route+" "+JSON.stringify({receipt: result.receiptSha256,component: pack.componentSha,runtime: pack.runtimeSha,ledger: manifest.hostImports.resourceLedger}));
		await rm(out,{recursive: true}); await rm(project,{recursive: true});
	}
	await rm(tools,{recursive: true});
	assert.equal(seen.size,4,"Three independent components and one shared runtime");
	const peer=packs.get("peer");
	for(const route of ["ordinary","reviewed"])
	{
		const main=packs.get(route); assert.equal(main.runtimeSha,peer.runtimeSha);
		const set={runtime: main.runtime,Workshop: main.component,Peer: peer.component};
		for(const perl of perls) for(const componentMode of ["prebuilt-only","build-xs"])
		{
			await checkInstalledPerlHostPair({scratch: root,set,route,interpreter: perl,workerDeps,componentMode});
			t.diagnostic(route+" "+componentMode+" "+perl+": relocated applications passed in both load orders");
		}
	}
});
