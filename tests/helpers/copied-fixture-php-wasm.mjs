/**
 * Exercise installed copied-value PHP-Wasm APIs in Node and Chromium.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, readFile, realpath, rename, rm, symlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build as buildVite } from "vite";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { startSiteServer } from "../../site/serve.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { brickMathRepository } from "./brick-math.mjs";
import { createDeterministicTarGz } from "../../src/release/deterministic-archive.mjs";
import { copiedCleanEnvironment as clean, runCopied as run } from "./copied-fixture-install.mjs";

const deploymentInventory = async (root, paths) => {
	const files = await Promise.all(paths.map(async prefix => {
		const entries = await nativeArtifactPaths(join(root, prefix));
		return Promise.all(entries.map(async path => {
			const bytes = await readFile(join(root, prefix, path));
			return [`${prefix}/${path}`, { bytes: bytes.length, sha256: sha256(bytes) }];
		}));
	}));
	return Object.fromEntries(files.flat().sort(([left], [right]) => left.localeCompare(right)));
};

/**
 * Install complete npm and Composer handoffs before executing PHP callers.
 *
 * @param root0 - Prepared PHP-Wasm inputs.
 * @param root0.consumer - Task-owned consumer root.
 * @param root0.handoff - Verified archive directory.
 * @param root0.packages - Matching npm and Composer receipt entries.
 * @param root0.fixture - Independent PHP consumer and invalid-input probe.
 * @param root0.environment - Explicit host and tool paths.
 */
