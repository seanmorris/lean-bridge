/**
 * Use ordinary public C# APIs from an independently installed NuGet assembly.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { ownedDotnetBorrowProject } from "./owned-dotnet-borrow-installed.mjs";
import { ownedDotnetCallbackResultConfiguration } from "./owned-dotnet-callback-result-fixture.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Reject raw anchors, incompatible whole values and untyped native passback.
 *
 * @param model - Compiler-derived public managed projection.
 * @param hostCallbacks - Include host delegate reply and argument misuse.
 */
export const ownedDotnetCallbackInvalidPrograms = (model, hostCallbacks) => {
	const record = model.functions.find(fn => fn.name === "callbackRecord");
	const callback = model.callbacks.find(fn => fn.id === record.parameters[1]);
	const native = callback.publicType, delegate = callback.delegateType;
	return [
		["raw-anchor", `void Invalid(${native} closure, Bundle value) { closure.Invoke(value); }`, /CS1503/u]
		, ["wrong-whole-owner", `void Invalid(${native} closure, Value<Tree> value) { closure.Invoke(value); }`, /CS1503/u]
		, ["missing-owner-argument", `void Invalid(${native} closure) { closure.Invoke(); }`, /CS7036/u]
		, ["native-is-not-raw-delegate", `void Invalid(${native} closure) { ${delegate} callback = closure.AsCallback; _ = callback; }`, /CS0029/u]
		, ...hostCallbacks ? [
			["host-input-is-raw", `${delegate} Invalid() => (Value<Bundle> value) => value;`, /CS1661|CS1678/u]
			, ["wrong-host-result", `${delegate} Invalid() => value => 42;`, /CS0029|CS1662/u]
			, ["wrong-whole-reply", "CallbackResult<Tree> Invalid(Value<Bundle> value) => value;", /CS0029/u]
			, ["async-host-callback", `${delegate} Invalid() => async value => { await System.Threading.Tasks.Task.Yield(); return value; };`, /CS4010/u]
		] : []
	];
};

/**
 * Compile ownership misuse against an installed assembly, without internals.
 *
 * @param options - Installed coordinate, projection, SDK and offline environment.
 */
export const rejectOwnedDotnetCallbackConsumers = async options => {
	const { consumer, pkg, model, command, env, hostCallbacks } = options;
	await saveLakeFile(consumer, "Invalid.csproj", ownedDotnetBorrowProject(pkg, "Invalid.cs"));
	await runCopied(command, ["restore", "Invalid.csproj", "--configfile", "NuGet.Config"], consumer, env);
	const programs = [
		...ownedDotnetCallbackInvalidPrograms(model, hostCallbacks)
		, ["whole-owner-constructor", "void Invalid() { _ = new Value<Bundle>(); }", /CS1729/u]
		, ["private-owner-guard", "void Invalid(Value<Bundle> value) { _ = value.Guard; }", /CS1061/u]
		, ["resource-constructor", "void Invalid() { _ = new Ticket(); }", /CS1729/u]
		, ["raw-handle", "void Invalid(Ticket value) { _ = value.Handle; }", /CS1061/u]
	];
	const rejected = [];
	for(const [name, statement, diagnostic] of programs)
	{
		const source = `using ${model.namespace};\ninternal static class Program { static void Main() { } internal static ${statement} }\n`;
		await saveLakeFile(consumer, "Invalid.cs", source);
		await assert.rejects(runCopied(command, ["build", "Invalid.csproj", "--no-restore", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "invalid"], consumer, env), error => {
			assert.match(JSON.stringify(error.details ?? error.message), diagnostic, name); return true;
		});
		rejected.push({ name, source, diagnostic: diagnostic.source });
	}
	return rejected;
};

/**
 * Compile and execute the exact guide examples against the installed package.
 *
 * @param options - Installed coordinate, SDK and offline consumer environment.
 */
export const checkOwnedDotnetCallbackDocumentation = async options => {
	const { consumer, pkg, command, env, hostCallbacks } = options;
	const guide = await readFile("docs/consume/dotnet.md", "utf8");
	const publisher = await readFile("docs/publish/nuget.md", "utf8");
	const section = publisher.split("### Anchor a callback result to its argument\n")[1];
	const contract = JSON.parse(section.split("```json\n")[1].split("\n```")[0]);
	assert.deepEqual(contract, (await ownedDotnetCallbackResultConfiguration()).contracts["Owned.makeRecord"]);
	const observed = [];
	for(const name of ["owned-callback-results", ...hostCallbacks ? ["owned-callback-replies"] : []])
	{
		const source = await readFile(`tests/fixtures/documentation/consumers/dotnet/${name}.cs`, "utf8");
		assert.equal(guide.split(`\x60\x60\x60csharp file=dotnet/${name}.cs\n`)[1].split("\n```")[0] + "\n", source);
		await saveLakeFile(consumer, "Example.cs", source);
		await saveLakeFile(consumer, "Example.csproj", ownedDotnetBorrowProject(pkg, "Example.cs"));
		await runCopied(command, ["restore", "Example.csproj", "--configfile", "NuGet.Config"], consumer, env);
		await runCopied(command, ["build", "Example.csproj", "--no-restore", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", `examples/${name}`], consumer, env);
		const result = await runCopied(command, [`examples/${name}/Example.dll`], consumer, env);
		assert.deepEqual(result, { code: 0, stdout: "42\n42\n", stderr: "" });
		observed.push({ name, sourceSha256: sha256(source), ...result });
	}
	return { contract, observed };
};

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
