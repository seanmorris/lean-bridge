#!/usr/bin/env node

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { generateCBindingPackage } from "../src/backends/c/generate.mjs";
import { generateNativeRuntimePackage } from "../src/backends/php/native-runtime.mjs";
import { readPhpNativePackageInputs } from "../src/backends/php/native-package.mjs";

const execute = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultManifest = "poc/lean-link-spike/bindings/php-native.package.json";
const sha256 = value => createHash("sha256").update(value).digest("hex");
const nixStoreMarker = Buffer.from("/nix/store/");

const usage = () => process.stderr.write("Usage: build-native-ffi-artifacts.mjs --output PATH [--manifest PATH]\n");

const parseArguments = argv => {
  const result = { manifest: defaultManifest, output: null };
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!value || !new Set(["--manifest", "--output"]).has(flag)) {
      usage();
      process.exitCode = 2;
      return null;
    }
    result[flag.slice(2)] = value;
  }
  if (!result.output) {
    usage();
    process.exitCode = 2;
    return null;
  }
  return result;
};

const run = async (command, args, options = {}) => {
  try {
    return await execute(command, args, { maxBuffer: 32 * 1024 * 1024, ...options });
  } catch (error) {
    const stdout = error.stdout ? `\nstdout:\n${error.stdout}` : "";
    const stderr = error.stderr ? `\nstderr:\n${error.stderr}` : "";
    throw new Error(`${command} failed${stdout}${stderr}`, { cause: error });
  }
};

const writeFiles = async (directory, files) => {
  for (const [path, value] of Object.entries(files)) {
    const destination = join(directory, path);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, value);
  }
};

const parseFacts = output => Object.fromEntries(output
  .split("\n")
  .map(line => line.match(/^([a-z_]+)=(.*)$/))
  .filter(Boolean)
  .map(match => [match[1], match[2]]));

const requireFacts = facts => {
  for (const field of ["native_runtime_archive", "lean_init_archive", "lean_include_dir", "lean_config_include_dir", "build_root"]) {
    if (!facts[field]) throw new Error(`native Lean runtime build did not report ${field}`);
  }
};