export const installCopiedPhpWasm = async ({ consumer, handoff, packages, environment, fixture }) => {
	const original = join(consumer, "php-wasm-original"), root = join(consumer, "php-wasm");
	await mkdir(original);
	const host = resolve(environment.LEAN_BRIDGE_PHP_WASM_HOST ?? "build/php-wasm-host/node_modules/php-wasm");
	const hostMetadata = JSON.parse(await readFile(join(host, "package.json")));
	assert.equal(hostMetadata.version, "0.1.0");
	await saveLakeFile(original, "feed/host.tgz", await createDeterministicTarGz({ directory: host, archiveRoot: "package", sourceDateEpoch: 1 }));
	const npmPackages = packages.filter(pkg => pkg.ecosystem === "npm"), dependencies = { "php-wasm": "file:./feed/host.tgz" };
	for(const pkg of npmPackages)
	{
		const path = `feed/${pkg.role}.tgz`;
		await cp(join(handoff, pkg.artifacts[0].path), join(original, path)); dependencies[pkg.name] = `file:./${path}`;
	}
	await saveLakeFile(original, "package.json", canonicalJson({ private: true, type: "module", dependencies }));
	const npm = await realpath(join(dirname(process.execPath), "npm")), bin = join(original, "bin"); await mkdir(bin);
	await symlink(process.execPath, join(bin, "node"));
	await run(process.execPath, [npm, "install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--cache", join(original, "cache")], original, { ...clean, PATH: bin });
	const pkg = packages.find(pkg => pkg.ecosystem === "composer"), inspection = join(original, "inspection");
	const archive = join(handoff, pkg.artifacts[0].path);
	await run("/usr/bin/unzip", ["-q", archive, "-d", inspection], original);
	const metadata = JSON.parse(await readFile(join(inspection, "composer.json")));
	await saveLakeFile(original, "composer.json", canonicalJson({ name: "copied-check/php-wasm"
		, require: { [pkg.name]: pkg.version }
		, repositories: [{ "packagist.org": false }, await brickMathRepository(join(original, "feed")), { type: "package", package: { ...metadata, dist: { type: "zip", url: pathToFileURL(archive).href } } }]
		, config: { "allow-plugins": false, platform: { php: "8.4.1" } } }));
	await run(environment.LEAN_BRIDGE_PHP ?? "/usr/bin/php", [environment.LEAN_BRIDGE_COMPOSER ?? "/usr/bin/composer", "--no-plugins", "--no-scripts", "--no-interaction", "install", "--prefer-dist"], original
		, { ...clean, PATH: "/usr/bin:/bin", COMPOSER_ALLOW_SUPERUSER: "1", COMPOSER_DISABLE_NETWORK: "1", COMPOSER_HOME: join(original, "composer-home"), COMPOSER_CACHE_DIR: join(original, "composer-cache") });
	await rename(original, root);
	const source = (await fixture.source("php-native", "php", 32)).replace("require 'vendor/autoload.php';", "");
	for(const mode of ["weak", "strict"]) await saveLakeFile(root, `${mode}.php`, source.replace("declare(strict_types=0);", `declare(strict_types=${mode === "strict" ? 1 : 0});`));
	const name = npmPackages.find(pkg => pkg.role === "component").name;
	await saveLakeFile(root, "entry.mjs", `export { default as api } from ${JSON.stringify(name)};\n`);
	await buildVite({ root
		, configFile: false
		, publicDir: false
		, logLevel: "silent"
		, base: "./"
		, build: { outDir: "bundled", assetsInlineLimit: 0, modulePreload: false, rollupOptions: { input: join(root, "entry.mjs"), preserveEntrySignatures: "strict", output: { entryFileNames: "consumer.mjs" } } } });
	const driver = `export async function checkPhp(Host, api, mode, loading, source, mount) {
  let stdout = '', stderr = ''; const libraries = [];
  const descriptor = loading === 'lazy' ? api.lazy : api;
  const selected = mount ? descriptor.extensions : descriptor;
  const php = new Host({version: '8.4', sharedLibs: loading === 'startup' ? [selected] : [], dynamicLibs: loading === 'lazy' ? [selected] : [], ini: 'memory_limit=512M', locateFile: name => {if (name.endsWith('.so') && name !== 'libxml2.so') libraries.push(name);}});
  php.addEventListener('output', event => {for (const part of event.detail) stdout += part;});
  php.addEventListener('error', event => {for (const part of event.detail) stderr += part;});
  await php.binary;
  if (mount) await mount(php);
  const autoload = mount ? '/app-vendor/autoload.php' : api.autoload;
  if (await php.run("<?php require '" + autoload + "';") !== 0) throw new Error(stdout + stderr);
  const before = libraries.length;
  if (await php.run(${JSON.stringify("<?php " + fixture.phpInvalid)}) !== 0) throw new Error(stdout + stderr);
  if (libraries.length !== before || (loading === 'lazy' && before !== 0)) throw new Error('Invalid input loaded lazy code');
  await php.writeFile('/consumer.php', source);
  if (await php.run("<?php require '/consumer.php';") !== 0 || stderr || !/^${fixture.success}:[0-9]+\\n$/.test(stdout)) throw new Error(JSON.stringify({stdout,stderr}));
  ${fixture.phpDocumentation ? `const beforeDocumentation = stdout; stdout = '';
  await php.writeFile('/documentation.php', ${JSON.stringify(fixture.phpDocumentation)}.replace("__DIR__ . '/vendor/autoload.php'", "'" + autoload + "'"));
  if (await php.run("<?php require '/documentation.php';") !== 0 || stderr || stdout !== ${JSON.stringify(fixture.phpDocumentationOutput)}) throw new Error(JSON.stringify({stdout,stderr}));
  stdout = beforeDocumentation;` : ""}
  ${fixture.phpBailout ? `if (await php.run(${JSON.stringify("<?php " + fixture.phpBailout)}) !== 0 || stderr) throw new Error(JSON.stringify({stdout,stderr}));
  // PHP-Wasm leaves an exited request inert until its host starts a new one.
  // A zero status alone does not prove that a recovery program executed.
  await php.refresh(); stdout = ''; stderr = '';
  if (await php.run("<?php require '" + autoload + "'; require '/consumer.php';") !== 0 || stderr || !/^${fixture.success}:[0-9]+\\n$/.test(stdout)) throw new Error(JSON.stringify({stdout,stderr}));
  const repeated = stdout; stdout = '';
  if (await php.run(${JSON.stringify("<?php " + fixture.phpRecovery + " echo 'php-recovery-executed';")}) !== 0 || stderr || stdout !== 'php-recovery-executed') throw new Error(JSON.stringify({stdout,stderr}));
  stdout = repeated;` : ""}
  if (libraries.length !== 2 || new Set(libraries).size !== 2) throw new Error('Expected one component and one runtime');
  return {checks: Number(stdout.trim().split(':')[1]), libraries: libraries.length, mode, loading${fixture.phpBailout ? ", bailoutRecovery: true" : ""}${fixture.attestDeployment ? ", libraryNames: libraries" : ""}${fixture.phpDocumentation ? ", documentationExecuted: true" : ""}};
}\n`;
	await saveLakeFile(root, "driver.mjs", driver);
	await saveLakeFile(root, "node.mjs", `import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {PhpNode} from './node_modules/php-wasm/PhpNode.mjs';
import api from ${JSON.stringify(name)};
import {checkPhp} from './driver.mjs';
// Print the actual failure, not Node's multi-megabyte minified host source line.
process.setUncaughtExceptionCaptureCallback(error => { console.error(error.stack || String(error)); process.exit(1); });
const [arrangement,loading,mode]=process.argv.slice(2);
async function mount(php) {
  async function copy(from,to) { await php.mkdir(to); for(const file of await readdir(from,{withFileTypes:true})) {if(file.isDirectory()) await copy(join(from,file.name),to+'/'+file.name); else await php.writeFile(to+'/'+file.name,await readFile(join(from,file.name)));} }
  await copy('vendor','/app-vendor');
}
console.log(JSON.stringify(await checkPhp(PhpNode,api,mode,loading,await readFile(mode+'.php','utf8'),arrangement==='composer'?mount:undefined)));
`);
	if(fixture.removeHandoff)
	{
		await rm(handoff, { recursive: true, force: true });
		for(const path of ["feed", "inspection", "cache", "composer-cache", "composer-home"])
			await rm(join(root, path), { recursive: true, force: true });
	}
	const deployed = ["vendor", "bundled", ...npmPackages.map(pkg => `node_modules/${pkg.name}`)];
	const deployment = fixture.attestDeployment ? await deploymentInventory(root, deployed) : null;
	const executions = [];
	for(const arrangement of ["embedded", "composer"])
	for(const loading of ["startup", "lazy"])
	for(const mode of ["weak", "strict"])
	{
		const result = await run(process.execPath, ["node.mjs", arrangement, loading, mode], root);
		assert.equal(result.stderr, ""); executions.push({ realm: "node", arrangement, ...JSON.parse(result.stdout) });
	}
	await saveLakeFile(root, "index.html", '<!doctype html><html><head><link rel="icon" href="data:,"></head><body><script type="module" src="./browser.mjs"></script></body></html>');
	await saveLakeFile(root, "browser.mjs", `import {PhpWeb} from './node_modules/php-wasm/PhpWeb.mjs';
import {api} from './bundled/consumer.mjs';
import {checkPhp} from './driver.mjs';
const params=new URLSearchParams(location.search), mode=params.get('mode'), loading=params.get('loading');
try {globalThis.copiedResult=await checkPhp(PhpWeb,api,mode,loading,await(await fetch(mode+'.php')).text());} catch(error) {globalThis.copiedError=String(error);}
`);
	const { chromium } = await import("playwright");
	const server = await startSiteServer({ root, base: "/copied/" });
	let browser;
	try
	{
		browser = await chromium.launch({ headless: true, ...(environment.CHROMIUM_PATH ? { executablePath: environment.CHROMIUM_PATH } : {}) });
		for(const loading of ["startup", "lazy"])
		for(const mode of ["weak", "strict"])
		{
			const context = await browser.newContext({ serviceWorkers: "block" });
			try
			{
				await context.route("**/*", route => route.request().url().startsWith(server.url) ? route.continue() : route.abort());
				const page = await context.newPage(), errors = []; page.on("pageerror", error => errors.push(error.message));
				await page.goto(`${server.url}?loading=${loading}&mode=${mode}`);
				await page.waitForFunction(() => globalThis.copiedResult || globalThis.copiedError, null, { timeout: 90_000 });
				assert.equal(await page.evaluate(() => globalThis.copiedError), undefined); assert.deepEqual(errors, []);
				executions.push({ realm: "chromium", arrangement: "bundled", ...await page.evaluate(() => globalThis.copiedResult) });
			}
			finally
			{ await context.close(); }
		}
	}
	finally
	{ await browser?.close(); await server.close(); }
	assert.ok(executions.every(item => item.checks === executions[0].checks && item.checks >= 1000));
	if(deployment)
	{
		assert.deepEqual(await deploymentInventory(root, deployed), deployment);
		for(const execution of executions)
			for(const name of execution.libraryNames)
				assert.ok(Object.keys(deployment).some(path => path.endsWith("/" + name)), name);
	}
	return { checks: executions[0].checks, executions
		, consumerSha256: sha256(source), driverSha256: sha256(driver)
		, offlineInstall: true, compilerFreePath: true
		, browserVersion: browser.version()
		, ...deployment ? { deployment, unchangedDeployment: true, handoffRemovedBeforeExecution: fixture.removeHandoff === true } : {}
		, ...fixture.phpDocumentation ? { documentationSha256: sha256(fixture.phpDocumentation), documentationExecutions: executions.length } : {} };
};
