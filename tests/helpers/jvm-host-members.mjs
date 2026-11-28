/** @file Execute generated host member adapters against real public JDK classes. */
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { generateJvmHostApi } from "../../src/backends/jvm/host-api.mjs";
import { generateJvmHostMembers } from "../../src/backends/jvm/host-members.mjs";
import { generateLeanHostObjectAdapters } from "../../src/backends/lean/host-object.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";

test("Java projects a declared error with two distinct nominal leaves without unchecked casts", async t => {
	const root = await mkdtemp(join(tmpdir(), "jvm-error-types-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const named = id => ({ kind: "named", id });
	const sum = (a,b) => ({ kind: "apply", constructor: "result", arguments: [a,b] });
	const ir = { types: [{ id: "left" }, { id: "right" }] };
	const error = sum(named("right"),sum(named("left"),named("right")));
	const api = { component: { name: "projection" } }, model = { contract: "", implementation: "" };
	const hash = "0".repeat(64), veneer = { name: "liblb_jni_"+hash+".so", sha256: hash };
	const result = { kind: "primitive", name: "unit" };
	const entries = [{ name: "both", declaration: "Checks.both", effect: "EIO", parameters: [], result, error }];
	const { files } = generateJvmHostApi({ api, ir, model, evidence: null, veneer, entries });
	for(const name of ["BothError.java", "LeanEIOError.java", "Result.java"])
		await writeFile(join(root,name),files["src/main/java/org/leanbridge/projection/"+name]);
	await copyFile(resolve("tests/fixtures/jvm-host-members/Projection.java"),join(root,"Projection.java"));
	const bin = n => process.env.JAVA_HOME ? join(process.env.JAVA_HOME,"bin",n) : n;
	await run(bin("javac"), ["-J-XX:ActiveProcessorCount=1","-J-Xmx96m","--release","22","-Xlint:unchecked","-Werror","-d",root,"BothError.java","LeanEIOError.java","Result.java","Projection.java"],root,process.env);
	assert.equal(await run(bin("java"),["-XX:ActiveProcessorCount=1","-Xmx64m","-cp",root,"org.leanbridge.projection.Projection"],root,process.env),"two nominal types; checked active branches");
});

test("JVM binds exact public members, preserves objects and throws the original exception", { timeout: 120_000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "jvm-checked-members-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = JSON.parse(await readFile("tests/fixtures/ruby-host-meter/lean-bridge.hosts.json", "utf8"));
	const box = ir.types[0], first = ir.declarations[0];
	box.host.targets = ["jvm"];
	const peer = structuredClone(box); peer.name = "Peer"; peer.id += ".peer"; peer.resource.kindId += ".peer"; ir.types.push(peer);
	const peerRead = structuredClone(first);
	peerRead.id += ".peer"; peerRead.owner = peer.id; peerRead.receiver.type.id = peer.id; peerRead.overloadKey = "Peer.read()";
	ir.declarations.push(peerRead);
	const make = ir.declarations.find(d => d.kind === "constructor");
	for(const [name, type] of [["twice", "uint32"], ["big", "nat"], ["ch", "char"], ["text", "string"], ["data", "bytes"], ["peer", null]])
	{
		const d = structuredClone(first), p = structuredClone(make.parameters[0]);
		d.name = name; d.id = "host:meter.Box." + name; d.overloadKey = "Box." + name; d.source.declaration = d.overloadKey;
		if(type)
{ p.type.name = type; d.result.type.name = type; }
		else
		{
			p.type = { kind: "named", id: peer.id }; p.ownership = "borrow"; p.lifetime = { scope: "call", anchor: null };
			d.result = { type: p.type, ownership: "lease", lifetime: { scope: "explicit", anchor: null } };
		}
		if(name === "twice")
{ d.kind = "static-method"; d.receiver = null; }
		d.parameters = [p]; ir.declarations.push(d);
	}
	const { contract, members, implementation } = await generateJvmHostMembers(ir);
	const files = { HostContract: contract, HostMembers: implementation
	, Slots: "final class Slots {"
		+ members.map((m, i) => m.owner === 0 ? "static final int " + m.name + "=" + i + ";" : "").join("") + "}" };
	for(const [name, src] of Object.entries(files)) await writeFile(join(root, name + ".java"), "package example;\n" + src);
	await copyFile(resolve("tests/fixtures/jvm-host-members/CheckedMembers.java"), join(root, "CheckedMembers.java"));
	const bin = name => process.env.JAVA_HOME ? join(process.env.JAVA_HOME, "bin", name) : name;
	const flags = ["-XX:ActiveProcessorCount=1", "-XX:+UseSerialGC", "-Xmx96m"];
	await run(bin("javac"), [...flags.map(f => "-J" + f), "--release", "22", "-d", root, ...Object.keys(files).map(n => n + ".java"), "CheckedMembers.java"], root, process.env);
	assert.equal(await run(bin("java"), [...flags, "-cp", root, "example.CheckedMembers"], root, process.env), "exact members, object identity, checked scalars and original Throwable");
});

test("compiled Lean calls a real Java method and preserves faults across the serialized JVM owner", { timeout: 240_000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "jvm-native-members-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const fixture = resolve("tests/fixtures/jvm-host-members"), backend = resolve("src/backends/jvm");
	const lean = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
	const java = process.env.JAVA_HOME ?? dirname(dirname(await realpath((await run("which", ["javac"], root, process.env)).trim())));
	const env = { ...process.env, LEAN_NUM_THREADS: "1", LEAN_PATH: root, LEAN_SRC_PATH: root, LEAN_SYSROOT: lean };
	const tool = (name, args) => run(name, args, root, env);
	const ir = JSON.parse(await readFile("tests/fixtures/ruby-host-meter/lean-bridge.hosts.json", "utf8"));
	ir.types[0].host.targets = ["jvm"];
	const d = ir.declarations[0]; d.parameters = ir.declarations.find(m => m.kind === "constructor").parameters;
	d.name = "observe"; d.id = "host:meter.Box.observe"; d.overloadKey = "Box.observe"; d.source.declaration = "Box.observe";
	d.kind = "static-method"; d.receiver = null; ir.declarations = [d];
	const { contract, implementation, members } = await generateJvmHostMembers(ir);
	assert.deepEqual(members.map(m => m.symbol), ["lean_bridge_host_jvm_box_observe"]);
	const name = "LeanBridge/Host/Jvm", leanFiles = generateLeanHostObjectAdapters(ir);
	await mkdir(join(root, "LeanBridge/Host"), { recursive: true });
	await writeFile(join(root, name + ".lean"), leanFiles[name + ".lean"]);
	await copyFile(join(fixture, "FrameCheck.lean"), join(root, "FrameCheck.lean"));
	for(const [module, c] of [[name, "host.c"], ["FrameCheck", "app.c"]])
		await tool(join(lean, "bin/lean"), ["-j1", "-R", root, "-o", module + ".olean", "-c", c, module + ".lean"]);
	const lib = join(root, "host-check.so");
	const cc = process.env.CC ?? "cc";
	const options = ["-shared", "-fPIC", "-O1", "-g0", "-pthread"];
	await tool(cc, [...options, "-Werror=implicit-function-declaration"
		, "-DLB_JVM_OWNER_PREFIX=lb_test_owner_"
		, "-I" + join(java, "include")
		, "-I" + join(java, "include/linux")
		, "-I" + join(lean, "include")
		, "-I" + backend
		, "host.c"
		, "app.c"
		, join(backend, "host-frame.c")
		, join(backend, "io-owner.c")
		, join(fixture, "frame-check.c")
		, "-L" + join(lean, "lib/lean")
		, "-Wl,-rpath," + join(lean, "lib/lean")
		, "-Wl,-z,defs"
		, "-lleanshared"
		, "-o"
		, lib]);
	await writeFile(join(root, "HostMembers.java"), "package example;\n" + implementation);
	await writeFile(join(root, "HostContract.java"), "package example;\n" + contract);
	const flags = ["-XX:ActiveProcessorCount=1", "-XX:+UseSerialGC", "-Xmx96m"];
	await tool(join(java, "bin/javac"), [...flags.map(f => "-J" + f), "--release", "22", "-d", root, "HostMembers.java", "HostContract.java", join(fixture, "FrameCheck.java")]);
	assert.equal(await tool(join(java, "bin/java"), [...flags, "-Xcheck:jni", "-cp", root, "example.FrameCheck", lib]), "compiled Lean: inline reentry, exact throwable, replacement IO, typed EIO, virtual thread");
});
