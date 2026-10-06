/**
 * Checked top-level Fin sites in installed, relocated .NET packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, readdir, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileCopiedDotnetModel } from "../src/backends/dotnet/copied-model.mjs";
import { renderCopiedDotnetPackage } from "../src/backends/dotnet/copied-values.mjs";
import { verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { supportsNativeRefinementTargets } from "../src/build/native-project.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { corpusReviewedIr } from "./helpers/type-corpus-reviewed-ir.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";

const huge = "1180591620717411303424";
const expectedBounds = {
	"NativeFin.impossible": [["0"], null]
	, "NativeFin.only": [["1"], null]
	, "NativeFin.mirror": [["10"], "10"]
	, "NativeFin.twice": [["300"], null]
	, "NativeFin.succHuge": [[huge], huge]
	, "NativeFin.wrap": [[null], "7"]
	, "NativeFin.label": [[null, "4", null], null]
};
const bounds = refinements => refinements ? [refinements.parameters.map(item => item?.bound ?? null), refinements.result?.bound ?? null] : null;
const sharedLibraries = files => Object.fromEntries(Object.entries(files)
	.filter(([path]) => /\.so(?:\.|$)/.test(path)).map(([path, file]) => [basename(path), file.sha256 ?? file]));

/** Public API cases: exact bounds, host exception identity, cleanup and recovery. */
const dotnetFinConsumer = () => `using System;
using System.Numerics;
using LeanBridge.NativeFin;

static class Program
{
    static int checks;
    static void Check(bool value, string label) { if (!value) throw new Exception("failed: " + label); checks++; }
    static bool Rejected(Action action, string parameter, string bound)
    {
        try { action(); }
        catch (ArgumentOutOfRangeException) { return false; }
        catch (ArgumentException error) { return error.Message == parameter + " is not below its Fin " + bound + " bound"; }
        return false;
    }
    static bool Throws<T>(Action action) where T : Exception
    {
        try { action(); }
        catch (T) { return true; }
        catch (Exception) { return false; }
        return false;
    }
    static int Main()
    {
        BigInteger huge = BigInteger.One << 70, word = BigInteger.One << 32;
        Check(Rejected(() => Api.Impossible(0), "value", "0"), "Fin 0 rejects zero");
        Check(Rejected(() => Api.Impossible(1), "value", "0"), "Fin 0 rejects one");
        Check(Api.Only(0) == 7, "Fin 1 accepts zero");
        Check(Rejected(() => Api.Only(1), "value", "1"), "Fin 1 rejects its bound");
        Check(Api.Mirror(0) == 9 && Api.Mirror(9) == 0, "Fin 10 endpoints");
        foreach (var value in new[] { new BigInteger(10), new BigInteger(11), word, huge })
            Check(Rejected(() => Api.Mirror(value), "value", "10"), "Fin 10 rejects " + value);
        Check(Throws<ArgumentOutOfRangeException>(() => Api.Mirror(-1)), "negative is the Nat ArgumentOutOfRangeException");
        Check(Api.Twice(299) == 598, "alias accepts its largest value");
        Check(Rejected(() => Api.Twice(300), "value", "300"), "alias rejects its bound");
        Check(Rejected(() => Api.Twice(301), "value", "300"), "alias rejects beyond its bound");
        Check(Api.SuccHuge(word) == word + 1, "large Fin crosses a limb");
        Check(Api.SuccHuge(huge - 2) == huge - 1 && Api.SuccHuge(huge - 1) == huge - 1, "large Fin endpoints");
        foreach (var value in new[] { huge, huge + 1, BigInteger.One << 128 })
            Check(Rejected(() => Api.SuccHuge(value), "value", huge.ToString()), "large Fin rejects " + value);
        Check(Api.Wrap(100) == 2 && Api.Wrap(huge) == 2 && Api.Wrap(0) == 0, "result-only Fin values");
        BigInteger start = 5; string name = "slot";
        Check(Api.Label(start, 3, name) == "slot:8", "mixed arguments");
        Check(Rejected(() => Api.Label(start, 4, name), "offset", "4"), "mixed arguments reject the Fin site");
        Check(start == 5 && name == "slot" && Api.Label(start, 0, name) == "slot:5", "caller data unchanged");
        for (int i = 0; i < 1000; i++)
        {
            if (!Rejected(() => Api.Mirror(10 + i), "value", "10")) throw new Exception("invalid call accepted at " + i);
            if (Api.Mirror(i % 10) != 9 - i % 10) throw new Exception("valid call failed at " + i);
        }
        checks += 2000;
        Console.WriteLine("dotnet-fin-ok:" + checks);
        return 0;
    }
}
`;

test(".NET packages are checked Fin consumers beside C, C++, Python, Rust and Ruby", () => {
	for(const targets of [["nuget"], ["c", "nuget"], ["c", "cpp", "pypi", "cargo", "rubygems", "nuget"]])
		assert.equal(supportsNativeRefinementTargets(targets), true, targets.join(","));
	for(const target of ["cpan", "maven", "php-native", "wit-wasi"])
		assert.equal(supportsNativeRefinementTargets(["nuget", target]), false, target);
});

