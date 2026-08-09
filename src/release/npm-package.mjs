import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import {
  hashCanonicalPackageManifest,
  parseCanonicalPackageManifest,
} from "./canonical-package-manifest.mjs";
import { validatePackagingBackendPlan } from "./backend-policy.mjs";

const sha256 = value => createHash("sha256").update(value).digest("hex");
const json = value => `${JSON.stringify(value, null, 2)}\n`;

const ensureEmptyOutput = async output => {
  await mkdir(output, { recursive: true });
  if ((await readdir(output)).length !== 0) throw new Error(`npm package output is not empty: ${output}`);
};

const verifyBundle = async bundle => {
  const source = await readFile(join(bundle, "canonical-package.json"), "utf8");
  const manifest = parseCanonicalPackageManifest(source);
  const manifestSha256 = hashCanonicalPackageManifest(manifest);
  const inventory = await readFile(join(bundle, "canonical-package.sha256"), "utf8");
  if (inventory !== `${manifestSha256}  canonical-package.json\n`) {
    throw new Error("canonical package hash inventory does not match the manifest");
  }
  for (const artifact of manifest.artifacts) {
    const bytes = await readFile(join(bundle, artifact.path));
    if (bytes.length !== artifact.bytes || sha256(bytes) !== artifact.sha256) {
      throw new Error(`canonical bundle artifact changed: ${artifact.path}`);
    }
  }
  return { manifest, manifestSha256 };
};

const copy = async (source, destination) => {
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
};

const runtimeModule = () => `import createMain from "./wasm/main.mjs";
import descriptorData from "./descriptor.json" with { type: "json" };
import { createLibraryLoader } from "./bridge/poc/link-spike/loader.mjs";

const mainWasm = new URL("./wasm/main.wasm", import.meta.url);
const alphaWasm = new URL("./wasm/alpha.so.wasm", import.meta.url);
const assets = Object.freeze({
  "main.wasm": mainWasm.href,
  "alpha.so.wasm": alphaWasm.href,
});
const module = await createMain({ locateFile: path => assets[path] ?? path });
const descriptor = Object.freeze({
  ...descriptorData,
  dependencies: Object.freeze([]),
  sideModule: alphaWasm,
});
const libraries = createLibraryLoader(module, { libraries: [descriptor] });
const alpha = await libraries.load(descriptor);
const nativeByWrapper = new WeakMap();
const wrapperByNative = new WeakMap();
const constructors = new Map();
const methods = new Map();
const calls = new Map();

const requireNative = wrapper => {
  const native = nativeByWrapper.get(wrapper);
  if (!native) throw new TypeError("Lean object is disposed or belongs to another runtime");
  return native;
};

const projectIdentity = (result, native, wrapper, call) => {
  if (call?.result?.representation !== "identity") return result;
  if (result === native) return wrapper;
  const projected = wrapperByNative.get(result)?.deref();
  if (projected) return projected;
  throw new TypeError("Lean returned an identity without a generated host wrapper");
};

for (const binding of descriptor.bindings) {
  if (binding.kind === "class") {
    const NativeClass = alpha[binding.name];
    constructors.set(binding.lifecycle.constructor.declarationId, (wrapper, args) => {
      const native = Reflect.construct(NativeClass, args);
      nativeByWrapper.set(wrapper, native);
      wrapperByNative.set(native, new WeakRef(wrapper));
    });
    for (const method of binding.methods ?? []) {
      methods.set(method.declarationId, (native, args, wrapper) =>
        projectIdentity(native[method.name](...args), native, wrapper, method.call));
    }
    for (const property of binding.properties ?? []) {
      methods.set(property.declarationId, (native, args, wrapper) => {
        if (property.role === "getter") {
          return projectIdentity(native[property.name], native, wrapper, property.call);
        }
        native[property.name] = args[0];
        return undefined;
      });
    }
    continue;
  }
  if (binding.kind === "function") {
    calls.set(binding.declarationId, args => alpha[binding.name](...args));
    continue;
  }
  if (binding.kind === "overload") {
    for (const branch of binding.branches) {
      calls.set(branch.declarationId, args => alpha[binding.name](...args));
    }
    continue;
  }
  throw new TypeError(\`unsupported generated binding \${binding.kind}\`);
}

const attach = (id, wrapper, args) => {
  const operation = constructors.get(id);
  if (!operation) throw new TypeError(\`unknown Lean constructor \${id}\`);
  try {
    operation(wrapper, args);
  } catch (error) {
    nativeByWrapper.delete(wrapper);
    throw error;
  }
};

const dispose = wrapper => {
  const native = nativeByWrapper.get(wrapper);
  if (!native) return false;
  nativeByWrapper.delete(wrapper);
  wrapperByNative.delete(native);
  return native.dispose();
};

export const runtime = Object.freeze({
  construct(id, wrapper, args) {
    return attach(id, wrapper, args);
  },
  method(id, wrapper, args) {
    const operation = methods.get(id);
    if (!operation) throw new TypeError(\`unknown Lean method \${id}\`);
    return operation(requireNative(wrapper), args, wrapper);
  },
  dispose,
  call(id, args) {
    const operation = calls.get(id);
    if (!operation) throw new TypeError(\`unknown Lean function \${id}\`);
    return operation(args);
  },
  iterate(id, args) {
    const operation = calls.get(id);
    if (!operation) throw new TypeError(\`unknown Lean iterator \${id}\`);
    return operation(args);
  },
  iterateAsync(id, args) {
    const operation = calls.get(id);
    if (!operation) throw new TypeError(\`unknown Lean async iterator \${id}\`);
    return operation(args);
  },
});
`;

