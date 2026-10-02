/**
 * Use ordinary public C# APIs from an independently installed NuGet assembly.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/**
 * Reuse lifetime assertions without native probe access or unsafe C#.
 *
 * @param combined - Include raw/whole host replies and consuming receivers.
 */
export const ownedDotnetCallbackInstalledProbe = async combined => {
	const source = await readFile("tests/fixtures/structured-types/owned-dotnet-callback-results.cs", "utf8");
	const first = "    private static void Check(", last = "    private static int Faults(";
	assert.equal(source.split(first).length, 2); assert.equal(source.split(last).length, 2);
	let methods = first + source.split(first)[1].split(last)[0];
	const collect = "    private static void Collect()\n    { GC.Collect(); GC.WaitForPendingFinalizers(); GC.Collect(); Runtime.Current.Require(); }\n";
	assert.equal(methods.split(collect).length, 2); methods = methods.replace(collect, "");
	if(combined)
	{
		const host = await readFile("tests/fixtures/structured-types/owned-dotnet-callback-host-results.cs", "utf8");
		const fault = "    private static int HostFaults(";
		assert.equal(host.split(fault).length, 2); methods += host.split(fault)[0];
		methods += await readFile("tests/fixtures/structured-types/owned-dotnet-callback-combined-results.cs", "utf8");
	}
	const result = `using System;
using System.Threading;
using LeanBridge.OwnedAggregates;
internal static class Program
{
    private static int checks;
${methods}
    private static void Main()
    {
        OriginalOwners(); EmptyOwners();${combined ? " HostReplies(); CombinedOwners();" : ""}
        Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new { checks, safePublicApi = true }));
    }
}
`;
	assert.doesNotMatch(result, /\bunsafe\b|NativeLibrary|OwnedLoader|\.Interop;|\.Guard\b|IGraphValue|IOwnedValue|Runtime\.Current/u);
	return result;
};
