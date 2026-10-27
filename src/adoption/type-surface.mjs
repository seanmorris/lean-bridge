/**
 * Validate the maintainer's type inventory and expand its scoped evidence into cells.
 * This module is not part of the installed CLI or a consumer runtime.
 *
 * @file
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import Ajv from "ajv/dist/2020.js";
import schema from "../../schema/type-surface.schema.json" with { type: "json" };
import {
	assertTypeSurfaceEvidenceReceipt, typeSurfaceEvidenceSourcePaths
	, typeSurfaceEvidenceFiles
} from "./type-surface-evidence-receipt.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const validateSchema = new Ajv({ allErrors: true, strict: true }).compile(schema);
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const sourceShapes = [
	"fin"
	, "subtype"
	, "checked-record"
	, "dependent"
	, "recursive"
	, "generic"
	, "implicit"
	, "instance"
	, "proof"
	, "optional-parameter"
	, "host-null"
	, "io"
	, "eio"
	, "declared-error"
	, "task"
	, "host-object"
	, "closure"
	, "cancellation"
	, "iterator"
	, "async-iterator"
];
const exactSet = (actual, expected, label) => {
	assert.equal(new Set(actual).size, actual.length, `${label}: duplicate entries`);
	assert.deepEqual([...actual].sort(), [...expected].sort(), `${label}: unclassified or missing entries`);
};
const uniqueIds = (entries, label) => {
	const ids = entries.map(entry => entry.id);
	assert.equal(new Set(ids).size, ids.length, `${label}: duplicate ids`);
	return new Map(entries.map(entry => [entry.id, entry]));
};
const relativeFile = value => {
	assert.ok(typeof value === "string" && !path.isAbsolute(value) && !value.includes("\\")
		&& !value.includes("\0") && !value.includes(":")
		&& value.split("/").every(part => part && part !== "." && part !== ".."), `Unsafe evidence path: ${value}`);
};

/**
 * Read semantic alternatives directly from the independent Binding IR schema.
 *
 * @param irSchema - Current, unmodified Binding IR JSON Schema.
 */
export function bindingIrTypeFacets(irSchema)
{
	const definitions = irSchema.$defs;
	const properties = name => definitions[name].properties;
	const references = definitions.typeRef.oneOf;
	const primitive = references.find(item => item.properties.kind.const === "primitive");
	const application = references.find(item => item.properties.kind.const === "apply");
	const lifetime = definitions.lifetime.oneOf.find(item => item.type === "object");
	return {
		typeReference: references.map(item => item.properties.kind.const)
		, primitive: primitive.properties.name.enum
		, constructor: application.properties.constructor.enum
		, namedKind: properties("typeDefinition").kind.enum
		, declaration: properties("declaration").kind.enum
		, representation: properties("typeDefinition").representation.enum
		, genericRepresentation: properties("typeParameter").representation.enum
		, mutability: properties("typeDefinition").mutability.enum
		, ownership: properties("ownershipSite").ownership.enum
		, lifetime: lifetime.properties.scope.enum
		, delivery: properties("declaration").resultMode.enum
		, effect: properties("declaration").effects.items.enum
		, failure: properties("failure").mode.enum
		, unexpectedFailure: properties("failure").unexpected.enum
		, errorCategory: properties("error").category.enum
		, callbackInvocation: properties("callable").invocation.enum
		, callbackReentry: properties("callable").reentry.enum
		, callbackSelfDisposal: properties("callable").selfDisposal.enum
		, callbackDelivery: properties("callable").resultMode.enum
		, resourceDisposal: properties("resource").disposal.enum
		, resourceFallback: properties("resource").fallback.enum
		, resourceCycles: properties("resource").cycles.enum
		, hostTarget: properties("hostProjection").targets.items.enum
		, hostIdentity: properties("hostProjection").identity.enum
	};
}

/**
 * Reject incomplete classifications and claims that exceed their evidence.
 *
 * @param document - Versioned inventory, baseline and observations.
 * @param contracts - Independently owned IR schema and consumer profile contract.
 * @param contracts.irSchema - Binding IR schema used by the current generators.
 * @param contracts.consumers - Versioned downstream support contract.
 */
