/**
 * Independent installed context isolation in Node and Chromium PHP-Wasm hosts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { build as buildVite } from "vite";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { compileOwnedPhpZendModel } from "../../src/backends/php/owned-zend-model.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { browserPhpWasmCorpus } from "./type-corpus-php-wasm-browser.mjs";
import { ownedCheckedRecordPhpWasmPeerName } from "./owned-checked-record-php-wasm-peer.mjs";

export const ownedCheckedRecordPhpWasmContextsCaller
	= "tests/fixtures/structured-types/owned-checked-record-php-wasm-contexts.php";

/**
 * Derive private wire selectors from the two actual compiler-authenticated models.
 *
 * @param primary - Main installed component model.
 * @param peer - Independent peer model.
 * @param mode - Full or result-only main API.
 */
export const ownedCheckedRecordPhpWasmContextContract = (primary, peer, mode) => {
	assert.ok(["full", "result-only"].includes(mode));
	const full = mode === "full";
	const a = compileOwnedPhpZendModel(primary.bindingIr, { transferredInputs: full, hostCallbacks: full });
	const b = compileOwnedPhpZendModel(peer.bindingIr, { hostCallbacks: false });
	assert.equal(a.namespace, "LeanOwnedCheckedRecords");
	assert.equal(b.namespace, "LeanOwnedCheckedRecordsPeer");
	assert.notEqual(a.transport, b.transport);
	assert.notEqual(primary.component.id, peer.component.id);
	const entries = model => Object.fromEntries(model.functions.map(fn =>
		[fn.publicName, `${model.transport}\\call${fn.index}`]));
	const type = (model, name) => {
		const found = model.types.find(node => node.id === `lean:OwnedCheckedRecords.${name}`);
		assert.ok(found, name); return found.index;
	};
	return { mode, primary: entries(a), peer: entries(b)
		, primaryTicket: type(a, "Ticket"), peerTicket: type(b, "Ticket")
		, ...full ? { booking: type(a, "Booking"), claim: type(a, "Claim") } : {} };
};

export const ownedCheckedRecordPhpWasmContextProgram = `
const entries=[[loading==='lazy'?primary.lazy:primary,loading,'LeanOwnedCheckedRecords'],[peerMode==='lazy'?peer.lazy:peer,peerMode,'LeanOwnedCheckedRecordsPeer']];
if(order==='peer-first')entries.reverse();
const libraries=[],select=mode=>entries.filter(entry=>entry[1]===mode).map(([api])=>arrangement==='composer'?api.extensions:api);
const php=new PhpHost({version:'8.4',autoTransaction:false,ini:'memory_limit=512M',sharedLibs:select('startup'),dynamicLibs:[...select('lazy'),{name:'observer.so',url:new URL('./observer.so',import.meta.url),ini:false}],
 locateFile:name=>{if(name.startsWith('php8.4-lb_')||name.startsWith('liblean_bridge_php_wasm_copied_'))libraries.push(name);}});
let stdout='',stderr='';
php.addEventListener('output',event=>{stdout+=event.detail.join('');});php.addEventListener('error',event=>{stderr+=event.detail.join('');});
const run=async source=>{const status=await php.run(source);if(status||stderr)throw Error(JSON.stringify({status,stdout,stderr}));};
await php.binary;
const startups=entries.filter(entry=>entry[1]==='startup').length,initial=startups?startups+1:0;
assert.equal(libraries.length,initial);
if(arrangement==='composer')await mountVendor(php);
const autoload=arrangement==='composer'?"require '/app-vendor/autoload.php';":entries.map(([api])=>"require '"+api.autoload+"';").join('');
await php.writeFile('/contexts.json',JSON.stringify(contract));
await php.writeFile('/contexts.php',caller.replace('strict_types=1','strict_types='+strict));
const execute=async()=>{
 stdout='';stderr='';await run('<?php '+autoload);
 const before=libraries.length;
 for(const [,,ns] of entries)await run("<?php try { "+ns+"\\\\new_ticket(42,'invalid'); throw new Exception('Missing rejection'); } catch(TypeError $error) {}");
 assert.equal(libraries.length,before);
 for(const [,,ns] of entries)await run("<?php $warm="+ns+"\\\\new_ticket(Brick\\\\Math\\\\BigInteger::of(1),'warm'); $warm->close(); unset($warm);");
 await run("<?php require '/contexts.php';");const observed=JSON.parse(stdout);
 stdout='';stderr='';await run("<?php if(!function_exists('owned_installed_snapshot'))dl('observer.so'); gc_collect_cycles(); echo json_encode(owned_installed_snapshot());");
 const snapshot=JSON.parse(stdout);
 assert.equal(snapshot.runtimeState,2);assert.equal(snapshot.runtimeInitRuns,1);assert.equal(snapshot.componentInitRuns,2);assert.equal(snapshot.liveIdentities,0);
 assert.equal(libraries.length,3);assert.equal(new Set(libraries).size,3);
 return {observed,snapshot};
};
const first=await execute();await php.refresh();const refreshed=await execute();
report({arrangement,loading,peerMode,order,strict:Number(strict),libraries,initial,first,refreshed,requestRecovery:true});
`;

