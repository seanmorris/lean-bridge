/**
 * Source-located compiler rejection against the original installed assembly.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { captureCorpusCompiler } from "./type-corpus-compiler.mjs";

const select = values => values.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(-1);
const probes = [
	["input-type", "Api.Tree(42);", "CS1503"]
	, ["result-type", "Spine value = Api.Empty();", "CS0029"]
	, ["array-elements", "new TreeBranch(new uint[0]);", "CS1503"]
	, ["abstract-case", "new Tree();", "CS0144"]
	, ["init-only", "var value = new TreeBranch(System.Array.Empty<Tree>()); value.Children = System.Array.Empty<Tree>();", "CS8852"]
	, ["unit-result", "byte[] values = Api.Units(new Unit[0]);", "CS0029"]
	, ["private-ffi", "LeanBridge.Recursive.Interop.GraphCalls.Call0(null!);", "CS0122"]
	, ["transparent-alias", "Forest value = null!; System.GC.KeepAlive(value);", "CS0246"]
];

/**
 * Check exact diagnostics without referencing private source or native artifacts.
 *
 * @param options - Compiler and immutable installed assembly paths.
 * @param options.root - Test-owned output directory.
 * @param options.dotnet - Absolute .NET SDK executable.
 * @param options.assembly - Original installed library.
 * @param options.environment - Closed offline compiler environment.
 */
export const checkDotnetGraphPackageTypes = async ({ root, dotnet, assembly, environment }) => {
	const dotnetRoot = dirname(dotnet), sdk = select((await readdir(join(dotnetRoot, "sdk"))).filter(version => /^8\.0\./.test(version)));
	const compiler = join(dotnetRoot, "sdk", sdk, "Roslyn/bincore/csc.dll");
	const refRoot = join(dotnetRoot, "packs/Microsoft.NETCore.App.Ref", select((await readdir(join(dotnetRoot, "packs/Microsoft.NETCore.App.Ref"))).filter(version => /^8\.0\./.test(version))), "ref/net8.0");
	const references = (await readdir(refRoot)).filter(file => file.endsWith(".dll")).sort().map(file => `/reference:${join(refRoot, file)}`), rejected = [];
	for(const [name, statement, code] of probes)
	{
		const source = `using LeanBridge.Recursive; static class Invalid { static void Test() { ${statement} } }\n`, file = `reject-${name}.cs`;
		await saveLakeFile(root, file, source);
		const result = await captureCorpusCompiler(dotnet, ["exec", compiler, "/nologo", "/noconfig", "/nostdlib+", "/target:library", "/langversion:12", "/nullable:enable", "/warnaserror+", ...references, `/reference:${assembly}`, "/out:rejected.dll", file], root, environment);
		assert.equal(result.code, 1, result.stdout + result.stderr);
		assert.deepEqual([...result.stdout.matchAll(/error (CS\d+):/g)].map(match => match[1]), [code], result.stdout);
		assert.ok(result.stdout.includes(`${file}(`), result.stdout);
		rejected.push({ name, code, sourceSha256: sha256(source) });
	}
	return { sdk, compilerSha256: sha256(await readFile(compiler)), assemblySha256: sha256(await readFile(assembly)), rejected };
};
