/**
 * Source contracts for the additive native Fin zero-bound and nested-position supplement.
 * No source-only check below claims installed acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rename, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { generateGmpProjection } from "../src/backends/c/gmp-projection.mjs";
import { generateCBindingPackage } from "../src/backends/c/generate.mjs";
import { compilePrimitiveCppModel, renderPrimitiveCppPackage } from "../src/backends/cpp/primitives.mjs";
import { boostSources } from "../src/backends/cpp/boost.mjs";
import { generateRustBindingPackage } from "../src/backends/rust/generate.mjs";
import { compileCopiedDotnetModel } from "../src/backends/dotnet/copied-model.mjs";
import { renderCopiedDotnetPackage } from "../src/backends/dotnet/copied-values.mjs";
import { compileCopiedJvmModel } from "../src/backends/jvm/copied-model.mjs";
import { renderCopiedJvmPackage } from "../src/backends/jvm/copied-values.mjs";
import { compileCopiedWitModel } from "../src/backends/wit/copied-model.mjs";
import { renderWitHostHeader } from "../src/backends/wit/copied-host.mjs";
import { copiedCleanEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { finContainerEdgeConsumer, finContainerEdgeProfiles, finContainerEdgeRefinements, finContainerEdgeReviewedIr, finContainerEdgeSource, implementedFinContainerEdgeProfiles, insertFinContainerEdgeFragment } from "./helpers/fin-container-edges.mjs";
import { finContainerRefinements } from "./helpers/fin-container-install.mjs";
import { checkInstalledFinContainerEdges, finContainerEdgeChecks, finContainerEdgeDispatchEnabled, finContainerEdgeGemReceipt, finContainerEdgeSelection, prepareFinContainerEdgeExecutable, requireNewFinContainerEdgeReport, writeFinContainerEdgeReport } from "./helpers/fin-container-edge-install.mjs";
import { finContainerReviewedIr } from "./helpers/reviewed-fin-container-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("the edge fixture preserves the eight original exports and adds four explicit round trips", async () => {
	const original = await readFile("tests/fixtures/onboarding/native-fin-containers/FinContainers.lean", "utf8");
	const supplement = await readFile("tests/fixtures/fin-container-edges.lean", "utf8");
	const combined = await finContainerEdgeSource();
	assert.equal(combined, original + "\n" + supplement);
	assert.equal((combined.match(/^def /gmu) ?? []).length, 12);
	for(const signature of ["emptyArray (values : Array (Fin 0)) : Array (Fin 0)"
		, "emptyList (values : List (Fin 0)) : List (Fin 0)"
		, "emptyOption (value : Option (Fin 0)) : Option (Fin 0)"
		, "optionalDigits (values : Option (List Digit)) : Option (List Digit)"])
		assert.ok(supplement.includes(`def ${signature} :=`), signature);
	assert.doesNotMatch(combined, /\b(sorry|axiom|unsafe)\b/u);
});

test("the edge refinement contract keeps the original trees and checks both sides of every addition", () => {
	for(const [name, tree] of Object.entries(finContainerRefinements)) assert.deepEqual(finContainerEdgeRefinements[name], tree);
	const extra = Object.entries(finContainerEdgeRefinements).filter(([name]) => !Object.hasOwn(finContainerRefinements, name));
	assert.equal(extra.length, 4);
	for(const [name, tree] of extra)
	{
		assert.deepEqual(tree.parameters, [tree.result], name);
		assert.equal(tree.result.kind, { emptyArray: "array", emptyList: "list", emptyOption: "option", optionalDigits: "option" }[name.split(".").at(-1)]);
		const leaf = name.endsWith("optionalDigits") ? tree.result.arguments[0].arguments[0] : tree.result.arguments[0];
		assert.deepEqual(leaf, { kind: "fin", bound: name.endsWith("optionalDigits") ? "10" : "0" });
	}
	const before = finContainerReviewedIr(), after = finContainerEdgeReviewedIr();
	assert.deepEqual(after.types, before.types);
	for(const entry of before.declarations) assert.deepEqual(after.declarations.find(item => item.id === entry.id), entry);
	assert.equal(after.declarations.length, before.declarations.length + 4);
	for(const entry of after.declarations.filter(item => !before.declarations.some(prior => prior.id === item.id)))
	{
		assert.deepEqual(entry.source.extensions["lean-lang.org/refinements"], finContainerEdgeRefinements[entry.source.declaration]);
		assert.deepEqual(entry.parameters.map(parameter => parameter.type), [entry.result.type]);
	}
});

test("edge insertion refuses missing, empty, repeated and fragment-supplied markers", () => {
	assert.equal(insertFinContainerEdgeFragment("before\nprint\nafter", "print", "extra"), "before\nextra\nprint\nafter");
	for(const [source, marker, fragment] of [["none", "print", "extra"], ["print print", "print", "extra"], ["print", "", "extra"], ["print", "print", "print"]])
		assert.throws(() => insertFinContainerEdgeFragment(source, marker, fragment));
	for(const source of ["prefix print\n", "print suffix\n", "footprint\n"])
		assert.throws(() => insertFinContainerEdgeFragment(source, "print", "extra"), /complete line/u);
	assert.equal(insertFinContainerEdgeFragment("print", "print", "$& $` $'"), "$& $` $'\nprint");
});

test("the development slice does not erase the remaining native hosts or replace old consumers", async () => {
	assert.deepEqual(finContainerEdgeProfiles, ["c", "cpp", "python", "rust", "ruby", "dotnet", "java", "kotlin", "php-native", "wit-wasi"]);
	assert.deepEqual(implementedFinContainerEdgeProfiles, finContainerEdgeProfiles);
	for(const profile of implementedFinContainerEdgeProfiles)
	{
		const extension = { c: "c", cpp: "cpp", python: "py", rust: "rs", ruby: "rb", dotnet: "cs", java: "java", kotlin: "kt", "php-native": "php", "wit-wasi": "c" }[profile];
		const base = await readFile(`tests/fixtures/fin-container-consumers/${profile}.${extension}`, "utf8");
		const fragment = await readFile(`tests/fixtures/fin-container-edge-consumers/${profile}.${extension}`, "utf8");
		const combined = await finContainerEdgeConsumer(profile);
		assert.equal(combined.split(fragment).length, 2);
		let restored = combined.replace(fragment + "\n", "");
		if(profile === "wit-wasi")
		{
			const helpers = await readFile("tests/fixtures/fin-container-edge-consumers/wit-wasi-helpers.c", "utf8");
			assert.equal(restored.split(helpers).length, 2);
			restored = restored.replace(helpers + "\n", "");
			assert.ok(combined.indexOf(fragment) < combined.indexOf("  fincontainers_wasmtime_close(session);"));
		}
		assert.equal(restored, base);
		for(const method of ["emptyarray", "emptylist", "emptyoption", "optionaldigits", "present", "flatten"])
			assert.ok(fragment.replace(/[_-]/gu, "").toLowerCase().includes(method), `${profile}: ${method}`);
		assert.match(fragment, /1000/u);
	}
	await assert.rejects(finContainerEdgeConsumer("perl"), /not implemented/u);
	await assert.rejects(finContainerEdgeConsumer("php-wasm"), /not implemented/u);
});

test("structural and negative-Nat controls require their own positive diagnostic, not any bound error", async () => {
	const c = await readFile("tests/fixtures/fin-container-edge-consumers/c.c", "utf8");
	assert.ok(c.includes("edge_error = (fincontainers_error){0}, rejected((call), &edge_error, edge_structural_error)"));
	assert.equal((c.match(/CHECK\(EDGE_STRUCTURAL_REFUSED\(/gu) ?? []).length, 6);
	assert.doesNotMatch(c, /!rejected\(/u);
	const diagnostic = "Invalid copied value, negative Nat or 16 MiB call limit exceeded";
	assert.ok(c.includes(diagnostic));
	assert.ok(Object.values(generateGmpProjection(finContainerEdgeReviewedIr()).files).some(source => source.includes(diagnostic)));
	const cpp = await readFile("tests/fixtures/fin-container-edge-consumers/cpp.cpp", "utf8");
	assert.ok(cpp.includes('std::string(failure.what()) == "Nat must be nonnegative"'));
	assert.ok(cpp.includes("failure.code == FINCONTAINERS_ERROR_INVALID_ARGUMENT"));
	assert.doesNotMatch(cpp, /CHECK\(invalid\(/u);
	const ruby = await readFile("tests/fixtures/fin-container-edge-consumers/ruby.rb", "utf8");
	assert.ok(ruby.includes('error.class == RangeError && error.message == "Nat cannot be negative"'));
	assert.ok(ruby.includes("check(edge_negative.call { API.optional_digits(Some.new(values)) }"));
});

const sourceChecks = process.env.LEAN_BRIDGE_FIN_CONTAINER_EDGE_SOURCE_TEST === "1";
test("fresh Lean elaborates all twelve composed Fin container declarations", { skip: !sourceChecks }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-edge-source-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	await saveLakeFile(root, "FinContainers.lean", await finContainerEdgeSource());
	const lean = resolve(process.env.LEAN_BRIDGE_LEAN ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2/bin/lean");
	const result = await runCopied(lean, ["FinContainers.lean"], root, { ...copiedCleanEnvironment, LEAN_NUM_THREADS: "1" });
	assert.equal(result.stdout, ""); assert.equal(result.stderr, "");
});

test("the complete C edge consumer compiles against generated GMP headers with strict warnings", { skip: !sourceChecks }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-edge-header-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const projected = generateGmpProjection(finContainerEdgeReviewedIr());
	for(const [path, source] of Object.entries(projected.files)) await saveLakeFile(root, path, source);
	await saveLakeFile(root, "consumer.c", await finContainerEdgeConsumer("c"));
	const result = await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-fsyntax-only", "-Iinclude", "consumer.c"], root);
	assert.equal(result.stdout, ""); assert.equal(result.stderr, "");
});

test("the complete Python edge consumer parses without executing a mock algorithm", { skip: !sourceChecks }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-edge-python-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	await saveLakeFile(root, "consumer.py", await finContainerEdgeConsumer("python"));
	const result = await runCopied(process.env.LEAN_BRIDGE_PYTHON ?? "/usr/bin/python3", ["-I", "-c", "import ast; ast.parse(open('consumer.py').read())"], root);
	assert.equal(result.stdout, ""); assert.equal(result.stderr, "");
});

test("the complete C++ edge consumer compiles against generated public types with strict warnings", { skip: !sourceChecks }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-edge-cpp-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = finContainerEdgeReviewedIr();
	const sources = { ...generateCBindingPackage(ir), ...renderPrimitiveCppPackage(compilePrimitiveCppModel(ir)), ...boostSources() };
	for(const [path, source] of Object.entries(sources)) await saveLakeFile(root, path, source);
	await saveLakeFile(root, "consumer.cpp", await finContainerEdgeConsumer("cpp"));
	const result = await runCopied("/usr/bin/c++", ["-std=c++20", "-Wall", "-Wextra", "-Werror", "-fsyntax-only", "-Iinclude", "consumer.cpp"], root);
	assert.equal(result.stdout, ""); assert.equal(result.stderr, "");
});

test("the complete Ruby edge consumer parses without executing a mock algorithm", { skip: !sourceChecks }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-edge-ruby-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	await saveLakeFile(root, "consumer.rb", await finContainerEdgeConsumer("ruby"));
	const ruby = resolve(process.env.LEAN_BRIDGE_RUBY ?? ".toolchains/ruby33/bin/ruby");
	const result = await runCopied(ruby, ["-c", "consumer.rb"], root);
	assert.equal(result.stdout, "Syntax OK\n"); assert.equal(result.stderr, "");
});

test("the complete PHP edge consumer parses in both weak and strict modes", { skip: !sourceChecks }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-edge-php-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const source = await finContainerEdgeConsumer("php-native");
	assert.equal(source.split("declare(strict_types=0);").length, 2);
	for(const mode of [0, 1])
	{
		const path = `consumer-${mode}.php`;
		await saveLakeFile(root, path, source.replace("declare(strict_types=0);", `declare(strict_types=${mode});`));
		const result = await runCopied(process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php", ["-n", "-l", path], root);
		assert.equal(result.stdout, `No syntax errors detected in ${path}\n`); assert.equal(result.stderr, "");
	}
});

test("the complete WIT edge consumer compiles against the generated public Wasmtime header", { skip: !sourceChecks }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-edge-wit-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const model = compileCopiedWitModel(finContainerEdgeReviewedIr());
	assert.equal(model.surface.prefix, "fincontainers");
	for(const name of ["empty-array", "empty-list", "empty-option", "optional-digits"])
		assert.ok(model.wit.includes(`${name}: func(`));
	await saveLakeFile(root, "fincontainers_wasmtime.h", renderWitHostHeader(model));
	await saveLakeFile(root, "consumer.c", await finContainerEdgeConsumer("wit-wasi"));
	const wasmtime = resolve(process.env.LEAN_BRIDGE_WASMTIME_C_API ?? ".toolchains/wasmtime42");
	const result = await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-fsyntax-only", "-I.", `-I${join(wasmtime, "include")}`, "consumer.c"], root);
	assert.equal(result.stdout, ""); assert.equal(result.stderr, "");
});

test("the complete Rust edge consumer typechecks offline against generated public types", { skip: !sourceChecks }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-edge-rust-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const files = generateRustBindingPackage(finContainerEdgeReviewedIr());
	for(const [path, source] of Object.entries(files)) await saveLakeFile(join(root, "package"), path, source);
	const name = /^name = "([^"]+)"$/mu.exec(files["Cargo.toml"])[1];
	await saveLakeFile(root, "Cargo.toml", `[package]\nname="fin-edge-source-check"\nversion="0.0.0"\nedition="2021"\n[dependencies]\nfincontainers={package="${name}",path="package"}\n`);
	await saveLakeFile(root, "src/main.rs", await finContainerEdgeConsumer("rust"));
	const cargo = resolve(process.env.LEAN_BRIDGE_CARGO ?? ".toolchains/rust-1.90.0/bin/cargo");
	const rustc = resolve(process.env.LEAN_BRIDGE_RUSTC ?? ".toolchains/rust-1.90.0/bin/rustc");
	const result = await runCopied(cargo, ["check", "--offline", "--quiet"], root, { ...process.env, RUSTC: rustc, RUSTFLAGS: "-D warnings", CARGO_NET_OFFLINE: "true", CARGO_TARGET_DIR: join(root, "target") });
	assert.equal(result.stdout, ""); assert.equal(result.stderr, "");
});

test("the complete .NET edge consumer compiles against generated public types with strict warnings", { skip: !sourceChecks }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-edge-dotnet-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const files = renderCopiedDotnetPackage(compileCopiedDotnetModel(finContainerEdgeReviewedIr()));
	for(const [path, source] of Object.entries(files).filter(([path]) => path.endsWith(".cs")))
		await saveLakeFile(join(root, "generated"), path, source);
	await saveLakeFile(root, "consumer.cs", await finContainerEdgeConsumer("dotnet"));
	await saveLakeFile(root, "Consumer.csproj", '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><AllowUnsafeBlocks>true</AllowUnsafeBlocks><TreatWarningsAsErrors>true</TreatWarningsAsErrors><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit></PropertyGroup></Project>');
	await saveLakeFile(root, "NuGet.Config", '<configuration><packageSources><clear/></packageSources><fallbackPackageFolders><clear/></fallbackPackageFolders></configuration>');
	const dotnet = resolve(process.env.LEAN_BRIDGE_DOTNET ?? ".toolchains/dotnet/dotnet");
	const env = { ...copiedCleanEnvironment, DOTNET_ROOT: dirname(dotnet), DOTNET_CLI_HOME: join(root, "dotnet-home"), DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1", NUGET_PACKAGES: join(root, "packages") };
	await runCopied(dotnet, ["restore", "--configfile", "NuGet.Config"], root, env);
	const result = await runCopied(dotnet, ["build", "--no-restore", "--disable-build-servers", "-p:UseSharedCompilation=false"], root, env);
	assert.match(result.stdout, /Build succeeded\./u); assert.equal(result.stderr, "");
});

test("the complete Java and Kotlin edge consumers compile against generated public types", { skip: !sourceChecks }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-edge-jvm-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const files = renderCopiedJvmPackage(compileCopiedJvmModel(finContainerEdgeReviewedIr()));
	const sources = Object.entries(files).filter(([path]) => path.endsWith(".java"));
	for(const [path, source] of sources) await saveLakeFile(join(root, "generated"), path, source);
	await saveLakeFile(root, "consumer.java", await finContainerEdgeConsumer("java"));
	await saveLakeFile(root, "consumer.kt", await finContainerEdgeConsumer("kotlin"));
	const javac = resolve(process.env.LEAN_BRIDGE_JAVAC ?? ".toolchains/jdk22/bin/javac");
	const java = resolve(process.env.LEAN_BRIDGE_JAVA ?? ".toolchains/jdk22/bin/java");
	const kotlinc = resolve(process.env.LEAN_BRIDGE_KOTLINC ?? ".toolchains/kotlin-2.2.0/kotlinc/bin/kotlinc");
	const classes = join(root, "classes");
	const compiled = await runCopied(javac, ["--release", "22", "-Werror", "-d", classes, ...sources.map(([path]) => join(root, "generated", path)), "consumer.java"], root);
	assert.equal(compiled.stdout, ""); assert.equal(compiled.stderr, "");
	const kotlin = await runCopied(kotlinc, ["-Werror", "-jvm-target", "22", "-cp", classes, "consumer.kt", "-d", "consumer.jar"], root, { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin", JAVA_HOME: dirname(dirname(java)) });
	assert.equal(kotlin.stdout, ""); assert.equal(kotlin.stderr, "");
});

test("installed edge selection is explicit and checks every assertion, including the old consumer", () => {
	assert.deepEqual(finContainerEdgeSelection(undefined), []);
	assert.deepEqual(finContainerEdgeSelection("python,cpp,c"), ["c", "cpp", "python"]);
	assert.deepEqual(finContainerEdgeSelection("rust,ruby"), ["ruby", "rust"]);
	assert.deepEqual(finContainerEdgeSelection("kotlin,dotnet,java"), ["dotnet", "java", "kotlin"]);
	assert.deepEqual(finContainerEdgeSelection("php-native"), ["php-native"]);
	assert.deepEqual(finContainerEdgeSelection("wit-wasi"), ["wit-wasi"]);
	for(const value of ["", "c,c", "c,", "c,perl", "php-wasm", " c", 0, null]) assert.throws(() => finContainerEdgeSelection(value));
	assert.deepEqual(finContainerEdgeChecks, { c: 14114, cpp: 14099, python: 14095, rust: 14078, ruby: 14094, dotnet: 14089, java: 14089, kotlin: 14088, "php-native": 14089, "wit-wasi": 14066 });
});

test("Ruby receipt extraction reads original nested gem bytes and refuses missing or repeated members", { skip: !sourceChecks }, async t => {
	// Format-only controls use no Lean API and do not constitute installed acceptance.
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-edge-gem-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ruby = resolve(process.env.LEAN_BRIDGE_RUBY ?? ".toolchains/ruby33/bin/ruby");
	await saveLakeFile(root, "make.rb", `require "rubygems"
require "rubygems/package"
require "zlib"
require "stringio"
def tar(entries)
  stream = StringIO.new
  Gem::Package::TarWriter.new(stream) do |writer|
    entries.each { |name, bytes| writer.add_file_simple(name, 0644, bytes.bytesize) { |entry| entry.write(bytes) } }
  end
  stream.string
end
def gzip(bytes)
  stream = StringIO.new
  Zlib::GzipWriter.wrap(stream) { |writer| writer.write(bytes) }
  stream.string
end
receipt = ['lean-bridge/package-receipt.json', "{\\"checked\\":true}\\n"]
valid = ['data.tar.gz', gzip(tar([receipt]))]
File.binwrite('valid.gem', tar([valid]))
File.binwrite('no-data.gem', tar([]))
File.binwrite('two-data.gem', tar([valid, valid]))
File.binwrite('no-receipt.gem', tar([['data.tar.gz', gzip(tar([]))]]))
File.binwrite('two-receipts.gem', tar([['data.tar.gz', gzip(tar([receipt, receipt]))]]))
`);
	await runCopied(ruby, ["--disable-gems", "make.rb"], root);
	const read = name => runCopied(ruby, ["--disable-gems", "-e", finContainerEdgeGemReceipt, join(root, name)], root);
	const valid = await read("valid.gem");
	assert.equal(valid.stdout, '{"checked":true}\n'); assert.equal(valid.stderr, "");
	for(const name of ["no-data.gem", "two-data.gem", "no-receipt.gem", "two-receipts.gem"])
		await assert.rejects(read(name), error => {
			assert.equal(error.code, "build-command-failed");
			assert.match(error.details.stderr, /Expected one gem (?:data member|receipt)/u);
			assert.equal(error.details.stdout, "");
			return true;
		});
});

test("edge C/C++ linkage survives a real directory move without an absolute runtime path", { skip: !sourceChecks }, async t => {
	// A tiny independent shared library checks only the loader mechanism. It is not Lean acceptance.
	const parent = await mkdtemp(join(tmpdir(), "lean-bridge-fin-edge-linkage-"));
	t.after(() => rm(parent, { recursive: true, force: true }));
	for(const profile of ["c", "cpp", "wit-wasi"])
	{
		const root = join(parent, profile), directory = `linkage-1.0.0-${profile}`;
		await mkdir(join(root, "tools"), { recursive: true });
		for(const name of ["as", "ld"]) await symlink(`/usr/bin/${name}`, join(root, "tools", name));
		await saveLakeFile(root, "library.c", "int edge_linkage(void) { return 42; }\n");
		await saveLakeFile(root, `${directory}/lib/pkgconfig/edge-linkage.pc`, `prefix=\${pcfiledir}/../..\nlibdir=\${prefix}/lib\nName: edge-linkage\nDescription: Loader-only control\nVersion: 1.0.0\nLibs: -L\${libdir} -Wl,-rpath,\${libdir} -ledge-linkage\n`);
		await saveLakeFile(root, `consumer.${profile === "cpp" ? "cpp" : "c"}`, `#include <stdio.h>\n${profile === "cpp" ? 'extern "C" ' : ""}int edge_linkage(void);\nint main(void) { if(edge_linkage() != 42) return 1; puts("linkage-ok"); return 0; }\n`);
		await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-shared", "-fPIC", "library.c", "-o", `${directory}/lib/libedge-linkage.so`], root, { ...copiedCleanEnvironment, PATH: join(root, "tools") });
		const compile = { ...copiedCleanEnvironment, PATH: join(root, "tools"), PKG_CONFIG_LIBDIR: join(root, directory, "lib/pkgconfig"), PKG_CONFIG_PATH: "" };
		const absoluteFlags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", "edge-linkage"], root, compile)).stdout.trim().split(/\s+/u);
		await runCopied(profile === "cpp" ? "/usr/bin/c++" : "/usr/bin/cc", [`consumer.${profile === "cpp" ? "cpp" : "c"}`, ...absoluteFlags, "-o", "absolute-consumer"], root, compile);
		const absoluteBefore = await runCopied(join(root, "absolute-consumer"), [], root);
		assert.equal(absoluteBefore.stdout, "linkage-ok\n"); assert.equal(absoluteBefore.stderr, "");
		const executable = await prepareFinContainerEdgeExecutable({ profile, root, directory, pkgConfig: "edge-linkage" });
		assert.equal(executable.runtimeSearchPath, `$ORIGIN/${directory}/lib`);
		const before = await runCopied(join(root, "consumer"), [], root);
		assert.equal(before.stdout, "linkage-ok\n"); assert.equal(before.stderr, "");
		const moved = `${root}-relocated`;
		await rename(root, moved); await assert.rejects(access(root), { code: "ENOENT" });
		await assert.rejects(runCopied(join(moved, "absolute-consumer"), [], moved), error => {
			assert.equal(error.code, "build-command-failed");
			assert.match(error.message, /exited with status 127/u);
			assert.match(error.details.stderr, /libedge-linkage\.so: cannot open shared object file/u);
			assert.equal(error.details.stdout, "");
			return true;
		});
		const after = await runCopied(join(moved, "consumer"), [], moved);
		assert.equal(after.stdout, before.stdout); assert.equal(after.stderr, "");
		assert.equal(sha256(await readFile(join(moved, "consumer"))), executable.executableSha256);
	}
});

test("edge reports refuse old paths, existing bytes and dangling symlinks before any build", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-edge-report-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const path = join(root, "edges-c.json");
	await requireNewFinContainerEdgeReport(path);
	await writeFinContainerEdgeReport(path, { original: true });
	const original = await readFile(path);
	await assert.rejects(requireNewFinContainerEdgeReport(path), /already exists/u);
	await assert.rejects(writeFinContainerEdgeReport(path, { original: false }), /already exists/u);
	await assert.rejects(checkInstalledFinContainerEdges(t, ["c"], path), /already exists/u);
	assert.deepEqual(await readFile(path), original);
	await symlink(join(root, "missing"), join(root, "edges-python.json"));
	await assert.rejects(requireNewFinContainerEdgeReport(join(root, "edges-python.json")), /already exists/u);
	await assert.rejects(requireNewFinContainerEdgeReport(join(root, "c.json")), /edges-/u);
});

const profiles = finContainerEdgeSelection(process.env.LEAN_BRIDGE_FIN_CONTAINER_EDGE_PROFILES);
const measureDispatch = finContainerEdgeDispatchEnabled(process.env.LEAN_BRIDGE_FIN_CONTAINER_EDGE_DISPATCH, profiles);
test("edge dispatch opt-in rejects typoed flags and missing installed selections", () => {
	assert.equal(finContainerEdgeDispatchEnabled(undefined, []), false);
	assert.equal(finContainerEdgeDispatchEnabled(undefined, ["c"]), false);
	assert.equal(finContainerEdgeDispatchEnabled("1", ["c"]), true);
	assert.throws(() => finContainerEdgeDispatchEnabled("1", []));
	for(const flag of ["0", "", "true", "yes", " 1", "1 "])
		assert.throws(() => finContainerEdgeDispatchEnabled(flag, ["c"]));
});
test("installed source-free native packages execute zero-bound and nested-position Fin edge cases", { skip: !profiles.length, timeout: 2_400_000 }, async t => {
	const path = resolve(process.env.LEAN_BRIDGE_FIN_CONTAINER_EDGE_REPORT ?? `build/native-fin-container-edges/edges-${profiles.join("-")}.json`);
	const report = await checkInstalledFinContainerEdges(t, profiles, path, { measureDispatch });
	assert.deepEqual(report.profiles, profiles);
	assert.deepEqual(report.reports.map(item => item.profile), profiles);
	if(measureDispatch) assert.ok(report.reports.every(item => item.dispatch.rawAdapter?.runtimeDefinitionsChecked === true));
});
