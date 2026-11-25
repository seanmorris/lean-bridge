/**
 * Install an independent synchronous owner and a real task peer side by side.
 *
 * @file
 */
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";

const fx = resolve("tests/fixtures/native-sync-resource"), shared = resolve("tests/fixtures/resource-tasks");
const modes = ["sync", "task"], json = async p => JSON.parse(await readFile(p, "utf8"));
const env = { ...process.env, LEAN_NUM_THREADS: "1", CARGO_BUILD_JOBS: "1", CMAKE_BUILD_PARALLEL_LEVEL: "1" };
const buildPair = async (root, target) => {
	for(const mode of modes)
	{
		const dir = join(root, target, mode), src = join(dir, "source"), name = "lease-" + mode;
		await mkdir(src, { recursive: true }); await copyFile(join(fx, "Owned.lean"), join(src, "Owned.lean"));
		for(const f of ["Shared.lean", "lean-toolchain"]) await copyFile(join(shared, f), join(src, f));
		await writeFile(join(src, "lakefile.toml"), `name = "${name}"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Shared"\n[[lean_lib]]\nname = "Owned"\n`);
		const exports = mode === "sync" ? ["Owned.fresh", "Owned.read", "Owned.increment", "Owned.checked", "Owned.letter"] : ["Owned.later"];
		const config = { schemaVersion: 1, modules: ["Owned"]
			, resources: ["Shared.Badge"], nativeEffects: []
			, ...mode === "task" ? { taskExports: exports } : {}
			, ...target === "cpp" ? { exports } : {}
			, targets: { [target]: { name, version: "1.0.0" } } };
		if(target === "cargo") await copyFile(join(root, "cpp", mode, "handoff/binding-ir.json"), join(src, "owned.binding-ir.json"));
		await writeFile(join(src, "lean-bridge.exports.json"), canonicalJson(config));
		await buildCanonicalProject({ projectRoot: src, outputRoot: join(dir, "handoff"), targets: [target], environment: env })
			.catch(e => { throw new Error(e.message + "\n" + JSON.stringify(e.details), { cause: e }); });
	}
};
const inspect = async (root, target, mode) => {
	const dir = join(root, target, mode, "handoff"), { receipt, result } = await readVerifiedPackageSetReceipt({ receiptPath: join(dir, "package-set-receipt.json") });
	const api = await json(join(dir, "binding-ir.json")), proof = await json(join(dir, "host-export-evidence.json"));
	const id = `native-${target === "cpp" ? "cpp" : "rust"}-${mode === "sync" ? "io" : "task"}-v1`;
	assert.equal(receipt.profiles[0].id, id); assert.equal(proof.sourceTreeSha256, receipt.source.treeSha256);
	assert.equal(hashBindingIr(api), receipt.profiles[0].bindingIrSha256);
	const reviewed = target === "cargo" ? await readFile(join(root, "cpp", mode, "handoff/binding-ir.json")) : null;
	assert.equal(proof.reviewedSourceSha256, reviewed ? sha256(reviewed) : null);
	const badge = api.types.find(t => t.name === "Badge"); assert.equal(badge.resource.disposal, "required");
	if(mode === "sync")
	{
		const d = api.declarations.find(d => d.name === "checked"); assert.equal(d.resultMode, "value");
		assert.equal(d.parameters[1].ownership, "borrow"); assert.equal(d.result.type.id, badge.id); assert.equal(d.result.ownership, "lease");
		assert.equal(api.errors.find(e => e.id === d.failure.errors[0]).payload.id, badge.id);
	} else assert.equal(api.declarations[0].resultMode, "promise");
	return { dir, api, receipt, nominal: badge.resource.kindId
		, component: receipt.packages.find(p => p.role === "component")
		, runtime: receipt.packages.find(p => p.role === "runtime")
		, proof: { profile: id, receiptSha256: result.receiptSha256
			, bindingIrSha256: receipt.profiles[0].bindingIrSha256
			, sourceTreeSha256: receipt.source.treeSha256
			, reviewedSourceSha256: proof.reviewedSourceSha256
			, compilerSha256: proof.compilerSha256
			, extractorSha256: proof.extractorSha256
			, archives: receipt.packages.flatMap(p => p.artifacts) } };
};
const install = async (work, root, target) => {
	const sync = await inspect(root, target, "sync"), task = await inspect(root, target, "task");
	assert.equal(sync.nominal, task.nominal); assert.equal(sync.component.runtimeIdentity, task.component.runtimeIdentity);
	const build = await mkdtemp(join(work, "build-")), app = await mkdtemp(join(work, "app-")), binary = join(app, "client");
	const unpack = async (pkg, dir, leaf) => {
		const prefix = join(build, leaf); await mkdir(prefix);
		await run("tar", ["-xzf", join(dir, pkg.artifacts[0].path), "--strip-components=1", "-C", prefix], build, env); return prefix;
	};
	const direct = await unpack(sync.component, sync.dir, "sync"), async = await unpack(task.component, task.dir, "task");
	const client = join(fx, "consumer." + (target === "cpp" ? "cpp" : "rs"));
	const isolated = { PATH: "/unavailable", LANG: "C", TMPDIR: app, LEAN_NUM_THREADS: "1" };
	let runtimeFeatures;
	if(target === "cpp")
	{
		const pc = { ...env, PKG_CONFIG_PATH: "", PKG_CONFIG_LIBDIR: [direct, async].map(p => join(p, "lib/pkgconfig")).join(":") };
		const flags = (await run("pkg-config", ["--cflags", "--libs", "lease-sync", "lease-task"], build, pc)).split(/\s+/u);
		await run(env.CXX ?? "c++", ["-std=c++20", "-Wall", "-Wextra", "-Werror", client, ...flags, "-ldl", "-o", binary], build, env);
		for(const mode of modes) await rename(join(build, mode), join(app, mode));
		isolated.LD_LIBRARY_PATH = modes.map(mode => join(app, mode, "lib")).join(":");
	} else
	{
		assert.equal(sync.runtime.name, task.runtime.name); assert.equal(sync.runtime.version, task.runtime.version);
		assert.deepEqual(sync.runtime.artifacts, task.runtime.artifacts);
		const support = await unpack(sync.runtime, sync.dir, "runtime"), cargo = env.LEAN_BRIDGE_CARGO ?? "cargo";
		const descriptor = await json(join(support, "lean-bridge/package-receipt.json"));
		const old = replay && !(await readFile(join(support,"Cargo.toml"),"utf8")).includes("host-objects = []");
		assert.equal(descriptor.schemaVersion, 2); assert.deepEqual(descriptor.profiles, ["native-rust-io-v1", "native-rust-task-v1", ...old?[]:["native-rust-host-v1"]]);
		const rust = { ...env, RUSTC: env.LEAN_BRIDGE_RUSTC ?? "rustc", CARGO_TARGET_DIR: join(build, "target"), CARGO_NET_OFFLINE: "true" };
		await mkdir(join(build, "src")); await copyFile(client, join(build, "src/main.rs"));
		await writeFile(join(build, "Cargo.toml"), `[package]\nname="installed-peers"\nversion="0.1.0"\nedition="2021"\n[dependencies]\nlease-sync={path=${JSON.stringify(direct)}}\nlease-task={path=${JSON.stringify(async)}}\n[patch.crates-io]\nlean-bridge-task-runtime={path=${JSON.stringify(support)}}\n`);
		await run(cargo, ["generate-lockfile", "--offline"], build, rust);
		const graph = JSON.parse(await run(cargo, ["metadata", "--locked", "--offline", "--format-version", "1"], build, rust));
		const providers = graph.packages.filter(p => p.name === sync.runtime.name); assert.equal(providers.length, 1);
		const provider = providers[0]; assert.equal(provider.version, sync.runtime.version);
		runtimeFeatures = graph.resolve.nodes.find(n => n.id === provider.id).features.sort();
		assert.ok(runtimeFeatures.includes("async"));
		for(const pkg of [sync.component, task.component])
		{
			const component = graph.packages.find(p => p.name === pkg.name), dependency = component.dependencies.find(d => d.name === provider.name);
			assert.equal(dependency.req, "=" + provider.version); assert.equal(dependency.uses_default_features, pkg === task.component);
			assert.ok(graph.resolve.nodes.find(n => n.id === component.id).deps.some(d => d.pkg === provider.id));
		}
		await run(cargo, ["build", "--locked", "--offline", "-j1"], build, rust);
		await copyFile(join(build, "target/debug/installed-peers"), binary);
	}
	await rm(build, { recursive: true });
	await run(binary, [], app, isolated, 60_000);
	return { target, route: target === "cpp" ? "ordinary" : "reviewed"
		, nominal: sync.nominal, runtimeIdentity: sync.component.runtimeIdentity
		, consumerSha256: sha256(await readFile(client))
		, ...runtimeFeatures ? { runtimeFeatures } : {}
		, sync: sync.proof, task: task.proof };
};
const replay = process.env.LEAN_BRIDGE_NATIVE_SYNC_MIXED_REPLAY;
// Reuse original C++ handoffs when rerunning only the Rust packaging stage.
// Both targets still authenticate the archives, compile and run their installed clients.
const reuseCpp = process.env.LEAN_BRIDGE_NATIVE_SYNC_MIXED_REUSE_CPP === "1";
test("installed synchronous and task packages exchange real nominal resources and typed errors", {
	skip: process.env.LEAN_BRIDGE_NATIVE_SYNC_MIXED_TEST !== "1" && !replay
	, timeout: 3_600_000
}, async t => {
	const work = await mkdtemp(join(tmpdir(), "native-sync-peers-")); t.after(() => rm(work, { recursive: true, force: true }));
	const root = resolve(replay ?? process.env.LEAN_BRIDGE_NATIVE_SYNC_MIXED_EVIDENCE ?? join(work, "releases")), peers = [];
	for(const target of ["cpp", "cargo"])
	{
		if(!replay && !(reuseCpp && target === "cpp")) await buildPair(root, target);
		peers.push(await install(work, root, target)); t.diagnostic(target + ": one owner, synchronous error lease and real task peer passed");
	}
	const report = { schemaVersion: 1, peers }, path = join(root, "acceptance.json");
	if(!replay) await writeFile(path, canonicalJson(report), { flag: "wx" });
	else
	{
		const bytes = await readFile(path); assert.deepEqual(report, JSON.parse(bytes));
		if(process.env.LEAN_BRIDGE_NATIVE_SYNC_MIXED_EXPECTED)
		{
			const pinned = await json(resolve(process.env.LEAN_BRIDGE_NATIVE_SYNC_MIXED_EXPECTED));
			assert.equal(sha256(bytes), pinned.mixedAcceptanceSha256); assert.deepEqual(peers, pinned.peers);
			const support = r => r.archives.find(a => a.path.startsWith("archives/lean-bridge-task-runtime-"));
			const installed = support(peers.find(p => p.target === "cargo").sync); assert.ok(installed);
			for(const route of ["ordinary", "reviewed"])
				assert.deepEqual(support(pinned.routes.find(r => r.target === "cargo" && r.route === route)), installed);
		}
	}
});
