/**
 * Bind each PHP-Wasm observation to its installed packages and loading route.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { composerProbe } from "./type-corpus-php.mjs";
import { corpusPhpRequestJson, corpusPhpSource, corpusPhpWasmSettings, phpWasmRuntimeCases } from "./type-corpus-php-source.mjs";

export const phpWasmDriverHashes = Object.fromEntries(await Promise.all([
	["php-wasm", "driver.mjs"]
	, ["php-wasm-node", "node.mjs"], ["php-wasm-browser", "browser.mjs"]
].map(async ([fixture, path]) => [path, sha256(await readFile(new URL("../fixtures/type-corpus/consumers/" + fixture + ".mjs", import.meta.url)))])));
export const phpWasmIsolationFlags = ["offlineInstall", "emptyCaches", "lockedInstall", "relocated", "publicApiOnly", "repeatExecution", "unchangedDeployment", "compilerFreeExecution"];

const hash = value => assert.match(value, /^[a-f0-9]{64}$/);
const files = inventory => {
	assert.ok(Object.keys(inventory).length);
	for(const [path, identity] of Object.entries(inventory))
	{
		assert.match(path, /^[A-Za-z0-9_@.+/-]+$/);
		assert.ok(!path.startsWith("/") && path.split("/").every(part => part && part !== "." && part !== ".."));
		assert.ok(Number.isSafeInteger(identity.bytes) && identity.bytes >= 0);
		hash(identity.sha256);
	}
};
const subset = (inventory, prefix) => Object.fromEntries(Object.entries(inventory).filter(([path]) => path.startsWith(prefix)).map(([path, identity]) => [path.slice(prefix.length), identity]));

/**
 * Validate all routes and callers, including independent errors and recovery.
 *
 * @param run - Installed corpus run.
 * @param library - Independent ordinary-source library.
 * @param validate - Shared observation/oracle validator.
 */
