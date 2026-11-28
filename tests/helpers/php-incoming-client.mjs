/** @file Run the same public PHP application after relocation and verify independent cleanup. */
import assert from "node:assert/strict";
import {copyFile,readFile,realpath} from "node:fs/promises";
import {join,resolve} from "node:path";
import {sha256} from "../../src/capsule/node.mjs";
import {verifyDirectQuoteCounts} from "./direct-quote-counts.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";

/**
 * Check the published call shape, broker cleanup and normal PHP exception exit.
 *
 * @param root - Relocated application directory with its autoloader.
 * @param bins - Absolute paths to independent PHP interpreters.
 * @param environment - Runtime environment without producer tools.
 */
export const runPhpIncoming=async(root,bins,environment)=>{
	const sources={},observations=[];
	for(const n of ["tariff-incoming.php","tariff-incoming-observer.php"])
	{
		const original=await readFile(resolve("tests/fixtures/structured-types",n));
		const dest=join(root,n);await copyFile(resolve("tests/fixtures/structured-types",n),dest);
		assert.deepEqual(await readFile(dest),original);sources[n]=sha256(original);
	}
	for(const bin of bins)
	{
		const php=await realpath(bin);
		const info=JSON.parse(await run(php,["-n","-r",'echo json_encode([PHP_VERSION,PHP_SAPI,PHP_INT_SIZE,extension_loaded("ffi"),ini_get("extension_dir")]);'],root,environment));
		assert.equal(info[1],"cli");assert.equal(info[2],8);
		const ext=info[3]?[]:["-d","extension="+await realpath(join(info[4],"ffi.so"))];
		const flags=["-n",...ext,"-d","ffi.enable=1","-d","display_errors=stderr","tariff-incoming-observer.php"];
		const output=await run(php,flags,root,environment);
		const row=JSON.parse(output);assert.equal(row.php,info[0]);
		verifyDirectQuoteCounts(row.counts,{closed: "afterShutdown"});
		await assert.rejects(run(php,[...flags,"uncaught"],root,environment),e=>
			e.cause?.code===255 && !e.cause.signal && /Uncaught TypeError: strlen\(\)/u.test(e.message));
		const locked=["-n",...ext,"-d","ffi.enable=1","-d","disable_functions=ini_set","-d","zend.exception_ignore_args=0"];
		assert.equal(await run(php,[...locked,"tariff-incoming-observer.php","locked"],root,environment),"refused before dispatch");
		const preset=JSON.parse(await run(php,[...locked,"-d","zend.exception_ignore_args=1","tariff-incoming-observer.php"],root,environment));
		assert.deepEqual(preset,row);
		observations.push({...row,uncaughtTypeErrorExit: 255,interpreterSha256: sha256(await readFile(php))});
	}
	assert.ok(observations.length>0);
	return {sources,observations};
};
