/**
 * Implements the npm package module in the release subsystem.
 *
 * @file
 */

import { createHash } from "node:crypto";
import {
	copyFile,
	mkdir,
	readdir,
	writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { validatePackagingBackendPlan } from "./backend-policy.mjs";
import { readVerifiedCanonicalBundle } from "./canonical-bundle-input.mjs";
import { createDeterministicTarGz } from "./deterministic-archive.mjs";

const sha256 = value => createHash("sha256").update(value).digest("hex");
const json = value => `${JSON.stringify(value, null, 2)}\n`;

const ensureEmptyOutput = async output => {
	await mkdir(output, { recursive: true });
	if((await readdir(output)).length !== 0) throw new Error(`npm package output is not empty: ${output}`);
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
  [decodeURIComponent(mainWasm.pathname.split("/").at(-1))]: mainWasm.href,
  [decodeURIComponent(alphaWasm.pathname.split("/").at(-1))]: alphaWasm.href,
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

/**
 * Builds npm package from validated inputs with deterministic output suitable for the deterministic release and independent-verification pipeline.
 *
 * @param root0 - Named inputs and dependency overrides used to build npm package.
 * @param root0.bundleRoot - Filesystem root containing the bundle.
 * @param root0.outputRoot - Filesystem root containing the output.
 */
export const buildNpmPackage = async ({ bundleRoot, outputRoot }) => {
	const bundle = resolve(bundleRoot);
	const output = resolve(outputRoot);
	if(output === bundle || output === dirname(bundle)) throw new Error("refusing to replace the canonical bundle with an npm package");
	await ensureEmptyOutput(output);
	const { manifest, manifestSha256 } = await readVerifiedCanonicalBundle(bundle);
	const npm = manifest.packages.find(packageMapping => packageMapping.ecosystem === "npm");
	if(!npm?.eligible) throw new Error(`canonical bundle is not eligible for npm projection: ${npm?.reason ?? "mapping absent"}`);

	const packageRoot = join(output, "package");
	const copies = [
		["bindings/javascript/index.mjs", "index.mjs"]
		, ["bindings/javascript/index.d.ts", "index.d.ts"]
		, ["bindings/javascript/internal/validators.mjs", "internal/validators.mjs"]
		, ["bindings/javascript/README.md", "README.md"]
		, ["bindings/javascript/binding-manifest.json", "binding-manifest.json"]
		, ["artifacts/browser/runtime.mjs", "internal/wasm/main.mjs"]
		, ["artifacts/browser/runtime.wasm", "internal/wasm/main.wasm"]
		, ["artifacts/browser/alpha.so.wasm", "internal/wasm/alpha.so.wasm"]
		, ["runtime/javascript/alpha-descriptor.json", "internal/descriptor.json"]
		, ["runtime/javascript/poc/link-spike/loader.mjs", "internal/bridge/poc/link-spike/loader.mjs"]
		, ["runtime/javascript/src/runtime/pending-operations.mjs", "internal/bridge/src/runtime/pending-operations.mjs"]
		, ["runtime/javascript/src/runtime/callbacks.mjs", "internal/bridge/src/runtime/callbacks.mjs"]
		, ["runtime/javascript/src/runtime/weak-value-map.mjs", "internal/bridge/src/runtime/weak-value-map.mjs"]
		, ["runtime/javascript/src/binding-ir/canonical.mjs", "internal/bridge/src/binding-ir/canonical.mjs"]
		, ["runtime/javascript/src/binding-ir/contract.mjs", "internal/bridge/src/binding-ir/contract.mjs"]
		, ["runtime/javascript/src/binding-ir/sha256.mjs", "internal/bridge/src/binding-ir/sha256.mjs"]
		, ["LICENSE", "LICENSE"]
		, ["canonical-package.json", "metadata/canonical-package.json"]
		, ["canonical-package.sha256", "metadata/canonical-package.sha256"]
		, ["bundle-identity.json", "metadata/bundle-identity.json"]
		, ["metadata/assurance.json", "metadata/assurance.json"]
		, ["metadata/core-artifact-set.json", "metadata/core-artifact-set.json"]
		, ["metadata/sbom.spdx.json", "metadata/sbom.spdx.json"]
		, ["metadata/provenance.intoto.json", "metadata/provenance.intoto.json"]
	];
	for(const [source, destination] of copies) await copy(join(bundle, source), join(packageRoot, destination));
	await writeFile(join(packageRoot, "internal/runtime.mjs"), runtimeModule());

	const packageJson = {
		name: npm.name
		, version: npm.version
		, description: "Generated Lean bindings backed by one shared WebAssembly runtime."
		, license: manifest.licenses.expression
		, type: "module"
		, sideEffects: false
		, engines: { node: ">=22" }
		, types: "./index.d.ts"
		, exports: {
			".": {
				types: "./index.d.ts"
				, browser: "./index.mjs"
				, import: "./index.mjs"
				, default: "./index.mjs"
			}
		}
		, files: ["index.mjs", "index.d.ts", "README.md", "LICENSE", "binding-manifest.json", "internal", "metadata"]
		, leanBridge: {
			component: manifest.component.id
			, canonicalManifestSha256: manifestSha256
			, bindingIrSha256: manifest.bindingIr.semanticSha256
			, sharedRuntime: true
		}
	};
	await writeFile(join(packageRoot, "package.json"), json(packageJson));

	const coreArtifacts = copies.slice(5, 8).map(([sourcePath, packagePath]) => {
    const artifact = manifest.artifacts.find(candidate => candidate.path === sourcePath);
    if(!artifact) throw new Error(`canonical manifest does not inventory ${sourcePath}`);
    return {
      sourcePath
      , packagePath
      , sourceSha256: artifact.sha256
      , packageSha256: artifact.sha256
    };
	});
	const plan = {
		schemaVersion: 1
		, backend: "npm-v1"
		, ecosystem: "npm"
		, bundle: { id: manifest.component.id, manifestSha256 }
		, compilerAccess: false
		, scriptPolicy: "disabled"
		, versionSource: "canonical-manifest"
		, semanticSource: "canonical-manifest"
		, operations: ["select", "arrange", "copy", "rename", "render-registry-metadata", "archive", "compress"]
		, commands: ["internal-ustar package", "internal-gzip package.tar"]
		, coreArtifacts
	};
	validatePackagingBackendPlan(plan);
	await writeFile(join(output, "npm-projection.json"), json(plan));

	const archiveName = `${npm.name.replace(/^@/, "").replace("/", "-")}-${npm.version}.tgz`;
	const archive = await createDeterministicTarGz({
		directory: packageRoot
		, archiveRoot: "package"
		, sourceDateEpoch: manifest.provenance.sourceDateEpoch
	});
	await writeFile(join(output, archiveName), archive);
	return Object.freeze({
		package: `${npm.name}@${npm.version}`
		, output
		, archive: join(output, archiveName)
		, archiveSha256: sha256(archive)
		, canonicalManifestSha256: manifestSha256
		, coreArtifacts: Object.freeze(coreArtifacts)
	});
};
