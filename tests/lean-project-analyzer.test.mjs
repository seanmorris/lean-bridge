import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { analyzeLeanProject } from "../src/analyze/lean-project.mjs";
import { hashBindingIr, parseBindingIr } from "../src/binding-ir/canonical.mjs";
import { validateBindingIr } from "../src/binding-ir/contract.mjs";
import { cliHandlers } from "../src/cli/commands.mjs";
import { runCli } from "../src/cli/run.mjs";

const sha256 = value => createHash("sha256").update(value).digest("hex");

const snapshot = async root => {
  const names = (await readdir(root)).sort();
  const entries = [];
  for (const name of names) {
    const bytes = await readFile(join(root, name));
    entries.push({ name, sha256: sha256(bytes) });
  }
  return entries;
};

const makePureProject = async () => {
  const root = await mkdtemp(join(tmpdir(), "lean-bridge-analyze-pure-"));
  await writeFile(join(root, "lakefile.toml"), 'name = "sample"\nversion = "1.2.3"\n');
  await writeFile(join(root, "lean-toolchain"), "leanprover/lean4:v4.32.2\n");
  await writeFile(join(root, "Main.lean"), `namespace Sample.Api

/-- Cap a natural number at a limit. -/
def cap (limit value : Nat) : Nat := Nat.min limit value

/-- Check copied strings, bytes, options, and arrays without serializing them. -/
def acceptsRichPrimitives (name : String) (data : ByteArray) (limit : Option Nat) (samples : Array UInt32) : Bool :=
  !name.isEmpty && data.size > 0 && limit.isSome && samples.size > 0

/-- The result never exceeds the limit. -/
theorem cap_le_limit (limit value : Nat) : cap limit value ≤ limit := by simp [cap]

end Sample.Api
`);
  return root;
};

