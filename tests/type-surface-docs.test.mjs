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
import { generatePhpBindingPackage } from "../src/backends/php/generate.mjs";
import { generateRustBindingPackage } from "../src/backends/rust/generate.mjs";
import { generateCBindingPackage } from "../src/backends/c/generate.mjs";
import { generateCppBindingPackage } from "../src/backends/cpp/generate.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";

const root = path.resolve(import.meta.dirname, "..");
const inventory = await readTypeSurface();
const { document, ...contracts } = inventory;
const cells = typeSurfaceCells(document, contracts);
const section = source => source.split("### Type conversions\n")[1]?.split(/^#{1,3} /mu)[0];
const row = (source, lean) => section(source).split("\n").find(line => line.startsWith(`| \`${lean}\` |`));

test("every consumer table is generated and includes all 48 source forms exactly once", async () => {
	const rendered = await renderTypeDocuments({ root });
	assert.match(rendered.reference, /ordinary-source and compiler-checked reviewed packages.*all seventeen consumer profiles/u);
	assert.match(rendered.reference, /reviewed-native-20260918\.md.*reviewed-wasm-20260918\.md/u);
	assert.doesNotMatch(rendered.reference, /currently use fixed Alpha projections|Rust rejects arbitrary-precision integers/u);
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
		assert.match(source, /### (?:Alpha example API|Scalar package example|Workshop example API)/u);
		assert.equal(replaceTypeSection(source, renderTypeTable(inventory, profiles, path.posix.relative(path.posix.dirname(filename), "docs/reference/types.md"))), source);
	}
});

test("the PHP overview records exact UInt32 values in copied and Alpha profiles", async () => {
	const source = await readFile("docs/php.md", "utf8");
	assert.match(row(source, "UInt32"), /Native PHP.*PHP-Wasm|PHP-Wasm.*Native PHP/u);
	assert.match(row(source, "UInt32"), /0\.\.4294967295/u);
	assert.match(row(source, "UInt32"), /PHP-Wasm: `Brick\\Math\\BigInteger`/u);
	assert.match(row(source, "UInt32"), /Ordinary source: Installed checks passed\./u);
	assert.match(row(source, "UInt32"), /Reviewed IR: Installed checks passed/u);
	assert.match(row(source, "UInt32"), /Alpha.*full 0\.\.4294967295/u);
	assert.match(row(source, "Nat"), /BigInteger.*Generator inspected/u);
	assert.match(row(source, "Except ε α"), /Generation rejected/u);
	const wasm = source;
	assert.match(row(wasm, "Int64"), /32-bit projection uses Brick\\Math\\BigInteger/u);
	assert.match(row(wasm, "Int64"), /compiled copied API uses Brick\\Math\\BigInteger for the full/u);
	assert.match(row(wasm, "Float32"), /subnormals and signed zero/u);
});

test("PHP documents both primitive callable transports without promoting reviewed fields or async", async () => {
	const source = await readFile("docs/php.md", "utf8");
	assert.match(row(source, "Nat"), /Reviewed IR: Installed checks passed \(input, result, callback input, callback result\); Generator inspected \(field\)/u);
	const callback = row(source, "Host function passed to Lean");
	assert.match(callback, /`callable` \(input\)/u);
	assert.match(callback, /Ordinary source: Installed checks passed \(input\).*Reviewed IR: Installed checks passed \(input\)/u);
	assert.match(row(source, "Lean function returned to the host"), /`LeanClosure` \(result\)/u);
	for(const profile of ["php-native", "php-wasm"]) for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const closure = cells.find(cell => cell.id === `${profile}/closure/${path}/result`);
		assert.equal(closure.hostType, "LeanClosure");
		assert.deepEqual(closure.stages.installedExecution.evidence, [`${profile}-callables-installed`]);
	}
	assert.doesNotMatch(row(source, "Task α / asynchronous result"), /Installed checks passed/u);
});

test("Java and Kotlin document installed primitive callables without promoting fields or async", async () => {
	const java = await readFile("docs/consume/java.md", "utf8");
	const kotlin = await readFile("docs/consume/kotlin.md", "utf8");
	assert.match(row(java, "UInt32"), /`long`/u);
	assert.match(row(kotlin, "UInt32"), /`Long`/u);
	for(const source of [java, kotlin])
	{
		assert.match(row(source, "Nat"), /`BigInteger` \(input, result, field, callback input, callback result\).*Ordinary source: Installed checks passed\./u);
		assert.match(row(source, "Nat"), /Reviewed IR: Installed checks passed \(input, result, callback input, callback result\); Inspected: no host mapping \(field\)/u);
		assert.match(row(source, "Host function passed to Lean"), /Typed Fn\.\.\.To\.\.\. functional interface/u);
		assert.match(row(source, "Lean function returned to the host"), /Signature-specific LeanClosure \(AutoCloseable\)/u);
		assert.match(row(source, "Identity-bearing value"), /Ordinary source: Not audited\./u);
		assert.match(row(source, "Task α / asynchronous result"), /Generation rejected/u);
		assert.doesNotMatch(source, /Alpha.*exposes no `Nat`/u);
	}
});

