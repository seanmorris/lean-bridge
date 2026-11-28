/** @file Drive a real compiled Lean member through the Perl XS exception boundary. */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { generateLeanHostObjectAdapters } from "../../src/backends/lean/host-object.mjs";
import { perlHostMembers } from "../../src/backends/perl/host-members.mjs";

const exec = promisify(execFile);
test("compiled Lean calls real Perl across a protected, reentrant XS frame", {timeout: 180_000}, async t => {
	const root = await mkdtemp(join(tmpdir(), "perl-host-frame-"));
	t.after(() => rm(root, {recursive: true, force: true}));
	const fixture = resolve("tests/fixtures/perl-host-meter"), lean = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
	const env = {...process.env, LEAN_PATH: root, LEAN_SRC_PATH: root, LEAN_SYSROOT: lean, LEAN_NUM_THREADS: "1"};
	const run = async (cmd, args) => (await exec(cmd, args, {cwd: root, env})).stdout.trim();
	const ir = JSON.parse(await readFile("tests/fixtures/ruby-host-meter/lean-bridge.hosts.json", "utf8"));
	ir.types[0].host.targets = ["perl"];
	const d = ir.declarations[0]; d.parameters = ir.declarations.find(m => m.kind === "constructor").parameters;
	d.name = "observe"; d.id = "host:meter.Box.observe"; d.overloadKey = "Box.observe"; d.source.declaration = d.overloadKey;
	d.kind = "static-method"; d.receiver = null; ir.declarations = [d];
	const model = perlHostMembers(ir, "LeanBridge::Workshop");
	assert.deepEqual(model.slots.map(m => m.symbol), ["lean_bridge_host_perl_box_observe"]);
	await mkdir(join(root, "LeanBridge/Host"), {recursive: true});
	await mkdir(join(root, "LeanBridge/Workshop"), {recursive: true});
	const name = "LeanBridge/Host/Perl";
	await writeFile(join(root, name + ".lean"), generateLeanHostObjectAdapters(ir)[name + ".lean"]);
	await writeFile(join(root, "LeanBridge/Workshop/_HostMembers.pm"), model.implementation);
	await copyFile(join(fixture, "FrameCheck.lean"), join(root, "FrameCheck.lean"));
	for(const [module, c] of [[name, "host.c"], ["FrameCheck", "app.c"]])
		await run(join(lean, "bin/lean"), ["-j1", "-R", root, "-o", module + ".olean", "-c", c, module + ".lean"]);
	const perl = process.env.LEAN_BRIDGE_PERL ?? "perl", cc = process.env.CC ?? "cc";
	const core = await run(perl, ["-MConfig", "-e", "print $Config{archlibexp}, '/CORE'"]);
	const opts = (await run(perl, ["-MConfig", "-e", "print $Config{ccflags}"])).split(/\s+/u).filter(Boolean);
	await run(cc, [...opts, "-shared", "-fPIC", "-O1", "-g0", "-pthread"
		, "-Werror=implicit-function-declaration"
		, "-I" + core
		, "-I" + join(lean, "include")
		, "-I" + resolve("src/backends/perl")
		, "host.c"
		, "app.c"
		, join(fixture, "frame-check.c")
		, "-L" + join(lean, "lib/lean")
		, "-Wl,-rpath," + join(lean, "lib/lean")
		, "-lleanshared"
		, "-o"
		, "host-check.so"]);
	const result = await exec(perl, ["-I.", join(fixture, "frame-check.pl")], {cwd: root, env});
	assert.equal(result.stderr, ""); assert.match(result.stdout, /original fault, mapped EIO, replacement IO, owner and cleanup/u);
	t.diagnostic(result.stdout.trim());
});
