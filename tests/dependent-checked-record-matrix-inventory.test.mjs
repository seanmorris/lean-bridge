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
import ts from "typescript";
import { generateReferenceDocs } from "../scripts/generate-reference-docs.mjs";
import { typeGuideProfiles } from "../scripts/generate-type-docs.mjs";
import { sha256 } from "../src/capsule/node.mjs";
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

// Read only the verifier's literal index identity here. Importing each complete
// verifier repeats its historical source-closure setup; the preceding matrix
// step already executes every real verifier and remains required.
const literalExport = (source, name, path) => {
	const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest
		, true, ts.ScriptKind.JS);
	assert.equal(ast.parseDiagnostics.length, 0, path);
	const declarations = ast.statements.filter(statement =>
		ts.isVariableStatement(statement)
		&& (statement.declarationList.flags & ts.NodeFlags.Const) !== 0
		&& statement.modifiers?.some(modifier =>
			modifier.kind === ts.SyntaxKind.ExportKeyword))
		.flatMap(statement => statement.declarationList.declarations)
		.filter(declaration => ts.isIdentifier(declaration.name)
			&& declaration.name.text === name);
	assert.equal(declarations.length, 1, `${path}: ${name}`);
	const value = declarations[0].initializer;
	assert.ok(value && ts.isStringLiteral(value), `${path}: literal ${name}`);
	return value.text;
};

const readExpectedEvidenceBindings = async (read = readFile) => {
	const bindings = [];
	for(const definition of dependentCheckedRecordPromotionLanes)
	{
		const { lane, name, profiles } = definition;
		const verifier = `tests/helpers/dependent-checked-record-${lane}-evidence.mjs`;
		const source = (await read(verifier)).toString();
		const root = literalExport(source, `dependentCheckedRecord${name}Evidence`, verifier);
		assert.equal(root, `docs/evidence/dependent-checked-record-${lane}-20261021`);
		const indexSha256 = literalExport(source
			, `dependentCheckedRecord${name}EvidenceSha256`, verifier);
		assert.match(indexSha256, /^[a-f0-9]{64}$/u);
		const indexPath = `${root}/index.json`, bytes = await read(indexPath);
		assert.equal(sha256(bytes), indexSha256, indexPath);
		const index = JSON.parse(bytes);
		assert.deepEqual(index.runs.map(run => run.route)
			, dependentCheckedRecordPromotionRoutes, lane);
		const hosted = index.hostedRun;
		const artifacts = hosted.artifact.parts.map(part => ({
			path: `${root}/${part.path}`, sha256: part.sha256
		}));
		for(const route of dependentCheckedRecordPromotionRoutes)
		{
			const mode = resultOnly(route) ? "result-only" : "full";
			const files = index.files.filter(file =>
				file.path.startsWith(`${route}/`)
				|| file.path.startsWith("sources/") || file.path.startsWith("hosted/"));
			bindings.push({
				id: evidenceId(lane, route), kind: "installed"
				, revision: index.producerCommit
				, command: `node --input-type=module -e "await (await import('./${verifier}')).checkDependentCheckedRecord${name}Evidence()"`
				, scope: [
					`Hosted GitHub Actions run ${hosted.runId}, job ${hosted.job.id}, artifact ${hosted.artifact.id} rebuilt the ${mode} ${sourcePath(route)} ${profiles.join("/")} package selection.`
					, "The author routes reproduce the package, remove author sources, install without network access and replay unchanged typed callers."
					, resultOnly(route)
						? "The standalone result-only API exposes Lean-produced proof-free dependent results without checked-input metadata."
						: "The full API exercises valid and rejected dependent inputs through the selected constructor, unchanged rejected values, recovery and proof-free results."
					, "The retained archive authenticates every original artifact byte, route result, package, caller observation and selected source."
					, dependentCheckedRecordPromotionLimit
				].join(" ")
				, files: [{ path: indexPath, sha256: indexSha256 }
					, ...files.map(file => ({ path: `${root}/${file.path}`, sha256: file.sha256 }))]
				, artifacts
			});
		}
	}
	return bindings;
};
let bindingsPromise;
const expectedEvidenceBindings = () => bindingsPromise ??= readExpectedEvidenceBindings();

