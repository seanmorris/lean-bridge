/**
 * Offline npm/Composer installs and source-free PHP-Wasm executions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, realpath, rename, rm, symlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build as buildVite } from "vite";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { createDeterministicTarGz } from "../../src/release/deterministic-archive.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { composerProbe } from "./type-corpus-php.mjs";
import { corpusPhpRequestJson, corpusPhpSource, corpusPhpWasmSettings } from "./type-corpus-php-source.mjs";
import { browserPhpWasmCorpus } from "./type-corpus-php-wasm-browser.mjs";
import { brickMathRepository } from "./brick-math.mjs";

const repository = resolve(import.meta.dirname, "../..");
const run = (command, args, cwd, env) => processBuildRunner.capture({ command, args, cwd, env, timeoutMs: 180_000 });
const json = async path => JSON.parse(await readFile(path, "utf8"));
const digest = async path => sha256(await readFile(path));

/**
 * Hash a closed regular-file deployment, rejecting links outside it.
 *
 * @param root - Task-owned package or deployment root.
 */
export const phpWasmInventory = async root => Object.fromEntries(await Promise.all((await nativeArtifactPaths(root)).map(async path => {
	const bytes = await readFile(join(root, path));
	return [path, { bytes: bytes.length, sha256: sha256(bytes) }];
})));

const composerInstall = async ({ project, handoff, pkg, environment, clean }) => {
	const php = await realpath(environment.LEAN_BRIDGE_PHP ?? "/usr/bin/php");
	const composer = await realpath(environment.LEAN_BRIDGE_COMPOSER ?? "/usr/bin/composer");
	const probe = JSON.parse((await run(php, ["-n", "-r", "echo json_encode([PHP_VERSION, ini_get('extension_dir'), get_loaded_extensions()]);"], project, clean)).stdout);
	const [version, extensionDirectory, builtins] = probe;
	const extensions = Object.fromEntries(await Promise.all(["ctype", "iconv", "mbstring", "phar", "zip"].filter(name => !builtins.map(name => name.toLowerCase()).includes(name)).map(async name => {
		const path = await realpath(join(extensionDirectory, name + ".so"));
		return [name, { path, sha256: await digest(path) }];
	})));
	const options = ["-n"
		, ...Object.values(extensions).flatMap(item => ["-d", "extension=" + item.path])
		, "-d", "auto_prepend_file=" + join(project, "composer-probe.php")];
	await saveLakeFile(project, "composer-probe.php", composerProbe);
	const home = join(project, "composer-home"), cache = join(project, "composer-cache");
	for(const directory of [home, cache])
	{
		await mkdir(directory); assert.deepEqual(await readdir(directory), []);
	}
	const env = { ...clean, COMPOSER_HOME: home, COMPOSER_CACHE_DIR: cache
		, COMPOSER_ALLOW_SUPERUSER: "1", COMPOSER_DISABLE_NETWORK: "1"
		, COMPOSER_NO_INTERACTION: "1", COMPOSER: join(project, "composer.json")
		, CORPUS_COMPOSER_PROBE: join(project, "composer-files.json") };
	const toolFiles = {}, generatedFiles = {};
	const invoke = async args => {
		const result = await run(php, [...options, composer, "--no-plugins", "--no-scripts", "--no-interaction", ...args], project, env);
		for(const [path, identity] of Object.entries(await json(join(project, "composer-files.json"))))
		{
			const generated = path.startsWith(project + "/");
			const name = generated ? path.slice(project.length + 1) : path;
			const collection = generated ? generatedFiles : toolFiles;
			if(generated) assert.match(name, /^vendor\/composer\/(?:autoload_(?:classmap|namespaces|psr4|files)|installed)\.php$/);
			if(collection[name]) assert.deepEqual(collection[name], identity);
			collection[name] = identity;
		}
		return result;
	};
	const composerVersion = (await invoke(["--version"])).stdout.trim();
	const archive = pkg.artifacts[0], bytes = await readFile(join(handoff, archive.path));
	assert.equal(sha256(bytes), archive.sha256);
	await saveLakeFile(project, "feed/api.zip", bytes);
	const inspection = join(project, "inspection");
	await run("/usr/bin/unzip", ["-q", join(project, "feed/api.zip"), "-d", inspection], project, clean);
	const original = await json(join(inspection, "composer.json"));
	assert.deepEqual(original.require, { php: ">=8.4 <8.5", "brick/math": "1.0.0" });
	const dist = { type: "zip", url: pathToFileURL(join(project, "feed/api.zip")).href, shasum: createHash("sha1").update(bytes).digest("hex") };
	const manifest = { name: "lean-bridge-corpus/php-wasm-consumer"
		, require: { [pkg.name]: pkg.version }
		, repositories: [{ "packagist.org": false }, await brickMathRepository(join(project, "feed")), { type: "package", package: { ...original, dist } }]
		, config: { "allow-plugins": false, platform: { php: "8.4.1" } } };
	await saveLakeFile(project, "composer.json", canonicalJson(manifest));
	const args = ["install", "--prefer-dist", "--no-progress", "--no-dev"];
	await invoke(args);
	const lock = await json(join(project, "composer.lock")), installed = await json(join(project, "vendor/composer/installed.json"));
	assert.equal(lock.packages.length, 2); assert.equal(installed.packages.length, 2); assert.deepEqual(lock["packages-dev"], []);
	for(const list of [lock.packages, installed.packages]) assert.equal(list.find(item => item.name === "brick/math").version, "1.0.0");
	for(const selected of [lock.packages, installed.packages].map(list => list.find(item => item.name === pkg.name)))
	{
		assert.equal(selected.name, pkg.name); assert.equal(selected.version, pkg.version); assert.deepEqual(selected.dist, dist);
	}
	assert.deepEqual(await phpWasmInventory(join(project, "vendor", pkg.name)), await phpWasmInventory(inspection));
	const vendor = await phpWasmInventory(join(project, "vendor")), lockSha256 = await digest(join(project, "composer.lock"));
	await invoke(args);
	assert.deepEqual(await phpWasmInventory(join(project, "vendor")), vendor);
	assert.equal(await digest(join(project, "composer.lock")), lockSha256);
	return { version, composerVersion, hostSha256: await digest(php)
		, composerSha256: await digest(composer)
		, extensions, options, toolFiles, generatedFiles
		, probeSha256: sha256(composerProbe), manifest, lock, installed
		, manifestSha256: sha256(canonicalJson(manifest)), lockSha256
		, lockText: await readFile(join(project, "composer.lock"), "utf8")
		, installedText: await readFile(join(project, "vendor/composer/installed.json"), "utf8")
		, installedSha256: await digest(join(project, "vendor/composer/installed.json")) };
};

