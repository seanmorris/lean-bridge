/**
 * Link an authenticated completion-only C++ archive and a callback-capable archive into one executable.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";

const previous = process.env.LEAN_BRIDGE_CPP_TASK_ABI_PREVIOUS, current = process.env.LEAN_BRIDGE_CPP_CALLBACK_REPLAY;
const exec = promisify(execFile);
test("independent C++ task support ABIs coexist in both header search orders", { skip: !previous || !current, timeout: 360_000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "cpp-abi-pair-")); t.after(() => rm(root, { recursive: true, force: true }));
	const source = resolve("tests/fixtures/cpp-retained-tasks/abi-skew.cpp"), file = join(root, "client.cpp");
	await copyFile(source, file);
	const record = JSON.parse(await readFile("docs/evidence/cpp-task-streams-20261122.json")).releases.find(x => x.route === "ordinary");
	const release = [resolve(previous), join(resolve(current), "ordinary/handoff")], roots = [], receipts = [];
	for(const [i, path] of release.entries())
	{
		const { result, receipt } = await readVerifiedPackageSetReceipt({ receiptPath: join(path, "package-set-receipt.json") });
		assert.deepEqual(result.profiles, ["native-cpp-task-v1"]); assert.equal(result.archives, 1);
		const pkg = receipt.packages[0], artifact = pkg.artifacts[0];
		assert.equal(pkg.name, i ? "cpp-retained" : "pulse");
		if(!i)
		{ assert.equal(result.receiptSha256, record.packageSetReceiptSha256); assert.deepEqual(artifact, record.archive); }
		const prefix = join(root, i ? "current" : "previous"); await mkdir(prefix); roots.push(prefix); receipts.push(result.receiptSha256);
		await exec("tar", ["-xzf", join(path, artifact.path), "--strip-components=1", "-C", prefix]);
		const manifest = JSON.parse(await readFile(join(prefix, "lean-bridge-package.json")));
		assert.equal(manifest.cppTaskSupportAbi, i ? 2 : undefined);
		assert.ok(manifest.files["include/lean_bridge/async_v" + (i + 1) + "/task-loop.hpp"]);
	}
	for(const order of [roots, roots.toReversed()])
	{
		const oldFirst = order[0] === roots[0], exe = join(root, oldFirst ? "old-first" : "new-first");
		const names = oldFirst ? ["pulse", "cpp-retained"] : ["cpp-retained", "pulse"];
		const env = { ...process.env, PKG_CONFIG_PATH: "", PKG_CONFIG_LIBDIR: order.map(p => join(p, "lib/pkgconfig")).join(":"), LD_PRELOAD: "" };
		const { stdout } = await exec("pkg-config", ["--cflags", "--libs", ...names], { env });
		await exec(env.CXX ?? "c++", ["-std=c++20", "-Wall", "-Wextra", "-Werror", ...oldFirst ? ["-DOLDER_FIRST"] : [], file, ...stdout.trim().split(/\s+/u), "-o", exe], { env });
		await exec(exe, [], { env: { PATH: "/nonexistent", LD_LIBRARY_PATH: order.map(p => join(p, "lib")).join(":") } });
	}
	if(process.env.LEAN_BRIDGE_CPP_TASK_ABI_REPORT)
		await writeFile(process.env.LEAN_BRIDGE_CPP_TASK_ABI_REPORT, canonicalJson({ receipts, sourceSha256: sha256(await readFile(file)), includeOrders: ["old-first", "new-first"] }), { flag: "wx" });
});
