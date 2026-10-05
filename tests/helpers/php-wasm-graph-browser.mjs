/**
 * Bundle installed graph descriptors and run their real PHP-Wasm browser host.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { build as buildVite } from "vite";
import { sha256 } from "../../src/capsule/node.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { browserPhpWasmCorpus } from "./type-corpus-php-wasm-browser.mjs";

/**
 * Resolve every PHP source and DSO from an installed descriptor through Vite.
 *
 * @param deployment - Relocated consumer containing original installed archives.
 * @param name - Public npm package name.
 */
export const bundlePhpWasmGraph = async (deployment, name) => {
	await saveLakeFile(deployment, "entry.mjs", `export {default} from ${JSON.stringify(name)};\n`);
	await buildVite({ root: deployment, configFile: false, publicDir: false
		, logLevel: "silent", base: "./"
		, build: { outDir: "bundled", assetsInlineLimit: 0, modulePreload: false
			, rollupOptions: { input: join(deployment, "entry.mjs"), preserveEntrySignatures: "strict", output: { entryFileNames: "consumer.mjs" } } } });
};

/**
 * Repeat weak/strict callers and both loading modes in isolated Chromium contexts.
 *
 * @param deployment - Source-free installed consumer and bundled assets.
 * @param request - Independently selected source path, extension and alias path.
 * @param diagnostic - Progress reporter.
 */
export const checkPhpWasmGraphBrowser = async (deployment, request, diagnostic) => {
	const source = `import {PhpWeb} from './node_modules/php-wasm/PhpWeb.mjs';
import descriptor from './bundled/consumer.mjs';
const query=new URL(location.href).searchParams,loading=query.get('loading'),mode=query.get('mode');
const api=loading==='lazy'?descriptor.lazy:descriptor,libraries=[],phases=[];
const php=new PhpWeb({version:'8.4',autoTransaction:false,ini:'memory_limit=256M',sharedLibs:loading==='startup'?[api]:[],dynamicLibs:loading==='lazy'?[api]:[],locateFile:name=>{if(name.startsWith('php8.4-lb_')||name.startsWith('liblean_bridge_php_wasm_copied_'))libraries.push(name);}});
let stdout='',stderr='';
php.addEventListener('output',event=>{stdout+=event.detail.join('');});php.addEventListener('error',event=>{stderr+=event.detail.join('');});
const run=async source=>{const status=await php.run(source);if(status||stderr)throw new Error(JSON.stringify({status,stdout,stderr}));};
try{
  await php.binary;phases.push({stage:'ready',libraries:[...libraries]});
  await run("<?php require '"+api.autoload+"';");phases.push({stage:'autoload',libraries:[...libraries]});
  await run("<?php try { LeanRecursive\\\\tree(1); throw new Exception('Expected TypeError'); } catch (TypeError $error) {} try { LeanRecursive\\\\never_(new stdClass()); throw new Exception('Expected TypeError'); } catch (TypeError $error) {}");
  phases.push({stage:'invalid',libraries:[...libraries]});
  await php.writeFile('/request.json',JSON.stringify({...${JSON.stringify(request)},loading}));
  const caller=(await(await fetch('./consumer.php')).text()).replace('strict_types=0','strict_types='+(mode==='strict'?'1':'0'));
  await php.writeFile('/consumer.php',caller);await run("<?php require '/consumer.php';");
  phases.push({stage:'complete',libraries:[...libraries]});
  const observed=JSON.parse(stdout);stdout='';
  for(let index=0;index<20;index++)await run("<?php if (!LeanRecursive\\\\empty_()->equals(new LeanRecursive\\\\TreeBranch([]))) throw new Exception('Repeat failed');");
  if(stdout!=='')throw new Error('Unexpected repeated-call output');
  globalThis.phpCorpus={observed,phases,repeatedRequests:20};
}catch(error){globalThis.phpCorpus={error:error.stack};}
`;
	await saveLakeFile(deployment, "browser.mjs", source);
	await saveLakeFile(deployment, "index.html", '<!doctype html><html><head><link rel="icon" href="data:,"></head><body><script type="module" src="./browser.mjs"></script></body></html>');
	const browser = await browserPhpWasmCorpus({ t: { diagnostic }, library: { id: request.path }, deployment, environment: process.env });
	for(const run of browser.executions)
	{
		assert.equal(run.observed.compiledLean, true); assert.equal(run.observed.installedPackage, true);
		assert.equal(run.observed.actualPhpBits, 32); assert.equal(run.observed.exports, 18);
		assert.ok(run.observed.checks > 1000); assert.ok(run.observed.rejections > 30);
		assert.deepEqual(run.phases.map(phase => phase.stage), ["ready", "autoload", "invalid", "complete"]);
		assert.deepEqual(run.phases.map(phase => phase.libraries.length), run.loading === "lazy" ? [0, 0, 0, 2] : [2, 2, 2, 2]);
		assert.equal(new Set(run.phases.at(-1).libraries).size, 2);
		assert.equal(run.repeatedRequests, 20);
	}
	return { ...browser, sourceSha256: sha256(source), bundleSha256: sha256(await readFile(join(deployment, "bundled/consumer.mjs"))) };
};
