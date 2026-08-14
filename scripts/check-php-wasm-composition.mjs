#!/usr/bin/env node
/**
 * Checks the PHP Wasm composition workflow.
 *
 * @file
 */


import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execute = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const options = new Map();
for(let index = 2; index < process.argv.length; index += 2)
{
	const name = process.argv[index];
	const value = process.argv[index + 1];
	if(!name?.startsWith("--") || !value) throw new Error(`invalid option ${name ?? ""}`);
	options.set(name, value);
}
const pathOption = (name, fallback) => resolve(projectRoot, options.get(name) ?? fallback);
const reportDirectory = pathOption("--output", "build/php-wasm-composition");
const phpSource = pathOption("--php-source", "build/php-wasm-sdk/php8.4-src");
const emsdk = pathOption("--emsdk", ".toolchains/emsdk-php-wasm");
const phpWasmRoot = pathOption("--php-wasm", "build/php-wasm-host/node_modules/php-wasm");
const suppliedLazy = options.has("--lazy-package") ? pathOption("--lazy-package") : null;
const suppliedStartup = options.has("--startup-package") ? pathOption("--startup-package") : null;
if(Boolean(suppliedLazy) !== Boolean(suppliedStartup))
{
	throw new Error("--lazy-package and --startup-package must be supplied together");
}

const run = async (command, args, runOptions = {}) => execute(command, args, {
	cwd: projectRoot
	, maxBuffer: 64 * 1024 * 1024,
	...runOptions
});
const sha256 = value => createHash("sha256").update(value).digest("hex");

const buildProfile = async ({ profile, scratch }) => {
	const manifest = JSON.parse(await readFile(
		join(projectRoot, "poc/lean-link-spike/bindings/php-wasm.package.json"),
		"utf8",
	));
	manifest.graphLock.profile = profile;
	const manifestPath = join(scratch, `${profile}.package.json`);
	const packageRoot = join(scratch, profile);
	await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
	await run(process.execPath, [
		"scripts/build-php-wasm-package.mjs"
		, "--manifest", manifestPath
		, "--output", packageRoot
		, "--php-source", phpSource
		, "--emsdk", emsdk
	]);
	return packageRoot;
};

const readLeb = (bytes, cursor) => {
	let value = 0;
	let shift = 0;
	while(true)
	{
		const byte = bytes[cursor.offset++];
		value += (byte & 0x7f) * 2 ** shift;
		if(!(byte & 0x80)) return value;
		shift += 7;
	}
};

const dylinkDependencies = module => {
	const sections = WebAssembly.Module.customSections(module, "dylink.0");
	assert.equal(sections.length, 1, "side module must contain one dylink.0 section");
	const bytes = new Uint8Array(sections[0]);
	const cursor = { offset: 0 };
	const decoder = new TextDecoder();
	while(cursor.offset < bytes.length)
	{
		const type = bytes[cursor.offset++];
		const size = readLeb(bytes, cursor);
		const end = cursor.offset + size;
		if(type === 2)
		{
			const count = readLeb(bytes, cursor);
			const dependencies = [];
			for(let index = 0; index < count; index++)
			{
				const length = readLeb(bytes, cursor);
				dependencies.push(decoder.decode(bytes.subarray(cursor.offset, cursor.offset + length)));
				cursor.offset += length;
			}
			return dependencies;
		}
		cursor.offset = end;
	}
	return [];
};

const auditSharedArtifact = async path => {
	const bytes = await readFile(path);
	const module = await WebAssembly.compile(bytes);
	assert.deepEqual(
		WebAssembly.Module.imports(module)
      .filter(entry => entry.kind === "memory" || entry.kind === "table")
      .map(entry => [entry.module, entry.name, entry.kind]),
		[
			["env", "memory", "memory"]
			, ["env", "__indirect_function_table", "table"]
		],
	);
	assert.deepEqual(
		WebAssembly.Module.exports(module).filter(entry => entry.kind === "memory" || entry.kind === "table"),
		[],
	);
	return { bytes: bytes.byteLength, sha256: sha256(bytes), module };
};