const splitTarPath = path => {
  if (Buffer.byteLength(path) <= 100) return { name: path, prefix: "" };
  for (let index = path.lastIndexOf("/"); index > 0; index = path.lastIndexOf("/", index - 1)) {
    const prefix = path.slice(0, index);
    const name = path.slice(index + 1);
    if (Buffer.byteLength(prefix) <= 155 && Buffer.byteLength(name) <= 100) return { name, prefix };
  }
  throw new Error(`package path is too long for ustar: ${path}`);
};

const writeText = (header, offset, length, value) => {
  const bytes = Buffer.from(value, "utf8");
  if (bytes.length > length) throw new Error(`tar field exceeds ${length} bytes`);
  bytes.copy(header, offset);
};

const octal = (value, width) => `${value.toString(8).padStart(width - 1, "0")}\0`;

const tarHeader = (path, size, epoch) => {
  const header = Buffer.alloc(512);
  const { name, prefix } = splitTarPath(path);
  writeText(header, 0, 100, name);
  writeText(header, 100, 8, octal(0o644, 8));
  writeText(header, 108, 8, octal(0, 8));
  writeText(header, 116, 8, octal(0, 8));
  writeText(header, 124, 12, octal(size, 12));
  writeText(header, 136, 12, octal(epoch, 12));
  header.fill(0x20, 148, 156);
  header[156] = "0".charCodeAt(0);
  writeText(header, 257, 6, "ustar\0");
  writeText(header, 263, 2, "00");
  writeText(header, 345, 155, prefix);
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  writeText(header, 148, 8, `${checksum.toString(8).padStart(6, "0")}\0 `);
  return header;
};

const collectPackageFiles = async root => {
  const files = [];
  const visit = async (directory, prefix = "") => {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute, path);
      if (entry.isFile()) files.push({ path: `package/${path}`, bytes: await readFile(absolute) });
    }
  };
  await visit(root);
  return files;
};

const createArchive = async (packageRoot, epoch) => {
  const chunks = [];
  for (const file of await collectPackageFiles(packageRoot)) {
    chunks.push(tarHeader(file.path, file.bytes.length, epoch), file.bytes);
    const remainder = file.bytes.length % 512;
    if (remainder !== 0) chunks.push(Buffer.alloc(512 - remainder));
  }
  chunks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(chunks), { level: 9, mtime: 0 });
};

