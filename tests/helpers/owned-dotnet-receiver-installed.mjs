/**
 * Safe installed C# consumers check receiver typing and the exact guide example.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { ownedDotnetBorrowInvalidPrograms, ownedDotnetBorrowProject } from "./owned-dotnet-borrow-installed.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/** Exercise public member assertions without any private assembly access. */
export const ownedDotnetInstalledReceiverProbe = async () => {
	const previous = await readFile("tests/fixtures/structured-types/owned-installed-dotnet-borrows.cs", "utf8");
	const source = await readFile("tests/fixtures/structured-types/owned-dotnet-receivers.cs", "utf8");
	const marker = "    private static void ReceiverMembers()";
	assert.equal(source.split(marker).length, 2);
	let members = marker + source.split(marker)[1];
	// Private guard liveness is tested in the optimized native probe only.
	const first = "        for (int index = 0; index < 3; index++)\n";
	const last = '        Check(memberCollections == 9, "all optimized nominal receiver GC schedules executed");\n';
	assert.equal(members.split(first).length, 2); assert.equal(members.split(last).length, 2);
	members = members.slice(0, members.indexOf(first)) + members.slice(members.indexOf(last) + last.length);
	const main = "    private static void Main()";
	assert.equal(previous.split(main).length, 2);
	const combined = "using System.Numerics;\n" + previous.replace(main, members + "\n" + main)
		.replace("Shapes(); Callbacks();", "ReceiverMembers(); Shapes(); Callbacks();");
	assert.doesNotMatch(combined, /\bunsafe\b|NativeLibrary|OwnedLoader|\.Interop;|\.Guard\b|IGraphValue|IOwnedValue/u);
	return combined;
};

export const ownedDotnetReceiverInvalidPrograms = Object.freeze([
	...ownedDotnetBorrowInvalidPrograms.map(row => row[0] === "sealed whole owner"
		? ["nonconstructible whole owner", row[1], /CS1729|CS7036/u] : row)
	, ["wrong receiver owner", "BundleValue value = null!; _ = value.Serial;", /CS1061/u]
	, ["raw receiver anchor", "Ticket value = null!; value.RetainTicket();", /CS1061/u]
	, ["raw parameter anchor", "TicketValue value = null!; value.ChooseTicket(value.Get());", /CS1503/u]
	, ["read-only receiver property", "TicketValue value = null!; value.Serial = 9;", /CS0200/u]
	, ["property not method", "TicketValue value = null!; value.Serial();", /CS1955/u]
	, ["nominal owner constructor", "_ = new TicketValue();", /CS1729/u]
	, ["sealed nominal owner", "class External : TicketValue {}", /CS0509/u]
]);

/**
 * Reject each misuse against a separately installed safe consumer assembly.
 *
 * @param options - Offline consumer, installed package, SDK and environment.
 */
export const rejectOwnedDotnetReceiverConsumers = async options => {
	const { consumer, pkg, namespace, command, env } = options;
	await saveLakeFile(consumer, "Invalid.csproj", ownedDotnetBorrowProject(pkg, "Invalid.cs"));
	await runCopied(command, ["restore", "Invalid.csproj", "--configfile", "NuGet.Config"], consumer, env);
	const observations = [];
	for(const [name, body, diagnostic] of ownedDotnetReceiverInvalidPrograms)
	{
		const external = body.startsWith("class ");
		const source = `using ${namespace};\ninternal static class Program { static void Main() { ${external ? "" : body} } }\n${external ? body : ""}`;
		await saveLakeFile(consumer, "Invalid.cs", source);
		await assert.rejects(runCopied(command, ["build", "Invalid.csproj", "--no-restore", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "invalid"], consumer, env), error => {
			assert.match(JSON.stringify(error.details ?? error.message), diagnostic, name); return true;
		});
		observations.push({ name, source, diagnostic: diagnostic.source });
	}
	return observations;
};

/**
 * Compile and execute the consumer page's checked-in example from its package.
 *
 * @param options - Installed package and isolated consumer environment.
 */
export const checkOwnedDotnetReceiverDocumentation = async options => {
	const { consumer, pkg, command, env } = options;
	const guide = await readFile("docs/consume/dotnet.md", "utf8");
	const source = await readFile("tests/fixtures/documentation/consumers/dotnet/owned-receivers.cs", "utf8");
	assert.equal(guide.split("```csharp file=dotnet/owned-receivers.cs\n")[1].split("\n```")[0] + "\n", source);
	await saveLakeFile(consumer, "Example.cs", source);
	await saveLakeFile(consumer, "Example.csproj", ownedDotnetBorrowProject(pkg, "Example.cs"));
	await runCopied(command, ["restore", "Example.csproj", "--configfile", "NuGet.Config"], consumer, env);
	await runCopied(command, ["build", "Example.csproj", "--no-restore", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "example"], consumer, env);
	const observed = await runCopied(command, ["example/Example.dll"], consumer, env);
	assert.deepEqual(observed, { code: 0, stdout: "42\n42\n", stderr: "" });
	return { sourceSha256: sha256(source), ...observed };
};
