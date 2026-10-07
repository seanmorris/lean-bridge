/**
 * Promote only the recorded reviewed Fin scalar/container hosts and npm/browser sites.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { reviewedFinNativeProfiles, reviewedFinNpmProfiles, reviewedFinPromotionReferences } from "../tests/helpers/reviewed-fin-promotion-references.mjs";

const path = "docs/type-surface.v1.json", inventory = JSON.parse(await readFile(path, "utf8"));
const references = await reviewedFinPromotionReferences();
assert.equal(references.length, 19);
const common = ["src/analyze/NativeExports.lean"
	, "src/analyze/reviewed-refinements.mjs"
	, "src/analyze/reviewed-source.mjs", "src/abi/refinements.mjs"
	, "tests/helpers/reviewed-fin-promotion-references.mjs"
	, "tests/helpers/reviewed-fin-promotion-tests.mjs"];
const native = ["src/build/native-model.mjs", "src/backends/c/native-copied-values.mjs"];
const npm = ["src/build/component-refinements.mjs"
	, "src/build/component-scalar-adapters.mjs"
	, "src/build/component-copied-adapters.mjs"
	, "tests/fixtures/onboarding/reviewed-fin-wasm/ReviewedFin.lean"
	, "tests/fixtures/reviewed-fin-wasm/javascript.mjs"
	, "tests/helpers/reviewed-fin-wasm-fixture.mjs"
	, "tests/helpers/reviewed-fin-wasm-install.mjs"
	, "tests/helpers/reviewed-fin-wasm-browser.mjs"];
for(const reference of references)
{
	assert.ok(!inventory.evidence.some(item => item.id === reference.id), `Already promoted: ${reference.id}`);
	const fixture = reference.kind === "scalar" ? "native-fin/NativeFin.lean" : "native-fin-containers/FinContainers.lean";
	const selected = reference.npm ? npm : [...native, `tests/fixtures/onboarding/${fixture}`, reference.kind === "scalar" ? "tests/helpers/reviewed-scalar-host-fixture.mjs" : "tests/helpers/reviewed-fin-container-fixture.mjs"];
	const files = [...new Set([...common, ...selected, reference.validator, reference.receiptPath, reference.reportPath])];
	const scope = reference.npm
		? `${reference.sourcePath} ${reference.kind} Fin: Node JavaScript, strict TypeScript and Chromium/Firefox/WebKit page, React production/strict lifecycle and worker consumers. Two independent builds and source-free offline installation. Boundary rejections and recovery are executed; source counters are unmeasured.`
		: `Reviewed ${reference.kind} Fin in ${reference.profiles.join(", ")}. Original local glibc 2.36 packages reproduce from two author roots and run after source removal. Each report retains its observed or unobserved dispatch status; no hosted CI, nominal-field, callback, product, Except or Subtype coverage is inferred.`;
	inventory.evidence.push({ id: reference.id, kind: "installed"
		, revision: reference.revision, command: reference.command, scope
		, files: await Promise.all(files.map(async path => ({ path, sha256: sha256(await readFile(path)) })))
		, artifacts: reference.artifacts.map(item => ({ ...item, path: `${reference.id}/${item.path}` })) });
}

const stageNotes = {
	analysis: "Independent reviewed constraints reconcile with fresh Lean metadata at the exact parameter and result sites."
	, generation: "Generated host values retain the closed bound beside their Nat transport; constraints are not replaced with unchecked integers."
	, compilation: "Compiled adapters check incoming bounds before constructing the Fin value; host-specific dispatch observations remain in the reports."
	, packaging: "Two independent author roots reproduce the original archives, verified before offline installation."
	, installedExecution: "Source-free installed consumers execute valid endpoints, invalid inputs and recovery. Only the named host, source route and parameter/result positions are promoted."
};
const observation = (id, profiles, evidence, hostTypes, npm = false) => ({
	id, profiles, shapes: ["fin"], positions: ["parameter", "result"]
	, path: "reviewed-ir"
	, scope: npm ? "Reviewed npm scalar and Array/List/Option/pair/Except parameter and result signatures execute in Node JavaScript/strict TypeScript and all three browser engines through page, React and worker consumers."
		: "Reviewed scalar and Array/List/Option/alias parameter and result signatures execute in the named native consumer, with exact bounds, invalid inputs and recovery."
	, hostTypes
	, stages: Object.fromEntries(inventory.stages.map(stage => [stage, { state: "passed", evidence, note: stageNotes[stage] }]))
	, limitations: npm ? ["Chromium, Firefox and WebKit only; nominal-field, callback, Subtype and PHP-Wasm positions are not covered by these reports.", "Scalar ABI 2 and structural ABI 6 are separate executions; their rejection statuses are 6 and 5 respectively.", "Public and raw boundary rejection is executed, but source-dispatch counters are not measured."]
		: ["Only Fin parameters/results, scalar or inside Array/List/Option and transparent aliases. No nominal-field, callback, product, Except, Subtype or PHP-Wasm promotion.", "Local glibc 2.36 acceptance is separate from release-floor and integrated hosted CI.", profiles[0] === "perl" ? "Perl 5.36.3 and 5.38.2, threaded and unthreaded, each execute scalar and container consumers. Ordinary-source acceptance is not inferred." : "Runtime floors and measured dispatch remain exactly those in each linked report; one host does not inherit another host's counters."]
	, conversionNotes: { fin: npm ? "Use bigint leaves with the declared closed bound. Public JavaScript and raw compiled adapters reject invalid inputs, and later valid calls remain usable."
		: "Use the host's Nat representation and the declared closed bound. Container carriers retain their element constraints; absent values are valid for Fin 0 but present Fin 0 values are rejected." }
});
for(const profile of reviewedFinNativeProfiles)
{
	const selected = references.filter(item => !item.npm && item.profiles.includes(profile));
	assert.ok(selected.some(item => item.kind === "scalar") && selected.some(item => item.kind === "containers"), profile);
	const ordinary = inventory.observations.find(item => item.path === "ordinary-source" && item.profiles.includes(profile) && item.shapes.includes("fin") && item.positions.includes("parameter"));
	const hostTypes = ordinary?.hostTypes ?? { fin: { parameter: "Math::BigInt checked against the declared bound", result: "Math::BigInt below the bound" } };
	inventory.observations.push(observation(`reviewed-fin-${profile}-scalar-containers`, [profile], selected.map(item => item.id), hostTypes));
}
const reviewedNpm = references.filter(item => item.npm && item.sourcePath === "reviewed-ir");
assert.equal(reviewedNpm.length, 2);
const npmOrdinary = inventory.observations.find(item => item.id === "npm-fin-refinements-ordinary-source");
inventory.observations.push(observation("reviewed-fin-npm-scalar-structural", [...reviewedFinNpmProfiles], reviewedNpm.map(item => item.id), npmOrdinary.hostTypes, true));
for(const id of ["npm-fin-refinements-ordinary-source", "npm-browser-fin-ordinary-source"])
{
	const existing = inventory.observations.find(item => item.id === id);
	const evidence = references.filter(item => item.npm && item.sourcePath === "ordinary-source").map(item => item.id);
	for(const stage of Object.values(existing.stages)) stage.evidence.push(...evidence);
}
await writeFile(path, JSON.stringify(inventory, null, 2) + "\n");
process.stdout.write(`Promoted ${references.length} archived bundles into ten reviewed Fin observations; retained ordinary npm claims with supplemental evidence.\n`);
