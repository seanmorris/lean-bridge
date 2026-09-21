/**
 * Installed CPAN Lists on independently specified ordinary and reviewed paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { listReviewedIr, listSignatures } from "./helpers/list-fixture.mjs";
import { nativeFixtureEnvironment } from "./helpers/copied-fixture-install.mjs";
import { preparePerlLists } from "./helpers/perl-list-install.mjs";

const enabled = process.env.LEAN_BRIDGE_PERL_LIST_TEST === "1";
const type = value => value.kind === "primitive" ? value.name : ["array", "list", "option"].includes(value.kind)
	? { [value.kind]: type(value.element) } : ["result", "tuple"].includes(value.kind)
		? { [value.kind]: value.arguments.map(type) } : { record: value.name, fields: Object.fromEntries(value.fields.map(field => [field.name, type(field.type)])) };

test("installed Perl Lists preserve copied values on both source paths", { skip: !enabled, timeout: 900_000 }, async t => {
	const reports = [], environment = nativeFixtureEnvironment(["perl"]);
	const perls = JSON.parse(process.env.LEAN_BRIDGE_PERLS ?? environment.LEAN_BRIDGE_PERLS);
	environment.LEAN_BRIDGE_PERLS = JSON.stringify(perls);
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-perl-list-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-perl-list-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/npm-lists", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Lists"]
			, targets: { cpan: { module: "LeanBridge::Lists", version: "1.000" } }
			, ...(path === "ordinary-source" ? { exports: listSignatures.map(item => item.name) } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(listReviewedIr()));
		t.diagnostic(`${path}: compiling Perl Lists for ${perls.length} ABIs`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["cpan"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		const signatures = model.exports.map(item => ({ name: item.name, parameters: item.parameters.map(parameter => type(parameter.type)), result: type(item.result) }));
		const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
		assert.deepEqual(sort(signatures), sort(listSignatures));
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		await rm(author, { recursive: true, force: true });
		const prepared = [];
		for(const [index, perl] of perls.entries())
		{
			t.diagnostic(`${path}: installing offline and relocating ${perl}`);
			prepared.push(await preparePerlLists({ consumer: join(consumer, `abi-${index}`), handoff, packages: receipt.packages, perl, environment }));
		}
		await rm(handoff, { recursive: true, force: true });
		for(const execute of prepared)
		{
			const observation = await execute();
			t.diagnostic(`${path}: ${observation.checks} public assertions and ${observation.faults.checks} cleanup checks passed`);
			reports.push({ profile: "perl", path, signatures
				, ...observation
				, packages: receipt.packages, receiptSha256
				, bindingIrSha256: built.bindingIrSha256
				, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
				, modelSha256: sha256(canonicalJson(model))
				, sourceRemovedBeforeInstallation: true, producerHandoffRemoved: true });
		}
		await rm(consumer, { recursive: true, force: true });
	}
	await saveLakeFile("build/lists", "perl.json", canonicalJson({ schemaVersion: 1, reports }));
});