const assertInventory = async (inventory, irSchema, consumers) => {
	const bindings = await expectedEvidenceBindings();
	assert.equal(bindings.length, 44);
	const retained = inventory.evidence.filter(item =>
		item.id.startsWith("dependent-checked-record-")
		&& item.id.endsWith("-hosted-installed"));
	assert.deepEqual(retained.map(item => item.id), bindings.map(item => item.id)
		, "Dependent evidence must contain exactly the pinned archive routes");
	for(const [index, expected] of bindings.entries())
	{
		const actual = retained[index];
		assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), expected.id);
		for(const key of ["kind", "revision", "command", "scope"])
			assert.equal(actual[key], expected[key], `${expected.id}/${key}`);
		assert.deepEqual(actual.files, expected.files, `${expected.id}/files`);
		assert.deepEqual(actual.artifacts, expected.artifacts, `${expected.id}/artifacts`);
	}
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
};

test("public inventory contains exactly 68 dependent checked-record cells"
	, async () => assertInventory(...await readInventory())
);

test("dependent inventory rejects altered retained source digests"
	, async () => {
	const [inventory, irSchema, consumers] = await readInventory();
	const target = evidenceId("browser", "ordinary-source");
	const changed = {
		...inventory, evidence: inventory.evidence.map(item => item.id !== target
			? item : { ...item, files: item.files.map((file, index) => index === 0
				? { ...file, sha256: "0".repeat(64) } : file) })
	};
	await assert.rejects(assertInventory(changed, irSchema, consumers));
	}
);

test("dependent inventory rejects incomplete, forged and cross-route evidence bindings"
	, async () => {
	const [inventory, irSchema, consumers] = await readInventory();
	const target = evidenceId("browser", "ordinary-source");
	const original = inventory.evidence.find(item => item.id === target);
	const foreign = inventory.evidence.find(item =>
		item.id === evidenceId("native", "ordinary-source"));
	const otherRoute = inventory.evidence.find(item =>
		item.id === evidenceId("browser", "result-only-reviewed-ir"));
	assert.ok(original && foreign && otherRoute);
	const replace = changed => ({ ...inventory, evidence: inventory.evidence.map(item =>
		item.id === target ? changed : item) });
	for(const changed of [
		{ ...original, revision: "0".repeat(40) }
		, { ...original, command: "true" }
		, { ...original, scope: original.scope + " Unobserved extra support." }
		, { ...original, kind: "inspection" }
		, { ...original, files: original.files.slice(1) }
		, { ...original, files: [...original.files].reverse() }
		, { ...original, files: [...original.files, foreign.files[0]] }
		, { ...original, files: original.files.map((file, index) => index === 1
			? { ...file, sha256: "0".repeat(64) } : file) }
		, { ...original, files: foreign.files }
		, { ...original, files: otherRoute.files }
		, { ...original, artifacts: foreign.artifacts }
		, { ...original, artifacts: original.artifacts.map(item =>
			({ ...item, sha256: "0".repeat(64) })) }
		, { ...original, artifacts: [] }
		, { ...original, extra: true }
	]) await assert.rejects(assertInventory(replace(changed), irSchema, consumers));
	for(const evidence of [
		inventory.evidence.filter(item => item.id !== target)
		, [...inventory.evidence, original]
		, [...inventory.evidence, { ...original
			, id: "dependent-checked-record-browser-extra-hosted-installed" }]
	]) await assert.rejects(assertInventory({ ...inventory, evidence }, irSchema, consumers));
	}
);

test("dependent index metadata requires literal verifier pins and exact archive bytes"
	, async () => {
	const index = "docs/evidence/dependent-checked-record-browser-20261021/index.json";
	const verifier = "tests/helpers/dependent-checked-record-browser-evidence.mjs";
	for(const mutate of [
		(path, bytes) => path === index ? Buffer.concat([bytes, Buffer.from(" ")]) : bytes
		, (path, bytes) => path === verifier ? Buffer.from(bytes.toString().replace(
			"export const dependentCheckedRecordBrowserEvidenceSha256"
			, "export let dependentCheckedRecordBrowserEvidenceSha256")) : bytes
		, (path, bytes) => path === verifier ? Buffer.from(bytes.toString().replace(
			/dependentCheckedRecordBrowserEvidenceSha256\s*= "([a-f0-9]+)"/u
			, "dependentCheckedRecordBrowserEvidenceSha256 = String('$1')")) : bytes
	]) await assert.rejects(readExpectedEvidenceBindings(async path =>
		mutate(path, await readFile(path))));
	await assert.rejects(readExpectedEvidenceBindings(async path => {
		if(path === index) throw new Error("Missing original archive index");
		return readFile(path);
	}), /Missing original archive index/u);
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
