/** @file Exercise one native JVM host registry from independently compiled components. */
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { generateJvmHostMembers } from "../../src/backends/jvm/host-members.mjs";
import { generateLeanHostObjectAdapters } from "../../src/backends/lean/host-object.mjs";
import { linuxBrokerHeader, linuxBrokerSource } from "../../src/backends/native/runtime-broker.mjs";
import { compileJvmHostDomain, compileJvmIOOwner } from "../../src/build/jvm-io-owner.mjs";
import { sha256 } from "../../src/capsule/node.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";

test("two independently linked JVM components share nominal Lean wrappers across isolated classloaders", { timeout: 300_000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "jvm-shared-host-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const fixture = resolve("tests/fixtures/jvm-host-members"), lean = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
	const java = process.env.JAVA_HOME ?? dirname(dirname(await realpath(await run("which", ["javac"], root, process.env))));
	const cc = process.env.CC ?? "cc", flags = ["-XX:ActiveProcessorCount=1", "-XX:+UseSerialGC", "-Xmx96m"];
	const shared = join(root, "shared"), sdk = join(root, "sdk"), install = join(root, "install"), client = join(root, "client");
	for(const dir of [shared, sdk, install, client]) await mkdir(dir);
	await symlink(join(lean, "lib/lean"), join(sdk, "lib"));
	const cmd = (name, args, cwd = shared, env = process.env) => run(name, args, cwd, env);
	const save = (dir, name, data) => writeFile(join(dir, name), data, { flag: "wx" });
	const compileJava = (cwd, args) => cmd(join(java, "bin/javac"), [...flags.map(f => "-J" + f), "--release", "22", ...args], cwd);
	await compileJava(client, ["-d", client, join(fixture, "Port.java"), join(fixture, "SharedHost.java")]);
	// The witness and runtime are dependencies, not part of either component.
	await save(shared, "lean_bridge_native_runtime.h", linuxBrokerHeader);
	await save(shared, "broker.c", linuxBrokerSource);
	const common = ["-std=gnu11", "-O1", "-g0", "-DNDEBUG", "-shared", "-fPIC", "-I" + join(lean, "include")];
	const libs = ["-L" + join(sdk, "lib"), "-lleanshared", "-Wl,-z,defs", "-Wl,-rpath,$ORIGIN"];
	await cmd(cc, [...common, "broker.c", join(fixture, "refs-witness.c"), ...libs, "-pthread", "-Wl,-soname,libwitness.so", "-o", "libwitness.so"]);
	const input = JSON.parse(await readFile("tests/fixtures/ruby-host-meter/lean-bridge.hosts.json", "utf8"));
	const box = input.types[0], identity = input.declarations.find(d => d.name === "identity");
	box.host.targets = ["jvm"];
	const key = structuredClone(box); key.id = "host:meter.Key"; key.name = "Key"; key.resource.kindId = "resource:meter.Key"; key.host.identity = "strong-canonical";
	const method = structuredClone(identity);
	method.owner = key.id; method.id = key.id + ".identity"; method.overloadKey = "Key.identity";
	method.result.type.id = key.id; method.receiver.type.id = key.id; method.source.declaration = "Key.identity";
	input.types = [box, key]; input.declarations = [identity, method];
	const runtimeIdentity = sha256("jvm-host-domain-test-runtime");
	const reports = [];
	for(const component of ["alpha", "beta"])
	{
		const app = join(root, component);
		await mkdir(join(app, "LeanBridge/Host"), { recursive: true });
		const tools = { app, runtimeRoot: sdk, leanPrefix: lean, javaHome: java, runtimeIdentity, cc, run: cmd };
		const owner = await compileJvmIOOwner(tools), domain = await compileJvmHostDomain({ ...tools, owner });
		const binaries = await Promise.all([owner.name, domain.name].map(n => readFile(join(app, n))));
		const hashes = binaries.map(sha256);
		if(reports.length) assert.deepEqual(hashes, reports[0]);
		else for(const [i, n] of [owner.name, domain.name].entries()) await save(install, n, binaries[i]);
		reports.push(hashes);
		const generated = await generateJvmHostMembers(input);
		assert.deepEqual(generated.members.map(m => m.symbol), ["lean_bridge_host_jvm_box_identity", "lean_bridge_host_jvm_key_identity"]);
		const header = ["#define COMPONENT " + JSON.stringify(component)
			, "#define CALL Java_experiment_" + component + "_PortImpl_call"
			, "#define COUNT Java_experiment_" + component + "_PortImpl_count"
			, "static const lb_jhd_spec specs[]={" + generated.kinds.map(k => "{" + JSON.stringify(k.key) + "," + Number(k.strong) + "}").join(",") + "};"];
		await save(app, "component.h", header.join("\n") + "\n");
		const module = "LeanBridge/Host/Jvm";
		await save(app, module + ".lean", generateLeanHostObjectAdapters(input)[module + ".lean"]);
		await copyFile(join(fixture, "SharedRefs.lean"), join(app, "SharedRefs.lean"));
		const env = { ...process.env, LEAN_NUM_THREADS: "1", LEAN_PATH: app, LEAN_SRC_PATH: app, LEAN_SYSROOT: lean };
		for(const [m, c] of [[module, "host.c"], ["SharedRefs", "refs.c"]])
			await cmd(join(lean, "bin/lean"), ["-j1", "-R", app, "-o", m + ".olean", "-c", c, m + ".lean"], app, env);
		await save(app, "exports.map", "{ global: Java_experiment_" + component + "_PortImpl_*; local: *; };\n");
		const build = [...common, ...domain.includes, owner.flag, domain.flag];
		await cmd(cc, [...build, "-I.", "-I" + shared
			, "host.c"
			, "refs.c"
			, "host-frame.c"
			, join(fixture, "refs-component.c")
			, "-L."
			, "-l:" + owner.name
			, "-l:" + domain.name
			, "-L" + shared
			, "-lwitness"
			, ...libs
			, "-Wl,--version-script=exports.map"
			, "-o"
			, join(install, "lib" + component + ".so")], app);
		const pkg = "package experiment." + component + ";\n";
		await save(app, "HostMembers.java", pkg + generated.implementation);
		await save(app, "HostContract.java", pkg + generated.contract);
		const impl = (await readFile(join(fixture, "PortImpl.java"), "utf8")).replace("System.loadLibrary(LIBRARY)", "System.loadLibrary(" + JSON.stringify(component) + ")");
		await save(app, "PortImpl.java", pkg + impl); await mkdir(join(app, "classes"));
		await compileJava(app, ["-classpath", client, "-d", "classes", "HostMembers.java", "HostContract.java", "PortImpl.java"]);
		await cmd(join(java, "bin/jar"), [...flags.map(f => "-J" + f), "--create", "--file", join(install, component + ".jar"), "-C", "classes", "."], app);
		await rm(app, { recursive: true });
	}
	const env = { ...process.env, LD_LIBRARY_PATH: [install, shared, join(lean, "lib/lean")].join(":") };
	for(const [a, b] of [["alpha", "beta"], ["beta", "alpha"]])
	{
		const vm = [...flags, "-Xcheck:jni", "-Djava.library.path=" + install];
		const output = await cmd(join(java, "bin/java"), [...vm, "-cp", client
			, "experiment.SharedHost"
			, join(install, a + ".jar"), join(install, b + ".jar"), a, b], client, env);
		assert.equal(output, "shared Lean pointer; distinct equal objects and nominal kinds; partial bind rollback; last close retired strong pin");
	}
	t.diagnostic("Same owner and domain bytes in both builds: " + reports[0].join(" / "));
});
