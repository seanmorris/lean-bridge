/**
 * Real wasm32 resource members without callbacks or borrowed-result anchors.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { bundledBrickMath } from "../src/backends/php/brick-math.mjs";
import { buildPhpWasmCopiedComponent } from "../src/build/php-wasm-copied-component.mjs";
import { readVerifiedPhpWasmCopiedComponent } from "../src/build/php-wasm-copied-artifacts.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { ownedJvmPlainReceiverConfiguration, ownedJvmPlainReceiverReviewedIr, ownedJvmPlainReceiverSource } from "./helpers/owned-jvm-receiver-fixture.mjs";
import { ownedPhpPlainInstalledReceiverProbe, ownedPhpUnanchoredReceiverProbe } from "./helpers/owned-php-receiver-fixture.mjs";
import { ownedRustReceiverConfiguration, ownedRustReceiverReviewedIr, ownedRustReceiverSource } from "./helpers/owned-rust-receiver-fixture.mjs";
import { prepareOwnedPhpWasmRuntime } from "./helpers/owned-php-wasm-runtime.mjs";
import { buildOwnedPhpWasmObserver } from "./helpers/owned-php-wasm-observer.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";

const cases = ["ordinary", "reviewed"].flatMap(mode => [
	{ mode, consuming: false, unanchored: false }
	, { mode, consuming: true, unanchored: false }
	, { mode, consuming: true, unanchored: true }
]);
for(const { mode, consuming, unanchored } of cases)
	test(`PHP-Wasm ${unanchored ? "unanchored callback" : "resource"} receivers (${mode}, consuming=${consuming})`, {
		skip: process.env.LEAN_BRIDGE_OWNED_PHP_WASM_RECEIVER_TEST !== "1"
		, timeout: 900000
	}, async t => {
		const directory = await mkdtemp(join(tmpdir(), "lean-php-wasm-resource-receivers-"));
		t.after(() => rm(directory, { recursive: true, force: true }));
		const projectRoot = join(directory, "project"), componentRoot = join(directory, "component");
		const runtime = await prepareOwnedPhpWasmRuntime(directory);
		const leanPrefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
		const emsdkRoot = resolve(process.env.LEAN_BRIDGE_PHP_EMSDK ?? ".toolchains/emsdk-php-wasm");
		const phpSource = resolve(process.env.LEAN_BRIDGE_PHP_SOURCE ?? "build/php-wasm-sdk/php8.4-src");
		const host = resolve(process.env.LEAN_BRIDGE_PHP_WASM_HOST ?? "build/php-wasm-host/node_modules/php-wasm");
		for(const path of ["Owned.lean", "lakefile.toml", "lean-toolchain"])
			await saveLakeFile(projectRoot, path, await readFile(join("tests/fixtures/onboarding/owned-aggregates", path), "utf8")
				+ (path === "Owned.lean" ? unanchored ? ownedRustReceiverSource : ownedJvmPlainReceiverSource : ""));
		let configuration = await ownedJvmPlainReceiverConfiguration(consuming, mode === "reviewed");
		const reviewedIr = unanchored ? ownedRustReceiverReviewedIr() : ownedJvmPlainReceiverReviewedIr(consuming);
		if(unanchored)
		{
			if(mode === "ordinary")
			{
				configuration = await ownedRustReceiverConfiguration();
				for(const [name, contract] of Object.entries(configuration.contracts))
				{
					delete contract.result;
					if(!Object.keys(contract).length) delete configuration.contracts[name];
				}
			}
			for(const fn of reviewedIr.declarations) if(fn.result.ownership === "borrow")
				Object.assign(fn.result, { ownership: "lease", lifetime: { scope: "explicit", anchor: null } });
		}
		delete configuration.targets;
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(configuration));
		if(mode === "reviewed") await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(reviewedIr));
		const before = await lakeInputState(projectRoot);
		await buildPhpWasmCopiedComponent({ projectRoot, outputRoot: componentRoot
			, leanPrefix, runtimeRoot: runtime.root, emsdkRoot, phpSource
			, receiverExports: true, hostCallbacks: unanchored
			, anchoredResults: false, transferredInputs: consuming });
		assert.deepEqual(await lakeInputState(projectRoot), before);
		const { model, receipt } = await readVerifiedPhpWasmCopiedComponent(componentRoot, runtime.identity);
		assert.equal(model.schemaVersion, 10); assert.equal(model.pointerBits, 32);
		assert.equal(Boolean(model.ownedGraph.hostCallbacks), unanchored);
		assert.equal(model.ownedGraph.resultAnchors, undefined);
		assert.equal(Boolean(model.ownedGraph.inputTransfers), consuming);
		assert.equal(model.ownedGraph.receiverExports.exports.length, unanchored ? 16 : consuming ? 4 : 3);
		assert.equal(Boolean(receipt.ownedGraph.files["owned/callbacks.c"]), unanchored);
		const files = { ...bundledBrickMath()
			, "autoload.php": "<?php require __DIR__ . '/dependencies/brick-math/autoload.php'; require __DIR__ . '/src/Api.php';\n" };
		for(const path of Object.keys(receipt.ownedGraph.files).filter(path => path.endsWith(".php")))
			files[path] = await readFile(join(componentRoot, path), "utf8");
		let publicSource = ownedPhpPlainInstalledReceiverProbe(consuming);
		if(unanchored)
		{
			const preamble = publicSource.slice(0, publicSource.indexOf("use Brick"));
			publicSource = preamble + ownedPhpUnanchoredReceiverProbe.slice(ownedPhpUnanchoredReceiverProbe.indexOf("use Brick"));
			const dispose = "function dispose(array $values): void {\n    foreach ($values as $value) $value->close();\n}";
			assert.equal(publicSource.split(dispose).length, 2);
			publicSource = publicSource.replace(dispose, `function dispose(mixed $value): void {
    if ($value instanceof Big || $value instanceof Bytes) return;
    if (is_object($value)) {
        if (method_exists($value, 'close')) { $value->close(); return; }
        $value = get_object_vars($value);
    }
    if (is_array($value)) foreach ($value as $child) dispose($child);
}`);
			publicSource = publicSource.replace("use LeanOwnedAggregates\\Internal\\Native;\n", "");
			publicSource = publicSource.slice(0, publicSource.indexOf("gc_collect_cycles(); Native::close();"))
				+ "gc_collect_cycles(); echo json_encode(['checks' => $checks, 'ordinaryAutoload' => true]);\n";
		}
		const consumer = publicSource
			.replace("require __DIR__ . '/vendor/autoload.php';", "require __DIR__ . '/autoload.php';")
			.replace("'ordinaryAutoload' => true", "'ordinaryAutoload' => true, 'phpBits' => PHP_INT_SIZE * 8");
		assert.doesNotMatch(consumer, /Internal\\|FFI|owned_test_/u);
		files["consumer.php"] = consumer;
		for(const [path, source] of Object.entries(files)) await saveLakeFile(directory, path, source);
		const observer = await buildOwnedPhpWasmObserver({ directory: join(directory, "observer")
			, runtimeRoot: runtime.root, emsdkRoot, phpSource });
		await saveLakeFile(directory, "observer.so", observer.bytes);
		const libraries = [
			{ name: basename(runtime.manifest.library), url: pathToFileURL(join(runtime.root, runtime.manifest.library)).href, ini: false }
			, { name: basename(receipt.library), url: pathToFileURL(join(componentRoot, receipt.library)).href, ini: true }
		];
		const runner = `import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PhpNode} from ${JSON.stringify(pathToFileURL(join(host, "PhpNode.mjs")).href)};
let stdout='',stderr='';
process.setUncaughtExceptionCaptureCallback(error=>{console.error(JSON.stringify({stdout,stderr,error:error.stack}));process.exit(1);});
const php=new PhpNode({version:'8.4',autoTransaction:false,sharedLibs:${JSON.stringify(libraries)}.map(lib=>({...lib,url:new URL(lib.url)})),
  dynamicLibs:[{name:'observer.so',url:new URL('./observer.so',import.meta.url),ini:false}],ini:'memory_limit=512M'});
php.addEventListener('output',event=>{stdout+=event.detail.join('');});php.addEventListener('error',event=>{stderr+=event.detail.join('');});
await php.binary;
const directories=new Set();
for(const path of ${JSON.stringify(Object.keys(files))}) {
  let current='';const parts=path.split('/');parts.pop();
  for(const part of parts){current+='/'+part;if(!directories.has(current)){await php.mkdir(current);directories.add(current);}}
  await php.writeFile('/'+path,await readFile(path,'utf8'));
}
const run=async source=>{stdout='';stderr='';const status=await php.run(source);if(status||stderr)throw Error(JSON.stringify({status,stdout,stderr}));return JSON.parse(stdout);};
const observations=[];
for(const strict of [0,1]) {
  await php.writeFile('/consumer.php',(await readFile('consumer.php','utf8')).replace('strict_types=1','strict_types='+strict));
  const observed=await run("<?php require '/consumer.php';");
  const cleaned=await run("<?php if(!function_exists('owned_installed_snapshot'))dl('observer.so'); gc_collect_cycles(); echo json_encode(owned_installed_snapshot());");
  assert.equal(cleaned.runtimeInitRuns,1);assert.equal(cleaned.runtimeState,2);assert.equal(cleaned.liveIdentities,0);
  observations.push({strict,observed,cleaned});await php.refresh();
}
console.log(JSON.stringify(observations));
`;
		await saveLakeFile(directory, "host.mjs", runner);
		const result = await processBuildRunner.capture({ command: process.execPath, args: ["host.mjs"], cwd: directory, timeoutMs: 300000 })
			.catch(error => { throw new Error(JSON.stringify(error.details ?? error.message), { cause: error }); });
		assert.equal(result.stderr, ""); const observations = JSON.parse(result.stdout);
		assert.deepEqual(observations.map(item => item.strict), [0, 1]);
		for(const { observed, cleaned } of observations)
		{
			assert.equal(observed.phpBits, 32); assert.equal(observed.checks, unanchored ? 12 : consuming ? 26 : 25);
			assert.equal(cleaned.liveIdentities, 0);
		}
		const report = { schemaVersion: 1, mode, consuming, unanchored
			, compiledLean: true
			, installedPackage: false, producerInterface: "php-wasm-build-api"
			, runtimeIdentity: runtime.identity, model, receipt, observations
			, metadata: JSON.parse(await readFile(join(componentRoot, "metadata.json"), "utf8"))
			, sourceUnchanged: true, consumerSha256: sha256(consumer)
			, runnerSha256: sha256(runner)
			, observer: observer.identity };
		await saveLakeFile("build/owned-php-wasm-receivers", `${mode}-${unanchored ? "unanchored" : "plain-" + consuming}.json`, canonicalJson(report));
		t.diagnostic(JSON.stringify({ mode, consuming, unanchored, observations }));
	});