/**
 * Install only local archives, relocate the deployment and test both loading modes.
 *
 * @param options - Prepared handoff, captured payload identities and explicit tools.
 */
export const installedPhpWasmCorpus = async options => {
	const { t, library, consumer, handoff, receipt, packageSet, environment, clean, sourcePath = "ordinary-source", fixture } = options;
	const source = mode => fixture ? fixture.source(mode, sourcePath) : corpusPhpSource(mode, "php-wasm", sourcePath);
	const request = arrangement => fixture ? fixture.request(arrangement, sourcePath) : corpusPhpRequestJson(library, "php-wasm", arrangement);
	const project = join(consumer, "project"), deployment = join(consumer, "relocated");
	const bin = join(project, "bin"), cache = join(project, "npm-cache");
	for(const directory of [bin, cache])
	{
		await mkdir(directory, { recursive: true });
		assert.deepEqual(await readdir(directory), []);
	}
	await symlink(process.execPath, join(bin, "node"));
	const host = resolve(environment.LEAN_BRIDGE_PHP_WASM_HOST ?? "build/php-wasm-host/node_modules/php-wasm");
	const hostManifest = await json(join(host, "package.json"));
	assert.equal(hostManifest.name, "php-wasm"); assert.equal(hostManifest.version, "0.1.0");
	assert.deepEqual(hostManifest.dependencies ?? {}, {});
	const hostFiles = await phpWasmInventory(host);
	const hostArchive = await createDeterministicTarGz({ directory: host, archiveRoot: "package", sourceDateEpoch: 1 });
	await saveLakeFile(project, "feed/host.tgz", hostArchive);
	const npm = await realpath(join(process.execPath, "../../bin/npm"));
	for(const name of ["user.npmrc", "global.npmrc"]) await saveLakeFile(project, name, "");
	const packages = receipt.packages.filter(pkg => pkg.ecosystem === "npm");
	assert.equal(packages.length, 2);
	const manifest = { private: true, type: "module", dependencies: { "php-wasm": "file:./feed/host.tgz" } };
	for(const pkg of packages)
	{
		const archive = pkg.artifacts[0], bytes = await readFile(join(handoff, archive.path));
		assert.equal(sha256(bytes), archive.sha256);
		const path = "feed/" + pkg.role + ".tgz";
		await saveLakeFile(project, path, bytes); manifest.dependencies[pkg.name] = "file:./" + path;
	}
	await saveLakeFile(project, "package.json", canonicalJson(manifest));
	const args = [npm, "install", "--offline", "--ignore-scripts"
		, "--no-audit", "--no-fund", "--userconfig", join(project, "user.npmrc")
		, "--globalconfig", join(project, "global.npmrc"), "--cache", cache];
	const npmEnvironment = { ...clean, PATH: bin };
	await run(process.execPath, args, project, npmEnvironment);
	const lock = await json(join(project, "package-lock.json"));
	assert.deepEqual(Object.keys(lock.packages).sort(), ["", "node_modules/php-wasm", ...packages.map(pkg => "node_modules/" + pkg.name)].sort());
	assert.deepEqual(await phpWasmInventory(join(project, "node_modules/php-wasm")), hostFiles);
	for(const pkg of packages)
	{
		assert.equal(lock.packages["node_modules/" + pkg.name].version, pkg.version);
		const expected = Object.fromEntries(Object.entries(packageSet.files).filter(([path]) => path.startsWith(pkg.role + "/package/")).map(([path, identity]) => [path.slice((pkg.role + "/package/").length), identity]));
		assert.deepEqual(await phpWasmInventory(join(project, "node_modules", pkg.name)), expected);
	}
	const modules = await phpWasmInventory(join(project, "node_modules")), lockSha256 = await digest(join(project, "package-lock.json"));
	await run(process.execPath, args, project, npmEnvironment);
	assert.equal(await digest(join(project, "package-lock.json")), lockSha256);
	assert.deepEqual(await phpWasmInventory(join(project, "node_modules")), modules);
	const composerPkg = receipt.packages.find(pkg => pkg.ecosystem === "composer");
	const composer = await composerInstall({ project, handoff, pkg: composerPkg, environment, clean });
	const settings = fixture?.settings ?? corpusPhpWasmSettings(library);
	for(const path of ["src/Api.php", "src/Internal/Native.php"])
		assert.deepEqual(await readFile(join(project, "vendor", settings.composer.name, path)), await readFile(join(project, "node_modules", settings.npm.name, "compiled", path)));
	await saveLakeFile(project, "entry.mjs", "export { default as api } from " + JSON.stringify(settings.npm.name) + ";\n");
	await buildVite({ root: project, configFile: false, publicDir: false
		, logLevel: "silent", base: "./"
		, build: { outDir: "bundled", assetsInlineLimit: 0, modulePreload: false
			, rollupOptions: { input: join(project, "entry.mjs"), preserveEntrySignatures: "strict", output: { entryFileNames: "consumer.mjs" } } } });
	await mkdir(deployment);
	for(const path of ["node_modules", "vendor", "bundled", "package.json", "package-lock.json", "composer.json", "composer.lock"])
		await rename(join(project, path), join(deployment, path));
	for(const [fixture, path] of [["php-wasm", "driver"], ["php-wasm-node", "node"], ["php-wasm-browser", "browser"]])
		await cp(join(repository, "tests/fixtures/type-corpus/consumers", fixture + ".mjs"), join(deployment, path + ".mjs"));
	await saveLakeFile(deployment, "index.html", '<!doctype html><html><head><link rel="icon" href="data:,"></head><body><script type="module" src="./browser.mjs"></script></body></html>');
	for(const mode of ["weak", "strict"]) await saveLakeFile(deployment, mode + ".php", source(mode));
	for(const arrangement of ["embedded", "composer"]) await saveLakeFile(deployment, "request-" + arrangement + ".json", request(arrangement));
	await rm(project, { recursive: true, force: true });
	if(fixture?.removeHandoff) await rm(handoff, { recursive: true, force: true });
	const evidence = { packageSet
		, host: { version: hostManifest.version, files: hostFiles, archiveSha256: sha256(hostArchive) }
		, component: await json(join(deployment, "node_modules", settings.npm.name, "compiled/php-wasm-component.json"))
		, runtime: await json(join(deployment, "node_modules", packages.find(pkg => pkg.role === "runtime").name, "compiled/runtime.json"))
		, nodeVersion: process.version, nodeSha256: await digest(process.execPath)
		, npm: { version: (await run(process.execPath, [npm, "--version"], deployment, clean)).stdout.trim()
			, toolSha256: await digest(npm), manifest, lock, lockSha256
			, lockText: await readFile(join(deployment, "package-lock.json"), "utf8") }
		, composer, driverSha256: await digest(join(deployment, "driver.mjs"))
		, offlineInstall: true, emptyCaches: true, lockedInstall: true
		, relocated: true, publicApiOnly: true, repeatExecution: true
		, unchangedDeployment: true, compilerFreeExecution: true
		, consumerSources: Object.fromEntries(["weak", "strict"].map(mode => [mode, sha256(source(mode))]))
		, requests: Object.fromEntries(["embedded", "composer"].map(arrangement => [arrangement, sha256(request(arrangement))]))
		, deployment: await phpWasmInventory(deployment), executions: [] };
	for(const arrangement of ["embedded", "composer"])
	for(const loading of ["startup", "lazy"])
	for(const mode of ["weak", "strict"])
	{
		t.diagnostic(library.id + ": PHP-Wasm Node " + [arrangement, loading, mode].join("/"));
		const observe = async () => {
			const result = await run(process.execPath, ["node.mjs", arrangement, loading, mode, settings.npm.name], deployment, clean);
			assert.equal(result.stderr, "");
			return JSON.parse(result.stdout);
		};
		const execution = await observe();
		assert.deepEqual(await observe(), execution);
		assert.deepEqual(await phpWasmInventory(deployment), evidence.deployment);
		evidence.executions.push({ realm: "node", arrangement, loading, mode, ...execution });
	}
	const browser = await browserPhpWasmCorpus({ t, library, deployment, environment });
	evidence.browserVersion = browser.version; evidence.browserSha256 = browser.executableSha256;
	evidence.executions.push(...browser.executions);
	assert.deepEqual(await phpWasmInventory(deployment), evidence.deployment);
	return { phpWasm: evidence, observation: evidence.executions[0].observation };
};
