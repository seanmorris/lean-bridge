/**
 * Offline Composer installs and isolated, relocated weak/strict PHP consumers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, realpath, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { nativeArtifactPaths, verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { corpusPhpRequestJson, corpusPhpSource, phpRuntimeCases } from "./type-corpus-php-source.mjs";

const run = (command, args, cwd, env) => processBuildRunner.capture({ command, args, cwd, env, timeoutMs: 180_000 });
const json = async path => JSON.parse(await readFile(path, "utf8"));
const digest = async path => sha256(await readFile(path));
const inventory = async root => Object.fromEntries(await Promise.all((await nativeArtifactPaths(root)).map(async path => {
	const bytes = await readFile(join(root, path));
	return [path, { bytes: bytes.length, sha256: sha256(bytes) }];
})));

// Composer may be a PHAR or a distribution's PHP entry point. Identify the
// actual PHP implementation loaded by that selected tool, not only its launcher.
export const composerProbe = "<?php\nregister_shutdown_function(function() {\n"
	+ "  $files = []; foreach (get_included_files() as $file) if ($file !== __FILE__) $files[$file] = ['bytes' => filesize($file), 'sha256' => hash_file('sha256', $file)];\n"
	+ "  ksort($files); file_put_contents(getenv('CORPUS_COMPOSER_PROBE'), json_encode($files, JSON_THROW_ON_ERROR));\n"
	+ "});\n";

export const phpIsolationFlags = Object.freeze([
	"emptyComposerHome", "emptyCache", "offline", "lockedInstall"
	, "exactPublicSignatures", "publicApiOnly", "relocated"
	, "compilerFreeExecution", "runtimeOverridesDisabled", "iniDisabled"
	, "repeatExecution", "unchangedDeployment", "localLibraries"
]);

/**
 * Install the exact prepared ZIP with Composer, then remove the install project.
 *
 * @param options - Package handoff, catalog library and explicit tool paths.
 * @param options.library - Independent corpus library.
 * @param options.consumer - Task-owned consumer directory.
 * @param options.handoff - Verified archive handoff.
 * @param options.pkg - Package-set component entry.
 * @param options.environment - Explicit author tools.
 * @param options.clean - Compiler-free runtime environment.
 * @param options.sourcePath - Independently specified argument-name contract.
 */
