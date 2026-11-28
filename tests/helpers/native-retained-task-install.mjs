/**
 * Install, relocate, and exercise native callback releases with no producer on the consumer path.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { promisify } from "node:util";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";

const json = async path => JSON.parse(await readFile(path));
const exec = promisify(execFile);
const run = async (cmd, args, cwd, env) => {
	try
	{ return (await exec(cmd, args, { cwd, env, maxBuffer: 4 << 20 })).stdout.trim(); }
	catch(e)
	{ throw new Error(e.message + "\n" + e.stdout + "\n" + e.stderr, { cause: e }); }
};
const digest = async file => {
	const h = createHash("sha256");
	for await(const chunk of createReadStream(file)) h.update(chunk);
	return h.digest("hex");
};
const sourceHashes = async dir => Object.fromEntries(await Promise.all((await readdir(dir)).sort().map(async f => [f, await digest(join(dir, f))])));
const clients = {
	cpp: { files: ["consumer.cpp", "scalars.hpp", "audit.hpp", "CMakeLists.txt"]
		, example: "example.hpp", guide: "cpp"
		, summary: "C++: retained callbacks, coroutine reentry, exact exceptions, cancellation and cleanup passed"
		, modes: ["trap", "peer-trap", "cancel-trap", "retire", "shutdown"] }
	, c: { files: ["consumer.c", "scalars.h", "audit.h", "CMakeLists.txt"]
		, example: "example.h", guide: "c"
		, summary: "C11: one-descriptor dispatch, error identity, cancellation and cleanup passed"
		, modes: ["trap", "peer-trap", "cancel-trap", "retire"] }
};

/**
 * Save the exact installed consumer, including the public guide example.
 *
 * @param release - New handoff directory.
 * @param target - Native language profile.
 */
export const captureNativeCallbackClient = async (release, target) => {
	const client = clients[target];
	const dir = join(release, "client"); await mkdir(dir);
	for(const f of client.files) await copyFile(resolve("tests/fixtures/" + target + "-retained-tasks", f), join(dir, f));
	const guide = (await readFile("docs/consume/" + target + ".md", "utf8")).split("### Pass a callback to a Lean task\n")[1];
	await writeFile(join(dir, client.example), guide.split("`".repeat(3) + client.guide + "\n")[1].split("`".repeat(3))[0], { flag: "wx" });
};

/**
 * Authenticate the actual archives, compile applications and run relocated executables.
 *
 * @param options - Disposable install directory and original release handoff.
 */
