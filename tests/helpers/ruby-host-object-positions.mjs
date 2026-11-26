/** @file Replay four host-object positions from original Ruby package handoffs. */
import assert from "node:assert/strict";
import {mkdir,mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {exerciseRubyWorkerGems} from "./installed-ruby-worker-gems.mjs";

const positions=["parameter","result","callback-parameter","callback-result"];
const fixture="identity-positions.rb";
const checkPlacements=ir=>{
	const box=ir.types.find(t=>t.id==="host:meter.Box");
	assert.equal(box.host.identity,"strong-canonical");assert.deepEqual(box.host.targets,["ruby"]);
	const leased=v=>{
		assert.equal(v.type.id,box.id);assert.equal(v.ownership,"lease");assert.equal(v.lifetime.scope,"explicit");
	};
	const pick=name=>ir.declarations.find(d=>d.source.declaration==="Workers."+name);
	const plain=pick("plain"),relay=pick("relay");
	assert.equal(plain.parameters.length,1);leased(plain.parameters[0]);leased(plain.result);
	const cb=ir.types.find(t=>t.id===relay.parameters[1].type.id);
	assert.equal(cb.kind,"callback");assert.equal(cb.callable.parameters.length,1);
	leased(cb.callable.parameters[0]);leased(cb.callable.result);
};
const origin=async(dir,route)=>{
	const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(dir,"package-set-receipt.json")});
	const [pkg]=receipt.packages;assert.equal(receipt.packages.length,1);assert.equal(pkg.artifacts.length,1);
	assert.equal(pkg.name,route==="peer"?"workshop-peer":"workshop");assert.equal(pkg.profile,"native-ruby-host-v1");
	const raw=await readFile(join(dir,"binding-ir.json"));
	const ev=JSON.parse(await readFile(join(dir,"host-export-evidence.json")));
	assert.equal(ev.sourceTreeSha256,receipt.source.treeSha256);
	if(route==="reviewed") assert.equal(ev.reviewedSourceSha256,sha256(raw));else assert.ok(!ev.reviewedSourceSha256);
	if(route!=="peer") checkPlacements(JSON.parse(raw));
	return {name: pkg.name,version: pkg.version
		, receiptSha256: result.receiptSha256,archive: pkg.artifacts[0]
		, runtime: pkg.runtimeIdentity,source: receipt.source.treeSha256
		, bindingIr: receipt.profiles[0].bindingIrSha256,publicIr: sha256(raw)};
};

const checkInstalled=async(root,r)=>{
	const dir=join(root,"gems",r.name+"-"+r.version+"-x86_64-linux","lean-bridge");
	const raw=await readFile(join(dir,"binding-ir.json")),meta=JSON.parse(await readFile(join(dir,"package-receipt.json")));
	assert.equal(meta.name,r.name);assert.equal(meta.sourceTreeSha256,r.source);
	assert.equal(meta.runtimeIdentity,r.runtime);assert.equal(meta.bindingIrSha256,r.bindingIr);
	assert.deepEqual(meta.files["lean-bridge/binding-ir.json"],{bytes: raw.length,sha256: r.publicIr});
	assert.equal(sha256(raw),r.publicIr);
	if(r.name==="workshop") checkPlacements(JSON.parse(raw));
};

test("original Ruby gems preserve distinct application objects in four positions",async t=>{
	const env=process.env,handoffs=resolve(env.LEAN_BRIDGE_RUBY_HOST_TASK_REPLAY);
	const work=await mkdtemp(join(tmpdir(),"ruby-object-positions-"));t.after(()=>rm(work,{recursive: true,force: true}));
	const releases={};
	for(const route of ["ordinary","reviewed","peer"]) releases[route]=await origin(join(handoffs,route),route);
	assert.equal(new Set(Object.values(releases).map(r=>r.runtime)).size,1);
	assert.equal(releases.ordinary.publicIr,releases.reviewed.publicIr);
	assert.notEqual(releases.ordinary.archive.sha256,releases.reviewed.archive.sha256);
	const fixtureSha256=sha256(await readFile(new URL("../fixtures/ruby-host-workers/"+fixture,import.meta.url)));
	for(const route of ["ordinary","reviewed"])
	{
		const inspectInstalled=async root=>{
			await checkInstalled(root,releases[route]);await checkInstalled(root,releases.peer);
		};
		const observations=await exerciseRubyWorkerGems({root: work
			, ruby: env.LEAN_BRIDGE_RUBY??"ruby",scripts: [fixture],inspectInstalled
			, primary: join(handoffs,route),peer: join(handoffs,"peer")});
		const report={route,primary: releases[route],peer: releases.peer,fixtureSha256,positions,observations};
		if(env.LEAN_BRIDGE_RUBY_POSITIONS_OUTPUT)
		{
			const out=resolve(env.LEAN_BRIDGE_RUBY_POSITIONS_OUTPUT);await mkdir(out,{recursive: true});
			await writeFile(join(out,route+".json"),canonicalJson(report));
		}
		t.diagnostic(route+": "+report.primary.receiptSha256+"; "+observations[0]);
	}
});
