/**
 * Add the eighteen observed callback-Fin cells without inferring other directions or consumers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { callbackFinPromotionReferences } from "../tests/helpers/callback-fin-promotion-references.mjs";

const path = "docs/type-surface.v1.json", inventory = JSON.parse(await readFile(path, "utf8"));
const references = await callbackFinPromotionReferences();
assert.ok(process.argv.slice(2).every(argument => argument === "--refresh"), "Only --refresh is accepted");
// Refresh only this promotion's exact suffix while preparing its uncommitted source ledger.
if(process.argv.includes("--refresh"))
{
	assert.deepEqual(inventory.evidence.slice(-5).map(item => item.id), references.map(item => item.id));
	assert.deepEqual(inventory.observations.slice(-9).map(item => item.id), [
		"c-ordinary-source", "cpp-ordinary-source"
		, "browser-javascript-ordinary-source", "browser-react-ordinary-source"
		, "browser-worker-ordinary-source", "c-reviewed-ir", "cpp-reviewed-ir"
		, "node-javascript-reviewed-ir", "node-typescript-reviewed-ir"
	].map(id => `callback-fin-${id}`));
	inventory.evidence.splice(-5); inventory.observations.splice(-9);
}
for(const reference of references)
{
	assert.ok(!inventory.evidence.some(item => item.id === reference.id), reference.id);
	const paths = ["tests/helpers/callback-fin-promotion-references.mjs", ...reference.validators, ...reference.files.map(file => file.path)];
	inventory.evidence.push({ id: reference.id, kind: "installed"
		, revision: reference.revision, command: reference.command
		, scope: `${reference.scope} ${reference.environment} ${reference.dispatch} The command reproduces the recorded selection; runtime paths must be set for the local toolchain.`
		, files: await Promise.all(paths.map(async path => ({ path, sha256: sha256(await readFile(path)) })))
		, artifacts: reference.artifacts.map(file => ({ ...file, path: `${reference.id}/${file.path}` })) });
}
const groups = [
	["c", "ordinary-source"], ["cpp", "ordinary-source"]
	, ["browser-javascript", "ordinary-source"]
	, ["browser-react", "ordinary-source"], ["browser-worker", "ordinary-source"]
	, ["c", "reviewed-ir"], ["cpp", "reviewed-ir"]
	, ["node-javascript", "reviewed-ir"], ["node-typescript", "reviewed-ir"]
];
for(const [profile, sourcePath] of groups)
{
	const selected = references.filter(item => item.profiles.includes(profile) && item.sourcePath === sourcePath);
	assert.equal(selected.length, profile.startsWith("node-") ? 2 : 1);
	const native = profile === "c" || profile === "cpp";
	const scope = native
		? "Fin arguments to returned Lean closures, Lean-produced closure results and Lean-produced arguments to host callbacks. Native host-produced refined replies are not established by this evidence; callback-result coverage here means results produced by Lean."
		: sourcePath === "reviewed-ir"
			? "Reviewed R1 callback arguments and Lean-produced results; R2 additionally validates the npm-only Fin 3 host-produced reply. Strict TypeScript checks declarations; Node provides the runtime observations."
			: "Ordinary callback arguments and results in the named browser profile, including host-produced Fin 3 and Fin 5 replies, returned closures, bound rejection, disposal and recovery through public and raw runtime calls.";
	const integer = profile === "c" ? "GMP mpz" : "boost::multiprecision::cpp_int";
	const argument = native ? `${integer} values for arguments to returned Lean closures and Lean-produced arguments to host callbacks, constrained by the declared Fin bound`
		: "bigint checked against the declared bound in callback arguments";
	const result = native ? `${integer} values for leased-closure results produced by Lean, below the declared Fin bound`
		: "bigint checked against the declared bound in callback results";
	const notes = {
		analysis: "Compiler-owned callback and nominal refinement trees preserve each bound; reviewed decisions must reconcile with fresh Lean."
		, generation: "Generated callback identities and checked value conversions retain bounds and the original source signature."
		, compilation: "Admitted host-to-Lean values use checked Lean conversions; Lean-produced refined values retain their source constraints."
		, packaging: `Two author roots reproduce the package before source-free offline installation. ${selected[0].environment}`
		, installedExecution: selected.map(item => `${item.scope} ${item.dispatch}`).join(" ")
	};
	const limitation = native
		? "Native host-produced refined callback replies are not established. Other native consumers, Subtype, asynchronous or retained host callbacks remain separate."
		: sourcePath === "reviewed-ir"
			? "Reviewed Node only, with bounds 3, 5 and 10 and the original fixture shapes. No reviewed browser, Fin 0, wide-bound, recursive or Subtype claim."
			: "Ordinary-source Chromium, Firefox and WebKit only. Reviewed browser callbacks and other engines remain separate; dispatch is unmeasured.";
	inventory.observations.push({ id: `callback-fin-${profile}-${sourcePath}`
		, profiles: [profile], shapes: ["fin"]
		, positions: ["callback-parameter", "callback-result"], path: sourcePath
		, scope
		, hostTypes: { fin: { "callback-parameter": argument, "callback-result": result } }
		, stages: Object.fromEntries(inventory.stages.map(stage => [stage, { state: "passed", evidence: selected.map(item => item.id), note: notes[stage] }]))
		, limitations: [limitation, selected[0].environment, "No top-level, ordinary nominal-field, generic, dependent-value or proof-argument cells are added by these observations."]
		, conversionNotes: { fin: scope } });
}
await writeFile(path, JSON.stringify(inventory, null, 2) + "\n");
process.stdout.write("Added five archived callback selections and eighteen observed callback-position cells; all earlier observations are unchanged.\n");
