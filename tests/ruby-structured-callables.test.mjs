/**
 * Installed structured Ruby callbacks and closures on both authoring paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileCopiedRubyModel } from "../src/backends/ruby/copied-model.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { nativeFixtureEnvironment } from "./helpers/copied-fixture-install.mjs";
import { structuredCallableArities, structuredCallableExports, structuredCallableReviewedIr } from "./helpers/structured-callable-fixture.mjs";
import { installRubyStructuredCallables } from "./helpers/ruby-structured-callable-install.mjs";

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

test("installed Ruby structured callbacks preserve nested values, exception cleanup and source-free closures", { skip: process.env.LEAN_BRIDGE_RUBY_STRUCTURED_CALLABLE_TEST !== "1", timeout: 900_000 }, async t => {
	const reports = [], expected = signatures(structuredCallableReviewedIr());
	const environment = nativeFixtureEnvironment(["ruby"]);
	environment.LEAN_BRIDGE_RUBY ??= resolve(".toolchains/ruby33/bin/ruby");
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-ruby-structured-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-ruby-structured-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release");
		const incoming = join(consumer, "incoming"), handoff = join(consumer, "relocated");
		await cp("tests/fixtures/onboarding/structured-callables", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Structured"]
			, targets: { rubygems: { name: "structured-api", version: "1.0.0" } }
			, ...path === "ordinary-source" ? { exports: structuredCallableExports()
				, arities: Object.fromEntries(Object.entries(structuredCallableArities).filter(([name]) => structuredCallableExports().includes(name))) } : {} }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "structured.binding-ir.json", canonicalJson(structuredCallableReviewedIr()));
		t.diagnostic(`${path}: compiling eight structured Ruby callback/closure shapes`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["rubygems"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		assert.deepEqual(signatures(model.bindingIr), expected);
		const projection = compileCopiedRubyModel(model.bindingIr);
		const receipt = await copyPackageSetHandoff(outputRoot, incoming);
		await verifyPackageSetReceipt({ receiptPath: join(incoming, "package-set-receipt.json") });
		await rm(author, { recursive: true, force: true });
		await rename(incoming, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		t.diagnostic(`${path}: testing the relocated original gem offline without producer files`);
		const installation = await installRubyStructuredCallables({ consumer, handoff, packages: receipt.packages, environment, projection });
		t.diagnostic(`${path}: ${installation.public.checks} public checks and ${installation.faults.faults} injected failures`);
		reports.push({ profile: "ruby", path, installation
			, signatures: expected, packages: receipt.packages
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(canonicalJson(model)), receiptSha256
			, sourceRemovedBeforeInstallation: true
			, relocatedBeforeInstallation: true });
		await rm(consumer, { recursive: true, force: true });
	}
	const reportPath = resolve(process.env.LEAN_BRIDGE_RUBY_STRUCTURED_CALLABLE_REPORT ?? "build/structured-callables/ruby.json");
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports }));
});
