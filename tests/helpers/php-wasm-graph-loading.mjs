/**
 * Runtime-only Node and Chromium calls across original installed PHP-Wasm packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { phpWasmInventory } from "./type-corpus-php-wasm-install.mjs";
import { browserPhpWasmCorpus } from "./type-corpus-php-wasm-browser.mjs";
import { preparePhpWasmGraphLoading } from "./php-wasm-graph-loading-install.mjs";

const nodeRunner = prepared => `import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {PhpNode} from 'php-wasm/PhpNode';
import {runComposition,runConflict,runFailure} from './loading.mjs';
${prepared.packages.map((pkg, index) => `import api${index} from ${JSON.stringify(pkg.report.npmSettings.name)};`).join("\n")}
import * as bundled from './bundled/consumer.mjs';
process.setUncaughtExceptionCaptureCallback(error=>{console.error(error.stack);process.exit(1);});
const request=JSON.parse(process.argv[2]);
const duplicate=await import('./bundled/consumer.mjs?duplicate');
const apis=request.arrangement==='bundled'?[bundled.api0,bundled.api1,bundled.api2,bundled.api3]:[api0,api1,api2,api3];
const mountVendor=async php=>{const mount=async(source,target)=>{await php.mkdir(target);for(const file of await readdir(source,{withFileTypes:true})){if(file.isDirectory())await mount(join(source,file.name),target+'/'+file.name);else await php.writeFile(target+'/'+file.name,await readFile(join(source,file.name)));}};await mount('vendor','/app-vendor');};
const options={...request,Host:PhpNode,apis,duplicate,probe:new URL('./probe.so',import.meta.url),absent:new URL('./deliberately-absent.so',import.meta.url),componentLibrary:${JSON.stringify(basename(prepared.packages[0].receipt.library))},read:path=>readFile(path,'utf8'),mountVendor};
const result=await ({composition:runComposition,conflict:runConflict,failure:runFailure})[request.kind](options);
console.log(JSON.stringify(result));
`;

const browserRunner = `import {PhpWeb} from './node_modules/php-wasm/PhpWeb.mjs';
import {runComposition} from './loading.mjs';
import * as installed from './bundled/consumer.mjs';
const query=new URL(location.href).searchParams,loading=query.get('loading'),mode=query.get('mode');
try {
  const duplicate=await import('./bundled/consumer.mjs?duplicate'),executions=[];
  for(const order of ['graph-first','peer-first'])executions.push(await runComposition({Host:PhpWeb,apis:[installed.api0,installed.api1,installed.api2],duplicate,loading,mode,order,arrangement:'bundled',probe:new URL('./probe.so',import.meta.url),read:async path=>(await fetch('./'+path)).text()}));
  globalThis.phpCorpus={executions};
}catch(error){globalThis.phpCorpus={error:error.stack};}
`;

/**
 * Require initialization, deduplication, copies and retirement from a real host.
 *
 * @param run - Installed caller observation.
 * @param packages - Original package receipts.
 * @param runtimeManifest - Authenticated shared runtime.
 */
export const assertPhpWasmGraphComposition = (run, packages, runtimeManifest) => {
	assert.equal(run.observed.actualPhpBits, 32); assert.equal(run.observed.hostVersion, "8.4.1");
	assert.equal(run.observed.checks, 651); assert.equal(run.retired.checks, 659);
	assert.deepEqual(run.observed.snapshot, [1, 2, 1, 3, 3, 0]);
	assert.deepEqual(run.retired.snapshot, [1, 3, 1, 3, 3, 0]);
	assert.equal(run.retired.retirementRejections, 6); assert.equal(run.retired.copiedValueSurvived, true);
	assert.equal(run.observed.copiedResults, true); assert.equal(run.observed.nominalRejection, true);
	assert.equal(run.repeatedRequests, 20); assert.equal(run.duplicateDescriptor, true); assert.equal(run.interpreterSurvived, true);
	assert.deepEqual(run.libraries, [basename(runtimeManifest.library), ...packages.slice(0, 3).map(pkg => basename(pkg.receipt.library))].sort());
	const initial = run.loading === "lazy" ? 0 : run.loading === "mixed" ? 2 : 4;
	assert.deepEqual(run.phases, ["ready", "autoload", "invalid", "complete"].map((stage, index) => ({ stage, libraries: index === 3 ? 4 : initial })));
};

