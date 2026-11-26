/** @file Verify that installed Perl and Zend applications borrow and retain a function passed by Lean. */
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {sha256} from "../../src/capsule/node.mjs";
const git=(...args)=>execFileSync("git",args,{encoding: "utf8"});
const leanPath="tests/fixtures/onboarding/owned-dotnet-callables/Owned.lean";
const read=async(revision,file,caller)=>{
	const path="docs/evidence/"+file;
	assert.equal(git("hash-object","--no-filters",path),git("rev-parse",revision+":"+path));
	const record=JSON.parse(await readFile(path));
	const original=p=>git("cat-file","blob",revision+":"+p);
	const lean=original(leanPath),source=original(caller);
	assert.equal(sha256(lean),record.sources[leanPath]);assert.equal(sha256(source),record.sources[caller]);
	assert.ok(lean.includes("def withFunction (value : Bundle) (callback : (Bundle → Bundle) → Bundle → Bundle) : Bundle :=\n  callback id value"));
	return {record,source,lean,original};
};
test("eight installed CPAN clients per route retain the incoming Lean function",async()=>{
	const {record,source,original}=await read("20d95044ae6f1dcf2d156cd8043126a16bbd1b4e"
		, "owned-perl-integration-20260928.json","tests/fixtures/structured-types/owned-perl-signatures.pl");
	const producer=original("tests/owned-perl-package.test.mjs");
	for(const line of [
		'complete ? "owned-dotnet-callables"'
		, '"LeanBridge::OwnedProbe"'
		, '"consumer.pl", consumerSource'
		, '["consumer.pl", ...complete ? ["--installed"] : []]'
	]) assert.ok(producer.includes(line),line);
	for(const line of [
		"invoke('with_function', $bundle, sub"
		, "$retained = $function->retain()"
		, "return $function->call($value);"
		, "check($borrow->closed()"
		, "my $later = $retained->call($bundle);"
		, "same(invoke('serial', $later->primary), $large"
	])
		assert.ok(source.includes(line),line);
	const archives=new Set();
	for(const route of ["ordinary","reviewed"])
	{
		const r=record.packages["callbacks-"+route];assert.equal(r.consumerSha256,sha256(source));
		for(const flag of ["cliIntegrated","producerRemoved","receiptVerifiedWithoutProducer","installedPackage","relocated"])
			assert.equal(r[flag],true,flag);
		assert.equal(r.cliBuild.status,"ok");
		assert.equal(r.packageSetReceipt.profiles[0].bindingIrSha256,r.owned.bindingIrSha256);
		const pkg=r.packageSetReceipt.packages.find(p=>p.role==="component");
		assert.equal(pkg.target,"cpan");const archive=pkg.artifacts[0];
		assert.ok(r.packages.packages.some(p=>p.sha256===archive.sha256 && archive.path.endsWith("/"+p.archive)));
		archives.add(archive.sha256);
		const modes=new Set();
		for(const {perl,mode,observed} of r.observations)
		{
			modes.add(perl.split("/").at(-3)+"/"+mode);assert.ok(observed.exports.includes("with_function"));
			assert.equal(observed.checks,115);assert.equal(observed.brokerIdentities,0);
		}
		const expected=["5.36.3","5.38.2"].flatMap(v=>["threaded","unthreaded"].flatMap(t=>
			["prebuilt-only","build-xs"].map(m=>v+"-"+t+"/"+m)));
		assert.equal(r.observations.length,8);assert.deepEqual(modes,new Set(expected));
	}
	assert.equal(archives.size,2);
});
test("Zend itself receives and retains the callback argument on both installed author routes",async()=>{
	const {record,source,lean}=await read("4c13a5ffdb133cfda841a965e0c858e20300e5ba"
		, "owned-php-wasm-integration-20260928.json","tests/fixtures/structured-types/owned-php-wasm-installed.php");
	for(const l of [
		"call_value('with_function', [$bundle, function($fn, $value)"
		, "$saved = $fn->retain(); return $fn($value)"
		, "reject(fn() => $incoming($bundle), 4);"
		, "same_result($bundle, fn() => $saved($bundle))"
	]) assert.ok(source.includes(l),l);
	const p=record.reports.packages,archives=new Set();
	assert.equal(p.installedPackage,true);assert.equal(p.compiledLean,true);
	assert.deepEqual(p.observations.map(r=>r.reviewed),[false,true]);
	for(const r of p.observations)
	{
		assert.equal(r.consumerSha256,sha256(source));assert.equal(r.authorRemoved,true);assert.equal(r.receiptVerifiedWithoutProducer,true);
		assert.equal(r.receipt.sourceIdentity.modules[0].source.sha256,sha256(lean));
		const mod=r.inputs.metadata.modules.find(m=>m.name==="Owned"),d=mod.declarations.find(d=>d.identity==="Owned.withFunction");
		assert.equal(d.selected,true);assert.equal(d.typeExpression,"Owned.Bundle → ((Owned.Bundle → Owned.Bundle) → Owned.Bundle → Owned.Bundle) → Owned.Bundle");
		const set=r.packageSetReceipt,pkg=set.packages.find(p=>p.role==="component");
		assert.equal(pkg.target,"php-wasm");assert.equal(set.profiles[0].bindingIrSha256,r.receipt.bindingIrSha256);
		archives.add(pkg.artifacts[0].sha256);
		assert.deepEqual(r.executions.map(x=>[x.arrangement,x.loading,x.strict]),["embedded","composer"].flatMap(a=>
			["startup","lazy"].flatMap(l=>[0,1].map(s=>[a,l,s]))));
		assert.deepEqual(r.browser.observations.map(b=>b.arrangement),["embedded","composer"]);
		for(const b of r.browser.observations)
		{
			assert.deepEqual(b.executions.map(e=>[e.loading,e.mode]),["startup","lazy"].flatMap(l=>["weak","strict"].map(m=>[l,m])));
			assert.ok(b.executions.every(e=>e.realm==="chromium"));
		}
		for(const e of [...r.executions,...r.browser.observations.flatMap(b=>b.executions)])
		{
			assert.equal(e.observed.phpBits,32);assert.equal(e.observed.checks,169);assert.equal(e.cleaned.liveIdentities,0);
		}
	}
	assert.equal(archives.size,2);
});
