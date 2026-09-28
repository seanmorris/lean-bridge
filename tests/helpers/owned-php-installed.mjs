/**
 * Offline Composer installation, verified contents and compiler-free relocation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, realpath, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths, verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { brickMathRepository, validateBrickMathInstall } from "./brick-math.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { composerProbe } from "./type-corpus-php.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
/**
 * Hash every regular installed file, rejecting symlinks and special entries.
 *
 * @param root - Task-owned installation or deployment directory.
 */
export const ownedPhpInventory = async root => Object.fromEntries(await Promise.all((await nativeArtifactPaths(root)).map(async path => {
	const bytes = await readFile(join(root, path));
	return [path, { bytes: bytes.length, sha256: sha256(bytes) }];
})));

/**
 * Install the real ZIP and Brick Math without networks, plugins or build tools.
 * Return only a relocated deployment, after removing Composer's project/cache.
 *
 * @param options - Task-owned consumer root, archive and explicit host tools.
 */
export const installOwnedPhpArchive = async options => {
	const { root, archive, pkg, environment, additional = [] } = options;
	const project = join(root, "project"), feed = join(project, "feed");
	const home = join(project, "composer-home"), cache = join(project, "cache");
	for(const directory of [feed, home, cache]) await mkdir(directory, { recursive: true });
	assert.deepEqual(await readdir(home), []); assert.deepEqual(await readdir(cache), []);
	const clean = copiedCleanEnvironment;
	const php = await realpath(environment.LEAN_BRIDGE_PHP ?? "/usr/bin/php");
	const composer = await realpath(environment.LEAN_BRIDGE_COMPOSER ?? "/usr/bin/composer");
	const probe = JSON.parse((await runCopied(php, ["-n", "-r", "echo json_encode([PHP_VERSION, PHP_INT_SIZE, PHP_ZTS, PHP_SAPI, ini_get('extension_dir'), get_loaded_extensions()]);"], project, clean)).stdout);
	const [version, width, zts, sapi, directory, builtins] = probe;
	assert.match(version, /^8\.(?:[2-9]|[1-9]\d+)\.\d+$/u); assert.equal(width, 8); assert.ok(!zts); assert.equal(sapi, "cli");
	const modules = ["ffi", "ctype", "iconv", "mbstring", "phar", "zip"];
	const extensions = Object.fromEntries(await Promise.all(modules.filter(name => !builtins.map(name => name.toLowerCase()).includes(name)).map(async name => {
		const path = await realpath(join(directory, name + ".so"));
		return [name, { path, sha256: sha256(await readFile(path)) }];
	})));
	const flags = names => names.filter(name => extensions[name]).flatMap(name => ["-d", "extension=" + extensions[name].path]);
	const runtimeOptions = ["-n", ...flags(["ffi"]), "-d", "ffi.enable=1", "-d", "memory_limit=512M", "-d", "display_errors=stderr"];
	const composerOptions = ["-n", ...flags(modules), "-d", "ffi.enable=1", "-d", "memory_limit=512M", "-d", "auto_prepend_file=" + join(project, "tool-probe.php")];
	await saveLakeFile(project, "tool-probe.php", composerProbe);
	const installEnvironment = { ...clean, COMPOSER_HOME: home
		, COMPOSER_CACHE_DIR: cache, COMPOSER_ALLOW_SUPERUSER: "1"
		, COMPOSER_DISABLE_NETWORK: "1", COMPOSER_NO_INTERACTION: "1"
		, COMPOSER: join(project, "composer.json")
		, CORPUS_COMPOSER_PROBE: join(project, "tool-files.json") };
	const toolFiles = {}, generatedFiles = {};
	const runComposer = async args => {
		const result = await runCopied(php, [...composerOptions, composer, "--no-plugins", "--no-scripts", "--no-interaction", ...args], project, installEnvironment);
		for(const [path, identity] of Object.entries(await json(join(project, "tool-files.json"))))
		{
			if(path.startsWith(project + "/"))
			{
				const relative = path.slice(project.length + 1);
				assert.match(relative, /^vendor\/composer\/(?:autoload_(?:classmap|namespaces|psr4|files)|installed)\.php$/u);
				if(generatedFiles[relative]) assert.deepEqual(generatedFiles[relative], identity);
				generatedFiles[relative] = identity;
			}
			else
			{
				if(toolFiles[path]) assert.deepEqual(toolFiles[path], identity);
				toolFiles[path] = identity;
			}
		}
		return result;
	};
	const composerVersion = (await runComposer(["--version"])).stdout.trim();
	assert.match(composerVersion, /^Composer version 2\.\d+\.\d+/u);
	const selections = [];
	for(const [index, selected] of [{ archive, pkg, owned: true }, ...additional].entries())
	{
		const archiveBytes = await readFile(selected.archive); assert.equal(sha256(archiveBytes), selected.pkg.sha256);
		const local = join(feed, `package-${index}.zip`); await cp(selected.archive, local);
		const inspection = join(project, `inspection-${index}`);
		await runCopied("/usr/bin/unzip", ["-q", local, "-d", inspection], project, clean);
		const receipt = await json(join(inspection, "lean-bridge/package-receipt.json"));
		assert.equal(receipt.schemaVersion, 1); assert.equal(receipt.kind, `lean-bridge-${selected.owned ? "owned" : "ordinary"}-php-package`);
		assert.equal(receipt.ecosystem, "composer"); assert.equal(receipt.name, selected.pkg.name); assert.equal(receipt.version, selected.pkg.version);
		await verifyNativeFiles(inspection, receipt.files);
		assert.deepEqual(await nativeArtifactPaths(inspection), [...Object.keys(receipt.files), "lean-bridge/package-receipt.json"].sort());
		const original = await json(join(inspection, "composer.json"));
		assert.deepEqual(original.require, { php: ">=8.2 <9", "ext-ffi": "*", "brick/math": "1.0.0" });
		assert.deepEqual(original.autoload, { files: ["src/Api.php"] });
		assert.equal(original.scripts, undefined); assert.equal(original.extra["lean-bridge"].profile, `${selected.owned ? "owned" : "ordinary"}-php-cli-ffi-v1`);
		const dist = { type: "zip", url: pathToFileURL(local).href, shasum: createHash("sha1").update(archiveBytes).digest("hex") };
		selections.push({ pkg: selected.pkg, original, receipt, inspection, dist });
	}
	const manifest = { name: "lean-bridge-tests/owned-consumer"
		, require: Object.fromEntries(selections.map(({ pkg }) => [pkg.name, pkg.version]))
		, repositories: [{ "packagist.org": false }, await brickMathRepository(feed), ...selections.map(({ original, dist }) => ({ type: "package", package: { ...original, dist } }))]
		, config: { "allow-plugins": false } };
	await saveLakeFile(project, "composer.json", canonicalJson(manifest));
	const install = ["install", "--prefer-dist", "--no-progress", "--no-dev"];
	await runComposer(install);
	const lock = await json(join(project, "composer.lock")), installed = await json(join(project, "vendor/composer/installed.json"));
	assert.deepEqual(lock["packages-dev"], []);
	assert.equal(lock.packages.length, selections.length + 1); assert.equal(installed.packages.length, selections.length + 1);
	for(const list of [lock.packages, installed.packages])
	for(const { pkg, dist } of selections)
	{
		const selected = list.find(item => item.name === pkg.name);
		assert.equal(selected.version, pkg.version); assert.deepEqual(selected.dist, dist);
	}
	for(const { pkg, receipt, inspection } of selections)
	{
		const packageRoot = join(project, "vendor", pkg.name);
		await verifyNativeFiles(packageRoot, receipt.files);
		assert.deepEqual(await ownedPhpInventory(packageRoot), await ownedPhpInventory(inspection));
	}
	const before = await ownedPhpInventory(join(project, "vendor"));
	const lockSha256 = sha256(await readFile(join(project, "composer.lock")));
	await runComposer(install);
	assert.equal(sha256(await readFile(join(project, "composer.lock"))), lockSha256);
	assert.deepEqual(await ownedPhpInventory(join(project, "vendor")), before);
	const deployment = join(root, "relocated"); await mkdir(deployment);
	await rename(join(project, "vendor"), join(deployment, "vendor"));
	await rm(project, { recursive: true, force: true });
	assert.deepEqual(await readdir(root), ["relocated"]);
	const evidence = { version, composerVersion, manifest, lock, installed
		, receipt: selections[0].receipt, lockSha256
		, receipts: selections.map(({ receipt }) => receipt)
		, hostSha256: sha256(await readFile(php))
		, composerSha256: sha256(await readFile(composer))
		, archiveSha256: pkg.sha256, toolFiles, generatedFiles, extensions
		, runtimeOptions, composerOptions
		, emptyHome: true, emptyCache: true, offline: true, lockedInstall: true
		, scriptsDisabled: true, pluginsDisabled: true, composerProjectRemoved: true
		, relocated: true, compilerFree: true, iniDisabled: true
		, deployment: await ownedPhpInventory(deployment) };
	validateBrickMathInstall(evidence, evidence.deployment);
	return { deployment, php, runtimeOptions, environment: clean, evidence };
};