/**
 * Check actual per-execution counters, cleanup and request recovery.
 *
 * @param run - Installed observation, not a claimed profile name.
 * @param mode - Expected main API mode.
 */
export const assertOwnedCheckedRecordPhpWasmContextRun = (run, mode) => {
	assert.ok(["full", "result-only"].includes(mode));
	assert.equal(run.requestRecovery, true);
	assert.equal(run.libraries.length, 3); assert.equal(new Set(run.libraries).size, 3);
	const startups = Number(run.loading === "startup") + Number(run.peerMode === "startup");
	assert.equal(run.initial, startups ? startups + 1 : 0);
	for(const phase of [run.first, run.refreshed])
	{
		assert.equal(phase.observed.mode, mode);
		assert.equal(phase.observed.phpBits, 32);
		assert.equal(phase.observed.lateRejections, mode === "full" ? 30 : 0);
		assert.equal(phase.observed.rejections, mode === "full" ? 45 : 12);
		assert.ok(Number.isSafeInteger(phase.observed.checks) && phase.observed.checks >= (mode === "full" ? 160 : 25));
		for(const key of ["contextIsolation", "staleContextRejected", "independentRetains"])
			assert.equal(phase.observed[key], true, key);
		assert.equal(phase.snapshot.runtimeState, 2);
		assert.equal(phase.snapshot.runtimeInitRuns, 1);
		assert.equal(phase.snapshot.componentInitRuns, 2);
		assert.equal(phase.snapshot.liveIdentities, 0);
	}
};

/**
 * Render the installed Node runner without executing or rebuilding packages.
 *
 * @param name - Primary npm package name.
 * @param contract - Compiler-derived private selectors.
 */
export const ownedCheckedRecordPhpWasmContextNode = (name, contract) => `import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {PhpNode as PhpHost} from 'php-wasm/PhpNode';
import primary from ${JSON.stringify(name)};
import peer from ${JSON.stringify(ownedCheckedRecordPhpWasmPeerName)};
process.setUncaughtExceptionCaptureCallback(error=>{console.error(error.stack);process.exit(1);});
const [arrangement,loading,peerMode,order,strict]=process.argv.slice(2),contract=${canonicalJson(contract)};
const caller=await readFile('contexts.php','utf8');
const mountVendor=async php=>{const mount=async(source,target)=>{await php.mkdir(target);for(const entry of await readdir(source,{withFileTypes:true})){
 if(entry.isDirectory())await mount(join(source,entry.name),target+'/'+entry.name);else await php.writeFile(target+'/'+entry.name,await readFile(join(source,entry.name)));}};await mount('vendor','/app-vendor');};
const report=value=>console.log(JSON.stringify(value));
${ownedCheckedRecordPhpWasmContextProgram}`;

/**
 * Render a browser runner for one autoload and peer-loading arrangement.
 *
 * @param contract - Compiler-derived private selectors.
 * @param arrangement - Embedded or Composer autoloading.
 * @param peerMode - Startup or lazy peer extension loading.
 * @param order - Which component initializes first.
 */
export const ownedCheckedRecordPhpWasmContextBrowser = (contract, arrangement, peerMode, order) => `import {PhpWeb as PhpHost} from './node_modules/php-wasm/PhpWeb.mjs';
import {primary,peer} from './contexts-bundled/consumer.mjs';
const query=new URL(location.href).searchParams,loading=query.get('loading'),strict=query.get('mode')==='strict'?1:0;
const contract=${canonicalJson(contract)},arrangement=${JSON.stringify(arrangement)},peerMode=${JSON.stringify(peerMode)},order=${JSON.stringify(order)};
const assert={equal:(actual,expected)=>{if(actual!==expected)throw Error(JSON.stringify({actual,expected}));}};
const mountVendor=async php=>{const paths=await(await fetch('./vendor-files.json')).json(),directories=new Set(['/app-vendor']);await php.mkdir('/app-vendor');
 for(const path of paths){const parts=path.split('/');parts.pop();let target='/app-vendor';for(const part of parts){target+='/'+part;if(!directories.has(target)){await php.mkdir(target);directories.add(target);}}
 await php.writeFile('/app-vendor/'+path,new Uint8Array(await(await fetch('./vendor/'+path)).arrayBuffer()));}};
const report=value=>{globalThis.phpCorpus=value;};
try{const caller=await(await fetch('./contexts.php')).text();
${ownedCheckedRecordPhpWasmContextProgram}
}catch(error){globalThis.phpCorpus={error:error.stack};}
`;

