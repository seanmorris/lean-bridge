import { hashBindingIr } from "../../binding-ir/canonical.mjs";

export class RustPackageAuditError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "RustPackageAuditError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

const fail = (code, message, details = {}) => {
  throw new RustPackageAuditError(code, message, details);
};

export const auditRustPackage = (ir, files) => {
  let manifest;
  try {
    manifest = JSON.parse(files["binding-manifest.json"]);
  } catch {
    fail("invalid-manifest", "the generated Rust binding manifest is missing or invalid");
  }
  if (manifest.bindingIrSha256 !== hashBindingIr(ir)) {
    fail("binding-ir-drift", "the generated Rust package names the wrong Binding IR hash", {
      expected: hashBindingIr(ir),
      actual: manifest.bindingIrSha256,
    });
  }
  for (const path of manifest.files ?? []) {
    if (typeof files[path] !== "string") {
      fail("missing-file", `the generated Rust package is missing ${path}`, { path });
    }
  }
  const source = files[manifest.publicModule];
  if (typeof source !== "string") fail("missing-public-module", "the Rust crate has no public module");
  if (/\b(?:ccall|cwrap|WebAssembly|_bridge_)\b/i.test(source)) {
    fail("private-abi-leak", "the Rust module exposes private bridge machinery");
  }
  if (/pub\s+(?:fn|struct|type|trait)\s+(?:invoke|dispatch|handle|token)\b/i.test(source)) {
    fail("generic-dispatch", "the Rust public surface exposes a dispatcher or identity token");
  }
  if (!Array.isArray(manifest.capabilityGaps)) {
    fail("missing-capability-gaps", "the Rust manifest does not declare its capability gaps");
  }
  return Object.freeze({
    bindingIrSha256: manifest.bindingIrSha256,
    exports: Object.freeze([...(manifest.exports ?? [])]),
    capabilityGaps: Object.freeze(structuredClone(manifest.capabilityGaps)),
  });
};
