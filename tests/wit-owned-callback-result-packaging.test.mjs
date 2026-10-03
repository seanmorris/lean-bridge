/**
 * Install callback-result WIT archives offline after deleting every producer
 * input, then compile and execute only against relocated public package files.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdir, mkdtemp, readFile, rename, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { readVerifiedOwnedWitHost } from "../src/build/owned-wit-artifacts.mjs";
import { packageOwnedWasi } from "../src/release/owned-wasi.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { ownedDotnetCallbackResultCombinedConfiguration
	, ownedDotnetCallbackResultCombinedReviewedIr, ownedDotnetCallbackResultCombinedSource
	, ownedDotnetCallbackResultConfiguration, ownedDotnetCallbackResultReviewedIr
	, ownedDotnetCallbackResultSource } from "./helpers/owned-dotnet-callback-result-fixture.mjs";
import { ownedWitCallbackResultInstalledProbe } from "./helpers/wit-owned-callback-result-probe.mjs";
import { checkOwnedWitInstalledDependencies } from "./helpers/wit-owned-package-loader.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
const variants = Object.freeze({
	"no-host": { combined: false, hostCallbacks: false }
	, host: { combined: false, hostCallbacks: true }
	, combined: { combined: true, hostCallbacks: true }
});

for(const mode of ["ordinary", "reviewed"])
	for(const [variant, capabilities] of Object.entries(variants))
		test(`installed WIT callback results (${mode}, ${variant}) survive source removal and relocation`, {
			skip: process.env.LEAN_BRIDGE_WIT_OWNED_CALLBACK_RESULT_PACKAGE_TEST !== "1"
			, timeout: 1_200_000
		}, async t => {
			const directory = await mkdtemp(join(tmpdir(), `lean-bridge-wit-callback-package-${mode}-${variant}-`));
			t.after(() => rm(directory, { recursive: true, force: true }));
			const project = join(directory, "source"), output = join(directory, "producer");
			const handoff = join(directory, "handoff"), consumer = join(directory, "consumer");
			await cp(resolve("tests/fixtures/onboarding/owned-aggregates"), project, { recursive: true });
			const suffix = capabilities.combined
				? ownedDotnetCallbackResultCombinedSource : ownedDotnetCallbackResultSource;
			await saveLakeFile(project, "Owned.lean", await readFile(join(project, "Owned.lean"), "utf8") + suffix);
			const settings = { name: `owned-callback-${variant}`, version: "1.2.3"
				, hostCallbacks: capabilities.hostCallbacks };
			const config = mode === "ordinary"
				? await (capabilities.combined
					? ownedDotnetCallbackResultCombinedConfiguration : ownedDotnetCallbackResultConfiguration)()
				: { schemaVersion: 1, modules: ["Owned"] };
			config.targets = { "wit-wasi": settings };
			await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
			if(mode === "reviewed") await saveLakeFile(project, "api.binding-ir.json", canonicalJson(capabilities.combined
				? ownedDotnetCallbackResultCombinedReviewedIr() : ownedDotnetCallbackResultReviewedIr()));
			const before = await lakeInputState(project), environment = nativeFixtureEnvironment(["wit-wasi"]);
			let built;
			try
			{
				built = await buildCanonicalProject({ projectRoot: project
					, outputRoot: output
					, targets: ["wit-wasi"], environment
					, onProgress: event => t.diagnostic(`${mode} ${variant}: ${event.message}`) });
			} catch(error)
			{ throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); }
			assert.deepEqual(await lakeInputState(project), before);
			assert.equal(built.backend, "ordinary-wit-native-owned-graph-v1");
			const witRoot = join(output, "native/owned-wit-adapter");
			const nativeRoot = join(output, "native/component"), runtimeRoot = join(output, "native/runtime");
			const options = { witRoot, nativeRoot, runtimeRoot, settings
				, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
				, glibcMinimumVersion: built.glibcMinimumVersion };
			const reassembled = join(directory, "reassembled");
			const rebuilt = await packageOwnedWasi({ ...options, working: reassembled });
			assert.deepEqual(rebuilt.packages, built.packages);
			assert.deepEqual(await readFile(join(reassembled, "archives", rebuilt.packages[0].archive))
				, await readFile(join(output, "archives", built.packages[0].archive)));
			await rm(reassembled, { recursive: true, force: true });
			const compiled = await json(join(witRoot, "native-wit-adapter.json"));
			assert.equal(Boolean(compiled.ownedValues.hostCallbacks), capabilities.hostCallbacks);
			assert.ok(compiled.ownedValues.callbackResultAnchors);
			assert.equal(compiled.ownedValues.schemaVersion, 5);
			assert.equal(Boolean(compiled.ownedValues.inputTransfers), capabilities.combined);
			assert.equal(Boolean(compiled.ownedValues.resultAnchors), capabilities.combined);
			assert.equal(Boolean(compiled.ownedValues.receiverExports), capabilities.combined);
			const verified = await readVerifiedOwnedWitHost(options);
			const source = await ownedWitCallbackResultInstalledProbe(verified.generated
				, capabilities.combined, capabilities.hostCallbacks);
			const sourceSha256 = sha256(source), receipt = await copyPackageSetHandoff(output, handoff);
			await rm(project, { recursive: true, force: true }); await rm(output, { recursive: true, force: true });
			await assert.rejects(access(project), { code: "ENOENT" });
			await assert.rejects(access(output), { code: "ENOENT" });
			await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
			const component = receipt.packages.find(item => item.role === "component");
			const archive = join(handoff, component.artifacts[0].path), consumerRoot = join(consumer, "wit-wasi");
			await mkdir(consumerRoot, { recursive: true });
			await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", archive]
				, consumerRoot, copiedCleanEnvironment);
			const installed = join(consumerRoot, `${settings.name}-${settings.version}-wit-wasi`);
			const manifest = await json(join(installed, "lean-bridge-package.json"));
			await verifyNativeFiles(installed, manifest.files);
			assert.deepEqual(manifest.ownedValues, compiled.ownedValues);
			assert.match(await readFile(join(installed, "README.md"), "utf8"), /## Callback-result anchors/u);
			await saveLakeFile(consumerRoot, "consumer.c", source);
			const tools = join(consumerRoot, "tools"); await mkdir(tools);
			for(const name of ["as", "ld"]) await symlink(`/usr/bin/${name}`, join(tools, name));
			const execute = async (root, name) => {
				const env = { ...copiedCleanEnvironment, PATH: tools
					, PKG_CONFIG_LIBDIR: join(root, "lib/pkgconfig"), PKG_CONFIG_PATH: "" };
				const flags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", manifest.pkgConfig]
					, consumerRoot, env)).stdout.trim().split(/\s+/u);
				await runCopied("/usr/bin/cc", ["-std=c11", "-O2", "-Wall"
					, "-Wextra", "-Werror"
					, "-UNDEBUG", "consumer.c", ...flags, "-o", name], consumerRoot, env);
				const result = await runCopied(join(consumerRoot, name), [], consumerRoot);
				assert.equal(result.stderr, ""); return JSON.parse(result.stdout);
			};
			const initial = await execute(installed, "consumer-initial");
			assert.ok(initial.checks > 100);
			assert.deepEqual({ allocationFailures: initial.allocationFailures
				, live: initial.live, identities: initial.identities }
				, { allocationFailures: 0, live: 0, identities: 0 });
			await rm(handoff, { recursive: true, force: true });
			await assert.rejects(access(handoff), { code: "ENOENT" });
			const relocated = join(directory, "relocated-package"); await rename(installed, relocated);
			const relocatedResult = await execute(relocated, "consumer-relocated");
			assert.deepEqual(relocatedResult, initial);
			const loader = mode === "reviewed" && variant === "combined"
				? await checkOwnedWitInstalledDependencies({ root: consumerRoot
					, installed: relocated
					, environment: { ...copiedCleanEnvironment, PATH: tools }
					, manifest }) : null;
			await saveLakeFile(resolve("build/owned-wit-callback-result-packaging")
				, `${mode}-${variant}.json`, canonicalJson({ schemaVersion: 1, mode, variant
					, sourceSha256, result: initial, relocatedResult
					, bindingIrSha256: built.bindingIrSha256
					, runtimeIdentity: built.nativeRuntimeIdentity, package: built.packages[0]
					, ownedValues: compiled.ownedValues, dependencies: compiled.dependencies
					, sourceRemoved: true, producerRemoved: true, handoffRemoved: true
					, offlineInstall: true, compilerFreeExecution: true, relocated: true
					, deterministicReassembly: true, pkgConfig: true, loader }));
			t.diagnostic(`${mode} ${variant}: ${initial.checks} installed public checks passed before and after relocation`);
		});