/**
 * Exercise both load orders, all loading pairs and both installed autoload routes.
 *
 * @param options - Source-free combined installation and authenticated models.
 * @param options.deployment - Relocated installation directory.
 * @param options.name - Primary npm package name.
 * @param options.primary - Compiler-authenticated primary component model.
 * @param options.peer - Compiler-authenticated peer component model.
 * @param options.mode - Full or result-only primary API.
 * @param options.diagnostic - Progress reporter.
 */
export const checkOwnedCheckedRecordPhpWasmContexts = async ({ deployment, name, primary, peer, mode, diagnostic }) => {
	const contract = ownedCheckedRecordPhpWasmContextContract(primary, peer, mode);
	const caller = await readFile(ownedCheckedRecordPhpWasmContextsCaller);
	await saveLakeFile(deployment, "contexts.php", caller);
	const runner = ownedCheckedRecordPhpWasmContextNode(name, contract);
	await saveLakeFile(deployment, "contexts.mjs", runner);
	const executions = [];
	for(const arrangement of ["embedded", "composer"])
	for(const loading of ["startup", "lazy"])
	for(const peerMode of ["startup", "lazy"])
	for(const order of ["primary-first", "peer-first"])
	for(const strict of [0, 1])
	{
		diagnostic(`checked contexts: ${mode}/${arrangement}/${loading}/${peerMode}/${order}/strict${strict}`);
		const result = await runCopied(process.execPath, ["contexts.mjs", arrangement, loading, peerMode, order, String(strict)], deployment, copiedCleanEnvironment);
		assert.equal(result.stderr, ""); const run = JSON.parse(result.stdout);
		assert.deepEqual([run.arrangement, run.loading, run.peerMode, run.order, run.strict], [arrangement, loading, peerMode, order, strict]);
		assertOwnedCheckedRecordPhpWasmContextRun(run, mode); executions.push(run);
	}
	await saveLakeFile(deployment, "contexts-entry.mjs", `export {default as primary} from ${JSON.stringify(name)};\nexport {default as peer} from ${JSON.stringify(ownedCheckedRecordPhpWasmPeerName)};\n`);
	await buildVite({ root: deployment, configFile: false, publicDir: false
		, logLevel: "silent", base: "./"
		, build: { outDir: "contexts-bundled", assetsInlineLimit: 0
			, modulePreload: false
			, rollupOptions: { input: join(deployment, "contexts-entry.mjs")
				, preserveEntrySignatures: "strict"
				, output: { entryFileNames: "consumer.mjs" } } } });
	await saveLakeFile(deployment, "vendor-files.json", canonicalJson(await nativeArtifactPaths(join(deployment, "vendor"))));
	await saveLakeFile(deployment, "index.html", '<!doctype html><html><head><link rel="icon" href="data:,"></head><body><script type="module" src="./browser.mjs"></script></body></html>');
	const observations = [];
	for(const arrangement of ["embedded", "composer"])
	for(const peerMode of ["startup", "lazy"])
	for(const order of ["primary-first", "peer-first"])
	{
		const source = ownedCheckedRecordPhpWasmContextBrowser(contract, arrangement, peerMode, order);
		await saveLakeFile(deployment, "browser.mjs", source);
		const browser = await browserPhpWasmCorpus({ t: { diagnostic }, library: { id: `owned-checked-contexts/${mode}/${arrangement}/${peerMode}/${order}` }, deployment, environment: process.env });
		for(const run of browser.executions)
		{
			assert.equal(run.arrangement, arrangement); assert.equal(run.peerMode, peerMode); assert.equal(run.order, order);
			assert.equal(run.strict, run.mode === "strict" ? 1 : 0);
			assertOwnedCheckedRecordPhpWasmContextRun(run, mode);
		}
		observations.push({ arrangement, peerMode, order, ...browser, sourceSha256: sha256(source) });
	}
	return { schemaVersion: 1
		, profile: "installed-owned-checked-record-php-wasm-contexts"
		, contract, consumerSha256: sha256(caller), runnerSha256: sha256(runner)
		, programSha256: sha256(ownedCheckedRecordPhpWasmContextProgram), executions
		, browser: { observations, bundleSha256: sha256(await readFile(join(deployment, "contexts-bundled/consumer.mjs"))) } };
};
