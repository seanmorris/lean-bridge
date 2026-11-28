/** @file Restore independent host-object NuGet releases and run an ordinary C# program. */
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { runNativeTool as run } from "./native-effect-consumers.mjs";

/**
 * Install via PackageReference, then launch without the project or NuGet cache.
 *
 * @param root - Isolated test staging.
 * @param feed - Offline folder containing the .nupkg handoffs.
 * @param workers - Exercise the mixed class/worker packages instead of the synchronous pair.
 * @param lastOwner - Run the CLR last-payload client before the original direct-call and fatal-fault cases.
 */
export const runDotnetHostConsumers = async (root, feed, workers = false, lastOwner = false) => {
	assert.ok(!(workers && lastOwner));
	const work = await mkdtemp(join(root, "client-")), proj = join(work, "src"), cache = join(work, "cache"), moved = join(work, "relocated");
	const dotnet = process.env.LEAN_BRIDGE_DOTNET ?? "dotnet";
	const env = { ...process.env, DOTNET_PROCESSOR_COUNT: "1"
		, DOTNET_CLI_HOME: work
		, NUGET_PACKAGES: cache
		, DOTNET_CLI_TELEMETRY_OPTOUT: "1"
		, DOTNET_NOLOGO: "1"
		, MSBUILDDISABLENODEREUSE: "1" };
	try
	{
		await mkdir(proj); await copyFile(resolve("tests/fixtures", workers ? "dotnet-host-workers/Installed.cs" : "dotnet-host-meter/Installed.cs"), join(proj, "Program.cs"));
		if(lastOwner) await copyFile(resolve("tests/fixtures/dotnet-host-meter/ErrorOwner.cs"),join(proj,"ErrorOwner.cs"));
		await copyFile(resolve("tests/fixtures", workers ? "dotnet-sync-io/Audit.cs" : "dotnet-host-meter/InstalledScalars.cs"), join(proj, "Support.cs"));
		await writeFile(join(proj, "NuGet.Config"), "<configuration><packageSources><clear/></packageSources></configuration>");
		await writeFile(join(proj, "Client.csproj"), '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><AllowUnsafeBlocks>true</AllowUnsafeBlocks><UseAppHost>false</UseAppHost><TreatWarningsAsErrors>true</TreatWarningsAsErrors></PropertyGroup><ItemGroup><PackageReference Include="Acme.Workshop" Version="[1.0.0]"/><PackageReference Include="Acme.Peer" Version="[1.0.0]"/></ItemGroup></Project>');
		await run(dotnet, ["restore", "--source", feed, "--configfile", "NuGet.Config", "--disable-parallel", "-m:1", "-p:NuGetAudit=false"], proj, env);
		const graph = JSON.parse(await readFile(join(proj, "obj/project.assets.json")));
		assert.deepEqual(Object.keys(graph.libraries).sort(), ["Acme.Peer/1.0.0", "Acme.Workshop/1.0.0"]);
		const receipts = [];
		for(const id of ["acme.peer", "acme.workshop"])
		{
			const p = join(cache, id, "1.0.0"), r = JSON.parse(await readFile(join(p, "lean-bridge/package-receipt.json")));
			const readme = await readFile(join(p, "README.md"), "utf8");
			for(const signature of ["new Box(uint)", "uint Box.Level { get; }", "uint Box.Level { set; }", "Box Box.Identity()"]) assert.ok(readme.includes(signature), signature);
			assert.equal(r.profile, workers ? "native-dotnet-task-v1" : "native-dotnet-io-v1"); assert.ok(/^[a-f0-9]{64}$/u.test(r.hostDomain.id));
			assert.equal(r.files["runtimes/linux-x64/native/" + r.hostDomain.library].sha256, r.hostDomain.sha256);
			receipts.push(r);
		}
		assert.deepEqual(receipts[0].hostDomain, receipts[1].hostDomain);
		if(workers)
		{
			assert.deepEqual(receipts[0].resourceLedger, receipts[1].resourceLedger);
			for(const r of receipts) assert.equal(r.files["runtimes/linux-x64/native/"+r.resourceLedger.library].sha256, r.resourceLedger.sha256);
		}
		assert.equal(receipts[0].runtimeIdentity, receipts[1].runtimeIdentity); assert.notEqual(receipts[0].componentIdentity, receipts[1].componentIdentity);
		await run(dotnet, ["build", "--no-restore", "-c", "Release"
			, ...lastOwner ? ["-p:StartupObject=ErrorOwner"] : []
			, "--disable-build-servers", "-m:1", "-p:UseSharedCompilation=false"
			, "-p:CreateHardLinksForCopyLocalIfPossible=true"
			, "-p:CreateHardLinksForCopyFilesToOutputDirectoryIfPossible=true"], proj, env);
		await rename(join(proj, "bin/Release/net8.0"), moved); await rm(proj, { recursive: true }); await rm(cache, { recursive: true });
		const native = join(moved, "runtimes/linux-x64/native");
		assert.equal((await readdir(native)).filter(f => f.startsWith("liblb_dotnet_host_")).length, 3);
		const launch = arg => run(dotnet, [join(moved, "Client.dll"), arg], moved, { PATH: "/no-publisher-tools", LANG: "C.UTF-8", LEAN_NUM_THREADS: "1", DOTNET_PROCESSOR_COUNT: "1" });
		const results = [];
		const repeats = workers ? Number(process.env.LEAN_BRIDGE_DOTNET_WORKER_REPLAYS ?? 1) : 1;
		assert.ok(Number.isInteger(repeats) && repeats >= 1 && repeats <= 20);
		for(const order of Array.from({ length: repeats }, () => ["ab", "ba"]).flat())
		{
			const lines = (await launch(order)).split("\n"), line = lines.pop();
			if(workers)
			{
				assert.equal(lines.length, 1); assert.match(lines[0], /^retired native drain: [0-9]+ -> 0$/u);
				results.push(order + ": " + lines[0]);
			}
			else if(lastOwner)
			{
				assert.deepEqual(lines,["declared error outlived producer; peer updated last payload to 42; collected with peer still bound"]);
				results.push(order+": "+lines[0]);
			} else assert.deepEqual(lines, []);
			assert.equal(line, order + (workers ? ": worker identity, callbacks, errors, cursors, cancellation, binding isolation and shared retirement" : ": ordinary C# calls; shared identity, mutable reference, original exception, nested Except, declared EIO, stale binding and cleanup")); results.push(line);
		}
		const path = join(native, receipts[0].hostDomain.library);
		if(workers)
		{
			const line=await launch("shutdown"); assert.equal(line,"owner shutdown cancelled outstanding work; both bindings survived"); results.push(line);
		}
		await rename(path, path + ".original"); await writeFile(path, "modified domain", { flag: "wx" });
		assert.equal(await launch("tampered"), "tampered domain refused"); return results;
	} finally
	{ await rm(work, { recursive: true, force: true }); }
};
