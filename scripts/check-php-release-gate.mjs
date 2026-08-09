#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  collectReleaseTree,
  compareReleaseTrees,
  verifyReleaseInventory,
} from "../src/release/reproducibility.mjs";

const execute = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const options = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  const name = process.argv[index];
  const value = process.argv[index + 1];
  if (!name?.startsWith("--") || !value) throw new Error(`invalid option ${name ?? ""}`);
  options.set(name, value);
}
const pathOption = (name, fallback) => resolve(projectRoot, options.get(name) ?? fallback);
const reportDirectory = pathOption("--output", "build/php-release-gate");
const phpSource = pathOption("--php-source", "build/php-wasm-sdk/php8.4-src");
const emsdk = pathOption("--emsdk", ".toolchains/emsdk-php-wasm");
const phpWasm = pathOption("--php-wasm", "build/php-wasm-host/node_modules/php-wasm");

const run = async (command, args, runOptions = {}) => execute(command, args, {
  cwd: projectRoot,
  maxBuffer: 64 * 1024 * 1024,
  ...runOptions,
});

const readJson = async path => JSON.parse(await readFile(path, "utf8"));

const markdownFor = report => {
  const packageRows = report.packages.map(item =>
    `| ${item.profile} | ${item.artifactCount} | ${item.totalBytes} | ${Object.entries(item.coverage).map(([name, paths]) => `${name}: ${paths.length}`).join(", ")} |`
  ).join("\n");
  const differences = report.differences.length === 0
    ? "No byte differences were found."
    : report.differences.map(item => `- ${item.profile} / ${item.path}: build A \`${item.leftSha256 ?? "missing"}\`, build B \`${item.rightSha256 ?? "missing"}\``).join("\n");
  return `# PHP Release Gate

Result: **${report.result}**

The gate built the native, PHP-Wasm lazy, and PHP-Wasm startup packages twice in separate empty output roots. It compared every retained source, binary, package file, stub, document, manifest, metadata file, and hash record.

${differences}

| Profile | Files | Bytes | Artifact coverage |
|---|---:|---:|---|
${packageRows}

The native package and both PHP-Wasm profiles executed the same Binding IR-derived conformance corpus. Their observation hash is \`${report.semantic?.observationSha256 ?? "unavailable"}\`. The eager and lazy PHP-Wasm packages also passed the two-component shared-runtime composition gate.

Reproduce this report with:

\`\`\`sh
npm run test:php-release
\`\`\`

Publication remains blocked on a semantic, capability, release-manifest hash, SHA-256 inventory, or byte-level mismatch. For a byte mismatch, inspect absolute compiler paths, timestamps, archive metadata, generated ordering, environment-derived metadata, and toolchain drift.
`;
};

await mkdir(join(projectRoot, "build"), { recursive: true });
const scratch = await mkdtemp(join(projectRoot, "build/php-release-gate-run-"));
const packageSpecs = [
  {
    profile: "native-zend",
    requiredCategories: ["php", "c", "extension", "manifest", "stub", "documentation", "metadata"],
    releaseManifestPath: "share/lean-bridge/release-manifest.json",
    hashInventoryPath: "share/lean-bridge/sha256.txt",
  },
  {
    profile: "php-wasm-lazy",
    graphProfile: "side-lazy",
    requiredCategories: ["php", "c", "extension", "wasm", "manifest", "stub", "documentation", "metadata"],
    releaseManifestPath: "metadata/release/release-manifest.json",
    hashInventoryPath: "metadata/release/sha256.txt",
  },
  {
    profile: "php-wasm-startup",
    graphProfile: "side-startup",
    requiredCategories: ["php", "c", "extension", "wasm", "manifest", "stub", "documentation", "metadata"],
    releaseManifestPath: "metadata/release/release-manifest.json",
    hashInventoryPath: "metadata/release/sha256.txt",
  },
];

const report = {
  schemaVersion: 1,
  result: "failed",
  releaseCriterion: "semantic-capability-hash-and-byte-identical",
  cleanBuildsPerProfile: 2,
  packages: [],
  differences: [],
  semantic: null,
  composition: null,
  likelyEntropySources: [
    "absolute compiler paths",
    "file timestamps",
    "archive member metadata",
    "generated file ordering",
    "environment-derived metadata",
    "toolchain drift",
  ],
  reproductionCommand: "npm run test:php-release",
};

