/**
 * Keep callback-Fin claims within the installed source routes, hosts and directions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { callbackFinPromotionReferences } from "./callback-fin-promotion-references.mjs";
import { beforeCallbackFinPromotionSource } from "./callback-fin-promotion-source-history.mjs";

const predecessor = async () => JSON.parse(beforeCallbackFinPromotionSource("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8")));
const groups = [
	["c", "ordinary-source"], ["cpp", "ordinary-source"]
	, ["browser-javascript", "ordinary-source"]
	, ["browser-react", "ordinary-source"], ["browser-worker", "ordinary-source"]
	, ["c", "reviewed-ir"], ["cpp", "reviewed-ir"]
	, ["node-javascript", "reviewed-ir"], ["node-typescript", "reviewed-ir"]
];
const positions = ["callback-parameter", "callback-result"];
const validate = (document, previous, references, contracts) => {
	const added = document.observations.slice(previous.observations.length);
	assert.deepEqual(added.map(item => [item.profiles[0], item.path]), groups);
	assert.deepEqual(document.observations.slice(0, previous.observations.length), previous.observations);
	for(const key of Object.keys(previous).filter(key => !["evidence", "observations"].includes(key)))
		assert.deepEqual(document[key], previous[key], key);
	for(const item of added)
	{
		assert.equal(item.profiles.length, 1); assert.deepEqual(item.shapes, ["fin"]); assert.deepEqual(item.positions, positions);
		const selected = references.filter(reference => reference.profiles.includes(item.profiles[0]) && reference.sourcePath === item.path);
		assert.equal(selected.length, item.profiles[0].startsWith("node-") ? 2 : 1);
		for(const stage of Object.values(item.stages))
		{ assert.equal(stage.state, "passed"); assert.deepEqual(stage.evidence, selected.map(reference => reference.id)); }
		assert.ok(item.limitations.some(note => /No top-level, ordinary nominal-field, generic, dependent-value or proof-argument cells/u.test(note)));
		const scope = item.scope;
		if(["c", "cpp"].includes(item.profiles[0]))
		{
			assert.match(scope, /Native host-produced refined replies are not established by this evidence/u);
			assert.match(scope, /callback-result coverage here means results produced by Lean/u);
			assert.match(item.hostTypes.fin["callback-result"], /leased-closure results produced by Lean/u);
			assert.match(item.hostTypes.fin["callback-parameter"], /arguments to returned Lean closures and Lean-produced arguments to host callbacks/u);
		}
		else for(const position of positions) assert.equal(item.hostTypes.fin[position], `bigint checked against the declared bound in callback ${position === "callback-parameter" ? "arguments" : "results"}`);
		if(item.profiles[0].startsWith("browser-")) assert.match(scope, /including host-produced Fin 3 and Fin 5 replies/u);
		if(item.profiles[0].startsWith("node-")) assert.match(scope, /R2 additionally validates the npm-only Fin 3 host-produced reply/u);
		if(item.profiles[0] === "node-typescript") assert.match(scope, /Strict TypeScript checks declarations; Node provides the runtime observations/u);
		if(item.path === "reviewed-ir") assert.match(item.stages.installedExecution.note, /no Fin 0, wide-bound, recursive or Subtype claim/u);
	}
	const old = new Map(typeSurfaceCells(previous, contracts).map(cell => [cell.id, cell]));
	const expected = new Set(groups.flatMap(([profile, path]) => positions.map(position => [profile, path, position].join("/"))));
	const changed = [];
	for(const cell of typeSurfaceCells(document, contracts))
	{
		const key = [cell.profile, cell.path, cell.position].join("/");
		if(cell.shape === "fin" && expected.has(key))
		{
			assert.equal(old.get(cell.id).stages.installedExecution.state, "unreviewed", cell.id);
			for(const stage of Object.values(cell.stages)) assert.equal(stage.state, "passed", cell.id);
			changed.push(key);
		}
		else assert.deepEqual(cell, old.get(cell.id), cell.id);
	}
	assert.deepEqual(changed.sort(), [...expected].sort());
};

test("callback promotion binds five original selections and their archive validators", async () => {
	const references = await callbackFinPromotionReferences(), { document } = await readTypeSurface(), previous = await predecessor();
	assert.deepEqual(document.evidence.slice(previous.evidence.length).map(item => item.id), references.map(item => item.id));
	for(const reference of references)
	{
		const entry = document.evidence.find(item => item.id === reference.id);
		assert.equal(entry.kind, "installed"); assert.equal(entry.revision, reference.revision);
		assert.equal(entry.command, reference.command); assert.ok(entry.scope.includes(reference.environment));
		assert.ok(entry.scope.includes(reference.dispatch)); assert.ok(entry.scope.includes(reference.scope));
		for(const path of ["tests/helpers/callback-fin-promotion-references.mjs", ...reference.validators])
			assert.ok(entry.files.some(file => file.path === path), path);
		for(const file of reference.files) assert.ok(entry.files.some(pin => pin.path === file.path && pin.sha256 === file.sha256), file.path);
		for(const file of entry.files) assert.equal(sha256(await readFile(file.path)), file.sha256, file.path);
		assert.deepEqual(entry.artifacts, reference.artifacts.map(file => ({ ...file, path: `${reference.id}/${file.path}` })));
	}
});

test("callback promotion adds eighteen cells without changing other positions or source routes", async () => {
	const { document, ...contracts } = await readTypeSurface(), previous = await predecessor(), references = await callbackFinPromotionReferences();
	validate(document, previous, references, contracts);
	assert.equal(previous.observations.length, 477); assert.equal(previous.evidence.length, 255);
});

test("callback promotion rejects inferred hosts, directions, runtime claims and omitted limits", async () => {
	const { document, ...contracts } = await readTypeSurface(), previous = await predecessor(), references = await callbackFinPromotionReferences();
	const start = previous.observations.length;
	const changes = [
		value => { value.observations[start].profiles = ["python"]; }
		, value => { value.observations[start].positions = ["field"]; }
		, value => { value.observations[start].shapes = ["subtype"]; }
		, value => { value.observations[start].path = "reviewed-ir"; }
		, value => { value.observations[start].scope = "All native callback replies supported"; }
		, value => { value.observations[start].stages.installedExecution.evidence.push("reviewed-callback-fin-npm-r2-installed"); }
		, value => { value.observations[start].limitations = []; }
		, value => { value.observations.at(-1).scope = "Independent TypeScript runtime acceptance"; }
		, value => { value.observations[start + 2].scope = "Browser closure inputs only"; }
		, value => { value.observations.at(-2).scope = "Reviewed callback directions only"; }
		, value => { value.observations[start].hostTypes.fin["callback-result"] = "GMP callback replies"; }
		, value => { value.observations[start].hostTypes.fin["callback-parameter"] = "GMP callback values"; }
		, value => { value.observations.at(-1).hostTypes.fin["callback-result"] = "bigint"; }
		, value => { value.observations[0].scope += " changed"; }
	];
	for(const mutate of changes)
	{
		const altered = structuredClone(document); mutate(altered);
		assert.throws(() => validate(altered, previous, references, contracts), assert.AssertionError);
	}
});
