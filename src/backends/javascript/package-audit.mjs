import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { validateBindingIr } from "../../binding-ir/contract.mjs";

export class JavaScriptPackageAuditError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "JavaScriptPackageAuditError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

const fail = (code, message, details = {}) => {
  throw new JavaScriptPackageAuditError(code, message, details);
};

const parseJson = (source, file) => {
  try {
    return JSON.parse(source);
  } catch (cause) {
    fail("invalid-generated-json", `${file} is not valid JSON`, {
      file,
      cause: cause.message,
    });
  }
};

const sorted = values =>
  [...values].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));

const expectedValueExports = ir => [
  ...new Set([
    ...ir.errors.filter(error => error.category !== "boundary").map(error => error.name),
    ...ir.types.filter(type => type.kind === "resource").map(type => type.name),
    ...ir.declarations
      .filter(declaration => declaration.kind === "function")
      .map(declaration => declaration.name),
  ]),
];

const requireFile = (files, path) => {
  if (typeof files[path] !== "string") {
    fail("missing-generated-file", `generated JavaScript package is missing ${path}`, {
      path,
    });
  }
  return files[path];
};

const forbid = (source, file, patterns) => {
  for (const { code, expression, label } of patterns) {
    const match = expression.exec(source);
    if (match) {
      fail(code, `${file} exposes ${label}`, {
        file,
        match: match[0],
        offset: match.index,
      });
    }
  }
};

const LOW_LEVEL_SURFACE = Object.freeze([
  Object.freeze({ code: "raw-dispatch-leak", expression: /\bccall\b/i, label: "ccall" }),
  Object.freeze({ code: "raw-dispatch-leak", expression: /\bcwrap\b/i, label: "cwrap" }),
  Object.freeze({
    code: "raw-webassembly-leak",
    expression: /\bWebAssembly\b/,
    label: "a WebAssembly object",
  }),
  Object.freeze({
    code: "raw-symbol-leak",
    expression: /\b_bridge_[A-Za-z0-9_]*\b/,
    label: "a private ABI symbol",
  }),
]);

const LOW_LEVEL_TYPES = Object.freeze([
  ...LOW_LEVEL_SURFACE,
  Object.freeze({ code: "untyped-public-api", expression: /\bany\b/, label: "public any" }),
  Object.freeze({
    code: "raw-handle-leak",
    expression: /\b(?:pointer|handle|ownershipFlag|signatureId)\b/i,
    label: "raw ABI state",
  }),
]);

const namedRuntimeExports = source => {
  const names = [];
  const expression = /\bexport\s+(?:async\s+)?(?:class|function|const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
  for (const match of source.matchAll(expression)) names.push(match[1]);
  return names;
};

const assertGeneratedEntry = (ir, source, expectedExports) => {
  const marker = `// Generated from Binding IR SHA-256 ${hashBindingIr(ir)}.`;
  if (!source.startsWith(marker)) {
    fail(
      "manual-entry-layer",
      "index.mjs does not identify the exact Binding IR that generated it",
      { expectedMarker: marker },
    );
  }
  const actual = namedRuntimeExports(source);
  if (JSON.stringify(actual) !== JSON.stringify(expectedExports)) {
    fail("public-export-drift", "index.mjs exports do not match Binding IR", {
      expected: expectedExports,
      actual,
    });
  }
  if (actual.some(name => name.startsWith("_"))) {
    fail("private-name-leak", "index.mjs exports an underscore-prefixed name", {
      exports: actual,
    });
  }
};

const assertManifest = (ir, files, source, expectedExports) => {
  const manifest = parseJson(source, "binding-manifest.json");
  if (
    manifest.schemaVersion !== 1 ||
    manifest.component !== ir.component.id ||
    manifest.bindingIrSha256 !== hashBindingIr(ir)
  ) {
    fail("manifest-identity-drift", "binding manifest does not identify its source IR", {
      component: manifest.component,
      bindingIrSha256: manifest.bindingIrSha256,
    });
  }
  if (JSON.stringify(manifest.exports) !== JSON.stringify(expectedExports)) {
    fail("public-export-drift", "binding manifest exports do not match Binding IR", {
      expected: expectedExports,
      actual: manifest.exports,
    });
  }
  const generatedFiles = sorted(Object.keys(files));
  if (JSON.stringify(sorted(manifest.files ?? [])) !== JSON.stringify(generatedFiles)) {
    fail("manifest-file-drift", "binding manifest does not list the generated file set", {
      expected: generatedFiles,
      actual: sorted(manifest.files ?? []),
    });
  }
  if (JSON.stringify(manifest.requiredInternalFiles) !== JSON.stringify(["internal/runtime.mjs"])) {
    fail("runtime-boundary-drift", "binding manifest changed the private runtime boundary", {
      actual: manifest.requiredInternalFiles,
    });
  }
  if (manifest.generator?.id !== "lean-wasm/javascript" || manifest.generator?.version !== 1) {
    fail("generator-identity-drift", "binding manifest has no supported generator identity", {
      actual: manifest.generator,
    });
  }
};

const assertPackageExports = source => {
  const manifest = parseJson(source, "package.json");
  const root = manifest.exports?.["."];
  if (
    manifest.type !== "module" ||
    manifest.sideEffects !== false ||
    manifest.types !== "./index.d.ts" ||
    Object.keys(manifest.exports ?? {}).length !== 1 ||
    root?.types !== "./index.d.ts" ||
    root?.import !== "./index.mjs" ||
    root?.default !== "./index.mjs"
  ) {
    fail(
      "package-export-drift",
      "package.json must expose one typed root entry and no internal subpaths",
      { exports: manifest.exports },
    );
  }
  if (!Array.isArray(manifest.files) || !manifest.files.includes("internal")) {
    fail("missing-runtime-files", "package.json does not include its private runtime files", {
      files: manifest.files,
    });
  }
};

export const auditJavaScriptPackage = (ir, files) => {
  validateBindingIr(ir);
  if (files === null || typeof files !== "object" || Array.isArray(files)) {
    fail("invalid-generated-package", "generated JavaScript package must be a file map");
  }
  const entry = requireFile(files, "index.mjs");
  const types = requireFile(files, "index.d.ts");
  const documentation = requireFile(files, "README.md");
  const bindingManifest = requireFile(files, "binding-manifest.json");
  const packageManifest = requireFile(files, "package.json");
  requireFile(files, "internal/validators.mjs");

  const expectedExports = expectedValueExports(ir);
  assertGeneratedEntry(ir, entry, expectedExports);
  assertManifest(ir, files, bindingManifest, expectedExports);
  assertPackageExports(packageManifest);

  forbid(entry, "index.mjs", LOW_LEVEL_SURFACE);
  forbid(types, "index.d.ts", LOW_LEVEL_TYPES);
  forbid(documentation, "README.md", LOW_LEVEL_SURFACE);
  forbid(bindingManifest, "binding-manifest.json", LOW_LEVEL_SURFACE);
  forbid(packageManifest, "package.json", LOW_LEVEL_SURFACE);

  return Object.freeze({
    schemaVersion: 1,
    bindingIrSha256: hashBindingIr(ir),
    exports: Object.freeze([...expectedExports]),
    publicEntry: ".",
    privateSubpaths: Object.freeze([]),
  });
};
