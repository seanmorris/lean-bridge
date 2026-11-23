/** @file Exercise an installed task release using only its public package names. */
import assert from "node:assert/strict";
import {copyFile,mkdir,readFile,writeFile} from "node:fs/promises";
import {createRequire} from "node:module";
import {join} from "node:path";
import {processBuildRunner} from "../../src/build/process-runner.mjs";
import {packageSetReceiptName,readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {runInstalledChromium} from "./javascript-wasm-installed-browser.mjs";

/**
 * Typecheck a fresh consumer and run the same workload in Node and Chromium.
 *
 * @param options - Receipt directory, test fixtures, isolated install and expected review, if any.
 * @param options.root - Private test workspace.
 * @param options.fixtures - Public consumer and TypeScript sources.
 * @param options.handoff - Directory containing both original archives and their receipt.
 * @param options.command - Process runner for the isolated install.
 * @param options.environment - Environment of the fresh Node consumer.
 * @param options.mode - Separate install and cache name for this release.
 * @param options.reviewText - Expected verbatim review for the reviewed-source route.
 */
export const checkInstalledTaskHandoff=async ({root,fixtures,handoff,command,environment,mode,reviewText}) => {
	const installed=join(root,mode+"-consumer"); await mkdir(installed);
	const {receipt}=await readVerifiedPackageSetReceipt({receiptPath: join(handoff,packageSetReceiptName)});
	const publicName=receipt.packages.find(p => p.role==="component").name;
	await writeFile(join(installed,"package.json"),'{"private":true,"type":"module"}');
	await command("npm",["install"
		, "--offline"
		, "--ignore-scripts"
		, "--no-audit"
		, "--no-fund"
		, "--cache"
		, join(root,mode+"-cache")
		, ...receipt.packages.map(p => join(handoff,p.artifacts[0].path))],installed);
	const contents=join(installed,"node_modules",publicName);
	if(reviewText !== undefined) assert.equal(await readFile(join(contents,"metadata/review.binding-ir.json"),"utf8"),reviewText);
	await copyFile(join(fixtures,"public-consumer.mjs"),join(installed,"calls.mjs"));
	await copyFile(join(fixtures,"public-types.mts"),join(installed,"calls.mts"));
	const typescript=createRequire(import.meta.url).resolve("typescript/bin/tsc");
	// The temporary directory may live beneath the author's repository. Do
	// not import its ambient @types packages into an otherwise empty consumer.
	const compilerOptions={strict: true,noEmit: true,module: "NodeNext",target: "ES2022",types: []};
	await writeFile(join(installed,"tsconfig.json"),JSON.stringify({files: ["calls.mts"],compilerOptions}));
	await command(process.execPath,[typescript,"--project","tsconfig.json"],installed);
	await writeFile(join(installed,"run.mjs"),'import {exercise} from "./calls.mjs"; console.log(JSON.stringify(await exercise()));\n');
	const node=JSON.parse((await processBuildRunner.capture({command: process.execPath,args: ["run.mjs"],cwd: installed,env: environment,timeoutMs: 60000})).stdout);
	assert.equal(node.checks,47);
	const chromium=await runInstalledChromium({root
		, consumer: installed
		, names: [publicName]
		, isolated: true
		, timeoutMs: 60000
		, evaluate: async () => (await import("/calls.mjs")).exercise()});
	assert.deepEqual(chromium,node);
	return {mode,node,chromium,runtime: receipt.packages.find(p => p.role==="runtime").artifacts[0].sha256};
};
