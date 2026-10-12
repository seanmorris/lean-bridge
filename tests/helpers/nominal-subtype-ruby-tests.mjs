/**
 * Check independent Ruby callers and explicit selections without claiming installation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { generateCopiedRubyPackage } from "../../src/backends/ruby/copied-values.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nominalSubtypeInstalledConfiguration, nominalSubtypeInstalledReview } from "./nominal-subtype-installed-fixture.mjs";
import { nominalSubtypeRubyRoutes, nominalSubtypeRubyModes, nominalSubtypeRubyConfiguration, nominalSubtypeRubyCaller, nominalSubtypeRubyCounts, nominalSubtypeRubySelection, parseNominalSubtypeRubyResult } from "./nominal-subtype-ruby-fixture.mjs";
import { assertNominalSubtypeRubyIdentity, nominalSubtypeRubyNativeEvidence } from "./nominal-subtype-ruby-package.mjs";
import { nominalSubtypeRubyGenerator, nominalSubtypeRubyOriginal } from "./nominal-subtype-ruby-generators.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const ruby = process.env.LEAN_BRIDGE_RUBY ?? resolve(".toolchains/ruby33/bin/ruby");
// Contract-only jobs need no Ruby installation. Explicit selections must execute.
const callerControls = process.env.LEAN_BRIDGE_RUBY !== undefined || existsSync(ruby);

test("nominal Ruby configurations preserve both author routes and constructor-free results", async () => {
	for(const route of nominalSubtypeRubyRoutes) for(const mode of nominalSubtypeRubyModes)
	{
		const actual = nominalSubtypeRubyConfiguration(route, mode);
		const expected = nominalSubtypeInstalledConfiguration(route, ["c"], mode === "result-only");
		assert.deepEqual({ ...actual, targets: expected.targets }, expected);
		assert.deepEqual(actual.targets, { rubygems: { name: "nominalsubtypes", version: "1.0.0" } });
		if(mode === "result-only") assert.equal(actual.contracts, undefined);
	}
	assert.equal(await nominalSubtypeRubyCaller("reviewed"), (await nominalSubtypeRubyCaller("ordinary")).replaceAll(/arg([01])/gu, "value$1"));
	assert.throws(() => nominalSubtypeRubyConfiguration("unknown", "full"));
	assert.throws(() => nominalSubtypeRubyConfiguration("ordinary", "unknown"));
	await assert.rejects(nominalSubtypeRubyCaller("unknown"));
	for(const mode of nominalSubtypeRubyModes)
	{
		const counts = nominalSubtypeRubyCounts[mode];
		assert.deepEqual(parseNominalSubtypeRubyResult(JSON.stringify(counts), mode), counts);
		for(const key of Object.keys(counts))
			assert.throws(() => parseNominalSubtypeRubyResult(JSON.stringify({ ...counts, [key]: counts[key] + 1 }), mode));
		assert.throws(() => parseNominalSubtypeRubyResult(JSON.stringify({ ...counts, extra: 1 }), mode));
	}
	assert.throws(() => parseNominalSubtypeRubyResult("{}", "unknown"));
});

test("nominal Ruby gates reject disabled explicit work, misspellings and duplicate selections", () => {
	const prefix = "LEAN_BRIDGE_NOMINAL_SUBTYPE_RUBY_", enabled = { [prefix + "TEST"]: "1" };
	assert.deepEqual(nominalSubtypeRubySelection({}), { enabled: false, routes: ["ordinary", "reviewed"], modes: ["full", "result-only"] });
	assert.equal(nominalSubtypeRubySelection(enabled).enabled, true);
	for(const flag of ["", "true", "yes", "2"]) assert.throws(() => nominalSubtypeRubySelection({ [prefix + "TEST"]: flag }));
	for(const [name, valid] of [["ROUTES", "ordinary"], ["MODES", "full"]])
	{
		for(const raw of ["", "unknown", `${valid},`, `${valid},${valid}`])
			assert.throws(() => nominalSubtypeRubySelection({ ...enabled, [prefix + name]: raw }));
		for(const flag of [undefined, "0"])
			assert.throws(() => nominalSubtypeRubySelection({ [prefix + "TEST"]: flag, [prefix + name]: valid }));
		assert.deepEqual(nominalSubtypeRubySelection({ ...enabled, [prefix + name]: valid })[name.toLowerCase()], [valid]);
	}
	assert.throws(() => nominalSubtypeRubySelection({ [prefix + "OUTPUT"]: "explicit" }));
});

test("independent nominal Ruby caller detects wrong constructors, missing results and rejected-input mutation", {
	skip: !callerControls && "Select LEAN_BRIDGE_RUBY to execute the Ruby caller controls"
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-ruby-controls-"));
	t.after(() => rm(root, { recursive: true }));
	for(const route of nominalSubtypeRubyRoutes) for(const mode of nominalSubtypeRubyModes)
	{
		await saveLakeFile(root, `${route}.rb`, await nominalSubtypeRubyCaller(route));
		const args = ["--disable-gems"
			, resolve("tests/helpers/nominal-subtype-ruby-model.rb")
			, join(root, `${route}.rb`), route === "ordinary" ? "arg" : "value", mode];
		const run = await runCopied(ruby, args, root);
		assert.equal(run.stderr, "");
		assert.deepEqual(JSON.parse(run.stdout), { ...nominalSubtypeRubyCounts[mode], callerMutationControls: mode === "full" ? 15 : 8 });
	}
});

test("nominal Ruby declarations keep named variants, transparent aliases and separate result-only exports", () => {
	for(const mode of nominalSubtypeRubyModes)
	{
		const review = nominalSubtypeInstalledReview(mode === "result-only"), before = structuredClone(review);
		const files = generateCopiedRubyPackage(review), source = files["lib/lean_bridge/nominalsubtypes.rb"];
		assert.deepEqual(review, before);
		for(const name of ["Envelope", "AliasPair", "Event::Empty", "Event::Box", "Event::Choices"])
			assert.match(source, new RegExp(`^ {4}class ${name}(?: < Event)?$`, "mu"));
		assert.ok(source.includes("# EnvelopeAlias = Envelope; Ruby: LeanBridge::Nominalsubtypes::Envelope"));
		assert.equal([...source.matchAll(/^ {4}def /gmu)].length, mode === "full" ? 26 : 13);
		assert.equal(source.includes("    def first("), mode === "full");
		assert.equal(source.includes("    class Pair\n"), mode === "full");
		assert.ok(files["binding-manifest.json"].includes('"ruby-copied-v1"'));
	}
});

test("nominal Ruby package identity rejects coordinate, floor, source and runtime drift", () => {
	// Synthetic identities test admission only, not installation or Lean execution.
	const model = { bindingIrSha256: "a".repeat(64), component: { id: "synthetic" }, sourceIdentity: { fixture: true } };
	const pkg = { target: "rubygems", ecosystem: "rubygems", role: "component"
		, profile: "native-library-v1", runtimeDelivery: "embedded", requires: []
		, name: "nominalsubtypes", version: "1.0.0", runtimeIdentity: "b".repeat(64)
		, artifacts: [{ path: "archives/nominalsubtypes-1.0.0-x86_64-linux.gem" }] };
	const receipt = { schemaVersion: 1
		, kind: "lean-bridge-ordinary-rubygems-package"
		, ecosystem: "rubygems", namespace: "LeanBridge::Nominalsubtypes"
		, requirePath: "lean_bridge/nominalsubtypes"
		, name: pkg.name, version: pkg.version
		, runtimeIdentity: pkg.runtimeIdentity
		, ...model
		, glibcMinimumVersion: "2.36" };
	assertNominalSubtypeRubyIdentity(receipt, pkg, model, "2.36");
	for(const key of Object.keys(receipt))
	{
		assert.throws(() => assertNominalSubtypeRubyIdentity({ ...receipt, [key]: "changed" }, pkg, model, "2.36"));
		const missing = { ...receipt }; delete missing[key];
		assert.throws(() => assertNominalSubtypeRubyIdentity(missing, pkg, model, "2.36"));
	}
	for(const key of Object.keys(pkg))
		assert.throws(() => assertNominalSubtypeRubyIdentity(receipt, { ...pkg, [key]: "changed" }, model, "2.36"));
	assert.throws(() => assertNominalSubtypeRubyIdentity(receipt, { ...pkg, artifacts: [] }, model, "2.36"));
	assert.throws(() => assertNominalSubtypeRubyIdentity(receipt, { ...pkg, artifacts: [...pkg.artifacts, ...pkg.artifacts] }, model, "2.36"));
	assert.throws(() => assertNominalSubtypeRubyIdentity(receipt, pkg, model, "2.38"));
});

test("nominal Ruby loader reconstruction preserves producer ordering and rejects substituted native identities", () => {
	const file = digit => ({ sha256: digit.repeat(64), bytes: 1 });
	const runtime = { files: { "include/runtime.h": file("1"), "lib/libruntime.so": file("2") } };
	const identity = { runtimeIdentity: sha256(canonicalJson(runtime)), bindingIrSha256: "3".repeat(64) };
	const component = { ...identity, library: "libcomponent.so", nativeLibrary: file("4") };
	const adapter = { ...identity, library: "libadapter.so"
		, componentReceiptSha256: sha256(canonicalJson(component))
		, files: { "lib/libadapter.so": file("5") } };
	const receipt = { ...identity, component: { id: "synthetic" }
		, files: { "lib/lean_bridge/nominalsubtypes/native/linux-x64/libruntime.so": file("2")
			, "lib/lean_bridge/nominalsubtypes/native/linux-x64/libcomponent.so": file("4")
			, "lib/lean_bridge/nominalsubtypes/native/linux-x64/libadapter.so": file("5") } };
	const evidence = nominalSubtypeRubyNativeEvidence(receipt, component, adapter, runtime);
	assert.deepEqual(Object.keys(evidence.libraries), ["libadapter.so", "libcomponent.so", "libruntime.so"]);
	const reordered = { ...receipt, files: Object.fromEntries(Object.entries(receipt.files).reverse()) };
	assert.equal(JSON.stringify(nominalSubtypeRubyNativeEvidence(reordered, component, adapter, runtime)), JSON.stringify(evidence));
	const bad = structuredClone(receipt); bad.files["lib/lean_bridge/nominalsubtypes/native/linux-x64/libcomponent.so"].sha256 = "0".repeat(64);
	assert.throws(() => nominalSubtypeRubyNativeEvidence(bad, component, adapter, runtime));
	assert.throws(() => nominalSubtypeRubyNativeEvidence(receipt, { ...component, runtimeIdentity: "0".repeat(64) }, adapter, runtime));
	assert.throws(() => nominalSubtypeRubyNativeEvidence(receipt, component, { ...adapter, componentReceiptSha256: "0".repeat(64) }, runtime));
});

test("nominal Ruby evidence loads the complete frozen generator source closure", async t => {
	const revision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
	const generator = await nominalSubtypeRubyGenerator(revision);
	assert.ok(generator.paths.includes("src/backends/ruby/copied-values.mjs"));
	assert.ok(generator.paths.includes("src/backends/ruby/copied-conversions.mjs"));
	assert.equal(new Set(generator.paths).size, generator.paths.length);
	for(const mode of nominalSubtypeRubyModes)
		assert.deepEqual(generator.generateCopiedRubyPackage(nominalSubtypeInstalledReview(mode === "result-only")), generateCopiedRubyPackage(nominalSubtypeInstalledReview(mode === "result-only")));
	const path = "src/backends/ruby/copied-values.mjs", original = nominalSubtypeRubyOriginal(revision, path);
	original.fill(0);
	assert.notEqual(nominalSubtypeRubyOriginal(revision, path)[0], 0, "Cached source must not alias mutable caller buffers");
	for(const invalid of ["HEAD", revision.slice(0, 7), "-".repeat(40)])
		assert.throws(() => nominalSubtypeRubyOriginal(invalid, path));
	for(const invalid of ["/tmp/source", "src/../package.json", "build/model.json"])
		assert.throws(() => nominalSubtypeRubyOriginal(revision, invalid));
	t.diagnostic(`${generator.paths.length} frozen transitive generator modules`);
});
