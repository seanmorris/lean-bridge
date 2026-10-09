/**
 * Real Python startup and pip controls on both pinned floors. The tiny wheel tests the
 * environment guard only; compiled Lean execution is covered by the separate observer suite.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { createDeterministicZip } from "../src/release/deterministic-zip.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { installCopiedConsumer, runCopied } from "./helpers/copied-fixture-install.mjs";
import { createFinContainerEdgePythonEnvironment, finContainerEdgePythonFlags, installFinContainerEdgePython, runFinContainerEdgePython, verifyFinContainerEdgePythonEnvironment } from "./helpers/fin-container-edge-python-closure.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const sourceGate = process.env.LEAN_BRIDGE_FIN_CONTAINER_EDGE_SOURCE_TEST === "1";
const receiptPath = "lean_fincontainers/lean_bridge/package-receipt.json";
const distInfo = "lean_fincontainers-1.0.0.dist-info";

const wheel = async (root, injection) => {
	const stage = join(root, "stage"), archive = join(root, "lean_fincontainers-1.0.0-py3-none-any.whl");
	await saveLakeFile(stage, "lean_fincontainers/__init__.py", 'VALUE = "verified"\n');
	await saveLakeFile(stage, `${distInfo}/METADATA`, "Metadata-Version: 2.1\nName: lean-fincontainers\nVersion: 1.0.0\n");
	await saveLakeFile(stage, `${distInfo}/WHEEL`, "Wheel-Version: 1.0\nGenerator: guard-test\nRoot-Is-Purelib: true\nTag: py3-none-any\n");
	const files = {};
	for(const path of await nativeArtifactPaths(stage))
	{
		const bytes = await readFile(join(stage, path)); files[path] = { bytes: bytes.length, sha256: sha256(bytes) };
	}
	await saveLakeFile(stage, receiptPath, canonicalJson({ files }));
	if(injection) await saveLakeFile(stage, "injected.pth", injection);
	const record = [...await nativeArtifactPaths(stage), `${distInfo}/RECORD`].map(path => `${path},,`).join("\n") + "\n";
	await saveLakeFile(stage, `${distInfo}/RECORD`, record);
	const bytes = await createDeterministicZip({ directory: stage, sourceDateEpoch: 315532800 });
	await saveLakeFile(root, "lean_fincontainers-1.0.0-py3-none-any.whl", bytes);
	return { archive, archiveSha256: sha256(bytes) };
};

test("Python bootstrap refuses existing environments and unsafe bytecode prefixes before execution", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-python-closure-existing-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	await assert.rejects(createFinContainerEdgePythonEnvironment({ baseCommand: "/unavailable/python", venv: root, cwd: root }), /refuse any pre-existing/u);
	await symlink("missing", join(root, "broken"));
	await assert.rejects(createFinContainerEdgePythonEnvironment({ baseCommand: "/unavailable/python", venv: join(root, "broken"), cwd: root }), /refuse any pre-existing/u);
	for(const cache of ["relative", "/tmp/invalid\0prefix"]) assert.throws(() => finContainerEdgePythonFlags(cache));
	assert.deepEqual(finContainerEdgePythonFlags("/owned/cache"), ["-I", "-B", "-X", "pycache_prefix=/owned/cache"]);
});

for(const [floor, version] of [["311", "3.11.16"], ["312", "3.12.14"]])
	test(`Python ${version} authenticates pip metadata and refuses startup and bytecode injections`, { skip: !sourceGate }, async t => {
		const root = await mkdtemp(join(tmpdir(), `lean-bridge-python-${floor}-closure-`));
		t.after(() => rm(root, { recursive: true, force: true }));
		const baseCommand = resolve(`.toolchains/python${floor}/bin/python3`), clean = join(root, "clean");
		await mkdir(clean);
		const original = await wheel(clean), consumer = join(root, "consumer");
		const artifact = { path: "lean_fincontainers-1.0.0-py3-none-any.whl", sha256: original.archiveSha256 };
		const packages = [{ role: "component", name: "lean-fincontainers", version: "1.0.0", artifacts: [artifact] }];
		const source = 'import lean_fincontainers\nassert lean_fincontainers.VALUE == "verified"\nprint("python-closure-ok:1")\n';
		const installed = await installCopiedConsumer({ profile: "python", consumer
			, handoff: clean, packages
			, environment: { LEAN_BRIDGE_PYTHON: baseCommand }
			, fixture: { source: () => source, success: "python-closure-ok", expectedChecks: 1, installPython: installFinContainerEdgePython } });
		assert.equal(installed.checks, 1);
		let context = installed.pythonEnvironment;
		assert.equal(context.python, version);
		const identity = await verifyFinContainerEdgePythonEnvironment(context);
		const cwd = join(consumer, "python"), site = join(context.venv, context.site), marker = join(root, "executed");
		const code = `import pathlib; pathlib.Path(${JSON.stringify(marker)}).write_text('executed')`;
		const call = () => runFinContainerEdgePython(context, ["-c", "import lean_fincontainers; print(lean_fincontainers.VALUE)"], cwd);
		assert.equal((await call()).stdout, "verified\n");
		assert.ok(Object.keys(context.entries).some(path => path.endsWith(`${distInfo}/INSTALLER`)));
		assert.ok(Object.keys(context.entries).some(path => path.endsWith(`${distInfo}/RECORD`)));
		if(floor === "311") assert.ok(Object.keys(context.entries).some(path => path.endsWith("distutils-precedence.pth")), "legitimate bundled startup hook remains authenticated");
		const startup = Object.keys(context.entries).find(path => path.endsWith(".pth"));
		if(startup)
		{
			const bytes = await readFile(join(context.venv, startup));
			await saveLakeFile(context.venv, startup, Buffer.concat([bytes, Buffer.from(code + "\n")]));
			await assert.rejects(call(), /Python environment drift: .*\.pth/u);
			await assert.rejects(access(marker), { code: "ENOENT" });
			await saveLakeFile(context.venv, startup, bytes);
		}
		const compiled = Object.keys(context.entries).find(path => path.endsWith(".pyc"));
		assert.ok(compiled, "the venv's original compiled bootstrap files are also pinned");
		const compiledBytes = await readFile(join(context.venv, compiled));
		await saveLakeFile(context.venv, compiled, Buffer.concat([compiledBytes, Buffer.from("changed")]));
		await assert.rejects(call(), /Python environment drift: .*\.pyc/u);
		await saveLakeFile(context.venv, compiled, compiledBytes);
		for(const path of ["injected.pth", "sitecustomize.py"])
		{
			await saveLakeFile(site, path, code + "\n");
			await assert.rejects(call(), /unrecorded or missing Python environment entry/u);
			await assert.rejects(access(marker), { code: "ENOENT" });
			// Demonstrate that normal startup executes the identical injected bytes without the guard.
			await runCopied(installed.command, ["-I", "-B", "-c", "pass"], cwd);
			assert.equal(await readFile(marker, "utf8"), "executed");
			await rm(marker); await rm(join(site, path));
		}
		await saveLakeFile(site, "usercustomize.py", code + "\n");
		await assert.rejects(call(), /unrecorded or missing Python environment entry/u);
		await rm(join(site, "usercustomize.py"));
		await saveLakeFile(context.venv, "__proto__", "unrecorded");
		await assert.rejects(call(), /unrecorded or missing Python environment entry/u);
		await rm(join(context.venv, "__proto__"));
		await symlink(join(clean, "stage/lean_fincontainers/__init__.py"), join(site, "unlisted.py"));
		await assert.rejects(call(), /unrecorded or missing Python environment entry/u);
		await rm(join(site, "unlisted.py"));
		const module = join(site, "lean_fincontainers/__init__.py");
		const poison = `import importlib.util, importlib._bootstrap_external as b, pathlib\np = pathlib.Path(${JSON.stringify(module)})\nc = pathlib.Path(importlib.util.cache_from_source(str(p)))\nc.parent.mkdir(exist_ok=True)\ns = p.stat()\nc.write_bytes(b._code_to_timestamp_pyc(compile(${JSON.stringify(code + '\nVALUE = "poisoned"\n')}, str(p), 'exec'), int(s.st_mtime), s.st_size))\n`;
		await runCopied(baseCommand, ["-I", "-B", "-S", "-c", poison], cwd);
		await assert.rejects(call(), /unrecorded or missing Python environment entry/u);
		await assert.rejects(access(marker), { code: "ENOENT" });
		const cache = join(root, "empty-bytecode-prefix"); await mkdir(cache);
		const probe = ["-c", "import lean_fincontainers; print(lean_fincontainers.VALUE)"];
		assert.equal((await runCopied(installed.command, [...finContainerEdgePythonFlags(cache), ...probe], cwd)).stdout, "verified\n");
		assert.deepEqual(await readdir(cache), []); await assert.rejects(access(marker), { code: "ENOENT" });
		assert.equal((await runCopied(installed.command, ["-I", "-B", ...probe], cwd)).stdout, "poisoned\n", "-B alone still reads valid cached bytecode");
		assert.equal(await readFile(marker, "utf8"), "executed");
		await rm(marker); await rm(join(site, "lean_fincontainers/__pycache__"), { recursive: true });
		const config = await readFile(join(context.venv, "pyvenv.cfg"), "utf8");
		await saveLakeFile(context.venv, "pyvenv.cfg", config.replace("include-system-site-packages = false", "include-system-site-packages = true"));
		await assert.rejects(call(), /Python environment drift: pyvenv.cfg/u);
		await saveLakeFile(context.venv, "pyvenv.cfg", config);
		const metadata = await readFile(join(site, `${distInfo}/INSTALLER`));
		await saveLakeFile(site, `${distInfo}/INSTALLER`, "changed");
		await assert.rejects(call(), /Python environment drift: .*INSTALLER/u);
		await saveLakeFile(site, `${distInfo}/INSTALLER`, metadata);
		await assert.rejects(runFinContainerEdgePython(context, ["-c", `from pathlib import Path; Path(${JSON.stringify(join(site, "extra.py"))}).write_text('changed')`], cwd), /unrecorded or missing Python environment entry/u);
		await rm(join(site, "extra.py"));
		await assert.rejects(runFinContainerEdgePython(context, ["-c", "import sys, pathlib; pathlib.Path(sys.pycache_prefix, 'unexpected').touch()"], cwd), /must not write the isolated bytecode cache/u);
		assert.ok(!(await readdir(cwd)).some(path => path.startsWith(".fin-edge-python-bytecode-")));
		const moved = `${consumer}-moved`; await rename(consumer, moved);
		context = { ...context, venv: join(moved, "python/venv") };
		assert.deepEqual(await verifyFinContainerEdgePythonEnvironment(context), identity);
		assert.equal((await runFinContainerEdgePython(context, probe, join(moved, "python"))).stdout, "verified\n");
		const hostile = join(root, "hostile"); await mkdir(hostile);
		const injected = await wheel(hostile, code + "\n"), attempt = join(root, "attempt"); await mkdir(attempt);
		await assert.rejects(installFinContainerEdgePython({ baseCommand, root: attempt, ...injected }), /unrecorded or missing Python environment entry/u);
		await assert.rejects(access(marker), { code: "ENOENT" }, "unlisted .pth is refused before the first post-install Python startup");
		await runCopied(join(attempt, "venv/bin/python"), ["-I", "-B", "-c", "pass"], attempt);
		assert.equal(await readFile(marker, "utf8"), "executed");
		t.diagnostic(JSON.stringify({ python: version
			, scope: "synthetic wheel startup controls, not Lean installed acceptance"
			, bootstrapEntries: Object.keys(context.entries).length, relocated: true
			, startupInjectionRefused: true, poisonedBytecodeRefused: true }));
	});
