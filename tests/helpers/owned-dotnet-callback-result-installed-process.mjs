/**
 * Exercise callback process guards through the original installed NuGet assembly.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { ownedDotnetBorrowProject } from "./owned-dotnet-borrow-installed.mjs";
import { ownedDotnetCallbackForkProbe } from "./owned-dotnet-callback-result-probes.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/** Reuse the public ownership assertions with the real authenticated loader. */
export const ownedDotnetCallbackInstalledProcessProbe = async () => {
	const source = await readFile("tests/fixtures/structured-types/owned-dotnet-callback-process.cs", "utf8");
	const marker = "    private static void Main(string[] args)";
	assert.equal(source.split(marker).length, 2);
	let prefix = source.split(marker)[0];
	for(const [before, after] of [
		["using LeanBridge.OwnedAggregates.Interop;\n", ""]
		, ["    internal static void Allocation() { }\n", ""]
		, ["    private static delegate* unmanaged[Cdecl]<nuint> Live, Identities;"
			, `    [StructLayout(LayoutKind.Sequential)]
    private struct Snapshot
    {
        internal uint Abi, State, RuntimeInitializations, Components, Attached, Identities;
        internal ulong Instance, Domain;
    }
    private static delegate* unmanaged[Cdecl]<Snapshot*, void> ReadSnapshot;
    private static uint Identities()
    { var snapshot = default(Snapshot); ReadSnapshot(&snapshot); return snapshot.Identities; }`]
		, ['throw new LeanBridgeException(6, "Start a fresh process after fork")', 'throw new InvalidOperationException("fresh process")']
		, ["        catch { return 3; }", '        catch (InvalidOperationException error) { return error.Message.Contains("fresh process") ? 0 : 2; }\n        catch { return 3; }']
		, ['System.IO.Path.GetDirectoryName(Environment.GetCommandLineArgs()[1])!', 'AppContext.BaseDirectory']
		, ["var live = Live(); var identities = Identities();", "var identities = Identities();"]
		, ["Live() == live && Identities() == identities", "Identities() == identities"]
	]) {
		assert.equal(prefix.split(before).length, 2, before);
		prefix = prefix.replace(before, after);
	}
	const probe = prefix + `    private static void Main(string[] args)
    {
        Exception? failure = null;
        var caller = new Thread(() => {
            try
            {
                // Public calls initialize the original package and its loader.
                using var warm = Api.NewTicket(1, "warm"); warm.Dispose();
                try { warm.Get(); throw new Exception("closed warmup owner remained callable"); }
                catch (LeanBridgeException error) when (error.Status == 4) { checks++; }
                var registry = (System.Collections.Generic.Dictionary<string, object>)AppDomain.CurrentDomain.GetData("lean-bridge.native-library-v1.dotnet")!;
                var broker = (nint)registry["broker"];
                ReadSnapshot = (delegate* unmanaged[Cdecl]<Snapshot*, void>)NativeLibrary.GetExport(broker, "lean_bridge_native_snapshot_read");
                Retire = (delegate* unmanaged[Cdecl]<void>)NativeLibrary.GetExport(broker, "lean_bridge_native_runtime_retire");
                Exercise(args[0], broker);
            }
            catch (Exception error) { failure = error; }
        });
        caller.Start(); Check(caller.Join(60000), "installed caller exited");
        if (failure is not null) throw new Exception("Installed callback process check failed", failure);
        GC.Collect(); GC.WaitForPendingFinalizers(); GC.Collect();
        Check(Identities() == 0, "installed process scenario drains identities after thread exit");
        Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new {
            mode = args[0], checks, rejected, forkChecks, identities = Identities(), installedPublicApi = true
        }));
    }
}
`;
	assert.doesNotMatch(probe, /OwnedLoader|OwnedBindings|\.Interop;|\.Guard\b|probe_live|probe_identities|Runtime\.Current/u);
	return probe;
};

/**
 * Select the exact installed coordinate, without exposing generated internals.
 *
 * @param pkg - Original NuGet coordinate.
 * @param combined - Include host replies and consuming receiver retirement.
 */
export const ownedDotnetCallbackProcessProject = (pkg, combined) => ownedDotnetBorrowProject(pkg, "Process.cs")
	.replace("<AllowUnsafeBlocks>false</AllowUnsafeBlocks>", "<AllowUnsafeBlocks>true</AllowUnsafeBlocks>")
	.replace("</PropertyGroup>", `<Optimize>true</Optimize><TieredCompilation>false</TieredCompilation>${combined ? "<DefineConstants>HOST_CALLBACKS</DefineConstants>" : ""}</PropertyGroup>`);

/**
 * Run each process boundary independently using only installed public APIs.
 *
 * @param options - Prepared consumer directory, runtime and capability flags.
 */
export const runOwnedDotnetCallbackInstalledProcess = async options => {
	const { consumer, command, env, combined, output = "process" } = options;
	const observations = [];
	for(const mode of ["fork", "retirement", ...combined ? ["host-retirement", "transfer-retirement"] : []])
	{
		const result = await runCopied(command, [`${output}/Process.dll`, mode], consumer, env);
		assert.equal(result.stderr, ""); const observed = JSON.parse(result.stdout);
		const fork = mode === "fork";
		assert.deepEqual(observed, {
			mode
			, checks: fork ? combined ? 22 : 20 : mode === "transfer-retirement" ? 5 : 4
			, rejected: fork ? 0 : combined ? mode === "retirement" ? 8 : 9 : 7
			, forkChecks: fork ? combined ? 7 : 6 : 0
			, identities: 0, installedPublicApi: true
		});
		observations.push(observed);
	}
	return observations;
};

/**
 * Compile process diagnostics against the package, then execute the original DLL.
 *
 * @param options - Installed package, offline feed and isolated SDK environment.
 */
export const prepareOwnedDotnetCallbackInstalledProcess = async options => {
	const { consumer, pkg, command, env, combined } = options;
	const source = await ownedDotnetCallbackInstalledProcessProbe();
	const project = ownedDotnetCallbackProcessProject(pkg, combined);
	await saveLakeFile(consumer, "Process.cs", source);
	await saveLakeFile(consumer, "Process.csproj", project);
	await saveLakeFile(consumer, "process-fork.c", ownedDotnetCallbackForkProbe);
	await runCopied(command, ["restore", "Process.csproj", "--configfile", "NuGet.Config"], consumer, env);
	await runCopied(command, ["build", "Process.csproj", "--no-restore", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "process"], consumer, env);
	await runCopied("/usr/bin/cc", ["-shared", "-fPIC", "-std=c11", "-Wall", "-Wextra", "-Werror", "process-fork.c", "-o", "process/fork-probe.so"], consumer, { PATH: "/usr/bin:/bin" });
	const observations = await runOwnedDotnetCallbackInstalledProcess(options);
	return { sourceSha256: sha256(source), projectSha256: sha256(project)
		, forkProbeSha256: sha256(ownedDotnetCallbackForkProbe), observations };
};
