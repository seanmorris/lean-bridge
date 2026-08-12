#!/usr/bin/env node

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { generatePhpNativeRuntimePackage } from "../src/backends/php/native-runtime.mjs";
import { generatePhpWasmAdapterPackage } from "../src/backends/php/php-wasm.mjs";
import {
  createPhpWasmReleaseManifest,
  generatePhpWasmReleaseSources,
  readPhpWasmPackageInputs,
} from "../src/backends/php/php-wasm-package.mjs";

const execute = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultManifest = "poc/lean-link-spike/bindings/php-wasm.package.json";
const defaultEmsdk = join(projectRoot, ".toolchains/emsdk-php-wasm");

const usage = () => {
  process.stderr.write("Usage: build-php-wasm-package.mjs --output PATH --php-source PATH [--manifest PATH] [--emsdk PATH]\n");
};

const parseArguments = argv => {
  const result = { manifest: defaultManifest, output: null, phpSource: null, emsdk: defaultEmsdk };
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!value || !new Set(["--manifest", "--output", "--php-source", "--emsdk"]).has(flag)) {
      usage();
      process.exitCode = 2;
      return null;
    }
    result[flag === "--php-source" ? "phpSource" : flag.slice(2)] = value;
  }
  if (!result.output || !result.phpSource) {
    usage();
    process.exitCode = 2;
    return null;
  }
  return result;
};

const run = async (command, args, options = {}) => {
  try {
    return await execute(command, args, { maxBuffer: 64 * 1024 * 1024, ...options });
  } catch (error) {
    const stdout = error.stdout ? `\nstdout:\n${error.stdout}` : "";
    const stderr = error.stderr ? `\nstderr:\n${error.stderr}` : "";
    throw new Error(`${command} failed${stdout}${stderr}`, { cause: error });
  }
};

const sha256 = source => createHash("sha256").update(source).digest("hex");

const writeFiles = async (directory, files) => {
  for (const [path, source] of Object.entries(files)) {
    const destination = join(directory, path);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, source);
  }
};

const collectFiles = async directory => {
  const result = {};
  const visit = async current => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const absolute = join(current, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      if (entry.isFile()) result[relative(directory, absolute)] = await readFile(absolute);
    }
  };
  await visit(directory);
  return result;
};

const normalizeTimes = async (directory, epoch) => {
  const timestamp = new Date(epoch * 1000);
  const visit = async current => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const absolute = join(current, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      if (entry.isFile()) await utimes(absolute, timestamp, timestamp);
    }
    await utimes(current, timestamp, timestamp);
  };
  await visit(directory);
};

const assertSharedSideModule = async (path, label) => {
  const module = await WebAssembly.compile(await readFile(path));
  const imports = WebAssembly.Module.imports(module);
  const exports = WebAssembly.Module.exports(module);
  const memories = imports.filter(entry => entry.kind === "memory");
  const tables = imports.filter(entry => entry.kind === "table");
  if (
    memories.length !== 1 || memories[0].module !== "env" || memories[0].name !== "memory" ||
    tables.length !== 1 || tables[0].module !== "env" || tables[0].name !== "__indirect_function_table" ||
    exports.some(entry => entry.kind === "memory" || entry.kind === "table")
  ) {
    throw new Error(`${label} must import PHP-Wasm memory and table without defining another pair`);
  }
};

const readToolchain = async ({ inputs, emsdkPath }) => {
  const root = resolve(emsdkPath);
  const emscriptenRoot = join(root, "upstream/emscripten");
  const emcc = join(emscriptenRoot, "emcc");
  const emxx = join(emscriptenRoot, "em++");
  const expected = inputs.manifest.phpWasm.emscripten;
  const [{ stdout: sdkCommit }, { stdout: version }] = await Promise.all([
    run("git", ["-C", root, "rev-parse", "HEAD"]),
    run(emcc, ["--version"]),
  ]);
  if (sdkCommit.trim() !== expected.emsdkCommit) {
    throw new Error(`PHP-Wasm Emscripten SDK commit must be ${expected.emsdkCommit}`);
  }
  const firstLine = version.split("\n")[0];
  if (!firstLine.includes(` ${expected.version} (${expected.sourceCommit})`)) {
    throw new Error(`PHP-Wasm Emscripten compiler must be ${expected.version} at ${expected.sourceCommit}`);
  }
  return Object.freeze({ root, emcc, emxx, firstLine, sdkCommit: sdkCommit.trim() });
};

const buildLayout = inputs => {
  const variant = inputs.manifest.phpWasm.emscripten.runtimeVariant;
  const profileRoot = `build/lean-link-spike-${variant}`;
  const profile = inputs.manifest.graphLock.profile === "side-startup" ? "startup" : "lazy";
  const runtime = inputs.graph.libraries[0].capsule.runtime;
  const runtimeRoot = join(
    projectRoot,
    "build/lean-runtime",
    `${runtime.leanCommit}-${runtime.patchSetSha256}-browser-${variant}`,
  );
  return {
    profileDirectory: join(projectRoot, profileRoot, profile),
    runtimeRoot,
  };
};

