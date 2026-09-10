/**
 * Prevent conversion documentation from exceeding its position-specific evidence.
 *
 * @file
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { docPages } from "../site/registry.mjs";
import { readTypeSurface, typeSurfaceCells } from "../src/adoption/type-surface.mjs";
import { cellTypeCoverage, renderTypeDocuments, renderTypeTable, replaceTypeSection, typeGuideProfiles } from "../scripts/generate-type-docs.mjs";
import { alpha } from "../poc/lean-link-spike/descriptors.mjs";
import { generateJavaScriptPackage } from "../src/backends/javascript/generate.mjs";
import { generatePhpBindingPackage } from "../src/backends/php/generate.mjs";
import { generateRustBindingPackage } from "../src/backends/rust/generate.mjs";
import { generateCBindingPackage } from "../src/backends/c/generate.mjs";
import { generateCppBindingPackage } from "../src/backends/cpp/generate.mjs";

const root = path.resolve(import.meta.dirname, "..");
const inventory = await readTypeSurface();
const { document, ...contracts } = inventory;
const cells = typeSurfaceCells(document, contracts);
const section = source => source.split("### Type conversions\n")[1]?.split(/^#{1,3} /mu)[0];
const row = (source, lean) => section(source).split("\n").find(line => line.startsWith(`| \`${lean}\` |`));

test("every consumer table is generated and includes all 48 source forms exactly once", async () => {
	const rendered = await renderTypeDocuments({ root });
	assert.deepEqual(new Set(Object.values(typeGuideProfiles).flat()), new Set(document.profiles.map(profile => profile.id)));
	for(const [filename, profiles] of Object.entries(typeGuideProfiles))
	{
		assert.ok(docPages.some(page => page.source === filename), filename);
		const source = await readFile(path.join(root, filename), "utf8");
		assert.equal(source, rendered.documents[filename], filename);
		const table = section(source);
		assert.equal(table.split("\n").filter(line => line.startsWith("| ")).length, document.shapes.length + 2);
		for(const shape of document.shapes) assert.ok(row(source, shape.lean), `${filename}: ${shape.id}`);
		assert.ok(source.indexOf("### Type conversions") < source.indexOf("## Start from a raw Lean package"));
		assert.match(source, /### (?:Alpha example API|Scalar package example)/u);
		assert.equal(replaceTypeSection(source, renderTypeTable(inventory, profiles, path.posix.relative(path.posix.dirname(filename), "docs/reference/types.md"))), source);
	}
});

test("the PHP overview includes both transports and their actual integer limit", async () => {
	const source = await readFile("docs/php.md", "utf8");
	assert.match(row(source, "UInt32"), /Native PHP.*PHP-Wasm|PHP-Wasm.*Native PHP/u);
	assert.match(row(source, "UInt32"), /0\.\.2147483647.*PHP_INT_MAX/u);
	assert.match(row(source, "UInt32"), /0\.\.4294967295/u);
	assert.match(row(source, "Nat"), /BigInteger.*Generator inspected/u);
	assert.match(row(source, "Except ε α"), /Generation rejected/u);
	const wasm = await readFile("docs/consume/php-wasm.md", "utf8");
	assert.match(row(wasm, "Int64"), /32-bit int does not provide this full range/u);
});

test("Java and Kotlin keep their own host representations without widening Alpha coverage", async () => {
	const java = await readFile("docs/consume/java.md", "utf8");
	const kotlin = await readFile("docs/consume/kotlin.md", "utf8");
	assert.match(row(java, "UInt32"), /`long`/u);
	assert.match(row(kotlin, "UInt32"), /`Long`/u);
	for(const source of [java, kotlin])
	{
		assert.match(row(source, "Nat"), /no host mapping/u);
		assert.doesNotMatch(row(source, "Nat"), /Installed checks passed/u);
		assert.match(row(source, "Task α / asynchronous result"), /Generation rejected/u);
		assert.doesNotMatch(source, /Alpha.*exposes no `Nat`/u);
	}
});

test("C++ names the actual generated closure wrapper", async () => {
	const cpp = await readFile("docs/consume/cpp.md", "utf8");
	const name = cells.find(cell => cell.id === "cpp/closure/reviewed-ir/result").hostType;
	const header = generateCppBindingPackage(alpha.bindingIr)["include/lean_alpha.hpp"];
	assert.match(header, new RegExp(`class ${name} final`, "u"));
	assert.match(row(cpp, "Lean function returned to the host"), /`Transform`/u);
	assert.doesNotMatch(row(cpp, "Lean function returned to the host"), /OwnedTransform/u);
});

test("a generator observation cannot become installed coverage or leak into another path", () => {
	const node = cells.find(cell => cell.id === "node-javascript/nat/ordinary-source/parameter");
	const reviewed = cells.find(cell => cell.id === "node-javascript/nat/reviewed-ir/parameter");
	const field = cells.find(cell => cell.id === "node-javascript/nat/ordinary-source/field");
	assert.equal(cellTypeCoverage(node), "Installed checks passed");
	assert.equal(cellTypeCoverage(reviewed), "Generator inspected");
	assert.equal(cellTypeCoverage(field), "Not audited");
	const profiles = typeGuideProfiles["docs/javascript-typescript.md"];
	const combined = row(renderTypeTable(inventory, profiles, "reference/types.md"), "Nat");
	assert.match(combined, /Ordinary source: Node JavaScript: Installed checks passed \(input, result\)/u);
	assert.equal(combined.split("Reviewed IR:").length, 2, "Shared reviewed evidence appears once");
	const candidate = structuredClone(inventory);
	const observed = candidate.document.observations.find(observation => observation.id === node.observation);
	observed.stages.installedExecution = { state: "unreviewed", evidence: [], note: "Archive execution evidence removed." };
	const source = renderTypeTable(candidate, ["node-javascript"], "reference/types.md");
	assert.doesNotMatch(row(source, "Nat"), /Installed checks passed/u);
	assert.match(row(source, "Nat"), /Packaged; execution unaudited/u);
});

test("table generation rejects missing, overlapping and foreign conversion-note claims", () => {
	assert.throws(() => renderTypeTable(inventory, ["unknown"], "types.md"), /Unknown type profile/u);
	assert.throws(() => replaceTypeSection("No generated heading", "replacement"), /exactly one/u);
	assert.throws(() => replaceTypeSection("### Type conversions\n### Type conversions\n", "replacement"), /exactly one/u);
	const candidate = structuredClone(inventory);
	candidate.document.observations[0].conversionNotes = { char: "Wrong shape's mapping." };
	assert.throws(() => renderTypeTable(candidate, ["node-javascript"], "types.md"), /conversion note outside observed shapes/u);
	candidate.document.observations[0].conversionNotes = undefined;
	candidate.document.shapes.pop();
	assert.throws(() => renderTypeTable(candidate, ["node-javascript"], "types.md"));
});

test("regeneration cannot rewrite installation commands or swallow the next section", () => {
	const source = "# Guide\n\n## Use a prepared release\n\nnpm install example\n\n### Type conversions\n\nold table\n\n### Alpha example API\n\nkept example\n\n## Start from a raw Lean package\n\nkept source workflow\n";
	const result = replaceTypeSection(source, "### Type conversions\n\nnew table\n");
	assert.equal(result.split("### Type conversions")[0], source.split("### Type conversions")[0]);
	assert.equal(result.split("### Alpha example API")[1], source.split("### Alpha example API")[1]);
	assert.doesNotMatch(result, /old table/u);
});

test("recorded result and arbitrary-integer rejections exercise real generator guards", () => {
	const apply = constructor => ({ kind: "apply", constructor, arguments: [{ kind: "primitive", name: "uint32" }, { kind: "primitive", name: "string" }] });
	for(const [generate, type, code] of [
		[generateJavaScriptPackage, apply("result"), "unsupported-type-constructor"]
		, [generatePhpBindingPackage, apply("result"), "unsupported-result-type"]
		, [generateRustBindingPackage, { kind: "primitive", name: "nat" }, "unsupported-arbitrary-integer"]
		, [generateCBindingPackage, apply("result"), "unsupported-type-application"]
	]){
		const ir = structuredClone(alpha.bindingIr);
		ir.types.find(type => type.name === "Payload").fields[1].type = type;
		assert.throws(() => generate(ir), error => error.code === code, code);
	}
});
