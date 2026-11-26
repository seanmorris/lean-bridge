/**
 * Install and run ordinary and reviewed synchronous Ruby IO gems.
 *
 * @file
 */
import assert from "node:assert/strict";
import { constants as fsConstants } from "node:fs";
import test from "node:test";
import { appendFile, copyFile, lstat, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { generateSyncWire } from "../../src/backends/c/sync-wire.mjs";
import { generateRubySyncSources } from "../../src/backends/ruby/sync-io.mjs";
import { packageOrdinaryRuby } from "../../src/release/native-rubygems.mjs";
import { validatePackageSetReceipt, readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { assertJsonSchema } from "./json-schema.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";

const fixture = resolve("tests/fixtures/ruby-sync-io"), journal = resolve("tests/fixtures/native-sync-io");
const scalars = "unit bool uint8 int8 uint16 int16 uint32 int32 uint64 int64 usize isize float32 float64 char string bytes nat int".split(" ");
const routes = ["ordinary", "reviewed"], env = { ...process.env, LEAN_NUM_THREADS: "1" };
const ruby = env.LEAN_BRIDGE_RUBY ?? "ruby", replay = env.LEAN_BRIDGE_RUBY_SYNC_REPLAY;
const read = async p => JSON.parse(await readFile(p, "utf8"));
const active = env.LEAN_BRIDGE_RUBY_SYNC_TEST === "1";
test("the default Ruby IO wire rejects asynchronous functions and undeclared resources", () => {
	const p = { kind: "primitive", name: "uint32" }, e = { name: "read", declaration: "A.read", parameters: [], effect: "BaseIO", result: p };
	assert.deepEqual(generateSyncWire("lbc_a", [e]).methods[0].result, "uint32");
	for(const extra of [{ delivery: "task" }, { delivery: "async-iterator" }, { taskIO: true }, { result: { kind: "named", id: "lean:Badge" } }])
		assert.throws(() => generateSyncWire("lbc_a", [{ ...e, ...extra }]), /synchronous function|copied primitive/u);
});
test("only a real callback-taking Ruby task exposes block or callable delivery", async () => {
	const scalar = { kind: "primitive", name: "uint32" }, f = { kind: "io-callback", argument: scalar, reply: scalar };
	const e = { name: "once", declaration: "A.once", delivery: "task", effect: "BaseIO", result: scalar, parameters: [{ type: scalar }, { type: f }] };
	const make = entries => generateSyncWire("lbc_a", entries, { tasks: true });
	assert.throws(() => make([{ ...e, delivery: null }]), /require a task/u);
	assert.throws(() => make([{ ...e, delivery: "async-iterator" }]), /require a task/u);
	assert.throws(() => make([{ ...e, parameters: [{ type: { ...f, reply: { kind: "named", id: "lean:Badge" } } }] }]), /copied scalars/u);
	const wire = make([e, { ...e, name: "before", parameters: [...e.parameters].reverse() }]);
	assert.deepEqual(wire.methods.map(m => m.callbacks), [[[1, "uint32", "uint32"]], [[0, "uint32", "uint32"]]]);
	const files = (await generateRubySyncSources({ name: "sample", wire })).files, api = files["lib/lean_bridge/sample.rb"];
	assert.match(api, /def self\.once\(v0, v1 = nil, &block\)/u);
	assert.match(api, /def self\.before\(v0, v1\)/u);
	assert.doesNotMatch(api, /Fiddle|lbwire_/u);
	assert.ok(files["lib/lean_bridge/sample/retained_task.rb"]);
	const plain = make([{ ...e, parameters: [] }]);
	assert.ok(!(await generateRubySyncSources({ name: "sample", wire: plain })).files["lib/lean_bridge/sample/retained_task.rb"]);
	await assert.rejects(generateRubySyncSources({ name: "retained-callback", wire }), /Reserved Ruby task namespace/u);
});
test("Ruby immediate iterators expose no scheduler entrypoints", async () => {
	const entry = { name: "sequence", declaration: "Dials.sequence", delivery: "iterator", effect: "IO",
		parameters: [], result: { kind: "primitive", name: "unit" }, stepIO: true, protocol: { next: "Dials.pull" } };
	const wire = generateSyncWire("lbc_dials", [entry]), method = wire.methods[0];
	assert.deepEqual(Object.keys(method.names).sort(), ["close", "next", "open"]);
	assert.equal(method.stepDeclaration, "Dials.pull"); assert.equal(wire.wait, undefined);
	assert.doesNotMatch(wire.source, /_poll\(|_take\(|_wait_open\(/u);
	const {files} = await generateRubySyncSources({name: "dials", wire});
	assert.ok(files["lib/lean_bridge/dials/sync_iterator.rb"]);
	assert.ok(!files["lib/lean_bridge/dials/task_runtime.rb"]);
	assert.doesNotMatch(files["lib/lean_bridge/dials.rb"], /Fiddle|lbwire_|TaskRuntime/u);
	await assert.rejects(generateRubySyncSources({name: "cursor", wire}), /distinct public names/u);
	assert.throws(() => generateSyncWire("lbc_dials", [entry], {tasks: true}), /authenticated synchronous/u);
	// The shared wire also serves browser iterators. Wasm32 changes the
	// scalar representation, not the iterator into a scheduler endpoint.
	const browser = generateSyncWire("lbc_dials", [entry], {wasm32: true});
	assert.deepEqual(Object.keys(browser.methods[0].names).sort(), ["close", "next", "open"]);
	assert.doesNotMatch(browser.source, /_poll\(|_take\(|_wait_open\(/u);
});
test("Ruby IO packages include their runtime in the CLI and keep native details private", async () => {
	for(const manifest of ["package.json", "config/cli-package.v1.json", "nix/perl-engine-source-boundary.json"])
	{
		const m = await read(manifest), files = m.files ?? m.includedFiles;
		for(const path of ["src/backends/c/sync-wire.mjs"
			, "src/backends/c/task-wire.mjs"
			, "src/backends/ruby/sync-io.mjs"
			, "src/backends/ruby/sync-wire.rb"
			, "src/backends/ruby/sync-iterator.rb"
			, "src/backends/ruby/task-runtime.rb"
			, "src/backends/ruby/retained-task.rb"
			, "src/backends/ruby/resource-lease.rb"
			, "src/release/ruby-sync-package.mjs"])
			assert.ok(files.includes(path), manifest + ": " + path);
	}
	const entry = { name: "dup", declaration: "A.dup", parameters: [], effect: "BaseIO", result: { kind: "primitive", name: "unit" } };
	const make = (name, entries) => generateRubySyncSources({ name, wire: generateSyncWire("lbc_a", entries) });
	const result = await make("sample", [entry]), publicAPI = result.files["lib/lean_bridge/sample.rb"];
	assert.ok(!Object.keys(result.files).some(p => p.endsWith("/task_runtime.rb")));
	assert.ok(!Object.keys(result.files).some(p => p.endsWith("/retained_task.rb")));
	assert.ok(!Object.keys(result.files).some(p => p.endsWith("/native_resource_lease_v1.rb")));
	assert.match(publicAPI, /def self\.dup_\(\)/u); assert.doesNotMatch(publicAPI, /Fiddle|lbwire_|Future|Promise/u);
	assert.match(result.files["lib/lean_bridge/sample/native.rb"], /require_relative "sync_wire"/u);
	assert.match(result.files["lib/lean_bridge/sample/sync_wire.rb"], /module LeanBridge::Sample/u);
	await assert.rejects(make("sample", [entry, { ...entry, name: "dup_" }]), /collides/u);
	await assert.rejects(make("native-sync-wire-v1", [entry]), /reserved/u);
});
test("Ruby lease wire requires a matching elaborated nominal and does not hide leases inside copied sums", async () => {
	const hash = "1".repeat(64), ledgerId = "2".repeat(64);
	const definition = name => ({ kind: "resource", id: "lean:" + name, host: null
		, resource: { kindId: "resource:" + name + "/" + hash }
		, source: { declaration: name, extensions: { "lean-bridge.dev/resource-identity": hash } } });
	const kind = definition("Shared.Ticket"), type = { kind: "named", id: kind.id };
	const entry = { declaration: "Desk.keep", name: "keep", effect: "IO", parameters: [{ type }], result: type };
	const make = (entries, resources) => generateSyncWire("lbc_desk", entries, { resources });
	const wire = make([entry], [kind]); assert.equal(wire.leases[0].hash, hash);
	assert.throws(() => make([entry], []), /copied primitive/u);
	assert.throws(() => make([entry], [{ ...kind, resource: { kindId: "resource:forged" } }]), /checked Lean heap resource/u);
	assert.throws(() => make([{ ...entry, result: { kind: "apply", constructor: "result", arguments: [type, type] } }], [kind]), /copied primitive/u);
	const generated = await generateRubySyncSources({ name: "desk", wire, ledgerId });
	assert.ok(generated.files["lib/lean_bridge/native_resource_lease_v1.rb"]);
	assert.doesNotMatch(generated.files["lib/lean_bridge/desk.rb"], /Fiddle|lbwire_|_private/u);
	await assert.rejects(generateRubySyncSources({ name: "desk", wire, ledgerId: "absent" }), /ledger/u);
	const bad = definition("Shared.ClosedResource"), field = { kind: "named", id: bad.id };
	await assert.rejects(generateRubySyncSources({ name: "desk", ledgerId, wire: make([{ ...entry, parameters: [], result: field }], [bad]) }), /reserved resource/u);
});
const build = async (root, route, reviewed) => {
	const src = join(root, route, "source"), outputRoot = join(root, route, "handoff");
	await mkdir(src, { recursive: true });
	for(const path of ["Journal.lean", "lean-toolchain"]) await copyFile(join(journal, path), join(src, path));
	await copyFile(join(fixture, "RubyIO.lean"), join(src, "RubyIO.lean"));
	await writeFile(join(src, "lakefile.toml"), 'name="ruby-io-lab"\nversion="1.0.0"\n[[lean_lib]]\nname="Journal"\n[[lean_lib]]\nname="RubyIO"\n');
	const exports = [...(await read(join(journal, "lean-bridge.exports.json"))).exports, ...scalars.map(n => "RubyIO.rt_" + n), "RubyIO.nested"];
	const config = { schemaVersion: 1, modules: ["Journal", "RubyIO"]
		, nativeEffects: ["filesystem"]
		, targets: { rubygems: { name: "journal-ruby", version: "1.0.0" } }
		, ...reviewed ? {} : { exports } };
	if(reviewed) await writeFile(join(src, "journal.binding-ir.json"), canonicalJson(reviewed));
	await writeFile(join(src, "lean-bridge.exports.json"), canonicalJson(config));
	await buildCanonicalProject({ projectRoot: src, outputRoot, targets: ["rubygems"], environment: env })
		.catch(e => { throw new Error(e.message + "\n" + JSON.stringify(e.details), { cause: e }); });
};
test("a Ruby release refuses ungranted native IO before it emits a gem", { skip: !active, timeout: 600_000 }, async t => {
	const work = await mkdtemp(join(tmpdir(), "ruby-io-policy-")); t.after(() => rm(work, { recursive: true, force: true }));
	const src = join(work, "source"), outputRoot = join(work, "release"); await mkdir(src);
	for(const file of ["Journal.lean", "lean-toolchain", "lakefile.toml"]) await copyFile(join(journal, file), join(src, file));
	const config = { schemaVersion: 1, modules: ["Journal"], exports: ["Journal.store"], nativeEffects: [] };
	const configPath = join(src, "lean-bridge.exports.json");
	await writeFile(configPath, canonicalJson({ ...config, resources: [] }));
	await assert.rejects(buildCanonicalProject({ projectRoot: src, outputRoot, targets: ["rubygems"], environment: env }), e => {
		assert.match([e.message, e.details?.stdout, e.details?.stderr].join("\n"), /requires nativeEffects "filesystem"/u); return true;
	});
	await assert.rejects(lstat(outputRoot), { code: "ENOENT" });
	await writeFile(configPath, canonicalJson({ ...config, nativeEffects: ["filesystem"], resources: ["Journal.Badge"] }));
	await assert.rejects(buildCanonicalProject({ projectRoot: src, outputRoot, targets: ["rubygems"], environment: env }), e => {
		assert.match([e.message, e.details?.stdout, e.details?.stderr].join("\n"), /unknown (constant|declaration).*Journal\.Badge/iu); return true;
	});
	await assert.rejects(lstat(outputRoot), { code: "ENOENT" });
});
const install = async (work, root, route, review) => {
	const dir = join(root, route, "handoff"), { receipt, result } = await readVerifiedPackageSetReceipt({ receiptPath: join(dir, "package-set-receipt.json") });
	await assertJsonSchema("package-set-receipt", receipt);
	const [pkg] = receipt.packages, [profile] = receipt.profiles; assert.equal(receipt.packages.length, 1);
	assert.equal(profile.id, "native-ruby-io-v1"); assert.equal(pkg.target, "rubygems"); assert.equal(pkg.runtimeDelivery, "embedded");
	const invalid = structuredClone(receipt); invalid.packages[0].runtimeDelivery = "dependency"; assert.throws(() => validatePackageSetReceipt(invalid));
	const api = await read(join(dir, "binding-ir.json")), proof = await read(join(dir, "host-export-evidence.json"));
	assert.equal(profile.bindingIrSha256, hashBindingIr(api)); assert.equal(proof.sourceTreeSha256, receipt.source.treeSha256);
	assert.equal(proof.reviewedSourceSha256, review ? sha256(canonicalJson(review)) : null); if(review) assert.deepEqual(api, review);
	assert.equal(api.declarations.length, scalars.length + 7);
	assert.ok(api.declarations.every(d => d.resultMode === "value" && !d.effects.includes("async")));
	assert.deepEqual(api.capabilities.map(c => c.id), ["capability:native.filesystem"]);
	assert.deepEqual(api.declarations.find(d => d.name === "nested").failure.errors, ["error:EIO.RubyIO.nested"]);
	const stage = await mkdtemp(join(work, "install-")), app = await mkdtemp(join(work, "client-"));
	const gem = pkg.artifacts[0], archive = join(stage, "package.gem"), dest = join(stage, "gems"), moved = join(app, "gems");
	await copyFile(join(dir, gem.path), archive);
	const installEnv = { ...env, GEM_PATH: dest, GEM_HOME: dest, GEMRC: "/dev/null" };
	for(const key of ["RUBYOPT", "RUBYLIB", "RUBYGEMS_GEMDEPS", "BUNDLE_GEMFILE"]) delete installEnv[key];
	await run(ruby, ["--disable-gems", "-rrubygems/gem_runner", "-e", "Gem::GemRunner.new.run(ARGV)", "--", "install", "--local", "--no-document", "--ignore-dependencies", "--install-dir", dest, archive], stage, installEnv);
	await rename(dest, moved); await rm(stage, { recursive: true });
	const gemRoot = join(moved, "gems", gem.path.slice("archives/".length, -4));
	const inner = await read(join(gemRoot, "lean-bridge/package-receipt.json"));
	assert.equal(inner.profile, profile.id); assert.equal(inner.bindingIrSha256, profile.bindingIrSha256);
	assert.equal(inner.runtimeIdentity, pkg.runtimeIdentity); assert.deepEqual(await read(join(gemRoot, "lean-bridge/binding-ir.json")), api);
	for(const [path, identity] of Object.entries(inner.files))
	{
		const b = await readFile(join(gemRoot, path)); assert.equal(b.length, identity.bytes); assert.equal(sha256(b), identity.sha256);
	}
	const client = join(app, "consumer.rb"); await copyFile(join(root, "consumer.rb"), client);
	await writeFile(join(app, "state"), "open");
	const isolated = { PATH: "/unavailable", LANG: "C.UTF-8", GEM_PATH: moved, GEM_HOME: moved, TMPDIR: app, LEAN_NUM_THREADS: "1" };
	const other = join(app, "other-gem", "lib"); await mkdir(join(other, "lean_bridge"), { recursive: true });
	await writeFile(join(other, "lean_bridge/native_sync_wire_v1.rb"), 'raise "Used another gem converter"\n');
	const output = await run(ruby, ["-I", other, client], app, isolated, 120_000);
	assert.match(output, /19 primitive round trips.*cleanup passed/u); assert.equal(await readFile(join(app, "state"), "utf8"), "closed");
	// Change only this disposable installed copy. A fresh process must refuse
	// the native object by its authenticated bytes, before invoking a method.
	const lib = Object.keys(inner.files).find(f => f.endsWith("/liblbc_journal_ruby.so")); assert.ok(lib);
	await appendFile(join(gemRoot, lib), Buffer.from([0]));
	await assert.rejects(run(ruby, ["-e", 'require "lean_bridge/journal_ruby"'], app, isolated), /Native library differs from compiled evidence/u);
	const report = { route, profile: profile.id, archive: gem
		, receiptSha256: result.receiptSha256
		, bindingIrSha256: profile.bindingIrSha256
		, sourceTreeSha256: receipt.source.treeSha256
		, runtimeIdentity: pkg.runtimeIdentity, compilerSha256: proof.compilerSha256
		, consumerSha256: sha256(await readFile(client))
		, reviewedSourceSha256: proof.reviewedSourceSha256 };
	return { api, report };
};
test("installed RubyGems preserve synchronous IO, typed errors and scalar values", {
	skip: !replay && !active, timeout: 3_600_000
}, async t => {
	const work = await mkdtemp(join(tmpdir(), "installed-ruby-io-")); t.after(() => rm(work, { recursive: true, force: true }));
	const root = resolve(replay ?? env.LEAN_BRIDGE_RUBY_SYNC_EVIDENCE ?? join(work, "releases")), reports = [];
	if(!replay)
	{
		await mkdir(root, { recursive: true });
		await copyFile(join(fixture, "consumer.rb"), join(root, "consumer.rb"));
	}
	let ordinary;
	for(const route of routes)
	{
		if(!replay) await build(root, route, ordinary);
		const { api, report } = await install(work, root, route, ordinary); ordinary ??= api; reports.push(report);
	}
	const report = { schemaVersion: 1, routes: reports }, path = join(root, "acceptance.json");
	if(!replay) await writeFile(path, canonicalJson(report), { flag: "wx" });
	else
	{
		const bytes = await readFile(path); assert.deepEqual(report, JSON.parse(bytes));
		if(env.LEAN_BRIDGE_RUBY_SYNC_EXPECTED)
		{
			const expected = await read(resolve(env.LEAN_BRIDGE_RUBY_SYNC_EXPECTED)); assert.deepEqual(reports, expected.routes); assert.equal(sha256(bytes), expected.acceptanceSha256);
		}
	}
});

test("the pure Ruby-only route still installs and repacks byte-for-byte", { skip: !active, timeout: 900_000 }, async t => {
	// This route must not require the optional C target or its separate GMP build.
	const work = await mkdtemp(join(tmpdir(), "ruby-pure-regression-"));
	t.after(() => rm(work, { recursive: true, force: true }));
	const src = join(work, "source"), outputRoot = join(work, "release"), dest = join(work, "gems");
	await mkdir(src);
	await copyFile(join(journal, "lean-toolchain"), join(src, "lean-toolchain"));
	await writeFile(join(src, "lakefile.toml"), 'name="orchard"\nversion="1.0.0"\n[[lean_lib]]\nname="Orchard"\n');
	await writeFile(join(src, "Orchard.lean"), "namespace Orchard\ndef integer (x : Int) : Int := x\ndef labels (xs : Array String) : Array String := xs\nend Orchard\n");
	const settings = { name: "orchard-ruby", version: "1.0.0" };
	await writeFile(join(src, "lean-bridge.exports.json"), canonicalJson({ schemaVersion: 1, modules: ["Orchard"], exports: ["Orchard.integer", "Orchard.labels"], targets: { rubygems: settings } }));
	const built = await buildCanonicalProject({ projectRoot: src, outputRoot, targets: ["rubygems"], environment: env })
		.catch(e => { throw new Error(e.message + "\n" + JSON.stringify(e.details), { cause: e }); });
	const [pkg] = built.packages;
	assert.equal(built.packages.length, 1); assert.equal(pkg.name, settings.name);
	const inner = await read(join(outputRoot, "packages/rubygems/package/lean-bridge/package-receipt.json"));
	assert.equal(inner.kind, "lean-bridge-ordinary-rubygems-package");
	const repeated = await packageOrdinaryRuby({ working: join(work, "repack")
		, nativeRoot: join(outputRoot, "native/component")
		, runtimeRoot: join(outputRoot, "native/runtime")
		, adapterRoot: join(outputRoot, "native/c-binding")
		, leanPrefix: env.LEAN_BRIDGE_LEAN_PREFIX
		, glibcMinimumVersion: inner.glibcMinimumVersion
		, settings, environment: env });
	assert.equal(repeated.packages[0].sha256, pkg.sha256);
	await rename(src, join(work, "source-hidden"));
	const isolated = { PATH: "/unavailable", GEM_PATH: dest, GEM_HOME: dest, GEMRC: "/dev/null" };
	const archive = join(outputRoot, "archives", pkg.archive);
	await run(ruby, ["-rrubygems/gem_runner", "-e", "Gem::GemRunner.new.run(ARGV)", "--", "install", archive, "--local", "--no-document"], work, isolated);
	await rename(outputRoot, join(work, "release-hidden"));
	const client = join(work, "consumer.rb");
	await writeFile(client, `# encoding: UTF-8
require "lean_bridge/orchard"
api = LeanBridge::Orchard
x = -(1 << 4096)
labels = ["a\\0λ", ""]
raise unless api.integer(x) == x && api.labels(labels) == labels
puts "pure Ruby installed"
`);
	assert.equal(await run(ruby, [client], work, isolated), "pure Ruby installed");
	if(env.LEAN_BRIDGE_RUBY_SYNC_EVIDENCE && !replay)
	{
		const evidenceRoot = resolve(env.LEAN_BRIDGE_RUBY_SYNC_EVIDENCE);
		await mkdir(evidenceRoot, { recursive: true });
		await copyFile(join(work, "release-hidden", "archives", pkg.archive)
			, join(evidenceRoot, pkg.archive), fsConstants.COPYFILE_EXCL);
	}
	t.diagnostic("Repacked original pure gem: " + pkg.sha256);
});

const mixRoot = replay || (active && env.LEAN_BRIDGE_RUBY_SYNC_EVIDENCE);
test("installed pure and IO gems share one runtime in both load orders", { skip: !mixRoot, timeout: 600_000 }, async t => {
	const root = resolve(mixRoot), work = await mkdtemp(join(tmpdir(), "ruby-mixed-runtime-"));
	t.after(() => rm(work, { recursive: true, force: true }));
	const dir = join(root, "ordinary/handoff"), { receipt } = await readVerifiedPackageSetReceipt({ receiptPath: join(dir, "package-set-receipt.json") });
	const [pkg] = receipt.packages, [io] = pkg.artifacts;
	const archive = "orchard-ruby-1.0.0-x86_64-linux.gem", pure = join(root, archive), bytes = await readFile(pure);
	const home = join(work, "gems"), isolated = { GEM_PATH: home, GEM_HOME: home, PATH: "/unavailable", GEMRC: "/dev/null", LANG: "C.UTF-8" };
	await run(ruby, ["--disable-gems", "-rrubygems/gem_runner", "-e", "Gem::GemRunner.new.run(ARGV)", "--", "install", "--local", "--no-document", "--ignore-dependencies", pure, join(dir, io.path)], work, isolated);
	const client = join(root, "compose.rb");
	if(!replay) await copyFile(join(fixture, "compose.rb"), client, fsConstants.COPYFILE_EXCL);
	const installedClient = join(work, "compose.rb"); await copyFile(client, installedClient);
	const orders = [];
	for(const order of [["orchard", "journal_ruby"], ["journal_ruby", "orchard"]])
	{
		const stats = JSON.parse(await run(ruby, [installedClient, ...order], work, isolated));
		assert.deepEqual(stats, { order, runtimeInitializations: 1, componentInitializations: 2, attached: 2, liveIdentities: 0 });
		orders.push(stats);
	}
	const result = { pureGem: { path: archive, bytes: bytes.length, sha256: sha256(bytes) }
		, ioGemSha256: io.sha256, runtimeIdentity: pkg.runtimeIdentity
		, consumerSha256: sha256(await readFile(client)), orders };
	const path = join(root, "composition.json");
	if(!replay) await writeFile(path, canonicalJson(result), { flag: "wx" });
	else
	{
		const observation = await readFile(path); assert.deepEqual(result, JSON.parse(observation));
		if(env.LEAN_BRIDGE_RUBY_SYNC_EXPECTED)
		{
			const expected = await read(resolve(env.LEAN_BRIDGE_RUBY_SYNC_EXPECTED));
			assert.deepEqual(result, expected.coInstallation); assert.equal(sha256(observation), expected.coInstallationSha256);
		}
	}
});
