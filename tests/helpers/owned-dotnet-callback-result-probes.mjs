/**
 * Compose the exact standalone C# owner and host-callback assertions.
 *
 * @file
 */
import { readFile } from "node:fs/promises";

/**
 * Keep the executable source shared by normal and instrumented native runs.
 *
 * @param hostCallbacks - Include raw/whole host reply and allocation tests.
 * @param combined - Include consuming receiver and mixed-callback overloads.
 */
export const ownedDotnetCallbackResultProbe = async (hostCallbacks, combined) => {
	let probe = await readFile("tests/fixtures/structured-types/owned-dotnet-callback-results.cs", "utf8");
	if(hostCallbacks)
	{
		const host = await readFile("tests/fixtures/structured-types/owned-dotnet-callback-host-results.cs", "utf8");
		probe = probe.replace("    private static void Main", host + "\n    private static void Main")
			.replace("OriginalOwners(); EmptyOwners();", "OriginalOwners(); EmptyOwners(); HostReplies();")
			.replace("int managedFaults =", "var hostFaults = new[] { HostFaults(true, false), HostFaults(false, false), HostFaults(true, true), HostFaults(false, true) };\n        int managedFaults =")
			.replace("new { checks,", "new { hostFaults, checks,");
	}
	if(combined)
	{
		const methods = await readFile("tests/fixtures/structured-types/owned-dotnet-callback-combined-results.cs", "utf8");
		probe = probe.replace("    private static void Main", methods + "\n    private static void Main")
			.replace("HostReplies();", "HostReplies(); CombinedOwners();");
	}
	return probe;
};