export function validateTypeSurface(document, { irSchema, consumers })
{
	assert.ok(validateSchema(document), `Invalid type surface: ${JSON.stringify(validateSchema.errors)}`);
	assert.equal(document.bindingIrVersion, irSchema.properties.schemaVersion.const, "Binding IR version drift");
	assert.equal(document.consumerContractVersion, consumers.contractVersion, "Consumer profile version drift");
	const facets = bindingIrTypeFacets(irSchema);
	exactSet(Object.keys(document.irFacets), Object.keys(facets), "IR facets");
	for(const [name, values] of Object.entries(facets)) exactSet(document.irFacets[name], values, `IR ${name}`);
	for(const owner of ["receiver", "parameter"])
		exactSet(irSchema.$defs[owner].properties.ownership.enum, facets.ownership, `${owner} ownership`);
	for(const owner of ["field", "receiver", "parameter", "declaration"])
		exactSet(irSchema.$defs[owner].properties.mutability.enum, facets.mutability, `${owner} mutability`);
	exactSet(irSchema.$defs.callable.properties.effects.items.enum, facets.effect, "callback effects");
	const profiles = uniqueIds(document.profiles, "profiles");
	const expectedProfiles = consumers.consumers.flatMap(consumer => consumer.id === "jvm" ? ["java", "kotlin"]
		: consumer.id === "browser-javascript" ? ["browser-javascript", "browser-react", "browser-worker"] : [consumer.id]);
	exactSet([...profiles.keys()], expectedProfiles, "consumer profiles");
	for(const profile of profiles.values())
	{
		const expected = ["java", "kotlin"].includes(profile.id) ? "jvm"
			: ["browser-react", "browser-worker"].includes(profile.id) ? "browser-javascript" : profile.id;
		assert.equal(profile.consumer, expected, `${profile.id}: wrong consumer contract`);
		const language = {
			"node-javascript": "javascript", "node-typescript": "typescript"
			, "browser-javascript": "javascript", "browser-react": "javascript"
			, "browser-worker": "javascript", "php-native": "php", "php-wasm": "php"
			, dotnet: "csharp", "wit-wasi": "wit"
		}[profile.id] ?? profile.id;
		assert.equal(profile.language, language, `${profile.id}: wrong language projection`);
	}
	const shapes = uniqueIds(document.shapes, "shapes");
	const required = [...facets.primitive, ...facets.constructor, ...facets.namedKind, ...sourceShapes];
	exactSet([...shapes.keys()], required, "IR and source shapes");
	for(const [family, entry] of Object.entries(document.families))
	{
		assert.ok(Object.hasOwn(document.rules, entry.rule), `${family}: unknown semantic rules`);
		for(const position of entry.positions) assert.ok(document.positions.includes(position), `${family}: unknown position ${position}`);
	}
	for(const shape of shapes.values())
	{
		assert.ok(Object.hasOwn(document.families, shape.family), `${shape.id}: unknown family`);
		if(shape.ir !== null)
		{
			const [facet, value] = shape.ir.split(":");
			assert.ok(facets[facet]?.includes(value), `${shape.id}: unclassified IR reference ${shape.ir}`);
		}
	}
	for(const facet of ["primitive", "constructor", "namedKind"])
		for(const value of facets[facet]) assert.equal(shapes.get(value).ir, `${facet}:${value}`, `${value}: incorrect IR classification`);
	const evidence = uniqueIds(document.evidence, "evidence");
	for(const entry of evidence.values())
	{
		for(const records of [entry.files, entry.artifacts])
		{
			assert.equal(new Set(records.map(file => file.path)).size, records.length, `${entry.id}: duplicate evidence files`);
			for(const file of records) relativeFile(file.path);
		}
		if(entry.kind === "installed") assert.ok(entry.artifacts.length > 0, `${entry.id}: installed evidence needs exact archives`);
	}
	const exclusions = new Set();
	for(const entry of document.baseline.exclusions)
	{
		assert.ok(profiles.has(entry.profile) && shapes.has(entry.shape), "Unknown exclusion cell");
		assert.equal(evidence.get(entry.decisionEvidence)?.kind, "decision", "An exclusion needs a recorded review decision");
		const key = `${entry.profile}/${entry.shape}`;
		assert.ok(!exclusions.has(key), `Duplicate exclusion ${key}`);
		exclusions.add(key);
	}
	const occupied = new Set();
	uniqueIds(document.observations, "observations");
	for(const observation of document.observations)
	{
		exactSet(Object.keys(observation.hostTypes), observation.shapes, `${observation.id}: host types`);
		for(const shape of Object.keys(observation.conversionNotes ?? {}))
			assert.ok(observation.shapes.includes(shape), `${observation.id}: conversion note outside observed shapes`);
		for(const profile of observation.profiles) assert.ok(profiles.has(profile), `${observation.id}: unknown profile ${profile}`);
		for(const shape of observation.shapes)
		{
			assert.ok(shapes.has(shape), `${observation.id}: unknown shape ${shape}`);
			exactSet(Object.keys(observation.hostTypes[shape]), observation.positions, `${observation.id}/${shape}: host positions`);
			for(const position of observation.positions)
			{
				assert.ok(document.families[shapes.get(shape).family].positions.includes(position), `${shape}: inapplicable position ${position}`);
				for(const profile of observation.profiles)
				{
					const key = `${profile}/${shape}/${observation.path}/${position}`;
					assert.ok(!occupied.has(key), `Overlapping observations for ${key}; reconcile their scope explicitly`);
					occupied.add(key);
				}
			}
		}
		for(const stage of document.stages)
		{
			const entry = observation.stages[stage];
			assert.equal(entry.evidence.length === 0, entry.state === "unreviewed", `${observation.id}/${stage}: missing or unexplained evidence`);
			for(const id of entry.evidence)
			{
				assert.ok(evidence.has(id), `${observation.id}: unknown evidence ${id}`);
				if(entry.state === "passed" || entry.state === "limited")
					assert.ok(["test", "installed"].includes(evidence.get(id).kind), `${observation.id}: inspection cannot establish a passing test`);
			}
			if(stage === "installedExecution" && ["passed", "limited"].includes(entry.state))
			{
				assert.ok(entry.evidence.some(id => evidence.get(id).kind === "installed"), `${observation.id}: installed execution needs archive evidence`);
				for(const predecessor of document.stages.slice(0, -1))
					assert.ok(["passed", "limited"].includes(observation.stages[predecessor].state), `${observation.id}: installed execution lacks ${predecessor}`);
				for(const type of Object.values(observation.hostTypes))
					assert.ok(Object.values(type).every(value => value !== null), `${observation.id}: installed execution needs host types`);
			}
			if(entry.state === "limited") assert.ok(observation.limitations.length > 0, `${observation.id}: a limited result needs its boundary`);
		}
	}
	return true;
}

