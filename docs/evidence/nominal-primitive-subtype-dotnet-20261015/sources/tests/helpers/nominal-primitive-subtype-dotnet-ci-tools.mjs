/**
 * Measure the current C# host and framework without recompiling a successful run.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nominalPrimitiveSubtypeDotnetAssembly } from "./nominal-primitive-subtype-dotnet-package.mjs";
import { selectNominalSubtypeDotnetTools, observeNominalSubtypeDotnetRuntime } from "./nominal-subtype-dotnet-tools.mjs";

/**
 * Run the original managed caller's runtime-only entry in a fresh private root.
 * No historical absolute path, restore, compiler or native algorithm is invoked.
 *
 * @param selected - Explicit current dotnet executable.
 * @param read - Original relative-record reader.
 * @param members - Independently verified original NuGet members.
 */
export const measureNominalPrimitiveSubtypeDotnetCiTools = async (selected, read, members) => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-primitive-dotnet-ci-check-"));
	try
	{
		const sdkRoot = join(root, "toolchain"); await mkdir(sdkRoot);
		const tools = await selectNominalSubtypeDotnetTools(sdkRoot, selected);
		assert.equal(tools.sdk.version, "8.0.424");
		const runtimeRoot = join(root, "runtime"); await mkdir(runtimeRoot);
		const assembly = `${nominalPrimitiveSubtypeDotnetAssembly}.dll`;
		const caller = await read("consumer-environment/out/Consumer.dll");
		const context = JSON.parse(await read("installation.json"));
		assert.deepEqual({ bytes: caller.length, sha256: sha256(caller) }, context.outputs["Consumer.dll"]);
		const runtimeOptions = { tfm: "net8.0"
			, framework: { name: "Microsoft.NETCore.App", version: "8.0.0" }
			, configProperties: { "System.Runtime.Serialization.EnableUnsafeBinaryFormatterSerialization": false } };
		const files = { "Consumer.dll": caller
			, [assembly]: members.get(`lib/net8.0/${assembly}`)
			, "Consumer.runtimeconfig.json": Buffer.from(canonicalJson({ runtimeOptions })) };
		for(const [path, bytes] of Object.entries(files))
			await writeFile(join(runtimeRoot, path), bytes, { flag: "wx" });
		const observed = await observeNominalSubtypeDotnetRuntime(runtimeRoot, "Consumer.dll", tools);
		for(const [path, bytes] of Object.entries(files))
			assert.deepEqual(await readFile(join(runtimeRoot, path)), bytes);
		return { toolchain: { command: tools.command, interpreter: tools.interpreter, sdk: tools.sdk }
			, framework: { facts: observed.facts, runtimeFiles: observed.runtimeFiles } };
	}
	finally
	{ await rm(root, { recursive: true }); }
};
