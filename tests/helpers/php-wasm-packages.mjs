/**
 * Install relocated npm and Composer archives, then call actual Lean in PHP-Wasm.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, readFile, rename, rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build as buildVite } from "vite";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { phpWasmOrdinaryConsumer } from "./php-wasm-ordinary.mjs";
import { exerciseBrowserPhpWasmPackages } from "./php-wasm-browser.mjs";

/**
 * Install both package ecosystems and exercise a compiler-free PHP-Wasm host.
 *
 * @param options - Test workspace, package handoffs, pinned host and broker probe.
 */
export const exerciseInstalledPhpWasmPackages = async options => {
	const { working, releases, phpHost, probe, t } = options;
	const consumer = join(working, "package-consumer"), moved = `${consumer}-moved`;
	await mkdir(consumer);
	await saveLakeFile(consumer, "package.json", canonicalJson({ private: true, type: "module" }));
	const artifacts = join(working, "archives-relocated"); await mkdir(artifacts);
	const npmArchives = new Set(), composerEntries = [];
	for(const { output, report } of releases)
	{
		for(const item of report.archives)
		{
			const path = join(artifacts, item.archive);
			await cp(join(output, "archives", item.archive), path);
			if(item.ecosystem === "npm") npmArchives.add(path);
			else
			{
				const metadata = JSON.parse(await readFile(join(output, "composer/composer.json")));
				composerEntries.push({ ...metadata, dist: { type: "zip", url: pathToFileURL(path).href } });
			}
		}
	}
	const run = (command, args, cwd, env = process.env) => processBuildRunner.capture({ command, args, cwd, env });
	await run("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--legacy-peer-deps", ...npmArchives], consumer);
	await saveLakeFile(consumer, "composer.json", canonicalJson({ name: "test/php-wasm-consumer", config: { platform: { php: "8.4.1" } }, repositories: [{ "packagist.org": false }, ...composerEntries.map(entry => ({ type: "package", package: entry }))], require: Object.fromEntries(composerEntries.map(entry => [entry.name, entry.version])) }));
	await run(process.env.LEAN_BRIDGE_COMPOSER ?? "composer", ["--no-plugins", "--no-scripts", "--no-interaction", "install", "--prefer-dist"], consumer, { ...process.env, COMPOSER_ALLOW_SUPERUSER: "1", COMPOSER_DISABLE_NETWORK: "1", COMPOSER_HOME: join(working, "composer-home"), COMPOSER_CACHE_DIR: join(working, "composer-cache") });
	await rename(consumer, moved);
	// Supply the pinned test host under its public package name for the exact guide file.
	await symlink(phpHost, join(moved, "node_modules/php-wasm"), "dir");
	await rename(artifacts, `${artifacts}-unavailable`);
	for(const release of releases) await rename(release.output, `${release.output}-unavailable`);
	const imports = releases.map(({ report }, i) => `import api${i} from ${JSON.stringify(report.npmSettings.name)};`).join("\n");
	await saveLakeFile(moved, "browser-entry.mjs", releases.map(({ report }, i) => `export { default as api${i} } from ${JSON.stringify(report.npmSettings.name)};`).join("\n"));
	await buildVite({ root: moved, configFile: false, logLevel: "silent", base: "./", build: { outDir: "bundled", assetsInlineLimit: 0, modulePreload: false, rollupOptions: { input: join(moved, "browser-entry.mjs"), preserveEntrySignatures: "strict", output: { entryFileNames: "consumer.mjs" } } } });
	for(const mode of ["embedded", "composer", "bundled"])
	{
		await saveLakeFile(moved, `${mode}.mjs`, `import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PhpNode } from ${JSON.stringify(pathToFileURL(join(phpHost, "PhpNode.mjs")).href)};
${mode === "bundled" ? "import { api0, api1 } from './bundled/consumer.mjs';" : imports}
const mode = ${JSON.stringify(mode)};
const apis = [api0, api1, api0];
const php = new PhpNode({version: '8.4', sharedLibs: [${JSON.stringify({ name: "probe.so", url: pathToFileURL(probe).href, ini: true })}, ...apis.map(api => mode === 'composer' ? api.extensions : api)], ini: 'memory_limit=512M'});
let stdout = '', stderr = '';
php.addEventListener('output', e => { for (const part of e.detail) stdout += part; });
php.addEventListener('error', e => { for (const part of e.detail) stderr += part; });
await php.binary;
if (mode === 'composer') {
  const mount = async (source, target) => {
    await php.mkdir(target);
    for (const entry of await readdir(source, {withFileTypes: true})) {
      if (entry.isDirectory()) await mount(join(source, entry.name), target + '/' + entry.name);
      else await php.writeFile(target + '/' + entry.name, await readFile(join(source, entry.name)));
    }
  };
  await mount(fileURLToPath(new URL('./vendor', import.meta.url)), '/app-vendor');
  assert.equal(await php.run("<?php require '/app-vendor/autoload.php';"), 0);
} else {
  for (const api of apis) assert.equal(await php.run("<?php require_once '" + api.autoload + "';"), 0);
}
${["Willow", "Aspen"].map(name => `assert.equal(await php.run(${JSON.stringify(phpWasmOrdinaryConsumer(name).replace(`require_once '/${name}/src/Api.php';`, ""))}), 0, 'Installed ${name} failed');`).join("\n")}
assert.equal(stderr, ''); assert.equal(stdout, 'Willow:okAspen:ok');
stdout = '';
for (let i = 0; i < 20; i++) assert.equal(await php.run("<?php echo LeanWillow\\\\answer(), ':', LeanAspen\\\\answer(), ';';"), 0);
assert.equal(stderr, ''); assert.equal(stdout, '17:29;'.repeat(20));
stdout = '';
assert.equal(await php.run("<?php echo json_encode(lean_bridge_test_snapshot());"), 0);
assert.equal(stderr, ''); assert.equal(stdout, '[1,2,1,2,2,0]');
console.log(JSON.stringify({mode, exports: 88, runtimeInitializations: 1, components: 2, repeatedRequests: 20}));
`);
		const result = await run(process.execPath, [`${mode}.mjs`], moved, { ...process.env, PATH: join(working, "no-compilers"), LEAN_SYSROOT: "/unavailable", LEAN_PATH: "/unavailable" });
		assert.deepEqual(JSON.parse(result.stdout.trim()), { mode, exports: 88, runtimeInitializations: 1, components: 2, repeatedRequests: 20 });
		t.diagnostic(`installed PHP-Wasm ${mode}: 88 exports, one runtime, two components`);
	}
	await cp("tests/fixtures/documentation/consumers/php-wasm/ordinary/main.mjs", join(moved, "guide.mjs"));
	const guide = await run(process.execPath, ["guide.mjs"], moved, { ...process.env, PATH: join(working, "no-compilers") });
	assert.equal(guide.stdout, "4294967295"); assert.equal(guide.stderr, "");
	t.diagnostic("published ordinary PHP-Wasm consumer file: exact UInt32 upper bound");
	if(process.env.LEAN_BRIDGE_PHP_WASM_BROWSER_TEST === "1")
		await exerciseBrowserPhpWasmPackages({ consumer: moved, phpHost, probe, t });
	await rm(moved, { recursive: true });
};
