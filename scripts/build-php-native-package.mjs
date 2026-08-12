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
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  createPhpNativeReleaseManifest,
  generatePhpNativePackageSources,
  readPhpNativePackageInputs,
} from "../src/backends/php/native-package.mjs";

const execute = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultManifest = "poc/lean-link-spike/bindings/php-native.package.json";

const usage = () => {
  process.stderr.write("Usage: build-php-native-package.mjs --output PATH [--manifest PATH]\n");
};

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
    return await execute(command, args, {
      maxBuffer: 32 * 1024 * 1024,
      ...options,
    });
  } catch (error) {
    const stdout = error.stdout ? `\nstdout:\n${error.stdout}` : "";
    const stderr = error.stderr ? `\nstderr:\n${error.stderr}` : "";
    throw new Error(`${command} failed${stdout}${stderr}`, { cause: error });
  }
};

const sha256 = value => createHash("sha256").update(value).digest("hex");

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
  for (const field of [
    "native_runtime_archive",
    "lean_init_archive",
    "lean_include_dir",
    "lean_config_include_dir",
    "build_root",
  ]) {
    if (!facts[field]) throw new Error(`native Lean runtime build did not report ${field}`);
  }
};

const configureExtension = ({ config, sources, leanIncludes, runtimeDirectory, variable, extension }) => config.replace(
  /  PHP_NEW_EXTENSION\([^\n]+/,
  [
    ...leanIncludes.map(include => `  PHP_ADD_INCLUDE([${include}])`),
    `  PHP_ADD_LIBRARY_WITH_PATH([lean_bridge_native], [${runtimeDirectory}], [${variable}])`,
    `  PHP_SUBST([${variable}])`,
    `  PHP_NEW_EXTENSION([${extension}], [${sources.join(" ")}], [$ext_shared])`,
  ].join("\n"),
);

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
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = join(current, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      if (entry.isFile()) await utimes(absolute, timestamp, timestamp);
    }
    await utimes(current, timestamp, timestamp);
  };
  await visit(directory);
};