const runProfile = async ({ packageRoot, expectedProfile }) => {
	const [{ PhpNode }, { default: descriptor }] = await Promise.all([
		import(pathToFileURL(join(phpWasmRoot, "PhpNode.mjs")))
		, import(`${pathToFileURL(join(packageRoot, "index.mjs")).href}?profile=${expectedProfile}-${Date.now()}`)
	]);
	const manifest = JSON.parse(await readFile(join(packageRoot, "php-wasm-manifest.json"), "utf8"));
	assert.equal(manifest.graph.profile, expectedProfile);
	const libraries = manifest.versions["8.4"].libraries;
	assert.equal(libraries.filter(library => library.role === "lean-runtime").length, 1);
	assert.deepEqual(libraries.filter(library => library.role === "lean-component").map(library => library.component), [
		"poc/lean-alpha@0.0.0"
		, "poc/lean-beta@0.0.0"
		, "poc/lean-gamma@0.0.0"
	]);

	const artifactAudits = {};
	for(const library of libraries)
	{
		const audit = await auditSharedArtifact(join(packageRoot, library.file));
		artifactAudits[library.file] = { bytes: audit.bytes, sha256: audit.sha256 };
	}
	const extensionPath = join(packageRoot, libraries.find(library => library.role === "php-extension").file);
	const extensionModule = await WebAssembly.compile(await readFile(extensionPath));
	const needed = dylinkDependencies(extensionModule);
	const expectedNeeded = expectedProfile === "side-startup"
		? ["liblean_bridge_runtime.so", "alpha.so.wasm", "beta.so.wasm", "gamma.so.wasm"]
		: ["liblean_bridge_runtime.so", "alpha.so.wasm"];
	assert.deepEqual(needed, expectedNeeded);

	const php = new PhpNode({ version: "8.4", sharedLibs: [descriptor] });
	let stdout = "";
	let stderr = "";
	php.addEventListener("output", event => {
    for(const line of event.detail) stdout += line;
	});
	php.addEventListener("error", event => {
    for(const line of event.detail) stderr += line;
	});
	const module = await php.binary;
	const host = module.__leanBridgeInstallPhpWasmHostV1(module);
	assert.deepEqual(host.snapshot().components, []);
	const status = await php.run(`<?php
require_once '/vendor/autoload.php';
$box = new LeanAlpha\\Box(41);
$alphaRead = $box->read();
$transport = new LeanAlpha\\Internal\\NativeTransport();
$beforeBeta = $transport->runtimeSnapshot();
$betaRead = LeanBeta\\read($box);
$same = LeanBeta\\identity($box);
$afterBeta = $transport->runtimeSnapshot();
$box->close();
$afterClose = $transport->runtimeSnapshot();
echo json_encode([
    'alphaRead' => $alphaRead,
    'betaRead' => $betaRead,
    'canonicalIdentity' => $same === $box,
    'beforeBeta' => $beforeBeta,
    'afterBeta' => $afterBeta,
    'afterClose' => $afterClose,
], JSON_THROW_ON_ERROR);
`);
	if(status !== 0 || stderr !== "")
	{
		throw new Error(`${expectedProfile} PHP-Wasm run failed with status ${status}: ${stderr || stdout}`);
	}
	const result = JSON.parse(stdout);
	assert.equal(result.alphaRead, 41);
	assert.equal(result.betaRead, 41);
	assert.equal(result.canonicalIdentity, true);
	const liveBoxRegistrations = 2;
	assert.deepEqual(
		[result.beforeBeta.runtimeInitRuns, result.beforeBeta.componentInitRuns, result.beforeBeta.attachedComponents, result.beforeBeta.liveIdentities],
		[1, 1, 1, liveBoxRegistrations],
	);
	assert.deepEqual(
		[result.afterBeta.runtimeInitRuns, result.afterBeta.componentInitRuns, result.afterBeta.attachedComponents, result.afterBeta.liveIdentities],
		[1, 2, 2, liveBoxRegistrations],
	);
	assert.equal(result.afterBeta.runtimeInstanceId, result.beforeBeta.runtimeInstanceId);
	assert.equal(result.afterBeta.identityDomainId, result.beforeBeta.identityDomainId);
	assert.equal(result.afterClose.liveIdentities, 0);

	const hostSnapshot = host.snapshot();
	assert.deepEqual(hostSnapshot.components, ["poc/lean-alpha@0.0.0", "poc/lean-beta@0.0.0"]);
	assert.equal(hostSnapshot.runtimeInitRuns, 1);
	assert.equal(host.memory, module.HEAPU8.buffer);
	const conflict = structuredClone(manifest);
	conflict.runtime.patchSetSha256 = "0".repeat(64);
	assert.throws(
		() => host.attachManifest(conflict),
		error => error.code === "shared-runtime-conflict",
	);

	return {
		profile: expectedProfile
		, extensionNeeded: needed
		, runtime: {
			runtimeInitRuns: result.afterClose.runtimeInitRuns
			, componentInitRuns: result.afterClose.componentInitRuns
			, attachedComponents: result.afterClose.attachedComponents
			, liveIdentities: result.afterClose.liveIdentities
			, runtimeInstanceId: result.afterClose.runtimeInstanceId
			, identityDomainId: result.afterClose.identityDomainId
		}
		, host: hostSnapshot
		, memoryBytes: module.HEAPU8.buffer.byteLength
		, tableEntries: host.table?.length ?? null
		, oneTableByImports: true
		, canonicalIdentity: result.canonicalIdentity
		, privateRuntimeRejected: true
		, artifacts: artifactAudits
	};
};

