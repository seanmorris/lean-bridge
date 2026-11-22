/**
 * Load an original completion-only C archive beside a callback-capable archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";

const exec = promisify(execFile), previous = process.env.LEAN_BRIDGE_C_CALLBACK_PRIOR, current = process.env.LEAN_BRIDGE_C_CALLBACK_REPLAY;
test("old and new installed C archives negotiate the actual loaded native broker before starting a retained task", {
	skip: !previous || !current, timeout: 240_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "c-broker-")); t.after(() => rm(root, { recursive: true, force: true }));
	const old = JSON.parse(await readFile("docs/evidence/c-task-streams-20261122.json")).releases.find(x => x.route === "ordinary");
	const handoffs = [resolve(previous), join(resolve(current), "ordinary/handoff")], prefixes = [], receipts = [];
	for(const [i, h] of handoffs.entries())
	{
		const { result, receipt } = await readVerifiedPackageSetReceipt({ receiptPath: join(h, "package-set-receipt.json") });
		assert.deepEqual(result.profiles, ["native-c-task-v1"]); const [pkg] = receipt.packages, [archive] = pkg.artifacts;
		assert.equal(pkg.name, i ? "c-retained" : "pulse");
		if(!i)
		{
			assert.equal(result.receiptSha256, old.packageSetReceiptSha256);
			assert.deepEqual(archive, old.archive);
		}
		const prefix = join(root, i ? "new" : "old"); prefixes.push(prefix); receipts.push(result.receiptSha256);
		await mkdir(prefix); await exec("tar", ["-xzf", join(h, archive.path), "--strip-components=1", "-C", prefix]);
	}
	const src = resolve("tests/fixtures/c-retained-tasks/coexist.c");
	const env = { ...process.env
		, LD_PRELOAD: "", LD_LIBRARY_PATH: "", PKG_CONFIG_PATH: ""
		, PKG_CONFIG_LIBDIR: prefixes.map(p => join(p, "lib/pkgconfig")).join(":") };
	const { stdout } = await exec("pkg-config", ["--cflags", "--libs", "pulse", "c-retained"], { env });
	const exe = join(root, "consumer"); await exec(env.CC ?? "cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", src, ...stdout.trim().split(/\s+/u), "-ldl", "-o", exe], { env });
	for(const [i, order] of ["old-first", "new-first"].entries())
		await exec(exe, [order], { env: { PATH: "/nonexistent", LD_BIND_NOW: "1", LD_LIBRARY_PATH: [prefixes[i], prefixes[1-i]].map(p => join(p, "lib")).join(":") } });
	if(process.env.LEAN_BRIDGE_C_CALLBACK_ABI_REPORT)
		await writeFile(process.env.LEAN_BRIDGE_C_CALLBACK_ABI_REPORT, canonicalJson({ receipts, sourceSha256: sha256(await readFile(src)), runtimeOrders: ["old-first", "new-first"] }), { flag: "wx" });
});
