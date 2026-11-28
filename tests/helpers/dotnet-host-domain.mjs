/** @file Two isolated CLR assemblies call independently linked Lean components. */
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { generateDotnetNativeMembers } from "../../src/backends/dotnet/host-native-members.mjs";
import { dotnetWorkerKinds } from "../../src/backends/dotnet/host-members.mjs";
import { generateLeanHostObjectAdapters } from "../../src/backends/lean/host-object.mjs";
import { linuxBrokerHeader, linuxBrokerSource } from "../../src/backends/native/runtime-broker.mjs";
import { compileDotnetHostDomain } from "../../src/build/dotnet-host-domain.mjs";
import { sha256 } from "../../src/capsule/node.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";

test("CLR nominal identity and ownership survive separate Lean components and collectible assembly contexts", { timeout: 300000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "dotnet-host-domain-")); t.after(() => rm(root, { recursive: true, force: true }));
	const fixture = resolve("tests/fixtures/dotnet-host-domain"), backend = resolve("src/backends/dotnet");
	const lean = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
	const dotnet = process.env.LEAN_BRIDGE_DOTNET ?? "dotnet", cc = process.env.CC ?? "cc";
	const install = join(root, "install"), sdk = join(root, "sdk");
	for(const p of [install, sdk]) await mkdir(p);
	await symlink(join(lean, "lib/lean"), join(sdk, "lib"));
	const env = { ...process.env, DOTNET_NOLOGO: "1"
		, DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_CLI_HOME: root
		, DOTNET_SKIP_FIRST_TIME_EXPERIENCE: "1"
		, DOTNET_CLI_WORKLOAD_UPDATE_NOTIFY_DISABLE: "1"
		, DOTNET_PROCESSOR_COUNT: "1"
		, MSBUILDDISABLENODEREUSE: "1"
		, NUGET_PACKAGES: join(root, "offline") };
	const cmd = (tool, args, cwd = root, e = env) => run(tool, args, cwd, e);
	const save = (dir, name, value) => writeFile(join(dir, name), value, { flag: "wx" });
	const config = join(root, "NuGet.Config");
	await save(root, "NuGet.Config", "<configuration><packageSources><clear/></packageSources></configuration>");
	const build = async (app, name, output) => {
		await save(app, name + ".csproj", '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>' + output + '</OutputType><TargetFramework>net8.0</TargetFramework><AllowUnsafeBlocks>true</AllowUnsafeBlocks><Nullable>enable</Nullable><TreatWarningsAsErrors>true</TreatWarningsAsErrors></PropertyGroup></Project>');
		await cmd(dotnet, ["restore", "--configfile", config, "--disable-parallel", "-m:1", "-p:NuGetAudit=false"], app);
		await cmd(dotnet, ["build", "--no-restore", "--disable-build-servers", "-m:1", "-p:UseSharedCompilation=false", "-c", "Release"], app);
		const files = output === "Exe" ? [".dll", ".runtimeconfig.json", ".deps.json"] : [".dll"];
		for(const ext of files) await copyFile(join(app, "bin/Release/net8.0/" + name + ext), join(install, name + ext));
	};
	await save(root, "lean_bridge_native_runtime.h", linuxBrokerHeader); await save(root, "broker.c", linuxBrokerSource);
	const flags = ["-std=gnu11", "-O1", "-g0", "-DNDEBUG", "-shared", "-fPIC", "-I" + join(lean, "include")];
	const libs = ["-L" + join(sdk, "lib"), "-lleanshared", "-Wl,-z,defs", "-Wl,-rpath,$ORIGIN"];
	const leaseFlags=["-DLB_LEASE_PREFIX=lb_clr_probe_","-I"+resolve("src/backends/native"),"-I"+root];
	await cmd(cc, [...flags, ...leaseFlags, "broker.c", resolve("src/backends/native/task-resource-ledger.c"), resolve("tests/fixtures/jvm-host-members/refs-witness.c"), ...libs, "-pthread", "-Wl,-soname,libwitness.so", "-o", join(install, "libwitness.so")]);
	const ir = JSON.parse(await readFile("tests/fixtures/ruby-host-meter/lean-bridge.hosts.json", "utf8"));
	const box = ir.types[0]; box.host.targets = ["dotnet"];
	const key = structuredClone(box); key.id = "host:meter.Key"; key.name = "Key"; key.resource.kindId = "resource:meter.Key"; key.host.identity = "strong-canonical";
	ir.types.push(key);
	const identity = ir.declarations.find(d => d.name === "identity");
	const method = structuredClone(identity); method.owner = key.id; method.id = key.id + ".identity"; method.overloadKey = "Key.identity";
	method.result.type.id = key.id; method.receiver.type.id = key.id; method.source.declaration = method.overloadKey;
	const child = structuredClone(identity); child.id = box.id + ".child"; child.name = "child"; child.source.declaration = child.overloadKey = "Box.child";
	child.result.ownership = "borrow"; child.result.lifetime = { scope: "receiver", anchor: "receiver" };
	ir.declarations.push(child, method);
	const runtimeIdentity = sha256("dotnet-private-domain-test-runtime"), domains = [];
	for(const name of ["alpha", "beta"])
	{
		const app = join(root, name); await mkdir(join(app, "LeanBridge/Host"), { recursive: true });
		const domain = await compileDotnetHostDomain({ app, runtimeRoot: sdk, runtimeIdentity, leanPrefix: lean, run: cmd, cc });
		const bytes = await readFile(join(app, domain.name)); domains.push(sha256(bytes));
		if(domains.length === 1) await save(install, domain.name, bytes); else assert.equal(domains[0], domains[1]);
		const g = await generateDotnetNativeMembers(ir), m = "LeanBridge/Host/Dotnet";
		await save(app, m + ".lean", generateLeanHostObjectAdapters(ir)[m + ".lean"]);
		await copyFile(join(fixture, "SharedRefs.lean"), join(app, "SharedRefs.lean"));
		const le = { ...env, LEAN_NUM_THREADS: "1", LEAN_PATH: app, LEAN_SRC_PATH: app, LEAN_SYSROOT: lean };
		for(const [module, c] of [[m, "host.c"], ["SharedRefs", "refs.c"]])
			await cmd(join(lean, "bin/lean"), ["-j1", "-R", app, "-o", module + ".olean", "-c", c, module + ".lean"], app, le);
		await save(app, "checked.c", '#include "host.c"\n#include "externs.h"\n');
		await save(app, "externs.h", g.header); await save(app, "generated.c", g.native);
		await save(app, "exports.map", "{ global: test_call; test_visit; test_object; local: *; };\n");
		const specs = g.kinds.map(k => "{" + JSON.stringify(k.key) + "," + Number(k.strong) + "}").join(",");
		const keys=dotnetWorkerKinds(ir).map(k=>JSON.stringify(k.hash)).join(",");
		await save(app, "component.h", "#define COMPONENT " + JSON.stringify(name) + "\nstatic const lb_dnd_spec specs[]={" + specs + "};\nstatic const char *const worker_keys[]={"+keys+"};\n");
		await cmd(cc, [...flags, domain.flag, "-I.", "-I" + root
			, "-I" + backend, "-I" + resolve("src/backends/c")
			, ...leaseFlags, join(backend,"worker-ledger.c")
			, "checked.c", "refs.c", "host-frame.c", "generated.c"
			, join(fixture, "component.c")
			, "-L."
			, "-l:" + domain.name
			, "-L" + install
			, "-lwitness"
			, ...libs
			, "-Wl,--version-script=exports.map"
			, "-o"
			, join(install, name + ".so")], app);
		await copyFile(join(backend,"host-worker-frame.cs"),join(app,"WorkerFrame.cs"));
		await save(app, "HostMembers.cs", g.implementation); await save(app, "HostContract.cs", "namespace LeanBridge.GeneratedHost;\n" + g.contract);
		await copyFile(join(backend, "host-wire.cs"), join(app, "HostWire.cs")); await copyFile(join(fixture, "Port.cs"), join(app, "Port.cs"));
		await build(app, name, "Library"); await rm(app, { recursive: true });
	}
	const client = join(root, "client"); await mkdir(client); await copyFile(join(fixture, "Client.cs"), join(client, "Client.cs"));
	await build(client, "Client", "Exe"); await rm(client, { recursive: true });
	for(const order of [["alpha", "beta"], ["beta", "alpha"]])
	{
		const output = await cmd(dotnet, [join(install, "Client.dll"), ...order.map(n => join(install, n))], install, { LANG: "C.UTF-8", PATH: "/no-publisher-tools", LD_LIBRARY_PATH: join(lean, "lib/lean"), LEAN_NUM_THREADS: "1", DOTNET_PROCESSOR_COUNT: "1" });
		assert.equal(output, "CLR shared Lean pointer; distinct kinds and equal objects; anchored borrow; rollback; zero handles; both contexts unloaded");
	}
	t.diagnostic("Both independently built domains: " + domains[0]);
});
