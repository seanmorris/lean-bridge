/**
 * Reject out-of-bound top-level scalar Fin through the public API and the package-internal runtime.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, readFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { buildComponentNpmPackages } from "../../src/release/component-npm-package.mjs";
import { verifyComponentPackageReceipt } from "../../src/release/component-package-receipt.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";

const huge = "184467440737095516170";
// One fixture per private ABI: the ABI is selected by the export signatures, so each adds one shape that chooses it.
const common = ["mirror", "never", "one", "huge", "pair", "tenth", "mix"];
const abis = {
	scalar: { version: 2, names: common, extra: "" }
	, callable: { version: 3, names: [...common, "apply"], extra: "def apply (f : Nat → Nat) (value : Digit) : Nat := f value.val\n" }
	, copied: { version: 4, names: [...common, "count"], extra: "def count (rows : Array Nat) (value : Digit) : Nat := rows.size + value.val\n" }
	, record: { version: 5, names: [...common, "tag"], extra: "structure Plain where\n  value : String\ndef tag (plain : Plain) (value : Digit) : String := plain.value ++ toString value.val\n" }
	, compound: { version: 6, names: [...common, "orZero"], extra: "def orZero (value : Option Nat) (digit : Digit) : Nat := value.getD 0 + digit.val\n" }
	, nominal: { version: 7, names: [...common, "labelled"], extra: "abbrev Label := String\ndef labelled (label : Label) (value : Digit) : Label := label ++ toString value.val\n" }
};
export const scalarFinRejectionAbis = Object.freeze(Object.keys(abis));
const source = extra => `namespace OnboardingSmall
abbrev Digit := Fin 10
def mirror (value : Digit) : Digit := ⟨9 - value.val, by omega⟩
def never (value : Fin 0) : Nat := value.val
def one (value : Fin 1) : Nat := value.val
def huge (value : Fin ${huge}) : Nat := value.val
def pair (left : Digit) (right : Fin 4) : Nat := left.val * 4 + right.val
def tenth (value : Nat) : Digit := ⟨value % 10, Nat.mod_lt _ (by decide)⟩
abbrev Text := { value : String // value != "" }
def checkedText (value : String) : Option Text :=
  if valid : value != "" then some ⟨value, valid⟩ else none
def mix (text : Text) (digit : Digit) : String := text.val ++ toString digit.val
${extra}end OnboardingSmall
`;
const consumerSource = abi => `import assert from "node:assert/strict";
import * as api from "onboarding-small";
import { runtime } from "./node_modules/onboarding-small/internal/runtime.mjs";
const raw = (name, args) => runtime.call("lean:OnboardingSmall." + name, args);
const failure = ${JSON.stringify(abi === "scalar" ? "Component scalar call failed (6)" : abi === "callable" ? "Component callable call failed (6)" : "Component copied call failed (5)")};
let rejections = 0, checks = 0;
const check = (ok, label) => { if(!ok) throw new Error("failed: " + label); checks++; };
const rejected = (call, label, message) => {
  try { call(); } catch(error) { if(message && error.message !== message) throw new Error(label + ": " + error.message); rejections++; return; }
  throw new Error("accepted: " + label);
};
const cases = [
  ["mirror", [[0n, 9n], [3n, 6n], [9n, 0n]], [10n, 11n, 2n ** 70n, -1n]],
  ["never", [], [0n, 1n]],
  ["one", [[0n, 0n]], [1n, 2n]],
  ["huge", [[${huge}n - 1n, ${huge}n - 1n], [0n, 0n]], [${huge}n, ${huge}n + 1n, 2n ** 70n]]
];
for (const [name, valid, invalid] of cases) {
  for (const [input, expected] of valid) { check(api[name](input) === expected, name + " public " + input); check(raw(name, [input]) === expected, name + " raw " + input); }
  for (const bad of invalid) {
    rejected(() => api[name](bad), name + " public " + bad);
    rejected(() => raw(name, [bad]), name + " raw " + bad, bad < 0n ? undefined : failure);
    for (const [input, expected] of valid) check(raw(name, [input]) === expected, name + " recovers " + input);
  }
  for (const bad of [3, "3", null, undefined]) rejected(() => api[name](bad), name + " public " + String(bad));
}
// Result-only Fin never rejects an input; the source constructs the bound.
check(api.tenth(123n) === 3n && raw("tenth", [2n ** 70n]) === 4n, "tenth result only");
// Mixed Subtype and Fin: the Subtype validator runs first, then the Fin bound; a heap-backed String argument is released on either rejection.
check(api.mix("ab", 7n) === "ab7" && raw("mix", ["λ🙂", 0n]) === "λ🙂0", "mix valid");
rejected(() => raw("mix", ["", 7n]), "mix raw empty text", failure);
rejected(() => raw("mix", ["ab", 10n]), "mix raw late Fin", failure);
rejected(() => api.mix("", 7n), "mix public empty text");
rejected(() => api.mix("ab", 10n), "mix public late Fin");
for (let round = 0; round < 500; round++) {
  rejected(() => raw("mix", ["x".repeat(4096), 10n]), "mix cycle late Fin", failure);
  check(api.mix("x".repeat(4096), 9n).length === 4097, "mix cycle recovers");
}
// A later argument is rejected after an earlier one passed; the earlier bound is checked first.
check(api.pair(2n, 3n) === 11n && raw("pair", [2n, 3n]) === 11n, "pair valid");
rejected(() => raw("pair", [2n, 4n]), "pair raw late", failure);
rejected(() => raw("pair", [10n, 0n]), "pair raw early", failure);
rejected(() => raw("pair", [10n, 4n]), "pair raw both", failure);
rejected(() => api.pair(2n, 4n), "pair public late");
${abi === "callable" ? `let calls = 0;
const f = value => { calls++; return value + 100n; };
check(api.apply(f, 9n) === 109n && raw("apply", [f, 0n]) === 100n && calls === 2, "apply valid");
rejected(() => raw("apply", [f, 10n]), "apply raw", failure);
rejected(() => api.apply(f, 10n), "apply public");
check(calls === 2, "rejected calls never reach the host callback");` : ""}
${abi === "record" ? `check(api.tag({ value: "p" }, 9n) === "p9" && raw("tag", [{ value: "q" }, 0n]) === "q0", "tag valid");
rejected(() => raw("tag", [{ value: "p" }, 10n]), "tag raw", failure);
rejected(() => api.tag({ value: "p" }, 10n), "tag public");` : ""}
${abi === "compound" ? `check(api.orZero({ tag: "some", value: 5n }, 9n) === 14n && raw("orZero", [{ tag: "none" }, 1n]) === 1n, "orZero valid");
rejected(() => raw("orZero", [{ tag: "some", value: 5n }, 10n]), "orZero raw", failure);
rejected(() => api.orZero({ tag: "none" }, 10n), "orZero public");` : ""}
${abi === "nominal" ? `check(api.labelled("l", 9n) === "l9" && raw("labelled", ["m", 0n]) === "m0", "labelled valid");
rejected(() => raw("labelled", ["l", 10n]), "labelled raw", failure);
rejected(() => api.labelled("l", 10n), "labelled public");` : ""}
${abi === "copied" ? `check(api.count([1n, 2n], 9n) === 11n && raw("count", [[], 0n]) === 0n, "count valid");
rejected(() => raw("count", [[1n], 10n]), "count raw", failure);
rejected(() => api.count([1n], 10n), "count public");` : ""}
for (let round = 0; round < 1000; round++) {
  rejected(() => raw("mirror", [10n]), "cycle raw", failure);
  rejected(() => api.mirror(2n ** 70n), "cycle public");
  check(api.mirror(4n) === 5n && raw("mirror", [5n]) === 4n, "cycle recovers");
}
console.log(JSON.stringify({ abi: ${JSON.stringify(abi)}, checks, rejections }));
`;

/**
 * Build, install offline and run the scalar Fin rejection consumer for one private ABI.
 *
 * @param t - Test context.
 * @param options - Unlocked build helpers.
 * @param options.fixture - Creates a project copy.
 * @param options.build - Builds the canonical project for npm.
 * @param options.runtimeRoot - Prepared shared runtime root.
 * @param abi - One of scalar, callable or copied.
 */
