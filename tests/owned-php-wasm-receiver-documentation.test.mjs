/**
 * Execute the receiver guide from installed mixed C/PHP-Wasm packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { readVerifiedPhpWasmCopiedPackageSet } from "../src/release/php-wasm-copied-package.mjs";
import { installOwnedPhpWasmCli } from "./helpers/owned-php-wasm-cli.mjs";
import { installPhpWasmGraphPackages } from "./helpers/php-wasm-graph-packages.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { copiedCleanEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { prepareOwnedPhpWasmRuntime } from "./helpers/owned-php-wasm-runtime.mjs";

const block = (source, heading, language, occurrence = 0) => {
	const sections = source.split(heading + "\n"); assert.equal(sections.length, 2);
	const section = sections[1].split(/^#{1,3} /mu)[0];
	const blocks = [...section.matchAll(new RegExp("^```" + language + "\\n([^]*?)^```", "gmu"))];
	assert.ok(Number.isSafeInteger(occurrence) && occurrence >= 0);
	assert.ok(blocks.length > occurrence); return blocks[occurrence][1];
};

test("installed C/PHP-Wasm release runs the exact receiver documentation", {
	skip: process.env.LEAN_BRIDGE_OWNED_PHP_WASM_RECEIVER_TEST !== "1"
	, timeout: 1800000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-owned-php-wasm-receiver-docs-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const runtime = await prepareOwnedPhpWasmRuntime(directory);
	const cli = await installOwnedPhpWasmCli({ directory: join(directory, "cli")
		, runtimeRoot: runtime.root
		, phpSource: resolve(process.env.LEAN_BRIDGE_PHP_SOURCE ?? "build/php-wasm-sdk/php8.4-src")
		, leanPrefix: resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2")
		, emsdkRoot: resolve(process.env.LEAN_BRIDGE_PHP_EMSDK ?? ".toolchains/emsdk-php-wasm") });
	const authorGuide = await readFile("docs/publish/php.md", "utf8"), consumerGuide = await readFile("docs/php.md", "utf8");
	const lean = block(authorGuide, "### Export resource-containing values", "lean");
	const base = JSON.parse(block(authorGuide, "### Export resource-containing values", "json"));
	const contract = JSON.parse(block(authorGuide, "### Export methods and properties", "json"));
	const config = canonicalJson({ ...base, ...contract });
	const example = block(consumerGuide, "### Methods and properties", "php");
	const author = join(directory, "author"), project = join(author, "project"), output = join(author, "output");
	await saveLakeFile(project, "Owned.lean", lean);
	await saveLakeFile(project, "lean-bridge.exports.json", config);
	await saveLakeFile(project, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
	await saveLakeFile(project, "lakefile.toml", 'name = "owned-aggregates"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Owned"\n');
	const before = await lakeInputState(project), build = await cli.build(project, output, ["c", "php-wasm"]);
	assert.deepEqual(await lakeInputState(project), before);
	assert.equal(build.result.profiles.length, 2); assert.match(build.result.sourceApiSha256, /^[a-f0-9]{64}$/u);
	const native = JSON.parse(await readFile(join(output, "profiles/native/native/component/model.json"), "utf8"));
	const wasm = JSON.parse(await readFile(join(output, "profiles/php-wasm/php-wasm/component/model.json"), "utf8"));
	assert.equal(native.schemaVersion, 10); assert.equal(wasm.schemaVersion, 10);
	assert.equal(native.pointerBits, 64); assert.equal(wasm.pointerBits, 32);
	assert.equal(wasm.ownedGraph.inputTransfers, undefined);
	assert.equal(wasm.ownedGraph.receiverExports.exports.length, 2);
	assert.deepEqual(native.ownedGraph.receiverExports, wasm.ownedGraph.receiverExports);
	assert.deepEqual(native.ownedGraph.resultAnchors, wasm.ownedGraph.resultAnchors);
	assert.deepEqual(wasm.ownedGraph.resultAnchors.exports, [{ bindingId: "lean:Owned.callbackRecord", receiver: true }]);
	const handoff = join(directory, "handoff"), packageSetReceipt = await copyPackageSetHandoff(output, handoff);
	const releaseRoot = join(directory, "php-wasm-handoff");
	await cp(join(output, "profiles/php-wasm/packages/php-wasm"), releaseRoot, { recursive: true });
	await rm(author, { recursive: true }); await assert.rejects(readdir(author), { code: "ENOENT" });
	const verification = await cli.verify(join(handoff, "package-set-receipt.json"));
	const installed = await installPhpWasmGraphPackages({ root: directory
		, release: { output: releaseRoot, ...await readVerifiedPhpWasmCopiedPackageSet(releaseRoot) }
		, host: resolve(process.env.LEAN_BRIDGE_PHP_WASM_HOST ?? "build/php-wasm-host/node_modules/php-wasm")
		, diagnostic: message => t.diagnostic(message) });
	await rm(handoff, { recursive: true }); await assert.rejects(readdir(handoff), { code: "ENOENT" });
	await rm(releaseRoot, { recursive: true }); await assert.rejects(readdir(releaseRoot), { code: "ENOENT" });
	await saveLakeFile(installed.deployment, "members.php", example);
	const runner = `import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {PhpNode} from 'php-wasm/PhpNode';
import descriptor from ${JSON.stringify(base.targets["php-wasm"].npm.name)};
const loading=process.argv[2];assert.ok(['startup','lazy'].includes(loading));
const api=loading==='lazy'?descriptor.lazy:descriptor;
const php=new PhpNode({version:'8.4',autoTransaction:false,
  sharedLibs:loading==='startup'?[api.extensions]:[],dynamicLibs:loading==='lazy'?[api.extensions]:[]});
let stdout='',stderr='';
php.addEventListener('output',event=>{stdout+=event.detail.join('');});
php.addEventListener('error',event=>{stderr+=event.detail.join('');});
await php.binary;await php.mkdir('/app');
const mount=async(source,target)=>{await php.mkdir(target);for(const entry of await readdir(source,{withFileTypes:true})){
  if(entry.isDirectory())await mount(join(source,entry.name),target+'/'+entry.name);
  else await php.writeFile(target+'/'+entry.name,await readFile(join(source,entry.name)));}};
await mount('vendor','/app/vendor');await php.writeFile('/app/members.php',await readFile('members.php','utf8'));
assert.equal(await php.run("<?php require '/app/members.php';"),0);assert.equal(stderr,'');
assert.equal(stdout,'42\\nexpired\\n42\\n');console.log(JSON.stringify({loading,output:stdout,unmodifiedExample:true}));
`;
	await saveLakeFile(installed.deployment, "run.mjs", runner);
	const observations = [];
	for(const loading of ["startup", "lazy"])
	{
		const run = await runCopied(process.execPath, ["run.mjs", loading], installed.deployment, copiedCleanEnvironment);
		assert.equal(run.stderr, ""); const observed = JSON.parse(run.stdout);
		assert.deepEqual(observed, { loading, output: "42\nexpired\n42\n", unmodifiedExample: true });
		observations.push(observed);
	}
	await saveLakeFile("build/owned-php-wasm-receivers", "documentation.json", canonicalJson({ schemaVersion: 1
		, installedCli: cli.identity, build, packageSetReceipt, verification
		, runtimeSupplied: runtime.supplied, mixedTargets: ["c", "php-wasm"]
		, receiverExports: true, inputTransfers: false
		, sourceUnchanged: true, sourceFreeInstallation: true
		, authorRemoved: true, handoffRemoved: true, observations
		, leanSha256: sha256(lean), configurationSha256: sha256(config)
		, consumerSha256: sha256(example), runnerSha256: sha256(runner) }));
});