const buildRuntime = async ({ inputs, scratch, layout, environment, toolchain }) => {
  const adapter = provisionalAdapter(inputs);
  const generated = {
    ...generatePhpNativeRuntimePackage(inputs.bindingIr),
    "src/lean_bridge_php_wasm_libuv.c": adapter["src/lean_bridge_php_wasm_libuv.c"],
  };
  const sourceRoot = join(scratch, "runtime-source");
  await writeFiles(sourceRoot, generated);
  const object = join(scratch, "lean_bridge_runtime.o");
  const libuvObject = join(scratch, "lean_bridge_php_wasm_libuv.o");
  const output = join(scratch, "liblean_bridge_runtime.so");
  const includes = [
    join(sourceRoot, "include"),
    join(layout.runtimeRoot, "cmake/include"),
    join(layout.runtimeRoot, "source/src/include"),
    join(layout.runtimeRoot, "cmake/libuv/src/libuv/include"),
  ];
  await run(toolchain.emcc, [
    "-O2", "-g0", "-fPIC",
    ...includes.flatMap(path => ["-I", path]),
    "-c", join(sourceRoot, "src/lean_bridge_native_runtime.c"),
    "-o", object,
  ], { env: environment });
  await run(toolchain.emcc, [
    "-O2", "-g0", "-fPIC",
    ...includes.flatMap(path => ["-I", path]),
    "-c", join(sourceRoot, "src/lean_bridge_php_wasm_libuv.c"),
    "-o", libuvObject,
  ], { env: environment });
  await run(toolchain.emxx, [
    object,
    libuvObject,
    "-Wl,--start-group",
    join(layout.runtimeRoot, "cmake/lib/lean/libInit.a"),
    join(layout.runtimeRoot, "cmake/lib/lean/libleanrt.a"),
    "-lc++",
    "-lc++abi",
    "-Wl,--end-group",
    "-O2", "-g0", "-fPIC", "-sSIDE_MODULE=1", "-Wl,--no-entry",
    "-o", output,
  ], { env: environment });
  await assertSharedSideModule(output, "shared Lean runtime");
  return output;
};

const provisionalAdapter = inputs => {
  const emptyHash = "0".repeat(64);
  return generatePhpWasmAdapterPackage({
    ir: inputs.bindingIr,
    graph: inputs.graph,
    target: inputs.manifest.graphLock.target,
    runtime: {
      name: basename(inputs.manifest.artifacts.runtimeLibrary),
      file: inputs.manifest.artifacts.runtimeLibrary,
      sha256: emptyHash,
    },
    extensions: Object.fromEntries(inputs.manifest.phpWasm.phpVersions.map(version => [version, {
      name: basename(inputs.manifest.artifacts.extensionPattern.replace("{version}", version)),
      file: inputs.manifest.artifacts.extensionPattern.replace("{version}", version),
      sha256: emptyHash,
    }])),
  });
};

const buildExtension = async ({ inputs, version, phpSource, scratch, layout, runtimePath, environment, toolchain }) => {
  const adapter = provisionalAdapter(inputs);
  const sourceRoot = join(scratch, `extension-${version}`);
  const extensionFiles = Object.fromEntries(
    Object.entries(adapter)
      .filter(([path]) => path.startsWith("extension/"))
      .map(([path, source]) => [path.slice("extension/".length), source]),
  );
  await writeFiles(sourceRoot, extensionFiles);
  await writeFile(join(sourceRoot, "lean_bridge_php_wasm_host.h"), adapter["include/lean_bridge_php_wasm_host.h"]);
  await writeFile(join(sourceRoot, "lean_bridge_php_wasm_host.c"), adapter["src/lean_bridge_php_wasm_host.c"]);
  const output = join(scratch, `php${version}-lean-alpha.so`);
  const phpIncludes = [phpSource, join(phpSource, "Zend"), join(phpSource, "main"), join(phpSource, "TSRM"), join(phpSource, "ext")];
  const bridgeIncludes = [
    sourceRoot,
    join(sourceRoot, "include"),
    join(sourceRoot, "internal"),
    join(layout.runtimeRoot, "cmake/include"),
    join(layout.runtimeRoot, "source/src/include"),
    join(scratch, "runtime-source/include"),
  ];
  const componentPaths = inputs.graph.libraries
    .filter(library => (
      inputs.manifest.graphLock.profile === "side-startup" ||
      library.id === inputs.bindingIr.component.id
    ))
    .map(library => {
      const artifact = library.capsule.artifacts.targets
        .find(target => target.target === inputs.manifest.graphLock.target).sideModule;
      return join(layout.profileDirectory, artifact.file);
    });
  const asyncify = inputs.manifest.graphLock.profile === "side-lazy" ? ["-sASYNCIFY=1"] : [];
  await run(toolchain.emcc, [
    "-shared", "-O2", "-g0", "-fPIC", "-flto", "-fvisibility=hidden", "-sSIDE_MODULE=1", ...asyncify,
    "-DCOMPILE_DL_LEAN_ALPHA=1",
    ...phpIncludes.flatMap(path => ["-I", path]),
    ...bridgeIncludes.flatMap(path => ["-I", path]),
    join(sourceRoot, "lean_alpha_zend.c"),
    join(sourceRoot, "src/lean_alpha.c"),
    join(sourceRoot, "src/lean_alpha_native.c"),
    join(sourceRoot, "lean_bridge_php_wasm_host.c"),
    runtimePath,
    ...componentPaths,
    "-o", output,
  ], { env: environment });
  await assertSharedSideModule(output, `PHP ${version} extension`);
  return output;
};

