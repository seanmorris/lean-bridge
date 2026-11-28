/** @file Install the combined canonical NuGet releases offline and check the direct Ticket application. */
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {canonicalJson} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {runDotnetApplication} from "./dotnet-application-client.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";

test("both NuGet author routes forward application delegates and exchange distinct Tickets",async()=>{
	const env=process.env,sets=env.LEAN_BRIDGE_DOTNET_APPLICATION_REPLAY;
	assert.ok(sets&&env.LEAN_BRIDGE_DOTNET,"supply a combined NuGet handoff and .NET 8 SDK");
	const out=resolve(env.LEAN_BRIDGE_DOTNET_APPLICATION_OUTPUT??"build/dotnet-application-functions"),rows=[];
	for(const route of ["ordinary","reviewed"])
	{
		const set=resolve(sets,route);
		const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(set,"package-set-receipt.json")});
		assert.deepEqual(receipt.packages.map(p=>p.target).sort(),["maven","nuget","php-native"]);
		const pkg=receipt.packages.find(p=>p.target==="nuget"),profile=receipt.profiles.find(p=>p.id===pkg.profile);
		const work=await mkdtemp(join(tmpdir(),"dotnet-exchange-"));
		try
		{
			const checked=await runDotnetApplication({work,set,pkg,profile,route,env,tickets: true});
			const row={route,receiptSha256: result.receiptSha256,archive: pkg.artifacts[0],runtimeIdentity: pkg.runtimeIdentity,...checked};
			await saveLakeFile(out,route+".json",canonicalJson(row));rows.push(row);
		}
		finally
		{
			await rm(work,{recursive: true,force: true});
		}
	}
	const [a,b]=rows;
	assert.notEqual(a.receiptSha256,b.receiptSha256);assert.notEqual(a.archive.sha256,b.archive.sha256);
	for(const key of ["sourceSha256","runtimeIdentity","clientSha256","applicationSha256","observerSha256","counts"])assert.deepEqual(a[key],b[key],key);
});
