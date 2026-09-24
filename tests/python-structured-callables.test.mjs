/**
 * Installed structured Python callbacks and closures on both authoring paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { structuredCallableArities, structuredCallableExports, structuredCallableReviewedIr } from "./helpers/structured-callable-fixture.mjs";
import { installPythonStructuredCallables } from "./helpers/python-structured-callable-install.mjs";

const signatures = ir => {
	const type = ref => {
		if(ref.kind === "primitive") return ref;
		if(ref.kind === "apply") return { constructor: ref.constructor, arguments: ref.arguments.map(type) };
		const definition = ir.types.find(item => item.id === ref.id); assert.ok(definition, ref.id);
		if(definition.kind === "alias") return type(definition.target);
		if(definition.kind === "record") return { record: definition.fields.map(field => ({ name: field.name, type: type(field.type) })) };
		if(definition.kind === "variant") return { variant: definition.cases.map(branch => ({ name: branch.name, fields: branch.fields.map(field => ({ name: field.name, type: type(field.type) })) })) };
		assert.equal(definition.kind, "callback");
		return { callback: { parameters: definition.callable.parameters.map(site), result: site(definition.callable.result) } };
	};
	const site = value => ({ type: type(value.type), ownership: value.ownership, lifetime: value.lifetime });
	return ir.declarations.map(declaration => ({ id: declaration.id, parameters: declaration.parameters.map(site), result: site(declaration.result) })).sort((a, b) => a.id.localeCompare(b.id));
};

test("installed Python structured callbacks preserve nested values, exception cleanup and source-free closures", { skip: process.env.LEAN_BRIDGE_PYTHON_STRUCTURED_CALLABLE_TEST !== "1", timeout: 900_000 }, async t => {
	const reports = [], expected = signatures(structuredCallableReviewedIr());
	const environment = nativeFixtureEnvironment(["python"]);
	const interpreters = JSON.parse(process.env.LEAN_BRIDGE_COLLECTION_PYTHONS ?? JSON.stringify([resolve(".toolchains/python311/bin/python3.11"), resolve(".toolchains/python312/bin/python3.12")]));
	assert.equal(interpreters.length, 2);
	environment.LEAN_BRIDGE_PYTHON ??= interpreters[0];
	const checker = resolve(process.env.LEAN_BRIDGE_COLLECTION_MYPY_PYTHON ?? "build/python-collection-typecheck/bin/python");
	const checkerVersion = (await runCopied(checker, ["-I", "-m", "mypy", "--version"], process.cwd())).stdout.trim();
	assert.match(checkerVersion, /^mypy 2\.3\.1\b/);
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-python-structured-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-python-structured-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release");
		const incoming = join(consumer, "incoming"), handoff = join(consumer, "relocated");
		await cp("tests/fixtures/onboarding/structured-callables", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Structured"]
			, targets: { pypi: { name: "structured-api", version: "1.0.0" } }
			, ...path === "ordinary-source" ? { exports: structuredCallableExports()
				, arities: Object.fromEntries(Object.entries(structuredCallableArities).filter(([name]) => structuredCallableExports().includes(name))) } : {} }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "structured.binding-ir.json", canonicalJson(structuredCallableReviewedIr()));
		t.diagnostic(`${path}: compiling eight structured Python callback/closure shapes`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["pypi"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		assert.deepEqual(signatures(model.bindingIr), expected);
		const receipt = await copyPackageSetHandoff(outputRoot, incoming);
		await verifyPackageSetReceipt({ receiptPath: join(incoming, "package-set-receipt.json") });
		await rm(author, { recursive: true, force: true });
		await rename(incoming, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		t.diagnostic(`${path}: testing relocated original wheels offline on Python 3.11 and 3.12`);
		const installations = await installPythonStructuredCallables({ consumer, handoff, packages: receipt.packages, interpreters, checker });
		t.diagnostic(`${path}: ${installations[0].public.checks} public checks and ${installations[0].faults.faults} injected failures per interpreter`);
		reports.push({ profile: "python", path, installations, checkerVersion
			, signatures: expected, packages: receipt.packages
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(canonicalJson(model)), receiptSha256
			, sourceRemovedBeforeInstallation: true
			, relocatedBeforeInstallation: true });
		await rm(consumer, { recursive: true, force: true });
	}
	const reportPath = resolve(process.env.LEAN_BRIDGE_PYTHON_STRUCTURED_CALLABLE_REPORT ?? "build/structured-callables/python.json");
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports }));
});
