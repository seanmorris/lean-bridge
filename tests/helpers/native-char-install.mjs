/**
 * Offline consumers of the prepared native Char package archives.
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
import { charPoints } from "./native-char-fixture.mjs";
import { brickMathRepository } from "./brick-math.mjs";

const coordinate = { name: "glyphs-char", version: "1.0.0" };
export const nativeCharTargets = Object.freeze({ c: ["c", coordinate]
	, cpp: ["cpp", coordinate]
	, python: ["pypi", coordinate]
	, rust: ["cargo", coordinate]
	, dotnet: ["nuget", { name: "Glyphs.Char", version: "1.0.0" }]
	, java: ["maven", { name: "org.leanbridge:glyphs-char", version: "1.0.0" }]
	, kotlin: ["maven", { name: "org.leanbridge:glyphs-char", version: "1.0.0" }]
	, ruby: ["rubygems", coordinate]
	, perl: ["cpan", { module: "LeanBridge::Glyphs", version: "1.000" }]
	, "php-native": ["php-native", { name: "example/glyphs-char", version: "1.0.0" }]
	, "wit-wasi": ["wit-wasi", coordinate]
	, "php-wasm": ["php-wasm", { npm: { name: "glyphs-char-wasm", version: "1.0.0" }, composer: { name: "example/glyphs-char-wasm", version: "1.0.0" } }] });

/**
 * Select producer toolchains without adding compilers to consumer PATH.
 *
 * @param profiles - Explicit profiles selected for this installed run.
 */
