/** @file Check cancellation of a pending Perl stream read on the pinned Pulse and Signals releases. */
import assert from "node:assert/strict";
import {copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import test from "node:test";
import {canonicalJson, sha256} from "../../src/capsule/node.mjs";
import {installCpanArchive} from "../../src/release/cpan-install.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";

const original=process.env.LEAN_BRIDGE_PERL_PARKED_ORIGINAL;
const json=async p=>JSON.parse(await readFile(p,"utf8"));
test("cancelling the parked Perl reader finalizes the cursor before a caller close",{skip: !original,timeout: 5400000},async t=>{
	const root=resolve(original),env=process.env,deps=env.LEAN_BRIDGE_PERL_TASK_DEPS;
	assert.ok(deps,"Set LEAN_BRIDGE_PERL_TASK_DEPS to the installed Future and IO::Async modules");
	const pin=await json("docs/evidence/perl-tasks-20261123.json");
	assert.equal(sha256(await readFile(join(root,"acceptance.json"))),pin.acceptanceSha256);
	const output=resolve(env.LEAN_BRIDGE_PERL_PARKED_OUTPUT??"build/perl-parked-pull");
	await mkdir(output,{recursive: true});
	const stage=await mkdtemp(join(tmpdir(),"perl-parked-"));t.after(()=>rm(stage,{recursive: true,force: true}));
	const client=join(stage,"parked.pl");await copyFile("tests/fixtures/perl-tasks/parked.pl",client);
	const clientSha256=sha256(await readFile(client)),packages=new Map();
	for(const p of pin.packages)
	{
		const dir=join(root,p.route,"handoff"),file=join(dir,"package-set-receipt.json");
		assert.equal(sha256(await readFile(file)),p.receiptSha256);
		const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: file});
		assert.equal(result.receiptSha256,p.receiptSha256);
		const get=role=>receipt.packages.find(k=>k.role===role).artifacts[0];
		assert.deepEqual(get("component"),p.component);assert.deepEqual(get("runtime"),pin.sharedRuntime);
		packages.set(p.route,{archive: join(dir,p.component.path),digest: p.receiptSha256});
		if(p.route==="ordinary") packages.set("runtime",{archive: join(dir,pin.sharedRuntime.path)});
	}
	const byRoute={ordinary: [],reviewed: []};
	for(const [i,interp] of JSON.parse(env.LEAN_BRIDGE_PERLS).entries())
	{
		const work=join(stage,"abi-"+i);await mkdir(work);
		const perl=await run(interp,["-e","print $^X"],work,env),tmp=join(work,"install"),moved=join(work,"relocated");
		const [version,arch]=JSON.parse(await run(perl,["-MConfig","-MJSON::PP","-e","print encode_json([$Config{version},$Config{archname}])"],work,env));
		const lib=(dir,role)=>join(dir,role,"lib/perl5"),hashes={};
		for(const [route,name] of [["runtime","Runtime"],["peer","Signals"],["ordinary","Pulse"],["reviewed","Pulse"]])
		{
			const libs=route==="runtime"?[deps]:[deps,lib(tmp,"runtime")];
			await installCpanArchive({
				archive: packages.get(route).archive, prefix: join(tmp,route)
				, workingRoot: work, perl, mode: "prebuilt-only"
				, environment: {...env,PERL5LIB: libs.join(":")}
			});
			const dir=join(lib(tmp,route),arch),installed=await json(join(dir,"LeanBridge",name,"install-receipt.json"));
			const hash=sha256(await readFile(join(dir,"auto/LeanBridge",name,name+".so")));
			assert.equal(installed.operation,"prebuilt-xs");assert.equal(hash,installed.outputSha256);hashes[route]=hash;
			if(route==="ordinary" || route==="reviewed")
				assert.ok(pin.rows.some(r=>r.route===route && r.version===version && r.installedXsSha256===hash),"Pulse XS was not in the original installed run");
		}
		await rename(tmp,moved);
		for(const route of ["ordinary","reviewed"])
		{
			const libs=[lib(moved,route),lib(moved,"peer"),lib(moved,"runtime"),deps];
			const child={
				PATH: "/no-author-tools", LANG: "C.UTF-8", LEAN_NUM_THREADS: "1"
				, LD_BIND_NOW: "1", PERL5LIB: libs.join(":")
			};
			const checks={};
			for(const order of ["peer-first","pulse-first"])
			{
				const msg=await run(perl,[client,order],work,child,120000);
				assert.equal(msg,"blocked pull: reader cancel and cursor close each finalized once; usable peer, no late value, zero live owners and descriptor delta");
				checks[order]=msg;
			}
			byRoute[route].push({version,arch,xs: {pulse: hashes[route],signals: hashes.peer,runtime: hashes.runtime},checks});
		}
		await rm(work,{recursive: true});
	}
	for(const [route,interpreters] of Object.entries(byRoute))
		await writeFile(join(output,route+".json"),canonicalJson({
			route,packageSetSha256: packages.get(route).digest
			, peerPackageSetSha256: packages.get("peer").digest
			, sharedRuntimeSha256: pin.sharedRuntime.sha256
			, clientSha256
			, interpreters}));
});
