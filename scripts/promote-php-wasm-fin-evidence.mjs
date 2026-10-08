/**
 * Promote six installed PHP-Wasm Fin cells without changing other hosts or earlier observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { phpWasmFinPromotionConversion, phpWasmFinPromotionEnvironment, phpWasmFinPromotionLimit, phpWasmFinPromotionNotes, phpWasmFinPromotionReferences, phpWasmFinPromotionScope, phpWasmFinPromotionValidators } from "../tests/helpers/php-wasm-fin-promotion-references.mjs";

const path = "docs/type-surface.v1.json", inventory = JSON.parse(await readFile(path, "utf8"));
const references = await phpWasmFinPromotionReferences();
assert.ok(process.argv.slice(2).every(argument => argument === "--refresh"), "Only --refresh is accepted");
if(process.argv.includes("--refresh"))
{
	assert.deepEqual(inventory.evidence.slice(-4).map(item => item.id), references.map(item => item.id));
	assert.deepEqual(inventory.observations.slice(-4).map(item => item.id), references.map(item => item.id.replace(/-installed$/u, "")));
	inventory.evidence.splice(-4); inventory.observations.splice(-4);
}
for(const reference of references)
{
	assert.ok(!inventory.evidence.some(item => item.id === reference.id), reference.id);
	const paths = [...phpWasmFinPromotionValidators, ...reference.files.map(file => file.path)];
	inventory.evidence.push({ id: reference.id, kind: "installed"
		, revision: reference.revision, command: reference.command
		, scope: phpWasmFinPromotionScope(reference)
		, files: await Promise.all(paths.map(async path => ({ path, sha256: sha256(await readFile(path)) })))
		, artifacts: reference.artifacts.map(file => ({ ...file, path: `${reference.id}/${file.path}` })) });
	const representation = "Brick\\Math\\BigInteger checked against the declared closed Fin bound";
	const notes = phpWasmFinPromotionNotes(reference);
	inventory.observations.push({ id: reference.id.replace(/-installed$/u, "")
		, profiles: ["php-wasm"], shapes: ["fin"]
		, positions: reference.positions, path: reference.sourcePath
		, scope: reference.scope
		, hostTypes: { fin: Object.fromEntries(reference.positions.map(position => [position, representation])) }
		, stages: Object.fromEntries(inventory.stages.map(stage => [stage, { state: "passed", evidence: [reference.id], note: notes[stage] }]))
		, limitations: [phpWasmFinPromotionLimit, phpWasmFinPromotionEnvironment]
		, conversionNotes: { fin: phpWasmFinPromotionConversion } });
}
await writeFile(path, JSON.stringify(inventory, null, 2) + "\n");
process.stdout.write("Added four original PHP-Wasm selections and six Fin cells; earlier observations are unchanged.\n");
