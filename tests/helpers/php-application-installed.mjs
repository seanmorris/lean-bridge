/** @file Replay each original Composer application package without rebuilding either author project. */
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {canonicalJson} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";
import {runInstalledPhpApplication} from "./php-application-client.mjs";

test("ordinary and reviewed Composer consumers forward application functions and exchange Tickets",async()=>{
	const env=process.env,sets=env.LEAN_BRIDGE_PHP_APPLICATION_REPLAY;
	assert.ok(sets,"supply the ordinary and reviewed handoffs from test:managed-application-packages");
	const out=resolve(env.LEAN_BRIDGE_PHP_APPLICATION_OUTPUT??"build/php-application-functions"),rows=[];
	for(const route of ["ordinary","reviewed"])
	{
		const handoff=resolve(sets,route);
		const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(handoff,"package-set-receipt.json")});
		const targets=receipt.packages.map(p=>p.target).sort();
		assert.deepEqual(targets,targets.length===1?["php-native"]:targets.length===2?["maven","php-native"]:["maven","nuget","php-native"]);
		const pkg=receipt.packages.find(p=>p.target==="php-native"),profile=receipt.profiles.find(p=>p.id===pkg.profile);
		const root=await mkdtemp(join(tmpdir(),"php-app-install-"));
		try
		{
			const row={route,receiptSha256: result.receiptSha256,...await runInstalledPhpApplication({root,env,route,handoff,pkg,profile})};
			await saveLakeFile(out,route+".json",canonicalJson(row));rows.push(row);
		}
		finally
{await rm(root,{recursive: true,force: true});}
	}
	const [a,b]=rows;
	assert.notEqual(a.receiptSha256,b.receiptSha256);assert.notEqual(a.artifacts[0].sha256,b.artifacts[0].sha256);
	for(const key of ["leanSourceSha256","runtimeIdentity","sources","observations"])assert.deepEqual(a[key],b[key],key);
});
