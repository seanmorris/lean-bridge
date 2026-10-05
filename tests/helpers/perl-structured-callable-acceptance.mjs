/**
 * Independently specified copied callback values installed on every pinned ABI.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, readFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { nativeFixtureEnvironment } from "./copied-fixture-install.mjs";
import { perlGraphCommands } from "./perl-graph-probes.mjs";
import { structuredCallableArities, structuredCallableExports, structuredCallableReviewedIr } from "./structured-callable-fixture.mjs";
import { preparePerlStructuredCallables } from "./perl-structured-callable-install.mjs";
import { preparePerlStructuredFaults } from "./perl-structured-callable-faults.mjs";
import { checkPerlStructuredAssertions } from "./perl-structured-callable-fixture.mjs";

/**
 * Normalize public signatures without consulting backend-generated expectations.
 *
 * @param ir - Compiler-captured or independently reviewed IR.
 */
export const perlStructuredCallableSignatures = ir => {
	const type = ref => {
		if(ref.kind === "primitive") return ref;
		if(ref.kind === "apply") return { constructor: ref.constructor, arguments: ref.arguments.map(type) };
		const definition = ir.types.find(item => item.id === ref.id);
		assert.ok(definition, ref.id);
		if(definition.kind === "alias") return type(definition.target);
		if(definition.kind === "record")
			return { record: definition.fields.map(field => ({ name: field.name, type: type(field.type) })) };
		if(definition.kind === "variant")
			return { variant: definition.cases.map(branch => ({ name: branch.name
				, fields: branch.fields.map(field => ({ name: field.name, type: type(field.type) })) })) };
		assert.equal(definition.kind, "callback");
		return { callback: { parameters: definition.callable.parameters.map(site), result: site(definition.callable.result) } };
	};
	const site = value => ({ type: type(value.type), ownership: value.ownership, lifetime: value.lifetime });
	return ir.declarations.map(declaration => ({ id: declaration.id
		, parameters: declaration.parameters.map(site)
		, result: site(declaration.result) }))
		.sort((a, b) => a.id.localeCompare(b.id));
};

/**
 * Build, verify, remove producer sources, install and execute both source paths.
 *
 * @param directory - Explicit test-owned workspace, cleaned by the caller on failure.
 * @param diagnostic - Progress callback for compiler and ABI gates.
 */
export const checkPerlStructuredCallables = async (directory, diagnostic = () => {}) => {
	const perls = perlGraphCommands(), reports = [];
	for(const perl of perls) await checkPerlStructuredAssertions(perl);
	const environment = { ...nativeFixtureEnvironment(["perl"])
		, LEAN_BRIDGE_PERLS: JSON.stringify(perls)
		, LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR: "2.36" };
	const expected = perlStructuredCallableSignatures(structuredCallableReviewedIr());
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const root = join(directory, path), author = join(root, "author");
		const projectRoot = join(author, "project"), outputRoot = join(author, "release");
		const incoming = join(root, "incoming"), handoff = join(root, "handoff");
		await cp("tests/fixtures/onboarding/structured-callables", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Structured"]
			, targets: { cpan: { module: "LeanBridge::Structured", version: "1.000" } }
			, ...path === "ordinary-source" ? { exports: structuredCallableExports()
				, arities: Object.fromEntries(Object.entries(structuredCallableArities)
					.filter(([name]) => structuredCallableExports().includes(name))) } : {} }));
		if(path === "reviewed-ir")
			await saveLakeFile(projectRoot, "structured.binding-ir.json", canonicalJson(structuredCallableReviewedIr()));
		const before = await lakeInputState(projectRoot);
		diagnostic(`${path}: compiling structured callbacks for ${perls.length} Perl ABIs`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["cpan"], environment })
			.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		assert.deepEqual(await lakeInputState(projectRoot), before);
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		const signatures = perlStructuredCallableSignatures(model.bindingIr);
		assert.deepEqual(signatures, expected);
		assert.equal(model.exports.length, 26);
		assert.equal(model.types.filter(type => type.kind === "callback").length, 14);
		const receipt = await copyPackageSetHandoff(outputRoot, incoming);
		await verifyPackageSetReceipt({ receiptPath: join(incoming, "package-set-receipt.json") });
		await rename(incoming, handoff);
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		await rm(author, { recursive: true, force: true });
		const pending = [];
		for(const [index, perl] of perls.entries())
		{
			diagnostic(`${path}: offline install, relocation and isolated probe for ${perl}`);
			pending.push(await preparePerlStructuredCallables({ consumer: join(root, `abi-${index}`)
				, handoff, packages: receipt.packages, perl, environment
				, inspectInstalled: preparePerlStructuredFaults }));
		}
		await rm(handoff, { recursive: true, force: true });
		for(const execute of pending)
		{
			const observation = await execute();
			diagnostic(`${path}/${observation.hostVersion}: ${observation.checks} public checks, ${observation.faults.failures} injected failures`);
			reports.push({ profile: "perl", path, signatures
				, ...observation
				, packages: receipt.packages, receiptSha256
				, bindingIrSha256: built.bindingIrSha256
				, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
				, modelSha256: sha256(canonicalJson(model))
				, sourceRemovedBeforeInstallation: true
				, relocatedBeforeInstallation: true, producerInputsUnchanged: true });
		}
	}
	assert.equal(reports.length, 2 * perls.length);
	for(let i = 0; i < perls.length; i++)
	{
		assert.equal(reports[i].abiKey, reports[i + perls.length].abiKey);
		assert.equal(reports[i].checks, reports[i + perls.length].checks);
		assert.equal(reports[i].calls, reports[i + perls.length].calls);
		assert.equal(reports[i].rejected, reports[i + perls.length].rejected);
		assert.deepEqual(reports[i].nativeLibraries, reports[i + perls.length].nativeLibraries);
	}
	return { schemaVersion: 1, reports };
};
