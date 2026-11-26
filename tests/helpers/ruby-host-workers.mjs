/** @file Qualify class-bearing workers from ordinary and reviewed Lean projects in relocated MRI installs. */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { appendFile, copyFile, cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { exerciseRubyWorkerGems } from "./installed-ruby-worker-gems.mjs";

const exec = promisify(execFile), cli = resolve("scripts/lean-bridge.mjs"), json = async file => JSON.parse(await readFile(file,"utf8"));
const ruby = process.env.LEAN_BRIDGE_RUBY ?? "ruby";
const run = async (command,args,o={}) => {
	try
	{ return (await exec(command,args,{...o,maxBuffer: 4*1024*1024})).stdout; }
	catch(e)
	{ throw new Error([e.message,e.stdout,e.stderr].filter(Boolean).join("\n"), {cause: e}); }
};
test("compiled gems preserve Ruby classes and failures across workers, cursors and two binding scopes", {
	timeout: process.env.LEAN_BRIDGE_RUBY_HOST_TASK_OUTPUT ? 7_200_000 : 1_200_000
}, async t => {
	const keep=process.env.LEAN_BRIDGE_RUBY_HOST_TASK_OUTPUT, root=await mkdtemp(join(keep ?? tmpdir(),"ruby-host-workers-"));
	if(!keep) t.after(()=>rm(root,{recursive: true,force: true}));
	const project=join(root,"author"), file=join(project,"lean-bridge.exports.json");
	await cp("tests/fixtures/ruby-host-meter",project,{recursive: true,filter: f=>!f.endsWith(".rb")});
	await copyFile(resolve("LICENSE"),join(project,"LICENSE"));
	await copyFile("tests/fixtures/ruby-host-workers/Workers.lean",join(project,"Workers.lean"));
	await appendFile(join(project,"lakefile.toml"),'\n[[lean_lib]]\nname = "Workers"\n');
	const config=await json(file), names=xs=>xs.map(x=>"Workers."+x);
	config.modules.push("Workers"); config.taskExports=names(["relay","fallback","outcome","reject","checkPair","scalar","weakEcho"]);
	config.taskIOErrors=names(["relay","fallback"]);
	config.asyncIterators=[{open: "Workers.openCursor",next: "Workers.pull",close: "Workers.close"}
		, {open: "Workers.openErrorCursor",next: "Workers.pullIO",close: "Workers.closeIO"}];
	config.exports.push(...config.taskExports,...config.asyncIterators.map(p=>p.open),...names(["plain","lifted","readLeaf"]));
	const hostFile=join(project,"lean-bridge.hosts.json"), ir=await json(hostFile);
	const leaf=structuredClone(ir.types[0]);
	leaf.id="host:meter.Leaf";leaf.name="Leaf";leaf.resource.kindId="resource:meter.Leaf";leaf.source.declaration="Leaf";
	const read=structuredClone(ir.declarations.find(d=>d.name==="read"));
	read.id=leaf.id+".read";read.owner=leaf.id;read.receiver.type.id=leaf.id;read.overloadKey="Leaf.read()";read.source.declaration="Leaf.read";
	ir.declarations.push(read);
	ir.types.push(leaf); ir.types[0].host.identity="strong-canonical"; await writeFile(hostFile,canonicalJson(ir));
	await writeFile(file,canonicalJson(config));
	const build = async (label,author=project) => {
		const out=join(root,label), invoke=(...args)=>run(process.execPath,[cli,...args,"--format","json"],{cwd: root});
		await invoke("build","--project",author,"--target","rubygems","--output",out);
		const receipt=join(out,"package-set-receipt.json"), verified=JSON.parse(await invoke("verify","--receipt",receipt)).result;
		assert.equal(verified.verified,true); assert.equal(verified.archives,1);
		const r=await json(receipt), a=r.packages[0].artifacts[0], api=await readFile(join(out,"binding-ir.json"));
		assert.equal((await json(join(out,"host-export-evidence.json"))).selection.rubyTaskObjects,true);
		t.diagnostic(label+" "+a.sha256+" "+a.bytes+" bytes; IR "+sha256(api));
		return {api: api.toString(),out};
	};
	const first=await build("ordinary");
	const reviewFile=join(project,"workshop.binding-ir.json"), peerProject=join(root,"peer-author");
	await cp(project,peerProject,{recursive: true});
	const peerCfg=structuredClone(config); peerCfg.targets.rubygems.name="workshop-peer";
	await writeFile(join(peerProject,"lakefile.toml"),(await readFile(join(peerProject,"lakefile.toml"),"utf8")).replace('name = "workshop"','name = "workshop-peer"'));
	await writeFile(join(peerProject,"lean-bridge.exports.json"),canonicalJson(peerCfg));
	const peer=await build("peer",peerProject);
	delete config.exports; await writeFile(file,canonicalJson(config));
	await writeFile(reviewFile,first.api);
	const reviewed=await build("reviewed"); assert.equal(first.api,reviewed.api);
	const bad=JSON.parse(first.api);
	bad.declarations.find(d=>d.source.declaration==="Workers.outcome").result.ownership="copy";
	bad.declarations.find(d=>d.source.declaration==="Workers.outcome").result.lifetime=null;
	await writeFile(reviewFile,canonicalJson(bad));
	await assert.rejects(build("stale"),/differ|ownership|lifetime/iu);
	await assert.rejects(readFile(join(root,"stale/package-set-receipt.json")),{code: "ENOENT"});
	await rm(reviewFile); config.exports=["Workers.direct"]; config.taskExports=config.exports; delete config.taskIOErrors; delete config.asyncIterators;
	await writeFile(file,canonicalJson(config));
	await appendFile(join(project,"Workers.lean"),"\nprivate def indirect (b : LeanBridge.Host.Ruby.Box) := b.read\ndef Workers.direct (b : LeanBridge.Host.Ruby.Box) := IO.asTask (indirect b)\n");
	await assert.rejects(build("direct"),/Ruby task calls a Ruby member outside its owner: Workers\.direct/u);
	await assert.rejects(readFile(join(root,"direct/package-set-receipt.json")),{code: "ENOENT"});
	await rm(project,{recursive: true}); await rm(peerProject,{recursive: true});
	for(const [name,g] of [["ordinary",first],["reviewed",reviewed]])
	{
		const scripts=["consumer.rb","private-tokens.rb","error-policy.rb","identity-positions.rb"];
		const result=await exerciseRubyWorkerGems({root,ruby,primary: g.out,peer: peer.out,scripts});
		if(keep)
		{
			const releases=[];
			for(const out of [g.out,peer.out])
			{
				const raw=await readFile(join(out,"package-set-receipt.json")), r=JSON.parse(raw);
				const ev=await json(join(out,"host-export-evidence.json")), [pkg]=r.packages;
				assert.equal(ev.sourceTreeSha256,r.source.treeSha256);
				const api=await json(join(out,"binding-ir.json"));
				for(const target of ["mapped","reject"])
				{
					const fn=api.declarations.find(d=>d.name===target);
					assert.equal(fn.source.extensions["lean-lang.org/effect"],"EIO");
					assert.equal(fn.failure.unexpected,"poison-runtime");
					assert.equal(fn.failure.mode,"declared");assert.equal(fn.failure.errors.length,1);
				}
				assert.equal(Boolean(ev.reviewedSourceSha256),out===reviewed.out);
				releases.push({name: pkg.name,receipt: sha256(raw)
					, archive: pkg.artifacts[0].sha256, runtime: pkg.runtimeIdentity
					, bindingIr: r.profiles[0].bindingIrSha256
					, source: ev.sourceTreeSha256, reviewed: ev.reviewedSourceSha256});
			}
			const clientSha256=sha256(await readFile("tests/fixtures/ruby-host-workers/error-policy.rb"));
			const policy=result.filter(s=>s.includes("nested fatal, dispatch 1/1"));
			assert.equal(policy.length,4);
			await writeFile(join(root,name+".error-policy.json"),canonicalJson({route: name,releases,clientSha256,policy}));
		}
		result.forEach(line=>t.diagnostic(name+" "+line));
	}
});
