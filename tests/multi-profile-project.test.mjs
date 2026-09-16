/**
 * Check atomic npm/CPAN builds and execute both installed projections.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject, processBuildRunner } from "../src/build/canonical-build.mjs";
import { assertCompiledProfileApiAgreement, assertProfileApiAgreement, buildMultiProfileProject } from "../src/build/multi-profile-project.mjs";
import { createComponentBuildPlan } from "../src/build/component-plan.mjs";
import { executeComponentEngineRequest } from "../src/build/component-engine.mjs";
import { createNativeModel, createPhpWasmCopiedModel } from "../src/build/native-model.mjs";
import { installCpanArchive } from "../src/release/cpan-install.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { customLakeRoot, elaboratedLakeApi, lakeInputState, lakeWorkspaceFixture, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { assertRelocatedPackageSet } from "./helpers/package-set.mjs";
import { assertPackagedSourceNotices } from "./helpers/source-notices.mjs";
import { assertPackagedMetadata, packageMetadataFixture } from "./helpers/package-metadata.mjs";

const enabled = process.env.LEAN_BRIDGE_MULTI_PROFILE_TEST === "1";
const engineRoot = process.cwd(), json = async path => JSON.parse(await readFile(path, "utf8"));
const runtimeRoot = resolve(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT ?? "build/lean-link-spike/lazy");
const perl = process.env.LEAN_BRIDGE_TEST_PERL ?? "/usr/bin/perl";
const environment = { ...process.env, LEAN_BRIDGE_BUILD_BACKEND: "nix"
	, LEAN_BRIDGE_RUNTIME_ROOT: runtimeRoot
	, LEAN_BRIDGE_PERLS: JSON.stringify([perl]) };

test("multi-profile API agreement rejects different sources, meaning, contracts and compiler evidence", () => {
	const input = nativeMetadataFixture(), snapshot = "6".repeat(64);
	input.sourceIdentity.lakeDependencies = { snapshotSha256: snapshot };
	const nativeModel = createNativeModel({ ...input, component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" }, moduleName: "LeanBridge::Sample" });
	const wasmIr = structuredClone(nativeModel.bindingIr);
	const { sourceIdentity: source } = nativeModel;
	const wasmPlan = createComponentBuildPlan({ analysis: {
		bindingIr: { origin: "lean-elaborated", semanticSha256: nativeModel.bindingIrSha256, document: wasmIr }
		, adapterHints: [], sourceTreeSha256: source.sourceTreeSha256
		, project: { toolchain: source.request.metadata.toolchain }
		, inputs: [source.modules[0].source]
	}
	, runtime: { abiVersion: 1, leanCommit: source.leanCommit
		, patchSetSha256: "7".repeat(64) }
	, lakeSnapshotSha256: snapshot }).document;
	const options = {
		intent: { document: { source: wasmPlan.source, component: wasmPlan.component } }
		, configurationSha256: source.exportConfigurationSha256
		, wasmPlan, wasmIr, nativeModel };
	assert.match(assertProfileApiAgreement(options), /^[a-f0-9]{64}$/);
	for(const change of [
		value => { value.wasmPlan.source.treeSha256 = "0".repeat(64); }
		, value => { value.nativeModel.sourceIdentity.lakeDependencies.snapshotSha256 = "0".repeat(64); }
		, value => { value.nativeModel.sourceIdentity.exportConfigurationSha256 = "0".repeat(64); }
		, value => { value.nativeModel.sourceIdentity.leanCommit = "0".repeat(40); }
		, value => { value.wasmPlan.bindingIr.origin = "existing-validated"; }
		, value => { value.wasmIr.declarations[0].result.type.name = "uint64"; }
		, value => { value.wasmIr.declarations[0].source.extensions["lean-lang.org/export-contract"] = { effects: [] }; }
	]) {
		const changed = structuredClone(options); change(changed);
		assert.throws(() => assertProfileApiAgreement(changed));
	}
});

test("PHP-Wasm/native agreement retains distinct widths and rejects source or API drift", () => {
	const input = nativeMetadataFixture(), snapshot = "6".repeat(64);
	input.sourceIdentity.lakeDependencies = { snapshotSha256: snapshot };
	const component = { id: "sample@1.0.0", name: "sample", version: "1.0.0" };
	const options = { intent: { document: { component, source: { treeSha256: input.sourceIdentity.sourceTreeSha256, toolchain: "leanprover/lean4:v4.32.2", lakeSnapshotSha256: snapshot } } }
		, configurationSha256: input.sourceIdentity.exportConfigurationSha256
		, models: [createNativeModel({ ...input, component }), createPhpWasmCopiedModel({ ...structuredClone(input), component })] };
	assert.match(assertCompiledProfileApiAgreement(options), /^[a-f0-9]{64}$/);
	for(const change of [
		value => { value.models[1].pointerBits = 64; }
		, value => { value.models[1].sourceIdentity.leanCompilerSha256 = "0".repeat(64); }
		, value => { value.models[1].sourceIdentity.extractorSha256 = "0".repeat(64); }
		, value => { value.models[1].sourceIdentity.sourceTreeSha256 = "0".repeat(64); }
		, value => { value.models[1].bindingIr.declarations[0].result.type.name = "uint64"; }
		, value => { value.models.push(value.models[1]); }
	]) {
		const changed = structuredClone(options); change(changed);
		assert.throws(() => assertCompiledProfileApiAgreement(changed), { code: "multi-profile-mismatch" });
	}
});

test("mixed builds reject unknown targets and duplicate aliases before invoking a compiler", async () => {
	for(const targets of [["cpan", "perl"], ["npm", "cpan", "composer"], ["cpan", "composer"], ["npm", "npm", "cpan"], ["php-wasm", "cpan", "perl"], ["php-wasm", "unknown"]])
		await assert.rejects(() => buildCanonicalProject({ projectRoot: "/missing/project", targets }), { code: "invalid-package-targets" });
	for(const wasmTargets of [[], ["php-wasm", "php-wasm"], ["unknown"], ["npm", "php-wasm", "unknown"]])
		await assert.rejects(buildMultiProfileProject({ projectRoot: "/missing/project", nativeTargets: [], wasmTargets }), { code: "invalid-package-targets" });
});

test("failed and cancelled combined builds leave no output or profile staging", async t => {
	for(const cancel of [false, true]) await t.test(cancel ? "cancellation" : "native build failure", async t => {
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-multi-failure-"));
		t.after(() => rm(directory, { recursive: true, force: true }));
		const root = join(directory, "project"), runtime = join(directory, "runtime");
		await cp("tests/fixtures/documentation/lean-author", root, { recursive: true });
		// Placeholder runtime bytes are used only to reach the injected failing boundary.
		await saveLakeFile(runtime, "main.mjs", ""); await saveLakeFile(runtime, "main.wasm", "");
		const before = await lakeInputState(root), controller = new AbortController();
		let wasmCalls = 0;
		await assert.rejects(() => buildMultiProfileProject({
			projectRoot: root, engineRoot
			, outputRoot: join(directory, "release"), signal: controller.signal
			, environment: { ...environment, LEAN_BRIDGE_RUNTIME_ROOT: runtime, LEAN_BRIDGE_LEAN_PREFIX: join(directory, "missing-compiler") }
			, buildWasm: async options => {
				wasmCalls++;
				assert.deepEqual(options.targets, ["npm"]);
				assert.ok(options.lakeSnapshot.sha256);
				await saveLakeFile(options.outputRoot, "incomplete", "not a valid build");
				if(cancel) controller.abort(new Error("cancelled after Wasm"));
			}
		}));
		assert.equal(wasmCalls, 1);
		assert.deepEqual((await readdir(directory)).sort(), ["project", "runtime"]);
		assert.deepEqual(await lakeInputState(root), before);
	});
});

test("a late PHP-Wasm failure removes the completed npm profile and preserves sources", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-php-multi-failure-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const project = join(directory, "project"), runtime = join(directory, "runtime");
	await cp("tests/fixtures/documentation/lean-author", project, { recursive: true });
	await saveLakeFile(runtime, "main.mjs", ""); await saveLakeFile(runtime, "main.wasm", "");
	const before = await lakeInputState(project);
	let calls = 0;
	await assert.rejects(buildMultiProfileProject({
		projectRoot: project, outputRoot: join(directory, "release")
		, nativeTargets: [], wasmTargets: ["php-wasm", "npm"]
		, environment: { ...environment, LEAN_BRIDGE_RUNTIME_ROOT: runtime, LEAN_BRIDGE_PHP_EMSDK: join(directory, "missing-sdk") }
		, buildWasm: async options => { calls++; await saveLakeFile(options.outputRoot, "completed", "unexposed npm result"); } }), { code: "php-wasm-toolchain-unavailable" });
	assert.equal(calls, 1); assert.deepEqual(await lakeInputState(project), before);
	assert.deepEqual((await readdir(directory)).sort(), ["project", "runtime"]);
});

for(const variant of ["shop", "telemetry"]) test(`combined ${variant} packages agree after relocation and run without their source trees`, { skip: !enabled, timeout: 900000 }, async t => {
	const context = await lakeWorkspaceFixture(t, variant);
	const path = await customLakeRoot(context);
	await elaboratedLakeApi(context, path);
	const config = await json(join(context.root, "lean-bridge.exports.json"));
	config.package = packageMetadataFixture(variant);
	const operation = `${context.names.root}.${context.names.operation}`;
	const copy = { ownership: "copy", lifetime: null };
	config.contracts = { [operation]: { parameters: [copy], result: copy, effects: [] } };
	config.targets.npm = { name: `@example/${variant}`, version: "2.0.0" };
	const nativeTargets = variant === "shop" ? ["cpan", "c", "cpp", "nuget", "maven", "rubygems", "wit-wasi", "pypi", "cargo", "php-native"] : ["cpan"];
	await saveLakeFile(context.root, "lean-bridge.exports.json", canonicalJson(config));
	const moved = join(context.directory, "relocated");
	await cp(context.workspace, moved, { recursive: true });
	const builds = [], before = await lakeInputState(context.workspace), movedBefore = await lakeInputState(moved);
	for(const [index, projectRoot] of [context.root, join(moved, "project")].entries())
	{
		let wasmCalls = 0, nativeCalls = 0;
		const runner = { capture: async command => {
			if(command.command === "docker") throw new Error("Docker is absent in the injected transport");
			if(command.args[0] === "--version") return { stdout: "nix (Nix) 2.24.11", stderr: "", code: 0 };
			assert.ok(command.args.includes("--request"));
			const arg = flag => command.args[command.args.indexOf(flag) + 1];
			wasmCalls++;
			const options = { requestPath: arg("--request"), inputRoot: arg("--component"), outputRoot: arg("--output"), engineRoot: arg("--engine"), backend: "native-nix" };
			if(process.env.LEAN_BRIDGE_LAKE_ENGINE)
				await processBuildRunner.capture({ command: resolve(process.env.LEAN_BRIDGE_LAKE_ENGINE), args: ["--request", options.requestPath, "--component", options.inputRoot, "--output", options.outputRoot, "--backend", "native-nix"], timeoutMs: 240000 });
			else await executeComponentEngineRequest(options);
			return { stdout: "", stderr: "", code: 0 };
		} };
		const result = await buildCanonicalProject({
			projectRoot, engineRoot, environment, runner
			, outputRoot: join(context.directory, `release-${index}`)
			, targets: [...(index ? ["cpan", "npm"] : ["npm", "perl"]), ...nativeTargets.slice(1)]
			, onProgress: event => { if(event.message === "Compiling checked native Lean exports") nativeCalls++; } })
			.catch(error => { throw new Error(`${error.message}\n${JSON.stringify(error.details ?? {})}`, { cause: error }); });
		assert.equal(wasmCalls, 1); assert.equal(nativeCalls, 1);
		assert.deepEqual(result.targets, ["npm", ...nativeTargets]);
		builds.push(result);
	}
	assert.deepEqual(await json(join(builds[0].output, "multi-profile-release.json")), await json(join(builds[1].output, "multi-profile-release.json")));
	assert.deepEqual(await json(join(builds[0].output, "package-set-receipt.json")), await json(join(builds[1].output, "package-set-receipt.json")));
	for(const pkg of builds[0].packages) for(const archive of pkg.archives)
		assert.equal(sha256(await readFile(join(builds[1].output, archive.path))), archive.sha256);
	assert.deepEqual(await lakeInputState(context.workspace), before);
	assert.deepEqual(await lakeInputState(moved), movedBefore);
	await rename(context.workspace, join(context.directory, "source-hidden"));
	await rename(moved, join(context.directory, "relocated-hidden"));
	await assertPackagedSourceNotices(t, builds[0].output, [
		`Source notice fixture: ${context.names.root}\n`
		, `Nested source notice fixture: ${context.names.root}\n`
		, `Source notice fixture: ${context.names.local}\n`
		, `Source notice fixture: ${context.names.remote}\n`
	], true);
	await assertPackagedMetadata(builds[0].output, config.package);
	await assertRelocatedPackageSet(t, builds[0].output);
	await assertRelocatedPackageSet(t, join(builds[0].output, "profiles/native"));
	await assertRelocatedPackageSet(t, join(builds[0].output, "packages/npm"));
	const consumer = join(context.directory, "consumer");
	await mkdir(consumer);
	await saveLakeFile(consumer, "package.json", '{"private":true,"type":"module"}');
	const npm = builds[0].packages.find(pkg => pkg.target === "npm"), cpan = builds[0].packages.find(pkg => pkg.target === "cpan");
	const installed = { command: "npm", args: ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--cache", join(context.directory, "npm-cache"), ...npm.archives.map(file => join(builds[0].output, file.path))], cwd: consumer };
	await processBuildRunner.capture(installed);
	await saveLakeFile(consumer, "index.mjs", `import {${context.names.operation}} from "@example/${variant}";\nconsole.log(${context.names.operation}(20));\n`);
	const expected = variant === "shop" ? "46" : "66";
	assert.equal((await processBuildRunner.capture({ command: process.execPath, args: ["index.mjs"], cwd: consumer })).stdout.trim(), expected);
	const prefix = join(consumer, "perl");
	for(const file of cpan.archives)
		await installCpanArchive({ archive: join(builds[0].output, file.path), prefix, perl, mode: "prebuilt-only", workingRoot: consumer, environment });
	await saveLakeFile(consumer, "consumer.pl", `use strict; use warnings; use LeanBridge::${context.names.root} ();\nprint LeanBridge::${context.names.root}::${context.names.operation}(20), "\\n";\n`);
	assert.equal((await processBuildRunner.capture({ command: perl, args: ["consumer.pl"], cwd: consumer, env: { ...environment, PERL5LIB: join(prefix, "lib/perl5") } })).stdout.trim(), expected);
	if(nativeTargets.includes("nuget"))
	{
		const pkg = builds[0].packages.find(pkg => pkg.target === "nuget");
		const root = join(consumer, "dotnet"), source = join(builds[0].output, pkg.path);
		await saveLakeFile(root, "Consumer.csproj", '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework></PropertyGroup><ItemGroup><PackageReference Include="LeanBridge.Shop" Version="1.0.0" /></ItemGroup></Project>\n');
		await saveLakeFile(root, "Program.cs", 'System.Console.WriteLine(LeanBridge.Shop.Api.Quote(20));\n');
		const command = process.env.LEAN_BRIDGE_DOTNET ?? "dotnet";
		const env = { PATH: process.env.PATH, DOTNET_ROOT: process.env.DOTNET_ROOT, DOTNET_CLI_HOME: join(context.directory, "dotnet-cli"), DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1", NUGET_PACKAGES: join(context.directory, "nuget-cache") };
		const call = args => processBuildRunner.capture({ command, args, cwd: root, env });
		await call(["restore", "--source", source, "--nologo"]);
		await call(["build", "--no-restore", "--configuration", "Release", "--disable-build-servers", "/p:UseSharedCompilation=false", "--nologo"]);
		assert.equal((await call(["bin/Release/net8.0/Consumer.dll"])).stdout.trim(), expected);
	}
	if(nativeTargets.includes("maven"))
	{
		const pkg = builds[0].packages.find(pkg => pkg.target === "maven");
		const jar = join(builds[0].output, pkg.archives.find(file => file.path.endsWith(".jar")).path);
		const root = join(consumer, "java");
		await saveLakeFile(root, "Consumer.java", 'class Consumer { public static void main(String[] args) { System.out.println(org.leanbridge.shop.Api.quote(20)); } }\n');
		await processBuildRunner.capture({ command: process.env.LEAN_BRIDGE_JAVAC ?? "javac", args: ["--release", "22", "-cp", jar, "Consumer.java"], cwd: root });
		assert.equal((await processBuildRunner.capture({ command: process.env.LEAN_BRIDGE_JAVA ?? "java", args: ["--enable-native-access=ALL-UNNAMED", "-cp", `.:${jar}`, "Consumer"], cwd: root })).stdout.trim(), expected);
	}
	if(nativeTargets.includes("rubygems"))
	{
		const pkg = builds[0].packages.find(pkg => pkg.target === "rubygems");
		const root = join(consumer, "ruby"), home = join(root, "gems");
		await saveLakeFile(root, "consumer.rb", 'require "lean_bridge/shop"\nputs LeanBridge::Shop.quote(20)\n');
		const env = { PATH: process.env.PATH, GEM_HOME: home, GEM_PATH: home };
		await processBuildRunner.capture({ command: process.env.LEAN_BRIDGE_GEM ?? "gem", args: ["install", join(builds[0].output, pkg.archives[0].path), "--local", "--install-dir", home, "--no-document"], cwd: root, env });
		assert.equal((await processBuildRunner.capture({ command: process.env.LEAN_BRIDGE_RUBY ?? "ruby", args: ["consumer.rb"], cwd: root, env })).stdout.trim(), expected);
	}
	if(nativeTargets.includes("wit-wasi"))
	{
		const pkg = builds[0].packages.find(pkg => pkg.target === "wit-wasi"), install = join(consumer, "wit");
		await mkdir(install);
		await processBuildRunner.capture({ command: "tar", args: ["-xzf", join(builds[0].output, pkg.archives[0].path), "-C", install] });
		const root = join(install, (await readdir(install))[0]);
		await saveLakeFile(install, "consumer.c", '#include "shop_wasmtime.h"\n#include <assert.h>\n#include <stdio.h>\nint main(void) { shop_wasmtime *session; assert(!shop_wasmtime_open(&session)); wasmtime_component_val_t input = {.kind = WASMTIME_COMPONENT_U32, .of.u32 = 20}, output = {0}; assert(!shop_wasmtime_call(session, "quote", &input, 1, &output)); printf("%u\\n", output.of.u32); wasmtime_component_val_delete(&output); shop_wasmtime_close(session); }\n');
		const env = { PATH: "/usr/bin:/bin", PKG_CONFIG_PATH: join(root, "lib/pkgconfig") };
		const flags = (await processBuildRunner.capture({ command: "pkg-config", args: ["--cflags", "--libs", "shop-wit"], env })).stdout.trim().split(/\s+/);
		await processBuildRunner.capture({ command: "cc", args: ["consumer.c", ...flags, "-o", "consumer"], cwd: install, env });
		assert.equal((await processBuildRunner.capture({ command: join(install, "consumer"), args: [], env })).stdout.trim(), expected);
	}
	if(nativeTargets.includes("pypi"))
	{
		const pkg = builds[0].packages.find(pkg => pkg.target === "pypi"), install = join(consumer, "python");
		const env = { PATH: "/usr/bin:/bin" }, interpreter = join(install, "bin/python");
		await processBuildRunner.capture({ command: process.env.LEAN_BRIDGE_PYTHON ?? "python3", args: ["-I", "-m", "venv", install], env });
		await processBuildRunner.capture({ command: interpreter, args: ["-I", "-m", "pip", "--isolated", "install", "--no-index", "--no-deps", "--no-cache-dir", join(builds[0].output, pkg.archives[0].path)], env });
		await saveLakeFile(consumer, "consumer.py", "from lean_shop import quote\nprint(quote(20))\n");
		assert.equal((await processBuildRunner.capture({ command: interpreter, args: ["-I", join(consumer, "consumer.py")], env })).stdout.trim(), expected);
	}
	if(nativeTargets.includes("cargo"))
	{
		const pkg = builds[0].packages.find(pkg => pkg.target === "cargo"), install = join(consumer, "rust");
		await mkdir(join(install, "vendor"), { recursive: true });
		await processBuildRunner.capture({ command: "tar", args: ["-xzf", join(builds[0].output, pkg.archives[0].path), "-C", join(install, "vendor")] });
		await saveLakeFile(install, "Cargo.toml", '[package]\nname = "shop-consumer"\nversion = "0.0.0"\nedition = "2021"\n[dependencies]\nlean_bridge_shop = { path = "vendor/lean_bridge_shop-1.0.0" }\n');
		await saveLakeFile(install, "src/main.rs", 'fn main() { println!("{}", lean_bridge_shop::quote(20).unwrap()); }\n');
		await processBuildRunner.capture({ command: process.env.LEAN_BRIDGE_CARGO ?? "cargo", args: ["build", "--offline"], cwd: install, env: { ...process.env, RUSTC: process.env.LEAN_BRIDGE_RUSTC ?? "rustc" } });
		const moved = join(consumer, "shop-rust");
		await rename(join(install, "target/debug/shop-consumer"), moved);
		await rename(join(install, "vendor"), join(install, "vendor-hidden"));
		assert.equal((await processBuildRunner.capture({ command: moved, args: [], cwd: consumer, env: { PATH: "/usr/bin:/bin" } })).stdout.trim(), expected);
	}
	if(nativeTargets.includes("php-native"))
	{
		const pkg = builds[0].packages.find(pkg => pkg.target === "php-native"), install = join(consumer, "php");
		const metadata = await json(join(builds[0].output, "profiles/native/packages/php-native/composer/composer.json"));
		metadata.dist = { type: "zip", url: `file://${join(builds[0].output, pkg.archives[0].path)}` };
		await saveLakeFile(install, "composer.json", canonicalJson({ name: "test/shop-consumer", repositories: [{ "packagist.org": false }, { type: "package", package: metadata }], require: { [metadata.name]: metadata.version } }));
		const env = { PATH: "/usr/bin:/bin", COMPOSER_HOME: join(install, "composer-config"), COMPOSER_ALLOW_SUPERUSER: "1", COMPOSER_DISABLE_NETWORK: "1" };
		await processBuildRunner.capture({ command: process.env.LEAN_BRIDGE_COMPOSER ?? "composer", args: ["--no-plugins", "--no-scripts", "--no-interaction", "install", "--prefer-dist"], cwd: install, env });
		await saveLakeFile(install, "main.php", "<?php require 'vendor/autoload.php'; echo LeanShop\\quote(20), PHP_EOL;");
		assert.equal((await processBuildRunner.capture({ command: process.env.LEAN_BRIDGE_PHP ?? "php", args: ["-n", "-d", "extension=ffi", "-d", "ffi.enable=1", "main.php"], cwd: install, env })).stdout.trim(), expected);
	}
	for(const target of nativeTargets.filter(target => ["c", "cpp"].includes(target)))
	{
		const pkg = builds[0].packages.find(pkg => pkg.target === target), install = join(consumer, target);
		await mkdir(install);
		await processBuildRunner.capture({ command: "tar", args: ["-xzf", join(builds[0].output, pkg.archives[0].path), "-C", install] });
		const packageRoot = join(install, (await readdir(install))[0]);
		const manifest = await json(join(packageRoot, "lean-bridge-package.json"));
		const p = manifest.component.name.toLowerCase(), ext = target === "cpp" ? "cpp" : "c";
		const source = target === "cpp"
			? `#include "${p}.hpp"\n#include <cassert>\nint main() { assert(lean_bridge::${p}::${context.names.operation}(20) == ${expected}); }\n`
			: `#include "${p}.h"\n#include <assert.h>\nint main(void) { uint32_t result = 0; ${p}_error error = {0}; assert(${p}_${context.names.operation}(20, &result, &error) == ${p.toUpperCase()}_STATUS_OK); assert(result == ${expected}); }\n`;
		await saveLakeFile(install, `main.${ext}`, source);
		const env = { PATH: "/usr/bin:/bin", PKG_CONFIG_PATH: join(packageRoot, "lib/pkgconfig") };
		const flags = (await processBuildRunner.capture({ command: "pkg-config", args: ["--cflags", "--libs", manifest.pkgConfig], env })).stdout.trim().split(/\s+/);
		await processBuildRunner.capture({ command: target === "cpp" ? "c++" : "cc", args: [target === "cpp" ? "-std=c++20" : "-std=c11", join(install, `main.${ext}`), ...flags, "-o", join(install, "consumer")], env });
		await processBuildRunner.capture({ command: join(install, "consumer"), args: [], env });
	}
});
