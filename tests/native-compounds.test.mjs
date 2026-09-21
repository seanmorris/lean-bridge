/**
 * Compound values through installed C and C++ packages, without producer files.
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
import { compoundReviewedIr, compoundSignatures } from "./helpers/compound-source-fixture.mjs";
import { installCopiedConsumer, nativeFixtureEnvironment } from "./helpers/copied-fixture-install.mjs";
import { nativeCompoundConsumer } from "./helpers/native-compound-consumers.mjs";
import { checkGmpCompoundFaults } from "./helpers/c-gmp-faults.mjs";
import { checkNativeCompoundFaults } from "./helpers/native-compound-faults.mjs";

const enabled = process.env.LEAN_BRIDGE_NATIVE_COMPOUND_TEST === "1";
const type = value => value.kind === "primitive" ? value.name : ["array", "option"].includes(value.kind)
	? { [value.kind]: type(value.element) } : ["result", "tuple"].includes(value.kind)
		? { [value.kind]: value.arguments.map(type) } : { record: value.name, fields: Object.fromEntries(value.fields.map(field => [field.name, type(field.type)])) };

test("ordinary and reviewed compound packages preserve C/C++ values after offline installation", { skip: !enabled, timeout: 900_000 }, async t => {
	const reports = [], environment = nativeFixtureEnvironment(["c", "cpp"]);
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-compound-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-compound-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/npm-compounds", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Compounds"]
			, targets: { c: { name: "compounds", version: "1.0.0" }, cpp: { name: "compounds", version: "1.0.0" } }
			, ...(path === "ordinary-source" ? { exports: compoundSignatures.map(item => item.name) } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(compoundReviewedIr()));
		t.diagnostic(`${path}: compiling C and C++`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["c", "cpp"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		const signatures = model.exports.map(item => ({ name: item.name, parameters: item.parameters.map(parameter => type(parameter.type)), result: type(item.result) }));
		const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
		assert.deepEqual(sort(signatures), sort(compoundSignatures));
		const faultChecks = { native: await checkNativeCompoundFaults(outputRoot, join(author, "native-faults"), environment)
			, gmp: await checkGmpCompoundFaults(outputRoot, join(author, "gmp-faults"), environment) };
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		await rm(author, { recursive: true, force: true });
		for(const profile of ["c", "cpp"])
		{
			t.diagnostic(`${path}: installing ${profile}`);
			const packages = receipt.packages.filter(pkg => pkg.target === profile);
			const observation = await installCopiedConsumer({ profile
				, consumer
				, handoff
				, packages
				, environment
				, fixture: { source: nativeCompoundConsumer, success: "compound-ok" } });
			reports.push({ profile
				, path
				, signatures
				, ...observation
				, packages
				, faultChecks
				, bindingIrSha256: built.bindingIrSha256
				, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
				, modelSha256: sha256(canonicalJson(model))
				, receiptSha256: sha256(await readFile(join(handoff, "package-set-receipt.json")))
				, sourceRemovedBeforeInstallation: true });
			await rm(join(consumer, profile), { recursive: true, force: true });
		}
		await rm(consumer, { recursive: true, force: true });
	}
	await saveLakeFile("build/compounds", "native.json", canonicalJson({ schemaVersion: 1, reports }));
});
