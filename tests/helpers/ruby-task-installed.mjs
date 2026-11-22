/**
 * Build and replay original RubyGems with MRI Fiber-aware native task delivery.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { constants } from "node:fs";
import { appendFile, copyFile, lstat, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { defaultRubyVersion, validateOrdinaryRubySettings } from "../../src/backends/ruby/copied-model.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { assertJsonSchema } from "./json-schema.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";

const env = { ...process.env, LEAN_NUM_THREADS: "1" };
const produce = env.LEAN_BRIDGE_RUBY_TASK_EVIDENCE, replay = env.LEAN_BRIDGE_RUBY_TASK_REPLAY;
const routes = ["ordinary", "reviewed", "stream-only"], ruby = env.LEAN_BRIDGE_RUBY ?? "ruby";
const fixtures = resolve("tests/fixtures"), fixture = join(fixtures, "ruby-task-lab");
const read = async path => JSON.parse(await readFile(path, "utf8"));
const scalars = "unit bool uint8 int8 uint16 int16 uint32 int32 uint64 int64 usize isize char string bytes nat int float32 float64".split(" ");

test("Ruby defaults are loadable without rewriting user-selected gem versions", () => {
	for(const [input, version] of [["0.0.0-local", "0.0.0"], ["1.2.3", "1.2.3"], ["1.2.3-rc.1", "1.2.3.pre.rc.1"]])
	{
		assert.equal(defaultRubyVersion(input), version); validateOrdinaryRubySettings({ version });
	}
	assert.throws(() => validateOrdinaryRubySettings({ version: "1.2.3-rc.1" }), /RubyGems version/u);
});

test("builds ordinary, reviewed and stream-only native Ruby task packages", { skip: !produce, timeout: 3_600_000 }, async () => {
	const root = resolve(produce); let ordinary;
	for(const route of routes)
	{
		const src = join(root, route, "source"), outputRoot = join(root, route, "handoff");
		const only = route === "stream-only", upstream = join(fixtures, only ? "python-lean-stream-only" : "c-lean-tasks");
		await mkdir(src, { recursive: true });
		for(const f of ["lean-toolchain", only ? "Signals.lean" : "Pulse.lean"])
			await copyFile(join(upstream, f), join(src, f), constants.COPYFILE_EXCL);
		const config = await read(join(upstream, "lean-bridge.exports.json"));
		const slug = only ? "ruby-signals" : "ruby-pulse";
		config.targets = { rubygems: { name: slug, version: "1.0.0" } };
		if(!only)
		{
			await copyFile(join(fixture, "RubyTasks.lean"), join(src, "RubyTasks.lean"), constants.COPYFILE_EXCL);
			config.modules.push("RubyTasks");
			const extra = [...scalars.map(s => "RubyTasks.rt_" + s), "RubyTasks.wide", "RubyTasks.terminal"];
			config.exports.push(...extra, "RubyTasks.direct", "RubyTasks.identity", "RubyTasks.base"); config.taskExports.push(...extra);
			config.taskIOErrors = ["RubyTasks.terminal"];
		}
		if(route === "reviewed")
		{
			delete config.exports;
			await writeFile(join(src, "public.binding-ir.json"), canonicalJson(ordinary), { flag: "wx" });
		}
		await writeFile(join(src, "lean-bridge.exports.json"), canonicalJson(config), { flag: "wx" });
		await writeFile(join(src, "lakefile.toml"), 'name="' + slug + '"\nversion="1.0.0"\n' + config.modules.map(n => '[[lean_lib]]\nname="' + n + '"\n').join(""), { flag: "wx" });
		await buildCanonicalProject({ projectRoot: src, outputRoot, targets: ["rubygems"], environment: env })
			.catch(e => { throw new Error(e.message + "\n" + JSON.stringify(e.details), { cause: e }); });
		const api = await read(join(outputRoot, "binding-ir.json"));
		if(route === "ordinary") ordinary = api;
		if(route === "reviewed") assert.deepEqual(api, ordinary);
		assert.ok(api.declarations.some(d => d.resultMode === "async-iterator"));
		assert.equal(api.declarations.some(d => d.resultMode === "promise"), !only);
	}
});

test("Ruby task signature refusals and local version selection", { skip: !env.LEAN_BRIDGE_RUBY_TASK_REFUSALS, timeout: 600_000 }, async t => {
	const work = await mkdtemp(join(tmpdir(), "ruby-task-refusals-")); t.after(() => rm(work, { recursive: true, force: true }));
	const src = join(work, "src"), out = join(work, "handoff"); await mkdir(src);
	await copyFile(join(fixtures, "c-lean-tasks/lean-toolchain"), join(src, "lean-toolchain"));
	await writeFile(join(src, "lakefile.toml"), 'name="bad"\n[[lean_lib]]\nname="Bad"\n');
	await writeFile(join(src, "Bad.lean"), "namespace Bad\ndef request (_ : Nat → IO (Array Nat)) : Task Nat := Task.pure 9\ndef wrong : Task (Except String Nat) := Task.pure (.ok 1)\ndef valid : Task UInt32 := Task.pure 37\nend Bad\n");
	const build = () => buildCanonicalProject({ projectRoot: src, outputRoot: out, targets: ["rubygems"], environment: env });
	for(const [name, error] of [["Bad.request", /must be copied scalars/u], ["Bad.wrong", /taskIOErrors requires Task/u]]) await t.test("refuses " + name, async () => {
		await writeFile(join(src, "lean-bridge.exports.json"), canonicalJson({ schemaVersion: 1, modules: ["Bad"], taskExports: [name], ...name === "Bad.wrong" ? { taskIOErrors: [name] } : {} }));
		await assert.rejects(build(), e => {
			assert.match([e.message, e.details?.stderr, e.details?.stdout].join("\n"), error); return true;
		});
		await assert.rejects(lstat(out), { code: "ENOENT" });
	});
	const selected = { schemaVersion: 1, modules: ["Bad"], taskExports: ["Bad.valid"] };
	await t.test("does not rewrite an explicit invalid version", async () => {
		await writeFile(join(src, "lean-bridge.exports.json"), canonicalJson({ ...selected, targets: { rubygems: { version: "0.0.0-local" } } }));
		await assert.rejects(build(), /RubyGems version/u);
		await assert.rejects(lstat(out), { code: "ENOENT" });
	});
	await t.test("an installed unversioned project works with plain require", async () => {
		await writeFile(join(src, "lean-bridge.exports.json"), canonicalJson(selected));
		await build();
		const { receipt } = await readVerifiedPackageSetReceipt({ receiptPath: join(out, "package-set-receipt.json") });
		const [pkg] = receipt.packages;
		assert.equal(pkg.name, "lean-bad"); assert.equal(pkg.version, "0.0.0");
		const home = join(work, "gems"), isolated = { GEM_HOME: home, GEM_PATH: home, GEMRC: "/dev/null", PATH: "/unavailable", LANG: "C.UTF-8", LEAN_NUM_THREADS: "1" };
		await run(ruby, ["--disable-gems", "-rrubygems/gem_runner", "-e", "Gem::GemRunner.new.run(ARGV)", "--", "install", "--local", "--no-document", "--ignore-dependencies", join(out, pkg.artifacts[0].path)], work, isolated);
		await run(ruby, ["-e", 'require "lean_bridge/lean_bad"; abort unless LeanBridge::LeanBad.valid.await == 37'], work, isolated);
	});
});

/**
 * Reinstall an exact handoff and run the retained caller with the producer off PATH.
 *
 * @param work - Disposable install and caller workspace.
 * @param root - Root holding immutable handoffs.
 * @param route - Ordinary, reviewed, or stream-only package.
 * @param clientRoot - Original client location (defaults to the retained handoff).
 * @param sample - Additional package-specific IR checks, retained callers and success marker.
 */