test("C++ distinguishes typed primitive closures from Alpha's named wrapper", async () => {
	const cpp = await readFile("docs/consume/cpp.md", "utf8");
	for(const path of ["ordinary-source", "reviewed-ir"])
		assert.equal(cells.find(cell => cell.id === `cpp/closure/${path}/result`).hostType, "LeanClosure<Result(Args...)>");
	const header = generateCppBindingPackage(callableReviewedIr())["include/callables.hpp"];
	assert.match(header, /class LeanClosure<Result\(Args\.\.\.\)> final/u);
	assert.match(header, /inline LeanClosure<Nat\(bool, Nat\)> make_nat/u);
	assert.match(row(cpp, "Lean function returned to the host"), /`LeanClosure<Result\(Args\.\.\.\)>`/u);
	assert.doesNotMatch(row(cpp, "Lean function returned to the host"), /Transform/u);
	const alphaHeader = generateCppBindingPackage(alpha.bindingIr)["include/lean_alpha.hpp"];
	assert.match(alphaHeader, /class Transform final/u);
	assert.match(cpp.split("### Alpha example API")[1], /Returned Lean closure.*`Transform`/u);
});

test("installed primitive coverage stays separate from field audits and other producer paths", () => {
	const node = cells.find(cell => cell.id === "node-javascript/nat/ordinary-source/parameter");
	const reviewed = cells.find(cell => cell.id === "node-javascript/nat/reviewed-ir/parameter");
	const field = cells.find(cell => cell.id === "node-javascript/nat/ordinary-source/field");
	assert.equal(cellTypeCoverage(node), "Installed checks passed");
	assert.equal(cellTypeCoverage(reviewed), "Installed checks passed");
	assert.equal(cellTypeCoverage(field), "Installed checks passed");
	assert.deepEqual(field.stages.installedExecution.evidence, ["npm-records-installed"]);
	assert.equal(cellTypeCoverage(cells.find(cell => cell.id === "node-javascript/nat/reviewed-ir/field")), "Installed checks passed");
	const profiles = typeGuideProfiles["docs/javascript-typescript.md"];
	const combined = row(renderTypeTable(inventory, profiles, "reference/types.md"), "Nat");
	assert.match(combined, /Ordinary source: Installed checks passed\. Reviewed IR: Installed checks passed/u);
	assert.equal(combined.split("Reviewed IR:").length, 2, "Shared reviewed evidence appears once");
	const candidate = structuredClone(inventory);
	const observed = candidate.document.observations.find(observation => observation.id === node.observation);
	observed.stages.installedExecution = { state: "unreviewed", evidence: [], note: "Archive execution evidence removed." };
	const source = renderTypeTable(candidate, ["node-javascript"], "reference/types.md");
	assert.match(row(source, "Nat"), /Ordinary source: Packaged; execution unaudited \(input, result\)/u);
	assert.match(row(source, "Nat"), /Installed checks passed \(field, callback input, callback result\)/u);
	assert.match(row(source, "Nat"), /Reviewed IR: Installed checks passed/u);
});

