/**
 * Compile recursive C# public types independently of Lean and native loading.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateCopiedDotnetGraphValues } from "../src/backends/dotnet/copied-graph-values.mjs";
import { compileCopiedDotnetModel } from "../src/backends/dotnet/copied-model.mjs";
import { nativeRecursiveReviewedIr } from "./helpers/native-recursive-reviewed.mjs";
import { dotnetAliasGraphIr, dotnetLinkedGraphIr, dotnetDeepArrayGraphIr } from "./helpers/dotnet-graph-values-fixture.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { assertSourceRegistrationUpdate } from "./helpers/source-registration-history.mjs";

test("C# recursive declarations preserve nominal edges, branch names and transparent aliases", () => {
	const ir = nativeRecursiveReviewedIr(), before = structuredClone(ir), model = generateCopiedDotnetGraphValues(ir);
	assert.deepEqual(ir, before); assert.deepEqual(generateCopiedDotnetGraphValues(ir), model);
	const reversed = structuredClone(ir); reversed.types.reverse();
	assert.deepEqual(generateCopiedDotnetGraphValues(reversed), model);
	assert.equal(model.namespace, "LeanBridge.Recursive"); assert.equal(model.functions.length, 18);
	assert.equal(model.types.length, 38);
	assert.match(model.source, /public sealed record SpineNext\(Spine Value\) : Spine, IGraphValue/);
	assert.match(model.source, /public sealed record TreeBranch\(Tree\[\] Children\)/);
	assert.match(model.source, /public sealed record EmptyRecord\(\)/);
	assert.match(model.source, /global::System.Numerics.BigInteger Natural/);
	assert.match(model.source, /ulong Word, long SignedWord/);
	assert.match(model.source, /Lean alias Forest = list<Tree>; C#: Tree\[\]/);
	assert.deepEqual(model.aliases.find(alias => alias.name === "TreeAlias"), {
		id: "lean:Recursive.TreeAlias"
		, name: "TreeAlias"
		, target: { kind: "named", id: "lean:Recursive.Tree" }
		, contractType: "Tree", managedType: "Tree" });
	assert.doesNotMatch(model.source, /DllImport|NativeLibrary|lean_object|constructor_tag|\bunsafe\b|System.Text.Json/);
	assert.throws(() => compileCopiedDotnetModel(ir), /acyclic|recursive/i);
});

test("C# graph declarations reject name collisions and preserve distinct underscored cases", () => {
	for(const name of ["GraphValues", "IGraphValue", "GraphScope", "Api", "Option", "Spine", "Recursive"])
	{
		const ir = nativeRecursiveReviewedIr(); ir.types.find(type => type.name === "Scalars").name = name;
		assert.throws(() => generateCopiedDotnetGraphValues(ir), /reserved|duplicate|collision/i);
	}
	for(const name of ["equals", "clone", "deconstruct", "getHashCode", "link"])
	{
		const ir = dotnetLinkedGraphIr(); ir.types[0].fields[0].name = name;
		assert.throws(() => generateCopiedDotnetGraphValues(ir), /reserved|duplicate/);
	}
	const duplicate = nativeRecursiveReviewedIr();
	duplicate.types.find(type => type.name === "Spine").cases[1].name = "Next";
	assert.throws(() => generateCopiedDotnetGraphValues(duplicate), /duplicate|collision/);
	const underscored = nativeRecursiveReviewedIr();
	underscored.types.find(type => type.name === "Marker").cases[0].name = "unit_";
	underscored.types.find(type => type.name === "Marker").cases[1].fields[0].name = "value_";
	assert.match(generateCopiedDotnetGraphValues(underscored).source, /record MarkerUnit_\(\)/);
	assert.match(generateCopiedDotnetGraphValues(underscored).source, /record MarkerUnit\(Unit Value_\)/);
	const alias = nativeRecursiveReviewedIr();
	alias.types.find(type => type.name === "TreeAlias").name = "Option";
	assert.match(generateCopiedDotnetGraphValues(alias).source, /Lean alias Option = Tree; C#: Tree/);
});

test("C# aliases have bounded CLR expansion without inventing nominal wrappers", () => {
	const chain = generateCopiedDotnetGraphValues(dotnetAliasGraphIr(700, "alias"));
	assert.equal(chain.aliases.length, 700); assert.equal(chain.types.length, 1);
	assert.ok(chain.source.length < 100000);
	assert.match(chain.source, /Lean alias Alias699 = Alias698; C#: uint/);
	assert.doesNotMatch(chain.source, /record Alias|class Alias|struct Alias/);
	assert.throws(() => generateCopiedDotnetGraphValues(dotnetAliasGraphIr(700)), /expanded CLR structural type exceeds/);
	assert.throws(() => generateCopiedDotnetGraphValues(dotnetAliasGraphIr(34, "array")), /expanded CLR structural type exceeds/);
	assert.equal(generateCopiedDotnetGraphValues(dotnetAliasGraphIr(33, "array")).aliases.at(-1)?.managedType.length > 0, true);
	assert.match(generateCopiedDotnetGraphValues(dotnetLinkedGraphIr()).source, /record Link\(Option<Link> Tail, uint Value\)/);
	const repeated = dotnetAliasGraphIr(13);
	const record = dotnetLinkedGraphIr().types[0];
	repeated.types.push({ ...record, id: "lean:Recursive.Large", name: "Large"
		, fields: Array.from({ length: 256 }, (_, index) => ({ ...record.fields[0], name: `item${index}`, type: { kind: "named", id: "lean:Recursive.Alias12" } })) });
	assert.throws(() => generateCopiedDotnetGraphValues(repeated), /generated declarations exceed 4 MiB/);
});

test("C# recursive types execute equality, hashing, patterns and bounded rejection", {
	skip: process.env.LEAN_BRIDGE_DOTNET_GRAPH_TEST !== "1", timeout: 180_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-dotnet-graph-values-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const generated = {
		Recursive: generateCopiedDotnetGraphValues(nativeRecursiveReviewedIr())
		, Linked: generateCopiedDotnetGraphValues(dotnetLinkedGraphIr())
		, Deep: generateCopiedDotnetGraphValues(dotnetDeepArrayGraphIr())
	};
	for(const [name, model] of Object.entries(generated)) await saveLakeFile(root, `library/${name}.cs`, model.source);
	const properties = '<TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><ImplicitUsings>disable</ImplicitUsings><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors><UseAppHost>false</UseAppHost>';
	await saveLakeFile(root, "library/Values.csproj", `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup>${properties}</PropertyGroup></Project>`);
	await saveLakeFile(root, "consumer/Consumer.csproj", `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup>${properties}<OutputType>Exe</OutputType></PropertyGroup><ItemGroup><ProjectReference Include="../library/Values.csproj"/></ItemGroup></Project>`);
	await saveLakeFile(root, "NuGet.Config", '<configuration><packageSources><clear/></packageSources><fallbackPackageFolders><clear/></fallbackPackageFolders></configuration>');
	const probe = await readFile("tests/fixtures/structured-types/recursive-values.cs", "utf8");
	await saveLakeFile(root, "consumer/Program.cs", probe);
	const dotnet = nativeFixtureEnvironment(["dotnet"]).LEAN_BRIDGE_DOTNET;
	const env = { ...copiedCleanEnvironment, DOTNET_ROOT: dirname(dotnet), DOTNET_CLI_HOME: join(root, "home"), DOTNET_NOLOGO: "1", DOTNET_CLI_TELEMETRY_OPTOUT: "1", NUGET_PACKAGES: join(root, "packages") };
	await runCopied(dotnet, ["build", "consumer/Consumer.csproj", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out"], root, env);
	const result = await runCopied(dotnet, ["out/Consumer.dll"], root, env);
	assert.equal(result.stderr, ""); const observation = JSON.parse(result.stdout);
	assert.ok(observation.checks >= 100); assert.equal(observation.wideFields, 256);
	assert.equal(observation.nativeCalls, 0); assert.equal(observation.cycleRejections, 9);
	const rejections = [
		["abstract-family", "new Tree();", "CS0144"]
		, ["wrong-field", "new SpineNext(1u);", "CS1503"]
		, ["wrong-scalar", "new SpineLeaf(\"1\");", "CS1503"]
		, ["immutable-field", "var value = new SpineLeaf(1u); value.Value = 2u;", "CS8852"]
		, ["wrong-option", "Option<Tree>.Some(new SpineLeaf(1u));", "CS1503"]
		, ["wrong-result", "Result<Tree, string>.Ok(\"bad\");", "CS1503"]
		, ["unexported-alias", "Forest value = null!; _ = value;", "CS0246"]
		, ["sealed-constructor", "public record Fake() : TreeLeaf(null!);", "CS0509"]
		, ["closed-family", "public record Fake() : Tree;", "CS7036"]
	];
	for(const [name, source, diagnostic] of rejections)
	{
		await saveLakeFile(root, "consumer/Program.cs", `using LeanBridge.Recursive;\n${source.startsWith("public record") ? `internal static class Program { static void Main() {} }\n${source}` : source}\n`);
		let failure;
		try
		{ await runCopied(dotnet, ["build", "consumer/Consumer.csproj", "--no-restore", "--disable-build-servers", "-p:UseSharedCompilation=false"], root, env); }
		catch(error)
		{ failure = error; }
		assert.ok(failure, `Must reject ${name}`); assert.match(failure.message, new RegExp(diagnostic), name);
	}
	await saveLakeFile("build/recursive", "dotnet-values.json", canonicalJson({
		schemaVersion: 1
		, compiledLean: false
		, installedPackage: false
		, observation
		, rejections: rejections.map(([name, , diagnostic]) => ({ name, diagnostic }))
		, probeSha256: sha256(probe)
		, generatedSourceHashes: Object.fromEntries(Object.entries(generated).map(([name, model]) => [name, sha256(model.source)])) }));
});

test("C# recursive declaration execution is required in downstream CI", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.ok(workflow.includes("LEAN_BRIDGE_DOTNET_GRAPH_TEST=1 node --test tests/dotnet-copied-graph-values.test.mjs"));
	assert.ok(workflow.includes("test -s build/recursive/dotnet-values.json"));
	assert.ok(workflow.includes("            build/recursive/dotnet-values.json\n"));
});

test("new test registrations retain the original Perl acceptance sources", async () => {
	const receipt = JSON.parse(await readFile("docs/evidence/perl-recursive-regressions-20260923.json"));
	for(const path of ["src/adoption/test-profiles.mjs", "tests/helpers/source-registration-history.mjs"])
	{
		const source = await readFile(path, "utf8"), hash = receipt.sourceHashes[path]; assert.ok(hash);
		assert.equal(await assertSourceRegistrationUpdate(path, source, hash), true);
		await assert.rejects(() => assertSourceRegistrationUpdate(path, source + "\n", hash));
		await assert.rejects(() => assertSourceRegistrationUpdate(path, source, "0".repeat(64)));
	}
	assert.equal(await assertSourceRegistrationUpdate("src/build/native-project.mjs", "changed", "0".repeat(64)), false);
});
