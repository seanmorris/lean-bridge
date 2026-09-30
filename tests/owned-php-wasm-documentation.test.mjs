/**
 * Compile the PHP ownership author guide and run its exact PHP example in Wasm.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
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

const block = (section, language) => {
	const match = section.match(new RegExp("```" + language + "\\n([^]*?)\\n```"));
	assert.ok(match, language + " documentation block"); return match[1] + "\n";
};

for(const consuming of [false, true]) test("installed CLI compiles the ownership guide and PHP-Wasm runs the unmodified Composer example" + (consuming ? " with consuming inputs" : ""), {
	skip: process.env.LEAN_BRIDGE_OWNED_PHP_WASM_DOCUMENTATION_TEST !== "1"
		|| consuming && process.env.LEAN_BRIDGE_OWNED_PHP_WASM_TRANSFER_TEST !== "1"
	, timeout: 1800000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-owned-php-wasm-docs-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const runtime = await prepareOwnedPhpWasmRuntime(directory);
	const cli = await installOwnedPhpWasmCli({ directory: join(directory, "cli")
		, runtimeRoot: runtime.root
		, phpSource: resolve(process.env.LEAN_BRIDGE_PHP_SOURCE ?? "build/php-wasm-sdk/php8.4-src")
		, leanPrefix: resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2")
		, emsdkRoot: resolve(process.env.LEAN_BRIDGE_PHP_EMSDK ?? ".toolchains/emsdk-php-wasm") });
	const authorGuide = await readFile("docs/publish/php.md", "utf8");
	const authorSection = authorGuide.split("### Export resource-containing values\n")[1].split("\n### ")[0];
	const consumerSection = (await readFile("docs/php.md", "utf8")).split(consuming ? "### Consuming inputs\n" : "### Resource-containing values\n")[1].split("\n### ")[0];
	const lean = block(authorSection, "lean"), consumer = block(consumerSection, "php");
	const configuration = consuming ? canonicalJson({ ...JSON.parse(block(authorSection, "json"))
		, ...JSON.parse(block(authorGuide.split("### Export consuming inputs\n")[1].split("\n### ")[0], "json")) })
		: block(authorSection, "json");
	const expected = consuming ? "42\n42\nclosed\n" : "42\n42\n";
	const author = join(directory, "author"), project = join(author, "project"), output = join(author, "output");
	await saveLakeFile(project, "Owned.lean", lean);
	await saveLakeFile(project, "lean-bridge.exports.json", configuration);
	await saveLakeFile(project, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
	await saveLakeFile(project, "lakefile.toml", 'name = "owned-aggregates"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Owned"\n');
	const targets = consuming ? ["c", "php-wasm"] : ["php-wasm"];
	const before = await lakeInputState(project), build = await cli.build(project, output, targets);
	assert.deepEqual(await lakeInputState(project), before);
	if(consuming)
	{
		assert.equal(build.result.profiles.length, 2);
		assert.match(build.result.sourceApiSha256, /^[a-f0-9]{64}$/u);
		const native = JSON.parse(await readFile(join(output, "profiles/native/native/component/model.json"), "utf8"));
		const wasm = JSON.parse(await readFile(join(output, "profiles/php-wasm/php-wasm/component/model.json"), "utf8"));
		assert.equal(native.schemaVersion, 8); assert.equal(wasm.schemaVersion, 8);
		assert.equal(native.pointerBits, 64); assert.equal(wasm.pointerBits, 32);
		assert.deepEqual(native.ownedGraph.inputTransfers, wasm.ownedGraph.inputTransfers);
	}
	const handoff = join(directory, "handoff"), packageSetReceipt = await copyPackageSetHandoff(output, handoff);
	const releaseRoot = join(output, consuming ? "profiles/php-wasm/packages/php-wasm" : "packages/php-wasm");
	const installed = await installPhpWasmGraphPackages({ root: directory
		, release: { output: releaseRoot, ...await readVerifiedPhpWasmCopiedPackageSet(releaseRoot) }
		, host: resolve(process.env.LEAN_BRIDGE_PHP_WASM_HOST ?? "build/php-wasm-host/node_modules/php-wasm")
		, diagnostic: message => t.diagnostic(message) });
	await rm(author, { recursive: true });
	const verification = await cli.verify(join(handoff, "package-set-receipt.json"));
	await rm(handoff, { recursive: true });
	await saveLakeFile(installed.deployment, "owned.php", consumer);
	await saveLakeFile(installed.deployment, "run.mjs", `import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {PhpNode} from 'php-wasm/PhpNode';
import api from ${JSON.stringify(JSON.parse(configuration).targets["php-wasm"].npm.name)};
const php=new PhpNode({version:'8.4',autoTransaction:false,sharedLibs:[api.extensions]});
let stdout='',stderr='';
php.addEventListener('output',event=>{stdout+=event.detail.join('');});
php.addEventListener('error',event=>{stderr+=event.detail.join('');});
await php.binary;await php.mkdir('/app');
const mount=async(source,target)=>{await php.mkdir(target);for(const entry of await readdir(source,{withFileTypes:true})){
  if(entry.isDirectory())await mount(join(source,entry.name),target+'/'+entry.name);
  else await php.writeFile(target+'/'+entry.name,await readFile(join(source,entry.name)));}};
await mount('vendor','/app/vendor');await php.writeFile('/app/owned.php',await readFile('owned.php','utf8'));
assert.equal(await php.run("<?php require '/app/owned.php';"),0);assert.equal(stderr,'');
assert.equal(stdout,${JSON.stringify(expected)});console.log(JSON.stringify({output:stdout,unmodifiedExample:true}));
`);
	const run = await runCopied(process.execPath, ["run.mjs"], installed.deployment, copiedCleanEnvironment);
	assert.equal(run.stderr, ""); const observed = JSON.parse(run.stdout);
	assert.deepEqual(observed, { output: expected, unmodifiedExample: true });
	await saveLakeFile(consuming ? "build/owned-php-wasm-transfers" : "build/owned-php-wasm", "documentation.json", canonicalJson({ schemaVersion: 1
		, installedCli: cli.identity, build, packageSetReceipt, verification
		, runtimeSupplied: runtime.supplied
		, sourceUnchanged: true, authorRemoved: true, observed
		, leanSha256: sha256(lean), configurationSha256: sha256(configuration)
		, consumerSha256: sha256(consumer) }));
});
