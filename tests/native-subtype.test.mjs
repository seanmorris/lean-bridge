/**
 * Author-constructed Subtype values at the boundaries of installed, source-free native packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { validateNativeType } from "../src/analyze/native-types.mjs";
import { generateNativeLeanAdapters } from "../src/build/native-model.mjs";
import { nativeFinBoundPaths } from "../src/backends/native/fin-refinements.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { installNativeSubtypeConsumer, nativeSubtypeContracts, nativeSubtypeEnvironment, nativeSubtypeRefinements, nativeSubtypeTargets } from "./helpers/native-subtype-install.mjs";
import { nativeSubtypeDispatchColumns, nativeSubtypeDispatchExpected, nativeSubtypeDispatchInterposer, nativeSubtypeDispatchProbe } from "./helpers/native-subtype-dispatch.mjs";
import { copiedCleanEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { perlSubtypeDispatchColumns, perlSubtypeDispatchSteps, perlSubtypeInterposer, perlSubtypePrelude } from "./helpers/perl-subtype-dispatch.mjs";
import { prepareRustCorpusDependencies } from "./helpers/type-corpus-rust.mjs";
import "./helpers/subtype-alias-position-source-history-tests.mjs";

const profiles = process.env.LEAN_BRIDGE_SUBTYPE_PROFILES?.split(",").sort() ?? [];
assert.equal(new Set(profiles).size, profiles.length, "Duplicate Subtype profile");
assert.ok(profiles.every(profile => Object.hasOwn(nativeSubtypeTargets, profile)), "Unknown or empty Subtype profile");
const extensions = { c: "c", cpp: "cpp", python: "py", rust: "rs", dotnet: "cs", java: "java", kotlin: "kt", ruby: "rb", "php-native": "php", "wit-wasi": "c", perl: "pl" };
const fixture = "tests/fixtures/onboarding/native-subtype";
const nat = { kind: "primitive", name: "nat", lean: "Nat", abi: { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: false } };
const heap = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true };
const container = (kind, element) => ({ kind, element, abi: heap });

test("native types admit Subtype only at a top-level site over a primitive base", () => {
	const text = { kind: "primitive", name: "string", lean: "String", abi: { ...heap } };
	const word = { kind: "refinement", base: text, predicate: { kind: "subtype", constructor: "Subtypes.checkedWord" }, abi: { ...heap } };
	validateNativeType(word);
	validateNativeType({ ...word, base: nat, predicate: { kind: "subtype", constructor: "Subtypes.checkedEven" }, abi: nat.abi });
	assert.throws(() => validateNativeType(word, 1), /top-level/);
	assert.throws(() => validateNativeType(word, 0, true), /top-level/);
	assert.throws(() => validateNativeType(container("array", word)), /top-level/);
	assert.throws(() => validateNativeType(container("option", word)), /top-level/);
	assert.throws(() => validateNativeType({ ...word, predicate: { kind: "subtype", constructor: "not valid" } }), /invalid Subtype refinement/);
	assert.throws(() => validateNativeType({ ...word, predicate: { kind: "subtype" } }), /refinement predicate fields/);
	assert.throws(() => validateNativeType({ ...word, base: container("array", text), predicate: { kind: "subtype", constructor: "Subtypes.checkedWords" } }), /primitive base/);
	assert.deepEqual(nativeFinBoundPaths(nativeSubtypeRefinements["Subtypes.scale"].parameters[1], "arg1"), ["arg1 checked by Subtypes.checkedSmall"]);
	assert.deepEqual(nativeFinBoundPaths(nativeSubtypeRefinements["Subtypes.pad"].result, "result"), ["result checked by Subtypes.checkedEven"]);
});

test("Lean adapters construct each Subtype through its checked constructor and export one validator per checked parameter", () => {
	const text = { kind: "primitive", name: "string", lean: "String", abi: { ...heap } };
	const item = (name, parameters, result, refinements) => ({ name: `Subtypes.${name}`, module: "Subtypes", symbol: `lb_${name}`, parameters: parameters.map((type, i) => ({ name: `p${i}`, type })), result, refinements });
	const exports = [
		item("join", [text, text], text, { parameters: [{ kind: "subtype", constructor: "Subtypes.checkedWord" }, { kind: "subtype", constructor: "Subtypes.checkedWord" }], result: { kind: "subtype", constructor: "Subtypes.checkedWord" } })
		, item("mix", [nat, nat], nat, { parameters: [{ kind: "subtype", constructor: "Subtypes.checkedEven" }, { kind: "fin", bound: "10" }], result: null })];
	const { leanSource, header } = generateNativeLeanAdapters({ component: { id: "subtypes@1.0.0" }, pointerBits: 64, types: [], exports });
	const section = symbol => leanSource.slice(leanSource.indexOf(`@[export ${symbol}]`), leanSource.indexOf("\n\n", leanSource.indexOf(`@[export ${symbol}]`)) + 2);
	assert.equal(section("lb_join"), "@[export lb_join]\ndef f_lb_join (a0 : _root_.String) (a1 : _root_.String) : (_root_.Option _root_.String) :=\n  match _root_.Subtypes.checkedWord a0 with\n  | .some _bridgeSubtype0 =>\n    match _root_.Subtypes.checkedWord a1 with\n    | .some _bridgeSubtype1 =>\n      _root_.Option.some ((_root_.Subtypes.join _bridgeSubtype0 _bridgeSubtype1).val)\n    | .none =>\n      _root_.Option.none\n  | .none =>\n    _root_.Option.none\n\n");
	for(const index of [0, 1])
		assert.equal(section(`lb_join_refinement_${index}`), `@[export lb_join_refinement_${index}]\ndef f_lb_join_refinement_${index} (value : _root_.String) : _root_.UInt8 :=\n  match _root_.Subtypes.checkedWord value with\n  | .some _ => 1\n  | .none => 0\n\n`);
	// A Fin parameter beside a Subtype keeps its decidable guard and gets no validator.
	assert.match(section("lb_mix"), /match _root_\.Subtypes\.checkedEven a0 with\n {2}\| \.some _bridgeSubtype0 =>\n {4}if _bridgeFin1 : \(a1\) < 10 then/);
	assert.ok(leanSource.includes("@[export lb_mix_refinement_0]") && !leanSource.includes("@[export lb_mix_refinement_1]"));
	assert.ok(header.includes("uint8_t lb_join_refinement_0(lean_object * value);") && header.includes("uint8_t lb_mix_refinement_0(lean_object * value);"));
});

test("every native profile has a Subtype consumer", async () => {
	assert.deepEqual(Object.keys(nativeSubtypeTargets).sort(), Object.keys(extensions).sort());
	for(const [profile, extension] of Object.entries(extensions)) await access(`tests/fixtures/subtype-consumers/${profile}.${extension}`);
});

test("native builds reject Subtype outside top-level sites and without a constructor", { skip: !profiles.includes("c"), timeout: 1_800_000 }, async t => {
	const site = constructor => ({ ownership: "copy", lifetime: null, refinement: { constructor } });
	const plain = { ownership: "copy", lifetime: null, refinement: "reject" };
	const cases = [
		["array", "def arraySite (values : Array Word) : Nat := values.size", { "Subtypes.arraySite": { parameters: [site("Subtypes.checkedWord")], result: plain } }, /Subtype refinements currently require a top-level parameter or result/]
		, ["option", "def optionSite (value : Option Word) : Nat := 0", { "Subtypes.optionSite": { parameters: [site("Subtypes.checkedWord")], result: plain } }, /Subtype refinements currently require a top-level parameter or result/]
		, ["field", "structure Box where\n  word : Word\ndef fieldSite (value : Box) : Nat := value.word.val.length", { "Subtypes.fieldSite": { parameters: [plain], result: plain } }, /Subtype refinements currently require a top-level parameter or result/]
		, ["callback", "def callbackSite (value : Word → Nat) : Nat := value ⟨\"a\", by decide⟩", { "Subtypes.callbackSite": { parameters: [plain], result: plain } }, /Subtype refinements currently require a top-level parameter or result/]
		, ["callbackAlias", "abbrev OtherWord := Word\ndef callbackAliasSite (value : OtherWord → Nat) : Nat := value ⟨\"a\", by decide⟩", { "Subtypes.callbackAliasSite": { parameters: [plain], result: plain } }, /Subtype refinements currently require a top-level parameter or result/]
		, ["callbackResult", "def callbackResultSite (value : Nat → Word) : Nat := (value 0).val.length", { "Subtypes.callbackResultSite": { parameters: [plain], result: plain } }, /Subtype refinements currently require a top-level parameter or result/]
		, ["closure", "def closureSite (_ : Nat) : Word → Nat := fun value => value.val.length", { "Subtypes.closureSite": { parameters: [plain], result: plain } }, /Subtype refinements currently require a top-level parameter or result/, 1]
		, ["missing", "def missingSite (value : Word) : Nat := value.val.length", {}, /Subtype refinements require a configured checked constructor/]
		, ["wrong", "def wrongSite (value : Word) : Nat := value.val.length", { "Subtypes.wrongSite": { parameters: [site("Subtypes.checkedEven")], result: plain } }, /Subtype checked constructor input must equal the subtype base/]];
	for(const [name, source, contracts, pattern, arity] of cases)
	{
		const directory = await mkdtemp(join(tmpdir(), `lean-bridge-subtype-${name}-`));
		t.after(() => rm(directory, { recursive: true, force: true }));
		const projectRoot = join(directory, "project"), outputRoot = join(directory, "release");
		await cp(fixture, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "Subtypes.lean", `${await readFile(join(fixture, "Subtypes.lean"), "utf8")}\nnamespace Subtypes\n${source}\nend Subtypes\n`);
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({
			schemaVersion: 1, modules: ["Subtypes"]
			, exports: Object.keys(contracts).length ? Object.keys(contracts) : [`Subtypes.${name}Site`]
			, contracts
			, targets: Object.fromEntries([nativeSubtypeTargets.c])
			, ...(arity === undefined ? {} : { arities: { [`Subtypes.${name}Site`]: arity } }) }));
		await assert.rejects(() => buildCanonicalProject({ projectRoot, outputRoot, targets: ["c"], environment: nativeSubtypeEnvironment(["c"]) })
			, error => {
				assert.match(JSON.stringify({ message: error.message, details: error.details }), pattern, name);
				return true;
			}, name);
		await assert.rejects(() => access(outputRoot), name);
	}
	// Perl XS runs the exported validators since VO #1432; the Perl profile below checks the archived XS, so a
	// mixed build no longer belongs here, where the C job has no CPAN runtime.
});

/**
 * Count real dispatch in the installed C package with a test-only interposer: public
 * rejections reach neither Lean symbol, direct adapter calls reach only the adapter.
 *
 * @param consumer - Consumer root containing the installed C package.
 * @param packages - Installed C packages.
 * @param leanPrefix - Pinned Lean installation providing lean.h for raw adapter values.
 */
