/**
 * Installed owned PHP-Wasm APIs in isolated Chromium contexts, without a compiler.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { browserPhpWasmCorpus } from "./type-corpus-php-wasm-browser.mjs";

const browserSource = arrangement => `import {PhpWeb} from './node_modules/php-wasm/PhpWeb.mjs';
import descriptor from './bundled/consumer.mjs';
const query=new URL(location.href).searchParams,loading=query.get('loading'),mode=query.get('mode');
const arrangement=${JSON.stringify(arrangement)},api=loading==='lazy'?descriptor.lazy:descriptor;
const selected=arrangement==='composer'?api.extensions:api,libraries=[],phases=[];
const php=new PhpWeb({version:'8.4',autoTransaction:false,ini:'memory_limit=512M',
  sharedLibs:loading==='startup'?[selected]:[],dynamicLibs:[...(loading==='lazy'?[selected]:[]),{name:'observer.so',url:new URL('./observer.so',import.meta.url),ini:false}],
  locateFile:name=>{if(name.startsWith('php8.4-lb_')||name.startsWith('liblean_bridge_php_wasm_copied_'))libraries.push(name);}});
let stdout='',stderr='';
php.addEventListener('output',event=>{stdout+=event.detail.join('');});php.addEventListener('error',event=>{stderr+=event.detail.join('');});
const run=async source=>{const status=await php.run(source);if(status||stderr)throw Error(JSON.stringify({status,stdout,stderr}));};
try{
  await php.binary;phases.push({stage:'ready',libraries:[...libraries]});
  if(arrangement==='composer'){
    const paths=await(await fetch('./vendor-files.json')).json(),directories=new Set(['/app-vendor']);
    await php.mkdir('/app-vendor');
    for(const path of paths){
      const parts=path.split('/');parts.pop();let target='/app-vendor';
      for(const part of parts){target+='/'+part;if(!directories.has(target)){await php.mkdir(target);directories.add(target);}}
      await php.writeFile('/app-vendor/'+path,new Uint8Array(await(await fetch('./vendor/'+path)).arrayBuffer()));
    }
  }
  const autoload=arrangement==='composer'?'/app-vendor/autoload.php':api.autoload;
  await run("<?php require '"+autoload+"';");phases.push({stage:'autoload',libraries:[...libraries]});
  await run("<?php try { LeanOwnedAggregates\\\\new_ticket(42,'invalid'); throw new Exception('Missing rejection'); } catch(TypeError $error) {}");
  phases.push({stage:'invalid',libraries:[...libraries]});
  const caller=(await(await fetch('./consumer.php')).text()).replace('strict_types=1','strict_types='+(mode==='strict'?'1':'0'));
  await php.writeFile('/consumer.php',caller);await run("<?php require '/consumer.php';");
  const observed=JSON.parse(stdout);phases.push({stage:'complete',libraries:[...libraries]});
  const snapshot=async()=>{stdout='';stderr='';await run("<?php if(!function_exists('owned_installed_snapshot'))dl('observer.so'); gc_collect_cycles(); echo json_encode(owned_installed_snapshot());");
    const value=JSON.parse(stdout);if(value.runtimeState!==2||value.runtimeInitRuns!==1||value.liveIdentities!==0)throw Error('Unexpected live broker state: '+stdout);return value;};
  const cleaned=await snapshot();
  await php.refresh();stdout='';stderr='';
  await run("<?php require '"+autoload+"'; $ticket=LeanOwnedAggregates\\\\new_ticket(Brick\\\\Math\\\\BigInteger::of(77),'fresh'); "+
    "if((string)LeanOwnedAggregates\\\\serial($ticket)!=='77')throw new Exception('Request recovery failed'); $ticket->close(); echo 'recovered';");
  if(stdout!=='recovered')throw Error('Missing recovery output');
  phases.push({stage:'recovered',libraries:[...libraries]});
  const refreshed=await snapshot();
  globalThis.phpCorpus={observed,phases,requestRecovery:true,cleaned,refreshed};
}catch(error){globalThis.phpCorpus={error:error.stack};}
`;

/**
 * Run both autoload arrangements, modes and strictness levels twice over HTTP.
 *
 * @param deployment - Relocated installation with bundled descriptor assets.
 * @param diagnostic - Progress reporter.
 * @param expected - Required consumer result fields for this fixture.
 */
export const checkOwnedPhpWasmBrowser = async (deployment, diagnostic, expected = { scalars: 19, structured: 23 }) => {
	await saveLakeFile(deployment, "vendor-files.json", canonicalJson(await nativeArtifactPaths(join(deployment, "vendor"))));
	await saveLakeFile(deployment, "index.html", '<!doctype html><html><head><link rel="icon" href="data:,"></head><body><script type="module" src="./browser.mjs"></script></body></html>');
	const observations = [];
	for(const arrangement of ["embedded", "composer"])
	{
		const source = browserSource(arrangement);
		await saveLakeFile(deployment, "browser.mjs", source);
		const browser = await browserPhpWasmCorpus({ t: { diagnostic }
			, library: { id: "owned/" + arrangement }, deployment
			, environment: process.env });
		for(const run of browser.executions)
		{
			for(const [key, value] of Object.entries(expected)) assert.deepEqual(run.observed[key], value, key);
			assert.equal(run.observed.phpBits, 32);
			assert.ok(run.observed.checks > 100);
			assert.deepEqual(run.phases.map(phase => phase.stage), ["ready", "autoload", "invalid", "complete", "recovered"]);
			assert.deepEqual(run.phases.map(phase => phase.libraries.length), run.loading === "lazy" ? [0, 0, 0, 2, 2] : [2, 2, 2, 2, 2]);
			assert.equal(new Set(run.phases.at(-1).libraries).size, 2);
			assert.equal(run.requestRecovery, true);
			for(const state of [run.cleaned, run.refreshed])
			{ assert.equal(state.liveIdentities, 0); assert.equal(state.runtimeInitRuns, 1); }
		}
		observations.push({ arrangement, ...browser, sourceSha256: sha256(source) });
	}
	return { observations
		, bundleSha256: sha256(await readFile(join(deployment, "bundled/consumer.mjs"))) };
};