const collectFiles = async directory => {
  const files = [];
  const visit = async current => {
    for (const entry of (await readdir(current, { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = join(current, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      if (entry.isFile()) {
        const bytes = await readFile(absolute);
        const facts = await stat(absolute);
        files.push({
          path: relative(directory, absolute),
          bytes: bytes.length,
          sha256: sha256(bytes),
          executable: (facts.mode & 0o111) !== 0,
        });
      }
    }
  };
  await visit(directory);
  return files;
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

const glibcMinimumVersion = async libraries => {
  const versions = [];
  for (const library of libraries) {
    const { stdout } = await run("llvm-readelf", ["--version-info", library]);
    for (const match of stdout.matchAll(/GLIBC_(\d+)\.(\d+)/g)) {
      versions.push([Number(match[1]), Number(match[2])]);
    }
  }
  if (versions.length === 0) throw new Error("native libraries do not declare a glibc symbol version");
  versions.sort(([leftMajor, leftMinor], [rightMajor, rightMinor]) =>
    leftMajor - rightMajor || leftMinor - rightMinor);
  return versions.at(-1).join(".");
};

const assertPortableElf = async path => {
  const bytes = await readFile(path);
  if (bytes.includes(nixStoreMarker)) {
    throw new Error(`native artifact contains a Nix store reference: ${path}`);
  }
};

const installerSource = `#include "lean_alpha_runtime.h"

const lean_alpha_runtime_v1 *lean_alpha_native_runtime_v1(void);
void lean_alpha_native_runtime_detach(void);

__attribute__((constructor))
static void lean_alpha_component_attach(void)
{
  lean_alpha_error error = {0};
  (void)lean_alpha_runtime_install_v1(lean_alpha_native_runtime_v1(), &error);
}

__attribute__((destructor))
static void lean_alpha_component_detach(void)
{
  lean_alpha_native_runtime_detach();
}
`;

export const buildNativeFfiArtifacts = async ({ manifest: manifestPath = defaultManifest, output: outputPath }) => {
  const output = resolve(process.cwd(), outputPath);
  if (output === projectRoot || output === dirname(projectRoot)) throw new Error("refusing to use the project or its parent as native output");
  await mkdir(output, { recursive: true });
  if ((await readdir(output)).length !== 0) throw new Error(`native output is not empty: ${output}`);

  const inputs = await readPhpNativePackageInputs({ projectRoot, manifestPath });
  const c = generateCBindingPackage(inputs.bindingIr);
  const native = generateNativeRuntimePackage(inputs.bindingIr);
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-native-ffi-"));
  const environment = {
    ...process.env,
    SOURCE_DATE_EPOCH: String(inputs.manifest.sourceDateEpoch),
    ZERO_AR_DATE: "1",
  };
  try {
    const { stdout } = await run("bash", [join(projectRoot, "scripts/build-lean-native-runtime.sh")], {
      cwd: projectRoot,
      env: environment,
    });
    const facts = parseFacts(stdout);
    requireFacts(facts);

    const source = join(scratch, "source");
    await writeFiles(source, {
      ...c,
      ...native,
      "src/lean_alpha_component.c": installerSource,
    });
    const leanPrefix = dirname(facts.lean_include_dir);
    const libuvArchive = join(leanPrefix, "lib/libuv.a");
    await stat(libuvArchive).catch(() => {
      throw new Error(`the pinned Lean toolchain does not contain static libuv: ${libuvArchive}`);
    });
    const leanC = join(source, "Alpha.c");
    await run(join(leanPrefix, "bin/lean"), [
      "-R", dirname(inputs.leanSourceAbsolute),
      "-o", join(source, "Alpha.olean"),
      "-c", leanC,
      inputs.leanSourceAbsolute,
    ], { cwd: projectRoot, env: environment });

    const prefixFlags = [
      `-ffile-prefix-map=${scratch}=/build/native-ffi`,
      `-fdebug-prefix-map=${scratch}=/build/native-ffi`,
      `-fmacro-prefix-map=${scratch}=/build/native-ffi`,
      `-ffile-prefix-map=${projectRoot}=/workspace`,
      `-fdebug-prefix-map=${projectRoot}=/workspace`,
      `-fmacro-prefix-map=${projectRoot}=/workspace`,
    ];
    const compile = async (input, outputObject) => run("clang", [
      "-O2", "-g0", "-fPIC", ...prefixFlags,
      "-I", join(source, "include"),
      "-I", join(source, "internal"),
      "-I", facts.lean_config_include_dir,
      "-I", facts.lean_include_dir,
      "-c", join(source, input),
      "-o", join(scratch, outputObject),
    ], { env: environment });

    await compile("src/lean_bridge_native_runtime.c", "lean_bridge_native_runtime.o");
    const runtimeLibrary = join(scratch, "liblean_bridge_native.so");
    await run("clang++", [
      "-shared", join(scratch, "lean_bridge_native_runtime.o"),
      "-Wl,--build-id=none",
      "-Wl,--whole-archive", facts.lean_init_archive, facts.native_runtime_archive,
      "-Wl,--no-whole-archive", libuvArchive,
      "-static-libstdc++", "-static-libgcc", "-pthread", "-ldl", "-lrt",
      "-Wl,-soname,liblean_bridge_native.so", "-o", runtimeLibrary,
    ], { env: environment });

    await Promise.all([
      compile("src/lean_alpha.c", "lean_alpha.o"),
      compile("src/lean_alpha_native.c", "lean_alpha_native.o"),
      compile("src/lean_alpha_component.c", "lean_alpha_component.o"),
      compile("Alpha.c", "Alpha.o"),
    ]);
    const componentLibrary = join(scratch, "liblean_alpha_component.so");
    await run("clang++", [
      "-shared",
      join(scratch, "lean_alpha.o"),
      join(scratch, "lean_alpha_native.o"),
      join(scratch, "lean_alpha_component.o"),
      join(scratch, "Alpha.o"),
      "-L", scratch,
      "-Wl,--no-as-needed", "-llean_bridge_native",
      "-Wl,--as-needed", "-Wl,--build-id=none", "-Wl,-z,defs",
      "-Wl,-rpath,$ORIGIN", "-Wl,-soname,liblean_alpha_component.so",
      "-o", componentLibrary,
    ], { env: environment });
    await Promise.all([
      run("llvm-strip", ["--strip-debug", runtimeLibrary]),
      run("llvm-strip", ["--strip-debug", componentLibrary]),
    ]);
    await Promise.all([
      run("patchelf", ["--set-rpath", "$ORIGIN", runtimeLibrary]),
      run("patchelf", ["--set-rpath", "$ORIGIN", componentLibrary]),
    ]);
    await Promise.all([
      assertPortableElf(runtimeLibrary),
      assertPortableElf(componentLibrary),
    ]);
    const minimumGlibc = await glibcMinimumVersion([runtimeLibrary, componentLibrary]);

    await Promise.all([
      mkdir(join(output, "include"), { recursive: true }),
      mkdir(join(output, "internal"), { recursive: true }),
      mkdir(join(output, "lib"), { recursive: true }),
      mkdir(join(output, "metadata"), { recursive: true }),
    ]);
    await Promise.all([
      copyFile(join(source, "include/lean_alpha.h"), join(output, "include/lean_alpha.h")),
      copyFile(join(source, "internal/lean_alpha_runtime.h"), join(output, "internal/lean_alpha_runtime.h")),
      copyFile(join(source, "include/lean_bridge_native_runtime.h"), join(output, "include/lean_bridge_native_runtime.h")),
      copyFile(runtimeLibrary, join(output, "lib/liblean_bridge_native.so")),
      copyFile(componentLibrary, join(output, "lib/liblean_alpha_component.so")),
      writeFile(join(output, "metadata/native-runtime-manifest.json"), native["native-runtime-manifest.json"]),
    ]);
    await Promise.all([
      chmod(join(output, "lib/liblean_bridge_native.so"), 0o755),
      chmod(join(output, "lib/liblean_alpha_component.so"), 0o755),
    ]);
    const payload = await collectFiles(output);
    const manifest = {
      schemaVersion: 1,
      component: inputs.bindingIr.component.id,
      bindingIrSha256: inputs.manifest.bindingIr.semanticSha256,
      target: {
        operatingSystem: "linux",
        architecture: "x86_64",
        libc: "glibc",
        glibcMinimumVersion: minimumGlibc,
        sharedRuntimeAbi: 1,
      },
      runtime: "lib/liblean_bridge_native.so",
      componentLibrary: "lib/liblean_alpha_component.so",
      publicHeader: "include/lean_alpha.h",
      sourceDateEpoch: inputs.manifest.sourceDateEpoch,
      files: payload,
    };
    await writeFile(join(output, "native-artifacts.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    await normalizeTimes(output, inputs.manifest.sourceDateEpoch);
    return Object.freeze({ output, manifest: Object.freeze(manifest) });
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
};

const args = parseArguments(process.argv.slice(2));
if (args) {
  const result = await buildNativeFfiArtifacts(args);
  process.stdout.write(`${JSON.stringify({ output: result.output, files: result.manifest.files.length + 1 }, null, 2)}\n`);
}