const observeDispatch = async (consumer, packages, leanPrefix) => {
	const root = join(consumer, "c"), pkg = packages.find(item => item.role === "component");
	const installed = join(root, `${pkg.name}-${pkg.version}-c`), lib = join(installed, "lib");
	const receipt = JSON.parse(await readFile(join(installed, "lean-bridge-package.json")));
	const compile = { ...copiedCleanEnvironment, PATH: join(root, "tools"), PKG_CONFIG_LIBDIR: join(lib, "pkgconfig"), PKG_CONFIG_PATH: "" };
	const strict = ["-std=c11", "-Wall", "-Wextra", "-Werror"];
	await saveLakeFile(root, "interposer.c", nativeSubtypeDispatchInterposer());
	await saveLakeFile(root, "probe.c", nativeSubtypeDispatchProbe());
	await runCopied("/usr/bin/cc", [...strict, "-shared", "-fPIC", "interposer.c", "-o", "libdispatch.so"], root, compile);
	const flags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", receipt.pkgConfig], root, compile)).stdout.trim().split(/\s+/);
	await runCopied("/usr/bin/cc", [...strict, "-isystem", join(leanPrefix, "include"), "probe.c", ...flags, "-lleanshared", "-o", "probe"], root, compile);
	const run = await runCopied(join(root, "probe"), [], root, { ...copiedCleanEnvironment, LD_PRELOAD: join(root, "libdispatch.so") });
	assert.equal(run.stderr, "");
	const lines = run.stdout.trim().split("\n");
	const observed = lines.filter(line => !line.startsWith("heap-rss")).map(line => {
		const [step, status, ...counts] = line.split(" ");
		return [step, Number(status), counts.map(Number)];
	});
	assert.deepEqual(observed, nativeSubtypeDispatchExpected);
	// Three batches of 20,000 accepted, rejected and late-rejected heap-backed calls (about 200,000 temporary Lean
	// objects each) keep the resident size flat within 1 MiB after the first batch, while 200,000 deliberately
	// leaked adapter results grow it by several MiB.
	const commit = lines.find(line => line.startsWith("heap-rss")).split(" ").slice(1).map(Number);
	assert.equal(commit.length, 4);
	assert.ok(commit[2] <= commit[1] + 1024 * 1024, `resident size ${JSON.stringify(commit)}`);
	assert.ok(commit[3] >= commit[2] + 4 * 1024 * 1024, `leak control ${JSON.stringify(commit)}`);
	const residentSize = { afterBatches: commit.slice(0, 3), afterLeakControl: commit[3], steadyWithinBytes: 1024 * 1024 };
	const positiveControl = "valid public and raw calls increment validator, adapter and source counts";
	return { columns: nativeSubtypeDispatchColumns, observed, interposer: "LD_PRELOAD", positiveControl, residentSize };
};

