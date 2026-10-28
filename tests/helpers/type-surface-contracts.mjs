/**
 * Read only the current type-surface contracts. Historical verifiers classify
 * already-authenticated inventories with these contracts and never need the
 * current inventory document or its evidence-file walk.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { typeSurfaceEvidenceSourcePaths } from "../../src/adoption/type-surface-evidence-receipt.mjs";

const [, irSchemaPath, consumersPath] = typeSurfaceEvidenceSourcePaths;

/**
 * Parse the binding-IR schema and consumer contracts exactly as
 * readTypeSurface does.
 */
export const readTypeSurfaceContracts = async () => {
	const [irSchema, consumers] = await Promise.all([irSchemaPath, consumersPath]
		.map(async path => JSON.parse(await readFile(path, "utf8"))));
	return { irSchema, consumers };
};
