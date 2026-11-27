/** @file Install the native Composer release and exercise host functions and direct Ticket exchange in PHP. */
import assert from "node:assert/strict";
import {copyFile,readFile,realpath} from "node:fs/promises";
import {join,resolve} from "node:path";
import {sha256} from "../../src/capsule/node.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {installOwnedPhpArchive} from "./owned-php-installed.mjs";
import {checkStagedQuoteIdentities,checkApplicationFunctionPositions,checkTicketExchangePositions} from "./staged-quote-project.mjs";

/**
 * Execute immutable package bytes with the author tools off PATH.
 *
 * @param options - Installed consumer configuration.
 * @param options.pkg - Verified native Composer package entry.
 * @param options.profile - Verified compiler profile for this package.
 * @param options.route - Ordinary or reviewed source.
 * @param options.handoff - Directory with the original receipt and archive.
 * @param options.root - Empty scratch directory for offline installation.
 * @param options.env - Producer tool locations and selected PHP interpreters.
 */
export const runInstalledPhpApplication=async({pkg,profile,route,handoff,root,env})=>{
	assert.equal(pkg.target,"php-native");assert.equal(pkg.name,"example/tariff-quotes");
	assert.equal(pkg.version,"1.0.0");assert.equal(pkg.artifacts.length,1);
	const [zip]=pkg.artifacts;
	const archive=join(handoff,zip.path),expected={name: pkg.name,version: pkg.version,sha256: zip.sha256};
	const {deployment,environment,evidence}=await installOwnedPhpArchive({root,archive,pkg: expected,environment: env});
	const meta=async n=>JSON.parse(await readFile(join(deployment,"vendor",pkg.name,"lean-bridge/component",n+".json")));
	const model=await meta("model"),ir=await meta("binding-ir");
	const pins=checkStagedQuoteIdentities(model,ir,profile,route,{hostFunctions: true,ticketExchange: true});
	checkApplicationFunctionPositions(ir);checkTicketExchangePositions(ir);
	const leanSourceSha256=model.sourceIdentity.modules.find(m=>m.module==="Owned").source.sha256;
	assert.equal(leanSourceSha256,"a758f8e7a4210d99fe965aa06c4b42006df3c087c70f2bde8d0e1403c30a98fb");
	const sources={},observations=[];
	for(const name of ["tariff-application.php","tariff-application-observer.php"])
	{
		const installed=join(deployment,name);await copyFile(resolve("tests/fixtures/structured-types",name),installed);
		sources[name]=sha256(await readFile(installed));
	}
	for(const bin of (env.LEAN_BRIDGE_PHP_HOST_INTERPRETERS??"/usr/bin/php").split(","))
	{
		const php=await realpath(bin),info=JSON.parse(await run(php,["-n","-r",'echo json_encode([PHP_VERSION,PHP_SAPI,PHP_INT_SIZE,extension_loaded("ffi"),ini_get("extension_dir")]);'],deployment,environment));
		assert.equal(info[1],"cli");assert.equal(info[2],8);
		const ext=info[3]?[]:["-d","extension="+await realpath(join(info[4],"ffi.so"))];
		const row=JSON.parse(await run(php,["-n",...ext,"-d","ffi.enable=1","-d","display_errors=stderr","tariff-application-observer.php"],deployment,environment));
		assert.equal(row.php,info[0]);assert.deepEqual(row.values,{forwarded: 42,after: 43,trace: [0,2,3],replies: [43,72]});
		const {held,...other}=row.counts;assert.ok(held>other.baseline);
		assert.deepEqual(other,{baseline: 1,expired: 1,forward: 1,nested: 1,ticket42: 1,ticket71: 1,afterShutdown: 0});
		observations.push({...row,interpreterSha256: sha256(await readFile(php))});
	}
	assert.ok(observations.length);
	const {composerVersion,lockSha256}=evidence,{runtimeIdentity,artifacts}=pkg;
	return {...pins,leanSourceSha256,runtimeIdentity,artifacts,composerVersion,lockSha256,sources,observations};
};
