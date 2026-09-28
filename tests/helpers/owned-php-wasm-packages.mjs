/**
 * Build actual owned PHP-Wasm archives and consume them after offline install.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, readdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildPhpWasmCopiedComponent } from "../../src/build/php-wasm-copied-component.mjs";
import { readVerifiedPhpWasmCopiedRuntime, readVerifiedPhpWasmCopiedComponent } from "../../src/build/php-wasm-copied-artifacts.mjs";
import { buildPhpWasmCopiedPackages, readVerifiedPhpWasmCopiedPackageSet } from "../../src/release/php-wasm-copied-package.mjs";
import { ownedDotnetCallbacksReviewedIr } from "./owned-dotnet-callback-fixture.mjs";
import { installPhpWasmGraphPackages } from "./php-wasm-graph-packages.mjs";
import { bundlePhpWasmGraph } from "./php-wasm-graph-browser.mjs";
import { checkOwnedPhpWasmBrowser } from "./owned-php-wasm-browser.mjs";
import { buildOwnedPhpWasmPeer, checkOwnedPhpWasmCoexistence } from "./owned-php-wasm-coexistence.mjs";
import { buildOwnedPhpWasmObserver } from "./owned-php-wasm-observer.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";

const hostSource = name => `import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {PhpNode} from 'php-wasm/PhpNode';
import descriptor from ${JSON.stringify(name)};
process.setUncaughtExceptionCaptureCallback(error=>{console.error(error.stack);process.exit(1);});
const [arrangement,loading,strict]=process.argv.slice(2),libraries=[];
const api=loading==='lazy'?descriptor.lazy:descriptor;
const selected=arrangement==='composer'?api.extensions:api;
const php=new PhpNode({version:'8.4',autoTransaction:false,ini:'memory_limit=512M',
  sharedLibs:loading==='startup'?[selected]:[],dynamicLibs:[...(loading==='lazy'?[selected]:[]),{name:'observer.so',url:new URL('./observer.so',import.meta.url),ini:false}],
  locateFile:name=>{if(name.startsWith('php8.4-lb_')||name.startsWith('liblean_bridge_php_wasm_copied_'))libraries.push(name);}});
let stdout='',stderr='';
php.addEventListener('output',event=>{stdout+=event.detail.join('');});php.addEventListener('error',event=>{stderr+=event.detail.join('');});
const run=async source=>{const status=await php.run(source);if(status||stderr)throw Error(JSON.stringify({status,stdout,stderr}));};
await php.binary;
const initial=loading==='lazy'?0:2;assert.equal(libraries.length,initial);
const mount=async(source,target)=>{await php.mkdir(target);for(const file of await readdir(source,{withFileTypes:true})){
  if(file.isDirectory())await mount(join(source,file.name),target+'/'+file.name);
  else await php.writeFile(target+'/'+file.name,await readFile(join(source,file.name)));}};
if(arrangement==='composer'){await mount('vendor','/app-vendor');await run("<?php require '/app-vendor/autoload.php';");}
else await run("<?php require '"+api.autoload+"';");
assert.equal(libraries.length,initial);
await run("<?php try { LeanOwnedAggregates\\\\new_ticket(42,'invalid'); throw new Exception('Missing rejection'); } catch(TypeError $error) {}");
assert.equal(libraries.length,initial,'Invalid input initialized a lazy extension');
await php.writeFile('/consumer.php',(await readFile('consumer.php','utf8')).replace('strict_types=1','strict_types='+strict));
await run("<?php require '/consumer.php';");
const observed=JSON.parse(stdout);assert.equal(libraries.length,2);assert.equal(new Set(libraries).size,2);
const snapshot=async()=>{stdout='';stderr='';await run("<?php if(!function_exists('owned_installed_snapshot'))dl('observer.so'); gc_collect_cycles(); echo json_encode(owned_installed_snapshot());");
  const value=JSON.parse(stdout);assert.equal(value.runtimeState,2);assert.equal(value.runtimeInitRuns,1);assert.equal(value.liveIdentities,0);return value;};
const cleaned=await snapshot();
await php.refresh();
stdout='';stderr='';
const autoload=arrangement==='composer'?'/app-vendor/autoload.php':api.autoload;
await run("<?php require '"+autoload+"'; $ticket=LeanOwnedAggregates\\\\new_ticket(Brick\\\\Math\\\\BigInteger::of(77),'fresh'); "+
  "if((string)LeanOwnedAggregates\\\\serial($ticket)!=='77')throw new Exception('Request recovery failed'); $ticket->close(); echo 'recovered';");
assert.equal(stdout,'recovered');assert.equal(libraries.length,2);
const refreshed=await snapshot();
console.log(JSON.stringify({arrangement,loading,strict:Number(strict),observed,libraries,invalidStayedCold:true,requestRecovery:true,cleaned,refreshed}));
`;

const rejectDrift = async (root, runtimeIdentity) => {
	const inventory = JSON.parse(await readFile(join(root, "artifacts.json"), "utf8"));
	const receipt = JSON.parse(await readFile(join(root, "php-wasm-component.json"), "utf8"));
	const rejected = [];
	const check = async (path, bytes) => {
		const original = await readFile(join(root, path));
		try
		{
			await saveLakeFile(root, path, bytes);
			await saveLakeFile(root, "artifacts.json", canonicalJson({ ...inventory
				, files: { ...inventory.files, [path]: { bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) } } }));
			await assert.rejects(() => readVerifiedPhpWasmCopiedComponent(root, runtimeIdentity));
			rejected.push(path);
		}
		finally
		{
			await saveLakeFile(root, path, original);
			await saveLakeFile(root, "artifacts.json", canonicalJson(inventory));
		}
	};
	for(const ownedGraph of [undefined, { ...receipt.ownedGraph, layoutSha256: "0".repeat(64) }, { ...receipt.ownedGraph, extra: true }])
		await check("php-wasm-component.json", canonicalJson({ ...receipt, ownedGraph }));
	for(const path of Object.keys(receipt.ownedGraph.files))
		await check(path, Buffer.concat([await readFile(join(root, path)), Buffer.from("\n/* re-signed drift */\n")]));
	await readVerifiedPhpWasmCopiedComponent(root, runtimeIdentity);
	return rejected;
};

