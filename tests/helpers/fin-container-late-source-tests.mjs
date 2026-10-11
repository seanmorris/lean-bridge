/**
 * Compile all nine additional callers against generated public types.
 * Source checks are not installed execution evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { generateGmpProjection } from "../../src/backends/c/gmp-projection.mjs";
import { generateCBindingPackage } from "../../src/backends/c/generate.mjs";
import { compilePrimitiveCppModel, renderPrimitiveCppPackage } from "../../src/backends/cpp/primitives.mjs";
import { boostSources } from "../../src/backends/cpp/boost.mjs";
import { generateRustBindingPackage } from "../../src/backends/rust/generate.mjs";
import { compileCopiedDotnetModel } from "../../src/backends/dotnet/copied-model.mjs";
import { renderCopiedDotnetPackage } from "../../src/backends/dotnet/copied-values.mjs";
import { compileCopiedJvmModel } from "../../src/backends/jvm/copied-model.mjs";
import { renderCopiedJvmPackage } from "../../src/backends/jvm/copied-values.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { finContainerEdgeConsumer, finContainerEdgeReviewedIr } from "./fin-container-edges.mjs";
import { finLateAdditionalChecks, finLateConsumer, finLateProfiles } from "./fin-container-late-consumers.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import "./fin-container-late-report-tests.mjs";

const extensions = { c: "c", cpp: "cpp", python: "py", rust: "rs", ruby: "rb", dotnet: "cs", java: "java", kotlin: "kt", "php-native": "php" };
const enabled = process.env.LEAN_BRIDGE_FIN_LATE_SOURCE_TEST === "1";
const fresh = async (t, profile) => {
	const root = await mkdtemp(join(tmpdir(), `lean-bridge-fin-late-${profile}-source-`));
	t.after(() => rm(root, { recursive: true, force: true }));
	return root;
};
const filesAt = async (root, files) => {
	for(const [path, source] of Object.entries(files)) await saveLakeFile(root, path, source);
};

test("late-input consumers preserve all original cases and cover exactly the remaining nine hosts", async () => {
	assert.deepEqual(finLateProfiles, Object.keys(extensions));
	for(const profile of finLateProfiles)
	{
		const fragment = await readFile(`tests/fixtures/fin-container-late-consumers/${profile}.${extensions[profile]}`, "utf8");
		const combined = await finLateConsumer(profile);
		assert.equal(combined.split(fragment + "\n").length, 2);
		assert.equal(combined.replace(fragment + "\n", ""), await finContainerEdgeConsumer(profile));
		assert.ok(fragment.includes("1009"));
		assert.ok(fragment.includes("mid"));
		assert.equal(finLateAdditionalChecks[profile], profile === "c" ? 7072 : 6063);
	}
	for(const profile of ["wit-wasi", "perl", "php-wasm", "", "unknown"])
		await assert.rejects(() => finLateConsumer(profile));
});

for(const profile of ["c", "cpp", "python", "ruby", "php-native", "rust", "dotnet", "java"])
	test(`late-input ${profile === "java" ? "Java/Kotlin" : profile} caller compiles against generated public types`, { skip: !enabled }, async t => {
		const root = await fresh(t, profile), extension = extensions[profile];
		await saveLakeFile(root, `consumer.${extension}`, await finLateConsumer(profile));
		const ir = finContainerEdgeReviewedIr();
		let result;
		if(profile === "c" || profile === "cpp")
		{
			await filesAt(root, profile === "c" ? generateGmpProjection(ir).files
				: { ...generateCBindingPackage(ir), ...renderPrimitiveCppPackage(compilePrimitiveCppModel(ir)), ...boostSources() });
			result = await runCopied(profile === "c" ? "/usr/bin/cc" : "/usr/bin/c++"
				, [`-std=${profile === "c" ? "c11" : "c++20"}`, "-Wall", "-Wextra", "-Werror", "-fsyntax-only", "-Iinclude", `consumer.${extension}`], root);
		}
		else if(profile === "python")
			result = await runCopied(process.env.LEAN_BRIDGE_PYTHON ?? "/usr/bin/python3", ["-I", "-c", "import ast; ast.parse(open('consumer.py').read())"], root);
		else if(profile === "ruby")
		{
			result = await runCopied(resolve(process.env.LEAN_BRIDGE_RUBY ?? ".toolchains/ruby33/bin/ruby"), ["-c", "consumer.rb"], root);
			assert.equal(result.stdout, "Syntax OK\n"); result.stdout = "";
		}
		else if(profile === "php-native")
		{
			for(const mode of [0, 1])
			{
				const path = `consumer-${mode}.php`;
				await saveLakeFile(root, path, (await finLateConsumer(profile)).replace("declare(strict_types=0);", `declare(strict_types=${mode});`));
				result = await runCopied(process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php", ["-n", "-l", path], root);
				assert.equal(result.stdout, `No syntax errors detected in ${path}\n`);
				assert.equal(result.stderr, ""); result.stdout = "";
			}
		}
		else if(profile === "rust")
		{
			const files = generateRustBindingPackage(ir);
			await filesAt(join(root, "package"), files);
			const name = /^name = "([^"]+)"$/mu.exec(files["Cargo.toml"])[1];
			await saveLakeFile(root, "Cargo.toml", `[package]\nname="fin-late-source"\nversion="0.0.0"\nedition="2021"\n[dependencies]\nfincontainers={package="${name}",path="package"}\n[[bin]]\nname="consumer"\npath="consumer.rs"\n`);
			const cargo = resolve(process.env.LEAN_BRIDGE_CARGO ?? ".toolchains/rust-1.90.0/bin/cargo");
			result = await runCopied(cargo, ["check", "--offline", "--quiet"], root
				, { ...process.env, RUSTC: resolve(process.env.LEAN_BRIDGE_RUSTC ?? ".toolchains/rust-1.90.0/bin/rustc"), RUSTFLAGS: "-D warnings", CARGO_NET_OFFLINE: "true", CARGO_TARGET_DIR: join(root, "target") });
		}
		else if(profile === "dotnet")
		{
			await filesAt(join(root, "generated"), Object.fromEntries(Object.entries(renderCopiedDotnetPackage(compileCopiedDotnetModel(ir))).filter(([path]) => path.endsWith(".cs"))));
			await saveLakeFile(root, "Consumer.csproj", '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><AllowUnsafeBlocks>true</AllowUnsafeBlocks><TreatWarningsAsErrors>true</TreatWarningsAsErrors><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit></PropertyGroup></Project>');
			await saveLakeFile(root, "NuGet.Config", '<configuration><packageSources><clear/></packageSources><fallbackPackageFolders><clear/></fallbackPackageFolders></configuration>');
			const dotnet = resolve(process.env.LEAN_BRIDGE_DOTNET ?? ".toolchains/dotnet/dotnet");
			const env = { ...copiedCleanEnvironment, DOTNET_ROOT: dirname(dotnet), DOTNET_CLI_HOME: join(root, "dotnet-home"), DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1", NUGET_PACKAGES: join(root, "packages") };
			await runCopied(dotnet, ["restore", "--configfile", "NuGet.Config"], root, env);
			result = await runCopied(dotnet, ["build", "--no-restore", "--disable-build-servers", "-p:UseSharedCompilation=false"], root, env);
			assert.match(result.stdout, /Build succeeded\./u); result.stdout = "";
		}
		else
		{
			const files = Object.fromEntries(Object.entries(renderCopiedJvmPackage(compileCopiedJvmModel(ir))).filter(([path]) => path.endsWith(".java")));
			await filesAt(join(root, "generated"), files);
			const classes = join(root, "classes"), java = resolve(process.env.LEAN_BRIDGE_JAVA ?? ".toolchains/jdk22/bin/java");
			result = await runCopied(resolve(process.env.LEAN_BRIDGE_JAVAC ?? ".toolchains/jdk22/bin/javac")
				, ["--release", "22", "-Werror", "-d", classes, ...Object.keys(files).map(path => join(root, "generated", path)), "consumer.java"], root);
			assert.equal(result.stdout, ""); assert.equal(result.stderr, "");
			await saveLakeFile(root, "consumer.kt", await finLateConsumer("kotlin"));
			result = await runCopied(resolve(process.env.LEAN_BRIDGE_KOTLINC ?? ".toolchains/kotlin-2.2.0/kotlinc/bin/kotlinc")
				, ["-Werror", "-jvm-target", "22", "-cp", classes, "consumer.kt", "-d", "consumer.jar"], root
				, { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin", JAVA_HOME: dirname(dirname(java)) });
		}
		assert.equal(result.stdout, ""); assert.equal(result.stderr, "");
	});
