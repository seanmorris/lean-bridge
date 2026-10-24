/**
 * Installed standalone CLI with bundled PHP-Wasm compiler inputs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCliNpmPackage } from "../../src/release/cli-npm-package.mjs";
import { buildPhpWasmCompilerInputs, readVerifiedPhpWasmCompilerInputs } from "../../src/release/php-wasm-compiler-inputs.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { copiedCleanEnvironment } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Install original CLI bytes, remove packaging inputs, then run public commands.
 *
 * @param options - Task-owned directory and explicit pinned compiler inputs.
 * @param options.directory - Test-owned installation directory.
 * @param options.runtimeRoot - Verified shared PHP-Wasm runtime.
 * @param options.phpSource - Pinned, configured PHP headers.
 * @param options.leanPrefix - Pinned host Lean compiler installation.
 * @param options.emsdkRoot - Pinned PHP-Wasm Emscripten SDK.
 */
export const installOwnedPhpWasmCli = async ({ directory, runtimeRoot, phpSource, leanPrefix, emsdkRoot }) => {
	const source = join(directory, "producer"), installed = join(directory, "installed");
	const inputs = await buildPhpWasmCompilerInputs({ runtimeRoot, phpSource, outputRoot: join(source, "inputs") });
	const archive = await buildCliNpmPackage({ outputRoot: join(source, "archive"), phpWasmInputsRoot: inputs.directory });
	await saveLakeFile(installed, "package.json", canonicalJson({ private: true }));
	const run = (args, cwd, env) => processBuildRunner.capture({ command: process.execPath, args, cwd, env, timeoutMs: 1200000 })
		.catch(error => { error.message += ": " + JSON.stringify(error.details); throw error; });
	await processBuildRunner.capture({ command: "npm", args: ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", archive.archive], cwd: installed });
	const packageRoot = join(installed, "node_modules", archive.report.package.name), cli = join(packageRoot, "scripts/lean-bridge.mjs");
	for(const item of archive.report.files)
	{
		const bytes = await readFile(join(packageRoot, item.path));
		assert.equal(bytes.length, item.bytes); assert.equal(sha256(bytes), item.sha256);
	}
	assert.equal((await readVerifiedPhpWasmCompilerInputs(join(packageRoot, "runtime/php-wasm"))).identity, inputs.identity);
	await rm(source, { recursive: true });
	const environment = { ...process.env, LEAN_BRIDGE_LEAN_PREFIX: leanPrefix, LEAN_BRIDGE_PHP_EMSDK: emsdkRoot, LEAN_BRIDGE_RUNTIME_ROOT: "/unused-js-runtime" };
	for(const name of ["LEAN_BRIDGE_PHP_SOURCE", "LEAN_BRIDGE_PHP_COPIED_RUNTIME", "LEAN_BRIDGE_PHP_LEAN_RUNTIME", "LEAN_BRIDGE_PHP_INPUTS"]) delete environment[name];
	const identity = { archive: archive.report.archive
		, inventorySha256: archive.report.inventorySha256
		, compilerInputsIdentity: inputs.identity
		, compilerInputsArchiveSha256: inputs.archiveSha256
		, installedFilesVerified: archive.report.files.length
		, packagingSourceRemoved: true };
	const build = async (projectRoot, outputRoot, targets = ["php-wasm"]) => {
		const args = [cli, "build", "--project", projectRoot, "--output", outputRoot
			, ...targets.flatMap(target => ["--target", target])
			, "--json", "--progress", "none"];
		const result = await run(args, directory, environment);
		const response = JSON.parse(result.stdout); assert.equal(response.status, "ok");
		assert.deepEqual([...response.result.targets].sort(), [...targets].sort());
		return response;
	};
	const verify = async receipt => {
		const result = await run([cli, "verify", "--receipt", receipt, "--json"], directory, copiedCleanEnvironment);
		const response = JSON.parse(result.stdout); assert.equal(response.status, "ok");
		assert.equal(response.result.verificationType, "local-package-set"); return response;
	};
	return { identity, build, verify };
};
