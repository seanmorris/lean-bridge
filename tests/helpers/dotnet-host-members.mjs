/** @file Execute compiled Lean against real CLR methods; do not confuse a managed reflection test with a native call. */
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { generateDotnetHostMembers } from "../../src/backends/dotnet/host-members.mjs";
import { generateDotnetNativeMembers } from "../../src/backends/dotnet/host-native-members.mjs";
import { wordHostFrame } from "../../src/backends/native/word-host-frame.mjs";
import { generateLeanHostObjectAdapters } from "../../src/backends/lean/host-object.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";

test("compiled Lean calls a bound CLR member without unwinding a managed exception through native frames", { timeout: 300000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "dotnet-host-frame-")); t.after(() => rm(root, { recursive: true, force: true }));
	await writeFile(join(root, "host-frame.c"), await wordHostFrame("dotnet"));
	const app = join(root, "app"); await mkdir(app);
	const fixture = resolve("tests/fixtures/dotnet-host-meter"), backend = resolve("src/backends/dotnet");
	const lean = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
	const dotnet = process.env.LEAN_BRIDGE_DOTNET ?? "dotnet";
	const env = { ...process.env, LEAN_NUM_THREADS: "1", LEAN_PATH: root
		, LEAN_SRC_PATH: root, LEAN_SYSROOT: lean
		, DOTNET_NOLOGO: "1", DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_CLI_HOME: root
		, DOTNET_SKIP_FIRST_TIME_EXPERIENCE: "1"
		, DOTNET_CLI_WORKLOAD_UPDATE_NOTIFY_DISABLE: "1"
		, DOTNET_PROCESSOR_COUNT: "1"
		, MSBUILDDISABLENODEREUSE: "1"
		, NUGET_PACKAGES: join(root, "offline") };
	const tool = (cmd, args, cwd = root) => run(cmd, args, cwd, env);
	const ir = JSON.parse(await readFile("tests/fixtures/ruby-host-meter/lean-bridge.hosts.json", "utf8"));
	ir.types[0].host.targets = ["dotnet"];
	const d = structuredClone(ir.declarations[0]); d.parameters = ir.declarations.find(m => m.kind === "constructor").parameters;
	d.name = "observe"; d.id = "host:meter.Box.observe"; d.overloadKey = "Box.observe"; d.source.declaration = "Box.observe";
	d.kind = "static-method"; d.receiver = null;
	const tags = ["unit", "bool", "char", "uint8", "uint16", "uint32", "uint64", "usize", "int8", "int16", "int32", "int64", "isize", "float32", "float64", "string", "bytes", "nat", "int"];
	const echo = tags.map(tag => {
		const method = structuredClone(d), name = "echo_" + tag;
		method.name = name; method.id = "host:meter.Box." + name; method.overloadKey = "Box." + name; method.source.declaration = method.overloadKey;
		method.result.type.name = tag; method.parameters[0].type.name = tag; return method;
	});
	const imports = { ...ir, declarations: [d, ...echo] }; ir.declarations.unshift(...imports.declarations);
	const { implementation, contract, members } = await generateDotnetHostMembers(ir);
	const generated = await generateDotnetNativeMembers(imports);
	assert.deepEqual(generated.members.map(m => m.id), members.slice(0, 20).map(m => m.id));
	await writeFile(join(root, "provider.c"), generated.native); await writeFile(join(root, "externs.h"), generated.header);
	const name = "LeanBridge/Host/Dotnet"; await mkdir(join(root, "LeanBridge/Host"), { recursive: true });
	await writeFile(join(root, name + ".lean"), generateLeanHostObjectAdapters(imports)[name + ".lean"]);
	await copyFile(join(fixture, "FrameCheck.lean"), join(root, "FrameCheck.lean"));
	for(const [module, c] of [[name, "host.c"], ["FrameCheck", "app.c"]]) await tool(join(lean, "bin/lean"), ["-j1", "-R", root, "-o", module + ".olean", "-c", c, module + ".lean"]);
	const lib = join(root, "host-check.so");
	await writeFile(join(root, "checked.c"), '#include "host.c"\n#include "externs.h"\n');
	await writeFile(join(root, "checked-app.c"), '#include "app.c"\n#include "externs.h"\n');
	await tool(process.env.CC ?? "cc", ["-shared", "-fPIC", "-O1", "-g0"
		, "-fvisibility=hidden", "-Werror=implicit-function-declaration"
		, "-I" + join(lean, "include")
		, "-I" + backend
		, "-I" + resolve("src/backends/c")
		, "checked.c", "provider.c"
		, "checked-app.c"
		, join(root, "host-frame.c")
		, join(fixture, "frame-check.c")
		, "-L" + join(lean, "lib/lean")
		, "-Wl,-rpath," + join(lean, "lib/lean")
		, "-Wl,-z,defs"
		, "-lleanshared"
		, "-o"
		, lib]);
	await writeFile(join(app, "HostMembers.cs"), implementation);
	await writeFile(join(app, "HostContract.cs"), "namespace LeanBridge.GeneratedHost;\n" + contract);
	await copyFile(join(backend, "host-frame.cs"), join(app, "HostCall.cs"));
	await copyFile(join(backend, "host-refs.cs"), join(app, "HostRefs.cs"));
	await copyFile(join(backend, "host-wire.cs"), join(app, "HostWire.cs"));
	const slots = members.map((m, i) => "internal const int " + (({ new: "New", set: "Set", get: "Get" })[m.mode] ?? m.name) + "=" + i + ";");
	await writeFile(join(app, "Slots.cs"), "internal static class Slots {" + slots.join("\n") + "}");
	await copyFile(join(fixture, "Program.cs"), join(app, "Program.cs"));
	await copyFile(join(fixture, "Scalars.cs"), join(app, "Scalars.cs"));
	await writeFile(join(app, "Frame.csproj"), '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><AllowUnsafeBlocks>true</AllowUnsafeBlocks><Nullable>enable</Nullable><TreatWarningsAsErrors>true</TreatWarningsAsErrors></PropertyGroup></Project>');
	await writeFile(join(app, "NuGet.Config"), "<configuration><packageSources><clear/></packageSources></configuration>");
	await tool(dotnet, ["restore", "--configfile", "NuGet.Config", "--disable-parallel", "-m:1", "-p:NuGetAudit=false"], app);
	await tool(dotnet, ["build", "--no-restore", "--disable-build-servers", "-m:1", "-p:UseSharedCompilation=false", "-c", "Release"], app);
	const line = await run(dotnet, [join(app, "bin/Release/net8.0/Frame.dll"), lib], root, { PATH: "/no-publisher-tools", LANG: "C.UTF-8", LEAN_NUM_THREADS: "1", DOTNET_PROCESSOR_COUNT: "1" });
	assert.equal(line, "CLR: 19 generated scalar imports, exact members, nested native reentry, original exception identity, mapped/replaced/caught errors, wrong thread, fatal retirement"); t.diagnostic(line);
});
