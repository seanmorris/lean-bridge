/**
 * Installed Perl aliases on independent source paths and the selected Perl ABIs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { sourceApiIdentity } from "../src/analyze/semantic-model.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { nativeAliasReviewedIr, nativeAliasSignatures } from "./helpers/native-alias-fixture.mjs";
import { nativeFixtureEnvironment } from "./helpers/copied-fixture-install.mjs";
import { preparePerlAliases } from "./helpers/perl-alias-install.mjs";

const contract = ir => ({
	declarations: ir.declarations.map(item => ({ id: item.id, parameters: item.parameters.map(p => p.type), result: item.result.type })).sort((a, b) => a.id.localeCompare(b.id))
	, types: ir.types.map(type => ({ id: type.id, name: type.name, kind: type.kind
		, representation: type.representation, mutability: type.mutability
		, typeParameters: type.typeParameters, target: type.target
		, fields: type.fields.map(({ name, type }) => ({ name, type }))
		, cases: type.cases })).sort((a, b) => a.id.localeCompare(b.id))
});

test("installed Perl aliases preserve named contracts and target semantics on both source paths", { skip: process.env.LEAN_BRIDGE_PERL_ALIAS_TEST !== "1", timeout: 900_000 }, async t => {
	const reports = [], environment = nativeFixtureEnvironment(["perl"]);
	const perls = JSON.parse(process.env.LEAN_BRIDGE_PERLS ?? environment.LEAN_BRIDGE_PERLS);
	environment.LEAN_BRIDGE_PERLS = JSON.stringify(perls);
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-perl-alias-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-perl-alias-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/native-aliases", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Aliases"]
			, targets: { cpan: { module: "LeanBridge::Aliases", version: "1.000" } }
			, ...(path === "ordinary-source" ? { exports: nativeAliasSignatures.map(item => item.name) } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(nativeAliasReviewedIr()));
		t.diagnostic(`${path}: compiling aliases for ${perls.length} Perl ABIs`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["cpan"], environment }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		assert.deepEqual(contract(model.bindingIr), contract(nativeAliasReviewedIr()));
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		await rm(author, { recursive: true, force: true });
		const prepared = [];
		for(const [index, perl] of perls.entries())
		{
			t.diagnostic(`${path}: installing offline and relocating ${perl}`);
			prepared.push(await preparePerlAliases({ consumer: join(consumer, `abi-${index}`), handoff, packages: receipt.packages, perl, environment }));
		}
		await rm(handoff, { recursive: true, force: true });
		for(const execute of prepared)
		{
			const observation = await execute();
			t.diagnostic(`${path}/${observation.perl}/${observation.threaded ? "threaded" : "unthreaded"}: ${observation.checks} public assertions and ${observation.faults.checks} cleanup checks passed`);
			reports.push({ profile: "perl", path, contract: contract(model.bindingIr)
				, ...observation, packages: receipt.packages, receiptSha256
				, bindingIrSha256: built.bindingIrSha256
				, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
				, sourceApiSha256: sourceApiIdentity(model.bindingIr).sha256
				, modelSha256: sha256(canonicalJson(model))
				, sourceRemovedBeforeInstallation: true, producerHandoffRemoved: true });
		}
		await rm(consumer, { recursive: true, force: true });
	}
	for(let i = 0; i < perls.length; i++)
	{
		assert.deepEqual(reports[i].nativeLibraries, reports[i + perls.length].nativeLibraries);
		assert.deepEqual(reports[i].catalog, reports[i + perls.length].catalog);
	}
	await saveLakeFile("build/aliases", "perl.json", canonicalJson({ schemaVersion: 1, reports }));
});
