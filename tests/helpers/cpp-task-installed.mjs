/**
 * Build, verify and replay independent, relocated C++20 coroutine releases.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { generateCppTaskHeader } from "../../src/backends/cpp/task-exports.mjs";

const exec = promisify(execFile), cli = resolve("scripts/lean-bridge.mjs");
const leanFixture = resolve("tests/fixtures/c-lean-tasks"), consumer = resolve("tests/fixtures/cpp-lean-tasks");
const run = async (cmd, args, cwd, env = process.env) => {
	try
	{ return (await exec(cmd, args, { cwd, env })).stdout; }
	catch(e)
	{ throw new Error(`${e.message}\n${e.stdout}\n${e.stderr}`, { cause: e }); }
};
const pr = name => ({ kind: "primitive", name });
test("C++ task headers expose native values and never silently narrow unsupported carriers", async () => {
	const entry = { name: "class", declaration: "A.class", effect: "pure", delivery: "task", result: pr("uint64"), parameters: [] };
	const header = entries => generateCppTaskHeader({ prefix: "lbc_test", entries });
	assert.match(header([entry]), /Future<std::uint64_t> class_\(/u);
	assert.throws(() => header([entry, { ...entry, name: "class_" }]), /colliding/u);
	for(const t of ["int", "nat"]) assert.match(header([{ ...entry, result: pr(t) }]), /boost::multiprecision::cpp_int/u);
	assert.throws(() => header([{ ...entry, result: pr("unknown") }]), /Unsupported/u);
	const allow = JSON.parse(await readFile("config/cli-package.v1.json")).files;
	const nix = JSON.parse(await readFile("nix/perl-engine-source-boundary.json")).includedFiles;
	for(const f of ["task-exports.mjs", "task-loop.hpp", "task-resource.hpp", "task-routine.hpp", "task-values.hpp"])
	{
		assert.ok(allow.includes("src/backends/cpp/" + f)); assert.ok(nix.includes("src/backends/cpp/" + f));
	}
});
const replay = async (dir, root, route, fixture) => {
	const { receipt, result } = await readVerifiedPackageSetReceipt({ receiptPath: join(dir, "package-set-receipt.json") });
	assert.deepEqual(result.profiles, ["native-cpp-task-v1"]);
	const [pkg] = receipt.packages, [artifact] = pkg.artifacts;
	assert.deepEqual([pkg.target, pkg.ecosystem, pkg.role, pkg.runtimeDelivery], ["cpp", "cpp", "component", "embedded"]);
	const prefix = join(root, `relocated-${route}`), client = join(root, `client-${route}`);
	const unpacked = join(root, `original-${route}`);
	await mkdir(unpacked); await mkdir(client);
	await run("tar", ["-xzf", join(dir, artifact.path), "--strip-components=1", "-C", unpacked], root);
	await rename(unpacked, prefix);
	const manifest = JSON.parse(await readFile(join(prefix, "lean-bridge-package.json")));
	assert.equal(manifest.cppStandard, 20); assert.equal(manifest.cppNamespace, "lean_bridge::lbc_pulse");
	assert.equal(manifest.runtimeIdentity, pkg.runtimeIdentity);
	assert.equal(manifest.bindingIrSha256, receipt.profiles[0].bindingIrSha256);
	assert.equal(manifest.profile, pkg.profile);
	for(const [path, record] of Object.entries(manifest.files))
	{
		const bytes = await readFile(join(prefix, path)); assert.equal(bytes.length, record.bytes); assert.equal(sha256(bytes), record.sha256);
	}
	for(const f of ["consumer.cpp", "CMakeLists.txt"]) await copyFile(join(fixture, f), join(client, f));
	assert.deepEqual((await readdir(client)).sort(), ["CMakeLists.txt", "consumer.cpp"]);
	const env = { ...process.env, PKG_CONFIG_PATH: "", PKG_CONFIG_LIBDIR: join(prefix, "lib/pkgconfig"), LD_PRELOAD: "", LD_LIBRARY_PATH: "", LEAN_PATH: "", LEAN_SYSROOT: "" };
	const flags = (await run("pkg-config", ["--cflags", "--libs", "pulse"], client, env)).trim().split(/\s+/u);
	const cxx = process.env.CXX ?? "c++", cmake = process.env.LEAN_BRIDGE_C_TASK_CMAKE ?? "cmake";
	assert.ok(flags.includes("-pthread"));
	await run(cxx, ["-std=c++20", "-Wall", "-Wextra", "-Werror", "consumer.cpp", ...flags, "-o", "app"], client, env);
	const check = async app => {
		const loaded = await run("ldd", [app], client, env);
		for(const lib of ["liblbc_pulse.so", "liblean_bridge_native.so", "libleanshared.so"])
			assert.ok(loaded.split("\n").some(line => line.trim().startsWith(`${lib} => ${prefix}/`)));
		assert.equal((await run(app, [], client, env)).trim(), "installed C++20 tasks, coroutines and pull streams: ok");
	};
	await check(join(client, "app"));
	await run(cmake, ["-S", ".", "-B", "cmake", `-DCMAKE_PREFIX_PATH=${prefix}`], client, env);
	await run(cmake, ["--build", "cmake", "--parallel", "1"], client, env);
	await check(join(client, "cmake/consumer"));
	return { route
		, archive: artifact
		, packageSetReceiptSha256: result.receiptSha256
		, sourceTreeSha256: receipt.source.treeSha256
		, bindingIrSha256: manifest.bindingIrSha256
		, runtimeIdentity: pkg.runtimeIdentity
		, componentIdentity: manifest.componentIdentity
		, consumerSha256: sha256(await readFile(join(client, "consumer.cpp")))
		, compiler: (await run(cxx, ["--version"], client)).split("\n")[0]
		, cmake: (await run(cmake, ["--version"], client)).split("\n")[0]
		, installedUsing: ["pkg-config", "CMake"], result: "passed" };
};

test("retained C++ release receipts replay without building Lean", {
	skip: !process.env.LEAN_BRIDGE_CPP_TASK_REPLAY_DIR, timeout: 240_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "cpp-task-replay-")); t.after(() => rm(root, { recursive: true, force: true }));
	for(const route of ["ordinary", "reviewed"])
	{
		const dir = join(resolve(process.env.LEAN_BRIDGE_CPP_TASK_REPLAY_DIR), route);
		const expected = JSON.parse(await readFile(join(dir, "acceptance.json"))), got = await replay(dir, root, route, dir);
		for(const key of ["route", "result", "archive", "packageSetReceiptSha256", "sourceTreeSha256", "bindingIrSha256", "runtimeIdentity", "componentIdentity", "consumerSha256", "installedUsing"])
			assert.deepEqual(got[key], expected[key]);
	}
});

test("ordinary and reviewed C++20 archives run installed futures, streams and cancellation", {
	skip: process.env.LEAN_BRIDGE_CPP_TASK_TEST !== "1", timeout: 1_200_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "cpp-task-install-")); t.after(() => rm(root, { recursive: true, force: true }));
	const retain = process.env.LEAN_BRIDGE_CPP_TASK_EVIDENCE_DIR;
	let ordinary;
	for(const route of ["ordinary", "reviewed"])
	{
		const src = join(root, `producer-${route}`), output = join(root, `build-${route}`);
		await mkdir(src);
		for(const f of ["Pulse.lean", "lakefile.toml", "lean-toolchain"]) await copyFile(join(leanFixture, f), join(src, f));
		const config = JSON.parse(await readFile(join(leanFixture, "lean-bridge.exports.json")));
		config.targets.cpp = { name: "pulse", version: "1.0.0" };
		await writeFile(join(src, "lean-bridge.exports.json"), canonicalJson(config));
		if(ordinary) await writeFile(join(src, "pulse.binding-ir.json"), canonicalJson(ordinary));
		await run(process.execPath, [cli, "build", "--project", src, "--target", "cpp", "--output", output, "--format", "json"], root);
		const api = JSON.parse(await readFile(join(output, "binding-ir.json")));
		const provenance = JSON.parse(await readFile(join(output, "host-export-evidence.json")));
		assert.equal(provenance.reviewedSourceSha256, ordinary ? sha256(canonicalJson(ordinary)) : null);
		if(ordinary) assert.deepEqual(api, ordinary);
		ordinary = api;
		let kept;
		if(retain)
		{
			await mkdir(resolve(retain), { recursive: true }); kept = join(resolve(retain), route); await mkdir(kept);
			await mkdir(join(kept, "archives")); await mkdir(join(kept, "source"));
			for(const f of await readdir(src)) await copyFile(join(src, f), join(kept, "source", f));
			for(const f of await readdir(output)) if(f !== "archives") await copyFile(join(output, f), join(kept, f));
			for(const f of await readdir(join(output, "archives"))) await copyFile(join(output, "archives", f), join(kept, "archives", basename(f)));
		}
		await rm(src, { recursive: true });
		const accepted = await replay(kept ?? output, root, route, consumer);
		assert.equal(accepted.bindingIrSha256, hashBindingIr(api));
		assert.equal(accepted.sourceTreeSha256, provenance.sourceTreeSha256);
		if(kept)
		{
			for(const f of ["consumer.cpp", "CMakeLists.txt"]) await copyFile(join(consumer, f), join(kept, f));
			await writeFile(join(kept, "acceptance.json"), canonicalJson(accepted), { flag: "wx" });
		}
	}
});
