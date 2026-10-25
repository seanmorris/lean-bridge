/**
 * Audit the published dependent checked-record cells after archive replay.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { generateReferenceDocs } from "../scripts/generate-reference-docs.mjs";
import { typeGuideProfiles } from "../scripts/generate-type-docs.mjs";
import {
	typeSurfaceCells, validateTypeSurface
} from "../src/adoption/type-surface.mjs";
import {
	dependentCheckedRecordPromotionConversion
	, dependentCheckedRecordPromotionLanes
	, dependentCheckedRecordPromotionLimit
	, dependentCheckedRecordPromotionPath
	, dependentCheckedRecordPromotionProfiles
	, dependentCheckedRecordPromotionRoutes
} from "./helpers/dependent-checked-record-promotion.mjs";

const readJson = async path => JSON.parse(await readFile(path, "utf8"));
let inventoryPromise;
const readInventory = () => inventoryPromise ??= Promise.all([
	readJson("docs/type-surface.v1.json")
	, readJson("schema/binding-ir.schema.json")
	, readJson("docs/consumer-support.v1.json")
]);
const sourcePath = route => route.replace(/^result-only-/u, "");
const resultOnly = route => route.startsWith("result-only-");
const evidenceId = (lane, route) =>
	`dependent-checked-record-${lane}-${route}-hosted-installed`;

test("public inventory contains exactly 68 dependent checked-record cells"
	, async () => {
	const [inventory, irSchema, consumers] = await readInventory();
	const contracts = { irSchema, consumers };
	assert.equal(validateTypeSurface(inventory, contracts), true);
	const expectedEvidence = dependentCheckedRecordPromotionLanes.flatMap(
		definition => dependentCheckedRecordPromotionRoutes.map(route =>
			evidenceId(definition.lane, route)));
	const evidence = inventory.evidence.filter(item =>
		expectedEvidence.includes(item.id));
	assert.deepEqual(evidence.map(item => item.id), expectedEvidence);
	for(const item of evidence)
	{
		assert.equal(item.kind, "installed");
		assert.ok(item.files.length > 1, item.id);
		assert.ok(item.artifacts.length > 0, item.id);
	}
	const targets = typeSurfaceCells(inventory, contracts, cell =>
		dependentCheckedRecordPromotionProfiles.includes(cell.profile)
		&& cell.shape === "checked-record"
		&& ["ordinary-source", "reviewed-ir"].includes(cell.path)
		&& ["parameter", "result"].includes(cell.position));
	assert.equal(targets.length, 68);
	for(const cell of targets)
	{
		const definition = dependentCheckedRecordPromotionLanes.find(item =>
			item.profiles.includes(cell.profile));
		assert.ok(definition, cell.profile);
		const expected = dependentCheckedRecordPromotionRoutes.filter(route =>
			sourcePath(route) === cell.path
			&& (!resultOnly(route) || cell.position === "result"))
			.map(route => evidenceId(definition.lane, route));
		assert.equal(expected.length, cell.position === "result" ? 2 : 1
			, cell.id);
		assert.ok(cell.conversionNote.includes(
			dependentCheckedRecordPromotionConversion), cell.id);
		assert.ok(cell.limitations.includes(
			dependentCheckedRecordPromotionLimit), cell.id);
		for(const stage of Object.values(cell.stages))
		{
			assert.equal(stage.state, "passed", cell.id);
			assert.deepEqual(stage.evidence.filter(id =>
				expectedEvidence.includes(id)), expected, cell.id);
		}
	}
	const promoted = typeSurfaceCells(inventory, contracts).filter(cell =>
		Object.values(cell.stages).some(stage => stage.evidence.some(id =>
			expectedEvidence.includes(id))));
	assert.equal(promoted.length, 68);
	const summary = await readFile(dependentCheckedRecordPromotionPath, "utf8");
	for(const definition of dependentCheckedRecordPromotionLanes)
		assert.ok(summary.includes(`| ${definition.lane} | ${definition.profiles.join(", ")} |`)
			, definition.lane);
	for(const text of [
		"Eleven immutable hosted archives", "seventeen consumer profiles"
		, "exactly 68 cells", "value-carrying dependent"
	]) assert.ok(summary.includes(text), text);
	}
);

test("dependent matrix generated references and consumer guides match their contracts"
	, async () => {
	const [document, irSchema, consumers] = await readInventory();
	assert.equal(validateTypeSurface(document, { irSchema, consumers }), true);
	const documents = await generateReferenceDocs({
		inventory: { document, irSchema, consumers }
	});
	assert.equal(Object.keys(documents).length
		, 4 + Object.keys(typeGuideProfiles).length);
	}
);

test("dependent matrix rejects a stale generated consumer type section"
	, async () => {
	const [document, irSchema, consumers] = await readInventory();
	assert.equal(validateTypeSurface(document, { irSchema, consumers }), true);
	const temporary = await mkdtemp(join(tmpdir(), "lean-dependent-matrix-docs-"));
	const guides = Object.keys(typeGuideProfiles), target = guides[0];
	try
	{
		for(const directory of ["demos", "schema", "site", "tests"])
			await symlink(resolve(directory), join(temporary, directory), "dir");
		await mkdir(join(temporary, "docs"));
		await symlink(resolve("docs/reference")
			, join(temporary, "docs/reference"), "dir");
		for(const guide of guides)
		{
			const destination = join(temporary, guide);
			await mkdir(dirname(destination), { recursive: true });
			if(guide !== target)
				await symlink(resolve(guide), destination, "file");
			else
			{
				const source = await readFile(guide, "utf8");
				assert.ok(source.includes("### Type conversions\n"));
				await writeFile(destination, source.replace("### Type conversions\n"
					, "### Type conversions\nDeliberately stale generated text.\n"));
			}
		}
		await assert.rejects(generateReferenceDocs({
			root: temporary, inventory: { document, irSchema, consumers }
		}), error => error.message.includes(`${target} is stale`));
	}
	finally
	{
		await rm(temporary, { recursive: true, force: true });
	}
	}
);