export const installedPhpCorpus = async ({ library, consumer, handoff, pkg, environment, clean, sourcePath = "ordinary-source" }) => {
	const root = join(consumer, "php-native"), project = join(root, "project");
	const feed = join(project, "feed"), home = join(project, "composer-home"), cache = join(project, "cache");
	for(const directory of [feed, home, cache]) await mkdir(directory, { recursive: true });
	assert.deepEqual(await readdir(home), []); assert.deepEqual(await readdir(cache), []);
	const php = await realpath(environment.LEAN_BRIDGE_PHP), composer = await realpath(environment.LEAN_BRIDGE_COMPOSER);
	const probe = JSON.parse((await run(php, ["-n", "-r", "echo json_encode([PHP_VERSION, PHP_INT_SIZE, PHP_ZTS, PHP_SAPI, ini_get('extension_dir'), get_loaded_extensions()]);"], project, clean)).stdout);
	const [version, width, zts, sapi, extensionDirectory, builtins] = probe;
	assert.match(version, /^8\.(?:[2-9]|[1-9]\d+)\.\d+$/); assert.equal(width, 8); assert.ok(zts === 0 || zts === false); assert.equal(sapi, "cli");
	const modules = ["ffi", "ctype", "iconv", "mbstring", "phar", "zip"];
	const extensions = Object.fromEntries(await Promise.all(modules.filter(name => !builtins.map(name => name.toLowerCase()).includes(name)).map(async name => {
		const path = await realpath(join(extensionDirectory, name + ".so"));
		return [name, { path, sha256: await digest(path) }];
	})));
	const extensionFlags = names => names.filter(name => extensions[name]).flatMap(name => ["-d", "extension=" + extensions[name].path]);
	const runtimeOptions = ["-n", ...extensionFlags(["ffi"]), "-d", "ffi.enable=1", "-d", "memory_limit=512M"];
	const composerOptions = ["-n", ...extensionFlags(modules), "-d", "ffi.enable=1", "-d", "memory_limit=512M", "-d", "auto_prepend_file=" + join(project, "tool-probe.php")];
	await saveLakeFile(project, "tool-probe.php", composerProbe);
	const installEnvironment = { ...clean, COMPOSER_HOME: home
		, COMPOSER_CACHE_DIR: cache, COMPOSER_ALLOW_SUPERUSER: "1"
		, COMPOSER_DISABLE_NETWORK: "1", COMPOSER_NO_INTERACTION: "1"
		, COMPOSER: join(project, "composer.json")
		, CORPUS_COMPOSER_PROBE: join(project, "tool-files.json") };
	const toolFiles = {}, generatedFiles = {};
	const composerRun = async args => {
		const result = await run(php, [...composerOptions, composer, "--no-plugins", "--no-scripts", "--no-interaction", ...args], project, installEnvironment);
		for(const [path, identity] of Object.entries(await json(join(project, "tool-files.json"))))
		{
			if(path.startsWith(project + "/"))
			{
				const relative = path.slice(project.length + 1);
				assert.match(relative, /^vendor\/composer\/(?:autoload_(?:classmap|namespaces|psr4|files)|installed)\.php$/);
				if(generatedFiles[relative]) assert.deepEqual(generatedFiles[relative], identity);
				generatedFiles[relative] = identity;
				continue;
			}
			if(toolFiles[path]) assert.deepEqual(toolFiles[path], identity);
			toolFiles[path] = identity;
		}
		return result;
	};
	const composerVersion = (await composerRun(["--version"])).stdout.trim();
	assert.match(composerVersion, /^Composer version 2\.\d+\.\d+/);
	const archive = pkg.artifacts[0], archiveBytes = await readFile(join(handoff, archive.path));
	assert.equal(sha256(archiveBytes), archive.sha256);
	const localArchive = join(feed, "package.zip");
	await cp(join(handoff, archive.path), localArchive);
	const inspection = join(project, "inspection");
	await run("/usr/bin/unzip", ["-q", localArchive, "-d", inspection], project, clean);
	const receipt = await json(join(inspection, "lean-bridge/package-receipt.json"));
	assert.equal(receipt.schemaVersion, 1); assert.equal(receipt.kind, "lean-bridge-ordinary-php-package");
	assert.equal(receipt.ecosystem, "composer"); assert.equal(receipt.namespace, library.phpModule);
	assert.equal(receipt.name, pkg.name); assert.equal(receipt.version, pkg.version);
	assert.equal(receipt.runtimeIdentity, pkg.runtimeIdentity);
	await verifyNativeFiles(inspection, receipt.files);
	const original = await json(join(inspection, "composer.json"));
	assert.deepEqual(original.require, { php: ">=8.2 <9", "ext-ffi": "*" });
	assert.deepEqual(original.autoload, { files: ["src/Api.php"] });
	const distribution = { type: "zip", url: pathToFileURL(localArchive).href, shasum: createHash("sha1").update(archiveBytes).digest("hex") };
	const manifest = { name: "lean-bridge-corpus/consumer"
		, require: { [pkg.name]: pkg.version }
		, repositories: [{ "packagist.org": false }, { type: "package", package: { ...original, dist: distribution } }]
		, config: { "allow-plugins": false } };
	await saveLakeFile(project, "composer.json", canonicalJson(manifest));
	const install = ["install", "--prefer-dist", "--no-progress", "--no-dev"];
	await composerRun(install);
	const lock = await json(join(project, "composer.lock")), installed = await json(join(project, "vendor/composer/installed.json"));
	assert.deepEqual(lock["packages-dev"], []); assert.equal(lock.packages.length, 1); assert.equal(installed.packages.length, 1);
	for(const selected of [lock.packages[0], installed.packages[0]])
	{
		assert.equal(selected.name, pkg.name); assert.equal(selected.version, pkg.version);
		assert.deepEqual(selected.dist, distribution);
	}
	const packageRoot = join(project, "vendor", pkg.name);
	await verifyNativeFiles(packageRoot, receipt.files);
	assert.deepEqual(await inventory(packageRoot), await inventory(inspection));
	const before = await inventory(join(project, "vendor")), lockSha256 = await digest(join(project, "composer.lock"));
	await composerRun(install);
	assert.equal(await digest(join(project, "composer.lock")), lockSha256);
	assert.deepEqual(await inventory(join(project, "vendor")), before);
	const evidence = { version, composerVersion
		, hostSha256: await digest(php), composerSha256: await digest(composer)
		, composerFiles: toolFiles, extensions, runtimeOptions, composerOptions
		, composerGeneratedFiles: generatedFiles
		, composerProbeSha256: sha256(composerProbe), manifest, lock, installed
		, manifestSha256: sha256(canonicalJson(manifest)), lockSha256
		, installedSha256: await digest(join(project, "vendor/composer/installed.json"))
		, packageReceipt: receipt
		, packageReceiptSha256: await digest(join(packageRoot, "lean-bridge/package-receipt.json"))
		, bindingIrSha256: receipt.bindingIrSha256, archiveSha256: archive.sha256
		, declarationsSha256: await digest(join(packageRoot, "src/Api.php"))
		, requestSha256: sha256(corpusPhpRequestJson(library))
		, consumerSources: Object.fromEntries(["weak", "strict"].map(mode => [mode, sha256(corpusPhpSource(mode, "php-native", sourcePath))]))
		, ...Object.fromEntries(phpIsolationFlags.map(key => [key, true])) };
	const deployment = join(root, "relocated");
	await mkdir(deployment);
	await rename(join(project, "vendor"), join(deployment, "vendor"));
	await saveLakeFile(deployment, "request.json", corpusPhpRequestJson(library));
	for(const mode of ["weak", "strict"]) await saveLakeFile(deployment, mode + ".php", corpusPhpSource(mode, "php-native", sourcePath));
	await rm(project, { recursive: true, force: true });
	assert.deepEqual(await readdir(root), ["relocated"]);
	evidence.deployment = await inventory(deployment);
	for(const [path, identity] of Object.entries(generatedFiles)) assert.deepEqual(evidence.deployment[path], identity);
	evidence.executions = [];
	for(const mode of ["weak", "strict"])
	{
		const observe = async () => {
			const result = await run(php, [...runtimeOptions, mode + ".php"], deployment, clean);
			assert.equal(result.stderr, "");
			assert.deepEqual(await inventory(deployment), evidence.deployment);
			return JSON.parse(result.stdout);
		};
		const observation = await observe();
		assert.deepEqual(await observe(), observation);
		evidence.executions.push({ mode, observation });
	}
	return { php: evidence, observation: evidence.executions[0].observation };
};