test("generated .NET bound docs come only from checked refinement metadata", () => {
	const ir = corpusReviewedIr({ id: "fins" }, [
		{ name: "Fins.label", parameters: ["nat", "nat", "string"], result: "string" }
		, { name: "Fins.plain", parameters: ["nat"], result: "nat" }]);
	const label = ir.declarations.find(item => item.id === "lean:Fins.label");
	label.source.extensions["lean-lang.org/refinements"] = { parameters: [null, { kind: "fin", bound: "4" }, null], result: null };
	const files = renderCopiedDotnetPackage(compileCopiedDotnetModel(ir));
	const api = Object.entries(files).find(([path, source]) => path.endsWith(".cs") && source.includes("public static class Api"))[1];
	assert.match(api, / {4}\/\/\/ <remarks>Checked Lean Fin bounds: value1 &lt; 4\.<\/remarks>\n {4}public static string Label\(/);
	assert.doesNotMatch(api, /bounds:[^\n]*\n {4}public static [^\n]* Plain\(/);
	assert.match(files["README.md"], /Lean Fin n parameters and results are System\.Numerics\.BigInteger values below n\./);
	assert.match(files["README.md"], /\n- LeanBridge\.Fins\.Api\.Label: value1 < 4\n/);
	label.source.extensions["lean-lang.org/refinements"] = { parameters: [null, { kind: "subtype", constructor: "Fins.check" }, null], result: null };
	assert.throws(() => renderCopiedDotnetPackage(compileCopiedDotnetModel(ir)), TypeError);
});

test("relocated source-free .NET packages check Fin bounds through the bundled C adapter", { skip: process.env.LEAN_BRIDGE_DOTNET_FIN_TEST !== "1", timeout: 2_400_000 }, async t => {
	const environment = nativeFixtureEnvironment(["c", "dotnet"]), reports = [], archives = [];
	for(const attempt of [0, 1])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-dotnet-fin-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-dotnet-fin-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/native-fin", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["NativeFin"]
			, targets: { c: { name: "native-fin", version: "1.0.0" }, nuget: { name: "native-fin", version: "1.0.0" } } }));
		t.diagnostic(`build ${attempt}: compiling the shared C library and NuGet package`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["c", "nuget"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		assert.deepEqual(Object.fromEntries(model.exports.map(item => [item.name, bounds(item.refinements)])), expectedBounds);
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		archives.push(Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))));
		await rm(author, { recursive: true, force: true });
		if(attempt === 1) break;
		const cPackage = receipt.packages.find(pkg => pkg.target === "c" && pkg.role === "component");
		const extracted = join(consumer, "c-extract");
		await saveLakeFile(extracted, ".keep", "");
		await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", join(handoff, cPackage.artifacts[0].path)], extracted);
		const cInstalled = join(extracted, `${cPackage.name}-${cPackage.version}-c`);
		const cReceipt = JSON.parse(await readFile(join(cInstalled, "lean-bridge-package.json"), "utf8"));
		await verifyNativeFiles(cInstalled, cReceipt.files);
		const cLibraries = sharedLibraries(cReceipt.files);
		// The NuGet package bundles the exact checked adapter that the C, Python and Rust probes instrument.
		const packages = receipt.packages.filter(pkg => pkg.target === "nuget");
		const nupkg = join(consumer, "nupkg");
		await saveLakeFile(nupkg, ".keep", "");
		await runCopied("/usr/bin/unzip", ["-q", join(handoff, packages.find(pkg => pkg.role === "component").artifacts[0].path), "-d", nupkg], consumer);
		const nativeDirectory = join(nupkg, "runtimes/linux-x64/native");
		const packageLibraries = Object.fromEntries(await Promise.all((await readdir(nativeDirectory)).filter(name => /\.so(?:\.|$)/.test(name))
			.map(async name => [name, sha256(await readFile(join(nativeDirectory, name)))])));
		const shared = Object.keys(packageLibraries).filter(name => Object.hasOwn(cLibraries, name)).sort();
		assert.ok(shared.includes("libnative_fin.so"), JSON.stringify({ nuget: packageLibraries, c: cLibraries }));
		for(const name of shared) assert.equal(packageLibraries[name], cLibraries[name], name);
		const docs = (await Promise.all((await readdir(nupkg, { recursive: true })).filter(path => path.endsWith(".xml")).map(path => readFile(join(nupkg, path), "utf8")))).join("\n");
		assert.match(docs, /Checked Lean Fin bounds: value &lt; 10; result &lt; 10\./);
		t.diagnostic("offline NuGet restore and build without producer files or Lean/C compilers");
		const fixture = { source: dotnetFinConsumer, success: "dotnet-fin-ok" };
		const { command, ...observation } = await installCopiedConsumer({ profile: "dotnet", consumer, handoff, packages, environment, fixture });
		const root = join(consumer, "dotnet"), relocated = join(consumer, "dotnet-relocated");
		await rename(root, relocated);
		const env = { ...copiedCleanEnvironment, DOTNET_ROOT: join(command, ".."), DOTNET_CLI_HOME: join(relocated, "dotnet-home"), DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1" };
		const repeated = await runCopied(command, ["out/Consumer.dll"], relocated, env);
		assert.equal(repeated.stderr, ""); assert.equal(repeated.stdout.trim(), `dotnet-fin-ok:${observation.checks}`);
		reports.push({ profile: "dotnet", path: "ordinary-source"
			, ...observation
			, packages
			, sharedNativeLibraries: Object.fromEntries(shared.map(name => [name, packageLibraries[name]]))
			, dispatch: { observed: false, reason: "the CLR loads native libraries privately; identity with the instrumented C adapter is asserted instead" }
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(canonicalJson(model))
			, receiptSha256: sha256(await readFile(join(handoff, "package-set-receipt.json")))
			, sourceRemovedBeforeInstallation: true
			, relocatedInstallation: true, repeatExecution: true });
		await rm(consumer, { recursive: true, force: true });
	}
	assert.deepEqual(archives[1], archives[0]);
	await saveLakeFile("build/native-fin", "dotnet.json", canonicalJson({ schemaVersion: 1, reports, archives: archives[0], reproducible: true }));
});
