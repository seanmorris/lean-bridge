/**
 * Higher-order native closures keep unanchored arguments in their native form.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { generateOwnedJvmPackage } from "../src/backends/jvm/owned-package.mjs";
import { compileJvmSources } from "../src/build/compile-jvm-sources.mjs";
import { ownedDotnetCallbackResultReviewedIr } from "./helpers/owned-dotnet-callback-result-fixture.mjs";
import { nativeFixtureEnvironment } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const mixedCallbacks = hostCallbacks => {
	const ir = ownedDotnetCallbackResultReviewedIr();
	const site = ir.declarations.find(fn => fn.name === "callbackRecord").parameters[1];
	const callback = ir.types.find(node => node.id === site.type.id);
	callback.callable.result.ownership = "lease";
	callback.callable.result.lifetime = { scope: "explicit", anchor: null };
	return generateOwnedJvmPackage(ir, null, { callbackResultAnchors: true, hostCallbacks });
};

for(const hostCallbacks of [false, true])
{
	test(`JVM mixed callback signatures select ${hostCallbacks ? "host" : "native"} inner arguments`, () => {
		const model = mixedCallbacks(hostCallbacks);
		assert.equal(model.callbacks.filter(callback => callback.anchor !== undefined).length, 3);
		const source = suffix => model.files[Object.keys(model.files).find(path => path.endsWith(suffix))];
		assert.match(source("/DispatchResultClosure.java"), hostCallbacks
			? /return rawInvocation\.invoke\(arg0\.asCallback\(\)\);/u
			: /return rawInvocation\.invoke\(arg0\);/u);
		assert.match(source("/_OwnedKotlinDispatchResultClosure.kt"), hostCallbacks
			? /rawInvocation\(arg0\.asCallback\(\)\)/u
			: /rawInvocation\(arg0\)/u);
	});

	test(`public JVM mixed callback signatures compile (${hostCallbacks ? "host" : "no-host"})`, {
		skip: process.env.LEAN_BRIDGE_OWNED_JVM_CALLBACK_RESULT_TEST !== "1"
		, timeout: 300000
	}, async t => {
		const root = await mkdtemp(join(tmpdir(), "lean-bridge-jvm-mixed-callbacks-"));
		t.after(() => rm(root, { recursive: true, force: true }));
		const model = mixedCallbacks(hostCallbacks);
		for(const [path, source] of Object.entries(model.files)) await saveLakeFile(root, path, source);
		await compileJvmSources({ root, files: model.files, environment: nativeFixtureEnvironment(["java", "kotlin"]) });
	});
}