const observedTarget = async facts => {
  const [{ stdout: php }, { stdout: phpInclude }, { stdout: architecture }, buildFacts] = await Promise.all([
    run("php", ["-r", "echo json_encode(['version' => PHP_VERSION, 'versionId' => PHP_VERSION_ID, 'zts' => PHP_ZTS, 'os' => PHP_OS_FAMILY], JSON_THROW_ON_ERROR);"]),
    run("php-config", ["--include-dir"]),
    run("uname", ["-m"]),
    readFile(join(facts.build_root, "audit/build-facts.txt"), "utf8"),
  ]);
  const zendModules = await readFile(join(phpInclude.trim(), "Zend/zend_modules.h"), "utf8");
  const apiMatch = zendModules.match(/^#define ZEND_MODULE_API_NO\s+(\d+)$/m);
  if (!apiMatch) throw new Error("PHP development headers do not declare ZEND_MODULE_API_NO");
  const runtimeFacts = Object.fromEntries(buildFacts.trim().split("\n").map(line => line.split(/=(.*)/s).slice(0, 2)));
  return {
    ...JSON.parse(php),
    phpApi: apiMatch[1],
    architecture: architecture.trim(),
    threadSafety: JSON.parse(php).zts === 0 ? "nts" : "zts",
    leanCommit: runtimeFacts.lean_commit,
    leanRuntimeConfigSha256: runtimeFacts.config_sha256,
    clangVersion: runtimeFacts.clang_version,
    libuvVersion: runtimeFacts.libuv_version,
  };
};

const build = async ({ manifest: manifestPath, output: outputPath }) => {
  const output = resolve(process.cwd(), outputPath);
  if (output === projectRoot || output === dirname(projectRoot)) {
    throw new Error("refusing to use the project or its parent as a package output");
  }
  await mkdir(output, { recursive: true });
  if ((await readdir(output)).length !== 0) throw new Error(`package output is not empty: ${output}`);

  const inputs = await readPhpNativePackageInputs({ projectRoot, manifestPath });
  const generated = generatePhpNativePackageSources(inputs);
  const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-php-package-"));
  const epochEnvironment = {
    ...process.env,
    SOURCE_DATE_EPOCH: String(inputs.manifest.sourceDateEpoch),
    ZERO_AR_DATE: "1",
  };
  try {
    const { stdout: runtimeOutput } = await run("bash", [join(projectRoot, "scripts/build-lean-native-runtime.sh")], {
      cwd: projectRoot,
      env: epochEnvironment,
    });
    const facts = parseFacts(runtimeOutput);
    requireFacts(facts);

    const runtimeSource = join(scratch, "runtime");
    await writeFiles(runtimeSource, generated.runtime);
    const runtimeObject = join(runtimeSource, "lean_bridge_native_runtime.o");
    const runtimeLibrary = join(scratch, "liblean_bridge_native.so");
    const prefixFlags = [
      `-ffile-prefix-map=${scratch}=/build/php-native`,
      `-fdebug-prefix-map=${scratch}=/build/php-native`,
      `-fmacro-prefix-map=${scratch}=/build/php-native`,
    ];
    await run("clang", [
      "-O2",
      "-g0",
      "-fPIC",
      ...prefixFlags,
      "-I", join(runtimeSource, "include"),
      "-I", facts.lean_config_include_dir,
      "-I", facts.lean_include_dir,
      "-c", join(runtimeSource, "src/lean_bridge_native_runtime.c"),
      "-o", runtimeObject,
    ], { env: epochEnvironment });
    await run("clang++", [
      "-shared",
      runtimeObject,
      "-Wl,--build-id=none",
      "-Wl,--whole-archive", facts.lean_init_archive, facts.native_runtime_archive,
      "-Wl,--no-whole-archive",
      "-pthread",
      "-luv",
      "-ldl",
      "-Wl,-soname,liblean_bridge_native.so",
      "-o", runtimeLibrary,
    ], { env: epochEnvironment });
    await run("llvm-strip", ["--strip-debug", runtimeLibrary]);

    const extensionSource = join(scratch, "extension");
    const extensionFiles = { ...generated.zend };
    const extensionStem = basename(inputs.manifest.artifacts.extension, ".so");
    extensionFiles["lean_bridge_native_runtime.h"] = generated.runtime["include/lean_bridge_native_runtime.h"];
    extensionFiles[`src/${extensionStem}_native.c`] = generated.runtime[`src/${extensionStem}_native.c`];
    const leanC = `${inputs.manifest.lean.module}.c`;
    extensionFiles["config.m4"] = configureExtension({
      config: extensionFiles["config.m4"],
      sources: [`${extensionStem}_zend.c`, `src/${extensionStem}.c`, `src/${extensionStem}_native.c`, leanC],
      leanIncludes: [facts.lean_config_include_dir, facts.lean_include_dir],
      runtimeDirectory: dirname(runtimeLibrary),
      variable: `${extensionStem.toUpperCase()}_SHARED_LIBADD`,
      extension: extensionStem,
    });
    await writeFiles(extensionSource, extensionFiles);
    const leanPrefix = dirname(facts.lean_include_dir);
    await run(join(leanPrefix, "bin/lean"), [
      "-R", dirname(inputs.leanSourceAbsolute),
      "-o", join(extensionSource, `${inputs.manifest.lean.module}.olean`),
      "-c", join(extensionSource, leanC),
      inputs.leanSourceAbsolute,
    ], { cwd: projectRoot, env: epochEnvironment });
    const leanCPath = join(extensionSource, leanC);
    const normalizedLeanC = (await readFile(leanCPath, "utf8"))
      .replaceAll(projectRoot, "/workspace")
      .replaceAll(scratch, "/build/php-native");
    await writeFile(leanCPath, normalizedLeanC);
    const compileEnvironment = {
      ...epochEnvironment,
      CFLAGS: ["-O2", "-g0", ...prefixFlags].join(" "),
      CXXFLAGS: ["-O2", "-g0", ...prefixFlags].join(" "),
      LDFLAGS: "-Wl,--build-id=none",
    };
    await run("phpize", [], { cwd: extensionSource, env: compileEnvironment });
    await run("./configure", [`--enable-${extensionStem.replaceAll("_", "-")}`], {
      cwd: extensionSource,
      env: compileEnvironment,
    });
    await run("make", ["-j2"], { cwd: extensionSource, env: compileEnvironment });
    const extensionLibrary = join(extensionSource, "modules", `${extensionStem}.so`);
    await run("patchelf", ["--set-rpath", "$ORIGIN/..", extensionLibrary]);
    await run("llvm-strip", ["--strip-debug", extensionLibrary]);
    const packagedExtensionFiles = Object.fromEntries(Object.entries(extensionFiles).map(([path, source]) => [
      path,
      source.replaceAll(scratch, "/build/php-native").replaceAll(projectRoot, "/workspace"),
    ]));

    const runtimeDestination = join(output, inputs.manifest.artifacts.runtimeLibrary);
    const extensionDestination = join(output, inputs.manifest.artifacts.extension);
    const composerDestination = join(output, inputs.manifest.artifacts.composerPackage);
    const metadataDestination = join(output, inputs.manifest.artifacts.metadata);
    await mkdir(dirname(runtimeDestination), { recursive: true });
    await mkdir(dirname(extensionDestination), { recursive: true });
    await Promise.all([
      copyFile(runtimeLibrary, runtimeDestination),
      copyFile(extensionLibrary, extensionDestination),
      writeFiles(composerDestination, generated.composer),
      mkdir(metadataDestination, { recursive: true }),
    ]);
    await Promise.all([
      chmod(runtimeDestination, 0o755),
      chmod(extensionDestination, 0o755),
      copyFile(inputs.manifestAbsolute, join(metadataDestination, "package-input.json")),
      writeFile(join(metadataDestination, "binding-ir.json"), `${JSON.stringify(inputs.bindingIr, null, 2)}\n`),
      writeFile(join(metadataDestination, "zend-manifest.json"), generated.zend["zend-manifest.json"]),
      writeFile(join(metadataDestination, "native-runtime-manifest.json"), generated.runtime["native-runtime-manifest.json"]),
      writeFiles(join(metadataDestination, "sources/runtime"), generated.runtime),
      writeFiles(join(metadataDestination, "sources/extension"), {
        ...packagedExtensionFiles,
        [leanC]: normalizedLeanC,
      }),
    ]);

    const payload = await collectFiles(output);
    const release = createPhpNativeReleaseManifest({
      manifest: inputs.manifest,
      bindingIr: inputs.bindingIr,
      observedTarget: await observedTarget(facts),
      artifacts: payload,
      generated,
    });
    await writeFile(join(metadataDestination, "release-manifest.json"), `${JSON.stringify(release, null, 2)}\n`);
    const completePayload = await collectFiles(output);
    const hashes = Object.entries(completePayload)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([path, value]) => `${sha256(value)}  ${path}`)
      .join("\n");
    await writeFile(join(metadataDestination, "sha256.txt"), `${hashes}\n`);
    await normalizeTimes(output, inputs.manifest.sourceDateEpoch);

    process.stdout.write(`${JSON.stringify({
      packageId: inputs.manifest.packageId,
      output,
      releaseManifest: relative(output, join(metadataDestination, "release-manifest.json")),
      artifacts: release.artifacts,
    }, null, 2)}\n`);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
};

const args = parseArguments(process.argv.slice(2));
if (args) await build(args);