export const buildNpmPackage = async ({ bundleRoot, outputRoot }) => {
  const bundle = resolve(bundleRoot);
  const output = resolve(outputRoot);
  if (output === bundle || output === dirname(bundle)) throw new Error("refusing to replace the canonical bundle with an npm package");
  await ensureEmptyOutput(output);
  const { manifest, manifestSha256 } = await verifyBundle(bundle);
  const npm = manifest.packages.find(packageMapping => packageMapping.ecosystem === "npm");
  if (!npm?.eligible) throw new Error(`canonical bundle is not eligible for npm projection: ${npm?.reason ?? "mapping absent"}`);

  const packageRoot = join(output, "package");
  const copies = [
    ["bindings/javascript/index.mjs", "index.mjs"],
    ["bindings/javascript/index.d.ts", "index.d.ts"],
    ["bindings/javascript/internal/validators.mjs", "internal/validators.mjs"],
    ["bindings/javascript/README.md", "README.md"],
    ["bindings/javascript/binding-manifest.json", "binding-manifest.json"],
    ["artifacts/browser/runtime.mjs", "internal/wasm/main.mjs"],
    ["artifacts/browser/runtime.wasm", "internal/wasm/main.wasm"],
    ["artifacts/browser/alpha.so.wasm", "internal/wasm/alpha.so.wasm"],
    ["runtime/javascript/alpha-descriptor.json", "internal/descriptor.json"],
    ["runtime/javascript/poc/link-spike/loader.mjs", "internal/bridge/poc/link-spike/loader.mjs"],
    ["runtime/javascript/src/runtime/pending-operations.mjs", "internal/bridge/src/runtime/pending-operations.mjs"],
    ["runtime/javascript/src/runtime/callbacks.mjs", "internal/bridge/src/runtime/callbacks.mjs"],
    ["runtime/javascript/src/runtime/weak-value-map.mjs", "internal/bridge/src/runtime/weak-value-map.mjs"],
    ["runtime/javascript/src/binding-ir/canonical.mjs", "internal/bridge/src/binding-ir/canonical.mjs"],
    ["runtime/javascript/src/binding-ir/contract.mjs", "internal/bridge/src/binding-ir/contract.mjs"],
    ["LICENSE", "LICENSE"],
    ["canonical-package.json", "metadata/canonical-package.json"],
    ["canonical-package.sha256", "metadata/canonical-package.sha256"],
    ["bundle-identity.json", "metadata/bundle-identity.json"],
    ["metadata/assurance.json", "metadata/assurance.json"],
    ["metadata/core-artifact-set.json", "metadata/core-artifact-set.json"],
    ["metadata/sbom.spdx.json", "metadata/sbom.spdx.json"],
    ["metadata/provenance.intoto.json", "metadata/provenance.intoto.json"],
  ];
  for (const [source, destination] of copies) await copy(join(bundle, source), join(packageRoot, destination));
  await writeFile(join(packageRoot, "internal/runtime.mjs"), runtimeModule());

  const packageJson = {
    name: npm.name,
    version: npm.version,
    description: "Generated Lean bindings backed by one shared WebAssembly runtime.",
    license: manifest.licenses.expression,
    type: "module",
    sideEffects: false,
    engines: { node: ">=22" },
    types: "./index.d.ts",
    exports: {
      ".": {
        types: "./index.d.ts",
        import: "./index.mjs",
        default: "./index.mjs",
      },
    },
    files: ["index.mjs", "index.d.ts", "README.md", "LICENSE", "binding-manifest.json", "internal", "metadata"],
    leanBridge: {
      component: manifest.component.id,
      canonicalManifestSha256: manifestSha256,
      bindingIrSha256: manifest.bindingIr.semanticSha256,
      sharedRuntime: true,
    },
  };
  await writeFile(join(packageRoot, "package.json"), json(packageJson));

  const coreArtifacts = copies.slice(5, 8).map(([sourcePath, packagePath]) => {
    const artifact = manifest.artifacts.find(candidate => candidate.path === sourcePath);
    if (!artifact) throw new Error(`canonical manifest does not inventory ${sourcePath}`);
    return {
      sourcePath,
      packagePath,
      sourceSha256: artifact.sha256,
      packageSha256: artifact.sha256,
    };
  });
  const plan = {
    schemaVersion: 1,
    backend: "npm-v1",
    ecosystem: "npm",
    bundle: { id: manifest.component.id, manifestSha256 },
    compilerAccess: false,
    scriptPolicy: "disabled",
    versionSource: "canonical-manifest",
    semanticSource: "canonical-manifest",
    operations: ["select", "arrange", "copy", "rename", "render-registry-metadata", "archive", "compress"],
    commands: ["internal-ustar package", "internal-gzip package.tar"],
    coreArtifacts,
  };
  validatePackagingBackendPlan(plan);
  await writeFile(join(output, "npm-projection.json"), json(plan));

  const archiveName = `${npm.name.replace(/^@/, "").replace("/", "-")}-${npm.version}.tgz`;
  const archive = await createArchive(packageRoot, manifest.provenance.sourceDateEpoch);
  await writeFile(join(output, archiveName), archive);
  return Object.freeze({
    package: `${npm.name}@${npm.version}`,
    output,
    archive: join(output, archiveName),
    archiveSha256: sha256(archive),
    canonicalManifestSha256: manifestSha256,
    coreArtifacts: Object.freeze(coreArtifacts),
  });
};
