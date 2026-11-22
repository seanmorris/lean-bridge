/**
 * Build separate Ruby IO and task gems and check independently owned nominal resources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { constants } from "node:fs";
import { appendFile, copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { reconcileHostExports } from "../../src/analyze/host-export-model.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";

const env = { ...process.env, LEAN_NUM_THREADS: "1" };
const srcs = resolve("tests/fixtures/resource-tasks"), cases = resolve("tests/fixtures/ruby-task-resources");
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
		const dir = join(root, route, role), src = join(dir, "source"), task = role === "depot";
		const name = route === "lookalike" ? "ruby-other-desk" : "ruby-lease-" + role;
		await mkdir(src, { recursive: true });
		const copy = (from, file) => copyFile(join(from, file), join(src, file), constants.COPYFILE_EXCL);
		await copy(srcs, "lean-toolchain");
		if(route === "lookalike")
		{
			const original = await readFile(join(srcs, "Shared.lean"), "utf8");
			await writeFile(join(src, "Shared.lean"), original.replace("namespace Shared", "namespace Shared\n\ndef revision : UInt32 := 2"), { flag: "wx" });
		}
		else await copy(srcs, "Shared.lean");
		const config = task ? await json(join(srcs, "lean-bridge.exports.json")) : { schemaVersion: 1
			, modules: ["Desk"], resources: ["Shared.Ticket", "Shared.Badge"]
			, exports: ["Desk.issue", "Desk.badge", "Desk.count", "Desk.checkTicket"]
			, nativeEffects: ["filesystem"] };
		if(task)
		{
			await copy(srcs, "Depot.lean"); await copy(cases, "Exchange.lean");
			config.modules.push("Exchange"); config.exports.push("Exchange.revisit"); config.taskExports.push("Exchange.revisit");
			config.taskIOErrors = ["Exchange.revisit"];
		}
		else await copy(cases, "Desk.lean");
		config.targets = { rubygems: { name, version: "1.0.0" } };
		if(route === "reviewed")
		{
			delete config.exports;
			await copyFile(join(root, "ordinary", role, "handoff/binding-ir.json"), join(src, "public.binding-ir.json"), constants.COPYFILE_EXCL);
		}
		await writeFile(join(src, "lean-bridge.exports.json"), canonicalJson(config), { flag: "wx" });
		await writeFile(join(src, "lakefile.toml"), `name="${name}"\nversion="1.0.0"\n` + ["Shared", ...config.modules].map(n => `[[lean_lib]]\nname="${n}"\n`).join(""), { flag: "wx" });
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
	const nominal = api.types.find(t => t.id === "lean:Shared.Ticket"), d = api.declarations.find(d => d.name === (task ? "pending" : "check_ticket"));
	assert.ok(nominal); assert.equal(d.parameters[task ? 0 : 1].ownership, "borrow"); assert.equal(d.result.ownership, "lease");
	assert.deepEqual(d.parameters[task ? 0 : 1].lifetime, { scope: "call", anchor: null });
	assert.equal(d.parameters[task ? 0 : 1].mutability, "write"); assert.equal(d.result.lifetime.scope, "explicit");
	assert.ok(d.effects.includes("reads-resource") && d.effects.includes("writes-resource") && d.effects.includes("allocates"));
	const checked = api.declarations.find(x => x.name === (task ? "checked" : "check_ticket"));
	assert.equal(api.errors.find(e => e.id === checked.failure.errors[0]).payload.id, nominal.id);
	if(task)
	{
		const step = api.declarations.find(x => x.name === "tickets");
		assert.ok(step.failure.errors.some(id => api.errors.find(e => e.id === id)?.payload?.id === nominal.id));
	}
	const fake = structuredClone(api), bad = fake.types.find(t => t.id === nominal.id), digest = "0".repeat(64);
	bad.source.extensions["lean-bridge.dev/resource-identity"] = digest; bad.resource.kindId = "resource:Shared.Ticket/" + digest;
	const modules = new Map(evidence.lake.resolution.modules.map(m => [m.module, m]));
	const owned = evidence.metadata.leanResources.map(r => {
		const seen = new Set(), visit = n => {
			if(seen.has(n) || !modules.has(n)) return;
			seen.add(n); modules.get(n).imports.forEach(visit);
		};
		visit(r.module);
		const family = [...seen].sort().map(module => ({ module, sourceSha256: evidence.interfaces.find(f => f.module === module).sourceSha256 }));
		const identity = sha256(canonicalJson({ abi: "lean-bridge/heap-resource-v1", declaration: r.declaration, compilerSha256: evidence.compilerSha256, modules: family }));
		return { ...r, identity };
	});
	const review = reviewed => reconcileHostExports({ ...evidence, ir: null, owned, component: api.component, review: { source: canonicalJson(reviewed) } });
	assert.deepEqual(review(api).api, api);
	assert.throws(() => review(fake), /Reviewed API differs/u);
	assert.equal(d.resultMode, task ? "promise" : "value"); assert.equal(d.result.type.id, nominal.id);
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
