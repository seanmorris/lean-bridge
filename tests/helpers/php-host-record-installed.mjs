/** @file Run actual PHP applications on ordinary and reviewed native host-record packages. */
import assert from "node:assert/strict";
import {access, copyFile, cp, mkdir, mkdtemp, readFile, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import test from "node:test";
import {canonicalJson, sha256} from "../../src/capsule/node.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {installOfflineAuthor} from "./offline-author-cli.mjs";
import {installPhpIOComponents} from "./php-io-install.mjs";

const json = async path => JSON.parse(await readFile(path));
test("installed Composer packages preserve application objects in Lean records", {timeout: 1_800_000}, async t => {
	const env = process.env, root = await mkdtemp(join(tmpdir(), "php-host-record-"));
	t.after(() => rm(root, {recursive: true, force: true}));
	const cli = await installOfflineAuthor(root), fixture = resolve("tests/fixtures/php-host-record");
	const report = resolve(env.LEAN_BRIDGE_PHP_HOST_RECORD_EVIDENCE ?? "build/php-host-record");
	const phpBins = (env.LEAN_BRIDGE_PHP_HOST_INTERPRETERS ?? "/usr/bin/php").split(",").map(p => resolve(p));
	const source = await readFile(join(fixture, "consumer.php"));
	let review;
	for(const route of ["ordinary", "reviewed"])
	{
		const author = join(root, route + "-project"), out = join(root, route + "-out");
		await cp(resolve("tests/fixtures/ruby-host-meter"), author, {recursive: true, filter: path => !path.endsWith(".rb")});
		await copyFile(join(fixture, "Workshop.lean"), join(author, "Workshop.lean"));
		await copyFile(resolve("LICENSE"), join(author, "LICENSE"));
		const ir = await json(join(author, "lean-bridge.hosts.json")); ir.types[0].host.targets = ["php"];
		ir.types[0].documentation.summary = "An application-owned PHP meter.";
		await saveLakeFile(author, "lean-bridge.hosts.json", canonicalJson(ir));
		const cfg = await json(join(author, "lean-bridge.exports.json"));
		cfg.targets = {"php-native": {name: "lean-bridge/workshop", version: "1.0.0"}};
		if(route === "ordinary") cfg.exports = ["Station.mirror", "Station.swap", "Station.combined", "Station.banner", "Station.chooseMeter"];
		else
		{
			delete cfg.exports; await saveLakeFile(author, "public.binding-ir.json", review);
		}
		await saveLakeFile(author, "lean-bridge.exports.json", canonicalJson(cfg));
		const build = path => run(process.execPath, [cli, "build", "--project", author, "--target", "php-native", "--output", path, "--progress", "none", "--json"], root, env);
		await build(out);
		const api = await json(join(out, "binding-ir.json")), evidence = await json(join(out, "host-export-evidence.json"));
		assert.equal(api.schemaVersion, 4); assert.equal(evidence.selection.phpNativeFunctions, true);
		const def = api.types.find(v => v.id === "lean:Station.Panel"), swap = api.declarations.find(d => d.source.declaration === "Station.swap");
		assert.deepEqual(def.fields.map(f => f.name), ["primary_meter", "caption", "limit", "serial", "backup_meter"]);
		assert.equal(swap.result.ownership, "lease"); assert.equal(swap.parameters[0].ownership, "borrow");
		if(route === "ordinary")
		{
			assert.equal(evidence.reviewedSourceSha256, null);
			def.fields[1].documentation.summary = "Display caption from the application."; review = canonicalJson(api);
		}
		else
		{
			assert.equal(evidence.reviewedSourceSha256, sha256(review)); assert.deepEqual(api, JSON.parse(review));
			def.fields.reverse(); await saveLakeFile(author, "public.binding-ir.json", canonicalJson(api));
			const refused = join(root, "no-release"); await assert.rejects(build(refused), /Reviewed API differs/u); await assert.rejects(access(refused), {code: "ENOENT"});
		}
		const receipt = await json(join(out, "package-set-receipt.json"));
		const stage = join(root, route + "-install"), local = join(stage, "client"), deploy = join(stage, "deployed");
		await mkdir(local, {recursive: true}); await saveLakeFile(local, "client.php", source);
		const {components, vendor} = await installPhpIOComponents(stage, local, deploy, [out]);
		assert.equal(components[0].pkg.profile, "native-php-host-v1");
		assert.match(await readFile(join(vendor, components[0].pkg.name, "README.md"), "utf8"), /A clone closes independently/u);
		await rm(author, {recursive: true}); await rm(out, {recursive: true});
		const runs = [], isolated = {PATH: "/unavailable", LANG: "C.UTF-8", LEAN_NUM_THREADS: "1", TMPDIR: deploy};
		for(const php of phpBins)
		{
			const flags = (await run(php, ["-n", "-r", "echo (int)extension_loaded('ffi');"], deploy, isolated)) === "1" ? ["-n"] : ["-n", "-d", "extension=ffi"];
			const version = await run(php, ["-n", "-r", "echo PHP_VERSION;"], deploy, isolated);
			const observed = await run(php, [...flags, "-d", "ffi.enable=1", "client.php", join(vendor, "autoload.php")], deploy, isolated);
			assert.equal(observed, "PHP panel: object identity, strings and large Nat, two-record prevalidation, partial-output cleanup, original exception, independent clone, captured fields and last release");
			runs.push({version, observed});
		}
		await mkdir(report, {recursive: true}); await saveLakeFile(report, route + ".package-set.json", canonicalJson(receipt));
		await saveLakeFile(report, route + ".execution.json", canonicalJson({route, packageSetSha256: components[0].receiptSha256, reviewedSourceSha256: evidence.reviewedSourceSha256, consumerSha256: sha256(source), runs}));
		t.diagnostic(route + " " + components[0].receiptSha256); await rm(stage, {recursive: true});
	}
});
