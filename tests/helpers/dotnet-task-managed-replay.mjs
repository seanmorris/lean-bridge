/**
 * Regression-test today's managed scheduler against pinned, genuine Lean libraries.
 * New installed-package acceptance is separate; this test never repacks an archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { constants } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import test from "node:test";
import { reconcileHostExports } from "../../src/analyze/host-export-model.mjs";
import { generateSyncWire } from "../../src/backends/c/sync-wire.mjs";
import { generateDotnetTasks } from "../../src/backends/dotnet/sync-io.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";

const env = process.env, root = env.LEAN_BRIDGE_DOTNET_MANAGED_REPLAY;
const json = async f => JSON.parse(await readFile(f, "utf8"));
test("current managed task and stream scheduler replays pinned callback-free Lean components", { skip: !root, timeout: 900_000 }, async t => {
	const pin = await json(resolve("docs/evidence/dotnet-tasks-20261122.json")), bytes = await readFile(join(root, "acceptance.json"));
	assert.equal(sha256(bytes), pin.acceptanceSha256);
	const record = JSON.parse(bytes); assert.deepEqual(record, pin.installed);
	const row = record.rows.find(r => r.route === "ordinary");
	const work = await mkdtemp(join(tmpdir(), "regenerate-dotnet-tasks-")), src = join(work, "src"), native = join(work, "native");
	t.after(() => rm(work, { recursive: true, force: true }));
	await mkdir(src); await mkdir(native);
	const sdk = row.installed[0].sdk, projects = [], generated = {}, extracted = new Map();
	for(const ref of row.installed)
	{
		const handoff = join(root, ref.route, "handoff"), receiptPath = join(handoff, "package-set-receipt.json");
		const { receipt, result } = await readVerifiedPackageSetReceipt({ receiptPath });
		assert.equal(result.receiptSha256, ref.receiptSha256); assert.equal(ref.sdk, sdk);
		const [pkg] = receipt.packages; assert.deepEqual(pkg.artifacts, [ref.archive]);
		assert.equal(pkg.profile, "native-dotnet-task-v1"); assert.equal(pkg.runtimeIdentity, ref.runtimeIdentity);
		const archive = join(handoff, ref.archive.path);
		const inner = JSON.parse(await run("unzip", ["-p", archive, "lean-bridge/package-receipt.json"], work, env));
		const libraries = Object.fromEntries(Object.entries(inner.files).filter(([k]) => k.startsWith("runtimes/linux-x64/native/")).map(([k, v]) => [basename(k), v.sha256]));
		assert.deepEqual(Object.keys(libraries).sort(), [ref.nativeLibrary, "liblean_bridge_native.so", "libleanshared.so"].sort());
		assert.equal(libraries[ref.nativeLibrary], ref.nativeSha256);
		for(const [name, hash] of Object.entries(libraries))
		{
			if(extracted.has(name))
			{
				assert.equal(extracted.get(name), hash);
				continue;
			}
			await run("unzip", ["-q", "-j", archive, "runtimes/linux-x64/native/" + name, "-d", native], work, env);
			assert.equal(sha256(await readFile(join(native, name))), hash); extracted.set(name, hash);
		}
		const published = await json(join(handoff, "binding-ir.json")), evidence = await json(join(handoff, "host-export-evidence.json"));
		const { api, entries } = reconcileHostExports({ ...evidence, component: published.component, ir: null });
		assert.deepEqual(api, published); assert.equal(hashBindingIr(api), ref.bindingIrSha256);
		const wire = generateSyncWire(ref.nativeLibrary.slice(3, -3), entries, { tasks: true });
		const assets = { library: ref.nativeLibrary, libraries
			, componentReceiptSha256: inner.componentIdentity
			, componentId: api.component.id, runtimeIdentity: ref.runtimeIdentity };
		const { assembly, files } = await generateDotnetTasks({ api, wire, evidence: assets });
		assert.equal(assembly, ref.assembly);
		const dir = join(src, assembly); await mkdir(dir);
		generated[assembly] = Object.fromEntries(Object.entries(files).map(([f, data]) => [f, sha256(data)]));
		for(const [f, data] of Object.entries(files)) await writeFile(join(dir, f), data, { flag: "wx" });
		const scoped = assembly === "LeanBridge.Pulse";
		if(scoped)
		{
			const port = declaration => {
				const i = wire.methods.findIndex(m => m.declaration === declaration);
				assert.notEqual(i, -1); return "Port" + i;
			};
			const probe = await readFile(resolve("tests/fixtures/dotnet-host-workers/ScopeProbe.cs"), "utf8");
			await writeFile(join(dir, "ScopeProbe.cs"), probe.replaceAll("__LatePort__", port("Pulse.late")).replaceAll("__SeriesPort__", port("Pulse.series")), { flag: "wx" });
			const scope = await readFile(resolve("src/backends/dotnet/host-task-scope.cs"), "utf8");
			await writeFile(join(dir, "HostTaskScope.cs"), scope.replace("namespace LeanBridge.GeneratedIO;", "namespace " + assembly + ";"), { flag: "wx" });
		}
		const entry = scoped ? "<OutputType>Exe</OutputType><UseAppHost>false</UseAppHost>" : "";
		await writeFile(join(dir, assembly + ".csproj"), '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup>' + entry + '<TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><AllowUnsafeBlocks>true</AllowUnsafeBlocks><TreatWarningsAsErrors>true</TreatWarningsAsErrors><EnableNETAnalyzers>false</EnableNETAnalyzers></PropertyGroup></Project>');
		projects.push(assembly + "/" + assembly + ".csproj");
	}
	for(const [file, hash] of Object.entries(record.clients))
	{
		assert.ok(["Program.cs", "Audit.cs"].includes(file)); assert.equal(sha256(await readFile(join(root, file))), hash);
		await copyFile(join(root, file), join(src, file), constants.COPYFILE_EXCL);
	}
	await writeFile(join(src, "Client.csproj"), '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><AllowUnsafeBlocks>true</AllowUnsafeBlocks><Nullable>enable</Nullable><UseAppHost>false</UseAppHost><EnableDefaultCompileItems>false</EnableDefaultCompileItems><NuGetAudit>false</NuGetAudit></PropertyGroup><ItemGroup><Compile Include="Audit.cs" /><Compile Include="Program.cs" />' + projects.map(p => `<ProjectReference Include="${p}" />`).join("") + "</ItemGroup></Project>");
	await writeFile(join(src, "NuGet.Config"), "<configuration><packageSources><clear /></packageSources></configuration>");
	await writeFile(join(src, "global.json"), canonicalJson({ sdk: { version: sdk, rollForward: "disable" } }));
	const dotnet = await run("which", [env.LEAN_BRIDGE_DOTNET ?? "dotnet"], src, env), out = join(work, "out"), app = join(work, "relocated");
	const isolated = { ...env, DOTNET_CLI_HOME: join(work, "cli"), NUGET_PACKAGES: join(work, "packages"), MSBUILDDISABLENODEREUSE: "1" };
	await run(dotnet, ["build", "Client.csproj", "--configfile", "NuGet.Config", "-c", "Release", "--disable-build-servers", "-m:1", "/p:UseSharedCompilation=false", "-o", out], src, isolated, 300_000);
	await rename(out, app);
	await mkdir(join(app, "runtimes/linux-x64"), { recursive: true });
	await rename(native, join(app, "runtimes/linux-x64/native"));
	await rm(src, { recursive: true });
	const calls = [], consumerEnv = { PATH: "/unavailable", LANG: "C.UTF-8", LEAN_NUM_THREADS: "1", DOTNET_PROCESSOR_COUNT: "1", DOTNET_EnableDiagnostics: "0", TMPDIR: work };
	for(const order of ["pulse-first", "peer-first"])
		calls.push(await run(dotnet, [join(app, "Client.dll"), order], work, consumerEnv, 120_000));
	assert.deepEqual(calls, row.calls);
	const scoped = await run(dotnet, ["exec", "--runtimeconfig", join(app, "Client.runtimeconfig.json"), join(app, "LeanBridge.Pulse.dll")], work, consumerEnv, 120_000);
	assert.equal(scoped, "binding isolation: task, pending pull, cold captures, cleanup faults and owner thread");
	t.diagnostic(scoped);
	if(env.LEAN_BRIDGE_DOTNET_MANAGED_RECORD) await writeFile(resolve(env.LEAN_BRIDGE_DOTNET_MANAGED_RECORD)
		, canonicalJson({ pinnedAcceptance: pin.acceptanceSha256, generated, sdk, calls, scoped }), { flag: "wx" });
});