test("table generation rejects missing, overlapping and foreign conversion-note claims", () => {
	assert.throws(() => renderTypeTable(inventory, ["unknown"], "types.md"), /Unknown type profile/u);
	assert.throws(() => replaceTypeSection("No generated heading", "replacement"), /exactly one/u);
	assert.throws(() => replaceTypeSection("### Type conversions\n### Type conversions\n", "replacement"), /exactly one/u);
	const candidate = structuredClone(inventory);
	const observation = candidate.document.observations[0];
	const foreign = candidate.document.shapes.find(shape => !observation.shapes.includes(shape.id));
	observation.conversionNotes = { [foreign.id]: "Wrong shape's mapping." };
	assert.throws(() => renderTypeTable(candidate, ["node-javascript"], "types.md"), /conversion note outside observed shapes/u);
	observation.conversionNotes = undefined;
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

test("npm compound mappings have installed value coverage without promoting native or callable positions", async () => {
	const source = await readFile("docs/javascript-typescript.md", "utf8");
	for(const lean of ["Option α", "Except ε α", "Prod α β / tuples"])
		assert.match(row(source, lean), /Installed checks passed \(input, result, field\)/u);
	for(const profile of ["node-javascript", "node-typescript", "browser-javascript", "browser-react", "browser-worker"])
		for(const path of ["ordinary-source", "reviewed-ir"])
			for(const shape of ["option", "result", "tuple"])
				for(const position of ["parameter", "result", "field", "callback-parameter", "callback-result"])
				{
					const cell = cells.find(cell => cell.id === `${profile}/${shape}/${path}/${position}`);
					if(position.startsWith("callback")) assert.notEqual(cell.stages.installedExecution.state, "passed");
					else
					{
						assert.equal(cell.stages.installedExecution.state, "passed");
						assert.deepEqual(cell.stages.installedExecution.evidence, ["npm-compounds-installed"]);
					}
				}
	for(const cell of cells.filter(cell => ["php-wasm", "perl"].includes(cell.profile) && ["option", "result", "tuple"].includes(cell.shape)))
		assert.notEqual(cell.stages.installedExecution.state, "passed");
});

test("Ruby compound docs distinguish absent options, Unit and result branches", async () => {
	const source = await readFile("docs/consume/ruby.md", "utf8");
	for(const lean of ["Option α", "Except ε α", "Prod α β / tuples"])
		assert.match(row(source, lean), /Installed checks passed \(input, result, field\)/u);
	assert.match(row(source, "Option α"), /Some/u);
	assert.match(row(source, "Except ε α"), /Ok.*Err/u);
	assert.match(row(source, "Prod α β / tuples"), /two.*Array|Array.*two/u);
	assert.match(source, /Some\.new\(nil\)/u);
	assert.match(source, /Some\.new\(Some\.new\(API::UNIT\)\)/u);
	assert.match(source, /in Err\(value\)/u);
	assert.match(source, /Ruby object-identity equality/u);
});

test("Python compound docs retain presence and branch identity in installed mappings", async () => {
	const source = await readFile("docs/consume/python.md", "utf8");
	for(const lean of ["Option α", "Except ε α", "Prod α β / tuples"])
		assert.match(row(source, lean), /Installed checks passed \(input, result, field\)/u);
	assert.match(row(source, "Option α"), /Some\[T\]/u);
	assert.doesNotMatch(row(source, "Option α"), /collapses nested Option/u);
	assert.match(source, /Some\(Some\(None\)\)/u);
});

test("Rust compound docs distinguish domain results from bridge errors", async () => {
	const source = await readFile("docs/consume/rust.md", "utf8");
	for(const lean of ["Option α", "Except ε α", "Prod α β / tuples"])
		assert.match(row(source, lean), /Installed checks passed \(input, result, field\)/u);
	assert.match(row(source, "Option α"), /`&Option<T>`/u);
	assert.match(row(source, "Except ε α"), /`Result<T, E>`/u);
	assert.match(source, /Result<Result<T, E>, Error>/u);
	assert.match(source, /Some\(Some\(\(\)\)\)/u);
});

test("C# compound docs preserve nested options and separate domain errors from bridge failures", async () => {
	const source = await readFile("docs/consume/dotnet.md", "utf8");
	for(const lean of ["Option α", "Except ε α", "Prod α β / tuples"])
		assert.match(row(source, lean), /Installed checks passed \(input, result, field\)/u);
	assert.match(row(source, "Option α"), /`Option<T>`/u);
	assert.match(row(source, "Except ε α"), /`Result<T, E>`/u);
	assert.match(source, /IsSome/);
	assert.match(source, /default\(Result<T, E>\)/);
	assert.match(source, /Option<Option<Unit>>\.Some\(Option<Unit>\.None\)/);
});

for(const profile of ["java", "kotlin"]) test(`${profile} compound docs show installed boxed payloads and generated products`, async () => {
	const source = await readFile(`docs/consume/${profile}.md`, "utf8");
	for(const lean of ["Option α", "Except ε α", "Prod α β / tuples"])
		assert.match(row(source, lean), /Installed checks passed \(input, result, field\)/u);
	assert.match(row(source, "Option α"), /`Option<T>`/u);
	assert.match(row(source, "Except ε α"), /`Result<T, E>`/u);
	assert.match(row(source, "Prod α β / tuples"), /Pair<A, B>/u);
	assert.match(source, /box(?:ed|ing)/u);
	assert.match(source, /IllegalStateException/u);
	assert.match(source, /Option\.some\(Option\.(?:<Unit>)?none/);
	if(profile === "kotlin") assert.match(source, /Import `Pair` explicitly to distinguish it from `kotlin\.Pair`/u);
});

test("recorded result and arbitrary-integer rejections exercise real generator guards", () => {
	const apply = constructor => ({ kind: "apply", constructor, arguments: [{ kind: "primitive", name: "uint32" }, { kind: "primitive", name: "string" }] });
	for(const [generate, type, code] of [
		[generatePhpBindingPackage, apply("result"), "unsupported-result-type"]
		, [generateRustBindingPackage, { kind: "primitive", name: "nat" }, "unsupported-arbitrary-integer"]
	]){
		const ir = structuredClone(alpha.bindingIr);
		ir.types.find(type => type.name === "Payload").fields[1].type = type;
		assert.throws(() => generate(ir), error => error.code === code, code);
	}
	const ir = structuredClone(alpha.bindingIr);
	ir.types.find(type => type.name === "Payload").fields[1].type = apply("result");
	assert.match(generateCBindingPackage(ir)["include/lean_alpha.h"], /uint8_t is_ok;/);
});
