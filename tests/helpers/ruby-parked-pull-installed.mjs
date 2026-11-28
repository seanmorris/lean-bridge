/** @file Interrupt a waiting MRI Fiber against the pinned RubyPulse and RubySignals platform gems. */
import assert from "node:assert/strict";
import {copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {basename, join, resolve} from "node:path";
import test from "node:test";
import {canonicalJson, sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";

const original = process.env.LEAN_BRIDGE_RUBY_PARKED_ORIGINAL;
const json = async path => JSON.parse(await readFile(path, "utf8"));
test("interrupting a parked Ruby fiber finalizes the Lean cursor before worker release", {skip: !original, timeout: 900_000}, async t => {
	const ruby = process.env.LEAN_BRIDGE_RUBY ?? "ruby", root = resolve(original);
	const pin = await json("docs/evidence/ruby-fiber-tasks-20261122.json");
	assert.equal(sha256(await readFile(join(root, "acceptance.json"))), pin.acceptanceSha256);
	const work = await mkdtemp(join(tmpdir(), "ruby-parked-"));
	t.after(() => rm(work, {recursive: true, force: true}));
	const output = resolve(process.env.LEAN_BRIDGE_RUBY_PARKED_OUTPUT ?? "build/ruby-parked-pull");
	await mkdir(output, {recursive: true});
	const client = join(work, "parked.rb"), scheduler = join(work, "scheduler.rb");
	await copyFile("tests/fixtures/ruby-task-lab/parked.rb", client);
	await copyFile(join(root, "scheduler.rb"), scheduler);
	const clientSha256 = sha256(await readFile(client)), schedulerSha256 = sha256(await readFile(scheduler));
	const installs = new Map();
	for(const entry of pin.routes)
	{
		const {route} = entry, handoff = join(root, route, "handoff");
		const {receipt, result} = await readVerifiedPackageSetReceipt({receiptPath: join(handoff, "package-set-receipt.json")});
		assert.equal(result.receiptSha256, entry.receiptSha256);
		assert.equal(receipt.packages.length, 1);
		const [pkg] = receipt.packages;
		assert.equal(pkg.profile, "native-ruby-task-v1");
		assert.deepEqual(pkg.artifacts, [entry.archive]);
		assert.equal(pkg.runtimeIdentity, entry.runtimeIdentity);
		if(route !== "stream-only") assert.equal(entry.clients["scheduler.rb"], schedulerSha256);
		const home = join(work, "install-" + route), moved = join(work, route);
		const env = {PATH: "/no-author-tools", GEM_HOME: home, GEM_PATH: home, GEMRC: "/dev/null", TMPDIR: work};
		const archive = join(handoff, entry.archive.path);
		const args = [
			"--disable-gems", "-rrubygems/gem_runner", "-e"
			, "Gem::GemRunner.new.run(ARGV)", "--", "install", "--local"
			, "--no-document", "--ignore-dependencies", archive
		];
		await run(ruby, args, work, env);
		await rename(home, moved);
		const installed = join(moved, "gems", basename(archive, ".gem"));
		const inner = await json(join(installed, "lean-bridge/package-receipt.json"));
		assert.equal(inner.runtimeIdentity, entry.runtimeIdentity);
		assert.equal(inner.bindingIrSha256, entry.bindingIrSha256);
		for(const [file, identity] of Object.entries(inner.files))
		{
			const bytes = await readFile(join(installed, file));
			assert.equal(bytes.length, identity.bytes, file);
			assert.equal(sha256(bytes), identity.sha256, file);
		}
		installs.set(route, {moved, entry});
	}
	const peer = installs.get("stream-only");
	for(const route of ["ordinary", "reviewed"])
	{
		const {moved, entry} = installs.get(route), checks = {};
		assert.equal(entry.runtimeIdentity, peer.entry.runtimeIdentity);
		const env = {
			PATH: "/no-author-tools", LANG: "C.UTF-8", GEMRC: "/dev/null"
			, TMPDIR: work, LEAN_NUM_THREADS: "1", GEM_HOME: moved
			, GEM_PATH: [moved, peer.moved].join(":")
		};
		const interpreter = await run(ruby, ["-e", "puts RUBY_DESCRIPTION"], work, env);
		for(const order of ["peer-first", "pulse-first"])
		{
			checks[order] = await run(ruby, [client, order], work, env, 120_000);
			assert.equal(checks[order], "parked Ruby fiber: original interruption, cursor cancellation, peer delivery, one finalizer, no late item or leaked owner");
		}
		await writeFile(join(output, route + ".json"), canonicalJson({
			route, interpreter, clientSha256, schedulerSha256, checks
			, packageSetSha256: entry.receiptSha256, gemSha256: entry.archive.sha256
			, peerPackageSetSha256: peer.entry.receiptSha256
			, peerGemSha256: peer.entry.archive.sha256
			, runtimeIdentity: entry.runtimeIdentity
		}));
	}
});
