/**
 * One installed CLI compiles an owned API for native PHP and PHP-Wasm together.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson } from "../src/capsule/node.mjs";
import { readVerifiedPhpWasmCopiedPackageSet } from "../src/release/php-wasm-copied-package.mjs";
import { ownedDotnetCallbacksReviewedIr } from "./helpers/owned-dotnet-callback-fixture.mjs";
import { installOwnedPhpWasmCli } from "./helpers/owned-php-wasm-cli.mjs";
import { installOwnedPhpArchive } from "./helpers/owned-php-installed.mjs";
import { installPhpWasmGraphPackages } from "./helpers/php-wasm-graph-packages.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { copiedCleanEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("installed CLI exposes both PHP ownership profiles atomically from ordinary and reviewed sources", {
	skip: process.env.LEAN_BRIDGE_OWNED_PHP_WASM_MULTI_PROFILE_TEST !== "1"
	, timeout: 1800000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-owned-php-profiles-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const cli = await installOwnedPhpWasmCli({ directory: join(directory, "cli")
		, runtimeRoot: resolve(process.env.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME ?? "build/owned-wasm32-runtime")
		, phpSource: resolve(process.env.LEAN_BRIDGE_PHP_SOURCE ?? "build/php-wasm-sdk/php8.4-src")
		, leanPrefix: resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2")
		, emsdkRoot: resolve(process.env.LEAN_BRIDGE_PHP_EMSDK ?? ".toolchains/emsdk-php-wasm") });
	const observations = [], diagnostic = message => { t.diagnostic(message); process.stderr.write(message + "\n"); };
	for(const reviewed of [false, true])
	{
		const root = join(directory, reviewed ? "reviewed" : "ordinary"), author = join(root, "author");
		const project = join(author, "project"), output = join(author, "output"), handoff = join(root, "handoff");
		await cp("tests/fixtures/onboarding/owned-dotnet-callables", project, { recursive: true });
		const config = reviewed ? { schemaVersion: 1, modules: ["Owned"] } : await json(join(project, "lean-bridge.exports.json"));
		const npm = { name: "@lean-bridge-test/owned-php-wasm", version: "1.0.0" };
		config.targets = { "php-native": { name: "lean-bridge-test/owned-native", version: "1.0.0" }
			, "php-wasm": { npm, composer: { name: "lean-bridge-test/owned-wasm", version: "1.0.0" } } };
		await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
		if(reviewed) await saveLakeFile(project, "reviewed.binding-ir.json", canonicalJson(ownedDotnetCallbacksReviewedIr()));
		const before = await lakeInputState(project), targets = reviewed ? ["php-wasm", "php-native"] : ["php-native", "php-wasm"];
		diagnostic(`${reviewed ? "reviewed" : "ordinary"}: installed CLI compiles both PHP ownership profiles`);
		const build = await cli.build(project, output, targets);
		assert.deepEqual(await lakeInputState(project), before);
		assert.equal(build.result.profiles.length, 2); assert.equal(build.result.packages.length, 2);
		assert.match(build.result.sourceApiSha256, /^[a-f0-9]{64}$/u);
		const nativeRoot = join(output, "profiles/native"), wasmRoot = join(output, "profiles/php-wasm");
		const native = await json(join(nativeRoot, "native/component/model.json"));
		const wasm = await json(join(wasmRoot, "php-wasm/component/model.json"));
		assert.equal(native.pointerBits, 64); assert.equal(wasm.pointerBits, 32);
		assert.equal(native.schemaVersion, 7); assert.equal(wasm.schemaVersion, 7);
		assert.equal(native.exports.length, 51); assert.equal(wasm.exports.length, 51);
		assert.equal(Boolean(native.sourceIdentity.reviewedBindingIr), reviewed);
		assert.deepEqual(native.sourceIdentity.reviewedBindingIr, wasm.sourceIdentity.reviewedBindingIr);
		const packageSetReceipt = await copyPackageSetHandoff(output, handoff);
		const nativeRelease = await json(join(nativeRoot, "native-release.json")), pkg = nativeRelease.packages[0];
		const nativeInstalled = await installOwnedPhpArchive({ root: join(root, "native")
			, archive: join(nativeRoot, "archives", pkg.archive)
			, pkg, environment: process.env });
		const releaseRoot = join(wasmRoot, "packages/php-wasm");
		const wasmInstalled = await installPhpWasmGraphPackages({ root
			, release: { output: releaseRoot, ...await readVerifiedPhpWasmCopiedPackageSet(releaseRoot) }
			, host: resolve(process.env.LEAN_BRIDGE_PHP_WASM_HOST ?? "build/php-wasm-host/node_modules/php-wasm")
			, diagnostic });
		await rm(author, { recursive: true });
		const verification = await cli.verify(join(handoff, "package-set-receipt.json"));
		await rm(handoff, { recursive: true });
		await saveLakeFile(nativeInstalled.deployment, "consumer.php", await readFile("tests/fixtures/structured-types/owned-installed-php.php"));
		const nativeRun = await runCopied(nativeInstalled.php, [...nativeInstalled.runtimeOptions, "consumer.php"], nativeInstalled.deployment, nativeInstalled.environment);
		assert.equal(nativeRun.stderr, ""); const nativeObserved = JSON.parse(nativeRun.stdout);
		assert.equal(nativeObserved.primitives, 19); assert.ok(nativeObserved.checks > 200);
		await saveLakeFile(wasmInstalled.deployment, "consumer.php", await readFile("tests/fixtures/structured-types/owned-php-wasm-installed.php"));
		await saveLakeFile(wasmInstalled.deployment, "consumer.mjs", `import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PhpNode} from 'php-wasm/PhpNode';
import api from ${JSON.stringify(npm.name)};
const php=new PhpNode({version:'8.4',autoTransaction:false,ini:'memory_limit=512M',sharedLibs:[api]});
let output='',errors='';
php.addEventListener('output',event=>{output+=event.detail.join('');});
php.addEventListener('error',event=>{errors+=event.detail.join('');});
await php.writeFile('/consumer.php',await readFile('consumer.php','utf8'));
assert.equal(await php.run("<?php require '"+api.autoload+"'; require '/consumer.php';"),0);
assert.equal(errors,'');console.log(output);
`);
		const wasmRun = await runCopied(process.execPath, ["consumer.mjs"], wasmInstalled.deployment, copiedCleanEnvironment);
		assert.equal(wasmRun.stderr, ""); const wasmObserved = JSON.parse(wasmRun.stdout);
		assert.equal(wasmObserved.phpBits, 32); assert.equal(wasmObserved.scalars, 19); assert.equal(wasmObserved.checks, 169);
		observations.push({ reviewed, build, packageSetReceipt, verification
			, nativeObserved, wasmObserved, nativeModel: native, wasmModel: wasm
			, sourceUnchanged: true, authorRemoved: true });
		await rm(root, { recursive: true });
	}
	await saveLakeFile("build/owned-php-wasm", "multi-profile.json", canonicalJson({ schemaVersion: 1, installedCli: cli.identity, observations }));
});
