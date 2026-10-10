/**
 * Fresh Lean refusals for unsupported native nominal refinement boundaries.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { nativeFixtureEnvironment } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const tree = "inductive Tree where\n  | leaf (digit : Fin 5)\n  | branch (children : List Tree)\n";
const graphProblem = "checked Fin refinements cannot share a component with copied graph exports";
const cases = [
	["genericSite", "structure Holder (α : Type) where\n  digit : Fin 5\n  value : α\nabbrev NatHolder := Holder Nat\ndef genericSite (value : NatHolder) : Nat := value.digit.val", "generic record instantiations"]
	, ["recursiveSite", tree + "def recursiveSite (value : Tree) : Nat := match value with\n  | .leaf digit => digit.val\n  | .branch children => children.length", graphProblem]
	, ["recursiveResult", tree + "def recursiveResult (value : Nat) : Tree := .leaf ⟨value % 5, Nat.mod_lt _ (by decide)⟩", graphProblem]
	, ["wrappedSite", tree + "abbrev Forest := Array Tree\ndef wrappedSite (value : Option Forest) : Nat := value.map Array.size |>.getD 0", graphProblem]
	, ["callbackRecordSite", "structure CallbackRecord where\n  digit : Fin 5\n  callback : Nat → Nat\ndef callbackRecordSite (value : CallbackRecord) : Nat := value.callback value.digit.val", "callback"]
];

test("native extractor diagnoses refined graphs before reporting a supported signature", async () => {
	const source = await readFile("src/analyze/NativeExports.lean", "utf8");
	const signature = source.slice(source.indexOf("def describeSignature"), source.indexOf("def diagnostic"));
	assert.match(signature, /if native && sites\.any \(fun site => containsKind #\[\] site "graph"\) && sites\.any containsRefinement then/u);
	assert.ok(signature.indexOf(`throwError "${graphProblem}"`) < signature.indexOf('("status", str "supported")'));
	assert.match(signature, /catch error =>[\s\S]*unsupported reason/u);
});

test("fresh native builds retain declaration-specific generic, recursive and callback record refusals", {
	skip: process.env.LEAN_BRIDGE_NATIVE_FIN_TEST !== "1", timeout: 900000
}, async t => {
	for(const [name, body, problem] of cases) await t.test(name, async () => {
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-fin-nominal-refusal-"));
		try
		{
			const projectRoot = join(directory, "project"), outputRoot = join(directory, "release");
			await cp("tests/fixtures/onboarding/native-fin", projectRoot, { recursive: true });
			await saveLakeFile(projectRoot, "NativeFin.lean", `namespace NativeFin\n${body}\nend NativeFin\n`);
			const declaration = `NativeFin.${name}`;
			await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
				, modules: ["NativeFin"], exports: [declaration]
				, targets: { c: { name: "finrefusal", version: "1.0.0" } } }));
			await assert.rejects(() => buildCanonicalProject({ projectRoot, outputRoot, targets: ["c"], environment: nativeFixtureEnvironment(["c"]) }), error => {
				assert.equal(error.code, "native-elaboration-unsupported");
				const projection = error.details.projections.find(item => item.declaration === declaration);
				assert.equal(projection?.status, "unsupported");
				assert.equal(projection.reason, "unsupported-native-type");
				assert.equal(projection.source.path, "NativeFin.lean");
				assert.equal(projection.source.startLine, body.split("\n").findIndex(line => line.startsWith(`def ${name} `)) + 2);
				assert.equal(projection.source.startColumn, 0);
				assert.ok(projection.expression.includes(problem), projection.expression);
				assert.ok(error.details.diagnostics.some(item => item.declaration === declaration && item.severity === "error"));
				return true;
			});
			await assert.rejects(access(outputRoot), { code: "ENOENT" });
		}
		finally
		{ await rm(directory, { recursive: true, force: true }); }
	});
});
