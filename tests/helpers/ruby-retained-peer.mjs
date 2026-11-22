/**
 * Cross-component callback reentry, revocation and one shared installed Ruby runtime.
 *
 * @file
 */
import assert from "node:assert/strict";
import { constants } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";

const env = { ...process.env, LEAN_NUM_THREADS: "1" }, ruby = env.LEAN_BRIDGE_RUBY ?? "ruby";
const build = env.LEAN_BRIDGE_RUBY_CALLBACK_BUILD, capture = env.LEAN_BRIDGE_RUBY_CALLBACK_CAPTURE, replay = env.LEAN_BRIDGE_RUBY_CALLBACK_REPLAY;
const base = resolve("tests/fixtures/ruby-retained-tasks"), signals = resolve("tests/fixtures/python-lean-stream-only");
const read = async f => JSON.parse(await readFile(f, "utf8"));
test("builds an independent mixed Ruby callback and cursor peer", { skip: !build, timeout: 600_000 }, async () => {
	const dir = join(resolve(build), "peer"), src = join(dir, "source"); await mkdir(src, { recursive: true });
	for(const f of ["Signals.lean", "lean-toolchain"]) await copyFile(join(signals, f), join(src, f), constants.COPYFILE_EXCL);
	await copyFile(join(base, "Relay.lean"), join(src, "Relay.lean"), constants.COPYFILE_EXCL);
	const config = await read(join(signals, "lean-bridge.exports.json"));
	config.modules.push("Relay"); config.taskExports = ["Relay.run", "Relay.direct"]; config.taskIOErrors = ["Relay.run"];
	config.targets = { rubygems: { name: "ruby-relay", version: "1.0.0" } };
	await writeFile(join(src, "lean-bridge.exports.json"), canonicalJson(config), { flag: "wx" });
	await writeFile(join(src, "lakefile.toml"), 'name="ruby-relay"\nversion="1.0.0"\n[[lean_lib]]\nname="Relay"\n[[lean_lib]]\nname="Signals"\n', { flag: "wx" });
	await buildCanonicalProject({ projectRoot: src, outputRoot: join(dir, "handoff"), targets: ["rubygems"], environment: env })
		.catch(e => { throw new Error(e.message + "\n" + JSON.stringify(e.details), { cause: e }); });
});

test("independently installed Ruby tasks reenter across components in either load order", { skip: !capture && !replay, timeout: 900_000 }, async t => {
	const root = resolve(replay ?? capture), work = await mkdtemp(join(tmpdir(), "ruby-retained-peer-"));
	t.after(() => rm(work, { recursive: true, force: true }));
	const caller = join(work, "compose.rb");
	await copyFile(join(replay ? root : base, "compose.rb"), caller, constants.COPYFILE_EXCL);
	const gem = async route => {
		const dir = join(root, route, "handoff");
		const { receipt, result } = await readVerifiedPackageSetReceipt({ receiptPath: join(dir, "package-set-receipt.json") });
		const [pkg] = receipt.packages, [archive] = pkg.artifacts;
		assert.equal(pkg.profile, "native-ruby-task-v1"); assert.equal(pkg.runtimeDelivery, "embedded");
		return { receiptSha256: result.receiptSha256
			, bindingIrSha256: receipt.profiles[0].bindingIrSha256
			, runtimeIdentity: pkg.runtimeIdentity
			, sourceTreeSha256: receipt.source.treeSha256, archive };
	};
	const peer = await gem("peer"), reports = [];
	for(const route of ["ordinary", "reviewed"])
	{
		const primary = await gem(route);
		assert.equal(primary.runtimeIdentity, peer.runtimeIdentity); assert.notEqual(primary.sourceTreeSha256, peer.sourceTreeSha256);
		const home = join(work, "installed-" + route), moved = join(work, "moved-" + route);
		const isolated = { PATH: "/unavailable", LANG: "C.UTF-8", GEMRC: "/dev/null", GEM_HOME: home, GEM_PATH: home, LEAN_NUM_THREADS: "1", TMPDIR: work };
		const install = ["--disable-gems", "-rrubygems/gem_runner", "-e"
			, "Gem::GemRunner.new.run(ARGV)", "--", "install", "--local"
			, "--no-document", "--ignore-dependencies"
			, join(root, route, "handoff", primary.archive.path)
			, join(root, "peer/handoff", peer.archive.path)];
		await run(ruby, install, work, isolated);
		await rename(home, moved); isolated.GEM_HOME = isolated.GEM_PATH = moved;
		const orders = [];
		for(const order of [["ruby_feedback", "ruby_relay"], ["ruby_relay", "ruby_feedback"]])
		{
			const stats = JSON.parse(await run(ruby, [caller, ...order], work, isolated, 120_000));
			assert.deepEqual(stats, { order, runtimeInitializations: 1, componentInitializations: 2, attached: 2, liveIdentities: 0 });
			orders.push(stats);
		}
		reports.push({ route, primaryReceiptSha256: primary.receiptSha256, primaryArchiveSha256: primary.archive.sha256, orders });
	}
	const result = { schemaVersion: 1, peer, reports, clientSha256: sha256(await readFile(caller)) }, path = join(root, "composition.json");
	if(!replay)
	{
		await copyFile(caller, join(root, "compose.rb"), constants.COPYFILE_EXCL);
		await writeFile(path, canonicalJson(result), { flag: "wx" });
	}
	else
	{
		const bytes = await readFile(path); assert.deepEqual(result, JSON.parse(bytes));
		if(env.LEAN_BRIDGE_RUBY_CALLBACK_EXPECTED)
		{
			const expected = await read(resolve(env.LEAN_BRIDGE_RUBY_CALLBACK_EXPECTED));
			assert.deepEqual(result, expected.coInstallation); assert.equal(sha256(bytes), expected.coInstallationSha256);
		}
	}
});
