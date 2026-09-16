/**
 * Compile the same locked API for JavaScript, native PHP and wasm32 PHP.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, readFile, rename } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject, processBuildRunner } from "../src/build/canonical-build.mjs";
import { executeComponentEngineRequest } from "../src/build/component-engine.mjs";
import { buildPhpWasmCopiedRuntime } from "../src/build/php-wasm-copied-component.mjs";
import { phpWasmCopiedPins as pins } from "../src/build/php-wasm-copied-artifacts.mjs";
import { customLakeRoot, elaboratedLakeApi, lakeInputState, lakeWorkspaceFixture, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { assertRelocatedPackageSet } from "./helpers/package-set.mjs";
import { assertPackagedMetadata, packageMetadataFixture } from "./helpers/package-metadata.mjs";
import { buildPhpWasmCompilerInputs } from "../src/release/php-wasm-compiler-inputs.mjs";

const enabled = process.env.LEAN_BRIDGE_PHP_MULTI_PROFILE_TEST === "1";
const json = async path => JSON.parse(await readFile(path, "utf8"));
const run = (command, args, cwd, env = process.env) => processBuildRunner.capture({ command, args, cwd, env });

test("PHP-Wasm combines atomically with either or both native PHP and JavaScript", { skip: !enabled, timeout: 900000 }, async t => {
	const context = await lakeWorkspaceFixture(t, "telemetry"), engineRoot = process.cwd();
	await elaboratedLakeApi(context, await customLakeRoot(context));
	const config = await json(join(context.root, "lean-bridge.exports.json"));
	config.package = packageMetadataFixture("telemetry");
	config.targets.npm = { name: "@example/telemetry", version: "2.0.0" };
	config.targets["php-native"] = { name: "example/telemetry-native", version: "2.0.0" };
	config.targets["php-wasm"] = { npm: { name: "@example/telemetry-php-wasm", version: "2.0.0" }, composer: { name: "example/telemetry-wasm", version: "2.0.0" } };
	await saveLakeFile(context.root, "lean-bridge.exports.json", canonicalJson(config));
	const relocated = join(context.directory, "relocated");
	await cp(context.workspace, relocated, { recursive: true });
	const before = await lakeInputState(context.workspace), movedBefore = await lakeInputState(relocated);
	const emsdkRoot = process.env.LEAN_BRIDGE_PHP_EMSDK ?? join(engineRoot, ".toolchains/emsdk-php-wasm");
	const runtime = await buildPhpWasmCopiedRuntime({
		outputRoot: join(context.directory, "php-runtime"), emsdkRoot
		, leanRuntimeRoot: process.env.LEAN_BRIDGE_PHP_LEAN_RUNTIME ?? join(engineRoot, `build/lean-runtime/${pins.leanCommit}-${pins.patchSetSha256}-browser-php-wasm-3.1.68`) });
	const compilerInputs = await buildPhpWasmCompilerInputs({ runtimeRoot: runtime.root, phpSource: process.env.LEAN_BRIDGE_PHP_SOURCE ?? join(engineRoot, "build/php-wasm-sdk/php8.4-src"), outputRoot: join(context.directory, "php-compiler-inputs") });
	const environment = { ...process.env, LEAN_BRIDGE_BUILD_BACKEND: "nix"
		, LEAN_BRIDGE_RUNTIME_ROOT: resolve(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT ?? "build/lean-link-spike/lazy")
		, LEAN_BRIDGE_PHP_INPUTS: compilerInputs.directory };
	for(const name of ["LEAN_BRIDGE_PHP_SOURCE", "LEAN_BRIDGE_PHP_COPIED_RUNTIME", "LEAN_BRIDGE_PHP_LEAN_RUNTIME"]) delete environment[name];
	const selections = [["npm", "php-native", "php-wasm"], ["php-wasm", "php-native", "npm"], ["php-native", "php-wasm"], ["php-wasm", "npm"]];
	const builds = [];
	for(const [index, targets] of selections.entries())
	{
		let wasmCalls = 0, nativeCalls = 0, phpCalls = 0;
		const runner = { capture: async command => {
			if(command.command === "docker") throw new Error("Docker is absent in the injected transport");
			if(command.args[0] === "--version") return { stdout: "nix (Nix) 2.24.11", stderr: "", code: 0 };
			assert.ok(command.args.includes("--request")); wasmCalls++;
			const arg = flag => command.args[command.args.indexOf(flag) + 1];
			const options = { requestPath: arg("--request"), inputRoot: arg("--component"), outputRoot: arg("--output"), engineRoot: arg("--engine"), backend: "native-nix" };
			if(process.env.LEAN_BRIDGE_LAKE_ENGINE)
				await run(resolve(process.env.LEAN_BRIDGE_LAKE_ENGINE), ["--request", options.requestPath, "--component", options.inputRoot, "--output", options.outputRoot, "--backend", "native-nix"]);
			else await executeComponentEngineRequest(options);
			return { stdout: "", stderr: "", code: 0 };
		} };
		const built = await buildCanonicalProject({
			projectRoot: index ? join(relocated, "project") : context.root
			, outputRoot: join(context.directory, `release-${index}`)
			, engineRoot, runner, targets
			, environment: { ...environment, ...(!targets.includes("npm") ? { LEAN_BRIDGE_RUNTIME_ROOT: "/unused-js-runtime" } : {}) }
			, onProgress: event => {
				if(event.message === "Compiling checked native Lean exports") nativeCalls++;
				if(event.message === "Compiling checked PHP-Wasm Lean exports") phpCalls++;
			}
		});
		assert.equal(wasmCalls, Number(targets.includes("npm"))); assert.equal(nativeCalls, Number(targets.includes("php-native"))); assert.equal(phpCalls, 1);
		assert.equal(built.schemaVersion, 2); assert.deepEqual([...built.targets].sort(), [...targets].sort());
		assert.equal(built.profiles.length, targets.length); assert.equal(built.packages.length, targets.length);
		assert.equal((await json(join(built.output, "profiles/php-wasm/php-wasm/component/model.json"))).pointerBits, 32);
		if(targets.includes("php-native")) assert.equal((await json(join(built.output, "profiles/native/native/component/model.json"))).pointerBits, 64);
		for(const pkg of built.packages) for(const archive of pkg.archives)
			assert.equal(sha256(await readFile(join(built.output, archive.path))), archive.sha256);
		if(builds.length) assert.equal(built.sourceApiSha256, builds[0].sourceApiSha256);
		builds.push(built); t.diagnostic(`${targets.join(" + ")}: one compilation per ABI, API ${built.sourceApiSha256}`);
	}
	assert.deepEqual(await json(join(builds[0].output, "multi-profile-release.json")), await json(join(builds[1].output, "multi-profile-release.json")));
	assert.deepEqual(await json(join(builds[0].output, "package-set-receipt.json")), await json(join(builds[1].output, "package-set-receipt.json")));
	assert.deepEqual(await lakeInputState(context.workspace), before); assert.deepEqual(await lakeInputState(relocated), movedBefore);
	await rename(context.workspace, `${context.workspace}-hidden`); await rename(relocated, `${relocated}-hidden`);
	await assertPackagedMetadata(builds[0].output, config.package);
	for(const [index, built] of builds.entries())
	{
		await assertRelocatedPackageSet(t, built.output);
		await assertRelocatedPackageSet(t, join(built.output, "profiles/php-wasm"));
		const consumer = join(context.directory, `consumer-${index}`), moved = `${consumer}-moved`;
		await mkdir(consumer); await saveLakeFile(consumer, "package.json", '{"private":true,"type":"module"}');
		const npm = built.packages.find(pkg => pkg.target === "npm"), php = built.packages.find(pkg => pkg.target === "php-wasm");
		const native = built.packages.find(pkg => pkg.target === "php-native");
		const npmArchives = [...(npm?.archives ?? []), ...php.archives.filter(item => item.path.endsWith(".tgz"))];
		await run("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--legacy-peer-deps", ...npmArchives.map(item => join(built.output, item.path))], consumer);
		if(native)
		{
			const metadata = await json(join(built.output, "profiles/native/packages/php-native/composer/composer.json"));
			metadata.dist = { type: "zip", url: pathToFileURL(join(built.output, native.archives[0].path)).href };
			await saveLakeFile(consumer, "composer.json", canonicalJson({ name: "test/telemetry", repositories: [{ "packagist.org": false }, { type: "package", package: metadata }], require: { [metadata.name]: metadata.version } }));
			await run(process.env.LEAN_BRIDGE_COMPOSER ?? "composer", ["--no-plugins", "--no-scripts", "--no-interaction", "install", "--prefer-dist"], consumer, { ...process.env, COMPOSER_ALLOW_SUPERUSER: "1", COMPOSER_DISABLE_NETWORK: "1", COMPOSER_HOME: join(context.directory, "composer-home") });
			await saveLakeFile(consumer, "main.php", "<?php require 'vendor/autoload.php'; echo LeanTelemetry\\measure(20);");
		}
		const phpHost = process.env.LEAN_BRIDGE_PHP_WASM_HOST ?? join(engineRoot, "build/php-wasm-host/node_modules/php-wasm");
		await saveLakeFile(consumer, "main.mjs", `import assert from 'node:assert/strict';
import { PhpNode } from ${JSON.stringify(pathToFileURL(join(phpHost, "PhpNode.mjs")).href)};
import api from '@example/telemetry-php-wasm';
${npm ? "import { measure } from '@example/telemetry'; assert.equal(measure(20), 66);" : ""}
const php = new PhpNode({version: '8.4', sharedLibs: [api]});
let output = '', errors = '';
php.addEventListener('output', event => { for (const part of event.detail) output += part; });
php.addEventListener('error', event => { for (const part of event.detail) errors += part; });
assert.equal(await php.run("<?php require '" + api.autoload + "'; echo LeanTelemetry\\\\measure(LeanTelemetry\\\\BigInteger::fromDecimal('20'));"), 0);
assert.equal(errors, ''); assert.equal(output, '66'); console.log('66');
`);
		await rename(consumer, moved); await rename(built.output, `${built.output}-hidden`);
		assert.equal((await run(process.execPath, ["main.mjs"], moved, { ...process.env, PATH: "/unavailable", LEAN_PATH: "/unavailable", LEAN_SYSROOT: "/unavailable" })).stdout.trim(), "66");
		if(native) assert.equal((await run(process.env.LEAN_BRIDGE_PHP ?? "php", ["-n", "-d", "extension=ffi", "-d", "ffi.enable=1", "main.php"], moved, { PATH: "/usr/bin:/bin" })).stdout.trim(), "66");
	}
});