/**
 * Load the inventory and verify every evidence source hash, without executing commands.
 *
 * @param options - Source location for repository or isolated validation.
 * @param options.repository - Root containing the inventory and its evidence sources.
 * @param options.evidenceReceipt - Explicit intra-workflow receipt, or null to
 * force full byte validation. The environment handoff is accepted only for the
 * live repository, never for isolated validation roots.
 */
export async function readTypeSurface(options = {})
{
	const repository = path.resolve(options.repository ?? root);
	const sources = Object.fromEntries(await Promise.all(
		typeSurfaceEvidenceSourcePaths.map(async relative => [
			relative, await readFile(path.join(repository, relative))
		])
	));
	const [document, irSchema, consumers] = typeSurfaceEvidenceSourcePaths
		.map(relative => JSON.parse(sources[relative].toString("utf8")));
	validateTypeSurface(document, { irSchema, consumers });
	const canonicalRoot = await realpath(repository);
	const evidenceReceipt = Object.hasOwn(options, "evidenceReceipt")
		? options.evidenceReceipt : canonicalRoot === await realpath(root)
			? process.env.LEAN_BRIDGE_TYPE_SURFACE_EVIDENCE_RECEIPT : undefined;
	if(evidenceReceipt)
	{
		assert.equal(typeof evidenceReceipt, "string");
		assert.ok(!/[\0\r\n]/u.test(evidenceReceipt));
		const receipt = JSON.parse(await readFile(evidenceReceipt, "utf8"));
		const commit = execFileSync("git", [
			"-C", canonicalRoot, "rev-parse", "HEAD"
		], { encoding: "utf8" }).trim();
		assertTypeSurfaceEvidenceReceipt(receipt, {
			commit, document
			, sourceSha256: Object.fromEntries(typeSurfaceEvidenceSourcePaths
				.map(relative => [relative, digest(sources[relative])]))
		});
		return { document, irSchema, consumers };
	}
	const evidenceFiles = typeSurfaceEvidenceFiles(document);
	const batchSize = 16;
	for(let offset = 0; offset < evidenceFiles.length; offset += batchSize)
	{
		const batch = evidenceFiles.slice(offset, offset + batchSize);
		const actual = await Promise.all(batch.map(async file => {
			const filename = await realpath(path.join(canonicalRoot, file.path));
			const relative = path.relative(canonicalRoot, filename);
			relativeFile(relative);
			return digest(await readFile(filename));
		}));
		for(const [index, file] of batch.entries())
			assert.equal(actual[index], file.sha256
				, `stale source evidence: ${file.path}`);
	}
	return { document, irSchema, consumers };
}

