/**
 * Install a package selected exclusively by its producer protocols.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";

const exec = promisify(execFile), enabled = process.env.LEAN_BRIDGE_HOST_OBJECT_TEST === "1";
const python = resolve(process.env.LEAN_BRIDGE_HOST_PYTHON ?? ".toolchains/python311/bin/python3");
const leanPrefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
const fixture = resolve("tests/fixtures/python-lean-stream-only"), cli = resolve("scripts/lean-bridge.mjs");

test("a stream-only package installs pure and IO factories with shared private operations", { skip: !enabled, timeout: 360_000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-stream-only-")), project = join(root, "project"), output = join(root, "release");
	t.after(() => rm(root, { recursive: true, force: true }));
	await mkdir(project);
	const inputs = ["Signals.lean", "lean-bridge.exports.json", "lean-toolchain", "lakefile.toml"];
	for(const f of inputs) await copyFile(join(fixture, f), join(project, f));
	const run = async (...args) => {
		const { stdout } = await exec(process.execPath, [cli, ...args, "--format", "json"], { cwd: root
			, env: { ...process.env, LEAN_BRIDGE_PYTHON: python, LEAN_BRIDGE_LEAN_PREFIX: leanPrefix } })
			.catch(e => { throw new Error(`${e.message}\n${e.stdout}\n${e.stderr}`, { cause: e }); });
		return JSON.parse(stdout);
	};
	const wrongTarget = join(root, "unsupported");
	await assert.rejects(run("build", "--project", project, "--target", "maven", "--output", wrongTarget), /Select one native IO target/u);
	await assert.rejects(access(wrongTarget), { code: "ENOENT" });
	await run("build", "--project", project, "--target", "pypi", "--output", output);
	const receipt = join(output, "package-set-receipt.json");
	assert.equal((await run("verify", "--receipt", receipt)).result.archives, 2);
	const api = JSON.parse(await readFile(join(output, "binding-ir.json")));
	assert.deepEqual(api.declarations.map(d => [d.name, d.resultMode]), [["checked", "async-iterator"], ["constant", "async-iterator"]]);
	assert.deepEqual(api.declarations.map(d => d.failure.errors), [["error:IO.Error"], []]);
	let kept;
	const retain = process.env.LEAN_BRIDGE_HOST_OBJECT_EVIDENCE_DIR;
	if(retain)
	{
		const packages = JSON.parse(await readFile(receipt)).packages;
		const wheel = packages.find(p => p.role === "component").artifacts[0];
		const tag = basename(wheel.path).split("-").slice(-3).join("-").replace(/\.whl$/u, "");
		kept = resolve(retain, "stream-only", tag);
		await mkdir(join(kept, "source"), { recursive: true });
		for(const f of inputs) await copyFile(join(project, f), join(kept, "source", f), constants.COPYFILE_EXCL);
		for(const f of ["native-release.json", "host-export-evidence.json", "binding-ir.json", "package-set-receipt.json", "package-set-receipt.json.sha256"])
			await copyFile(join(output, f), join(kept, f), constants.COPYFILE_EXCL);
		for(const p of packages)
		{
			const a = p.artifacts[0], dest = p.role === "runtime" ? resolve(retain, "wheels") : kept;
			await mkdir(dest, { recursive: true });
			const target = join(dest, basename(a.path));
			try
			{ await copyFile(join(output, a.path), target, constants.COPYFILE_EXCL); }
			catch(e)
			{ if(p.role !== "runtime" || e.code !== "EEXIST") throw e; }
			assert.equal(sha256(await readFile(target)), a.sha256);
		}
	}
	const installed = join(root, "installed"), consumer = join(root, "consumer");
	await exec(python, ["-I", "-m", "pip", "--isolated", "--disable-pip-version-check", "install", "--no-index", "--no-cache-dir", "--only-binary", ":all:", "--find-links", join(output, "archives"), "--target", installed, "lean-signals==1.0.0"]);
	await rm(output, { recursive: true }); await rm(project, { recursive: true });
	await rename(installed, consumer);
	await copyFile(join(fixture, "installed.py"), join(root, "app.py"));
	await copyFile(join(fixture, "audit.py"), join(root, "audit.py"));
	const { stdout, stderr } = await exec(python, ["-S", "-B", "audit.py"], { cwd: root
		, env: { PATH: "/unavailable", PYTHONPATH: consumer, LEAN_NUM_THREADS: "1" } });
	assert.equal(stderr, ""); assert.match(stdout, /installed standalone stream-only package/u);
	assert.match(stdout, /retired runtime: existing and new pulls refused, cursor lease released/u);
	if(kept)
	{
		for(const f of ["app.py", "audit.py"]) await copyFile(join(root, f), join(kept, f));
		await writeFile(join(kept, "acceptance.json"), canonicalJson({ route: "ordinary", offline: true, relocated: true, stdout }));
	}
});