export const runNativeCallbackInstall = async options => {
	const { root, release, target } = options, spec = clients[target], cpp = target === "cpp";
	const env = { ...process.env, LEAN_PATH: "", LEAN_SYSROOT: "", LD_PRELOAD: "", LD_LIBRARY_PATH: "", PKG_CONFIG_PATH: "" };
	const client = join(root, "client"), deployment = join(root, "deploy"), routes = [];
	await cp(join(release, "client"), client, { recursive: true, errorOnExist: true });
	assert.deepEqual((await readdir(client)).sort(), [...spec.files, spec.example].sort());
	const clientSources = await sourceHashes(client), prefixes = [];
	let ordinary, runtime;
	await mkdir(deployment);
	for(const route of ["ordinary", "reviewed"])
	{
		const dir = join(release, route), handoff = join(dir, "handoff");
		const { receipt, result } = await readVerifiedPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		assert.deepEqual(result.profiles, ["native-" + target + "-task-v1"]); assert.equal(result.archives, 1);
		const [pkg] = receipt.packages, [archive] = pkg.artifacts, name = target + (route === "ordinary" ? "-retained" : "-peer");
		assert.deepEqual([pkg.target, pkg.name, pkg.runtimeDelivery], [target, name, "embedded"]);
		const sources = await sourceHashes(join(dir, "source"));
		const tree = Object.keys(sources).sort((a, b) => a.localeCompare(b)).map(p => sources[p] + "  " + p + "\n").join("");
		assert.equal(sha256(tree), receipt.source.treeSha256);
		const api = await json(join(handoff, "binding-ir.json")), evidence = await json(join(handoff, "host-export-evidence.json"));
		assert.equal(hashBindingIr(api), receipt.profiles[0].bindingIrSha256); assert.equal(evidence.sourceTreeSha256, receipt.source.treeSha256);
		assert.equal(evidence.selection[target + "TaskCallbacks"], true);
		assert.equal(evidence.selection[(cpp ? "c" : "cpp") + "TaskCallbacks"], undefined); assert.equal(evidence.selection.rustTaskCallbacks, undefined);
		assert.equal(evidence.selection.pythonTaskCallbacks, undefined);
		assert.equal(evidence.reviewedSourceSha256, ordinary ? sha256(canonicalJson(ordinary)) : null);
		if(ordinary) assert.deepEqual(api, ordinary); else ordinary = api;
		const cb = api.declarations.find(d => d.name === "repeat_call");
		assert.equal(cb.parameters[1].ownership, "lease"); assert.equal(cb.parameters[1].lifetime.scope, "explicit");
		assert.deepEqual(new Set(cb.failure.errors), new Set(["error:TaskIO.Error", cpp ? "error:CppCallbackException" : "error:CCallbackError"]));
		assert.equal(api.declarations.find(d => d.name === "recover").failure.mode, "none");
		const prefix = join(root, "installed-" + route); prefixes.push(prefix); await mkdir(prefix);
		await run("tar", ["-xzf", join(handoff, archive.path), "--strip-components=1", "-C", prefix], root, env);
		const manifest = await json(join(prefix, "lean-bridge-package.json"));
		assert.equal(manifest.bindingIrSha256, hashBindingIr(api)); assert.equal(manifest.runtimeIdentity, pkg.runtimeIdentity);
		assert.equal(manifest.exactIntegers, cpp ? "boost-1.90.0" : "gmp-6.3.0");
		if(cpp)
		{
			assert.equal(manifest.cppTaskSupportAbi, 2);
			assert.ok(manifest.files["include/lean_bridge/async_v2/task-callback.hpp"]);
		}
		else assert.ok(manifest.files["lib/libgmp.so.10"]);
		assert.ok(!manifest.files["include/lean_bridge/async_v1/task-loop.hpp"]);
		for(const [p, info] of Object.entries(manifest.files))
		{
			const file = join(prefix, p);
			assert.equal((await stat(file)).size, info.bytes, p); assert.equal(await digest(file), info.sha256, p);
		}
		if(runtime) assert.equal(runtime, pkg.runtimeIdentity); else runtime = pkg.runtimeIdentity;
		routes.push({ route, archive
			, sourceTreeSha256: receipt.source.treeSha256
			, receiptSha256: result.receiptSha256
			, bindingIrSha256: hashBindingIr(api)
			, componentIdentity: manifest.componentIdentity
			, extractorSha256: evidence.extractorSha256 });
	}
	assert.notEqual(routes[0].componentIdentity, routes[1].componentIdentity);
	env.PKG_CONFIG_LIBDIR = prefixes.map(p => join(p, "lib/pkgconfig")).join(":");
	const flags = (await run("pkg-config", ["--cflags", "--libs", target + "-retained", target + "-peer"], client, env)).split(/\s+/u);
	const compiler = cpp ? env.CXX ?? "c++" : env.CC ?? "cc", cmake = env.LEAN_BRIDGE_C_TASK_CMAKE ?? "cmake";
	await run(compiler, [cpp ? "-std=c++20" : "-std=c11", "-Wall", "-Wextra", "-Werror", spec.files[0], ...flags, "-pthread", "-ldl", "-o", join(deployment, "pkg-config-client")], client, env);
	await run(cmake, ["-S", ".", "-B", "build", "-DCMAKE_PREFIX_PATH=" + prefixes.join(";")], client, env);
	await run(cmake, ["--build", "build", "--parallel", "1"], client, env);
	await copyFile(join(client, "build/consumer"), join(deployment, "cmake-client"));
	await rm(client, { recursive: true });
	for(const p of prefixes) await rename(p, join(deployment, basename(p)));
	const lib = prefixes.map(p => join(deployment, basename(p), "lib"));
	const isolated = { PATH: "/nonexistent", LANG: "C", LD_LIBRARY_PATH: lib.join(":"), LEAN_PATH: "", LD_PRELOAD: "" };
	for(const name of ["pkg-config-client", "cmake-client"])
	{
		const exe = join(deployment, name), loaded = await run("ldd", [exe], deployment, { ...env, LD_LIBRARY_PATH: lib.join(":") });
		for(const [i, component] of ["liblbc_" + target + "_retained.so", "liblbc_" + target + "_peer.so"].entries()) assert.ok(loaded.includes(component + " => " + join(lib[i], component)));
		for(const shared of ["liblean_bridge_native.so", "libleanshared.so", ...cpp ? [] : ["libgmp.so.10"]]) assert.ok(lib.some(path => loaded.includes(shared + " => " + join(path, shared))));
		assert.equal(await run(exe, [], deployment, isolated), spec.summary);
		for(const mode of spec.modes) await run(exe, [mode], deployment, isolated);
	}
	return { schemaVersion: 1, runtimeIdentity: runtime, routes, clientSources, installers: ["pkg-config", "CMake"], isolated: spec.modes };
};
