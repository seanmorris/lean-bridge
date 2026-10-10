/**
 * Real Composer and PHP controls using synthetic payloads, not Lean acceptance reports.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, readFile, rename, rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, runCopied } from "./helpers/copied-fixture-install.mjs";
import { finContainerEdgePhpFixture } from "./helpers/fin-container-edge-php-closure-fixture.mjs";
import { inspectFinContainerEdgePhpArchive, installFinContainerEdgePhp, runFinContainerEdgePhp, verifyFinContainerEdgePhpEnvironment } from "./helpers/fin-container-edge-php-closure.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const enabled = process.env.LEAN_BRIDGE_FIN_CONTAINER_EDGE_SOURCE_TEST === "1";
const php = process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php", composer = process.env.LEAN_BRIDGE_COMPOSER ?? "/usr/bin/composer";
const source = '<?php declare(strict_types=0); require "vendor/autoload.php"; echo "php-closure-ok:" . Probe\\value() . "\\n";\n';
const install = async (fixture, label, installPhp = installFinContainerEdgePhp, caller = source) => installCopiedConsumer({ profile: "php-native"
	, consumer: join(fixture.root, label)
	, ...await fixture.pack(label)
	, environment: { LEAN_BRIDGE_PHP: php, LEAN_BRIDGE_COMPOSER: composer, PHPRC: "/unavailable/poison", COMPOSER: "/unavailable/composer.json" }
	, fixture: { source: () => caller, success: "php-closure-ok", expectedChecks: 1, installPhp } });

test("PHP archive guard authenticates original receipts, member sets and Composer discovery metadata", async t => {
	const fixture = await finContainerEdgePhpFixture(t);
	const inspect = async label => {
		const { handoff, packages } = await fixture.pack(label), bytes = await readFile(join(handoff, "probe.zip"));
		return inspectFinContainerEdgePhpArchive(bytes, packages[0].artifacts[0].sha256);
	};
	assert.equal((await inspect("original")).receipt.name, "probe/api");
	await saveLakeFile(fixture.payload, "src/extra.php", "<?php exit(87);\n");
	await assert.rejects(inspect("extra"), /unrecorded or missing PHP archive file/u);
	await rm(join(fixture.payload, "src/extra.php"));
	await saveLakeFile(fixture.payload, "src/Api.php", "<?php exit(87);\n");
	await assert.rejects(inspect("changed"), /PHP archive member drift/u);
	for(const mutation of [
		metadata => { metadata.scripts = { "post-install-cmd": "touch executed" }; }
		, metadata => { metadata.autoload.files.push("src/extra.php"); }
		, metadata => { metadata.require["untrusted/dependency"] = "*"; }
		, metadata => { metadata.config = { "allow-plugins": true }; }
	]) {
		const metadata = structuredClone(fixture.metadata); mutation(metadata);
		await saveLakeFile(fixture.payload, "composer.json", canonicalJson(metadata)); await fixture.receipt();
		await assert.rejects(inspect(`metadata-${sha256(canonicalJson(metadata)).slice(0, 8)}`));
	}
});

test("Composer guard closes original payloads and generated autoloaders before weak, strict and relocated calls", { skip: !enabled }, async t => {
	const fixture = await finContainerEdgePhpFixture(t), result = await install(fixture, "consumer");
	assert.equal(result.checks, 1);
	let context = result.phpEnvironment;
	const expected = await verifyFinContainerEdgePhpEnvironment(context), call = () => runFinContainerEdgePhp(context);
	assert.equal((await call()).stdout, "php-closure-ok:1\n");
	assert.equal((await runFinContainerEdgePhp(context, "strict")).stdout, "php-closure-ok:1\n");
	assert.deepEqual(await nativeArtifactPaths(join(context.root, "vendor")), Object.keys(context.vendorFiles).sort());
	const mutablePaths = ["consumer.php", "strict.php", "composer.json"
		, "composer.lock", "feed/component.zip", "vendor/autoload.php"
		, "vendor/composer/autoload_files.php"
		, "vendor/composer/autoload_static.php"
		, "vendor/composer/installed.json", "vendor/composer/installed.php"
		, "vendor/composer/ClassLoader.php", "vendor/probe/api/src/Api.php"
		, "vendor/probe/api/lean-bridge/package-receipt.json"
		, "vendor/brick/math/src/BigInteger.php"];
	for(const path of mutablePaths)
	{
		const original = await readFile(join(context.root, path));
		await saveLakeFile(context.root, path, "changed"); await assert.rejects(call());
		await saveLakeFile(context.root, path, original);
	}
	for(const path of ["vendor/probe/api/src/extra.php", "vendor/brick/math/extra.php", "vendor/composer/extra.php", "vendor/untrusted/plugin.php"])
	{
		await saveLakeFile(context.root, path, "<?php exit(87);"); await assert.rejects(call(), /unrecorded/u);
		await rm(join(context.root, path));
	}
	await assert.rejects(runFinContainerEdgePhp({ ...context, tools: { ...context.tools, [context.command]: { bytes: 0, sha256: sha256("wrong") } } }), /tool drift/u);
	await rename(join(context.root, "vendor"), join(fixture.root, "linked-vendor"));
	await symlink(join(fixture.root, "linked-vendor"), join(context.root, "vendor"));
	await assert.rejects(call(), /symlink/u);
	await rm(join(context.root, "vendor")); await rename(join(fixture.root, "linked-vendor"), join(context.root, "vendor"));
	const moved = `${context.root}-moved`; await rename(context.root, moved); context = { ...context, root: moved };
	assert.deepEqual(await verifyFinContainerEdgePhpEnvironment(context), expected);
	assert.equal((await call()).stdout, "php-closure-ok:1\n");
	assert.equal((await runFinContainerEdgePhp(context, "strict")).stdout, "php-closure-ok:1\n");
});

test("an unrecorded Composer autoload file executes without the guard and is refused before guarded installation", { skip: !enabled }, async t => {
	const fixture = await finContainerEdgePhpFixture(t), marker = join(fixture.root, "executed");
	fixture.metadata.autoload.files.unshift("src/extra.php");
	await saveLakeFile(fixture.payload, "composer.json", canonicalJson(fixture.metadata));
	await fixture.receipt();
	await saveLakeFile(fixture.payload, "src/extra.php", `<?php file_put_contents(${JSON.stringify(marker)}, "executed");\n`);
	await assert.rejects(install(fixture, "guarded"), /unrecorded or missing PHP archive file/u);
	await assert.rejects(access(marker), { code: "ENOENT" });
	assert.equal((await install(fixture, "unguarded", null)).checks, 1);
	assert.equal(await readFile(marker, "utf8"), "executed");
});

test("PHP startup ignores an ambient ini prepend that executes in the unguarded positive control", { skip: !enabled }, async t => {
	const fixture = await finContainerEdgePhpFixture(t), result = await install(fixture, "consumer"), context = result.phpEnvironment;
	const marker = join(fixture.root, "executed"), ini = join(fixture.root, "poison.ini"), prepend = join(fixture.root, "prepend.php");
	await saveLakeFile(fixture.root, "prepend.php", `<?php file_put_contents(${JSON.stringify(marker)}, "executed");\n`);
	await saveLakeFile(fixture.root, "poison.ini", `auto_prepend_file=${prepend}\n`);
	await saveLakeFile(fixture.root, "plain.php", '<?php echo "plain-ok\\n";\n');
	await runCopied(php, ["plain.php"], fixture.root, { ...copiedCleanEnvironment, PHPRC: ini });
	assert.equal(await readFile(marker, "utf8"), "executed"); await rm(marker);
	const prior = process.env.PHPRC; process.env.PHPRC = ini;
	try
	{ assert.equal((await runFinContainerEdgePhp(context)).stdout, "php-closure-ok:1\n"); }
	finally
	{ if(prior === undefined) delete process.env.PHPRC; else process.env.PHPRC = prior; }
	await assert.rejects(access(marker), { code: "ENOENT" });
});

test("PHP verifies generated inputs after a successful or failing caller modifies them", { skip: !enabled }, async t => {
	const fixture = await finContainerEdgePhpFixture(t);
	for(const status of [0, 7])
	{
		const caller = `<?php declare(strict_types=0); require "vendor/autoload.php"; file_put_contents("vendor/autoload.php", "changed"); echo "php-closure-ok:1\\n"; exit(${status});\n`;
		await assert.rejects(install(fixture, `changed-${status}`, installFinContainerEdgePhp, caller), /PHP file drift/u);
	}
});

test("PHP refuses original archive drift and a reused consumer root before Composer", { skip: !enabled }, async t => {
	const fixture = await finContainerEdgePhpFixture(t), packed = await fixture.pack("archive"), archive = join(packed.handoff, "probe.zip");
	const root = join(fixture.root, "fresh"); await saveLakeFile(root, "consumer.php", source);
	await assert.rejects(installFinContainerEdgePhp({ root, archive, archiveSha256: sha256("wrong"), command: "/unavailable/php", composer: "/unavailable/composer" }), /original PHP archive drift/u);
	await saveLakeFile(root, "composer.json", "{}");
	await assert.rejects(installFinContainerEdgePhp({ root, command: "/unavailable/php" }), /fresh PHP consumer directory/u);
});