/**
 * Prove shared loading with fresh packages and source-free consumer processes.
 *
 * @param root - Test-owned scratch directory.
 * @param diagnostic - Progress reporter.
 */
export const checkPhpWasmGraphLoading = async (root, diagnostic) => {
	const prepared = await preparePhpWasmGraphLoading(root, diagnostic), { deployment, packages, runtimeManifest } = prepared;
	const files = {};
	for(const [source, target] of [["recursive-php-wasm-composition.php", "consumer.php"], ["recursive-php-wasm-loading.mjs", "loading.mjs"]])
	{
		const bytes = await readFile(`tests/fixtures/structured-types/${source}`);
		await saveLakeFile(deployment, target, bytes); files[source] = sha256(bytes);
	}
	const runner = nodeRunner(prepared); await saveLakeFile(deployment, "host.mjs", runner);
	await saveLakeFile(deployment, "browser.mjs", browserRunner);
	await saveLakeFile(deployment, "index.html", '<!doctype html><html><head><link rel="icon" href="data:,"></head><body><script type="module" src="./browser.mjs"></script></body></html>');
	const before = await phpWasmInventory(deployment), composition = [], conflicts = [], failures = [];
	const execute = async request => {
		diagnostic("PHP-Wasm shared loading: " + Object.values(request).join("/"));
		const result = await runCopied(process.execPath, ["host.mjs", JSON.stringify(request)], deployment
			, { PATH: "/unavailable", LEAN_PATH: "/unavailable", LEAN_SYSROOT: "/unavailable", LANG: "C.UTF-8" });
		assert.equal(result.stderr, ""); return JSON.parse(result.stdout);
	};
	for(const arrangement of ["embedded", "composer", "bundled"])
	for(const loading of ["startup", "lazy", "mixed"])
	for(const mode of ["weak", "strict"])
	for(const order of ["graph-first", "peer-first"])
	{
		const run = await execute({ kind: "composition", arrangement, loading, mode, order });
		assertPhpWasmGraphComposition(run, packages, runtimeManifest); composition.push(run);
	}
	for(const loading of ["startup", "lazy"])
	for(const first of [0, 3])
	{
		const run = await execute({ kind: "conflict", first, loading });
		assert.equal(run.code, "php-wasm-component-conflict"); assert.equal(run.rejectedBeforeFetch, true); assert.equal(run.isolatedBuildUsable, true);
		assert.equal(run.value, first === 0 ? "41" : "99"); conflicts.push(run);
	}
	for(const failure of ["disabled", "unregistered", "missing-component", "missing-runtime"])
	for(const mode of ["weak", "strict"])
	{
		const run = await execute({ kind: "failure", failure, mode });
		assert.equal(run.noRetry, true); assert.equal(run.handlerRestored, true); assert.equal(run.interpreterSurvived, true);
		assert.equal(run.messages.length, 4); failures.push(run);
	}
	const browser = await browserPhpWasmCorpus({ t: { diagnostic }, library: { id: "recursive-shared-loading" }, deployment, environment: process.env });
	for(const configuration of browser.executions)
	{
		assert.deepEqual(configuration.executions.map(run => run.order), ["graph-first", "peer-first"]);
		for(const run of configuration.executions) assertPhpWasmGraphComposition(run, packages, runtimeManifest);
	}
	assert.deepEqual(await phpWasmInventory(deployment), before);
	return { schemaVersion: 1, packages, runtimeManifest
		, runtimeIdentity: prepared.runtimeIdentity
		, installation: prepared.installation, probe: prepared.probe, files
		, runnerSha256: sha256(runner), browserRunnerSha256: sha256(browserRunner)
		, deploymentFiles: before, producersRemoved: prepared.producersRemoved
		, unchangedDeployment: true
		, composition, conflicts, failures, browser };
};