/**
 * Exercise ordinary and reviewed builds without compiler access in consumers.
 *
 * @param directory - Test-owned root, cleaned by the invoking test.
 * @param diagnostic - Progress reporter.
 */
export const checkOwnedPhpWasmPackages = async (directory, diagnostic) => {
	const leanPrefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
	const runtimeRoot = resolve(process.env.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME ?? "build/owned-wasm32-runtime");
	const emsdkRoot = resolve(process.env.LEAN_BRIDGE_PHP_EMSDK ?? ".toolchains/emsdk-php-wasm");
	const phpSource = resolve(process.env.LEAN_BRIDGE_PHP_SOURCE ?? "build/php-wasm-sdk/php8.4-src");
	const host = resolve(process.env.LEAN_BRIDGE_PHP_WASM_HOST ?? "build/php-wasm-host/node_modules/php-wasm");
	const runtime = await readVerifiedPhpWasmCopiedRuntime(runtimeRoot);
	const consumer = await readFile("tests/fixtures/structured-types/owned-php-wasm-installed.php", "utf8");
	const observations = [];
	for(const reviewed of [false, true])
	{
		const root = join(directory, reviewed ? "reviewed" : "ordinary"), author = join(root, "author");
		const projectRoot = join(author, "project"), componentRoot = join(author, "component");
		const fixture = "tests/fixtures/onboarding/owned-dotnet-callables";
		for(const path of ["Owned.lean", "lean-toolchain", "lakefile.toml"])
			await saveLakeFile(projectRoot, path, await readFile(join(fixture, path)));
		const config = JSON.parse(await readFile(join(fixture, "lean-bridge.exports.json"), "utf8"));
		const selected = reviewed ? { schemaVersion: 1, modules: config.modules } : config;
		delete selected.targets;
		const npmSettings = { name: "@lean-bridge-test/owned-php-wasm", version: "1.0.0" };
		const composerSettings = { name: "lean-bridge-test/owned-php-wasm", version: "1.0.0" };
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ ...selected
			, targets: { "php-wasm": { npm: npmSettings, composer: composerSettings } } }));
		if(reviewed) await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(ownedDotnetCallbacksReviewedIr()));
		const before = await lakeInputState(projectRoot);
		diagnostic(`${reviewed ? "reviewed" : "ordinary"}: building the real PHP-Wasm ownership component`);
		await buildPhpWasmCopiedComponent({ projectRoot, outputRoot: componentRoot, leanPrefix, runtimeRoot, emsdkRoot, phpSource })
			.catch(error => { error.message += ": " + JSON.stringify(error.details); throw error; });
		assert.deepEqual(await lakeInputState(projectRoot), before);
		const { model, receipt } = await readVerifiedPhpWasmCopiedComponent(componentRoot, runtime.identity);
		assert.equal(model.pointerBits, 32); assert.equal(model.schemaVersion, 7);
		assert.equal(model.ownedGraph.transport, "owned-zend-v1"); assert.equal(model.exports.length, 51);
		const inputs = { metadata: JSON.parse(await readFile(join(componentRoot, "metadata.json"), "utf8"))
			, sourceIdentity: model.sourceIdentity, component: model.component };
		const rejected = await rejectDrift(componentRoot, runtime.identity);
		const options = { componentRoot, runtimeRoot, leanPrefix, npmSettings, composerSettings };
		const release = await buildPhpWasmCopiedPackages({ ...options, outputRoot: join(author, "release") });
		await readVerifiedPhpWasmCopiedPackageSet(release.output);
		diagnostic(`${reviewed ? "reviewed" : "ordinary"}: independently rebuilding and comparing package bytes`);
		const rebuiltRoot = join(author, "rebuilt");
		await buildPhpWasmCopiedComponent({ projectRoot, outputRoot: rebuiltRoot, leanPrefix, runtimeRoot, emsdkRoot, phpSource });
		assert.deepEqual(await lakeInputState(projectRoot), before);
		assert.deepEqual(JSON.parse(await readFile(join(rebuiltRoot, "artifacts.json"), "utf8")), JSON.parse(await readFile(join(componentRoot, "artifacts.json"), "utf8")));
		const repeated = await buildPhpWasmCopiedPackages({ ...options, componentRoot: rebuiltRoot, outputRoot: join(author, "repacked") });
		assert.deepEqual(repeated.report, release.report);
		diagnostic(`${reviewed ? "reviewed" : "ordinary"}: building the independent copied peer`);
		const peer = await buildOwnedPhpWasmPeer({ author, leanPrefix, runtimeRoot, emsdkRoot, phpSource, runtimeIdentity: runtime.identity });
		const observer = await buildOwnedPhpWasmObserver({ directory: join(author, "observer"), runtimeRoot, emsdkRoot, phpSource });
		const installed = await installPhpWasmGraphPackages({ root, release, host, diagnostic, companions: [peer.release] });
		await rm(author, { recursive: true }); await assert.rejects(() => readdir(author), { code: "ENOENT" });
		await saveLakeFile(installed.deployment, "observer.so", observer.bytes);
		await bundlePhpWasmGraph(installed.deployment, npmSettings.name);
		await saveLakeFile(installed.deployment, "consumer.php", consumer);
		const runner = hostSource(npmSettings.name); await saveLakeFile(installed.deployment, "run.mjs", runner);
		const executions = [];
		for(const arrangement of ["embedded", "composer"])
		for(const loading of ["startup", "lazy"])
		for(const strict of [0, 1])
		{
			diagnostic(`${reviewed ? "reviewed" : "ordinary"}: installed ${arrangement}/${loading}/strict${strict}`);
			const result = await runCopied(process.execPath, ["run.mjs", arrangement, loading, String(strict)], installed.deployment, copiedCleanEnvironment);
			assert.equal(result.stderr, ""); const execution = JSON.parse(result.stdout);
			assert.equal(execution.observed.scalars, 19); assert.equal(execution.observed.structured, 23);
			assert.equal(execution.observed.phpBits, 32); assert.ok(execution.observed.checks > 100);
			executions.push(execution);
		}
		const browser = await checkOwnedPhpWasmBrowser(installed.deployment, diagnostic);
		const coexistence = await checkOwnedPhpWasmCoexistence(installed.deployment, diagnostic);
		observations.push({ reviewed, inputs, model, receipt, rejected, browser
			, packageReceipt: release.report
			, reproducedArchives: repeated.report.archives
			, coexistence: { ...coexistence, peer: peer.component, sourceFiles: peer.sourceFiles }
			, observer: observer.identity
			, independentlyRebuiltExactly: true, sourceUnchanged: true
			, installed, authorRemoved: true
			, consumerSha256: sha256(consumer), runnerSha256: sha256(runner)
			, executions });
		await rm(root, { recursive: true });
	}
	assert.equal((await readVerifiedPhpWasmCopiedRuntime(runtimeRoot)).identity, runtime.identity);
	return { schemaVersion: 1, profile: "installed-owned-php-wasm"
		, compiledLean: true, installedPackage: true
		, runtimeIdentity: runtime.identity, runtimeManifest: runtime.manifest
		, observations };
};
