/** @file Run the direct-function Perl caller and separate broker observer. */
import assert from "node:assert/strict";
import {copyFile,readFile} from "node:fs/promises";
import {join,resolve} from "node:path";
import {sha256} from "../../src/capsule/node.mjs";
import {directQuoteLabels,verifyDirectQuoteCounts} from "./direct-quote-counts.mjs";
import {runNativeTool} from "./native-effect-consumers.mjs";

/**
 * Run unmodified application and observation sources against the selected ABI.
 *
 * @param root - Isolated application directory.
 * @param perl - Selected interpreter.
 * @param env - Installed modules and compiler-free PATH.
 * @param application - Exercise an application-origin function and direct Ticket exchange.
 */
export const runPerlIncoming=async(root,perl,env,application=false)=>{
	const sources={};
	for(const n of ["tariff-incoming.pl","tariff-incoming-observer.pl"])
	{
		const original=application&&n==="tariff-incoming.pl"?"tariff-application.pl":n;
		const p=resolve("tests/fixtures/structured-types",original),out=join(root,n);
		await copyFile(p,out);assert.deepEqual(await readFile(out),await readFile(p));sources[original]=sha256(await readFile(out));
	}
	const samples=JSON.parse(await runNativeTool(perl,["tariff-incoming-observer.pl"],root,env));
	if(application)
	{
		assert.deepEqual(samples.map(s=>s[0]),["baseline","expired","held","forward","nested","ticket42","ticket71","fresh","afterShutdown"]);
		for(const [key,n] of samples)assert.ok(key==="held"?Number.isSafeInteger(n)&&n>1:n===(key==="afterShutdown"?0:1),key);
	}
	else
	{
		assert.deepEqual(samples.map(s=>s[0]),[...directQuoteLabels.slice(0,-1),"afterShutdown"]);
		verifyDirectQuoteCounts(Object.fromEntries(samples),{closed: "afterShutdown"});
	}
	return {sources,samples};
};
