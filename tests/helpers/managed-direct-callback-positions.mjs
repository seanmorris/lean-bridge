/** @file Match installed NuGet, Maven and Composer callbacks to the actual calls they ran. */
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {sha256} from "../../src/capsule/node.mjs";
import {ownedJvmInstalledFixture} from "./owned-jvm-installed.mjs";

const git=(...args)=>execFileSync("git",args,{encoding: "utf8"});
const archived=(revision,path)=>git("cat-file","blob",revision+":"+path);
const base="tests/fixtures/structured-types/";
const historical={
	nuget: ["02d067429ab3b2b72d38270ea9c491c81017fe2f","owned-dotnet-execution-20260927.json"]
	, maven: ["578f04d09320e6998959390a3a0218ac6fd66d02","owned-jvm-execution-20260927.json"]
	, "php-native": ["76856dbb3954bdc7592493cf8bd1269576e3770e","owned-php-integration-20260928.json"]
};
const includes=(source,...parts)=>{for(const part of parts) assert.ok(source.includes(part),part);};
const cs=(rev,r)=>{
	const composition=archived(rev,base+"owned-installed-dotnet.cs");
	const probe=archived(rev,base+"owned-dotnet-callback-signatures.cs");
	const producer=archived(rev,"tests/owned-dotnet-packaging.test.mjs");
	const marker="    private static unsafe void Main(string[] args)";
	const main=producer.match(/\+ `( {4}private static void Main\(\)\n[^\x60]+?)`;/u)?.[1];
	assert.ok(main);includes(main,"HigherOrder(); checks += InstalledCompositions.Run();");
	assert.equal(probe.split(marker).length,2);
	const program=probe.split(marker)[0].replace("using LeanBridge.OwnedAggregates.Interop;\n","")+main;
	assert.equal(sha256(program),r.consumerSha256);assert.equal(sha256(composition),r.compositionsSha256);
	includes(program,"Api.WithFunction(bundle, (function, value) =>","var temporary = function.Invoke(value);"
		, "Api.Serial(temporary.Primary) == 17","escaped!.IsClosed && !retained!.IsClosed","result = retained!.Invoke(bundle)");
	includes(composition,"Same(Api.Construct(ticket, argument => Bundle(argument)), 42);"
		, "Check(Api.Serial(value.Primary) == serial","Compositions(); Callbacks(); Lifetimes();");
	assert.deepEqual(r.observation,{checks: 630,calls: 20,primitives: 19,safePublicApi: true});
	for(const key of ["installedNuget","sdkFreeExecution","consumerSourceRemoved","handoffRemoved","sourceFreeRelocatedExecution"])
		assert.equal(r[key],true,key);
};
const php=(rev,r)=>{
	const program=archived(rev,base+"owned-installed-php.php");assert.equal(sha256(program),r.sourceSha256);
	includes(program,"invoke('construct', $first, fn($ticket) => new Bundle($ticket,"
		, "check(semantic($actual) === semantic($expected)","invoke('with_function', $bundle, static function($function, $value)"
		, "$savedFunction = $function->retain(); return $function($value);"
		, "reject(fn() => $borrowedFunction($bundle), 4);","same_result($bundle, fn() => $savedFunction($bundle))");
	for(const key of ["sourceFreeInstallation","installedPackage","sourceFreeRelocatedExecution","handoffRemoved"])
		assert.equal(r[key],true,key);
	assert.deepEqual(r.observations.map(o=>o.caller),["weak","strict"]);
	for(const {observed} of r.observations)
	{
		assert.equal(observed.checks,241);assert.equal(observed.ordinaryAutoload,true);
		for(const name of ["construct","with_function","serial"]) assert.ok(observed.functions.includes(name));
	}
};
const jvm=async(r,mod,archive)=>{
	const fixture=await ownedJvmInstalledFixture(false,r.manifest.namespace,
		mod.declarations.filter(d=>d.selected).map(d=>d.identity.split(".").at(-1)));
	assert.equal(r.installedMaven,true);assert.equal(r.sourceRemovedBeforeInstallation,true);
	assert.deepEqual(r.observations.map(o=>o.profile),["java","kotlin"]);
	for(const {profile,jvm: installed,checks,observation} of r.observations)
	{
		const source=fixture.source(profile);assert.equal(sha256(source),installed.consumerSourceSha256);
		assert.equal(installed.archiveSha256,archive.sha256);
		for(const flag of ["repeatExecution","runtimeOnlyExecution","compilerFreeExecution","handoffRemovedBeforeExecution","publicApiOnly"])
			assert.equal(installed[flag],true,flag);
		const count=observation.results.find(row=>row.id==="owned/checks");assert.equal(count.status,"matched");
		assert.equal(Number(count.observed.integer),checks);assert.equal(checks,profile==="java"?104:67);
		if(profile==="java") includes(source,"exerciseValues(); exerciseCallbacks();","withFunction(input, (closure, value) ->"
			, "var nested = closure.invoke(value);","serial(nested.primary()).intValueExact() == 17"
			, "kept[0].invoke(input)","escaped[0].isClosed() && !kept[0].isClosed()"
			, "construct(ticket, borrowed -> new Bundle(borrowed,","serial(constructed.primary()).intValueExact() == 42");
		else includes(source,"withFunction(input) { closure, value ->","val nested = closure.invoke(value)"
			, "serial(nested.primary) == BigInteger.valueOf(17)","val retained = kept!!.invoke(input)"
			, "escaped!!.isClosed && !kept!!.isClosed");
	}
};
for(const [target,[rev,file]] of Object.entries(historical)) test(target+": original installed direct callback positions",async()=>{
	const path="docs/evidence/"+file;
	assert.equal(git("hash-object","--no-filters",path),git("rev-parse",rev+":"+path));
	const record=JSON.parse(await readFile(path)),archives=new Set();
	const lean=archived(rev,"tests/fixtures/onboarding/owned-dotnet-callables/Owned.lean");
	includes(lean,"callback id value","def construct (ticket : Ticket) (callback : Ticket → Bundle) : Bundle := callback ticket");
	for(const route of ["ordinary","reviewed"])
	{
		const r=record.packages[(target==="maven"?"callbacks-":"")+route],identity=r.input.sourceIdentity;
		assert.equal(r.compiledLean,true);assert.equal(Boolean(identity.reviewedBindingIr),route==="reviewed");
		const mod=r.input.metadata.modules.find(m=>m.name==="Owned");
		assert.equal(identity.modules[0].source.sha256,sha256(lean));assert.equal(mod.sourceSha256,sha256(lean));
		const type=n=>mod.declarations.find(d=>d.selected && d.identity==="Owned."+n).typeExpression;
		assert.equal(type("construct"),"Owned.Ticket → (Owned.Ticket → Owned.Bundle) → Owned.Bundle");
		assert.equal(type("withFunction"),"Owned.Bundle → ((Owned.Bundle → Owned.Bundle) → Owned.Bundle → Owned.Bundle) → Owned.Bundle");
		const receipt=r.packageSetReceipt,pkg=receipt.packages.find(p=>p.target===target);
		assert.equal(r.componentReceipt.bindingIrSha256,receipt.profiles.find(p=>p.id===pkg.profile).bindingIrSha256);
		const archive=pkg.artifacts.find(a=>/\.(jar|zip|nupkg)$/u.test(a.path));
		assert.match(archive.sha256,/^[0-9a-f]{64}$/u);archives.add(archive.sha256);
		if(target==="maven") await jvm(r,mod,archive);
		else if(target==="nuget") cs(rev,r);else php(rev,r);
	}
	assert.equal(archives.size,2);
});
