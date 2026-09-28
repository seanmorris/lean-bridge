/**
 * Mixed owned and copied packages in network-isolated browser hosts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { build as buildVite } from "vite";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { ownedPhpWasmCoexistenceProgram } from "./owned-php-wasm-coexistence.mjs";
import { browserPhpWasmCorpus } from "./type-corpus-php-wasm-browser.mjs";

const browserSource = (arrangement, peerMode, order) => `import {PhpWeb as PhpHost} from './node_modules/php-wasm/PhpWeb.mjs';
import {owned,peer} from './coexist-bundled/consumer.mjs';
const query=new URL(location.href).searchParams,ownedMode=query.get('loading'),strict=query.get('mode')==='strict'?1:0;
const arrangement=${JSON.stringify(arrangement)},peerMode=${JSON.stringify(peerMode)},order=${JSON.stringify(order)};
const assert={equal:(actual,expected)=>{if(actual!==expected)throw Error(JSON.stringify({actual,expected}));}};
const mountVendor=async php=>{
  const response=await fetch('./vendor-files.json');if(!response.ok)throw Error('Missing vendor manifest');
  const paths=await response.json(),directories=new Set(['/app-vendor']);
  await php.mkdir('/app-vendor');
  for(const path of paths){
    const parts=path.split('/');parts.pop();let target='/app-vendor';
    for(const part of parts){target+='/'+part;if(!directories.has(target)){await php.mkdir(target);directories.add(target);}}
    const file=await fetch('./vendor/'+path);if(!file.ok)throw Error('Missing vendor file: '+path);
    await php.writeFile('/app-vendor/'+path,new Uint8Array(await file.arrayBuffer()));
  }
};
const report=value=>{globalThis.phpCorpus=value;};
try{
${ownedPhpWasmCoexistenceProgram}
}catch(error){globalThis.phpCorpus={error:error.stack};}
`;

/**
 * Resolve both installed descriptors with Vite, then repeat every host pairing.
 *
 * @param deployment - Relocated installation after removal of producer files.
 * @param diagnostic - Progress reporter.
 */
export const checkOwnedPhpWasmCoexistenceBrowser = async (deployment, diagnostic) => {
	await saveLakeFile(deployment, "coexist-entry.mjs", "export {default as owned} from '@lean-bridge-test/owned-php-wasm';\nexport {default as peer} from '@lean-bridge-test/owned-peer';\n");
	await buildVite({ root: deployment, configFile: false, publicDir: false
		, logLevel: "silent", base: "./"
		, build: { outDir: "coexist-bundled", assetsInlineLimit: 0
			, modulePreload: false
			, rollupOptions: { input: join(deployment, "coexist-entry.mjs"), preserveEntrySignatures: "strict", output: { entryFileNames: "consumer.mjs" } } } });
	await saveLakeFile(deployment, "vendor-files.json", canonicalJson(await nativeArtifactPaths(join(deployment, "vendor"))));
	await saveLakeFile(deployment, "index.html", '<!doctype html><html><head><link rel="icon" href="data:,"></head><body><script type="module" src="./browser.mjs"></script></body></html>');
	const observations = [];
	for(const arrangement of ["embedded", "composer"])
	for(const peerMode of ["startup", "lazy"])
	for(const order of ["owned-first", "peer-first"])
	{
		const source = browserSource(arrangement, peerMode, order);
		await saveLakeFile(deployment, "browser.mjs", source);
		const browser = await browserPhpWasmCorpus({ t: { diagnostic }
			, library: { id: ["owned-coexistence", arrangement, peerMode, order].join("/") }
			, deployment, environment: process.env });
		for(const run of browser.executions)
		{
			assert.equal(run.arrangement, arrangement);
			assert.equal(run.ownedMode, run.loading);
			assert.equal(run.peerMode, peerMode); assert.equal(run.order, order);
			assert.equal(run.strict, run.mode === "strict" ? 1 : 0);
			assert.equal(run.callbackAcrossPackages, true);
			assert.equal(run.coldCallbackRejections, peerMode === "lazy" ? 2 : 0);
			assert.equal(run.requestRecovery, true);
			assert.equal(run.libraries.length, 3); assert.equal(new Set(run.libraries).size, 3);
			for(const state of [run.cleaned, run.refreshed])
			{
				assert.equal(state.runtimeState, 2); assert.equal(state.runtimeInitRuns, 1);
				assert.equal(state.componentInitRuns, 2); assert.equal(state.liveIdentities, 0);
			}
		}
		observations.push({ arrangement, peerMode, order, ...browser, sourceSha256: sha256(source) });
	}
	return { observations, programSha256: sha256(ownedPhpWasmCoexistenceProgram)
		, bundleSha256: sha256(await readFile(join(deployment, "coexist-bundled/consumer.mjs"))) };
};
