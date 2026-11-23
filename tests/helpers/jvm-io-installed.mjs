/**
 * Build and independently consume synchronous Lean IO through original Maven releases.
 *
 * @file
 */
import assert from "node:assert/strict";
import { constants } from "node:fs";
import { access, copyFile, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { buildCliNpmPackage } from "../../src/release/cli-npm-package.mjs";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { nativeDeliveryHeader } from "../../src/build/jvm-io-owner.mjs";
import { assertJsonSchema } from "./json-schema.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import "./jvm-io-acceptance.mjs";

const env = { ...process.env, LEAN_NUM_THREADS: "1" };
const build = env.LEAN_BRIDGE_JVM_IO_BUILD;
const journal = resolve("tests/fixtures/native-sync-io");
const scalars = "unit bool char uint8 uint16 uint32 uint64 usize int8 int16 int32 int64 isize float32 float64 string bytes nat int".split(" ");
const parse = async p => JSON.parse(await readFile(p, "utf8"));
test("the Maven IO profile includes its implementation and the examples select only synchronous declarations", async () => {
	const ordinary = (await nativeDeliveryHeader(false)).toString(), jvm = (await nativeDeliveryHeader(true)).toString();
	assert.match(ordinary, /getpid\(\) == \(pid_t\)syscall\(SYS_gettid\)/u); assert.doesNotMatch(ordinary, /LB_JVM_OWNER/u);
	assert.match(jvm, /LB_JVM_OWNER\(current\)\(\)/u);
	for(const [lang, ext] of [["java", "java"], ["kotlin", "kt"]])
	{
		const page = (await readFile("docs/consume/" + lang + ".md", "utf8")).split("### Call synchronous IO\n")[1];
		assert.equal(page.match(/\x60{3}(?:java|kotlin)\n([\s\S]*?)\x60{3}/u)[1], await readFile("tests/fixtures/jvm-sync-io/Example." + ext, "utf8"));
	}
	const author = (await readFile("docs/publish/maven.md", "utf8")).split("## Export synchronous IO\n")[1];
	const cfg = JSON.parse(author.match(/\x60{3}json\n([\s\S]*?)\x60{3}/u)[1]);
	await assertJsonSchema("lean-export-configuration", cfg); validateExportConfiguration(cfg); assert.deepEqual(cfg.nativeEffects, ["filesystem"]);
	for(const path of ["package.json", "config/cli-package.v1.json", "nix/perl-engine-source-boundary.json"])
	{
		const manifest = await parse(path), files = manifest.files ?? manifest.includedFiles;
		for(const f of ["src/backends/c/task-owner-policy.h", "src/backends/jvm/io-owner.c", "src/backends/jvm/io-owner.h", "src/backends/jvm/io-wire.java", "src/backends/jvm/sync-io.mjs", "src/build/jvm-io-owner.mjs", "src/release/jvm-io-package.mjs"]) assert.ok(files.includes(f), path + ": " + f);
	}
});
const policy = env.LEAN_BRIDGE_JVM_IO_POLICY;
test("Maven IO rejects missing OS grants, unsupported delivery and dishonest source reviews without a handoff", { skip: !policy, timeout: 600_000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "jvm-io-negative-")); t.after(() => rm(root, { recursive: true, force: true }));
	const src = join(root, "project"), out = join(root, "release");
	await cp(join(resolve(policy), "ordinary/source"), src, { recursive: true });
	const path = join(src, "lean-bridge.exports.json"), cfg = await parse(path);
	const wrong = async reason => {
		await assert.rejects(buildCanonicalProject({ projectRoot: src, outputRoot: out, targets: ["maven"], environment: env }), e => {
			assert.match([e.message, e.details?.stdout, e.details?.stderr].join("\n"), reason); return true;
		});
		await assert.rejects(access(out), { code: "ENOENT" });
	};
	await writeFile(path, canonicalJson({ ...cfg, nativeEffects: [] })); await wrong(/requires nativeEffects "filesystem"/u);
	await writeFile(path, canonicalJson({ ...cfg, taskExports: ["Journal.store"] })); await wrong(/taskExports requires a real Lean Task result/u);
	const reviewed = await parse(join(resolve(policy), "ordinary/handoff/binding-ir.json"));
	const bump = reviewed.declarations.find(d => d.name === "bump"); assert.equal(bump.result.type.name, "uint32"); bump.result.type.name = "uint64";
	delete cfg.exports;
	await writeFile(path, canonicalJson(cfg)); await writeFile(join(src, "public.binding-ir.json"), canonicalJson(reviewed), { flag: "wx" });
	await wrong(/Reviewed API differs/u);
});
test("ordinary and reviewed JARs contain compiled Java and Kotlin APIs for synchronous Lean IO", { skip: !build, timeout: 3_600_000 }, async t => {
	const root = resolve(build), routes = env.LEAN_BRIDGE_JVM_IO_ROUTE ? [env.LEAN_BRIDGE_JVM_IO_ROUTE] : ["ordinary", "peer", "reviewed"];
	for(const route of routes)
	{
		assert.ok(["ordinary", "reviewed", "peer"].includes(route));
		const peer = route === "peer", dir = join(root, route), src = join(dir, "source");
		await mkdir(src, { recursive: true });
		const config = await parse(join(journal, "lean-bridge.exports.json"));
		await copyFile(join(journal, "lean-toolchain"), join(src, "lean-toolchain"), constants.COPYFILE_EXCL);
		const module = peer ? "Clock" : "Journal";
		const code = peer ? "namespace Clock\ndef read : BaseIO UInt32 := pure 71\nend Clock\n" : await readFile(join(journal, "Journal.lean"), "utf8");
		await writeFile(join(src, module + ".lean"), code + `\nnamespace ${module}\ndef owner : IO String := IO.FS.readFile "/proc/thread-self/stat"\nend ${module}\n`, { flag: "wx" });
		if(peer)
		{
			config.modules = ["Clock"];
			config.exports = ["Clock.read"];
		}
		else
		{
			await copyFile(resolve("tests/fixtures/ruby-sync-io/RubyIO.lean"), join(src, "RubyIO.lean"), constants.COPYFILE_EXCL);
			config.modules.push("RubyIO"); config.exports.push(...scalars.map(s => "RubyIO.rt_" + s), "RubyIO.nested");
		}
		config.exports.push(module + ".owner");
		config.targets = { maven: { name: "com.acme:" + module.toLowerCase() + "-io", version: "1.2.0-rc.1" } };
		if(route === "reviewed")
		{
			await copyFile(join(root, "ordinary/handoff/binding-ir.json"), join(src, "public.binding-ir.json"), constants.COPYFILE_EXCL);
			delete config.exports;
		}
		await writeFile(join(src, "lakefile.toml"), `name="${module.toLowerCase()}"\nversion="1.0.0"\n` + config.modules.map(m => `[[lean_lib]]\nname="${m}"\n`).join(""), { flag: "wx" });
		await writeFile(join(src, "lean-bridge.exports.json"), canonicalJson(config), { flag: "wx" });
		await buildCanonicalProject({ projectRoot: src, outputRoot: join(dir, "handoff"), targets: ["maven"], environment: env })
			.catch(e => { throw new Error(e.message + "\n" + JSON.stringify(e.details), { cause: e }); });
		if(route === "reviewed") assert.deepEqual(await parse(join(src, "public.binding-ir.json")), await parse(join(dir, "handoff/binding-ir.json")));
		t.diagnostic("built " + route + " JAR/POM");
	}
});
const repro = env.LEAN_BRIDGE_JVM_REPRO ?? env.LEAN_BRIDGE_JVM_IO_REPRO;
test("an offline-installed CLI in a second producer root reproduces the complete Maven handoff", { skip: !repro, timeout: 900_000 }, async () => {
	const dir = resolve(repro), original = join(resolve(env.LEAN_BRIDGE_JVM_ORIGINAL ?? env.LEAN_BRIDGE_JVM_IO_ORIGINAL), "ordinary");
	await mkdir(dir); const src = join(dir, "project"), tools = join(dir, "installed-cli");
	await cp(join(original, "source"), src, { recursive: true });
	const packed = await buildCliNpmPackage({ outputRoot: join(dir, "cli-feed") });
	await run("npm", ["install", "--prefix", tools, "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--cache", join(dir, "npm-cache"), packed.archive], dir, env);
	await rm(packed.output, { recursive: true });
	const cli = join(tools, "node_modules/.bin/lean-bridge"), release = join(dir, "handoff");
	await run(process.execPath, [cli, "build", "--project", src, "--target", "maven", "--output", release, "--format", "json"], dir, env);
	const path = join(release, "package-set-receipt.json");
	const verified = JSON.parse(await run(process.execPath, [cli, "verify", "--receipt", path, "--format", "json"], dir, env));
	assert.equal(verified.result.archives, 2);
	const a = await readVerifiedPackageSetReceipt({ receiptPath: join(original, "handoff/package-set-receipt.json") });
	const b = await readVerifiedPackageSetReceipt({ receiptPath: path });
	assert.deepEqual(a.receipt, b.receipt); assert.equal(a.result.receiptSha256, b.result.receiptSha256);
	for(const f of ["host-export-evidence.json", "binding-ir.json", "native-release.json"])
		assert.deepEqual(await readFile(join(original, "handoff", f)), await readFile(join(release, f)));
	await writeFile(join(dir, "reproduction.json"), canonicalJson({ cliArchiveSha256: packed.report.archive.sha256
		, receiptSha256: b.result.receiptSha256
		, artifacts: b.receipt.packages[0].artifacts }), { flag: "wx" });
});
