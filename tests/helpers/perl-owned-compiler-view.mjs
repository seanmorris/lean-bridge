/** @file Rebuild owned Perl XS with the staged SDK and compare both archives to a previously installed handoff. */
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";
import {projectOwnedPerl} from "../../src/build/owned-perl-projection.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {projectApplicationPackage} from "./application-package-projection.mjs";

test("the Perl compiler runtime view preserves the complete installed four-ABI package set",async t=>{
	const env=process.env,reference=env.LEAN_BRIDGE_PERL_VIEW_REFERENCE,pin=env.LEAN_BRIDGE_PERL_VIEW_REFERENCE_SHA256;
	assert.ok(reference&&pin);assert.equal(JSON.parse(env.LEAN_BRIDGE_PERLS).length,4);
	const verify=set=>readVerifiedPackageSetReceipt({receiptPath: join(set,"package-set-receipt.json")});
	const old=await verify(reference);assert.equal(old.result.receiptSha256,pin);
	assert.deepEqual(old.receipt.packages.map(p=>p.role).sort(),["component","runtime"]);
	const work=await mkdtemp(join(tmpdir(),"cpan-owned-compiler-"));t.after(()=>rm(work,{recursive: true,force: true}));
	const project=async o=>[await projectOwnedPerl({...o,settings: {module: "LeanBridge::TariffQuotes",version: "0.001"}})];
	const {set}=await projectApplicationPackage({work,root: join(work,"result")
		, handoff: env.LEAN_BRIDGE_PERL_APP_C,pin: env.LEAN_BRIDGE_PERL_APP_C_SHA256
		, route: env.LEAN_BRIDGE_PERL_APP_ROUTE
		, leanPrefix: env.LEAN_BRIDGE_LEAN_PREFIX
		, target: "cpan",project,donorTarget: "c"});
	const next=await verify(set);assert.deepEqual(next.receipt,old.receipt);
	assert.equal(next.result.receiptSha256,pin);
	t.diagnostic("Reproduced both archives at "+pin);
});
