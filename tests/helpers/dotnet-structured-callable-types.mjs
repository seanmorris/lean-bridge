/**
 * Independent typed negative callers against the original installed assembly.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { captureCorpusCompiler } from "./type-corpus-compiler.mjs";

const select = values => values.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(-1);

/**
 * Require the specified source-located C# diagnostics, not unrelated build failure.
 *
 * @param options - Installed assembly, isolated compiler environment and paths.
 * @param options.root - Task-owned negative-caller directory.
 * @param options.dotnet - Absolute .NET SDK driver.
 * @param options.assembly - Original installed public assembly.
 * @param options.environment - Offline consumer environment.
 */
export const checkDotnetStructuredCallableTypes = async ({ root, dotnet, assembly, environment }) => {
	const dotnetRoot = dirname(dotnet);
	const sdk = select((await runCopied(dotnet, ["--list-sdks"], root, environment)).stdout.split("\n").map(line => /^(8\.0\.\d+) \[/.exec(line)?.[1]).filter(Boolean));
	const compiler = join(dotnetRoot, "sdk", sdk, "Roslyn/bincore/csc.dll");
	const refRoot = join(dotnetRoot, "packs/Microsoft.NETCore.App.Ref", select((await readdir(join(dotnetRoot, "packs/Microsoft.NETCore.App.Ref"))).filter(version => version.startsWith("8.0."))), "ref/net8.0");
	const references = (await readdir(refRoot)).filter(file => file.endsWith(".dll")).sort().map(file => `/reference:${join(refRoot, file)}`);
	const invalid = await readFile("tests/fixtures/structured-callable-consumers/dotnet-invalid.json", "utf8"), rejected = [];
	for(const { name, statement, codes } of JSON.parse(invalid))
	{
		const source = `using LeanBridge.Structured; static class Invalid { static void Test() { ${statement} } }\n`;
		const file = `reject-${name}.cs`; await saveLakeFile(root, file, source);
		const result = await captureCorpusCompiler(dotnet, ["exec", compiler, "/nologo", "/noconfig", "/nostdlib+", "/target:library", "/langversion:12", "/nullable:enable", "/warnaserror+", ...references, `/reference:${assembly}`, "/out:rejected.dll", file], root, environment);
		assert.equal(result.code, 1, result.stdout + result.stderr);
		assert.deepEqual([...result.stdout.matchAll(/error (CS\d+):/g)].map(match => match[1]), codes, result.stdout);
		assert.ok(result.stdout.includes(`${file}(`), result.stdout);
		rejected.push({ name, codes, sourceSha256: sha256(source) });
	}
	return { sdk, compilerSha256: sha256(await readFile(compiler))
		, assemblySha256: sha256(await readFile(assembly)), rejected
		, rejectionSourceSha256: sha256(invalid) };
};
