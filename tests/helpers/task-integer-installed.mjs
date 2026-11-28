/**
 * Install and independently replay exact-integer C and C++ task releases.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { gmpIdentity } from "../../src/backends/c/gmp.mjs";
import { taskGmpKit } from "../../src/build/task-gmp.mjs";
const exec = promisify(execFile), fx = resolve("tests/fixtures/exact-task-integers"), cli = resolve("scripts/lean-bridge.mjs");
const inputs = ["Wide.lean", "lakefile.toml", "lean-toolchain", "lean-bridge.exports.json"];
const run = async (bin, args, cwd, env = process.env) => {
	try
	{ return (await exec(bin, args, { cwd, env })).stdout; }
	catch(e)
	{ throw new Error(`${e.message}\n${e.stdout}\n${e.stderr}`, { cause: e }); }
};
test("a prepared integer dependency cannot authenticate itself or substitute a header", async t => {
	const root = await mkdtemp(join(tmpdir(), "task-gmp-negative-")); t.after(() => rm(root, { recursive: true, force: true }));
	const dest = join(root, "staged"), share = join(root, "share/lean-bridge");
	const stage = env => taskGmpKit({ root: dest, environment: env });
	await assert.rejects(stage({ LEAN_BRIDGE_TASK_GMP_ROOT: root }), /independently pinned/u);
	await assert.rejects(stage({ LEAN_BRIDGE_TASK_GMP_SHA256: "0".repeat(64) }), /independently pinned/u);
	await mkdir(share, { recursive: true }); await mkdir(join(root, "include"));
	const expected = Buffer.from("expected header"), header = join(root, "include/gmp.h");
	const paths = ["include/gmp.h", "lib/libgmp.so.10", ...["COPYING", "COPYING.LESSERv3", "COPYINGv2", "COPYINGv3"].map(n => "share/lean-bridge/licenses/GMP-" + n)];
	const doc = canonicalJson({ ...gmpIdentity, checked: true, configure: ["ABI=64", "--enable-shared", "--host=x86_64-pc-linux-gnu"], files: Object.fromEntries(paths.map(path => [path, { bytes: expected.length, sha256: sha256(expected) }])) });
	await writeFile(join(share, "gmp.json"), doc);
	const env = { LEAN_BRIDGE_TASK_GMP_ROOT: root, LEAN_BRIDGE_TASK_GMP_SHA256: sha256(doc) };
	await assert.rejects(stage({ ...env, LEAN_BRIDGE_TASK_GMP_SHA256: "0".repeat(64) }), /receipt digest mismatch/u);
	await writeFile(header, "tampered header");
	await assert.rejects(stage(env), /payload differs: include\/gmp.h/u);
	await rename(header, join(root, "elsewhere")); await symlink(join(root, "elsewhere"), header);
	await assert.rejects(stage(env), /Unexpected link/u);
	await assert.rejects(readFile(join(dest, "include/gmp.h")), { code: "ENOENT" });
});
const exercise = async (work, dir, target, route, fixture) => {
	const out = join(dir, "handoff"), receiptPath = join(out, "package-set-receipt.json");
	const { receipt, result } = await readVerifiedPackageSetReceipt({ receiptPath });
	const [pkg] = receipt.packages, [archive] = pkg.artifacts, tag = `${target}-${route}`;
	assert.deepEqual([pkg.target, pkg.profile, pkg.runtimeDelivery], [target, `native-${target}-task-v1`, "embedded"]);
	assert.equal(receipt.profiles.length, 1);
	const original = join(work, `unpacked-${tag}`), prefix = join(work, `installed-${tag}`), client = join(work, `client-${tag}`);
	await mkdir(original); await mkdir(client);
	await run("tar", ["-xzf", join(out, archive.path), "--strip-components=1", "-C", original], work);
	await rename(original, prefix);
	const manifest = JSON.parse(await readFile(join(prefix, "lean-bridge-package.json")));
	assert.equal(manifest.exactIntegers, target === "c" ? "gmp-6.3.0" : "boost-1.90.0");
	assert.equal(manifest.bindingIrSha256, receipt.profiles[0].bindingIrSha256);
	assert.equal(manifest.runtimeIdentity, pkg.runtimeIdentity);
	for(const [file, info] of Object.entries(manifest.files))
	{
		const b = await readFile(join(prefix, file)); assert.equal(b.length, info.bytes); assert.equal(sha256(b), info.sha256);
	}
	assert.equal(Object.hasOwn(manifest.files, "lib/libgmp.so.10"), target === "c");
	const file = "consumer." + target, cpp = target === "cpp", bin = cpp ? process.env.CXX ?? "c++" : process.env.CC ?? "cc";
	await copyFile(join(fixture, file), join(client, file));
	await copyFile(join(fixture, "CMakeLists.txt"), join(client, "CMakeLists.txt"));
	const env = { ...process.env, PKG_CONFIG_PATH: "", PKG_CONFIG_LIBDIR: join(prefix, "lib/pkgconfig"), LD_PRELOAD: "", LD_LIBRARY_PATH: "", LEAN_PATH: "", LEAN_SYSROOT: "" };
	const libs = (await run("pkg-config", ["--libs", "--cflags", "wide"], client, env)).trim().split(/\s+/u);
	assert.ok(libs.includes(cpp ? "-DBOOST_MP_STANDALONE" : "-l:libgmp.so.10"));
	await run(bin, [cpp ? "-std=c++20" : "-std=c11", "-Wall", "-Wextra", "-Werror", file, ...libs, "-o", "app"], client, env);
	const check = async app => {
		const loaded = (await run("ldd", [app], client, env)).split("\n").map(v => v.trim());
		if(cpp) assert.ok(!loaded.some(v => /^libgmp(?:[-.]|$)/u.test(v)), "Boost consumer must not load a GMP DSO");
		for(const lib of ["liblbc_wide.so", "liblean_bridge_native.so", "libleanshared.so", ...cpp ? [] : ["libgmp.so.10"]])
			assert.ok(loaded.some(v => v.startsWith(`${lib} => ${prefix}/`)), lib);
		assert.equal((await run(app, [], client, env)).trim(), "exact installed " + target + " tasks: ok");
	};
	await check(join(client, "app"));
	const cmake = process.env.LEAN_BRIDGE_C_TASK_CMAKE ?? "cmake";
	await run(cmake, ["-S", ".", "-B", "build", `-DCMAKE_PREFIX_PATH=${prefix}`, `-DEXACT_TARGET=${target}`], client, env);
	await run(cmake, ["--build", "build", "--parallel", "1"], client, env);
	await check(join(client, "build/exact"));
	await copyFile(join(fixture, "word-boundaries.c"), join(client, "word-boundaries.c"));
	await run(bin, ["-x", cpp ? "c++" : "c", cpp ? "-std=c++20" : "-std=c11", "-Wall", "-Wextra", "-Werror", "word-boundaries.c", ...libs, "-o", "boundaries"], client, env);
	assert.equal((await run(join(client, "boundaries"), [], client, env)).trim(), "32 exact integer boundaries: ok");
	const proof = JSON.parse(await readFile(join(out, "host-export-evidence.json")));
	assert.equal(proof.sourceTreeSha256, receipt.source.treeSha256);
	const report = { target, route, archive
		, receiptSha256: result.receiptSha256
		, bindingIrSha256: manifest.bindingIrSha256
		, sourceTreeSha256: proof.sourceTreeSha256
		, reviewedSourceSha256: proof.reviewedSourceSha256
		, runtimeIdentity: pkg.runtimeIdentity
		, componentIdentity: manifest.componentIdentity
		, consumerSha256: sha256(await readFile(join(client, file)))
		, dependencyReceiptSha256: manifest.files[`share/lean-bridge/${cpp ? "boost" : "gmp"}.json`].sha256
		, installations: ["pkg-config", "CMake"], result: "passed" };
	return { prefix, report };
};

test("installed C/GMP and C++/Boost tasks preserve arbitrary integers through every delivery channel", {
	skip: process.env.LEAN_BRIDGE_TASK_INTEGER_TEST !== "1" && !process.env.LEAN_BRIDGE_TASK_INTEGER_REPLAY
	, timeout: 3_600_000
}, async t => {
	const work = await mkdtemp(join(tmpdir(), "exact-task-consumers-")); t.after(() => rm(work, { recursive: true, force: true }));
	const replay = process.env.LEAN_BRIDGE_TASK_INTEGER_REPLAY;
	const retained = resolve(replay ?? process.env.LEAN_BRIDGE_TASK_INTEGER_EVIDENCE ?? join(work, "evidence"));
	if(!replay) await mkdir(retained, { recursive: true });
	let ir, kitEnv = process.env;
	for(const target of ["c", "cpp"]) for(const route of ["ordinary", "reviewed"])
	{
		const tag = `${target}-${route}`, dir = join(retained, tag);
		if(!replay)
		{
			await mkdir(dir);
			const src = join(work, `producer-${tag}`);
			await mkdir(src); await mkdir(join(dir, "source"));
			for(const path of inputs)
			{
				await copyFile(join(fx, path), join(src, path));
				await copyFile(join(fx, path), join(dir, "source", path));
			}
			if(route === "reviewed")
			{
				await writeFile(join(src, "wide.binding-ir.json"), canonicalJson(ir));
				await copyFile(join(src, "wide.binding-ir.json"), join(dir, "source/wide.binding-ir.json"));
			}
			await run(process.execPath, [cli, "build", "--project", src, "--target", target, "--output", join(dir, "handoff"), "--format", "json"], work, kitEnv);
			await rm(src, { recursive: true });
		}
		const api = JSON.parse(await readFile(join(dir, "handoff/binding-ir.json")));
		if(ir) assert.deepEqual(api, ir); else ir = api;
		const { prefix, report } = await exercise(work, dir, target, route, replay ? dir : fx);
		assert.equal(report.bindingIrSha256, hashBindingIr(ir));
		assert.equal(report.reviewedSourceSha256, route === "reviewed" ? sha256(canonicalJson(ir)) : null);
		if(replay) assert.deepEqual(report, JSON.parse(await readFile(join(dir, "acceptance.json"))));
		else
		{
			for(const f of ["consumer." + target, "CMakeLists.txt", "word-boundaries.c"]) await copyFile(join(fx, f), join(dir, f));
			await writeFile(join(dir, "acceptance.json"), canonicalJson(report), { flag: "wx" });
		}
		// A second independent package build can reuse the dependency bytes
		// authenticated by the first verified release, not its Lean component.
		if(target === "c" && route === "ordinary") kitEnv = { ...process.env, LEAN_BRIDGE_TASK_GMP_ROOT: prefix, LEAN_BRIDGE_TASK_GMP_SHA256: report.dependencyReceiptSha256 };
		t.diagnostic(`${tag}: ${report.receiptSha256} passed pkg-config and CMake`);
	}
});
