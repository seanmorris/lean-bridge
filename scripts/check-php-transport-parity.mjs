#!/usr/bin/env node

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  comparePhpConformanceResults,
  generatePhpConformanceCorpus,
} from "../src/backends/php/conformance.mjs";

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
const reportDirectory = pathOption("--output", "build/php-transport-parity");
const phpSource = pathOption("--php-source", "build/php-wasm-sdk/php8.4-src");
const emsdk = pathOption("--emsdk", ".toolchains/emsdk-php-wasm");
const phpWasmRoot = pathOption("--php-wasm", "build/php-wasm-host/node_modules/php-wasm");
const suppliedNative = options.has("--native-package") ? pathOption("--native-package") : null;
const suppliedPhpWasm = options.has("--php-wasm-package") ? pathOption("--php-wasm-package") : null;
if (Boolean(suppliedNative) !== Boolean(suppliedPhpWasm)) {
  throw new Error("--native-package and --php-wasm-package must be supplied together");
}

const sha256 = source => createHash("sha256").update(source).digest("hex");
const run = async (command, args, options = {}) => execute(command, args, {
  cwd: projectRoot,
  maxBuffer: 64 * 1024 * 1024,
  ...options,
});

const runNative = async ({ packageRoot, sourcePath }) => {
  const composerRoot = join(packageRoot, "share/php/component");
  await run("composer", ["dump-autoload", "--quiet", "--no-interaction"], { cwd: composerRoot });
  const extension = join(packageRoot, "lib/php/lean_alpha.so");
  const { stdout, stderr } = await run("php", ["-n", "-d", `extension=${extension}`, sourcePath], {
    env: {
      ...process.env,
      LEAN_BRIDGE_CONFORMANCE_PACKAGE_ROOT: composerRoot,
      LEAN_BRIDGE_CONFORMANCE_AUTOLOAD: join(composerRoot, "vendor/autoload.php"),
    },
  });
  if (stderr !== "") throw new Error(`native PHP conformance wrote stderr: ${stderr}`);
  return JSON.parse(stdout);
};

const runPhpWasm = async ({ packageRoot, source }) => {
  const [{ PhpNode }, { default: packageDescriptor }] = await Promise.all([
    import(pathToFileURL(join(phpWasmRoot, "PhpNode.mjs"))),
    import(`${pathToFileURL(join(packageRoot, "index.mjs")).href}?parity=${Date.now()}`),
  ]);
  const php = new PhpNode({ version: "8.4", sharedLibs: [packageDescriptor] });
  let stdout = "";
  let stderr = "";
  php.addEventListener("output", event => {
    for (const line of event.detail) stdout += line;
  });
  php.addEventListener("error", event => {
    for (const line of event.detail) stderr += line;
  });
  await php.binary;
  const status = await php.run(source);
  if (status !== 0 || stderr !== "") {
    throw new Error(`PHP-Wasm conformance failed with status ${status}: ${stderr || stdout}`);
  }
  return JSON.parse(stdout);
};

const releaseIdentity = async ({ packageRoot, transport }) => {
  const path = transport === "native-zend"
    ? join(packageRoot, "share/lean-bridge/release-manifest.json")
    : join(packageRoot, "metadata/release/release-manifest.json");
  const source = await readFile(path);
  const release = JSON.parse(source);
  const wanted = transport === "native-zend"
    ? new Set(["lib/liblean_bridge_native.so", "lib/php/lean_alpha.so"])
    : new Set([
      "lib/liblean_bridge_runtime.so",
      "lib/components/alpha.so.wasm",
      "lib/components/beta.so.wasm",
      "lib/components/gamma.so.wasm",
      "lib/php8.4-lean-alpha.so",
    ]);
  return {
    transport,
    packageId: release.packageId,
    releaseManifestSha256: sha256(source),
    bindingIrSha256: release.bindingIr.semanticSha256,
    artifacts: release.artifacts.filter(artifact => wanted.has(artifact.path)),
  };
};

