import { hashBindingIr } from "../../binding-ir/canonical.mjs";

export class ManagedPackageAuditError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ManagedPackageAuditError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

const fail = (code, message, details = {}) => {
  throw new ManagedPackageAuditError(code, message, details);
};

const forbiddenPublic = Object.freeze({
  dotnet: /\b(?:IntPtr|nint|LibraryImport|DllImport|NativeLibrary|unsafe|void\*)\b|generic\s+dispatch/i,
  jvm: /\b(?:MemorySegment|MemoryLayout|Linker|SymbolLookup|Arena|JNI)\b|generic\s+dispatch/i,
  ruby: /\b(?:Fiddle|dlopen|Pointer|Closure)\b|generic\s+dispatch/i,
});

export const auditManagedBindingPackage = (ir, files, target) => {
  const manifestText = files["binding-manifest.json"];
  if (typeof manifestText !== "string") fail("missing-manifest", `the generated ${target} package has no binding manifest`);
  let manifest;
  try {
    manifest = JSON.parse(manifestText);
  } catch {
    fail("invalid-manifest", `the generated ${target} binding manifest is not valid JSON`);
  }
  if (manifest.bindingIrSha256 !== hashBindingIr(ir) || manifest.target !== target) {
    fail("binding-ir-drift", `the generated ${target} package identity differs from its Binding IR`);
  }
  const expected = new Set(manifest.files ?? []);
  if (expected.size !== manifest.files?.length) fail("duplicate-file", `the generated ${target} manifest repeats a file`);
  for (const path of expected) {
    if (typeof files[path] !== "string") fail("missing-file", `the generated ${target} package is missing ${path}`, { path });
  }
  for (const path of manifest.publicFiles ?? []) {
    const source = files[path];
    if (typeof source !== "string") fail("missing-public-file", `the generated ${target} package is missing public source ${path}`);
    if (forbiddenPublic[target].test(source)) fail("private-ffi-public", `${path} exposes private ${target} FFI terms`);
  }
  if (!Array.isArray(manifest.capabilityGaps) || manifest.capabilityGaps.length === 0) {
    fail("missing-capability-report", `the generated ${target} package has no closed capability report`);
  }
  if (!manifest.supportedFeatures?.includes("direct-functions") || !manifest.supportedFeatures?.includes("deterministic-close")) {
    fail("missing-managed-semantics", `the generated ${target} package omits required public semantics`);
  }
  return Object.freeze({
    bindingIrSha256: manifest.bindingIrSha256,
    publicFiles: Object.freeze([...manifest.publicFiles]),
    capabilityGaps: Object.freeze(manifest.capabilityGaps.map(gap => Object.freeze({ ...gap }))),
  });
};
