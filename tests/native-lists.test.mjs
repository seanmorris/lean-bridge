/**
 * Compiler-free C/C++ installation of independently reviewed List exports.
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
import { installCopiedConsumer, nativeFixtureEnvironment } from "./helpers/copied-fixture-install.mjs";
import { nativeListConsumer } from "./helpers/native-list-consumers.mjs";
import { checkNativeListFaults } from "./helpers/native-list-faults.mjs";
import { checkGmpListFaults } from "./helpers/c-gmp-faults.mjs";

const enabled = process.env.LEAN_BRIDGE_NATIVE_LIST_TEST === "1";
const type = value => value.kind === "primitive" ? value.name : ["array", "list", "option"].includes(value.kind)
	? { [value.kind]: type(value.element) } : ["result", "tuple"].includes(value.kind)
		? { [value.kind]: value.arguments.map(type) } : { record: value.name, fields: Object.fromEntries(value.fields.map(field => [field.name, type(field.type)])) };

test("ordinary and reviewed List packages preserve C/C++ values after offline installation", { skip: !enabled, timeout: 900_000 }, async t => {
	const reports = [], environment = nativeFixtureEnvironment(["c", "cpp"]);
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-list-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-list-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/npm-lists", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Lists"]
			, targets: { c: { name: "lists", version: "1.0.0" }, cpp: { name: "lists", version: "1.0.0" } }
			, ...(path === "ordinary-source" ? { exports: listSignatures.map(item => item.name) } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(listReviewedIr()));
		t.diagnostic(`${path}: compiling C and C++`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["c", "cpp"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		const signatures = model.exports.map(item => ({ name: item.name, parameters: item.parameters.map(parameter => type(parameter.type)), result: type(item.result) }));
		const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
		assert.deepEqual(sort(signatures), sort(listSignatures));
		const faultChecks = await checkNativeListFaults(outputRoot, join(author, "native-faults"), environment);
		faultChecks.gmp = await checkGmpListFaults(outputRoot, join(author, "gmp-faults"), environment);
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		await rm(author, { recursive: true, force: true });
		for(const profile of ["c", "cpp"])
		{
			t.diagnostic(`${path}: installing ${profile}`);
			const packages = receipt.packages.filter(pkg => pkg.target === profile);
			const observation = await installCopiedConsumer({ profile
				, consumer, handoff, packages, environment
				, fixture: { source: nativeListConsumer, success: "list-ok" } });
			reports.push({ profile
				, path, signatures
				, ...observation
				, packages, faultChecks
				, bindingIrSha256: built.bindingIrSha256
				, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
				, modelSha256: sha256(canonicalJson(model))
				, receiptSha256: sha256(await readFile(join(handoff, "package-set-receipt.json")))
				, sourceRemovedBeforeInstallation: true });
			await rm(join(consumer, profile), { recursive: true, force: true });
		}
		await rm(consumer, { recursive: true, force: true });
	}
	await saveLakeFile("build/lists", "native.json", canonicalJson({ schemaVersion: 1, reports }));
});
