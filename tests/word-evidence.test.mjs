/**
 * Bind installed platform integer claims to exact callers and archive identities.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { wordNativeSignatures, wordScalarSignatures } from "./helpers/word-fixture.mjs";

test("word evidence retains both source paths and each native caller's compiled-width checks", async () => {
	const record = JSON.parse(await readFile("docs/evidence/platform-words-20260918.json", "utf8"));
	const extensions = { c: "c", cpp: "cpp", python: "py", rust: "rs", dotnet: "cs", java: "java", kotlin: "kt", ruby: "rb", perl: "pl", "php-native": "php", "php-wasm": "php", "wit-wasi": "c" };
	assert.equal(record.sourceSha256, sha256(await readFile("tests/fixtures/onboarding/words/Words.lean")));
	assert.deepEqual(record.nativeSignatures, wordNativeSignatures);
	assert.deepEqual(record.scalarSignatures, wordScalarSignatures);
	assert.equal(record.nativeExecutions.length, 24);
	assert.equal(new Set(record.nativeExecutions.map(run => `${run.profile}/${run.path}`)).size, 24);
	for(const [profile, extension] of Object.entries(extensions)) for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const run = record.nativeExecutions.find(run => run.profile === profile && run.path === path);
		assert.ok(run, `${profile}/${path}`);
		const bits = profile === "php-wasm" ? 32 : 64;
		let source = (await readFile(`tests/fixtures/word-consumers/${profile === "php-wasm" ? "php-native" : profile}.${extension}`, "utf8")).replaceAll("__BITS__", String(bits));
		if(profile === "php-wasm") source = source.replace("require 'vendor/autoload.php';", "");
		assert.equal(run.consumerSha256, sha256(source)); assert.equal(run.wordBits, bits);
		assert.ok(run.checks >= 1000);
		assert.equal(run.sourceRemovedBeforeInstallation, true);
		assert.equal(run.offlineInstall, true); assert.equal(run.compilerFreePath, true);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"]) assert.match(run[key], /^[a-f0-9]{64}$/);
		assert.ok(run.packages.some(pkg => pkg.role === "component"));
		for(const pkg of run.packages) for(const archive of pkg.artifacts) assert.match(archive.sha256, /^[a-f0-9]{64}$/);
		if(profile !== "php-wasm") continue;
		assert.equal(run.arrangements.length, 12);
		assert.equal(new Set(run.arrangements.map(item => [item.realm, item.arrangement, item.loading, item.mode].join("/"))).size, 12);
		assert.equal(run.arrangements.filter(item => item.realm === "chromium").length, 4);
		assert.ok(run.arrangements.every(item => item.checks === run.checks && item.libraries === 2));
	}
	assert.equal(record.npmExecutions.length, 2);
	assert.deepEqual(record.npmExecutions.map(run => run.path).sort(), ["ordinary-source", "reviewed-ir"]);
	for(const run of record.npmExecutions)
	{
		assert.equal(run.result.wordBits, 32); assert.equal(run.result.checks, 2217);
		assert.equal(run.consumerSha256, sha256(await readFile("tests/fixtures/word-consumers/checks.mjs")));
		assert.equal(run.offlineInstall, true); assert.equal(run.compilerFreePath, true);
		assert.equal(run.sourceRelocatedBeforeInstallation, true);
		assert.deepEqual(run.typescript, { strict: true, executed: true });
		assert.deepEqual(run.browsers.map(item => item.engine).sort(), ["chromium", "firefox", "webkit"]);
		for(const browser of run.browsers) for(const realm of ["page", "react", "worker"]) assert.deepEqual(browser.result[realm], run.result);
		assert.match(run.receipt.runtime.sha256, /^[a-f0-9]{64}$/);
		assert.match(run.receipt.package.sha256, /^[a-f0-9]{64}$/);
	}
});