export const validatePhpWasmEvidence = (run, library, validate) => {
	const evidence = run.phpWasm, settings = corpusPhpWasmSettings(library);
	for(const key of phpWasmIsolationFlags) assert.equal(evidence[key], true, key);
	for(const key of ["nodeSha256", "browserSha256"]) hash(evidence[key]);
	assert.match(evidence.nodeVersion, /^v\d+\.\d+\.\d+$/);
	assert.match(evidence.browserVersion, /^\d+\.\d+\.\d+\.\d+$/);
	assert.equal(evidence.host.version, "0.1.0"); hash(evidence.host.archiveSha256);
	files(evidence.host.files); files(evidence.deployment);
	assert.ok(evidence.host.files["PhpNode.mjs"] && evidence.host.files["PhpWeb.mjs"]);
	assert.deepEqual(subset(evidence.deployment, "node_modules/php-wasm/"), evidence.host.files);
	const set = evidence.packageSet;
	assert.equal(set.schemaVersion, 1); assert.equal(set.kind, "lean-bridge-php-wasm-copied-package-set");
	assert.equal(set.profile, "php-wasm-copied-loading-v1");
	assert.deepEqual(set.npmSettings, settings.npm); assert.deepEqual(set.composerSettings, settings.composer);
	assert.equal(set.runtimeIdentity, run.runtimeIdentity); hash(set.componentIdentity); hash(set.loaderIdentity);
	assert.equal(set.archives.length, 3); files(set.files);
	for(const [role, archive] of [["component", run.archive], ["runtime", run.runtimeArchive], ["api", run.composerArchive]])
	{
		assert.equal(archive.target, "php-wasm"); hash(archive.sha256);
		assert.ok(Number.isSafeInteger(archive.bytes) && archive.bytes > 0);
		const packaged = set.archives.find(entry => entry.role === role);
		assert.ok(packaged);
		for(const key of ["name", "version", "sha256", "bytes"]) assert.equal(packaged[key], archive[key]);
		assert.equal(packaged.ecosystem, role === "api" ? "composer" : "npm");
		assert.equal(archive.path, "packages/php-wasm/archives/" + packaged.archive);
		assert.deepEqual(set.files["archives/" + packaged.archive], { bytes: archive.bytes, sha256: archive.sha256 });
		const source = role === "api" ? "composer/" : role + "/package/";
		const destination = role === "api" ? "vendor/" : "node_modules/";
		assert.deepEqual(subset(evidence.deployment, destination + archive.name + "/"), subset(set.files, source));
	}
	assert.equal(run.archive.name, settings.npm.name); assert.equal(run.composerArchive.name, settings.composer.name);
	assert.equal(run.runtimeArchive.name, "@lean-bridge/php-wasm-copied-runtime");
	assert.equal(new Set([run.archiveSha256, run.runtimeArchive.sha256, run.composerArchive.sha256]).size, 3);
	const componentRoot = "node_modules/" + run.archive.name + "/compiled/";
	const runtimeRoot = "node_modules/" + run.runtimeArchive.name + "/compiled/";
	const composerRoot = "vendor/" + run.composerArchive.name + "/";
	const component = evidence.component, runtime = evidence.runtime;
	assert.equal(evidence.deployment[componentRoot + "php-wasm-component.json"].sha256, sha256(canonicalJson(component)));
	assert.equal(evidence.deployment[runtimeRoot + "runtime.json"].sha256, sha256(canonicalJson(runtime)));
	assert.equal(run.runtimeIdentity, sha256(canonicalJson(runtime)));
	assert.equal(component.schemaVersion, 1); assert.equal(component.profile, "php-wasm-copied-v1"); assert.equal(component.pointerBits, 32);
	assert.equal(runtime.schemaVersion, 1); assert.equal(runtime.profile, "php-wasm-copied-v1"); assert.equal(runtime.pointerBits, 32);
	assert.equal(component.runtimeIdentity, run.runtimeIdentity); assert.equal(component.bindingIrSha256, run.bindingIrSha256);
	assert.equal(component.modelSha256, run.declarationEvidence.modelSha256);
	assert.equal(evidence.deployment[componentRoot + "model.json"].sha256, component.modelSha256);
	assert.equal(component.sourceIdentity.leanCompilerSha256, run.oracleEvidence.leanCompilerSha256);
	assert.equal(component.sourceIdentity.sourceTreeSha256, run.sourceTreeSha256);
	assert.equal(component.sourceIdentity.lakeDependencies.snapshotSha256, run.lakeSnapshotSha256);
	const libraryFiles = [componentRoot + component.library, runtimeRoot + runtime.library];
	assert.deepEqual(evidence.deployment[libraryFiles[0]], component.wasmLibrary);
	assert.deepEqual(evidence.deployment[libraryFiles[1]], runtime.files[runtime.library]);
	const libraryNames = [basename(runtime.library), basename(component.library)];
	assert.match(libraryNames[0], /^liblean_bridge_php_wasm_copied_[a-f0-9]{20}\.so$/);
	assert.match(libraryNames[1], /^php8\.4-lb_[a-z0-9_]+_[a-f0-9]{16}\.so$/);
	for(const path of ["src/Api.php", "src/Internal/Native.php"])
		assert.deepEqual(evidence.deployment[componentRoot + path], evidence.deployment[composerRoot + path]);
	assert.equal(evidence.driverSha256, phpWasmDriverHashes["driver.mjs"]);
	for(const [path, expected] of Object.entries(phpWasmDriverHashes)) assert.equal(evidence.deployment[path].sha256, expected);
	for(const mode of ["weak", "strict"])
	{
		assert.equal(evidence.consumerSources[mode], sha256(corpusPhpSource(mode, "php-wasm", run.path)));
		assert.equal(evidence.deployment[mode + ".php"].sha256, evidence.consumerSources[mode]);
	}
	for(const arrangement of ["embedded", "composer"])
	{
		assert.equal(evidence.requests[arrangement], sha256(corpusPhpRequestJson(library, "php-wasm", arrangement)));
		assert.equal(evidence.deployment["request-" + arrangement + ".json"].sha256, evidence.requests[arrangement]);
	}
	const npm = evidence.npm, composer = evidence.composer;
	hash(npm.toolSha256); hash(npm.lockSha256); assert.match(npm.version, /^\d+\.\d+\.\d+$/);
	assert.equal(evidence.deployment["package.json"].sha256, sha256(canonicalJson(npm.manifest)));
	assert.equal(evidence.deployment["package-lock.json"].sha256, npm.lockSha256);
	assert.equal(npm.lockSha256, sha256(npm.lockText)); assert.deepEqual(JSON.parse(npm.lockText), npm.lock);
	assert.deepEqual(npm.manifest, { private: true, type: "module", dependencies: { "php-wasm": "file:./feed/host.tgz", [run.archive.name]: "file:./feed/component.tgz", [run.runtimeArchive.name]: "file:./feed/runtime.tgz" } });
	assert.deepEqual(Object.keys(npm.lock.packages).sort(), ["", "node_modules/php-wasm", "node_modules/" + run.archive.name, "node_modules/" + run.runtimeArchive.name].sort());
	for(const pkg of [run.archive, run.runtimeArchive, { name: "php-wasm", version: "0.1.0" }]) assert.equal(npm.lock.packages["node_modules/" + pkg.name].version, pkg.version);
	assert.match(composer.composerVersion, /^Composer version 2\.\d+\.\d+/);
	for(const key of ["hostSha256", "composerSha256", "lockSha256", "installedSha256"]) hash(composer[key]);
	assert.equal(composer.probeSha256, sha256(composerProbe));
	assert.equal(composer.manifestSha256, sha256(canonicalJson(composer.manifest)));
	assert.equal(evidence.deployment["composer.json"].sha256, composer.manifestSha256);
	assert.equal(evidence.deployment["composer.lock"].sha256, composer.lockSha256);
	assert.equal(evidence.deployment["vendor/composer/installed.json"].sha256, composer.installedSha256);
	assert.equal(composer.lockSha256, sha256(composer.lockText)); assert.deepEqual(JSON.parse(composer.lockText), composer.lock);
	assert.equal(composer.installedSha256, sha256(composer.installedText)); assert.deepEqual(JSON.parse(composer.installedText), composer.installed);
	assert.deepEqual(composer.manifest.config, { "allow-plugins": false, platform: { php: "8.4.1" } });
	assert.deepEqual(composer.manifest.require, { [run.composerArchive.name]: run.composerArchive.version });
	assert.equal(composer.manifest.repositories.length, 2);
	assert.deepEqual(composer.manifest.repositories[0], { "packagist.org": false });
	const selected = composer.manifest.repositories[1];
	assert.equal(selected.type, "package"); assert.equal(selected.package.name, run.composerArchive.name);
	assert.deepEqual(selected.package.require, { php: ">=8.4 <8.5" });
	assert.deepEqual(selected.package.autoload, { files: ["src/Api.php"] });
	assert.equal(selected.package.dist.type, "zip"); assert.match(selected.package.dist.url, /^file:\/\/\/.+\/project\/feed\/api\.zip$/);
	assert.match(selected.package.dist.shasum, /^[a-f0-9]{40}$/);
	assert.equal(composer.lock.packages.length, 1); assert.deepEqual(composer.lock["packages-dev"], []); assert.equal(composer.installed.packages.length, 1);
	for(const pkg of [composer.lock.packages[0], composer.installed.packages[0]])
	{
		assert.equal(pkg.name, run.composerArchive.name); assert.equal(pkg.version, run.composerArchive.version);
		assert.deepEqual(pkg.dist, selected.package.dist);
	}
	assert.ok(Object.keys(composer.toolFiles).length > 0);
	for(const [path, identity] of Object.entries(composer.toolFiles))
	{
		assert.match(path, /^(?:\/|phar:\/\/\/)/); assert.ok(!path.includes("/project/"));
		hash(identity.sha256); assert.ok(identity.bytes > 0);
	}
	assert.ok(Object.keys(composer.generatedFiles).length > 0);
	for(const [path, identity] of Object.entries(composer.generatedFiles))
	{
		assert.match(path, /^vendor\/composer\/(?:autoload_(?:classmap|namespaces|psr4|files)|installed)\.php$/);
		assert.deepEqual(evidence.deployment[path], identity);
	}
	for(const [name, extension] of Object.entries(composer.extensions))
	{
		assert.ok(["ctype", "iconv", "mbstring", "phar", "zip"].includes(name)); hash(extension.sha256);
		assert.ok(extension.path.startsWith("/") && extension.path.endsWith("/" + name + ".so"));
	}
	assert.deepEqual(composer.options.slice(0, -1), ["-n", ...Object.values(composer.extensions).flatMap(item => ["-d", "extension=" + item.path]), "-d"]);
	assert.match(composer.options.at(-1), /^auto_prepend_file=\/.+\/project\/composer-probe\.php$/);
	assert.equal(evidence.executions.length, 12);
	const keys = [];
	for(const execution of evidence.executions)
	{
		const { realm, arrangement, loading, mode, phases, observation } = execution;
		keys.push([realm, arrangement, loading, mode].join("/"));
		// Startup and dl() may ask for the component/runtime in different orders.
		// Require exact names and counts at each phase, not a host fetch order.
		assert.deepEqual(phases.map(phase => ({ ...phase, libraries: [...phase.libraries].sort() })), ["ready", "autoload", "invalid", "complete"].map(stage => ({ stage, libraries: stage === "complete" || loading === "startup" ? [...libraryNames].sort() : [] })));
		validate(observation);
		assert.equal(observation.profile, "php-wasm"); assert.equal(observation.hostVersion, "8.4.1");
		assert.equal(observation.callerMode, mode); assert.equal(observation.integerBytes, 4);
		assert.equal(observation.threadSafe, false); assert.equal(observation.sapi, "embed");
		assert.equal(observation.iniDisabled, false); assert.equal(observation.copiedValuesCollected, true);
		assert.deepEqual(observation.nativeLibraries, []);
		assert.equal(observation.apiLocation, "/" + composerRoot + "src/Api.php");
		const included = observation.includedFiles;
		assert.equal(included[mode + ".php"], evidence.consumerSources[mode]);
		assert.ok(!Object.hasOwn(included, (mode === "weak" ? "strict" : "weak") + ".php"));
		for(const path of [composerRoot + "src/Api.php", composerRoot + "src/Internal/Native.php"]) assert.equal(included[path], evidence.deployment[path].sha256);
		for(const [path, value] of Object.entries(included))
		{
			assert.ok(path === mode + ".php" || path.startsWith("vendor/")); assert.equal(value, evidence.deployment[path]?.sha256);
			if(arrangement !== "composer") assert.ok(path === mode + ".php" || path.startsWith(composerRoot));
		}
		if(arrangement === "composer") assert.equal(included["vendor/autoload.php"], evidence.deployment["vendor/autoload.php"].sha256);
		assert.deepEqual(observation.errors, Object.entries(phpWasmRuntimeCases).flatMap(([id, exception]) => Array.from({ length: 3 }, (_, iteration) => ({ id, iteration, exception, recovery: run.oracle.dependency }))));
		if(realm === "chromium")
		{
			assert.ok(execution.requests.length > 0);
			for(const request of execution.requests) assert.deepEqual({ bytes: request.bytes, sha256: request.sha256 }, evidence.deployment[request.path]);
			for(const path of ["browser.mjs", "driver.mjs", "bundled/consumer.mjs", "node_modules/php-wasm/PhpWeb.mjs", "request-embedded.json", mode + ".php"]) assert.ok(execution.requests.some(request => request.path === path));
			for(const path of libraryFiles) assert.equal(execution.requests.filter(request => request.sha256 === evidence.deployment[path].sha256).length, 1);
			assert.ok(execution.requests.some(request => request.path.startsWith("node_modules/php-wasm/") && request.path.endsWith(".wasm")));
		}
	}
	assert.deepEqual(keys.sort(), ["node/embedded", "node/composer", "chromium/bundled"].flatMap(route => ["startup", "lazy"].flatMap(loading => ["weak", "strict"].map(mode => [route, loading, mode].join("/")))).sort());
	assert.deepEqual(run.observation, evidence.executions.find(execution => execution.realm === "node" && execution.arrangement === "embedded" && execution.loading === "startup" && execution.mode === "weak").observation);
	assert.equal(run.rejection.code, "native-elaboration-unsupported"); assert.equal(run.rejection.export, library.pendingExport);
	assert.equal(run.rejection.shape, library.pendingShape); assert.equal(run.rejection.stage, "source-elaboration"); assert.equal(run.rejection.status, "unsupported");
};