await mkdir(join(projectRoot, "build"), { recursive: true });
const scratch = suppliedLazy ? null : await mkdtemp(join(projectRoot, "build/php-wasm-composition-run-"));
try
{
	const lazyPackage = suppliedLazy ?? await buildProfile({ profile: "side-lazy", scratch });
	const startupPackage = suppliedStartup ?? await buildProfile({ profile: "side-startup", scratch });
	const profiles = [];
	profiles.push(await runProfile({ packageRoot: lazyPackage, expectedProfile: "side-lazy" }));
	profiles.push(await runProfile({ packageRoot: startupPackage, expectedProfile: "side-startup" }));
	const report = {
		schemaVersion: 1
		, result: "pass"
		, graph: "poc/lean-link-spike@1"
		, components: ["poc/lean-alpha@0.0.0", "poc/lean-beta@0.0.0"]
		, profiles
	};
	await mkdir(reportDirectory, { recursive: true });
	await writeFile(join(reportDirectory, "composition.json"), `${JSON.stringify(report, null, 2)}\n`);
	await writeFile(join(reportDirectory, "composition.md"), `# PHP-Wasm Shared Runtime Composition\n\nResult: **pass**\n\nAlpha created one retained Box. Beta read the same Lean heap object and returned the canonical PHP wrapper. Both profiles used one runtime initialization, one memory, one table, one Lean heap, and one identity domain.\n\nThe lazy extension links the runtime and Alpha. It loads Beta on the first Beta call. The startup extension links the complete component closure. Both resolve from the same locked graph.\n\nA manifest that requested another runtime patch identity was rejected before attachment. Every side module imports the host memory and table and exports neither.\n\nReproduce this report with:\n\n\`\`\`sh\nnpm run test:php-wasm-composition\n\`\`\`\n`);
	process.stdout.write(`PHP-Wasm composition passed for ${profiles.map(profile => profile.profile).join(" and ")}.\n`);
} finally
{
	if(scratch) await rm(scratch, { recursive: true, force: true });
}
