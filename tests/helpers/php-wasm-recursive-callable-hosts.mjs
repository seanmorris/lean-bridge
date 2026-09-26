/**
 * Execute the same source-free recursive package in Node and network-isolated Chromium.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { browserPhpWasmCorpus } from "./type-corpus-php-wasm-browser.mjs";

/**
 * Recreate the installed Node caller without depending on a temporary directory.
 *
 * @param name - Installed package name.
 * @param request - Source path, mixed flag and extension name.
 */
export const phpWasmRecursiveNodeSource = (name, request) => `import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {PhpNode} from 'php-wasm/PhpNode';
import installedDescriptor from ${JSON.stringify(name)};
import bundledDescriptor from './bundled/consumer.mjs';
import {runRecursiveHost} from './recursive-host.mjs';
process.setUncaughtExceptionCaptureCallback(error=>{console.error(error.stack);process.exit(1);});
const [arrangement,loading,mode]=process.argv.slice(2);
const mount=async(php,source,target)=>{await php.mkdir(target);for(const file of await readdir(source,{withFileTypes:true})){if(file.isDirectory())await mount(php,join(source,file.name),target+'/'+file.name);else await php.writeFile(target+'/'+file.name,await readFile(join(source,file.name)));}};
const result=await runRecursiveHost({Php:PhpNode,descriptor:arrangement==='bundled'?bundledDescriptor:installedDescriptor,
  loading,mode,request:${JSON.stringify(request)},readConsumer:()=>readFile('consumer.php','utf8'),
  readDocumentation:()=>readFile('recursive-callbacks.php','utf8'),
  mountComposer:arrangement==='composer'?async php=>{await php.mkdir('/app');await mount(php,'vendor','/app/vendor');}:undefined});
console.log(JSON.stringify({realm:'node',arrangement,loading,mode,...result}));
`;
/**
 * Recreate the browser entry point used in both fresh contexts per arrangement.
 *
 * @param request - Source path, mixed flag and extension name.
 */
export const phpWasmRecursiveBrowserSource = request => `import {PhpWeb} from './node_modules/php-wasm/PhpWeb.mjs';
import descriptor from './bundled/consumer.mjs';
import {runRecursiveHost} from './recursive-host.mjs';
const query=new URL(location.href).searchParams;
try{
  globalThis.phpCorpus=await runRecursiveHost({Php:PhpWeb,descriptor,loading:query.get('loading'),mode:query.get('mode'),
    request:${JSON.stringify(request)},readConsumer:async()=>(await fetch('./consumer.php')).text()});
}catch(error){globalThis.phpCorpus={error:error.stack};}
`;

const checkObserved = (run, mixed) => {
	assert.equal(run.observed.checks, mixed ? 1249 : 1130); assert.equal(run.observed.rejections, 388);
	assert.equal(run.observed.primitiveChecks, mixed ? 119 : 0);
	assert.equal(run.observed.exports, mixed ? 98 : 33);
	assert.equal(run.observed.actualPhpBits, 32); assert.equal(run.observed.compiledLean, true);
	assert.equal(run.observed.installedPackage, true); assert.equal(run.observed.publicApiOnly, true);
	assert.equal(run.observed.fiberStartAvailable, false);
	assert.equal(run.invalidStayedCold, true); assert.equal(run.repeatedRequests, 20);
	assert.deepEqual(run.phases.map(phase => phase.stage), ["ready", "autoload", "invalid", "complete"]);
	assert.deepEqual(run.phases.map(phase => phase.libraries.length), run.loading === "lazy" ? [0, 0, 0, 2] : [2, 2, 2, 2]);
	assert.equal(new Set(run.phases.at(-1).libraries).size, 2);
	if(run.arrangement === "composer") assert.deepEqual(run.documentation, { verbatim: true, stdout: "42\n20\n42\n" });
	else assert.equal(run.documentation, undefined);
};

/**
 * Run installed npm, Composer and bundled arrangements, then repeat fresh browsers.
 *
 * @param options - Relocated deployment, package name and independent fixture request.
 * @param options.deployment - Source-free installed consumer directory.
 * @param options.name - Public npm package name.
 * @param options.request - Independently selected source path and mixed flag.
 * @param options.consumer - Public PHP caller source.
 * @param options.documentation - Verbatim standalone PHP documentation example.
 * @param options.diagnostic - Progress reporter.
 */
export const checkPhpWasmRecursiveHosts = async ({ deployment, name, request, consumer, documentation, diagnostic }) => {
	const common = await readFile("tests/fixtures/structured-callable-consumers/php-wasm-recursive-host.mjs", "utf8");
	const node = phpWasmRecursiveNodeSource(name, request), browser = phpWasmRecursiveBrowserSource(request);
	for(const [path, source] of Object.entries({ "recursive-host.mjs": common
		, "run.mjs": node, "browser.mjs": browser, "consumer.php": consumer
		, "recursive-callbacks.php": documentation
		, "index.html": '<!doctype html><html><head><link rel="icon" href="data:,"></head><body><script type="module" src="./browser.mjs"></script></body></html>' }))
		await saveLakeFile(deployment, path, source);
	const executions = [];
	for(const arrangement of ["embedded", "composer", "bundled"])
	for(const loading of ["startup", "lazy"])
	for(const mode of ["weak", "strict"])
	{
		diagnostic(`${request.path}: ${arrangement}/${loading}/${mode}`);
		const result = await runCopied(process.execPath, ["run.mjs", arrangement, loading, mode], deployment
			, { PATH: "/unavailable", LEAN_PATH: "/unavailable", LEAN_SYSROOT: "/unavailable", LANG: "C.UTF-8" });
		assert.equal(result.stderr, ""); const observed = JSON.parse(result.stdout);
		checkObserved(observed, request.mixed); executions.push(observed);
	}
	const chromium = await browserPhpWasmCorpus({ t: { diagnostic }, library: { id: request.path }, deployment, environment: process.env });
	for(const run of chromium.executions)
	{
		checkObserved(run, request.mixed); assert.deepEqual(run.observed, executions[0].observed);
	}
	return { executions, browser: chromium
		, sources: { common: sha256(common), node: sha256(node)
			, browser: sha256(browser), consumer: sha256(consumer)
			, documentation: sha256(documentation)
			, bundle: sha256(await readFile(join(deployment, "bundled/consumer.mjs"))) } };
};