/**
 * Expand all required cells, including missing observations, without combining evidence paths.
 *
 * @param document - Inventory that will be validated against the supplied contracts.
 * @param contracts - Independent IR and consumer contracts.
 * @param select - Optional predicate over a cell identity, evaluated before the
 * expanded cell copies observation notes, limitations and stages.
 */
export function typeSurfaceCells(document, contracts, select = () => true)
{
	assert.equal(typeof select, "function");
	validateTypeSurface(document, contracts);
	const unreviewedStages = {};
	for(const stage of document.stages)
		unreviewedStages[stage] = { state: "unreviewed", evidence: [], note: `Type-specific ${stage} evidence is not recorded.` };
	const observations = new Map();
	for(const observation of document.observations)
		for(const profile of observation.profiles)
			for(const shape of observation.shapes)
				for(const position of observation.positions)
					observations.set(`${profile}/${shape}/${observation.path}/${position}`, observation);
	const cells = [];
	for(const profile of document.profiles)
		for(const shape of document.shapes)
			for(const sourcePath of document.paths)
				for(const position of document.families[shape.family].positions)
				{
					const key = `${profile.id}/${shape.id}/${sourcePath}/${position}`;
					const identity = {
						id: key, profile: profile.id, shape: shape.id
						, path: sourcePath, position
					};
					if(!select(identity)) continue;
					const observation = observations.get(key);
					const family = document.families[shape.family];
					const exclusion = document.baseline.exclusions.find(entry => entry.profile === profile.id && entry.shape === shape.id);
					cells.push({
						...identity
						, requirement: exclusion ? "reviewed-exclusion" : shape.family === "proof" ? "required-erasure" : "required"
						, exclusion: exclusion ?? null, owner: family.owner
						, lean: shape.lean, meaning: shape.meaning, bounds: shape.bounds
						, ...document.rules[family.rule]
						, platform: contracts.consumers.consumers.find(entry => entry.id === profile.consumer).scope
						, context: profile.context, wordBits: profile.wordBits
						, hostType: observation?.hostTypes[shape.id][position] ?? null
						, observation: observation?.id ?? null
						, scope: observation?.scope ?? "Not yet audited."
						, conversionNote: observation?.conversionNotes?.[shape.id] ?? null
						, limitations: structuredClone(observation?.limitations ?? [])
						, stages: structuredClone(observation?.stages ?? unreviewedStages)
					});
				}
	return cells;
}

/**
 * Report every missing layer without treating an unsupported baseline cell as completed.
 *
 * @param document - Validated type-surface input.
 * @param contracts - Independent IR and consumer contracts.
 */
export function typeSurfaceGapReport(document, contracts)
{
	const cells = typeSurfaceCells(document, contracts);
	const gaps = cells.flatMap(cell => document.stages.filter(stage => cell.stages[stage].state !== "passed").map(stage => ({
		cell: cell.id
		, stage
		, state: cell.stages[stage].state
		, requirement: cell.requirement
		, owner: ["analysis", "compilation"].includes(stage) ? 1216
			: stage === "packaging" || stage === "installedExecution" ? 1224 : cell.owner
		, implementationOwner: cell.owner, note: cell.stages[stage].note
	})));
	return {
		schemaVersion: 1
		, contractVersion: document.contractVersion
		, planNode: document.planNode
		, profiles: document.profiles.length
		, shapes: document.shapes.length
		, cells: cells.length
		, observedCells: cells.filter(cell => cell.observation !== null).length
		, installedTestedCells: cells.filter(cell => cell.stages.installedExecution.state === "passed").length
		, requiredGaps: gaps.filter(gap => gap.requirement !== "reviewed-exclusion").length
		, complete: gaps.every(gap => gap.requirement === "reviewed-exclusion")
		, gaps
	};
}
