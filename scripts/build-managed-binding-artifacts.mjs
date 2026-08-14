#!/usr/bin/env node
/**
 * Builds the managed binding artifacts workflow.
 *
 * @file
 */


import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
	copyFile,
	mkdir,
	mkdtemp,
	readFile,
	readdir,
	stat,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { promisify } from "node:util";

import { parseBindingIr } from "../src/binding-ir/canonical.mjs";
import { generateDotnetBindingPackage } from "../src/backends/dotnet/generate.mjs";
import { generateJvmBindingPackage } from "../src/backends/jvm/generate.mjs";

const execute = promisify(execFile);
const sha256 = value => createHash("sha256").update(value).digest("hex");

const options = new Map();
for(let index = 2; index < process.argv.length; index += 2) options.set(process.argv[index], process.argv[index + 1]);
const outputOption = options.get("--output");
if(!outputOption) throw new Error("Usage: build-managed-binding-artifacts.mjs --output PATH [--binding-ir PATH] [--dotnet PATH] [--javac PATH]");

const output = resolve(outputOption);
await mkdir(output, { recursive: true });
if((await readdir(output)).length !== 0) throw new Error(`managed artifact output is not empty: ${output}`);
const bindingPath = resolve(options.get("--binding-ir") ?? "poc/lean-link-spike/bindings/alpha.binding-ir.json");
const dotnet = options.get("--dotnet") ?? process.env.LEAN_BRIDGE_DOTNET ?? "dotnet";
const javac = options.get("--javac") ?? process.env.LEAN_BRIDGE_JAVAC ?? "javac";
const ir = parseBindingIr(await readFile(bindingPath, "utf8"));
const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-managed-artifacts-"));

const run = async (command, args, settings = {}) => {
	try
	{
		return await execute(command, args, { maxBuffer: 32 * 1024 * 1024, ...settings });
	} catch(error)
	{
		throw new Error(`${command} failed\n${error.stdout ?? ""}${error.stderr ?? ""}`, { cause: error });
	}
};

const writePackage = async (root, files) => {
	for(const [path, source] of Object.entries(files))
	{
		const destination = join(root, path);
		await mkdir(dirname(destination), { recursive: true });
		await writeFile(destination, source);
	}
};

const collectFiles = async root => {
	const files = [];
	const visit = async directory => {
		for(const entry of (await readdir(directory, { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name)))
		{
			const absolute = join(directory, entry.name);
			if(entry.isDirectory()) await visit(absolute);
			else if(entry.isFile() && entry.name !== "managed-artifacts.json")
			{
				const bytes = await readFile(absolute);
				const facts = await stat(absolute);
				files.push({ path: relative(root, absolute), bytes: facts.size, sha256: sha256(bytes) });
			}
		}
	};
	await visit(root);
	return files;
};

const dotnetRoot = join(scratch, "dotnet");
await writePackage(dotnetRoot, generateDotnetBindingPackage(ir));
const dotnetOutput = join(scratch, "dotnet-output");
const dotnetHome = join(scratch, "dotnet-home");
await run(dotnet, [
	"build"
	, join(dotnetRoot, "src/LeanBridge.Alpha/LeanBridge.Alpha.csproj")
	, "--configuration", "Release"
	, "--output", dotnetOutput
	, "--nologo"
	, "--ignore-failed-sources"
	, "--disable-build-servers"
	, "/p:Deterministic=true"
	, "/p:ContinuousIntegrationBuild=true"
	, `/p:PathMap=${scratch}=/workspace/managed`
], {
	env: {
		...process.env,
		DOTNET_CLI_HOME: dotnetHome
		, DOTNET_CLI_TELEMETRY_OPTOUT: "1"
		, DOTNET_NOLOGO: "1"
		, NUGET_PACKAGES: join(scratch, "nuget-packages")
	}
});
const dotnetDestination = join(output, "dotnet/lib/net8.0");
await mkdir(dotnetDestination, { recursive: true });
for(const name of ["LeanBridge.Alpha.dll", "LeanBridge.Alpha.xml"])
{
	await copyFile(join(dotnetOutput, name), join(dotnetDestination, name));
}

const jvmRoot = join(scratch, "jvm");
const jvmFiles = generateJvmBindingPackage(ir);
await writePackage(jvmRoot, jvmFiles);
const javaSources = Object.keys(jvmFiles)
  .filter(path => path.endsWith(".java"))
  .sort()
  .map(path => join(jvmRoot, path));
const classes = join(output, "jvm/classes");
await mkdir(classes, { recursive: true });
await run(javac, ["--release", "22", "-g:none", "-encoding", "UTF-8", "-d", classes, ...javaSources]);

const [{ stdout: dotnetVersion }, { stderr: javacVersionError, stdout: javacVersionOutput }] = await Promise.all([
	run(dotnet, ["--version"])
	, run(javac, ["-version"])
]);
const files = await collectFiles(output);
const manifest = {
	schemaVersion: 1
	, component: ir.component.id
	, bindingIrSha256: JSON.parse(generateDotnetBindingPackage(ir)["binding-manifest.json"]).bindingIrSha256
	, target: "linux-x64-gnu.2.38"
	, toolchains: {
		dotnet: dotnetVersion.trim()
		, javac: (javacVersionError || javacVersionOutput).trim()
	}
	, files
};
await writeFile(join(output, "managed-artifacts.json"), `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ output, files: files.length, toolchains: manifest.toolchains }, null, 2)}\n`);