export const installRubyTaskCase = async (work, root, route, clientRoot = root, sample = null) => {
	const dir = join(root, route, "handoff"), only = route === "stream-only";
	const { receipt, result } = await readVerifiedPackageSetReceipt({ receiptPath: join(dir, "package-set-receipt.json") });
	await assertJsonSchema("package-set-receipt", receipt);
	const [pkg] = receipt.packages, [artifact] = pkg.artifacts, [profile] = receipt.profiles;
	assert.equal(receipt.packages.length, 1); assert.equal(profile.id, "native-ruby-task-v1");
	assert.equal(pkg.profile, profile.id); assert.equal(pkg.runtimeDelivery, "embedded");
	const api = await read(join(dir, "binding-ir.json")), proof = await read(join(dir, "host-export-evidence.json"));
	assert.equal(hashBindingIr(api), profile.bindingIrSha256); assert.equal(proof.sourceTreeSha256, receipt.source.treeSha256);
	assert.equal(Boolean(proof.reviewedSourceSha256), route === "reviewed");
	if(sample) sample.check(api, proof);
	else if(!only)
	{
		assert.deepEqual(api.declarations.find(d => d.name === "terminal").failure.errors, ["error:TaskIO.Error"]);
		for(const name of ["direct", "identity", "base"])
			assert.equal(api.declarations.find(d => d.name === name).resultMode, "value");
		assert.equal(api.declarations.filter(d => d.resultMode === "promise" && d.name.startsWith("rt_")).length, 19);
		assert.ok(!api.errors.some(e => e.id.includes("Callback") || e.id.includes("Python")));
	}
	const app = await mkdtemp(join(work, "client-")), stage = await mkdtemp(join(work, "install-"));
	const home = join(stage, "gems"), moved = join(app, "moved"), archive = join(stage, "input.gem");
	await copyFile(join(dir, artifact.path), archive);
	const isolated = { PATH: "/unavailable", LANG: "C.UTF-8", GEM_HOME: home, GEM_PATH: home, GEMRC: "/dev/null", TMPDIR: app, LEAN_NUM_THREADS: "1" };
	await run(ruby, ["--disable-gems", "-rrubygems/gem_runner", "-e", "Gem::GemRunner.new.run(ARGV)", "--", "install", "--local", "--no-document", "--ignore-dependencies", archive], app, isolated);
	await rename(home, moved); await rm(stage, { recursive: true });
	isolated.GEM_HOME = isolated.GEM_PATH = moved;
	const installed = join(moved, "gems", artifact.path.slice("archives/".length, -4));
	const inner = await read(join(installed, "lean-bridge/package-receipt.json"));
	assert.equal(inner.profile, profile.id); assert.equal(inner.runtimeIdentity, pkg.runtimeIdentity); assert.equal(inner.bindingIrSha256, hashBindingIr(api));
	for(const [path, identity] of Object.entries(inner.files))
	{
		const bytes = await readFile(join(installed, path)); assert.equal(bytes.length, identity.bytes); assert.equal(sha256(bytes), identity.sha256);
	}
	const files = sample?.files ?? (only ? ["stream-only.rb"] : ["consumer.rb", "scheduler.rb"]), sources = {};
	for(const file of files)
	{
		await copyFile(join(clientRoot, file), join(app, file)); sources[file] = sha256(await readFile(join(app, file)));
	}
	const output = await run(ruby, [files[0]], app, isolated, 120_000);
	assert.match(output, sample?.marker ?? (only ? /empty stream passed/u : /retirement and cleanup passed/u));
	const lib = Object.keys(inner.files).find(f => f.endsWith("/liblbc_" + pkg.name.replaceAll("-", "_") + ".so")); assert.ok(lib);
	await appendFile(join(installed, lib), Buffer.from([0]));
	await assert.rejects(run(ruby, ["-e", 'require "' + inner.requirePath + '"'], app, isolated), /Native library differs from compiled evidence/u);
	return { route, profile: profile.id, archive: artifact
		, receiptSha256: result.receiptSha256
		, bindingIrSha256: profile.bindingIrSha256
		, sourceTreeSha256: receipt.source.treeSha256
		, runtimeIdentity: pkg.runtimeIdentity, compilerSha256: proof.compilerSha256
		, reviewedSourceSha256: proof.reviewedSourceSha256
		, clients: sources, output };
};