export const checkScalarFinRejection = async (t, { fixture, build, runtimeRoot }, abi) => {
	const { version, names, extra } = abis[abi];
	const { directory, root } = await fixture(t);
	await saveLakeFile(root, "OnboardingSmall.lean", source(extra));
	const copy = { ownership: "copy", lifetime: null };
	const contracts = { "OnboardingSmall.mix": { parameters: [{ ...copy, refinement: { constructor: "OnboardingSmall.checkedText" } }, copy] } };
	await saveLakeFile(root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["OnboardingSmall"], exports: names.map(name => `OnboardingSmall.${name}`), contracts }));
	const moved = join(directory, "moved"), releases = [];
	await cp(root, moved, { recursive: true });
	for(const [index, projectRoot] of [root, moved].entries())
	{
		const before = await lakeInputState(projectRoot), outputRoot = join(directory, `build-${index}`);
		await build(projectRoot, outputRoot).catch(error => assert.fail(`${error.message}: ${JSON.stringify(error.details)}`));
		const bundleRoot = join(outputRoot, "bundle");
		const plan = JSON.parse(await readFile(join(bundleRoot, "locks/compiler-adapters.json"), "utf8"));
		assert.equal(plan.privateAbi.version, version);
		// Every refined scalar parameter exports a validator the adapter runs before dispatch.
		const lean = await readFile(join(bundleRoot, "generated/LeanBridgeGenerated.lean"), "utf8");
		let validators = 0;
		for(const item of plan.exports) for(const [position, refinement] of (item.refinements?.parameters ?? []).entries()) if(refinement)
		{
			assert.ok(["fin", "subtype"].includes(refinement.kind));
			const conversion = refinement.kind === "fin" ? `\\(if proof : \\(value\\) < ${refinement.bound} then` : "_root_\\.OnboardingSmall\\.checkedText value";
			assert.match(lean, new RegExp(`@\\[export ${item.symbol}_refinement_${position}\\]\\ndef ${item.wrapper}_refinement_${position} \\(value : _root_\\.(?:Nat|String)\\) : _root_\\.UInt8 :=\\n {2}match ${conversion}`, "u"));
			++validators;
		}
		assert.equal(validators, abi === "scalar" ? 8 : 9, "one validator per refined parameter: mirror, never, one, huge, pair x2, mix x2 and the ABI's own Fin");
		assert.ok(plan.exports.find(item => item.sourceDeclaration === "OnboardingSmall.tenth").refinements.parameters.every(item => item === null));
		releases.push(await buildComponentNpmPackages({ bundleRoot, runtimeRoot, outputRoot: join(directory, `npm-${index}`) }));
		await verifyComponentPackageReceipt({ receiptPath: join(releases[index].output, "component-package-receipt.json") });
		assert.deepEqual(await lakeInputState(projectRoot), before);
	}
	assert.deepEqual(releases[0].report, releases[1].report);
	const archiveSha256 = sha256(await readFile(releases[0].componentArchive));
	assert.equal(archiveSha256, sha256(await readFile(releases[1].componentArchive)));
	await rename(root, join(directory, "source-unavailable"));
	await rename(moved, join(directory, "moved-unavailable"));
	const consumer = join(directory, "consumer"); await mkdir(consumer);
	await saveLakeFile(consumer, "package.json", '{"private":true,"type":"module"}');
	await processBuildRunner.capture({ command: "npm", args: ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--cache", join(directory, "npm-cache"), releases[0].runtimeArchive, releases[0].componentArchive], cwd: consumer });
	await saveLakeFile(consumer, "index.mjs", consumerSource(abi));
	const run = await processBuildRunner.capture({ command: process.execPath, args: ["index.mjs"], cwd: consumer }).catch(error => assert.fail(`${error.message}: ${JSON.stringify(error.details)}`));
	assert.equal(run.stderr, "", "no Lean panic or other diagnostic reaches stderr");
	const result = JSON.parse(run.stdout.trim());
	assert.equal(result.abi, abi);
	return { abi, privateAbi: version, archiveSha256, runtimeArchiveSha256: sha256(await readFile(releases[0].runtimeArchive)), ...result };
};
