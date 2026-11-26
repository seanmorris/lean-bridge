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
 */
export const runPerlIncoming=async(root,perl,env)=>{
	const sources={};
	for(const n of ["tariff-incoming.pl","tariff-incoming-observer.pl"])
	{
		const p=resolve("tests/fixtures/structured-types",n),out=join(root,n);
		await copyFile(p,out);assert.deepEqual(await readFile(out),await readFile(p));sources[n]=sha256(await readFile(out));
	}
	const samples=JSON.parse(await runNativeTool(perl,["tariff-incoming-observer.pl"],root,env));
	assert.deepEqual(samples.map(s=>s[0]),[...directQuoteLabels.slice(0,-1),"afterShutdown"]);
	verifyDirectQuoteCounts(Object.fromEntries(samples.map(([k,n])=>[k==="afterShutdown"?"afterThreadExit":k,n])));
	return {sources,samples};
};
