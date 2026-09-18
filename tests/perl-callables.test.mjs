/**
 * Install primitive callback and closure packages from independently reviewed
 * signatures as well as ordinary Lean source. No build tree reaches the caller.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, lstat, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { buildElaboratedComponent } from "../src/build/elaborated-component.mjs";
import { createNativeModel } from "../src/build/native-model.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { callableArities, callableSignatures, callableReviewedIr } from "./helpers/callable-fixture.mjs";
import { nativeFixtureEnvironment, installCopiedConsumer } from "./helpers/copied-fixture-install.mjs";

const enabled = process.env.LEAN_BRIDGE_PERL_CALLABLE_TEST === "1";
const json = async path => JSON.parse(await readFile(path, "utf8"));
const type = value => value.kind === "primitive" ? value.name
	: { callback: { parameters: value.parameters.map(type), result: type(value.result) } };

test("installed Perl callbacks and returned closures preserve all nineteen primitives on both source paths", { skip: !enabled, timeout: 900_000 }, async t => {
	const reports = [];
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-callable-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-callable-consumer-"));
		t.after(() => Promise.all([directory, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(directory, "project"), outputRoot = join(directory, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/callables", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Callables"]
			, targets: { cpan: { module: "LeanBridge::Callables", version: "1.000" } }
			, ...(path === "ordinary-source" ? { exports: callableSignatures.map(entry => entry.name), arities: callableArities } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "callables.binding-ir.json", canonicalJson(callableReviewedIr()));
		const environment = nativeFixtureEnvironment(["perl"]);
		t.diagnostic(`${path}: compiling the 58-export callable library`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["cpan"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = await json(join(outputRoot, "native/component/model.json"));
		const signatures = model.exports.map(entry => ({ name: entry.name, parameters: entry.parameters.map(parameter => type(parameter.type)), result: type(entry.result) }));
		const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
		assert.deepEqual(sort(signatures), sort(callableSignatures));
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		await rm(directory, { recursive: true, force: true });
		t.diagnostic(`${path}: offline installation and execution without author compilers`);
		const observation = await installCopiedConsumer({ profile: "perl"
			, consumer, handoff
			, packages: receipt.packages, environment
			, fixture: { source: () => readFile("tests/fixtures/callable-consumers/perl.pl", "utf8"), parseResult: JSON.parse } });
		assert.equal(observation.result.primitives.length, 19);
		assert.equal(observation.result.wordBits, 64);
		assert.ok(observation.result.primitives.every(item => item.checks > 100 && item.rejectedCases >= 3));
		const { command, ...observed } = observation; void command;
		reports.push({ profile: "perl", path, signatures
			, ...observed
			, packages: receipt.packages
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(canonicalJson(model))
			, receiptSha256: sha256(await readFile(join(handoff, "package-set-receipt.json")))
			, sourceRemovedBeforeInstallation: true });
		await rm(consumer, { recursive: true, force: true });
	}
	const reportPath = resolve(process.env.LEAN_BRIDGE_CALLABLE_REPORT ?? "build/callables/perl.json");
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports }));
});

test("fresh Lean rejects changed reviewed callback and returned-closure signatures before linking", { skip: !enabled, timeout: 180_000 }, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-callable-mismatch-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const projectRoot = join(directory, "project"), outputRoot = join(directory, "component");
	await cp("tests/fixtures/onboarding/callables", projectRoot, { recursive: true });
	await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["Callables"] }));
	const selected = callableSignatures.filter(item => ["Callables.callChar", "Callables.makeISize"].includes(item.name));
	const variants = [
		{ name: "Char callback argument is not UInt32", change: signatures => { signatures[0].parameters[1].callback.parameters[0] = "uint32"; } }
		, { name: "Char callback result is not UInt32", change: signatures => { signatures[0].parameters[1].callback.result = "uint32"; } }
		, { name: "ISize closure result is not Int64", change: signatures => { signatures[1].result.callback.result = "int64"; } }
		, { name: "returned closure arity must match its remaining arguments", change: signatures => { signatures[1].parameters.push("bool"); } }
	];
	for(const variant of variants)
	{
		const signatures = structuredClone(selected); variant.change(signatures);
		await saveLakeFile(projectRoot, "callables.binding-ir.json", canonicalJson(callableReviewedIr(signatures)));
		const before = await lakeInputState(projectRoot);
		await assert.rejects(() => buildElaboratedComponent({ projectRoot, outputRoot
			, leanPrefix: nativeFixtureEnvironment(["perl"]).LEAN_BRIDGE_LEAN_PREFIX
			, targets: ["cpan"], profile: "native-library-v1"
			, receiptName: "native-component.json", createModel: createNativeModel
			, compileComponent: () => assert.fail("Mismatched signature reached native linking")
		}), error => {
			assert.equal(error.code, "reviewed-ir-source-mismatch", `${variant.name}: ${error.message}`);
			return true;
		});
		await assert.rejects(() => lstat(outputRoot), { code: "ENOENT" });
		assert.deepEqual(await lakeInputState(projectRoot), before);
	}
});
