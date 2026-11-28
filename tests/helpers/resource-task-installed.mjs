/**
 * Build or independently replay two interacting releases for each C-family target.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { compileHostSources } from "../../src/build/host-elaboration.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";

const exec = promisify(execFile), fx = resolve("tests/fixtures/resource-tasks");
const files = ["Shared.lean", "Depot.lean", "lakefile.toml", "lean-toolchain", "lean-bridge.exports.json"];
const run = async (bin, args, cwd, env) => {
	try
	{ return (await exec(bin, args, { cwd, env })).stdout; }
	catch(e)
	{ throw new Error(`${e.message}\n${e.stdout}\n${e.stderr}`, { cause: e }); }
};
const on = process.env.LEAN_BRIDGE_TASK_RESOURCE_TEST === "1", replay = process.env.LEAN_BRIDGE_TASK_RESOURCE_REPLAY;
const env = { ...process.env, LEAN_BRIDGE_LEAN_PREFIX: resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2"), LEAN_NUM_THREADS: "1" };
const scratch = async t => {
	const root = await mkdtemp(join(tmpdir(), "resource-task-")); t.after(() => rm(root, { recursive: true, force: true })); return root;
};
test("a scalar task with no resource declaration still elaborates", { skip: !on }, async t => {
	const module = "Probe", name = "Probe.plain";
	const { api, evidence } = await compileHostSources({
		app: await scratch(t), ir: null
		, leanPrefix: env.LEAN_BRIDGE_LEAN_PREFIX, environment: env
		, sources: [{ module, source: "namespace Probe\ndef plain : Task UInt32 := Task.pure 7\nend Probe\n" }]
		, projectContract: { exports: [name], modules: [module], taskExports: [name], component: { name: "probe", version: "1.0.0", id: "probe@1.0.0" } }
		, run: (command, args, cwd, env) => processBuildRunner.capture({ command, args, cwd, env })
	});
	assert.deepEqual(evidence.selection.leanResources, []);
	assert.deepEqual(api.types, []);
	assert.deepEqual(api.declarations[0].result.type, { kind: "primitive", name: "uint32" });
});
test("task resources reject erased identities and unowned nested payloads at elaboration", { skip: !on }, async t => {
	const work = await scratch(t);
	for(const [name, src, reason] of [
		["Thin", "structure Thin where n : UInt32\ndef f (v : Thin) : Task Thin := Task.pure v", /stable heap identity/u]
		, ["Heap", "structure Heap where a : String; b : String\ndef f (v : Heap) : Task (Except String Heap) := Task.pure (.ok v)", /copied exception payload/u]
	])
		await assert.rejects(compileHostSources({
			app: await mkdtemp(join(work, "compiler-"))
			, ir: null
			, leanPrefix: env.LEAN_BRIDGE_LEAN_PREFIX
			, environment: env
			, sources: [{ module: "Probe", source: "namespace Probe\n" + src.replace("a : String; b", "\n  a : String\n  b") + "\nend Probe" }]
			, projectContract: { exports: ["Probe.f"], modules: ["Probe"], taskExports: ["Probe.f"], leanResources: ["Probe." + name] }
			, run: (command, args, cwd, env) => processBuildRunner.capture({ command, args, cwd, env })
		}), e => { assert.match([e.message, e.details?.stdout, e.details?.stderr].join(" "), reason); return true; });
});
test("a resource identity follows the declaring module's transitive source, not an unrelated consumer", { skip: !on }, async t => {
	const work = await scratch(t);
	const compile = async (field, stamp, review) => compileHostSources({
		app: await mkdtemp(join(work, "identity-"))
		, ir: null
		, leanPrefix: env.LEAN_BRIDGE_LEAN_PREFIX
		, environment: env
		, sources: [
			{ module: "Backing", source: "structure Backing where\n  label : String\n  count : " + field }
			, { module: "Domain", source: "import Backing\nstructure Ticket where\n  backing : Backing\n  stamp : String" }
			, { module: "App", source: "import Domain\ndef echo (x : Ticket) : Task Ticket := Task.pure x\ndef unrelated : Nat := " + stamp }
		]
		, projectContract: { component: { name: "source", version: "1.0.0", id: "source@1.0.0" }
			, exports: ["echo"]
			, taskExports: ["echo"]
			, modules: ["App"]
			, leanResources: ["Ticket"], ...(review ? { review } : {}) }
		, run: (command, args, cwd, env) => processBuildRunner.capture({ command, args, cwd, env })
	});
	const a = await compile("UInt32", 1), review = { source: canonicalJson(a.api) };
	assert.deepEqual((await compile("UInt32", 2, review)).api, a.api);
	await assert.rejects(compile("String", 1, review), /Reviewed API differs/u);
});
test("installed C and C++ tasks retain nominal resources independently of the caller and deliver across components", {
	skip: !on && !replay, timeout: 3_600_000
}, async t => {
	const work = await scratch(t), kept = resolve(replay ?? process.env.LEAN_BRIDGE_TASK_RESOURCE_EVIDENCE ?? join(work, "releases"));
	if(!replay) await mkdir(kept, { recursive: true });
	let ir, firstC;
	for(const target of ["c", "cpp"])
	{
		const client = join(work, target), installed = [], reports = [];
		await mkdir(client);
		for(const route of ["ordinary", "reviewed"])
		{
			const id = target + "-" + route, dir = join(kept, id), src = join(work, "project-" + id), handoff = join(dir, "handoff");
			const peer = route === "reviewed";
			if(!replay)
			{
				await mkdir(src); await mkdir(dir); await mkdir(join(dir, "source"));
				for(const f of files) await copyFile(join(fx, f), join(src, f));
				const config = JSON.parse(await readFile(join(src, files.at(-1))));
				if(peer)
				{
					delete config.exports;
					for(const host of Object.values(config.targets)) host.name = "depot-peer";
					await writeFile(join(src, files.at(-1)), canonicalJson(config));
					await writeFile(join(src, "depot.binding-ir.json"), canonicalJson(ir));
				}
				for(const f of [...files, ...peer ? ["depot.binding-ir.json"] : []]) await copyFile(join(src, f), join(dir, "source", f));
				await buildCanonicalProject({ projectRoot: src, outputRoot: handoff, targets: [target], environment: env })
					.catch(e => { throw new Error(e.message + "\n" + JSON.stringify(e.details), { cause: e }); });
				await rm(src, { recursive: true });
			}
			const api = JSON.parse(await readFile(join(handoff, "binding-ir.json")));
			if(ir) assert.deepEqual(ir, api); else ir = api;
			const dt = Object.fromEntries(api.declarations.map(d => [d.name, d]));
			assert.deepEqual(dt.pending.parameters[0].lifetime, { scope: "call", anchor: null }); assert.equal(dt.pending.parameters[0].ownership, "borrow");
			assert.equal(dt.pending.result.ownership, "lease"); assert.equal(dt.pending.result.type.id, "lean:Shared.Ticket");
			assert.equal(dt.pending.parameters[0].mutability, "write");
			assert.ok(dt.pending.effects.includes("writes-resource") && dt.checked.effects.includes("allocates"));
			assert.equal(api.errors.find(e => e.id === dt.checked.failure.errors[0]).payload.id, dt.pending.result.type.id);
			assert.equal(api.types.length, 2);
			for(const t of api.types) assert.equal(t.resource.kindId, "resource:" + t.source.declaration + "/" + t.source.extensions["lean-bridge.dev/resource-identity"]);
			const source = JSON.parse(await readFile(join(handoff, "host-export-evidence.json")));
			assert.equal(source.reviewedSourceSha256, peer ? sha256(canonicalJson(ir)) : null);
			const { result, receipt } = await readVerifiedPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
			assert.equal(source.sourceTreeSha256, receipt.source.treeSha256);
			const inputs = [...files, ...peer ? ["depot.binding-ir.json"] : []].sort((a, b) => a.localeCompare(b));
			assert.deepEqual((await readdir(join(dir, "source"))).sort((a, b) => a.localeCompare(b)), inputs);
			const raw = await Promise.all(inputs.map(async f => sha256(await readFile(join(dir, "source", f))) + "  " + f + "\n"));
			assert.equal(sha256(raw.join("")), receipt.source.treeSha256);
			// Source-tree identity covers original bytes; the configuration digest
			// deliberately covers canonical JSON rather than presentation whitespace.
			assert.equal(source.configurationSha256, sha256(canonicalJson(JSON.parse(await readFile(join(dir, "source/lean-bridge.exports.json"))))));
			for(const m of source.interfaces) assert.equal(m.sourceSha256, sha256(await readFile(join(dir, "source", m.module + ".lean"))));
			if(peer) assert.equal(source.reviewedSourceSha256, sha256(await readFile(join(dir, "source/depot.binding-ir.json"))));
			const [pkg] = receipt.packages, [archive] = pkg.artifacts;
			assert.equal(pkg.profile, `native-${target}-task-v1`); assert.equal(receipt.profiles[0].bindingIrSha256, hashBindingIr(ir));
			const prefix = join(work, "prefix-" + id), unpack = prefix + "-unpacked";
			await mkdir(unpack); await run("tar", ["-xzf", join(handoff, archive.path), "--strip-components=1", "-C", unpack], work, env);
			await rename(unpack, prefix); installed.push(prefix);
			const m = JSON.parse(await readFile(join(prefix, "lean-bridge-package.json")));
			assert.deepEqual(JSON.parse(await readFile(join(prefix, "share/lean-bridge/binding-ir.json"))), api);
			assert.deepEqual(JSON.parse(await readFile(join(prefix, "share/lean-bridge/elaboration.json"))), source);
			for(const [file, data] of Object.entries(m.files)) assert.equal(sha256(await readFile(join(prefix, file))), data.sha256);
			const ledgers = Object.keys(m.files).filter(f => /^lib\/liblb_task_resources_[a-f0-9]{64}\.so$/u.test(f));
			assert.equal(ledgers.length, 1);
			reports.push({ target
				, route
				, componentIdentity: m.componentIdentity
				, runtimeIdentity: m.runtimeIdentity
				, ledger: ledgers[0]
				, ledgerSha256: m.files[ledgers[0]].sha256
				, bindingIrSha256: m.bindingIrSha256
				, sourceTreeSha256: receipt.source.treeSha256
				, receiptSha256: result.receiptSha256
				, reviewedSourceSha256: source.reviewedSourceSha256
				, archive });
		}
		assert.notEqual(reports[0].componentIdentity, reports[1].componentIdentity);
		for(const key of ["runtimeIdentity", "ledger", "ledgerSha256"]) assert.equal(reports[0][key], reports[1][key]);
		const file = "consumer." + target, fileset = [file, "audit.h", "CMakeLists.txt"], origin = replay ? join(kept, target + "-client") : fx;
		for(const f of fileset) await copyFile(join(origin, f), join(client, f));
		const host = { ...process.env
			, LEAN_PATH: ""
			, LEAN_SYSROOT: ""
			, LD_PRELOAD: ""
			, LD_LIBRARY_PATH: ""
			, PKG_CONFIG_PATH: ""
			, PKG_CONFIG_LIBDIR: installed.map(p => join(p, "lib/pkgconfig")).join(":")
			, LEAN_NUM_THREADS: "1" };
		const libs = (await run("pkg-config", ["--libs", "--cflags", "depot", "depot-peer"], client, host)).trim().split(/\s+/u);
		const cpp = target === "cpp", cc = cpp ? env.CXX ?? "c++" : env.CC ?? "cc";
		const check = async (bin, prefixes = installed, environment = host) => {
			const ldd = await run("ldd", [bin], client, environment);
			const loads = [...ldd.matchAll(/^\s*(\S+) => (\/[^\n]+?) \(0x[\da-f]+\)$/gmu)];
			const loaded = async name => {
				const matches = loads.filter(m => m[1] === name); assert.equal(matches.length, 1, ldd);
				return realpath(matches[0][2]);
			};
			for(const [i, name] of ["liblbc_depot.so", "liblbc_depot_peer.so"].entries())
				assert.equal(await loaded(name), join(prefixes[i], "lib", name));
			for(const name of ["liblean_bridge_native.so", "libleanshared.so", reports[0].ledger.slice(4)])
				assert.ok(prefixes.map(p => join(p, "lib", name)).includes(await loaded(name)), ldd);
			return (await run(bin, [], client, environment)).trim();
		};
		await run(cc, [cpp ? "-std=c++20" : "-std=c11", "-Wall", "-Wextra", "-Werror", file, ...libs, "-ldl", "-pthread", "-o", "app"], client, host);
		const output = await check(join(client, "app")); assert.match(output, /passed$/u);
		const cmake = env.LEAN_BRIDGE_C_TASK_CMAKE ?? "cmake";
		await run(cmake, ["-S", ".", "-B", "build", "-DCMAKE_PREFIX_PATH=" + installed.join(";"), "-DRESOURCE_TARGET=" + target], client, host);
		await run(cmake, ["--build", "build", "--parallel", "1"], client, host);
		assert.equal(await check(join(client, "build/consumer")), output);
		const record = { reports, output, files: Object.fromEntries(await Promise.all(fileset.map(async f => [f, sha256(await readFile(join(client, f)))]))) };
		const dest = join(kept, target + "-client");
		if(replay) assert.deepEqual(record, JSON.parse(await readFile(join(dest, "acceptance.json"))));
		else
		{
			await mkdir(dest); for(const f of fileset) await copyFile(join(client, f), join(dest, f));
			await writeFile(join(dest, "acceptance.json"), canonicalJson(record), { flag: "wx" });
		}
		t.diagnostic(output + " via pkg-config and CMake");
		if(!cpp) firstC = { prefix: installed[0], report: reports[0], output };
		else
		{
			// A C application can also use the C ABI shipped by a C++ task package.
			// Use the unchanged consumer and prove which two DSOs the loader chose.
			assert.equal(firstC.report.ledgerSha256, reports[1].ledgerSha256);
			const pair = [firstC.prefix, installed[1]];
			const mixed = { ...host, PKG_CONFIG_LIBDIR: pair.map(p => join(p, "lib/pkgconfig")).join(":") };
			const libs = (await run("pkg-config", ["--libs", "--cflags", "depot", "depot-peer"], client, mixed)).trim().split(/\s+/u);
			await run(env.CC ?? "cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", join(kept, "c-client/consumer.c"), ...libs, "-ldl", "-pthread", "-o", "mixed"], client, mixed);
			assert.equal(await check(join(client, "mixed"), pair, mixed), firstC.output);
			t.diagnostic("unchanged C consumer also passed with the independently installed C++ peer archive");
			await rm(firstC.prefix, { recursive: true });
		}
		// The receipts and original archives live outside these disposable
		// installations. Do not keep four copies of the Lean runtime in scratch.
		for(const prefix of cpp ? installed : installed.slice(1)) await rm(prefix, { recursive: true });
		await rm(client, { recursive: true });
	}
});
