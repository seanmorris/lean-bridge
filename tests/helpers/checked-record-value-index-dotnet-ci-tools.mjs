/**
 * Measure the current C# host and framework without rebuilding producer data.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkedRecordValueIndexDotnetAssembly
} from "./checked-record-value-index-dotnet-package.mjs";
import {
	observeNominalSubtypeDotnetRuntime, selectNominalSubtypeDotnetTools
} from "./nominal-subtype-dotnet-tools.mjs";

/**
 * Run the original caller's runtime-only entry in a fresh private directory.
 *
 * @param selected - Explicit current dotnet executable.
 * @param read - Original relative-record reader.
 * @param members - Independently verified original NuGet members.
 */
export const measureCheckedRecordValueIndexDotnetCiTools = async (
	selected, read, members
) => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-value-index-dotnet-ci-check-"
	));
	try
	{
		const sdkRoot = join(root, "toolchain");
		await mkdir(sdkRoot);
		const tools = await selectNominalSubtypeDotnetTools(sdkRoot, selected);
		assert.equal(tools.sdk.version, "8.0.424"
			, "Hosted value-index .NET SDK");
		const runtimeRoot = join(root, "runtime");
		await mkdir(runtimeRoot);
		const assembly = `${checkedRecordValueIndexDotnetAssembly}.dll`;
		const caller = await read("consumer-environment/out/Consumer.dll");
		const context = JSON.parse(await read("installation.json"));
		assert.deepEqual({ bytes: caller.length, sha256: sha256(caller) }
			, context.outputs["Consumer.dll"]
			, "Original caller binary identity");
		const runtimeOptions = {
			tfm: "net8.0"
			, framework: { name: "Microsoft.NETCore.App", version: "8.0.0" }
			, configProperties: {
				"System.Runtime.Serialization.EnableUnsafeBinaryFormatterSerialization": false
			}
		};
		const files = {
			"Consumer.dll": caller
			, [assembly]: members.get(`lib/net8.0/${assembly}`)
			, "Consumer.runtimeconfig.json": Buffer.from(canonicalJson({
				runtimeOptions
			}))
		};
		for(const [path, bytes] of Object.entries(files))
			await writeFile(join(runtimeRoot, path), bytes, { flag: "wx" });
		const observed = await observeNominalSubtypeDotnetRuntime(
			runtimeRoot, "Consumer.dll", tools
		);
		for(const [path, bytes] of Object.entries(files))
			assert.deepEqual(await readFile(join(runtimeRoot, path)), bytes
				, path);
		return {
			toolchain: {
				command: tools.command, interpreter: tools.interpreter, sdk: tools.sdk
			}
			, framework: {
				facts: observed.facts, runtimeFiles: observed.runtimeFiles
			}
		};
	}
	finally
	{
		await rm(root, { recursive: true });
	}
};
