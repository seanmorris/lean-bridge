/**
 * Build separate Ruby IO and task gems and check independently owned nominal resources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { constants } from "node:fs";
import { appendFile, copyFile, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";
import { prepareLeaseProject, verifyLeaseModel } from "./native-lease-project.mjs";

const env = { ...process.env, LEAN_NUM_THREADS: "1" };
const cases = resolve("tests/fixtures/ruby-task-resources");
const json = async file => JSON.parse(await readFile(file, "utf8"));
const allRoutes = ["ordinary", "reviewed", "lookalike"];
test("build Ruby resource IO and task handoffs from ordinary and reviewed Lean", {
	skip: !env.LEAN_BRIDGE_RUBY_LEASE_BUILD, timeout: 3_600_000
}, async t => {
	const root = resolve(env.LEAN_BRIDGE_RUBY_LEASE_BUILD);
	const routes = env.LEAN_BRIDGE_RUBY_LEASE_ROUTE ? [env.LEAN_BRIDGE_RUBY_LEASE_ROUTE] : allRoutes;
	assert.ok(routes.every(r => allRoutes.includes(r)));
	for(const route of routes) for(const role of route === "lookalike" ? ["desk"] : ["desk", "depot"])
	{
		const { src, dir } = await prepareLeaseProject(root, route, role, "rubygems");
		await buildCanonicalProject({ projectRoot: src, outputRoot: join(dir, "handoff"), targets: ["rubygems"], environment: env })
			.catch(e => { throw new Error(e.message + "\n" + JSON.stringify(e.details), { cause: e }); });
		if(route === "reviewed") assert.deepEqual(await json(join(dir, "handoff/binding-ir.json")), await json(join(src, "public.binding-ir.json")));
		t.diagnostic("built " + route + "/" + role);
	}
});

const inspect = async (root, route, role) => {
	const dir = join(root, route, role, "handoff");
	const { receipt, result } = await readVerifiedPackageSetReceipt({ receiptPath: join(dir, "package-set-receipt.json") });
	const [pkg] = receipt.packages, [artifact] = pkg.artifacts;
	const api = await json(join(dir, "binding-ir.json")), evidence = await json(join(dir, "host-export-evidence.json"));
	const task = role === "depot", profile = task ? "native-ruby-task-v1" : "native-ruby-io-v1";
	const { nominal } = verifyLeaseModel(api, evidence, task);
	assert.equal(pkg.profile, profile); assert.equal(pkg.runtimeDelivery, "embedded");
	assert.equal(evidence.sourceTreeSha256, receipt.source.treeSha256); assert.equal(Boolean(evidence.reviewedSourceSha256), route === "reviewed");
	assert.equal(hashBindingIr(api), receipt.profiles[0].bindingIrSha256);
	const proof = { role, route, profile, artifact
		, receiptSha256: result.receiptSha256, bindingIrSha256: hashBindingIr(api)
		, sourceTreeSha256: receipt.source.treeSha256
		, runtimeIdentity: pkg.runtimeIdentity
		, reviewedSourceSha256: evidence.reviewedSourceSha256
		, compilerSha256: evidence.compilerSha256, nominal: nominal.resource.kindId };
	return { archive: join(dir, artifact.path), name: pkg.name, proof };
};
const capture = env.LEAN_BRIDGE_RUBY_LEASE_CAPTURE, replay = env.LEAN_BRIDGE_RUBY_LEASE_REPLAY, smoke = env.LEAN_BRIDGE_RUBY_LEASE_SMOKE;
test("installed Ruby gems exchange real typed resource leases across IO, tasks and streams", {
	skip: !capture && !replay && !smoke, timeout: 3_600_000
}, async t => {
	const root = resolve(replay ?? capture ?? smoke), ruby = env.LEAN_BRIDGE_RUBY ?? "ruby";
	const work = await mkdtemp(join(tmpdir(), "installed-ruby-leases-")); t.after(() => rm(work, { recursive: true, force: true }));
	const caller = join(work, "consumer.rb"); await copyFile(join(replay ? root : cases, "consumer.rb"), caller);
	const rows = [], other = !smoke && await inspect(root, "lookalike", "desk");
	for(const route of smoke ? ["ordinary"] : ["ordinary", "reviewed"])
	{
		const a = await inspect(root, route, "desk"), b = await inspect(root, route, "depot");
		assert.equal(a.proof.nominal, b.proof.nominal); if(other) assert.notEqual(a.proof.nominal, other.proof.nominal);
		const pkgs = other ? [a, b, other] : [a, b], home = join(work, route), moved = join(work, route + "-moved");
		const isolated = { PATH: "/unavailable", GEM_HOME: home, GEM_PATH: home, GEMRC: "/dev/null", LANG: "C.UTF-8", LEAN_NUM_THREADS: "1", TMPDIR: work };
		const args = ["--disable-gems", "-rrubygems/gem_runner", "-e"
			, "Gem::GemRunner.new.run(ARGV)", "--", "install", "--local"
			, "--no-document", "--ignore-dependencies", ...pkgs.map(p => p.archive)];
		await run(ruby, args, work, isolated); await rename(home, moved); isolated.GEM_HOME = isolated.GEM_PATH = moved;
		let ledger, corrupt, support;
		for(const p of pkgs)
		{
			const dir = join(moved, "gems", p.proof.artifact.path.slice("archives/".length, -4));
			const inner = await json(join(dir, "lean-bridge/package-receipt.json")); assert.equal(inner.bindingIrSha256, p.proof.bindingIrSha256);
			assert.equal(inner.runtimeIdentity, a.proof.runtimeIdentity); assert.equal(inner.runtimeIdentity, p.proof.runtimeIdentity);
			const l = inner.resourceLedger; assert.equal(l.library, "liblb_task_resources_" + l.id + ".so");
			const path = "lib/" + inner.requirePath + "/native/linux-x64/" + l.library;
			assert.equal(l.sha256, sha256(await readFile(join(dir, path)))); assert.equal(l.sha256, inner.files[path].sha256);
			const shared = sha256(await readFile(join(dir, "lib/lean_bridge/native_resource_lease_v1.rb")));
			if(ledger)
			{
				assert.deepEqual(l, ledger); assert.equal(shared, support);
			}
			else
			{
				ledger = l; corrupt = join(dir, path); support = shared;
			}
		}
		const orders = [], names = pkgs.slice(0, 2).map(p => p.name.replaceAll("-", "_"));
		for(const order of smoke ? [names] : [names, names.toReversed()])
		{
			const stats = JSON.parse(await run(ruby, [caller, ...order, ...smoke ? ["--smoke"] : []], work, isolated, 180_000));
			assert.deepEqual(stats, { order, foreignKindRejected: !smoke, runtimeInitializations: 1, componentInitializations: pkgs.length, liveIdentities: 0, leakedDescriptors: 0 });
			orders.push(stats);
		}
		await appendFile(corrupt, Buffer.from([0]));
		await assert.rejects(run(ruby, ["-e", 'require "lean_bridge/' + names[0] + '"'], work, isolated), /Native library differs from compiled evidence/u);
		rows.push({ route, packages: pkgs.map(p => p.proof), ledger, sharedRubySha256: support, orders }); t.diagnostic(route + " installed lease consumers passed");
	}
	if(smoke) return;
	for(const key of [0, 1])
	{
		assert.equal(rows[0].packages[key].bindingIrSha256, rows[1].packages[key].bindingIrSha256);
		assert.notEqual(rows[0].packages[key].artifact.sha256, rows[1].packages[key].artifact.sha256);
	}
	const report = { schemaVersion: 1, clientSha256: sha256(await readFile(caller)), rows }, path = join(root, "acceptance.json");
	if(replay)
	{
		const bytes = await readFile(path); assert.deepEqual(report, JSON.parse(bytes));
		if(env.LEAN_BRIDGE_RUBY_LEASE_EXPECTED)
		{
			const pinned = await json(resolve(env.LEAN_BRIDGE_RUBY_LEASE_EXPECTED));
			assert.equal(sha256(bytes), pinned.acceptanceSha256); assert.deepEqual(report, pinned.installed);
		}
	}
	else
	{
		await copyFile(caller, join(root, "consumer.rb"), constants.COPYFILE_EXCL);
		await writeFile(path, canonicalJson(report), { flag: "wx" });
	}
});
