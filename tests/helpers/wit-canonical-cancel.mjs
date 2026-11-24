/** @file Check cancellation inside a real Lean worker through relocated WIT packages. */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFile, cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";

const exec = promisify(execFile), json = async path => JSON.parse(await readFile(path));
const cli = resolve("scripts/lean-bridge.mjs"), fixture = resolve("tests/fixtures/wit-canonical-cancel");
const tools = process.env.LEAN_BRIDGE_WASM_TOOLS ?? "wasm-tools";

test("installed canonical stream cancellation is visible to its Lean worker", { timeout: 900000 }, async t => {
	const temp = await mkdtemp(join(tmpdir(), "wit-cancel-"));
	t.after(() => rm(temp, { recursive: true, force: true }));
	const guest = join(temp, "application.wasm");
	await exec(tools, ["parse", join(fixture, "application.wat"), "-o", guest]);
	await exec(tools, ["validate", "--features", "cm-async,cm-async-builtins", guest]);
	const hashes = new Set();
	let ordinary;
	for(const route of ["ordinary", "reviewed"])
	{
		const replay = process.env["LEAN_BRIDGE_CANONICAL_CANCEL_" + route.toUpperCase()];
		const out = replay ? resolve(replay) : join(temp, route);
		if(!replay)
		{
			const src = join(temp, route + "-src"); await mkdir(src);
			for(const file of ["lean-toolchain", "lakefile.toml", "lean-bridge.exports.json", "Watch.lean"])
				await copyFile(join(fixture, file), join(src, file));
			await copyFile(resolve("LICENSE"), join(src, "LICENSE"));
			if(ordinary) await writeFile(join(src, "watch.binding-ir.json"), canonicalJson(ordinary));
			await exec(process.execPath, [cli, "build", "--project", src, "--target", "wit-wasi", "--output", out, "--json", "--progress", "none"])
				.catch(e => { throw new Error(e.message + "\n" + e.stdout + "\n" + e.stderr); });
			await rm(src, { recursive: true });
		}
		const api = await json(join(out, "binding-ir.json")), evidence = await json(join(out, "host-export-evidence.json"));
		if(!ordinary) ordinary = api;
		assert.deepEqual(api, ordinary);
		assert.equal(evidence.reviewedSourceSha256, route === "ordinary" ? null : sha256(canonicalJson(ordinary)));
		const { receipt } = await readVerifiedPackageSetReceipt({ receiptPath: join(out, "package-set-receipt.json") });
		assert.equal(receipt.packages.length, 1);
		const [pkg] = receipt.packages, [archive] = pkg.artifacts;
		assert.equal(pkg.profile, "native-wit-canonical-task-v1");
		assert.ok(!hashes.has(archive.sha256)); hashes.add(archive.sha256);
		const save = process.env.LEAN_BRIDGE_CANONICAL_CANCEL_SAVE;
		if(save && !replay)
		{
			const dest = join(resolve(save), route);
			await cp(out, dest, { recursive: true, force: false, errorOnExist: true });
		}
		const area = await mkdtemp(join(temp, "install-")), dest = join(area, "relocated watch");
		await exec("tar", ["-xzf", join(out, archive.path), "-C", area, "--no-same-owner", "--no-same-permissions"]);
		await rename(join(area, basename(archive.path, ".tar.gz")), dest);
		if(!replay) await rm(out, { recursive: true });
		const inner = await json(join(dest, "lean-bridge-package.json"));
		assert.equal(inner.bindingIrSha256, hashBindingIr(api));
		await exec(tools, ["component", "targets", join(dest, inner.world), guest]);
		const { stdout, stderr } = await exec(join(dest, inner.command), [guest], {
			cwd: area
			, env: { PATH: "/no-consumer-tools", LEAN_NUM_THREADS: "1", RAYON_NUM_THREADS: "1" }
			, timeout: 20000
		});
		assert.equal(stderr, "");
		assert.equal(stdout.trim(), "423", "normal delivery, cooperative exit, then discarded late computation");
		t.diagnostic(route + " " + archive.bytes + " " + archive.sha256 + " — observed " + stdout.trim());
		await rm(area, { recursive: true });
	}
});
