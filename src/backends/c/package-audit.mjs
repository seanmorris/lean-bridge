import { hashBindingIr } from "../../binding-ir/canonical.mjs";

export class CPackageAuditError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "CPackageAuditError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

const fail = (code, message, details = {}) => {
  throw new CPackageAuditError(code, message, details);
};

export const auditCPackage = (ir, files) => {
  const manifestText = files["binding-manifest.json"];
  if (typeof manifestText !== "string") {
    fail("missing-manifest", "the generated C package has no binding manifest");
  }
  let manifest;
  try {
    manifest = JSON.parse(manifestText);
  } catch {
    fail("invalid-manifest", "the generated C binding manifest is not valid JSON");
  }
  if (manifest.bindingIrSha256 !== hashBindingIr(ir)) {
    fail("binding-ir-drift", "the generated C package names the wrong Binding IR hash", {
      expected: hashBindingIr(ir),
      actual: manifest.bindingIrSha256,
    });
  }
  for (const path of manifest.files ?? []) {
    if (typeof files[path] !== "string") {
      fail("missing-file", `the generated C package is missing ${path}`, { path });
    }
  }
  const header = files[manifest.publicHeader];
  if (typeof header !== "string") {
    fail("missing-public-header", "the generated C package has no public header");
  }
  const forbidden = [
    ["generic-dispatch", /\b(?:ccall|cwrap|invoke|dispatch)\b/i],
    ["private-symbol", /_bridge_|WebAssembly/i],
    ["raw-handle", /\b(?:uintptr_t|handle|token)\b/i],
  ];
  for (const [code, pattern] of forbidden) {
    if (pattern.test(header)) {
      fail(code, `the public C header exposes ${code.replaceAll("-", " ")}`, {
        publicHeader: manifest.publicHeader,
      });
    }
  }
  const source = files[manifest.implementation];
  if (/\b(?:ccall|cwrap)\b/i.test(source)) {
    fail("generic-dispatch", "the generated C implementation contains a generic dispatcher");
  }
  return Object.freeze({
    bindingIrSha256: manifest.bindingIrSha256,
    exports: Object.freeze([...(manifest.exports ?? [])]),
    publicHeader: manifest.publicHeader,
  });
};
