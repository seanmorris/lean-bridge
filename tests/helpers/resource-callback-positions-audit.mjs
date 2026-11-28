/** @file Match the original installed Ticket callback clients to their execution reports. */
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {sha256} from "../../src/capsule/node.mjs";

const cppRevision="511f43f1b02a6bddb5517f47a497e8eda766a065";
const pyCalls=`api.construct(first, lambda ticket: dataclasses.replace(bundle, primary=ticket)) == bundle
api.factory(api.with_recovery(lambda unit: api.new_ticket(92, "factory"), first))
check(api.serial(made) == 92)`;
const rsCalls=`construct(first, |ticket: Ticket| Ok(sample(&ticket, second))).unwrap() == input
factory(with_recovery(|()| new_ticket(&BigUint::from(92u32), "factory"), first.clone()))
serial(&made).unwrap() == BigUint::from(92u32)`;
const cppCalls=`api::construct(first, [&](const api::Ticket& ticket) { return bundle(ticket, second); }) == input
return api::new_ticket(92, "factory"); }, first)
CHECK(api::serial(made) == 92)`;
const cCalls=`maker.recovery = &first
OK(owned_aggregates_factory(session, &maker, &made, &owner))
CHECK(made != first && made != second); serial_is(session, made, 700)`;
const cases=[
	{profile: "python",target: "pypi",client: "owned-installed-python.py"
		, revision: "ef9bd830d49a932a13bbc0d683a7a14cd7139b62",calls: pyCalls}
	, {profile: "rust",target: "cargo",client: "owned-installed-rust.rs"
		, revision: "78d2e09252d81f0b123d6175bb6ea454c9205577",calls: rsCalls}
	, {profile: "cpp",target: "cpp",client: "owned-installed-cpp.cpp"
		, revision: cppRevision,calls: cppCalls}
	, {profile: "c",target: "c",client: "owned-installed-host-callbacks.c"
		, revision: cppRevision,calls: cCalls}
];
const read=async path=>JSON.parse(await readFile(path));
for(const item of cases) test(item.profile+": installed positive callback resource positions",async()=>{
	const {profile,target,revision,client,calls}=item;
	const integration=await read("docs/evidence/owned-"+(profile==="c"?"cpp":profile)+"-integration-20260927.json");
	const bytes=await readFile(integration.execution.path);assert.equal(sha256(bytes),integration.execution.sha256);
	const record=JSON.parse(bytes),routes=profile==="c"?record.cPackages.callbacks:record.packages;
	const sourceAt=path=>execFileSync("git",["cat-file","blob",revision+":"+path]);
	const path="tests/fixtures/structured-types/"+client,source=sourceAt(path);
	assert.equal(sha256(source),record.sources[path]);
	for(const call of calls.split("\n")) assert.ok(source.toString().includes(call),profile+": "+call);
	const fixture=profile==="c"?"owned-host-callbacks":"owned-cpp-composition";
	const lean=sourceAt("tests/fixtures/onboarding/"+fixture+"/Owned.lean");
	const archives=new Set();
	for(const route of ["ordinary","reviewed"])
	{
		const r=routes[route];assert.equal(r.mode,route);assert.equal(r.consumerSha256,sha256(source));
		for(const flag of ["compiledLean","installedPackage","sourceFreeInstallation","handoffRemovedBeforeRelocatedExecution"])
			assert.equal(r[flag],true,profile+"/"+route+": "+flag);
		const mod=r.input.metadata.modules.find(m=>m.name==="Owned");
		assert.equal(r.input.sourceIdentity.modules[0].source.sha256,sha256(lean));
		assert.equal(mod.sourceSha256,sha256(lean));
		const selected=name=>mod.declarations.find(d=>d.identity==="Owned."+name&&d.selected);
		assert.equal(selected("factory").typeExpression,"(Unit → Owned.Ticket) → Owned.Ticket");
		if(profile!=="c") assert.equal(selected("construct").typeExpression,"Owned.Ticket → (Owned.Ticket → Owned.Bundle) → Owned.Bundle");
		assert.equal(r.componentReceipt.bindingIrSha256,r.packageSetReceipt.profiles[0].bindingIrSha256);
		const pkg=r.packageSetReceipt.packages.find(p=>p.target===target);assert.equal(pkg.artifacts.length,1);
		assert.match(pkg.artifacts[0].sha256,/^[0-9a-f]{64}$/u);archives.add(pkg.artifacts[0].sha256);
		if(profile==="python")
		{
			assert.equal(r.sourceFreeRelocatedExecution,true);assert.equal(r.observations.length,3);
			for(const e of r.observations) assert.deepEqual([e.checks,e.relocatedChecks],[120,120]);
		} else if(profile==="rust")
		{
			assert.equal(r.sourceFreeRelocatedExecution,true);assert.deepEqual([r.checks,r.relocatedChecks],[596,596]);
		} else
		{
			assert.equal(r.compilerFreeExecution,true);const expected=profile==="c"?693:577;
			assert.deepEqual([r.checks.cmake,r.checks.pkgConfig],[expected,expected]);
		}
	}
	assert.equal(archives.size,2);
});
