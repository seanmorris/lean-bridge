/**
 * Compose the exact standalone C# owner and host-callback assertions.
 *
 * @file
 */
import assert from "node:assert/strict";
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

/**
 * Keep GC and cross-thread scheduling identical in execution and evidence.
 *
 * @param hostCallbacks - Include host reply lifetime schedules.
 * @param combined - Include transfer faults before and after handoff.
 */
export const ownedDotnetCallbackLifetimeProbe = async (hostCallbacks, combined) => {
	const base = await readFile("tests/fixtures/structured-types/owned-dotnet-callback-results.cs", "utf8");
	let methods = await readFile("tests/fixtures/structured-types/owned-dotnet-callback-lifetimes.cs", "utf8");
	if(hostCallbacks) methods += await readFile("tests/fixtures/structured-types/owned-dotnet-callback-host-lifetimes.cs", "utf8");
	if(combined) methods += await readFile("tests/fixtures/structured-types/owned-dotnet-callback-transfer-lifetimes.cs", "utf8");
	let probe = base.replace("    private static void Main", methods + "\n    private static void Main")
		.replace("        if (remaining == 0)", "        var hook = allocationHook; allocationHook = null; hook?.Invoke();\n        if (remaining == 0)")
		.replace("OriginalOwners(); EmptyOwners();", `OriginalOwners(); EmptyOwners(); CallbackLifetimeOwners();${hostCallbacks ? " HostLifetimeOwners();" : ""}${combined ? " TransferLifetimeFaults(false); TransferLifetimeFaults(true);" : ""}`)
		.replace("new { checks,", `new { lifetimeCollections, exitedThreads, concurrentReads,${combined ? " managedBefore, managedAfter, nativeBefore, nativeAfter," : ""} checks,`);
	if(combined) probe = probe.replace("        Runtime.Current.Require(); OriginalOwners();", "        Handoffs = (delegate* unmanaged[Cdecl]<nuint>)NativeLibrary.GetExport(library, \"probe_handoffs\");\n        Runtime.Current.Require(); OriginalOwners();");
	return probe;
};

/**
 * Exercise the same managed program with native positive detector controls.
 *
 * @param combined - Include host callbacks and consuming receivers.
 */
export const ownedDotnetCallbackSanitizerProbe = async combined => {
	const original = await ownedDotnetCallbackResultProbe(combined, combined);
	const marker = "        Live = (delegate* unmanaged[Cdecl]<nuint>)NativeLibrary.GetExport(library, \"probe_live\");";
	assert.equal(original.split(marker).length, 2);
	const controls = `        if (args[1] == "address")
        {
            var fault = (delegate* unmanaged[Cdecl]<nuint, void>)NativeLibrary.GetExport(library, "probe_address");
            fault(17); throw new Exception("Address sanitizer did not stop the invalid write.");
        }
        if (args[1] == "undefined")
        {
            var fault = (delegate* unmanaged[Cdecl]<int, int>)NativeLibrary.GetExport(library, "probe_undefined");
            _ = fault(40); throw new Exception("Undefined behavior sanitizer did not stop the invalid shift.");
        }
`;
	return original.replace(marker, controls + marker);
};

export const ownedDotnetCallbackForkProbe = `#include <errno.h>
#include <sys/wait.h>
#include <unistd.h>
int probe_fork(int (*call)(int), int kind) {
  pid_t child = fork();
  if (child < 0) return 255;
  if (child == 0) { alarm(10); _exit(call(kind)); }
  int status;
  while (waitpid(child, &status, 0) < 0) if (errno != EINTR) return 254;
  return WIFEXITED(status) ? WEXITSTATUS(status) : 253;
}
`;
