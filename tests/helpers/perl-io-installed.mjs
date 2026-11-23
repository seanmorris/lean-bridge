/**
 * Build standalone IO from a real Lake package, then consume only prepared CPAN distributions.
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
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { validatePerlIOSettings, verifyPerlIOFiles } from "../../src/backends/perl/sync-io.mjs";
import { readVerifiedCpanPackage } from "../../src/release/cpan-package.mjs";
import { assertJsonSchema } from "./json-schema.mjs";
import "./perl-io-consumers.mjs";
import "./perl-io-repro.mjs";
import "./perl-io-adapter-replay.mjs";

const env = { ...process.env, LEAN_NUM_THREADS: "1" }, build = env.LEAN_BRIDGE_PERL_IO_BUILD;
const json = async f => JSON.parse(await readFile(f, "utf8"));
test("documented Perl synchronous API uses shipped sources and valid CPAN coordinates", async () => {
	const read = f => readFile(f,"utf8");
	const snippet = async (file, heading) => (await read(file)).split(heading+"\n")[1].match(/\x60{3}\w+\n([\s\S]*?)\x60{3}/u)[1];
	assert.equal(await snippet("docs/consume/perl.md","### Call synchronous IO and handle errors"),await read("tests/fixtures/perl-sync-io/example.pl"));
	const cfg = JSON.parse(await snippet("docs/publish/cpan.md","### Export synchronous IO"));
	validateExportConfiguration(cfg); await assertJsonSchema("lean-export-configuration",cfg); assert.deepEqual(cfg.nativeEffects,["filesystem"]);
	validatePerlIOSettings({ name: cfg.targets.cpan.module, version: cfg.targets.cpan.version });
	assert.throws(() => validatePerlIOSettings({ name: "LeanBridge::Runtime", version: "0.001" }),/reserved/u);
	assert.throws(() => validatePerlIOSettings({ name: "LeanBridge::Journal", version: "1.0.0" }),/decimal/u);
	for(const f of ["package.json","config/cli-package.v1.json","nix/perl-engine-source-boundary.json"])
	{
		const m = await json(f);
		for(const asset of ["src/backends/perl/sync-wire.h","src/backends/perl/sync-io.mjs","src/release/perl-io-package.mjs"])
			assert.ok((m.files ?? m.includedFiles).includes(asset));
	}
});
const policy = env.LEAN_BRIDGE_PERL_IO_POLICY;
test("real Perl IO rejects undeclared OS access, a changed review and unsupported delivery before handoff", { skip: !policy, timeout: 1_800_000 }, async t => {
	const root = resolve(policy), work = await mkdtemp(join(tmpdir(),"perl-io-policy-")); t.after(() => rm(work,{ recursive: true, force: true }));
	const src=join(work,"source"), out=join(work,"handoff"), file=join(src,"lean-bridge.exports.json");
	await cp(join(root,"ordinary/source"),src,{ recursive: true }); const cfg=await json(file);
	const reject = async (config,reason) => {
		await writeFile(file,canonicalJson(config));
		await assert.rejects(buildCanonicalProject({ projectRoot: src, outputRoot: out, targets: ["cpan"], environment: env }),e => {
			assert.match([e.message,e.details?.stderr,e.details?.stdout].join("\n"),reason); return true;
		}); await assert.rejects(access(out),{ code: "ENOENT" });
	};
	await reject({ ...cfg, nativeEffects: [] },/requires nativeEffects "filesystem"/u);
	await reject({ ...cfg, taskExports: ["Journal.store"] },/taskExports requires a real Lean Task result/u);
	const ir = await json(join(root,"ordinary/handoff/binding-ir.json"));
	const err = ir.errors.find(x => x.id === "error:EIO.Journal.choose"); err.payload.arguments[1] = { kind: "primitive", name: "uint64" };
	delete cfg.exports; await writeFile(join(src,"public.binding-ir.json"),canonicalJson(ir),{ flag: "wx" });
	await reject(cfg,/Reviewed API differs/u);
	const component = join(root,"ordinary/handoff/packages/component");
	const { manifest, files } = await readVerifiedCpanPackage(component);
	const base = await readFile("src/backends/perl/Build.pm","utf8"), header = await readFile("src/backends/perl/sync-wire.h");
	for(const path of ["LeanBridgeBuild.pm","Component.xs","sync-wire.h","lib/LeanBridge/Journal.pm"])
	{
		const tampered = new Map(files); tampered.set(path,Buffer.from(files.get(path).toString()+"\n"));
		assert.throws(() => verifyPerlIOFiles(manifest,tampered,base,header),/differs/u);
	}
	const mislabeled = join(work,"mislabeled"); await cp(component,mislabeled,{ recursive: true });
	const stripped = { ...manifest }; delete stripped.syncIO;
	await writeFile(join(mislabeled,"lean-bridge-package.json"),canonicalJson(stripped));
	await assert.rejects(readVerifiedCpanPackage(mislabeled),/select different profiles/u);
});
test("build ordinary, reviewed and independently named synchronous IO CPAN distributions", { skip: !build, timeout: 7_200_000 }, async t => {
	const root = resolve(build), route = env.LEAN_BRIDGE_PERL_IO_ROUTE;
	for(const r of route ? [route] : ["ordinary", "reviewed", "peer"])
	{
		assert.ok(["ordinary", "reviewed", "peer"].includes(r));
		const dir = join(root,r), src = join(dir,"source"); await mkdir(src,{ recursive: true });
		const fixture = resolve("tests/fixtures/native-sync-io"), peer = r === "peer", mod = peer ? "Companion" : "Journal";
		await copyFile(join(fixture,"lean-toolchain"),join(src,"lean-toolchain"),constants.COPYFILE_EXCL);
		const journal = (await readFile(join(fixture,"Journal.lean"),"utf8")).replaceAll("Journal", mod);
		await writeFile(join(src,mod+".lean"),journal,{ flag: "wx" });
		const modules = [mod], exports = [...journal.matchAll(/^def (\w+)/gmu)].map(m => mod+"."+m[1]);
		if(!peer)
		{
			const scalar = await readFile("tests/fixtures/ruby-sync-io/RubyIO.lean","utf8");
			modules.push("ScalarIO"); exports.push(...[...scalar.matchAll(/^def (\w+)/gmu)].map(m => "ScalarIO."+m[1]));
			await writeFile(join(src,"ScalarIO.lean"),scalar.replaceAll("RubyIO","ScalarIO"),{ flag: "wx" });
		}
		await writeFile(join(src,"lakefile.toml"),`name="${mod.toLowerCase()}"\nversion="1.0.0"\n` + modules.map(n => `[[lean_lib]]\nname="${n}"\n`).join(""),{ flag: "wx" });
		const cfg = { schemaVersion: 1, modules, exports, nativeEffects: ["filesystem"], targets: { cpan: { module: "LeanBridge::"+mod, version: "0.001" } } };
		if(r === "reviewed")
		{
			delete cfg.exports; await copyFile(join(root,"ordinary/handoff/binding-ir.json"),join(src,"public.binding-ir.json"),constants.COPYFILE_EXCL);
		}
		await writeFile(join(src,"lean-bridge.exports.json"),canonicalJson(cfg),{ flag: "wx" });
		const out = join(dir,"handoff");
		await buildCanonicalProject({ projectRoot: src, outputRoot: out, targets: ["cpan"], environment: env })
			.catch(e => { throw new Error(e.message+"\n"+JSON.stringify(e.details),{ cause: e }); });
		assert.equal((await json(join(out,"package-set-receipt.json"))).profiles[0].id,"native-perl-io-v1");
		if(r === "reviewed") assert.deepEqual(await json(join(src,"public.binding-ir.json")),await json(join(out,"binding-ir.json")));
		t.diagnostic("built "+r+" CPAN runtime and component archives");
	}
});
