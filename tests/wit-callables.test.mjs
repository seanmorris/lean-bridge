/**
 * Installed native WIT callbacks and Lean closures on both source paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { callableArities, callableReviewedIr } from "./helpers/callable-fixture.mjs";
import { witCallableSignatures } from "./helpers/wit-callable-fixture.mjs";
import { witCallableConsumer } from "./helpers/wit-callable-consumer.mjs";
import { nativeFixtureEnvironment, installCopiedConsumer } from "./helpers/copied-fixture-install.mjs";

const type = value => value.kind === "primitive" ? value.name : { callback: { parameters: value.parameters.map(type), result: type(value.result) } };

test("installed WIT callbacks and Lean closures preserve nineteen primitives on both source paths", { skip: process.env.LEAN_BRIDGE_WIT_CALLABLE_TEST !== "1", timeout: 900_000 }, async t => {
	const reports = [], unary = { callback: { parameters: ["uint32"], result: "uint32" } };
	const expectedSignatures = [...witCallableSignatures
		, { name: "Callables.retainCallback", parameters: [unary], result: unary }
		, { name: "Callables.makeAdder", parameters: ["uint32"], result: unary }];
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-wit-callable-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-wit-callable-consumer-"));
		t.after(() => Promise.all([directory, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(directory, "project"), outputRoot = join(directory, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/callables", projectRoot, { recursive: true });
		for(const name of ["Lifetimes", "Dotnet", "Wit"]) await saveLakeFile(projectRoot, `Callables/${name}.lean`, await readFile(`tests/fixtures/callable-consumers/${name}.lean`, "utf8"));
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Callables", "Callables.Lifetimes", "Callables.Dotnet", "Callables.Wit"]
			, targets: { "wit-wasi": { name: "callables", version: "1.0.0" } }
			, ...(path === "ordinary-source" ? { exports: expectedSignatures.map(entry => entry.name), arities: { ...callableArities, "Callables.retainCallback": 1, "Callables.makeWide": 1, "Callables.makeAdder": 1 } } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "callables.binding-ir.json", canonicalJson(callableReviewedIr(expectedSignatures)));
		const environment = nativeFixtureEnvironment(["wit-wasi"]);
		t.diagnostic(`${path}: compiling 63 exports and the native WIT callable host`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["wit-wasi"], environment }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		const signatures = model.exports.map(entry => ({ name: entry.name, parameters: entry.parameters.map(parameter => type(parameter.type)), result: type(entry.result) }));
		const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
		assert.deepEqual(sort(signatures), sort(expectedSignatures));
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		await rm(directory, { recursive: true, force: true });
		t.diagnostic(`${path}: compile and run from the installed archive with producer and Lean removed`);
		const { command, ...observed } = await installCopiedConsumer({ profile: "wit-wasi"
			, consumer, handoff
			, packages: receipt.packages, environment
			, fixture: { source: witCallableConsumer, success: "callable-wit-ok", wit: [/resource function-uint32-to-uint32;/u, /borrow<function-string-to-string>/u, /make-char: func\([^\n]+\) -> function-bool-char-to-char;/u] } });
		assert.ok(command);
		reports.push({ profile: "wit-wasi", path, signatures
			, ...observed
			, packages: receipt.packages
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(canonicalJson(model))
			, receiptSha256: sha256(await readFile(join(handoff, "package-set-receipt.json")))
			, sourceRemovedBeforeInstallation: true });
		await rm(consumer, { recursive: true, force: true });
	}
	const reportPath = resolve(process.env.LEAN_BRIDGE_WIT_CALLABLE_REPORT ?? "build/callables/wit.json");
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports }));
});
