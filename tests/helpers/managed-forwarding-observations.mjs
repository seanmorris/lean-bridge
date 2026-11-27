/** @file Reconcile the public C#, Java and Kotlin consumer runs, separate from package metadata. */
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {basename,join} from "node:path";
import {sha256} from "../../src/capsule/node.mjs";

/**
 * Compare compiled-client observations with their exact source files.
 *
 * @param target - NuGet or Maven package target.
 * @param row - The installed application's execution record.
 * @param fixture - Root directory of the client and independent observer sources.
 */
export async function checkManagedForwarding(target,row,fixture)
{
	const digest=/^[a-f0-9]{64}$/u;
	if(target==="nuget")
	{
		const app=await readFile(join(fixture,"structured-types/tariff-application.cs"),"utf8");
		const observer=await readFile(join(fixture,"structured-types/tariff-incoming-observer.cs"),"utf8");
		assert.equal(sha256(app),row.applicationSha256);assert.equal(sha256(observer),row.observerSha256);
		assert.equal(sha256("#define DIRECT_TICKETS\n"+app+"\n"+observer),row.clientSha256);
		assert.match(row.assemblySha256,digest);
		const {held,...counts}=row.counts;
		assert.ok(Number.isSafeInteger(held)&&held>1);
		assert.deepEqual(counts,{baseline: 1,expired: 1,forward: 1,nested: 1,ticket42: 1,ticket71: 1,fresh: 1,afterThreadExit: 0});
		return;
	}
	assert.equal(target,"maven");
	assert.deepEqual(row.archives.map(a=>a.path).sort(),[row.archive.path,row.pom.path]);
	assert.equal(row.deployed[basename(row.archive.path)],row.archive.sha256);
	assert.equal(row.leanSourceSha256,row.sourceSha256);
	assert.match(row.modules.trim(),/^java\.base@22(?:[.][\w.+-]+)?$/u);
	const paths=["jvm-tasks/Observe.java","jvm-tariff/Ownership.java","jvm-tariff/JavaApplication.java","jvm-tariff/KotlinApplication.kt"];
	const sources={};
	for(const file of paths)sources[basename(file)]=sha256(await readFile(join(fixture,file)));
	assert.deepEqual(row.sources,sources);
	const clients=["javaApplication","kotlinApplication"];
	assert.deepEqual(Object.keys(row.compiled).sort(),clients);assert.deepEqual(Object.keys(row.results).sort(),clients);
	for(const client of clients)
	{
		assert.match(row.compiled[client],digest);
		const {values,baseline,held,...counts}=row.results[client];
		assert.deepEqual(values,{forwarded: 42,afterFailure: 43,calls: 3,firstTicket: 43,secondTicket: 72});
		assert.ok(Number.isSafeInteger(baseline)&&baseline>=0&&Number.isSafeInteger(held)&&held>baseline);
		assert.deepEqual(counts,{expired: baseline,forward: baseline,nested: baseline,ticket42to43: baseline,ticket71to72: baseline,afterThreadExit: 0});
	}
}
