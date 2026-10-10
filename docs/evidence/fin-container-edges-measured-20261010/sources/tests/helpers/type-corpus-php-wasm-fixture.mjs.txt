/**
 * Synthetic report data for tamper tests only, never installed evidence.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { composerProbe } from "./type-corpus-php.mjs";
import { corpusPhpRequestJson, corpusPhpSource, corpusPhpWasmSettings, phpWasmRuntimeCases } from "./type-corpus-php-source.mjs";
import { phpWasmDriverHashes, phpWasmIsolationFlags } from "./type-corpus-php-wasm-evidence.mjs";
import { brickMathValidationFixture } from "./brick-math.mjs";
import { bundledBrickMath } from "../../src/backends/php/brick-math.mjs";

/**
 * Supply an internally consistent synthetic PHP-Wasm report to mutation tests.
 *
 * @param library - Independent catalog library.
 * @param observation - Synthetic shared corpus observation.
 * @param oracle - Synthetic values, never written as executed evidence.
 */
export const phpWasmValidationFixture = (library, observation, oracle) => {
	const digest = "e".repeat(64), identity = { bytes: 100, sha256: digest };
	const settings = corpusPhpWasmSettings(library);
	const archive = { ...settings.npm, target: "php-wasm", sha256: "a".repeat(64), bytes: 100, path: "packages/php-wasm/archives/component.tgz" };
	const runtimeArchive = { name: "@lean-bridge/php-wasm-copied-runtime", version: "0.0.0-copied1.test", target: "php-wasm", sha256: "b".repeat(64), bytes: 100, path: "packages/php-wasm/archives/runtime.tgz" };
	const composerArchive = { ...settings.composer, target: "php-wasm", sha256: "c".repeat(64), bytes: 100, path: "packages/php-wasm/archives/api.zip" };
	const componentRoot = "node_modules/" + archive.name + "/compiled/";
	const bundledRoot = "node_modules/" + archive.name + "/php/";
	const runtimeRoot = "node_modules/" + runtimeArchive.name + "/compiled/";
	const composerRoot = "vendor/" + composerArchive.name + "/";
	const names = ["liblean_bridge_php_wasm_copied_" + "a".repeat(20) + ".so", "php8.4-lb_" + library.id + "_" + "b".repeat(16) + ".so"];
	const sourceIdentity = { leanCompilerSha256: digest, sourceTreeSha256: digest, lakeDependencies: { snapshotSha256: digest } };
	const component = { schemaVersion: 1, profile: "php-wasm-copied-v1"
		, pointerBits: 32, runtimeIdentity: "b".repeat(64)
		, bindingIrSha256: "c".repeat(64), modelSha256: "d".repeat(64)
		, sourceIdentity, library: "lib/" + names[1]
		, wasmLibrary: { bytes: 100, sha256: "9".repeat(64) } };
	const runtime = { schemaVersion: 1, profile: "php-wasm-copied-v1", pointerBits: 32, library: "lib/" + names[0], files: { ["lib/" + names[0]]: { bytes: 101, sha256: "f".repeat(64) } } };
	const runtimeIdentity = sha256(canonicalJson(runtime));
	component.runtimeIdentity = runtimeIdentity;
	const deployment = {};
	const put = (path, text) => { deployment[path] = { bytes: Buffer.byteLength(text), sha256: sha256(text) }; };
	put(componentRoot + "php-wasm-component.json", canonicalJson(component));
	deployment[componentRoot + "model.json"] = { bytes: 100, sha256: component.modelSha256 };
	deployment[componentRoot + component.library] = component.wasmLibrary;
	put(runtimeRoot + "runtime.json", canonicalJson(runtime));
	deployment[runtimeRoot + runtime.library] = runtime.files[runtime.library];
	for(const path of ["src/Api.php", "src/Internal/Native.php"])
	{
		deployment[componentRoot + path] = identity;
		deployment[composerRoot + path] = identity;
	}
	for(const [path, source] of Object.entries(bundledBrickMath())) put(bundledRoot + path, source);
	deployment[bundledRoot + "bootstrap.php"] = identity;
	const files = Object.fromEntries(Object.entries(deployment).map(([path, id]) => [
		path.startsWith("node_modules/" + archive.name + "/") ? "component/package/" + path.slice(("node_modules/" + archive.name + "/").length)
			: path.startsWith(runtimeRoot) ? "runtime/package/compiled/" + path.slice(runtimeRoot.length)
				: "composer/" + path.slice(composerRoot.length)
		, id
	]));
	const packageSet = { schemaVersion: 1
		, kind: "lean-bridge-php-wasm-copied-package-set"
		, profile: "php-wasm-copied-loading-v1"
		, runtimeIdentity, componentIdentity: digest
		, loaderIdentity: digest
		, npmSettings: settings.npm, composerSettings: settings.composer, files
		, archives: [[archive, "component", "component.tgz"], [runtimeArchive, "runtime", "runtime.tgz"], [composerArchive, "api", "api.zip"]].map(([item, role, file]) => ({ name: item.name, version: item.version, bytes: item.bytes, sha256: item.sha256, role, ecosystem: role === "api" ? "composer" : "npm", archive: file })) };
	for(const item of packageSet.archives) files["archives/" + item.archive] = { bytes: item.bytes, sha256: item.sha256 };
	const hostFiles = Object.fromEntries(["PhpNode.mjs", "PhpWeb.mjs", "host.wasm"].map(path => [path, identity]));
	for(const [path, id] of Object.entries(hostFiles)) deployment["node_modules/php-wasm/" + path] = id;
	for(const [path, hash] of Object.entries(phpWasmDriverHashes)) deployment[path] = { bytes: 100, sha256: hash };
	const consumerSources = {}, requests = {};
	for(const mode of ["weak", "strict"])
	{
		put(mode + ".php", corpusPhpSource(mode, "php-wasm"));
		consumerSources[mode] = deployment[mode + ".php"].sha256;
	}
	for(const arrangement of ["embedded", "composer"])
	{
		put("request-" + arrangement + ".json", corpusPhpRequestJson(library, "php-wasm", arrangement));
		requests[arrangement] = deployment["request-" + arrangement + ".json"].sha256;
	}
	const npmManifest = { private: true, type: "module", dependencies: { "php-wasm": "file:./feed/host.tgz", [archive.name]: "file:./feed/component.tgz", [runtimeArchive.name]: "file:./feed/runtime.tgz" } };
	const npmLock = { packages: { "": {}, ...Object.fromEntries([archive, runtimeArchive, { name: "php-wasm", version: "0.1.0" }].map(pkg => ["node_modules/" + pkg.name, { version: pkg.version }])) } };
	put("package.json", canonicalJson(npmManifest)); put("package-lock.json", canonicalJson(npmLock));
	const selected = { name: composerArchive.name
		, version: composerArchive.version
		, require: { php: ">=8.4 <8.5", "brick/math": "1.0.0" }
		, autoload: { files: ["src/Api.php"] }
		, dist: { type: "zip", url: "file:///validator/project/feed/api.zip", shasum: "a".repeat(40) } };
	const dependency = brickMathValidationFixture(); Object.assign(deployment, dependency.deployment);
	const manifest = { name: "lean-bridge-corpus/php-wasm-consumer"
		, require: { [selected.name]: selected.version }
		, config: { "allow-plugins": false, platform: { php: "8.4.1" } }
		, repositories: [{ "packagist.org": false }, { type: "package", package: dependency.selected }, { type: "package", package: selected }] };
	const lock = { packages: [dependency.selected, selected], "packages-dev": [] }, installed = { packages: [dependency.selected, selected] };
	put("composer.json", canonicalJson(manifest)); put("composer.lock", canonicalJson(lock));
	put("vendor/composer/installed.json", canonicalJson(installed));
	deployment["vendor/autoload.php"] = identity;
	deployment["vendor/composer/autoload_classmap.php"] = identity;
	deployment["bundled/consumer.mjs"] = identity;
	for(const [index, path] of [componentRoot + component.library, runtimeRoot + runtime.library].entries())
		deployment["bundled/assets/library" + index + ".so"] = deployment[path];
	const composer = { version: "8.2.33"
		, composerVersion: "Composer version 2.5.5"
		, hostSha256: digest, composerSha256: digest
		, probeSha256: sha256(composerProbe)
		, toolFiles: { "/tools/composer.php": identity }
		, generatedFiles: { "vendor/composer/autoload_classmap.php": identity }
		, extensions: {}
		, options: ["-n", "-d", "auto_prepend_file=/validator/project/composer-probe.php"]
		, manifest, manifestSha256: deployment["composer.json"].sha256
		, lock, lockSha256: deployment["composer.lock"].sha256
		, lockText: canonicalJson(lock), installed
		, installedSha256: deployment["vendor/composer/installed.json"].sha256
		, installedText: canonicalJson(installed) };
	const executions = ["node/embedded", "node/composer", "chromium/bundled"].flatMap(route =>
		["startup", "lazy"].flatMap(loading => ["weak", "strict"].map(mode => {
			const [realm, arrangement] = route.split("/");
			const current = { ...structuredClone(observation)
				, hostVersion: "8.4.1", callerMode: mode
				, integerBytes: 4, threadSafe: false, sapi: "embed", iniDisabled: false
				, copiedValuesCollected: true, nativeLibraries: []
				, apiLocation: "/" + composerRoot + "src/Api.php"
				, includedFiles: { [mode + ".php"]: consumerSources[mode]
					, [composerRoot + "src/Api.php"]: digest
					, [composerRoot + "src/Internal/Native.php"]: digest
					, ...(arrangement === "composer" ? { "vendor/autoload.php": digest
						, "vendor/brick/math/src/BigInteger.php": deployment["vendor/brick/math/src/BigInteger.php"].sha256 }
						: { [composerRoot + "bootstrap.php"]: digest
							, [composerRoot + "dependencies/brick-math/autoload.php"]: deployment[bundledRoot + "dependencies/brick-math/autoload.php"].sha256
							, [composerRoot + "dependencies/brick-math/src/BigInteger.php"]: deployment[bundledRoot + "dependencies/brick-math/src/BigInteger.php"].sha256 }) }
				, errors: Object.entries(phpWasmRuntimeCases).flatMap(([id, exception]) => Array.from({ length: 3 }, (_, iteration) => ({ id, iteration, exception, recovery: oracle.dependency }))) };
			return { realm, arrangement, loading, mode, observation: current
				, phases: ["ready", "autoload", "invalid", "complete"].map(stage => ({ stage, libraries: stage === "complete" || loading === "startup" ? [...names] : [] }))
				, ...(realm === "chromium" ? { requests: ["browser.mjs", "driver.mjs", "bundled/consumer.mjs", "node_modules/php-wasm/PhpWeb.mjs", "node_modules/php-wasm/host.wasm", "request-embedded.json", mode + ".php", "bundled/assets/library0.so", "bundled/assets/library1.so"].map(path => ({ path, ...deployment[path] })) } : {}) };
		}))
	);
	Object.assign(observation, executions[0].observation);
	return { archive, runtimeArchive, composerArchive, runtimeIdentity
		, oracleEvidence: { leanCompilerSha256: digest }
		, sourceTreeSha256: digest, lakeSnapshotSha256: digest
		, rejection: { code: "native-elaboration-unsupported", shape: library.pendingShape, stage: "source-elaboration", status: "unsupported", export: library.pendingExport }
		, observation: executions[0].observation
		, phpWasm: { ...Object.fromEntries(phpWasmIsolationFlags.map(key => [key, true]))
			, packageSet, component, runtime
			, host: { version: "0.1.0", archiveSha256: digest, files: hostFiles }
			, nodeVersion: "v22.23.2", nodeSha256: digest
			, browserVersion: "152.0.0.0", browserSha256: digest
			, driverSha256: phpWasmDriverHashes["driver.mjs"], deployment
			, consumerSources, requests
			, npm: { version: "10.9.8", toolSha256: digest, manifest: npmManifest, lock: npmLock, lockText: canonicalJson(npmLock), lockSha256: deployment["package-lock.json"].sha256 }
			, composer, executions } };
};