test("installed Ruby task gems deliver to real fibers and pull streams", { skip: !produce && !replay, timeout: 3_600_000 }, async t => {
	const root = resolve(replay || produce), work = await mkdtemp(join(tmpdir(), "installed-ruby-tasks-"));
	t.after(() => rm(work, { recursive: true, force: true }));
	if(!replay) for(const file of ["consumer.rb", "scheduler.rb", "stream-only.rb"]) await copyFile(join(fixture, file), join(root, file), constants.COPYFILE_EXCL);
	const reports = [];
	for(const route of routes) await t.test(route, async () => { reports.push(await installRubyTaskCase(work, root, route)); });
	assert.equal(reports.length, routes.length, "All three independent installs must pass before recording evidence");
	assert.equal(reports[0].bindingIrSha256, reports[1].bindingIrSha256);
	assert.notEqual(reports[0].archive.sha256, reports[1].archive.sha256);
	const report = { schemaVersion: 1, routes: reports }, path = join(root, "acceptance.json");
	if(!replay) await writeFile(path, canonicalJson(report), { flag: "wx" });
	else
	{
		const bytes = await readFile(path); assert.deepEqual(report, JSON.parse(bytes));
		if(env.LEAN_BRIDGE_RUBY_TASK_EXPECTED)
		{
			const expected = await read(resolve(env.LEAN_BRIDGE_RUBY_TASK_EXPECTED));
			assert.deepEqual(reports, expected.routes); assert.equal(sha256(bytes), expected.acceptanceSha256);
		}
	}
});
