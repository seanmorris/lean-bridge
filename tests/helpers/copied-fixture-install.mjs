/**
 * Offline installation harness for independently specified copied-value fixtures.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, readFile, symlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { installCpanArchive } from "../../src/release/cpan-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { brickMathRepository } from "./brick-math.mjs";


/**
 * Select producer toolchains without adding compilers to consumer PATH.
 *
 * @param profiles - Explicit profiles selected for this installed run.
 */
export const nativeFixtureEnvironment = profiles => ({ ...process.env
	, LEAN_BRIDGE_LEAN_PREFIX: resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2")
	, LEAN_BRIDGE_PERLS: JSON.stringify(profiles.includes("perl") ? [process.env.LEAN_BRIDGE_CORPUS_PERL ?? "/usr/bin/perl"] : ["/unavailable/perl"])
	, LEAN_BRIDGE_DOTNET: resolve(process.env.LEAN_BRIDGE_DOTNET ?? ".toolchains/dotnet/dotnet")
	, LEAN_BRIDGE_JAVA: resolve(process.env.LEAN_BRIDGE_JAVA ?? ".toolchains/jdk22/bin/java")
	, LEAN_BRIDGE_JAVAC: resolve(process.env.LEAN_BRIDGE_JAVAC ?? ".toolchains/jdk22/bin/javac")
	, LEAN_BRIDGE_MAVEN: resolve(process.env.LEAN_BRIDGE_MAVEN ?? ".toolchains/apache-maven-3.9.11/bin/mvn")
	, LEAN_BRIDGE_KOTLINC: resolve(process.env.LEAN_BRIDGE_KOTLINC ?? ".toolchains/kotlin-2.2.0/kotlinc/bin/kotlinc")
	, LEAN_BRIDGE_CARGO: resolve(process.env.LEAN_BRIDGE_CARGO ?? ".toolchains/rust-1.90.0/bin/cargo")
	, LEAN_BRIDGE_RUSTC: resolve(process.env.LEAN_BRIDGE_RUSTC ?? ".toolchains/rust-1.90.0/bin/rustc")
	, LEAN_BRIDGE_WASMTIME_C_API: resolve(process.env.LEAN_BRIDGE_WASMTIME_C_API ?? ".toolchains/wasmtime42") });

export const copiedCleanEnvironment = { PATH: "/unavailable", CC: "/unavailable/compiler", CXX: "/unavailable/compiler", LEAN_BRIDGE_LEAN_PREFIX: "/unavailable/lean", LEAN_BRIDGE_NATIVE_ROOT: "/unavailable/runtime" };
/**
 * Execute a consumer command and retain compiler diagnostics on failure.
 *
 * @param command - Absolute consumer tool or executable.
 * @param args - Command arguments without shell interpolation.
 * @param cwd - Task-owned consumer directory.
 * @param env - Isolated consumer environment.
 */
