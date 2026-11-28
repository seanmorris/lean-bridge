/**
 * Install the real Python wheel on both author routes before exercising a
 * retained Lean callable at a record field, not merely at an export result.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { ownedPythonEvidence } from "../src/build/owned-python-artifacts.mjs";
import { generateOwnedPythonValues } from "../src/backends/python/owned-values.mjs";
import { ownedHostRecordInputs, stageHostRecordInputs } from "../src/backends/c/owned-host-records.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff, retainPackageSetEvidence } from "./helpers/package-set.mjs";
import { installPythonWheel } from "./helpers/python-wheel-install.mjs";
import { leasedClosureFieldReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";

test("a record-only API generates the field's callable without a dummy callback export", () => {
	const review = leasedClosureFieldReviewedIr();
	review.declarations = review.declarations.filter(decl => ["echoTariff", "makeTariff"].includes(decl.name));
	review.types = review.types.filter(type => type.kind !== "resource");
	const surface = generateOwnedPythonValues(review, { hostCallbacks: false });
	const fn = surface.types.find(type => type.kind === "callback");
	assert.equal(surface.c.functions.length, 2);
	assert.equal(surface.c.callbacks.length, 1);
	assert.ok(surface.stub.includes(`quote: ${fn.publicType}`));
	assert.ok(surface.stub.includes("def __call__(self, arg0: int) -> int:"));
});

test("borrowed callback record parameters expose a separate input type, never a result or callback reply", () => {
	const ir=leasedClosureFieldReviewedIr({exchange: true});
	const {stub,c}=generateOwnedPythonValues(ir,{hostCallbacks: true});
	assert.match(stub,/class TariffInput:\n[\s\S]*?quote: _CallbackInput\d+/u);
	assert.match(stub,/def echo_tariff\(arg0: Tariff \| TariffInput\) -> Tariff:/u);
	assert.match(stub,/def make_tariff\(arg0: int\) -> Tariff:/u);
	assert.deepEqual(c.hostFieldCalls.map(f=>f.name).sort(),["applyTariff","echoTariff","unpackQuote"]);
});

test("scoped descriptors never replace original owners or reverse closure-only refinements", () => {
	const ir=leasedClosureFieldReviewedIr(), {c}=generateOwnedPythonValues(ir);
	const fn=c.functions.find(f=>f.name==="applyTariff"), table=new Map(c.nodes.map(n=>[n.id,n]));
	const input=functions=>ownedHostRecordInputs({ir,functions,table,names: new Map(),header: []});
	assert.equal(input([fn]).length,1);
	assert.deepEqual(input([{...fn,anchor: 0},{...fn,receiver: 0},{...fn,transfers: [0]}]),[]);
	const record=table.get(fn.parameters[0]), callback=ir.types.find(t=>t.id===record.fields[0].type);
	// Transport selection only: the compiler validates the refinement itself.
	callback.source.extensions["lean-lang.org/refinements"]={};
	assert.deepEqual(input([fn]),[]);
});

test("wide borrowed record staging uses bounded, cleared arena storage", () => {
	const ir=leasedClosureFieldReviewedIr(), type=ir.types.find(t=>t.name==="Tariff");
	type.fields=Array.from({length: 6},(_,i)=>({...type.fields[0],name: "quote"+i}));
	ir.aggregatePolicy.closureFields=type.fields.map(f=>"Owned.Tariff."+f.name);
	const {c}=generateOwnedPythonValues(ir), table=new Map(c.nodes.map(n=>[n.id,n]));
	const call=c.hostFieldCalls.find(f=>f.name==="applyTariff");
	const stage=stageHostRecordInputs(call.hostRecordSlots,table);
	assert.match(stage.prepare[0],/oc_allocate\(&input/u);
	assert.match(stage.prepare[1],/memset\(host_stage/u);
	assert.equal(stage.staged(0),"host_stage->staged0");
	assert.equal(stage.release.length,6);
	assert.ok(stage.release.every(line=>line.includes("if (host_stage)")));
});

for(const route of ["ordinary", "reviewed"]) test(`installed ${route} wheel retains callable fields without promoting host borrows`, {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 3600000
}, async t => {
	const fixture = resolve("tests/fixtures/onboarding/leased-closure-fields");
	const python = resolve(process.env.LEAN_BRIDGE_PYTHON ?? ".toolchains/python312/bin/python3.12");
	const environment = { ...nativeFixtureEnvironment(["python"]), LEAN_BRIDGE_PYTHON: python };
	const config = JSON.parse(await readFile(join(fixture, "lean-bridge.exports.json")));
	const probe = await readFile("tests/fixtures/structured-types/leased-closure-fields.py");
	const staged = await readFile("tests/fixtures/structured-types/tariff-staged.py");
	const observer = await readFile("tests/fixtures/structured-types/leased-closure-field-leases.py");
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-closure-field-"));
	try
	{
		const project = join(directory, "project"), output = join(directory, "producer"), handoff = join(directory, "handoff");
		await cp(fixture, project, { recursive: true });
		if(route === "reviewed")
		{
			await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: config.modules, targets: config.targets }));
			await saveLakeFile(project, "api.binding-ir.json", canonicalJson(leasedClosureFieldReviewedIr({ staged: true })));
		}
		else
		{
			config.exports.push("Owned.stagedQuote", "Owned.flatQuote");
			config.contracts = { "Owned.stagedQuote": JSON.parse(await readFile("tests/fixtures/structured-types/tariff-staged-contract.json")) };
			await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
		}
		const built = await buildCanonicalProject({ projectRoot: project
			, outputRoot: output, targets: ["pypi"], environment
			, onProgress: event => t.diagnostic(`${route}: ${event.message}`) });
		const projection = built.projections?.find(item => item.ecosystem === "pypi") ?? built;
		assert.equal(projection.backend, "owned-python-v1");
		const { model } = await ownedPythonEvidence({ nativeRoot: join(output, "native/component")
			, runtimeRoot: join(output, "native/runtime")
			, adapterRoot: join(output, "native/owned-c-binding") });
		assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), route === "reviewed");
		assert.deepEqual(model.bindingIr.aggregatePolicy.closureFields, ["Owned.Tariff.quote"]);
		const apply = model.bindingIr.declarations.find(fn => fn.name === "applyTariff");
		assert.ok(apply.effects.includes("host-call")); assert.equal(apply.failure.mode, "declared");
		const receipt = await copyPackageSetHandoff(output, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const digest = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		await rm(project, { recursive: true }); await rm(output, { recursive: true });
		if(process.env.LEAN_BRIDGE_TARIFF_PYTHON_REPLAY_ROOT)
			await retainPackageSetEvidence(handoff, join(resolve(process.env.LEAN_BRIDGE_TARIFF_PYTHON_REPLAY_ROOT), route));
		const pkg = receipt.packages.find(item => item.target === "pypi" && item.role === "component");
		const root = join(directory, "consumer"), archive = join(handoff, pkg.artifacts[0].path);
		const installation = await installPythonWheel({ root, archive, python });
		await rm(handoff, { recursive: true });
		const relocated = join(directory, "relocated");
		await saveLakeFile(root, "consumer.py", probe);
		await saveLakeFile(root, "inspect_leases.py", observer);
		await saveLakeFile(root, "staged_consumer.py", staged);
		await rename(root, relocated);
		const result = await runCopied(join(relocated, "venv/bin/python"), ["-I", "-B", "inspect_leases.py"], relocated);
		assert.equal(result.stderr, "");
		const [field, outputRecord, ...extra] = result.stdout.trimEnd().split("\n");
		assert.equal(field, "leased-closure-fields: ok"); assert.equal(extra.length, 0);
		const observations = JSON.parse(outputRecord);
		assert.deepEqual(observations.cases, [
			"flat scalar reply", "returned and independently owned functions"
			, "recovery checked before invocation", "original callback exception"
			, "invalid replies and later success"
			, "caller function in input record"
			, "nested caller functions"
			, "returned host field expired"
			, "field failure identity and preflight"
			, "closed field refuses without callback dispatch"
		]);
		assert.deepEqual(observations.identities, [...observations.cases.map(()=>1),0]);
		const evidence = resolve("build/leased-closure-fields-python");
		await saveLakeFile(evidence, `${route}.package-set.json`, canonicalJson(receipt));
		await saveLakeFile(evidence, `${route}.staged.json`, canonicalJson({
			schemaVersion: 1, route, packageSetSha256: digest
			, interpreter: installation.python
			, fieldConsumerSha256: sha256(probe), consumerSha256: sha256(staged)
			, probeSha256: sha256(observer), ...observations
		}));
		t.diagnostic(`${route} Python ${installation.python}: package-set ${digest}; consumer ${sha256(probe)}`);
	}
	finally
	{ await rm(directory, { recursive: true, force: true }); }
});