const build = async ({ manifest: manifestPath, output: outputPath, phpSource: phpSourcePath, emsdk: emsdkPath }) => {
  const output = resolve(process.cwd(), outputPath);
  const phpSource = resolve(process.cwd(), phpSourcePath);
  if (output === projectRoot || output === dirname(projectRoot)) {
    throw new Error("refusing to use the project or its parent as a package output");
  }
  await mkdir(output, { recursive: true });
  if ((await readdir(output)).length !== 0) throw new Error(`package output is not empty: ${output}`);
  const inputs = await readPhpWasmPackageInputs({ projectRoot, manifestPath });
  const toolchain = await readToolchain({ inputs, emsdkPath });
  const targetEnvironment = {
    ...process.env,
    LEAN_WASM_EMSDK: toolchain.root,
    LEAN_WASM_RUNTIME_VARIANT: inputs.manifest.phpWasm.emscripten.runtimeVariant,
    LEAN_WASM_ARTIFACT_TARGET: inputs.manifest.graphLock.target,
  };
  await run("bash", [join(projectRoot, "scripts/build-lean-link-spike.sh")], {
    cwd: projectRoot,
    env: targetEnvironment,
  });
  const layout = buildLayout(inputs);
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-package-"));
  const environment = {
    ...targetEnvironment,
    SOURCE_DATE_EPOCH: String(inputs.manifest.sourceDateEpoch),
    ZERO_AR_DATE: "1",
  };
  try {
    const runtimePath = await buildRuntime({ inputs, scratch, layout, environment, toolchain });
    const runtimeBytes = await readFile(runtimePath);
    const extensions = {};
    const extensionPaths = {};
    for (const version of inputs.manifest.phpWasm.phpVersions) {
      const path = await buildExtension({
        inputs,
        version,
        phpSource,
        scratch,
        layout,
        runtimePath,
        environment,
        toolchain,
      });
      extensionPaths[version] = path;
      extensions[version] = {
        name: basename(path),
        file: inputs.manifest.artifacts.extensionPattern.replace("{version}", version),
        sha256: sha256(await readFile(path)),
      };
    }
    const runtime = {
      name: basename(inputs.manifest.artifacts.runtimeLibrary),
      file: inputs.manifest.artifacts.runtimeLibrary,
      sha256: sha256(runtimeBytes),
    };
    const generated = generatePhpWasmReleaseSources({ inputs, runtime, extensions });
    await writeFiles(output, generated);
    const runtimeDestination = join(output, inputs.manifest.artifacts.runtimeLibrary);
    await mkdir(dirname(runtimeDestination), { recursive: true });
    await copyFile(runtimePath, runtimeDestination);
    for (const library of inputs.graph.libraries) {
      const artifact = library.capsule.artifacts.targets
        .find(target => target.target === inputs.manifest.graphLock.target).sideModule;
      const source = join(layout.profileDirectory, artifact.file);
      const bytes = await readFile(source);
      if (sha256(bytes) !== artifact.sha256) throw new Error(`locked artifact hash changed for ${library.id}`);
      const destination = join(output, inputs.manifest.artifacts.componentDirectory, artifact.file);
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(source, destination);
      await assertSharedSideModule(destination, library.id);
    }
    for (const [version, source] of Object.entries(extensionPaths)) {
      const destination = join(output, inputs.manifest.artifacts.extensionPattern.replace("{version}", version));
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(source, destination);
    }

    const payload = await collectFiles(output);
    const release = createPhpWasmReleaseManifest({
      inputs,
      artifacts: payload,
      observedToolchain: {
        emscripten: toolchain.firstLine,
        emsdkCommit: toolchain.sdkCommit,
        emscriptenSourceCommit: inputs.manifest.phpWasm.emscripten.sourceCommit,
        phpSource: basename(phpSource),
        node: process.version,
      },
    });
    const metadata = join(output, inputs.manifest.artifacts.metadata);
    await writeFile(join(metadata, "release-manifest.json"), `${JSON.stringify(release, null, 2)}\n`);
    const complete = await collectFiles(output);
    const hashes = Object.entries(complete)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([path, value]) => `${sha256(value)}  ${path}`)
      .join("\n");
    await writeFile(join(metadata, "sha256.txt"), `${hashes}\n`);
    await normalizeTimes(output, inputs.manifest.sourceDateEpoch);
    process.stdout.write(`${JSON.stringify({
      packageId: inputs.manifest.packageId,
      output,
      artifacts: release.artifacts,
    }, null, 2)}\n`);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
};

const args = parseArguments(process.argv.slice(2));
if (args) await build(args);
