/**
 * Compile independent Fin 0 collection callers against generated public declarations.
 * These source checks do not claim installed execution or fresh Lean metadata.
 *
 * @file
 */
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { generateCBindingPackage } from "../../src/backends/c/generate.mjs";
import { generateGmpProjection } from "../../src/backends/c/gmp-projection.mjs";
import { generateCppBindingPackage } from "../../src/backends/cpp/generate.mjs";
import { boostSources } from "../../src/backends/cpp/boost.mjs";
import { generateCopiedJvmPackage } from "../../src/backends/jvm/copied-values.mjs";
import { generateCopiedDotnetPackage } from "../../src/backends/dotnet/copied-values.mjs";
import { compileCopiedWitModel } from "../../src/backends/wit/copied-model.mjs";
import { renderWitHostHeader } from "../../src/backends/wit/copied-host.mjs";
import { finRecordZeroCompilerModel } from "./fin-record-zero-fixture.mjs";
import { nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

test("independent Fin 0 nominal collection callers compile against public declarations", { skip: process.env.LEAN_BRIDGE_FIN_RECORD_ZERO_DECLARATIONS !== "1", timeout: 180_000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-record-zero-declarations-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = finRecordZeroCompilerModel().bindingIr, env = nativeFixtureEnvironment(["java", "kotlin", "dotnet"]);
	const emit = async (directory, files) => {
		for(const [path, source] of Object.entries(files)) await saveLakeFile(join(root, directory), path, source);
	};
	const caller = async (directory, profile, extension) => saveLakeFile(join(root, directory), `consumer.${extension}`,
		await readFile(`tests/fixtures/fin-record-zero-consumers/${profile}.${extension}`));
	await t.test("C and C++", async () => {
		await emit("raw", generateCBindingPackage(ir));
		await emit("gmp", generateGmpProjection(ir).files);
		await emit("cpp", { ...generateCppBindingPackage(ir), ...boostSources() });
		await caller("gmp", "c", "c"); await caller("cpp", "cpp", "cpp");
		await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-fsyntax-only", "-Iinclude", "consumer.c"], join(root, "gmp"));
		await runCopied("/usr/bin/c++", ["-std=c++20", "-Wall", "-Wextra", "-Werror", "-fsyntax-only", "-Iinclude", "-I../raw/include", "consumer.cpp"], join(root, "cpp"));
	});
	await t.test("Java and Kotlin", async () => {
		const files = generateCopiedJvmPackage(ir), sources = Object.keys(files).filter(path => path.endsWith(".java"));
		await emit("jvm", files); await caller("jvm", "java", "java"); await caller("jvm", "kotlin", "kt");
		await runCopied(env.LEAN_BRIDGE_JAVAC, ["--release", "22", "-Werror", "-proc:none", "-d", "classes", ...sources, "consumer.java"], join(root, "jvm"));
		await runCopied(env.LEAN_BRIDGE_KOTLINC, ["-Werror", "-jvm-target", "22", "-cp", "classes", "consumer.kt", "-d", "kotlin"], join(root, "jvm"), { ...env, JAVA_HOME: dirname(dirname(env.LEAN_BRIDGE_JAVA)) });
	});
	await t.test("C#", async () => {
		const files = generateCopiedDotnetPackage(ir), sources = Object.keys(files).filter(path => path.endsWith(".cs"));
		await emit("dotnet", files); await caller("dotnet", "dotnet", "cs");
		await saveLakeFile(join(root, "dotnet"), "Consumer.csproj", `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><AllowUnsafeBlocks>true</AllowUnsafeBlocks><TreatWarningsAsErrors>true</TreatWarningsAsErrors><EnableDefaultCompileItems>false</EnableDefaultCompileItems><NuGetAudit>false</NuGetAudit></PropertyGroup><ItemGroup>${[...sources, "consumer.cs"].map(path => `<Compile Include="${path}"/>`).join("")}</ItemGroup></Project>`);
		await runCopied(env.LEAN_BRIDGE_DOTNET, ["build", "Consumer.csproj", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out"], join(root, "dotnet"), {
			DOTNET_ROOT: dirname(env.LEAN_BRIDGE_DOTNET)
			, DOTNET_CLI_HOME: join(root, "dotnet-home")
			, DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1"
		});
	});
	await t.test("WIT host", async () => {
		await emit("wit", { "finrecordzero_wasmtime.h": renderWitHostHeader(compileCopiedWitModel(ir)) });
		await caller("wit", "wit-wasi", "c");
		const include = join(resolve(process.env.LEAN_BRIDGE_WASMTIME_C_API ?? ".toolchains/wasmtime42"), "include");
		await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-fsyntax-only", "-I.", "-I", include, "consumer.c"], join(root, "wit"));
	});
});
