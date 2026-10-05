/**
 * Independent C# member probes alongside the original-owner regressions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ownedRustPlainReceiverReviewedIr } from "./owned-rust-receiver-fixture.mjs";
import { ownedReceiverSource } from "./owned-receiver-fixture.mjs";

export const ownedDotnetReceiverProject = '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><AllowUnsafeBlocks>true</AllowUnsafeBlocks><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors><Optimize>true</Optimize><TieredCompilation>false</TieredCompilation></PropertyGroup></Project>';

export const ownedDotnetPlainReceiverSource = ownedReceiverSource + `
namespace Owned
def pingTicket (_value : Ticket) : Unit := ()
end Owned
`;

/**
 * Include Unit properties, which return Unit rather than an invalid void getter.
 *
 * @param consuming - Include an original-owner consuming method.
 */
export const ownedDotnetPlainReceiverReviewedIr = consuming => {
	const ir = ownedRustPlainReceiverReviewedIr(consuming);
	const property = structuredClone(ir.declarations.find(fn => fn.name === "serial"));
	property.id = "lean:Owned.pingTicket"; property.name = "pingTicket";
	property.overloadKey = "Owned.pingTicket"; property.source.declaration = "Owned.pingTicket";
	property.result.type = { kind: "primitive", name: "unit" };
	ir.declarations.push(property); return ir;
};

/** Add receivers without changing the independent lifetime and fault assertions. */
export const ownedDotnetReceiverProbe = async () => {
	const source = await readFile("tests/fixtures/structured-types/owned-dotnet-borrows.cs", "utf8");
	const members = await readFile("tests/fixtures/structured-types/owned-dotnet-receivers.cs", "utf8");
	const marker = "    private static void Main(string[] args)";
	assert.equal(source.split(marker).length, 2);
	return source.replace(marker, members + "\n" + marker)
		.replace("Runtime.Current.Require(); Shapes();", "Runtime.Current.Require(); ReceiverMembers(); Shapes();")
		.replace("receiverCollections, live =", "receiverCollections, memberCollections, live =");
};

/**
 * Preserve optimized GC and concurrent-close schedules in every compiled probe.
 *
 * @param source - The current generated lifetime implementation.
 */
export const instrumentOwnedDotnetReceivers = source => {
	const checkpoint = "internal static void Checkpoint() { }";
	const validated = "if (global::System.Threading.Volatile.Read(ref closed) != 0) OwnedRuntime.Check(4);";
	assert.equal(source.split(checkpoint).length, 2);
	assert.equal(source.split(validated).length, 2);
	return source.replace(checkpoint, "internal static void Checkpoint() { global::Program.Allocation(); }")
		.replace(validated, validated + "\n        global::Program.AfterWholeReadCheck();");
};

/**
 * Exercise nominal resource owners without callback or result-anchor support.
 *
 * @param consuming - Include a receiver that consumes its original owner.
 */
export const ownedDotnetPlainReceiverProbe = consuming => `using System;
using System.Runtime.InteropServices;
using LeanBridge.OwnedAggregates;
using LeanBridge.OwnedAggregates.Interop;
internal static unsafe class Program
{
    private static int checks;
    internal static void Allocation() { }
    private static void Check(bool value)
    { if (!value) throw new Exception("Plain C# receiver assertion failed"); checks++; }
    private static void Main(string[] args)
    {
        var library = NativeLibrary.Load(args[0]); OwnedLoader.Bindings = new OwnedBindings(library);
        var identities = (delegate* unmanaged[Cdecl]<nuint>)NativeLibrary.GetExport(library, "probe_identities");
        var live = (delegate* unmanaged[Cdecl]<nuint>)NativeLibrary.GetExport(library, "probe_live");
        Check(identities() == 0);
        var state = OwnedLoader.Bindings.Runtime.Current; state.Require(); Check(identities() == 1);
        using var root = Api.NewTicket(42, "plain");
        using var alias = root.Share();
        using var independent = root.RetainTicket();
        using var rawIndependent = root.Get().RetainTicket();
        var raw = root.Get(); var copied = root.Serial;
        Check(copied == 42 && raw.Serial == 42 && alias.Serial == 42);
        Check(typeof(TicketValue).GetProperty("Serial") is { CanWrite: false });
        Check(root.PingTicket == default(Unit) && raw.PingTicket == default(Unit));
        root.Dispose(); Check(root.IsClosed && !alias.IsClosed && alias.Serial == 42);
        alias.Dispose(); Check(raw.IsClosed && independent.Serial == 42 && rawIndependent.Serial == 42);
        Check(copied == 42);
        Value<Ticket> erased = independent;
        using var share = erased.Share(); using var retained = erased.Retain();
        Check(share is TicketValue && retained is TicketValue);
        ${consuming ? `using var moved = independent.TransferTicket();
        Check(independent.IsClosed && share.IsClosed && moved.Serial == 42);
        Check(((TicketValue)retained).Serial == 42);
        moved.Dispose();` : "independent.Dispose(); Check(!share.IsClosed && ((TicketValue)share).Serial == 42);"}
        rawIndependent.Dispose(); share.Dispose(); retained.Dispose();
        state.Require(); Check(identities() == 1);
        state.Dispose(); Check(identities() == 0 && live() == 0);
        Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new { checks, live = (ulong)live(), identities = (ulong)identities() }));
    }
}
`;
