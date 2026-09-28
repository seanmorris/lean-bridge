/**
 * A relocated CLI's ownership analysis must describe the API actually compiled.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { sourceApiIdentity } from "../src/analyze/semantic-model.mjs";
import { buildOwnedJavaScriptWasmComponent } from "../src/build/javascript-wasm-owned-component.mjs";
import { buildCliNpmPackage } from "../src/release/cli-npm-package.mjs";
import { ownedAnalysisFixture, ownedAnalysisTransport } from "./helpers/owned-analysis.mjs";
import { lakeInputState } from "./helpers/lake-workspace.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";

for(const reviewed of [false, true]) test(`relocated CLI ${reviewed ? "reviewed" : "ordinary"} owned analysis matches the compiled Wasm API`, {
	skip: process.env.LEAN_BRIDGE_OWNED_JS_WASM_BUILD_TEST !== "1", timeout: 300000
}, async t => {
	const { root, directory } = await ownedAnalysisFixture(t, reviewed);
	const candidate = await buildCliNpmPackage({ outputRoot: join(directory, "candidate") });
	const installed = join(directory, "relocated-cli");
	await cp(candidate.directory, installed, { recursive: true });
	await rm(candidate.output, { recursive: true });
	const { analyzeCompilerProject } = await import(pathToFileURL(join(installed, "src/analyze/compiler-analysis.mjs")));
	const { executeComponentEngineRequest } = await import(pathToFileURL(join(installed, "src/build/component-engine.mjs")));
	const before = await lakeInputState(root), installedBefore = await lakeInputState(installed);
	const observed = [];
	const runner = ownedAnalysisTransport({ observed
		, execute: options => {
			assert.equal(options.engineRoot, installed);
			return executeComponentEngineRequest(options);
		}
	});
	const report = await analyzeCompilerProject(root, { runner, environment: { ...process.env, LEAN_BRIDGE_BUILD_BACKEND: "nix" } });
	await assertJsonSchema("project-analysis", report);
	const built = await buildOwnedJavaScriptWasmComponent({ projectRoot: root
		, outputRoot: join(directory, "compiled")
		, leanPrefix: resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2")
		, leanRuntimeRoot: resolve(process.env.LEAN_BRIDGE_JS_TARGET_RUNTIME ?? "build/lean-runtime/f3b06c705e6c85f5314019d5d3baab0fec5b580c-743765bf566f43ec2f7b4eb84a85686880b3797efe83bf244d6fc7281e4f85a3-browser")
		, emsdkRoot: resolve(process.env.LEAN_WASM_EMSDK ?? ".toolchains/emsdk") });
	const options = { ownedGraphs: true };
	assert.deepEqual(sourceApiIdentity(report.bindingIr.document, options), sourceApiIdentity(built.model.bindingIr, options));
	assert.equal(built.model.profile, "javascript-wasm-owned-v1");
	assert.equal(report.bindingIr.document.declarations.length, 51);
	assert.ok(observed.some(args => args.includes("--metadata")));
	assert.deepEqual(await lakeInputState(root), before);
	assert.deepEqual(await lakeInputState(installed), installedBefore);
	t.diagnostic(JSON.stringify({ reviewed, relocatedCli: true
		, producerRemoved: true, analyzerAdaptersCompiled: false
		, buildProfile: built.model.profile, exports: 51
		, sourceApiSha256: sourceApiIdentity(built.model.bindingIr, options).sha256 }));
});