try {
  const baseWasmManifest = await readJson(join(projectRoot, "poc/lean-link-spike/bindings/php-wasm.package.json"));
  for (const spec of packageSpecs) {
    spec.left = join(scratch, `${spec.profile}-a`);
    spec.right = join(scratch, `${spec.profile}-b`);
    if (spec.profile === "native-zend") {
      for (const output of [spec.left, spec.right]) {
        await run(process.execPath, [
          "scripts/build-php-native-package.mjs",
          "--manifest", "poc/lean-link-spike/bindings/php-native.package.json",
          "--output", output,
        ]);
      }
    } else {
      const manifest = structuredClone(baseWasmManifest);
      manifest.graphLock.profile = spec.graphProfile;
      const manifestPath = join(scratch, `${spec.profile}.package.json`);
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
      for (const output of [spec.left, spec.right]) {
        await run(process.execPath, [
          "scripts/build-php-wasm-package.mjs",
          "--manifest", manifestPath,
          "--output", output,
          "--php-source", phpSource,
          "--emsdk", emsdk,
        ]);
      }
    }

    const [leftTree, rightTree] = await Promise.all([
      collectReleaseTree(spec.left),
      collectReleaseTree(spec.right),
    ]);
    const comparison = compareReleaseTrees(leftTree, rightTree);
    report.differences.push(...comparison.differences.map(item => ({ profile: spec.profile, ...item })));
    const [leftInventory, rightInventory] = await Promise.all([
      verifyReleaseInventory({
        directory: spec.left,
        releaseManifestPath: spec.releaseManifestPath,
        hashInventoryPath: spec.hashInventoryPath,
        requiredCategories: spec.requiredCategories,
      }),
      verifyReleaseInventory({
        directory: spec.right,
        releaseManifestPath: spec.releaseManifestPath,
        hashInventoryPath: spec.hashInventoryPath,
        requiredCategories: spec.requiredCategories,
      }),
    ]);
    if (leftInventory.bindingIrSha256 !== rightInventory.bindingIrSha256) {
      throw new Error(`${spec.profile} Binding IR identity changed across rebuilds`);
    }
    report.packages.push({ profile: spec.profile, ...leftInventory });
  }

  if (report.differences.length > 0) throw new Error("release rebuilds produced byte-level differences");
  const [native, lazy, startup] = packageSpecs;
  for (const spec of [lazy, startup]) {
    await run(process.execPath, [
      "scripts/check-php-transport-parity.mjs",
      "--native-package", native.left,
      "--php-wasm-package", spec.left,
      "--php-wasm", phpWasm,
      "--output", join(scratch, `${spec.profile}-parity`),
    ]);
  }
  await run(process.execPath, [
    "scripts/check-php-wasm-composition.mjs",
    "--lazy-package", lazy.left,
    "--startup-package", startup.left,
    "--php-wasm", phpWasm,
    "--output", join(scratch, "composition"),
  ]);
  const [lazyParity, startupParity, composition] = await Promise.all([
    readJson(join(scratch, "php-wasm-lazy-parity/parity.json")),
    readJson(join(scratch, "php-wasm-startup-parity/parity.json")),
    readJson(join(scratch, "composition/composition.json")),
  ]);
  if (lazyParity.observationSha256 !== startupParity.observationSha256) {
    throw new Error("PHP-Wasm eager and lazy profiles produced different semantic observations");
  }
  if (JSON.stringify(lazyParity.capabilityGaps) !== JSON.stringify(startupParity.capabilityGaps)) {
    throw new Error("PHP-Wasm eager and lazy profiles reported different capability gaps");
  }
  const bindingIdentities = new Set(report.packages.map(item => item.bindingIrSha256));
  if (bindingIdentities.size !== 1 || !bindingIdentities.has(lazyParity.bindingIrSha256)) {
    throw new Error("release packages and conformance corpus used different Binding IR identities");
  }
  report.semantic = {
    result: "passed",
    bindingIrSha256: lazyParity.bindingIrSha256,
    observationSha256: lazyParity.observationSha256,
    capabilityGaps: lazyParity.capabilityGaps,
    profiles: ["native-zend", "php-wasm-lazy", "php-wasm-startup"],
  };
  report.composition = {
    result: composition.result,
    graph: composition.graph,
    components: composition.components,
    profiles: composition.profiles.map(profile => ({
      profile: profile.profile,
      canonicalIdentity: profile.canonicalIdentity,
      privateRuntimeRejected: profile.privateRuntimeRejected,
      runtime: profile.runtime,
    })),
  };
  report.result = "passed";
} catch (error) {
  report.failure = {
    name: error.name,
    code: error.code ?? null,
    message: error.message,
    details: error.details ?? null,
  };
} finally {
  await mkdir(reportDirectory, { recursive: true });
  await writeFile(join(reportDirectory, "release-gate.json"), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(join(reportDirectory, "release-gate.md"), markdownFor(report));
  await rm(scratch, { recursive: true, force: true });
}

if (report.result !== "passed") {
  throw new Error(`PHP release gate failed: ${report.failure?.message ?? "unknown failure"}`);
}
process.stdout.write(`PHP release gate passed for ${report.packages.length} profiles and ${report.packages.reduce((total, item) => total + item.artifactCount, 0)} compared files.\n`);
