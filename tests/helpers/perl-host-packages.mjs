/** @file Build CPAN host imports with the installed CLI, then install and call only the resulting archives. */
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {copyFile,mkdir,mkdtemp,readFile,rm,rename,statfs,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {basename,join,resolve} from "node:path";
import test from "node:test";
import {promisify} from "node:util";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {checkInstalledPerlHostPair} from "./perl-host-installed.mjs";
import {checkPerlHostIntegrity} from "./perl-host-package-integrity.mjs";
import {readVerifiedCpanPackage} from "../../src/release/cpan-package.mjs";
import {verifyPerlHostFiles} from "../../src/release/perl-host-payload.mjs";
import {buildCliNpmPackage} from "../../src/release/cli-npm-package.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {prepareNativeHostFixture} from "./native-host-import-check.mjs";

const exec=promisify(execFile), fixture=resolve("tests/fixtures/perl-host-meter");
const json=async p=>JSON.parse(await readFile(p,"utf8"));
const prepare=async(project,name)=>{
	await prepareNativeHostFixture(project,"perl"); await copyFile(resolve("LICENSE"),join(project,"LICENSE"));
	const irFile=join(project,"lean-bridge.hosts.json"), ir=await json(irFile);
	const box=ir.types[0], token=structuredClone(box); token.name="Token"; token.id="host:meter.Token"; token.resource.kindId="resource:meter.Token";
	token.host.identity="strong-canonical"; token.source.declaration="Token"; ir.types.push(token);
	const id=structuredClone(ir.declarations.find(d=>d.name==="identity"));
	id.owner=token.id; id.id=token.id+".identity"; id.receiver.type.id=token.id; id.result.type.id=token.id;
	id.source.declaration=id.overloadKey="Token.identity"; ir.declarations.push(id);
	// Intentionally noncanonical: verification must retain the authored bytes.
	await writeFile(irFile,JSON.stringify(ir,null,2)+"\n");
	const app=join(project,"Workshop.lean"), cfgFile=join(project,"lean-bridge.exports.json");
	let lean=await readFile(app,"utf8");
	for(const file of ["Public.lean.inc","Installed.lean.inc"]) lean+=await readFile(join(fixture,file),"utf8");
	await writeFile(app,lean.replaceAll("Workshop",name)); if(name!=="Workshop") await rename(app,join(project,name+".lean"));
	const lake=join(project,"lakefile.toml"); await writeFile(lake,(await readFile(lake,"utf8")).replaceAll("Workshop",name).replaceAll("workshop",name.toLowerCase()));
	const cfg=await json(cfgFile);
	cfg.modules=[name]; cfg.targets.cpan.module="LeanBridge::"+name;
	cfg.exports=[...cfg.exports.map(n=>n.split(".")[1]),"reply","replaced","plain","chooseObject","rejectObject","exhaust","keepToken","readToken","forgetToken","checkInputs","mixedFault"].map(n=>name+"."+n);
	await writeFile(cfgFile,canonicalJson(cfg));
};
const headroom=async(dir,mib)=>{
	const fs=await statfs(dir);
	if(fs.bavail*fs.bsize<mib*1024**2) throw new Error("Need "+mib+" MiB free for the next CPAN test phase in "+dir);
};
test("ordinary and reviewed CPAN host imports install and share retained values across independently compiled components",{timeout: 3_600_000},async t=>{
	const root=await mkdtemp(join(tmpdir(),"perl-host-releases-"));
	t.after(()=>rm(root,{recursive: true,force: true}));
	const scratch=await mkdtemp(join(process.env.LEAN_BRIDGE_TEST_CPAN_STAGE_PARENT??tmpdir(),"perl-host-handoff-"));
	t.after(()=>rm(scratch,{recursive: true,force: true}));
	const say=m=>process.stdout.write("# "+m+"\n");
	const perls=process.env.LEAN_BRIDGE_PERLS?JSON.parse(process.env.LEAN_BRIDGE_PERLS):[process.env.LEAN_BRIDGE_PERL??"perl"];
	const packed=await buildCliNpmPackage({outputRoot: join(root,"candidate")}), tools=join(root,"producer");
	await exec("npm",["install","--prefix",tools,"--offline","--ignore-scripts","--no-audit","--no-fund","--cache",join(root,"npm-cache"),packed.archive],{cwd: root});
	await rm(packed.output,{recursive: true}); const cli=join(tools,"node_modules/.bin/lean-bridge");
	const archives=join(root,"archives"); await mkdir(archives);
	const seen=new Map(),reviews=new Map(),sets=new Map(),components=new Map();
	const env={...process.env,LEAN_BRIDGE_PERLS: JSON.stringify(perls),LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR: process.env.LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR??"2.38"};
	for(const route of ["ordinary","reviewed"])
	{
		const set={}; sets.set(route,set);
		for(const name of ["Workshop","Peer"])
		{
			await headroom(scratch,420);
			const project=join(scratch,name), out=join(scratch,"release");
			await prepare(project,name);
			if(route==="reviewed") await writeFile(join(project,"public.binding-ir.json"),reviews.get(name));
			say("Building "+route+" "+name+" with "+perls.length+" XS ABI(s)");
			try
			{await exec(process.execPath,[cli,"build","--project",project,"--target","cpan","--output",out,"--json","--progress","none"],{cwd: root,env});}
			catch(e)
			{throw new Error([e.stdout,e.stderr].join("\n"),{cause: e});}
			const {receipt}=await readVerifiedPackageSetReceipt({receiptPath: join(out,"package-set-receipt.json")});
			assert.equal(receipt.profiles[0].id,"native-perl-host-v1"); assert.equal(receipt.packages.length,2);
			const api=await json(join(out,"binding-ir.json")), ev=await json(join(out,"host-export-evidence.json"));
			assert.equal(ev.hostImportsSourceSha256,sha256(await readFile(join(project,"lean-bridge.hosts.json"))));
			if(route==="ordinary")
			{ api.documentation.summary+=" Reviewed for the CPAN consumer."; reviews.set(name,JSON.stringify(api,null,2)+"\n"); }
			assert.equal(ev.reviewedSourceSha256,route==="ordinary"?null:sha256(reviews.get(name)));
			const {manifest,files}=await readVerifiedCpanPackage(join(out,"packages/component"));
			assert.equal(manifest.hostImports.profile,"native-perl-host-v1"); assert.equal(manifest.prebuilt.length,perls.length);
			assert.ok(!components.has(manifest.hostImports.librarySha256),"Expected an independent component for "+route+" "+name);
			components.set(manifest.hostImports.librarySha256,{route,name});
			if(name==="Workshop" && route==="ordinary") await checkPerlHostIntegrity(join(out,"packages/component"),root);
			const installer=await readFile("src/backends/perl/Build.pm","utf8");
			for(const file of ["Component.xs","ph-interface.h","host-imports.json",...(route==="reviewed"?["reviewed-api.json"]:[])])
			{
				const changed=new Map(files); changed.set(file,Buffer.concat([files.get(file),Buffer.from("\n")]));
				await assert.rejects(verifyPerlHostFiles(manifest,changed,installer),/differs|mismatch/u);
			}
			const extra=new Map(files); extra.set("lib/Unexpected.pm",Buffer.from("1;"));
			await assert.rejects(verifyPerlHostFiles(manifest,extra,installer),/unexpected installed file/u);
			for(const p of receipt.packages)
			{
				const [a]=p.artifacts, target=join(archives,a.sha256+"-"+basename(a.path));
				if(!seen.has(a.sha256))
				{await copyFile(join(out,a.path),target);seen.set(a.sha256,target);}
				if(p.role==="runtime")
				{if(set.runtime) assert.equal(set.runtime,target);set.runtime=target;}
				else
				{assert.equal(p.role,"component");set[name]=target;}
			}
			say("Verified "+route+" "+name+" component "+manifest.hostImports.librarySha256);
			await rm(out,{recursive: true}); await rm(project,{recursive: true});
		}
	}
	assert.equal(components.size,4);
	assert.equal(sets.get("ordinary").runtime,sets.get("reviewed").runtime,"Both source routes must pin the same shared runtime archive");
	assert.equal(seen.size,5,"Four component archives and exactly one runtime");
	await rm(tools,{recursive: true});
	for(const [route,set] of sets) for(const perl of perls)
	{
		await checkInstalledPerlHostPair({scratch,set,route,interpreter: perl});
		say("Installed and relocated "+route+" CPAN pair on "+perl+"; both load orders passed");
	}
});