/**
 * Count validator, adapter and source dispatch in the installed CPAN package. Perl code cannot call the
 * typed adapter directly, so the direct-adapter column is observed in the C package probe.
 *
 * @param consumer - Consumer root containing the installed CPAN package.
 * @param command - Selected Perl interpreter.
 * @param adapters - Adapter symbol per Lean declaration, from the build's native model.
 */
const observePerlDispatch = async (consumer, command, adapters) => {
	const installed = join(consumer, "perl"), library = join(installed, "installed/lib/perl5");
	await saveLakeFile(installed, "interposer.c", perlSubtypeInterposer(adapters));
	await runCopied("/usr/bin/cc", ["-std=gnu11", "-Wall", "-Wextra", "-Werror", "-Wno-strict-prototypes", "-shared", "-fPIC", "interposer.c", "-o", "libdispatch.so"], installed
		, { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" });
	const observed = [];
	for(const [step, code, expected] of perlSubtypeDispatchSteps)
	{
		const counts = join(installed, `counts-${step}.txt`);
		const run = await runCopied(command, ["-e", perlSubtypePrelude + code], installed
			, { ...copiedCleanEnvironment, PERL5LIB: library, LD_PRELOAD: join(installed, "libdispatch.so"), SUBTYPE_COUNTS: counts });
		assert.equal(run.stderr, "", step);
		const counted = (await readFile(counts, "utf8")).trim().split(" ").map(Number);
		assert.deepEqual(counted, expected, step);
		observed.push([step, counted]);
	}
	const positiveControl = "a valid public call increments validator, adapter and source; direct adapter calls are counted in the C package probe";
	return { columns: perlSubtypeDispatchColumns, observed, interposer: "LD_PRELOAD", positiveControl };
};

test("relocated source-free native packages run author-checked constructors at every refined site", { skip: !profiles.length, timeout: 2_400_000 }, async t => {
	const reports = [], archives = [];
	const targets = Object.fromEntries(profiles.map(profile => nativeSubtypeTargets[profile]));
	const environment = nativeSubtypeEnvironment(profiles);
	// CI exports the Ruby toolchain; local runs use the pinned MRI 3.3 beside the other toolchains.
	if(profiles.includes("ruby"))
	{
		environment.LEAN_BRIDGE_RUBY ??= resolve(".toolchains/ruby33/bin/ruby");
		environment.LEAN_BRIDGE_GEM ??= join(dirname(environment.LEAN_BRIDGE_RUBY), "gem");
	}
	for(const attempt of [0, 1])
	{
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-subtype-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-subtype-consumer-"));
		t.after(() => Promise.all([directory, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(directory, "project"), outputRoot = join(directory, "release"), handoff = join(consumer, "handoff");
		await cp(fixture, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["Subtypes"], exports: Object.keys(nativeSubtypeContracts), contracts: nativeSubtypeContracts, targets }));
		t.diagnostic(`build ${attempt}: ${profiles.join(", ")}`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: Object.keys(targets), environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		// The model keeps every checked constructor beside the erased base transport.
		assert.deepEqual(Object.fromEntries(model.exports.map(item => [item.name, item.refinements ?? null])), nativeSubtypeRefinements);
		for(const item of model.exports) for(const parameter of item.parameters) assert.ok(!JSON.stringify(parameter.type).includes('"refinement"'), item.name);
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		if(profiles.includes("perl"))
		{
			// The archived XS calls one exported validator per checked parameter, after the Fin bound and before the adapter.
			const archive = receipt.packages.find(pkg => pkg.target === "cpan" && pkg.role === "component").artifacts[0].path;
			const xs = (await runCopied("/usr/bin/tar", ["-xOzf", join(handoff, archive), "--wildcards", "*/Component.xs"], consumer, copiedCleanEnvironment)).stdout;
			assert.equal((xs.match(/was rejected by Subtypes\.checked\w+"/g) ?? []).length, 8);
			const mix = xs.slice(xs.indexOf("\nmix(...)"), xs.indexOf("XSRETURN(1);", xs.indexOf("\nmix(...)")));
			assert.ok(mix.indexOf("is not below its Fin 10 bound") < mix.indexOf("_refinement_0(a0)") && mix.indexOf("_refinement_0(a0)") < mix.indexOf("lean_object *checked = "));
		}
		archives.push(Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))));
		const dependencies = attempt === 0 && profiles.includes("rust")
			? await prepareRustCorpusDependencies({ rustRoot: join(outputRoot, "native/rust"), directory, handoff: join(consumer, "dependencies"), environment }) : undefined;
		// Install from prepared archives only. No author workspace or build staging remains.
		await rm(directory, { recursive: true, force: true });
		if(attempt === 1) break;
		for(const profile of profiles)
		{
			t.diagnostic(`installing and checking ${profile}`);
			const target = nativeSubtypeTargets[profile][0];
			const packages = receipt.packages.filter(pkg => pkg.target === target);
			const { command, ...observation } = await installNativeSubtypeConsumer({ profile, consumer, handoff, packages, dependencies, environment });
			// The interpreter path is machine-specific; the report keeps portable facts only.
			const dispatch = profile === "c" ? await observeDispatch(consumer, packages, environment.LEAN_BRIDGE_LEAN_PREFIX)
				: profile === "perl" ? await observePerlDispatch(consumer, command, Object.fromEntries(model.exports.map(item => [item.name, item.symbol])))
					: { observed: false, reason: "counted in the C package, whose adapter this host's bundled library shares" };
			reports.push({ profile, path: "ordinary-source"
				, ...observation
				, dispatch
				, packages
				, refinements: nativeSubtypeRefinements
				, bindingIrSha256: built.bindingIrSha256
				, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
				, modelSha256: sha256(canonicalJson(model))
				, receiptSha256: sha256(await readFile(join(handoff, "package-set-receipt.json")))
				, sourceRemovedBeforeInstallation: true });
			await rm(join(consumer, profile), { recursive: true, force: true });
		}
		await rm(consumer, { recursive: true, force: true });
	}
	// Two unrelated author roots produce byte-identical archives.
	assert.deepEqual(archives[1], archives[0]);
	const reportPath = resolve(process.env.LEAN_BRIDGE_SUBTYPE_REPORT ?? `build/native-subtype/${profiles.join("-")}.json`);
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports, archives: archives[0], reproducible: true }));
});
