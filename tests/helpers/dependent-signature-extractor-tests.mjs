/**
 * Fresh-Lean extraction for the ordinary and independently reviewed direct dependency.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
	copyFile, mkdtemp, readFile, rm, writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import {
	compilerExportSelection
} from "../../src/analyze/export-configuration.mjs";
import {
	createMetadataRequest, identifyLeanInterface, validateElaboratedMetadata
} from "../../src/analyze/elaborated-metadata.mjs";
import { projectElaboratedMetadata } from "../../src/analyze/project-elaborated.mjs";
import {
	reviewedContractDifference, reviewedSourceSelection
} from "../../src/analyze/reviewed-source.mjs";
import { generateJavaScriptPackage } from "../../src/backends/javascript/generate.mjs";
import { assertJsonSchema } from "./json-schema.mjs";
import {
	dependentSignatureFixture, dependentSignatureRefinement
	, dependentSignatureReview, dependentSignatureSelection
} from "./dependent-signature-fixture.mjs";

const enabled = process.env.LEAN_BRIDGE_DEPENDENT_SIGNATURE_TEST === "1";

const reviewInput = document => {
	const source = canonicalJson(document);
	return {
		schemaVersion: 1, path: "api.binding-ir.json", source
		, sourceSha256: sha256(source), semanticSha256: hashBindingIr(document)
	};
};

test("fresh Lean extracts the live earlier Nat dependency on both author routes", {
	skip: !enabled, timeout: 120_000
}, async t => {
	const directory = await mkdtemp(join(
		tmpdir(), "lean-bridge-dependent-signature-extractor-"
	));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const lean = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX
		?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2", "bin/lean");
	const extractor = resolve("src/analyze/NativeExports.lean");
	const source = resolve(dependentSignatureFixture, "DependentSignatures.lean");
	await copyFile(source, join(directory, "DependentSignatures.lean"));
	const environment = {
		...process.env, LEAN_PATH: directory
		, PATH: `${dirname(lean)}:${process.env.PATH ?? "/usr/bin:/bin"}`
	};
	const run = async args => {
		try
		{
			return await promisify(execFile)(lean, args, {
				cwd: directory, env: environment, maxBuffer: 16 * 1024 * 1024
				, signal: t.signal
			});
		}
		catch(error)
		{
			error.message += `\n${error.stdout ?? ""}\n${error.stderr ?? ""}`;
			throw error;
		}
	};
	assert.deepEqual(await run([
		"-o", "DependentSignatures.olean", "DependentSignatures.lean"
	]), { stdout: "", stderr: "" });
	const interfaceIdentity = await identifyLeanInterface(join(
		directory, "DependentSignatures.olean"
	));
	const sourceBytes = await readFile(source);
	const context = {
		toolchain: "leanprover/lean4:v4.32.2"
		, leanCompilerSha256: sha256(await readFile(lean))
		, extractorSha256: sha256(await readFile(extractor))
		, modules: [{
			name: "DependentSignatures"
			, sourcePath: "DependentSignatures.lean"
			, sourceSha256: sha256(sourceBytes)
			, interfaceSha256: interfaceIdentity.interfaceSha256
		}]
	};
	const reviewedDocument = dependentSignatureReview();
	const review = reviewInput(reviewedDocument);
	const observations = [];
	for(const route of ["ordinary-source", "reviewed-ir"])
	{
		const selected = dependentSignatureSelection(route);
		const selection = route === "ordinary-source"
			? { exports: selected.configuration.exports
				, ...compilerExportSelection(selected.configuration) }
			: reviewedSourceSelection(review);
		const request = createMetadataRequest({
			profile: "component-scalars-v1"
			, modules: ["DependentSignatures"]
			, exportModules: ["DependentSignatures"]
			, resources: [], arities: [], ...selection
		}, {
			...context
			, ...(route === "reviewed-ir"
				? { reviewedBindingIrSha256: sha256(canonicalJson(review)) } : {})
		});
		const requestPath = join(directory, `${route}-request.json`);
		await writeFile(requestPath, canonicalJson(request));
		const extracted = await run([
			"--run", extractor, "--metadata", requestPath
		]);
		assert.equal(extracted.stderr, "");
		const report = JSON.parse(extracted.stdout);
		await assertJsonSchema("elaborated-export-metadata", report);
		validateElaboratedMetadata(report, request);
		const declaration = report.modules[0].declarations.find(
			item => item.identity === "DependentSignatures.dependent"
		);
		assert.equal(declaration.selected, true);
		assert.equal(declaration.projection.status, "supported");
		assert.deepEqual(
			declaration.projection.parameters[1].type.predicate
			, dependentSignatureRefinement
		);
		const analysis = projectElaboratedMetadata({
			project: {
				name: "dependentsignatures", version: "1.0.0"
				, toolchain: context.toolchain
			}
			, inputs: [], sourceTreeSha256: sha256(sourceBytes)
		}, [{ module: "DependentSignatures", path: "DependentSignatures.lean" }]
		, { request, metadata: report });
		const binding = analysis.bindingIr.document.declarations[0];
		assert.deepEqual(
			binding.source.extensions["lean-lang.org/refinements"]
			, { parameters: [null, dependentSignatureRefinement], result: null }
		);
		assert.equal(reviewedContractDifference(
			reviewedDocument, analysis.bindingIr.document
		), null);
		const generated = generateJavaScriptPackage(analysis.bindingIr.document);
		assert.match(generated["index.mjs"]
			, /assertFin\(arg1, arg0, "dependent\.arg1"\)/u);
		observations.push({ route
			, requestSha256: sha256(canonicalJson(request))
			, metadataSha256: sha256(extracted.stdout) });
	}
	assert.deepEqual(observations.map(item => item.route)
		, ["ordinary-source", "reviewed-ir"]);
	assert.equal(new Set(observations.map(
		item => item.metadataSha256
	)).size, 2);
});
