/**
 * Consume only genuine offline Composer distributions after installation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { appendFile, copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { brickMathRepository, composerFileUrl } from "./brick-math.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";

const env = process.env, releases = env.LEAN_BRIDGE_PHP_IO_CONSUME;
const client = resolve("tests/fixtures/php-sync-io/installed.php");
const load = async p => JSON.parse(await readFile(p, "utf8"));
const repo = async (handoff, stage) => {
	const { receipt, result } = await readVerifiedPackageSetReceipt({ receiptPath: join(handoff,"package-set-receipt.json") });
	const [pkg] = receipt.packages;
	assert.equal(receipt.profiles[0].id, "native-php-io-v1"); assert.equal(pkg.target, "php-native");
	assert.equal(pkg.runtimeDelivery, "embedded"); assert.equal(pkg.artifacts.length, 1);
	const archive = join(handoff, pkg.artifacts[0].path);
	const meta = JSON.parse(await run("unzip", ["-p",archive,"composer.json"],stage,env));
	assert.equal(meta.name, pkg.name); assert.equal(meta.version, pkg.version);
	const bytes = await readFile(archive);
	const dist = { type: "zip", url: composerFileUrl(archive), shasum: createHash("sha1").update(bytes).digest("hex") };
	return { pkg, receiptSha256: result.receiptSha256, repository: { type: "package", package: { ...meta, dist } } };
};

test("relocated native Composer IO uses exact declared effects and errors without a toolchain"
	, { skip: !releases, timeout: 3_600_000 }
	, async t => {
	const root = resolve(releases), reports = [], fixture = await readFile(client);
	const phps = JSON.parse(env.LEAN_BRIDGE_TEST_PHPS ?? '["/usr/bin/php"]');
	assert.ok(phps.length > 0 && new Set(phps).size === phps.length);
	for(const route of ["ordinary", "reviewed"])
	{
		const stage = await mkdtemp(join(tmpdir(), "php-io-client-"));
		try
		{
			const local = join(stage, "consumer"), deploy = join(stage, "relocated consumer");
			await mkdir(local); await copyFile(client, join(local,"client.php"));
			await copyFile(resolve("tests/fixtures/php-sync-io/example.php"), join(local,"example.php"));
			await copyFile(resolve("tests/fixtures/php-sync-io/integrity.php"), join(local,"integrity.php"));
			const components = [];
			for(const label of [route, "peer"]) components.push(await repo(join(root,label,"handoff"), stage));
			const pkgs = components.map(r => r.pkg), [journal, companion] = pkgs;
			assert.equal(journal.name,"lean-bridge/journal"); assert.equal(companion.name,"lean-bridge/companion");
			const repositories = [...components.map(r => r.repository), await brickMathRepository(join(stage,"feed")), { "packagist.org": false }];
			const require = Object.fromEntries(pkgs.map(p => [p.name, p.version]));
			await writeFile(join(local,"composer.json"), canonicalJson({ name: "test/consumer", require, repositories }));
			const composer = env.LEAN_BRIDGE_COMPOSER ?? "composer";
			const offline = { ...env, COMPOSER_DISABLE_NETWORK: "1", COMPOSER_ALLOW_SUPERUSER: "1", COMPOSER_HOME: join(stage,"home"), COMPOSER_CACHE_DIR: join(stage,"cache") };
			await run(composer, ["--no-plugins","--no-scripts","--no-interaction","install","--prefer-dist"],local,offline);
			await rename(local, deploy); const vendor = join(deploy,"vendor");
			const lock = await load(join(deploy,"composer.lock"));
			assert.deepEqual(lock.packages.map(p => p.name).sort(), ["brick/math", companion.name, journal.name]);
			for(const r of components)
			{
				const locked = lock.packages.find(p => p.name === r.pkg.name);
				assert.deepEqual(locked.dist, r.repository.package.dist); assert.equal(locked.version, r.pkg.version);
				const prefix = join(vendor,r.pkg.name), pin = await load(join(prefix,"lean-bridge/package-receipt.json"));
				assert.equal(pin.name, r.pkg.name); assert.equal(pin.profile, r.pkg.profile);
				for(const [file, entry] of Object.entries(pin.files))
				{
					const data = await readFile(join(prefix,file)); assert.equal(data.length,entry.bytes); assert.equal(sha256(data),entry.sha256);
				}
			}
			const isolated = { PATH: "/unavailable", LANG: "C.UTF-8", TMPDIR: deploy, LEAN_NUM_THREADS: "1" };
			const apps = join(vendor,journal.name), receipt = await load(join(apps,"lean-bridge/package-receipt.json"));
			const library = Object.keys(receipt.libraries).filter(key => key.startsWith("liblbc_php_"));
			assert.equal(library.length,1);
			const path = join(apps,"native/linux-x64",library[0]), genuine = await readFile(path);
			for(const php of phps)
			{
				const staticallyLinked = await run(php, ["-n","-r","echo (int)extension_loaded('ffi');"],deploy,isolated);
				const flags = staticallyLinked === "1" ? ["-n"] : ["-n","-d","extension=ffi"];
				flags.push("-d","ffi.enable=1");
				// Alter only this disposable installed copy, never the producer archive.
				await appendFile(path, "!");
				try
				{ assert.equal(await run(php, [...flags,"integrity.php"],deploy,isolated),"modified component refused before loading"); }
				finally
				{ await writeFile(path,genuine); }
				await run(php, [...flags,"example.php"],deploy,isolated);
				for(const order of ["journal-first", "peer-first"])
				{
					const result = JSON.parse(await run(php, [...flags,"client.php",vendor,order,deploy],deploy,isolated));
					assert.equal(result.order,order); assert.equal(result.retired,true);
					assert.equal(typeof result.forkCheck,"boolean"); assert.equal(result.checks,result.forkCheck ? 58 : 57);
					reports.push({ route, ...result, flags, modifiedLibraryRefused: true, receipts: components.map(r => r.receiptSha256) });
					t.diagnostic(route+" / PHP "+result.php+" / "+order+": "+result.checks+" checks");
				}
			}
		}
		finally
		{ await rm(stage, { recursive: true, force: true }); }
	}
	const sources = { "installed.php": sha256(fixture) };
	for(const name of ["example.php", "integrity.php"]) sources[name] = sha256(await readFile(resolve("tests/fixtures/php-sync-io",name)));
	const record = canonicalJson({ sources, reports });
	if(env.LEAN_BRIDGE_PHP_IO_EXPECTED) assert.equal(record, await readFile(resolve(env.LEAN_BRIDGE_PHP_IO_EXPECTED),"utf8"));
		else await writeFile(join(root,"installed-php-io-v1.json"), record, { flag: "wx" });}
);