export const nativeCharEnvironment = profiles => ({ ...process.env
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

export const charCleanEnvironment = { PATH: "/unavailable", CC: "/unavailable/compiler", CXX: "/unavailable/compiler", LEAN_BRIDGE_LEAN_PREFIX: "/unavailable/lean", LEAN_BRIDGE_NATIVE_ROOT: "/unavailable/runtime" };
/**
 * Execute a consumer command and retain compiler diagnostics on failure.
 *
 * @param command - Absolute consumer tool or executable.
 * @param args - Command arguments without shell interpolation.
 * @param cwd - Task-owned consumer directory.
 * @param env - Isolated consumer environment.
 */
export const runChar = (command, args, cwd, env = charCleanEnvironment) => processBuildRunner.capture({ command, args, cwd, env, timeoutMs: 180_000 }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
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
 * @param root0.dependencies - Optional locked Cargo dependency handoff.
 */
export const installCharConsumer = async ({ profile, consumer, handoff, packages, environment, dependencies }) => {
	if(profile === "php-wasm")
		return (await import("./native-char-php-wasm.mjs")).installCharPhpWasm({ consumer, handoff, packages, environment });
	const root = join(consumer, profile), pkg = packages.find(item => item.role === "component");
	const archive = join(handoff, pkg.artifacts[0].path);
	const extension = extensions[profile], source = (await readFile(`tests/fixtures/char-consumers/${profile}.${extension}`, "utf8")).replaceAll("__POINTS__", charPoints.join(", "));
	await saveLakeFile(root, `consumer.${extension}`, source);
	let command, args, env = charCleanEnvironment;
	if(profile === "python")
	{
		command = join(root, "venv/bin/python");
		await runChar(environment.LEAN_BRIDGE_PYTHON ?? "/usr/bin/python3", ["-I", "-m", "venv", join(root, "venv")], root);
		await runChar(command, ["-I", "-m", "pip", "--isolated", "install", "--no-index", "--no-deps", "--no-cache-dir", archive], root);
		args = ["-I", "consumer.py"];
	}
	else if(["c", "cpp", "wit-wasi"].includes(profile))
	{
		await runChar("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", archive], root);
		const installed = join(root, `${pkg.name}-${pkg.version}-${profile}`);
		const receipt = JSON.parse(await readFile(join(installed, "lean-bridge-package.json")));
		await verifyNativeFiles(installed, receipt.files);
		const tools = join(root, "tools"); await mkdir(tools);
		for(const name of ["as", "ld"]) await symlink(`/usr/bin/${name}`, join(tools, name));
		const compile = { ...env, PATH: tools, PKG_CONFIG_LIBDIR: join(installed, "lib/pkgconfig"), PKG_CONFIG_PATH: "" };
		if(profile === "wit-wasi")
		{
			const wasmTools = environment.LEAN_BRIDGE_WASM_TOOLS ?? resolve(".toolchains/wasm-tools/bin/wasm-tools");
			await runChar(wasmTools, ["validate", "--features", "component-model", join(installed, `component/${pkg.name}.wasm`)], root);
			const wit = (await runChar(wasmTools, ["component", "wit", join(installed, `component/${pkg.name}.wasm`)], root)).stdout;
			assert.match(wit, /keep: func\([^)]*: char\) -> char/);
			assert.match(wit, /list<char>/);
		}
		const flags = (await runChar("/usr/bin/pkg-config", ["--cflags", "--libs", profile === "wit-wasi" ? `${pkg.name}-wit` : receipt.pkgConfig], root, compile)).stdout.trim().split(/\s+/);
		command = join(root, "consumer");
		await runChar(profile === "cpp" ? "/usr/bin/c++" : "/usr/bin/cc", [`-std=${profile === "cpp" ? "c++20" : "c11"}`, "-Wall", "-Wextra", "-Werror", "-UNDEBUG", `consumer.${extension}`, ...flags, "-o", command], root, compile);
		args = [];
	}
	else if(profile === "ruby")
	{
		command = (await runChar(environment.LEAN_BRIDGE_RUBY ?? "ruby", ["--disable-gems", "-rrbconfig", "-e", "print RbConfig.ruby"], root, { PATH: environment.PATH })).stdout;
		env = { ...env, GEM_HOME: join(root, "gems"), GEM_PATH: join(root, "gems") };
		await runChar(command, [environment.LEAN_BRIDGE_GEM ?? join(dirname(command), "gem"), "install", "--norc", archive, "--local", "--install-dir", env.GEM_HOME, "--no-document"], root, env);
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
		await runChar("/usr/bin/unzip", ["-q", archive, "-d", inspection], root);
		const metadata = JSON.parse(await readFile(join(inspection, "composer.json")));
		await saveLakeFile(root, "composer.json", canonicalJson({ name: "char-check/consumer"
			, require: { [pkg.name]: pkg.version }
			, repositories: [{ "packagist.org": false }, await brickMathRepository(join(root, "feed")), { type: "package", package: { ...metadata, dist: { type: "zip", url: pathToFileURL(archive).href } } }]
			, config: { "allow-plugins": false } }));
		await runChar(command, [environment.LEAN_BRIDGE_COMPOSER ?? "/usr/bin/composer", "--no-plugins", "--no-scripts", "--no-interaction", "install", "--prefer-dist"], root
			, { ...env, PATH: "/usr/bin:/bin", COMPOSER_ALLOW_SUPERUSER: "1", COMPOSER_DISABLE_NETWORK: "1", COMPOSER_HOME: join(root, "composer-home"), COMPOSER_CACHE_DIR: join(root, "composer-cache") });
		args = ["-n", "-d", "extension=ffi", "-d", "ffi.enable=1", "consumer.php"];
		await saveLakeFile(root, "strict.php", source.replace("declare(strict_types=0);", "declare(strict_types=1);"));
		const strict = await runChar(command, [...args.slice(0, -1), "strict.php"], root);
		assert.equal(strict.stderr, ""); assert.match(strict.stdout, /^char-ok:[0-9]+\n$/);
	}
	else if(profile === "dotnet")
	{
		command = environment.LEAN_BRIDGE_DOTNET;
		await mkdir(join(root, "feed"));
		await cp(archive, join(root, "feed", `${pkg.name}.${pkg.version}.nupkg`));
		await saveLakeFile(root, "Consumer.csproj", `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors><EnableDefaultCompileItems>false</EnableDefaultCompileItems></PropertyGroup><ItemGroup><Compile Include="consumer.cs"/><PackageReference Include="${pkg.name}" Version="[${pkg.version}]"/></ItemGroup></Project>`);
		await saveLakeFile(root, "NuGet.Config", '<configuration><packageSources><clear/><add key="prepared" value="feed"/></packageSources><fallbackPackageFolders><clear/></fallbackPackageFolders></configuration>');
		env = { ...env, DOTNET_ROOT: dirname(command), DOTNET_CLI_HOME: join(root, "dotnet-home"), DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1", NUGET_PACKAGES: join(root, "packages") };
		await runChar(command, ["restore", "--configfile", "NuGet.Config"], root, env);
		await runChar(command, ["build", "--no-restore", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out"], root, env);
		args = ["out/Consumer.dll"];
	}
	else if(profile === "java" || profile === "kotlin")
	{
		command = environment.LEAN_BRIDGE_JAVA;
		const jar = join(root, "glyphs.jar");
		await cp(join(handoff, pkg.artifacts.find(item => item.path.endsWith(".jar")).path), jar);
		if(profile === "java")
		{
			await runChar(environment.LEAN_BRIDGE_JAVAC, ["--release", "22", "-Werror", "-cp", jar, "consumer.java"], root);
			args = ["--enable-native-access=ALL-UNNAMED", "-cp", `${jar}:${root}`, "Consumer"];
		}
		else
		{
			await runChar(environment.LEAN_BRIDGE_KOTLINC, ["-Werror", "-jvm-target", "22", "-cp", jar, "consumer.kt", "-include-runtime", "-d", "consumer.jar"], root, { ...environment, JAVA_HOME: dirname(dirname(command)) });
			args = ["--enable-native-access=ALL-UNNAMED", "-cp", `${jar}:${join(root, "consumer.jar")}`, "ConsumerKt"];
		}
	}
	else if(profile === "rust")
	{
		await runChar("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", archive], root);
		const dependencyArchive = join(consumer, "dependencies", dependencies.archive);
		assert.equal(sha256(await readFile(dependencyArchive)), dependencies.sha256);
		await runChar("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", dependencyArchive], root);
		await saveLakeFile(root, ".cargo/config.toml", '[source.crates-io]\nreplace-with = "prepared"\n[source.prepared]\ndirectory = "dependencies"\n');
		await saveLakeFile(root, "Cargo.toml", `[package]\nname="consumer"\nversion="0.0.0"\nedition="2021"\n[dependencies]\n${pkg.name}={path="${pkg.name}-${pkg.version}"}\n[[bin]]\nname="consumer"\npath="consumer.rs"\n[profile.dev]\ndebug=0\nincremental=false\n`);
		await runChar(environment.LEAN_BRIDGE_CARGO, ["build", "--offline", "--bin", "consumer"], root
			, { ...env, PATH: "/usr/bin:/bin", RUSTC: environment.LEAN_BRIDGE_RUSTC, CARGO_HOME: join(root, "cargo-home"), CARGO_NET_OFFLINE: "true" });
		command = join(root, "target/debug/consumer"); args = [];
	}
	else throw new Error(`Char consumer not implemented: ${profile}`);
	const result = await runChar(command, args, root, env);
	assert.equal(result.stderr, "");
	assert.match(result.stdout.trim(), /^char-ok:[0-9]+$/);
	const checks = Number(result.stdout.trim().split(":")[1]); assert.ok(checks >= 100);
	return { checks, consumerSha256: sha256(source), command, offlineInstall: true, compilerFreePath: true };
};
