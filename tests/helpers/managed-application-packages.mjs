/** @file Produce one pair of canonical host-function releases for independent JVM and PHP installations. */
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {buildCanonicalProject} from "../../src/build/canonical-build.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {copyPackageSetHandoff} from "./package-set.mjs";
import {prepareStagedQuoteProject} from "./staged-quote-project.mjs";

test("build both ordinary and reviewed Maven/Composer application-function handoffs",{timeout: 7_200_000},async t=>{
	const parent=process.env.LEAN_BRIDGE_MANAGED_APPLICATION_KEEP;
	assert.ok(parent,"supply an existing directory for the verified consumer handoffs");
	const sets=await mkdtemp(join(resolve(parent),"sets-"));
	const targets=process.env.LEAN_BRIDGE_MANAGED_APPLICATION_NUGET==="1"?["maven","nuget","php-native"]:["maven","php-native"];
	t.diagnostic("Consumer handoffs: "+sets);
	const digests=[];
	for(const route of ["ordinary","reviewed"])
	{
		const work=await mkdtemp(join(tmpdir(),"managed-app-"));
		try
		{
			const project=join(work,"author"),out=join(work,"out"),set=join(sets,route);
			await prepareStagedQuoteProject(project,route,targets,{hostFunctions: true,ticketExchange: true});
			await buildCanonicalProject({projectRoot: project,outputRoot: out,targets,environment: process.env});
			await copyPackageSetHandoff(out,set);
			const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(set,"package-set-receipt.json")});
			assert.deepEqual(receipt.packages.map(p=>p.target).sort(),targets);digests.push(result.receiptSha256);
			t.diagnostic(route+": "+result.receiptSha256);
		}
		finally
{await rm(work,{recursive: true,force: true});}
	}
	assert.notEqual(digests[0],digests[1]);
});