const fileMap = files => {
	assert.ok(Object.keys(files).length > 0);
	for(const [path, identity] of Object.entries(files))
	{
		assert.match(path, /^[A-Za-z0-9_.+/-]+$/);
		assert.ok(!path.startsWith("/") && path.split("/").every(part => part && part !== "." && part !== ".."));
		assert.ok(Number.isSafeInteger(identity.bytes) && identity.bytes > 0);
		assert.match(identity.sha256, /^[a-f0-9]{64}$/);
	}
};

/**
 * Validate both lexical callers and their receipt-bound installed libraries.
 *
 * @param run - Installed corpus run.
 * @param library - Independent source library definition.
 * @param validate - Shared observation/oracle validator.
 */
export const validatePhpEvidence = (run, library, validate) => {
	const evidence = run.php, prefix = "vendor/" + run.archive.name + "/";
	for(const key of phpIsolationFlags) assert.equal(evidence[key], true, key);
	assert.equal(evidence.version, run.observation.hostVersion);
	assert.match(evidence.composerVersion, /^Composer version 2\.\d+\.\d+/);
	for(const key of ["hostSha256", "composerSha256", "lockSha256", "installedSha256", "declarationsSha256"]) assert.match(evidence[key], /^[a-f0-9]{64}$/);
	assert.equal(evidence.composerProbeSha256, sha256(composerProbe));
	assert.equal(evidence.requestSha256, sha256(corpusPhpRequestJson(library)));
	assert.equal(evidence.archiveSha256, run.archiveSha256);
	assert.equal(evidence.bindingIrSha256, run.bindingIrSha256);
	assert.equal(evidence.manifestSha256, sha256(canonicalJson(evidence.manifest)));
	assert.deepEqual(evidence.manifest.require, { [run.archive.name]: run.archive.version });
	assert.deepEqual(evidence.manifest.config, { "allow-plugins": false });
	assert.equal(evidence.manifest.repositories.length, 2);
	assert.deepEqual(evidence.manifest.repositories[0], { "packagist.org": false });
	const selected = evidence.manifest.repositories[1];
	assert.equal(selected.type, "package"); assert.equal(selected.package.name, run.archive.name);
	assert.equal(selected.package.version, run.archive.version);
	assert.deepEqual(selected.package.require, { php: ">=8.2 <9", "ext-ffi": "*" });
	assert.deepEqual(selected.package.autoload, { files: ["src/Api.php"] });
	assert.match(selected.package.dist.url, /^file:\/\/\/.+\/project\/feed\/package\.zip$/);
	assert.equal(selected.package.dist.type, "zip"); assert.match(selected.package.dist.shasum, /^[a-f0-9]{40}$/);
	assert.equal(evidence.lock.packages.length, 1); assert.deepEqual(evidence.lock["packages-dev"], []);
	assert.equal(evidence.installed.packages.length, 1);
	for(const pkg of [evidence.lock.packages[0], evidence.installed.packages[0]])
	{
		assert.equal(pkg.name, run.archive.name); assert.equal(pkg.version, run.archive.version);
		assert.deepEqual(pkg.dist, selected.package.dist);
	}
	assert.ok(Object.keys(evidence.composerFiles).length > 0);
	for(const [path, identity] of Object.entries(evidence.composerFiles))
	{
		assert.match(path, /^(?:\/|phar:\/\/\/)/); assert.ok(!path.includes("/project/"));
		assert.match(identity.sha256, /^[a-f0-9]{64}$/); assert.ok(identity.bytes > 0);
	}
	for(const [name, extension] of Object.entries(evidence.extensions))
	{
		assert.ok(["ffi", "ctype", "iconv", "mbstring", "phar", "zip"].includes(name));
		assert.ok(extension.path.startsWith("/") && extension.path.endsWith("/" + name + ".so"));
		assert.match(extension.sha256, /^[a-f0-9]{64}$/);
	}
	const extensionFlags = names => names.filter(name => evidence.extensions[name]).flatMap(name => ["-d", "extension=" + evidence.extensions[name].path]);
	assert.deepEqual(evidence.runtimeOptions, ["-n", ...extensionFlags(["ffi"]), "-d", "ffi.enable=1", "-d", "memory_limit=512M"]);
	const composerOptions = ["-n", ...extensionFlags(["ffi", "ctype", "iconv", "mbstring", "phar", "zip"]), "-d", "ffi.enable=1", "-d", "memory_limit=512M", "-d"];
	assert.deepEqual(evidence.composerOptions.slice(0, -1), composerOptions);
	assert.match(evidence.composerOptions.at(-1), /^auto_prepend_file=\/.+\/project\/tool-probe\.php$/);
	const receipt = evidence.packageReceipt;
	assert.equal(evidence.packageReceiptSha256, sha256(canonicalJson(receipt)));
	assert.equal(receipt.schemaVersion, 1); assert.equal(receipt.kind, "lean-bridge-ordinary-php-package");
	assert.equal(receipt.ecosystem, "composer"); assert.equal(receipt.namespace, library.phpModule);
	assert.equal(receipt.name, run.archive.name); assert.equal(receipt.version, run.archive.version);
	assert.equal(receipt.bindingIrSha256, run.bindingIrSha256); assert.equal(receipt.runtimeIdentity, run.runtimeIdentity);
	fileMap(receipt.files); fileMap(evidence.deployment);
	fileMap(evidence.composerGeneratedFiles);
	for(const [path, identity] of Object.entries(evidence.composerGeneratedFiles))
	{
		assert.match(path, /^vendor\/composer\/(?:autoload_(?:classmap|namespaces|psr4|files)|installed)\.php$/);
		assert.deepEqual(evidence.deployment[path], identity);
	}
	assert.deepEqual(Object.keys(evidence.deployment).filter(path => path.startsWith(prefix)).sort(), [...Object.keys(receipt.files).map(path => prefix + path), prefix + "lean-bridge/package-receipt.json"].sort());
	for(const [path, identity] of Object.entries(receipt.files)) assert.deepEqual(evidence.deployment[prefix + path], identity);
	assert.equal(evidence.deployment[prefix + "lean-bridge/package-receipt.json"].sha256, evidence.packageReceiptSha256);
	assert.equal(evidence.deployment[prefix + "src/Api.php"].sha256, evidence.declarationsSha256);
	assert.equal(evidence.deployment["vendor/composer/installed.json"].sha256, evidence.installedSha256);
	assert.equal(evidence.deployment["request.json"].sha256, evidence.requestSha256);
	const native = Object.keys(receipt.files).filter(path => path.endsWith(".so")).sort();
	assert.equal(native.length, 4);
	for(const name of ["lib" + library.cModule + ".so", "libleanshared.so", "liblean_bridge_native.so"])
		assert.ok(native.includes("native/linux-x64/" + name));
	assert.equal(native.filter(path => /^native\/linux-x64\/libcomponent_[0-9a-f]{20}\.so$/.test(path)).length, 1);
	assert.deepEqual(evidence.executions.map(execution => execution.mode), ["weak", "strict"]);
	assert.deepEqual(run.observation, evidence.executions[0].observation);
	for(const { mode, observation } of evidence.executions)
	{
		validate(observation);
		assert.equal(observation.hostVersion, evidence.version); assert.equal(observation.profile, "php-native");
		assert.equal(observation.callerMode, mode); assert.equal(observation.integerBytes, 8);
		assert.ok(observation.threadSafe === 0 || observation.threadSafe === false); assert.equal(observation.sapi, "cli");
		assert.equal(observation.iniDisabled, true); assert.equal(observation.copiedValuesCollected, true);
		assert.equal(evidence.consumerSources[mode], sha256(corpusPhpSource(mode, "php-native", run.path)));
		assert.equal(evidence.deployment[mode + ".php"].sha256, evidence.consumerSources[mode]);
		assert.ok(observation.apiLocation.endsWith("/relocated/" + prefix + "src/Api.php"));
		const root = observation.apiLocation.slice(0, -(prefix + "src/Api.php").length);
		assert.deepEqual(observation.nativeLibraries, Object.fromEntries(native.map(path => [root + prefix + path, receipt.files[path].sha256])));
		for(const path of [mode + ".php", "vendor/autoload.php", prefix + "src/Api.php", prefix + "src/Internal/Native.php", prefix + "src/Internal/Runtime.php"])
			assert.ok(Object.hasOwn(observation.includedFiles, path), path);
		assert.ok(!Object.hasOwn(observation.includedFiles, (mode === "weak" ? "strict" : "weak") + ".php"));
		for(const [path, hash] of Object.entries(observation.includedFiles))
		{
			assert.ok(path === mode + ".php" || path.startsWith("vendor/"));
			assert.equal(hash, evidence.deployment[path]?.sha256);
		}
		assert.deepEqual(observation.errors, Object.entries(phpRuntimeCases).flatMap(([id, exception]) => Array.from({ length: 3 }, (_, iteration) => ({ id, exception, iteration, recovery: run.oracle.dependency }))));
	}
};