export const runCopied = (command, args, cwd, env = copiedCleanEnvironment) => processBuildRunner.capture({ command, args, cwd, env, timeoutMs: 180_000 }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
const extensions = { c: "c", cpp: "cpp", python: "py", ruby: "rb", perl: "pl", rust: "rs", dotnet: "cs", java: "java", kotlin: "kt", "php-native": "php", "wit-wasi": "c" };

/**
 * Install the archive, compile only host-language consumers, and execute assertions.
 *
 * @param root0 - Verified archive handoff and selected tools.
 * @param root0.profile - Explicit installed host profile.
 * @param root0.consumer - Task-owned consumer root.
 * @param root0.handoff - Relocated archive directory.
 * @param root0.packages - Verified package-set entries for this target.
 * @param root0.environment - Producer toolchain selection.
 * @param root0.fixture - Independent source generator and expected output contract.
 * @param root0.dependencies - Optional locked Cargo dependency handoff.
 */
export const installCopiedConsumer = async ({ profile, consumer, handoff, packages, environment, dependencies, fixture }) => {
	if(profile === "php-wasm")
		return (await import("./copied-fixture-php-wasm.mjs")).installCopiedPhpWasm({ consumer, handoff, packages, environment, fixture });
	const root = join(consumer, profile), pkg = packages.find(item => item.role === "component");
	const archive = join(handoff, pkg.artifacts[0].path);
	const extension = extensions[profile], source = await fixture.source(profile, extension, 64);
	await saveLakeFile(root, `consumer.${extension}`, source);
	let command, args, env = copiedCleanEnvironment;
	if(profile === "python")
	{
		command = join(root, "venv/bin/python");
		await runCopied(environment.LEAN_BRIDGE_PYTHON ?? "/usr/bin/python3", ["-I", "-m", "venv", join(root, "venv")], root);
		await runCopied(command, ["-I", "-m", "pip", "--isolated", "install", "--no-index", "--no-deps", "--no-cache-dir", archive], root);
		args = ["-I", "consumer.py"];
	}
	else if(["c", "cpp", "wit-wasi"].includes(profile))
	{
		await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", archive], root);
		const installed = join(root, `${pkg.name}-${pkg.version}-${profile}`);
		const receipt = JSON.parse(await readFile(join(installed, "lean-bridge-package.json")));
		await verifyNativeFiles(installed, receipt.files);
		const tools = join(root, "tools"); await mkdir(tools);
		for(const name of ["as", "ld"]) await symlink(`/usr/bin/${name}`, join(tools, name));
		const compile = { ...env, PATH: tools, PKG_CONFIG_LIBDIR: join(installed, "lib/pkgconfig"), PKG_CONFIG_PATH: "" };
		if(profile === "wit-wasi")
		{
			const wasmTools = environment.LEAN_BRIDGE_WASM_TOOLS ?? resolve(".toolchains/wasm-tools/bin/wasm-tools");
			await runCopied(wasmTools, ["validate", "--features", "component-model", join(installed, `component/${pkg.name}.wasm`)], root);
			const wit = (await runCopied(wasmTools, ["component", "wit", join(installed, `component/${pkg.name}.wasm`)], root)).stdout;
			for(const pattern of fixture.wit) assert.match(wit, pattern);
		}
		const flags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", profile === "wit-wasi" ? `${pkg.name}-wit` : receipt.pkgConfig], root, compile)).stdout.trim().split(/\s+/);
		command = join(root, "consumer");
		await runCopied(profile === "cpp" ? "/usr/bin/c++" : "/usr/bin/cc", [`-std=${profile === "cpp" ? "c++20" : "c11"}`, "-Wall", "-Wextra", "-Werror", "-UNDEBUG", `consumer.${extension}`, ...flags, "-o", command], root, compile);
		args = [];
	}
	else if(profile === "ruby")
	{
		command = (await runCopied(environment.LEAN_BRIDGE_RUBY ?? "ruby", ["--disable-gems", "-rrbconfig", "-e", "print RbConfig.ruby"], root, { PATH: environment.PATH })).stdout;
		env = { ...env, GEM_HOME: join(root, "gems"), GEM_PATH: join(root, "gems") };
		await runCopied(command, [environment.LEAN_BRIDGE_GEM ?? join(dirname(command), "gem"), "install", "--norc", archive, "--local", "--install-dir", env.GEM_HOME, "--no-document"], root, env);
		args = ["consumer.rb"];
	}
	else if(profile === "perl")
	{
		command = environment.LEAN_BRIDGE_CORPUS_PERL ?? "/usr/bin/perl";
		const tools = join(root, "tools"), prefix = join(root, "installed"); await mkdir(tools);
		for(const tool of ["make", "tar", "gzip", "sh", "cp", "mv", "rm", "chmod", "mkdir", "touch", "true"]) await symlink(`/usr/bin/${tool}`, join(tools, tool));
		env = { ...env, PERL5LIB: join(prefix, "lib/perl5") };
		for(const selected of [packages.find(item => item.role === "runtime"), pkg])
			await installCpanArchive({ archive: join(handoff, selected.artifacts[0].path), workingRoot: root, prefix, perl: command, mode: "prebuilt-only", environment: { ...env, PATH: tools } });
		args = ["consumer.pl"];
	}
	else if(profile === "php-native")
	{
		command = environment.LEAN_BRIDGE_PHP ?? "/usr/bin/php";
		const inspection = join(root, "inspection");
		await runCopied("/usr/bin/unzip", ["-q", archive, "-d", inspection], root);
		const metadata = JSON.parse(await readFile(join(inspection, "composer.json")));
		await saveLakeFile(root, "composer.json", canonicalJson({ name: "copied-check/consumer"
			, require: { [pkg.name]: pkg.version }
			, repositories: [{ "packagist.org": false }, await brickMathRepository(join(root, "feed")), { type: "package", package: { ...metadata, dist: { type: "zip", url: pathToFileURL(archive).href } } }]
			, config: { "allow-plugins": false } }));
		await runCopied(command, [environment.LEAN_BRIDGE_COMPOSER ?? "/usr/bin/composer", "--no-plugins", "--no-scripts", "--no-interaction", "install", "--prefer-dist"], root
			, { ...env, PATH: "/usr/bin:/bin", COMPOSER_ALLOW_SUPERUSER: "1", COMPOSER_DISABLE_NETWORK: "1", COMPOSER_HOME: join(root, "composer-home"), COMPOSER_CACHE_DIR: join(root, "composer-cache") });
		args = ["-n", "-d", "extension=ffi", "-d", "ffi.enable=1", "consumer.php"];
		await saveLakeFile(root, "strict.php", source.replace("declare(strict_types=0);", "declare(strict_types=1);"));
		const strict = await runCopied(command, [...args.slice(0, -1), "strict.php"], root);
		assert.equal(strict.stderr, ""); assert.match(strict.stdout, new RegExp(`^${fixture.success}:[0-9]+\n$`));
	}
	else if(profile === "dotnet")
	{
		command = environment.LEAN_BRIDGE_DOTNET;
		await mkdir(join(root, "feed"));
		await cp(archive, join(root, "feed", `${pkg.name}.${pkg.version}.nupkg`));
		await saveLakeFile(root, "Consumer.csproj", `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors><EnableDefaultCompileItems>false</EnableDefaultCompileItems></PropertyGroup><ItemGroup><Compile Include="consumer.cs"/><PackageReference Include="${pkg.name}" Version="[${pkg.version}]"/></ItemGroup></Project>`);
		await saveLakeFile(root, "NuGet.Config", '<configuration><packageSources><clear/><add key="prepared" value="feed"/></packageSources><fallbackPackageFolders><clear/></fallbackPackageFolders></configuration>');
		env = { ...env, DOTNET_ROOT: dirname(command), DOTNET_CLI_HOME: join(root, "dotnet-home"), DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1", NUGET_PACKAGES: join(root, "packages") };
		await runCopied(command, ["restore", "--configfile", "NuGet.Config"], root, env);
		await runCopied(command, ["build", "--no-restore", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out"], root, env);
		args = ["out/Consumer.dll"];
	}
	else if(profile === "java" || profile === "kotlin")
	{
		command = environment.LEAN_BRIDGE_JAVA;
		const jar = join(root, "component.jar");
		await cp(join(handoff, pkg.artifacts.find(item => item.path.endsWith(".jar")).path), jar);
		if(profile === "java")
		{
			await runCopied(environment.LEAN_BRIDGE_JAVAC, ["--release", "22", "-Werror", "-cp", jar, "consumer.java"], root);
			args = ["--enable-native-access=ALL-UNNAMED", "-cp", `${jar}:${root}`, "Consumer"];
		}
		else
		{
			await runCopied(environment.LEAN_BRIDGE_KOTLINC, ["-Werror", "-jvm-target", "22", "-cp", jar, "consumer.kt", "-include-runtime", "-d", "consumer.jar"], root, { ...environment, JAVA_HOME: dirname(dirname(command)) });
			args = ["--enable-native-access=ALL-UNNAMED", "-cp", `${jar}:${join(root, "consumer.jar")}`, "ConsumerKt"];
		}
	}
	else if(profile === "rust")
	{
		await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", archive], root);
		const dependencyArchive = join(consumer, "dependencies", dependencies.archive);
		assert.equal(sha256(await readFile(dependencyArchive)), dependencies.sha256);
		await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", dependencyArchive], root);
		await saveLakeFile(root, ".cargo/config.toml", '[source.crates-io]\nreplace-with = "prepared"\n[source.prepared]\ndirectory = "dependencies"\n');
		await saveLakeFile(root, "Cargo.toml", `[package]\nname="consumer"\nversion="0.0.0"\nedition="2021"\n[dependencies]\n${pkg.name}={path="${pkg.name}-${pkg.version}"}\n[[bin]]\nname="consumer"\npath="consumer.rs"\n[profile.dev]\ndebug=0\nincremental=false\n`);
		await runCopied(environment.LEAN_BRIDGE_CARGO, ["build", "--offline", "--bin", "consumer"], root
			, { ...env, PATH: "/usr/bin:/bin", RUSTC: environment.LEAN_BRIDGE_RUSTC, CARGO_HOME: join(root, "cargo-home"), CARGO_NET_OFFLINE: "true" });
		command = join(root, "target/debug/consumer"); args = [];
	}
	else throw new Error(`Copied consumer not implemented: ${profile}`);
	const result = await runCopied(command, args, root, env);
	assert.equal(result.stderr, "");
	assert.match(result.stdout.trim(), new RegExp(`^${fixture.success}:[0-9]+$`));
	const checks = Number(result.stdout.trim().split(":")[1]); assert.ok(checks >= 100);
	return { checks, consumerSha256: sha256(source), command, offlineInstall: true, compilerFreePath: true };
};
