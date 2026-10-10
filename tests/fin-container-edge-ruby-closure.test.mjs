/**
 * Real RubyGems controls for archive-derived installation identities.
 * The tiny gem tests the guard; the separate Ruby observer executes compiled Lean.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rename, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, runCopied } from "./helpers/copied-fixture-install.mjs";
import { installFinContainerEdgeRuby, runFinContainerEdgeRuby, verifyFinContainerEdgeRubyEnvironment } from "./helpers/fin-container-edge-ruby-closure.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const ruby = resolve(".toolchains/ruby33/bin/ruby"), gemCommand = resolve(".toolchains/ruby33/bin/gem");
const sourceGate = process.env.LEAN_BRIDGE_FIN_CONTAINER_EDGE_SOURCE_TEST === "1";
const name = "lean_bridge_closure_probe", version = "1.0.0", fullName = `${name}-${version}-x86_64-linux`;

const buildGem = async (root, extra) => {
	await mkdir(root);
	const module = 'require "fiddle"\nmodule ClosureProbe; VALUE = "verified"; end\n';
	await saveLakeFile(root, "lib/closure_probe.rb", module);
	const files = { "lib/closure_probe.rb": { bytes: Buffer.byteLength(module), sha256: sha256(module) } };
	await saveLakeFile(root, "lean-bridge/package-receipt.json", canonicalJson({ name, version, files }));
	const entries = ["lib/closure_probe.rb", "lean-bridge/package-receipt.json"];
	if(extra)
	{
		await saveLakeFile(root, extra.path, extra.source); entries.push(extra.path);
		if(extra.recorded)
		{
			files[extra.path] = { bytes: Buffer.byteLength(extra.source), sha256: sha256(extra.source) };
			await saveLakeFile(root, "lean-bridge/package-receipt.json", canonicalJson({ name, version, files }));
		}
	}
	await saveLakeFile(root, "probe.gemspec", `Gem::Specification.new do |spec|
  spec.name = "${name}"
  spec.version = "${version}"
  spec.summary = "Explicitly synthetic guard fixture"
  spec.authors = ["Test"]
  spec.license = "MIT"
  spec.homepage = "https://example.invalid/"
  spec.platform = Gem::Platform.new("x86_64-linux")
  spec.files = ${JSON.stringify(entries)}
  spec.require_paths = ["lib"]
end
`);
	await runCopied(ruby, ["--disable-gems", "-rrubygems", "-rrubygems/package", "-e", 'Gem::Package.build(Gem::Specification.load("probe.gemspec"))'], root);
	const archive = join(root, `${fullName}.gem`);
	return { archive, archiveSha256: sha256(await readFile(archive)) };
};

test("Ruby installation refuses any existing GEM_HOME before starting an interpreter", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-ruby-closure-existing-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	await mkdir(join(root, "gems"));
	await assert.rejects(installFinContainerEdgeRuby({ root, command: "/unavailable/ruby" }), /refuse any pre-existing/u);
	await rm(join(root, "gems"), { recursive: true });
	await symlink("missing", join(root, "gems"));
	await assert.rejects(installFinContainerEdgeRuby({ root, command: "/unavailable/ruby" }), /refuse any pre-existing/u);
});

test("RubyGems identity and startup reject changed specs, extra load paths, caches and plugins before execution", { skip: !sourceGate }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-ruby-closure-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const prepared = join(root, "prepared"), original = await buildGem(prepared);
	const consumer = join(root, "consumer"), source = 'require "closure_probe"\nraise unless ClosureProbe::VALUE == "verified"\nputs "ruby-closure-ok:1"\n';
	const installed = await installCopiedConsumer({ profile: "ruby", consumer
		, handoff: prepared
		, packages: [{ role: "component", name, version, artifacts: [{ path: `${fullName}.gem`, sha256: original.archiveSha256 }] }]
		, environment: { LEAN_BRIDGE_RUBY: ruby, LEAN_BRIDGE_GEM: gemCommand }
		, fixture: { source: () => source, success: "ruby-closure-ok", expectedChecks: 1, installRuby: installFinContainerEdgeRuby } });
	assert.equal(installed.checks, 1);
	let context = installed.rubyEnvironment, cwd = join(consumer, "ruby");
	const identity = await verifyFinContainerEdgeRubyEnvironment(context);
	assert.equal(context.fullName, fullName);
	const call = () => runFinContainerEdgeRuby(context, ["consumer.rb"], cwd);
	assert.equal((await call()).stdout, "ruby-closure-ok:1\n");
	const marker = join(root, "executed"), injection = `File.write(${JSON.stringify(marker)}, "executed")\n`;
	const spec = `specifications/${fullName}.gemspec`, specBytes = await readFile(join(context.gems, spec));
	await saveLakeFile(context.gems, spec, Buffer.concat([Buffer.from(injection), specBytes]));
	await assert.rejects(call(), /Ruby environment drift: specifications/u);
	await assert.rejects(access(marker), { code: "ENOENT" });
	const unguarded = args => runCopied(ruby, args, cwd, { ...copiedCleanEnvironment, GEM_HOME: context.gems, GEM_PATH: context.gems });
	await unguarded(["-e", `Gem::Specification.find_by_name("${name}").full_gem_path`]);
	assert.equal(await readFile(marker, "utf8"), "executed");
	await rm(marker); await saveLakeFile(context.gems, spec, specBytes);
	const shadow = `gems/${fullName}/lib/fiddle.rb`;
	await saveLakeFile(context.gems, shadow, injection);
	await assert.rejects(call(), /unrecorded or missing Ruby environment file/u);
	await assert.rejects(access(marker), { code: "ENOENT" });
	await unguarded(["consumer.rb"]);
	assert.equal(await readFile(marker, "utf8"), "executed");
	await rm(marker); await rm(join(context.gems, shadow));
	for(const path of ["plugins/injected_plugin.rb", "specifications/extra.gemspec", `gems/${fullName}/lib/rubygems_plugin.rb`])
	{
		await saveLakeFile(context.gems, path, injection);
		await assert.rejects(call(), /unrecorded or missing Ruby environment file/u);
		await assert.rejects(access(marker), { code: "ENOENT" });
		await rm(join(context.gems, path));
	}
	for(const path of [`cache/${fullName}.gem`, `gems/${fullName}/lib/closure_probe.rb`])
	{
		const bytes = await readFile(join(context.gems, path));
		await saveLakeFile(context.gems, path, Buffer.concat([bytes, Buffer.from(injection)]));
		await assert.rejects(call(), /Ruby environment drift/u);
		await assert.rejects(access(marker), { code: "ENOENT" });
		await saveLakeFile(context.gems, path, bytes);
	}
	await symlink("missing", join(context.gems, "injected-link"));
	await assert.rejects(call(), /unsupported native artifact/u); await rm(join(context.gems, "injected-link"));
	await assert.rejects(runFinContainerEdgeRuby(context, ["-e", `File.write(${JSON.stringify(join(context.gems, "late.rb"))}, "late")`], cwd), /unrecorded or missing Ruby environment file/u);
	await rm(join(context.gems, "late.rb"));
	const relocated = `${cwd}-relocated`; await rename(cwd, relocated);
	await assert.rejects(access(cwd), { code: "ENOENT" });
	cwd = relocated; context = { ...context, gems: join(relocated, "gems") };
	assert.deepEqual(await verifyFinContainerEdgeRubyEnvironment(context), identity);
	assert.equal((await call()).stdout, "ruby-closure-ok:1\n");
	await assert.rejects(runFinContainerEdgeRuby(context, ["-I", "foreign"], cwd));
	await assert.rejects(runFinContainerEdgeRuby(context, ["-e", "exit"], context.gems), /outside GEM_HOME/u);
	const linked = join(root, "linked"); await symlink(context.gems, linked);
	await assert.rejects(verifyFinContainerEdgeRubyEnvironment({ ...context, gems: linked }), /symlink/u);
});

test("Ruby archives with unrecorded executable inputs fail before installation or package startup", { skip: !sourceGate }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-ruby-archive-closure-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const marker = join(root, "executed"), injection = `File.write(${JSON.stringify(marker)}, "executed")\n`;
	const original = await buildGem(join(root, "prepared"), { path: "lib/fiddle.rb", source: injection });
	const consumer = join(root, "consumer"); await mkdir(consumer);
	await assert.rejects(installFinContainerEdgeRuby({ ...original, root: consumer, command: ruby, gemCommand }), /gem payload must equal receipt/u);
	await assert.rejects(access(marker), { code: "ENOENT" });
	await assert.rejects(access(join(consumer, "gems", "gems", fullName)), { code: "ENOENT" });
	const plugin = await buildGem(join(root, "plugin"), { path: "lib/rubygems_plugin.rb", source: injection, recorded: true });
	const pluginConsumer = join(root, "plugin-consumer"); await mkdir(pluginConsumer);
	await assert.rejects(installFinContainerEdgeRuby({ ...plugin, root: pluginConsumer, command: ruby, gemCommand }), /unexpected gem plugin input/u);
	await assert.rejects(access(marker), { code: "ENOENT" });
	await assert.rejects(access(join(pluginConsumer, "gems", "gems", fullName)), { code: "ENOENT" });
	await assert.rejects(installFinContainerEdgeRuby({ ...original, root, command: ruby, gemCommand, archiveSha256: "0".repeat(64) }), /original Ruby gem drift/u);
});