test("analysis infers a deterministic copied-value Binding IR without changing the project", async () => {
  const root = await makePureProject();
  try {
    const before = await snapshot(root);
    const first = await analyzeLeanProject(root);
    const second = await analyzeLeanProject(root);
    assert.deepEqual(first, second);
    assert.deepEqual(await snapshot(root), before);
    assert.equal(first.readOnly, true);
    assert.equal(first.project.root, ".");
    assert.equal(first.bindingIr.origin, "statically-inferred");
    assert.doesNotThrow(() => validateBindingIr(first.bindingIr.document));
    assert.deepEqual(first.proposedExports, ["lean:Sample.Api.acceptsRichPrimitives", "lean:Sample.Api.cap"]);

    const cap = first.exportCandidates.find(item => item.declaration === "Sample.Api.cap");
    assert.equal(cap.status, "exportable");
    assert.deepEqual(cap.theoremCandidates, ["Sample.Api.cap_le_limit"]);
    const rich = first.bindingIr.document.declarations.find(item => item.name === "acceptsRichPrimitives");
    assert.deepEqual(rich.parameters.map(item => item.type), [
      { kind: "primitive", name: "string" },
      { kind: "primitive", name: "bytes" },
      { kind: "apply", constructor: "option", arguments: [{ kind: "primitive", name: "nat" }] },
      { kind: "apply", constructor: "array", arguments: [{ kind: "primitive", name: "uint32" }] },
    ]);
    assert.ok(rich.parameters.every(item => item.ownership === "copy" && item.lifetime === null));
    const assurance = first.bindingIr.document.assurance.find(item => item.subject === "lean:Sample.Api.cap");
    assert.equal(assurance.state, "unverified");
    assert.match(assurance.assumptions[0], /does not replace Lean elaboration/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("analysis blocks foreign, effectful, and unknown representations without inventing ownership", async () => {
  const root = await mkdtemp(join(tmpdir(), "lean-bridge-analyze-blocked-"));
  try {
    await writeFile(join(root, "Main.lean"), `@[extern "foreign_box"] opaque foreignBox (value : Nat) : Nat
def fetch (path : String) : IO String := pure path
structure Secret where value : Nat
def expose (secret : Secret) : Nat := secret.value
`);
    const report = await analyzeLeanProject(root);
    assert.equal(report.bindingIr, null);
    assert.deepEqual(report.exportCandidates.map(item => [item.declaration, item.reasons]), [
      ["expose", ["unsupported-parameter-type"]],
      ["fetch", ["effect-adapter-required"]],
      ["foreignBox", ["foreign-contract-required"]],
    ]);
    assert.deepEqual(report.adapterHints.map(item => [item.declaration, item.choices]), [
      ["expose", ["exclude", "provide-adapter"]],
      ["fetch", ["exclude", "provide-adapter"]],
      ["foreignBox", ["exclude", "provide-foreign-contract"]],
    ]);
    assert.equal(JSON.stringify(report).includes('"ownership":"borrow"'), false);
    assert.ok(report.diagnostics.some(item => item.code === "binding-ir-unavailable"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("analysis correlates Lake compiled interface metadata without trusting it as proof", async () => {
  const root = await makePureProject();
  try {
    const metadataRoot = join(root, ".lake", "build", "lib", "lean");
    await mkdir(metadataRoot, { recursive: true });
    await writeFile(join(metadataRoot, "Main.ilean"), JSON.stringify({
      version: 5,
      module: "Main",
      directImports: [["Init", false, false, false]],
      decls: {
        "Sample.Api.acceptsRichPrimitives": [6, 0, 7, 76, 7, 4, 7, 25],
        "Sample.Api.cap": [3, 0, 4, 67, 4, 4, 4, 7],
        "Sample.Api.cap_le_limit": [9, 0, 10, 90, 10, 8, 10, 20],
      },
      references: {},
    }));
    const report = await analyzeLeanProject(root);
    assert.equal(report.compiledEnvironment.status, "available");
    assert.deepEqual(report.compiledEnvironment.modules[0].directImports, ["Init"]);
    assert.ok(report.exportCandidates.every(item => item.evidence.includes("compiled-interface:present")));
    assert.ok(report.declarations.every(item => item.compiled));
    assert.ok(report.bindingIr.document.assurance.every(item => item.state === "unverified"));
    assert.match(report.compiledEnvironment.note, /reject stale metadata/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("analysis defers namespace collisions instead of flattening them into one host name", async () => {
  const root = await mkdtemp(join(tmpdir(), "lean-bridge-analyze-namespaces-"));
  try {
    await writeFile(join(root, "Main.lean"), `namespace One
def cap (value : Nat) : Nat := value
end One
namespace Two
def cap (value : Nat) : Nat := value
end Two
`);
    const report = await analyzeLeanProject(root);
    assert.deepEqual(report.exportCandidates.map(item => [item.declaration, item.reasons]), [
      ["One.cap", ["public-name-collision"]],
      ["Two.cap", ["public-name-collision"]],
    ]);
    assert.equal(report.bindingIr, null);
    assert.ok(report.adapterHints.every(item => item.choices[0] === "qualify-with-namespace"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("analysis treats one existing Binding IR as the explicit component boundary", async () => {
  const report = await analyzeLeanProject(process.cwd());
  const path = "poc/lean-link-spike/bindings/alpha.binding-ir.json";
  const document = parseBindingIr(await readFile(path, "utf8"));
  assert.equal(report.bindingIr.origin, "existing-validated");
  assert.equal(report.bindingIr.path, path);
  assert.equal(report.bindingIr.semanticSha256, hashBindingIr(document));
  assert.deepEqual(report.adapterHints, []);
});

test("the published analysis schema closes the report and adapter questions", async () => {
  const schema = JSON.parse(await readFile("schema/project-analysis.schema.json", "utf8"));
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.project.additionalProperties, false);
  assert.equal(schema.$defs.candidate.additionalProperties, false);
  assert.equal(schema.$defs.hint.additionalProperties, false);
  assert.equal(schema.properties.bindingIr.oneOf[1].properties.document.$ref, "binding-ir.schema.json");
});

test("CLI analyze returns a complete report or minimal adapter questions", async () => {
  const pure = await makePureProject();
  const blocked = await mkdtemp(join(tmpdir(), "lean-bridge-analyze-cli-"));
  try {
    await writeFile(join(blocked, "Main.lean"), "def fetch (path : String) : IO String := pure path\n");
    const accepted = await runCli({ argv: ["analyze", "--project", pure, "--json"], handlers: cliHandlers });
    assert.equal(accepted.exitCode, 0);
    assert.equal(accepted.response.status, "ok");
    assert.equal(accepted.response.result.bindingIr.origin, "statically-inferred");

    const deferred = await runCli({ argv: ["analyze", "--project", blocked, "--json"], handlers: cliHandlers });
    assert.equal(deferred.exitCode, 2);
    assert.equal(deferred.response.status, "needs-input");
    assert.deepEqual(deferred.response.result.adapterHints[0].choices, ["exclude", "provide-adapter"]);
    assert.match(deferred.response.nextActions[0], /^fetch:/);
  } finally {
    await rm(pure, { recursive: true, force: true });
    await rm(blocked, { recursive: true, force: true });
  }
});