const writeReport = async report => {
  await mkdir(reportDirectory, { recursive: true });
  await writeFile(join(reportDirectory, "parity.json"), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(
    join(reportDirectory, "capability-gaps.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      component: report.component,
      bindingIrSha256: report.bindingIrSha256,
      gaps: report.capabilityGaps,
    }, null, 2)}\n`,
  );
  const artifactRows = report.artifactIdentities.flatMap(identity => identity.artifacts.map(artifact =>
    `| ${identity.transport} | \`${artifact.path}\` | ${artifact.bytes} | \`${artifact.sha256}\` |`
  )).join("\n");
  const gaps = report.capabilityGaps.length === 0
    ? "The corpus covers every feature declared by the current Binding IR."
    : report.capabilityGaps.map(gap => `- ${gap.feature}: ${gap.reason}`).join("\n");
  const markdown = `# Native PHP and PHP-Wasm Semantic Parity

Result: **${report.result}**

Both transports executed the same generated PHP source. The observation hash is \`${report.observationSha256}\`.

The corpus checked typed copied values, canonical object identity, PHP callbacks, returned Lean closures, declared exceptions, initialization, deterministic cleanup, stale resource rejection, reflection, documentation identity, assurance identity, and Binding IR identity.

## Current fixture gaps

${gaps}

## Artifact identities

| Transport | Artifact | Bytes | SHA-256 |
|---|---|---:|---|
${artifactRows}

Reproduce the report with:

\`\`\`sh
npm run test:php-transport-parity
\`\`\`
`;
  await writeFile(join(reportDirectory, "parity.md"), markdown);
};

await mkdir(join(projectRoot, "build"), { recursive: true });
const scratch = suppliedNative ? null : await mkdtemp(join(projectRoot, "build/php-transport-parity-run-"));
const nativePackage = suppliedNative ?? join(scratch, "native");
const phpWasmPackage = suppliedPhpWasm ?? join(scratch, "php-wasm");
try {
  if (!suppliedNative) {
    await run("node", [
      "scripts/build-php-native-package.mjs",
      "--manifest", "poc/lean-link-spike/bindings/php-native.package.json",
      "--output", nativePackage,
    ]);
    await run("node", [
      "scripts/build-php-wasm-package.mjs",
      "--manifest", "poc/lean-link-spike/bindings/php-wasm.package.json",
      "--output", phpWasmPackage,
      "--php-source", phpSource,
      "--emsdk", emsdk,
    ]);
  }
  const ir = JSON.parse(await readFile(join(projectRoot, "poc/lean-link-spike/bindings/alpha.binding-ir.json"), "utf8"));
  const corpus = generatePhpConformanceCorpus(ir);
  await mkdir(reportDirectory, { recursive: true });
  const sourcePath = join(reportDirectory, "conformance.php");
  await writeFile(sourcePath, corpus.files["conformance.php"]);
  await writeFile(join(reportDirectory, "conformance.json"), corpus.files["conformance.json"]);
  const [native, phpWasm] = await Promise.all([
    runNative({ packageRoot: nativePackage, sourcePath }),
    runPhpWasm({ packageRoot: phpWasmPackage, source: corpus.files["conformance.php"] }),
  ]);
  const parity = comparePhpConformanceResults({ corpus: corpus.manifest, native, phpWasm });
  const artifactIdentities = await Promise.all([
    releaseIdentity({ packageRoot: nativePackage, transport: "native-zend" }),
    releaseIdentity({ packageRoot: phpWasmPackage, transport: "php-wasm" }),
  ]);
  const report = { ...parity, artifactIdentities };
  await writeReport(report);
  process.stdout.write(`PHP transport parity passed: ${report.observationSha256}.\n`);
} finally {
  if (scratch) await rm(scratch, { recursive: true, force: true });
}
