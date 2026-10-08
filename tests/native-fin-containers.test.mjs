/**
 * Checked Fin inside arrays, lists and options of installed, source-free native packages.
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
import { finContainerEnvironment, finContainerRefinements, finContainerTargets, installFinContainerConsumer } from "./helpers/fin-container-install.mjs";
import { finContainerDispatchColumns, finContainerDispatchExpected, finContainerDispatchInterposer, finContainerDispatchProbe } from "./helpers/fin-container-dispatch.mjs";
import { perlContainerDispatchColumns, perlContainerDispatchSteps, perlContainerInterposer, perlContainerPrelude } from "./helpers/perl-fin-container-dispatch.mjs";
import { copiedCleanEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { prepareRustCorpusDependencies } from "./helpers/type-corpus-rust.mjs";
import { observeFinContainerHostDispatch } from "./helpers/fin-container-host-dispatch.mjs";
import { finContainerReviewedIr } from "./helpers/reviewed-fin-container-fixture.mjs";
import "./helpers/fin-container-host-dispatch-tests.mjs";
import "./helpers/container-host-dispatch-source-history-tests.mjs";
import "./helpers/perl-fin-archive-source-history-tests.mjs";
import "./helpers/perl-fin-xs-audit-source-history-tests.mjs";

const profiles = process.env.LEAN_BRIDGE_FIN_CONTAINER_PROFILES?.split(",").sort() ?? [];
const reviewedProfiles = process.env.LEAN_BRIDGE_REVIEWED_FIN_CONTAINER_PROFILES?.split(",").sort() ?? [];
for(const selection of [profiles, reviewedProfiles])
{
	assert.equal(new Set(selection).size, selection.length, "Duplicate Fin container profile");
	assert.ok(selection.every(profile => Object.hasOwn(finContainerTargets, profile)), "Unknown or empty Fin container profile");
}
const extensions = { c: "c", cpp: "cpp", python: "py", rust: "rs", dotnet: "cs", java: "java", kotlin: "kt", ruby: "rb", "php-native": "php", "wit-wasi": "c", perl: "pl" };
const fixture = "tests/fixtures/onboarding/native-fin-containers";
/**
 * Inspect the XS without making compilers or PATH-resolved decompressors available.
 *
 * @param archive - Prepared CPAN archive.
 * @param root - Consumer working directory.
 */
const perlArchiveXs = async (archive, root) => (await runCopied("/usr/bin/tar"
	, ["--use-compress-program=/usr/bin/gzip", "-xOf", archive, "--wildcards", "*/Component.xs"], root, copiedCleanEnvironment)).stdout;

test("Perl Fin archive inspection works with the compiler-free consumer PATH", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-perl-fin-archive-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const source = "/* Archive inspection fixture, not a compiled package. */\n";
	await saveLakeFile(root, "package/Component.xs", source);
	const archive = join(root, "package.tar.gz");
	await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-cf", archive, "package"], root, copiedCleanEnvironment);
	assert.equal(await perlArchiveXs(archive, root), source);
	assert.equal(copiedCleanEnvironment.PATH, "/unavailable");
	await assert.rejects(() => runCopied("/usr/bin/tar", ["-xOzf", archive, "--wildcards", "*/Component.xs"], root, copiedCleanEnvironment)
		, error => error.code === "build-command-failed" && /gzip/.test(error.details.stderr));
});

const nat = { kind: "primitive", name: "nat", lean: "Nat", abi: { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: false } };
const heap = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true };
const refined = { kind: "refinement", base: nat, predicate: { kind: "fin", bound: "10" }, abi: nat.abi };
const container = (kind, element) => ({ kind, element, abi: heap });

test("native types admit Fin at top level, inside structural containers and in plain record and variant fields", () => {
	validateNativeType(refined);
	validateNativeType(container("array", refined));
	validateNativeType(container("list", container("option", refined)));
	validateNativeType({ kind: "alias", name: "Digits", lean: "Digits", target: container("array", refined), abi: heap });
	const text = { kind: "primitive", name: "string", lean: "String", abi: { ...heap } };
	// Products and results are structural since VO #1441, alone and nested with the other containers.
	validateNativeType({ kind: "tuple", arguments: [refined, text], abi: heap });
	validateNativeType({ kind: "result", arguments: [text, container("array", refined)], abi: heap });
	validateNativeType(container("list", { kind: "tuple", arguments: [refined, { kind: "result", arguments: [refined, text], abi: heap }], abi: heap }));
	const product = { kind: "tuple", arguments: [refined, text], abi: heap };
	// Plain record and variant fields are structural since VO #1442.
	const box = { kind: "record", name: "Box", lean: "Box", constructor: "Box.mk", fields: [{ name: "digit", projection: "Box.digit", type: refined }], abi: heap };
	validateNativeType(box);
	validateNativeType({ kind: "record", name: "Box", lean: "Box", constructor: "Box.mk", fields: [{ name: "digits", projection: "Box.digits", type: product }], abi: heap });
	validateNativeType({ kind: "variant", name: "Shape", lean: "Shape", abi: heap, cases: [{ name: "circle", constructor: "Shape.circle", fields: [{ name: "radius", type: refined }] }, { name: "empty", constructor: "Shape.empty", fields: [] }] });
	// An instantiated generic structure's fields and callbacks stay unchecked, so a bound there is refused.
	const generic = { kind: "record", name: "NatBox", lean: "NatBox", constructor: "Holder.mk", provenance: { structure: "Holder", arguments: [nat] }, fields: [{ name: "digit", projection: "Holder.digit", type: refined }], abi: heap };
	for(const [label, type] of [
		["generic record field", generic]
		, ["callback", { kind: "callback", parameters: [container("array", refined)], result: nat, abi: heap }]
		, ["callback result", { kind: "callback", parameters: [nat], result: { kind: "result", arguments: [refined, text], abi: heap }, abi: heap }]])
		assert.throws(() => validateNativeType(type), /Fin refinements require a top-level native parameter or result, or an array, list, option, product, Except, plain record or variant of one/, label);
	assert.deepEqual(nativeFinBoundPaths(finContainerRefinements["FinContainers.present"].parameters[0], "arg0"), ["arg0[*]? < 10"]);
	assert.deepEqual(nativeFinBoundPaths(finContainerRefinements["FinContainers.flatten"].result, "result"), ["result?[*] < 10"]);
});

test("Lean adapters check container elements with typed construction and keep the scalar form byte for byte", () => {
	const nat = { kind: "primitive", name: "nat", lean: "Nat", abi: { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: false } };
	const fin = bound => ({ kind: "fin", bound });
	const item = (name, parameters, result, refinements) => ({ name: `NativeFin.${name}`, module: "NativeFin", symbol: `lb_${name}`, parameters: parameters.map((type, i) => ({ name: `p${i}`, type })), result, refinements });
	const exports = [
		item("mirror", [nat], nat, { parameters: [fin("10")], result: fin("10") })
		, item("digits", [container("array", nat)], container("array", nat), { parameters: [{ kind: "array", arguments: [fin("10")] }], result: { kind: "array", arguments: [fin("10")] } })
		, item("maybe", [container("option", nat)], nat, { parameters: [{ kind: "option", arguments: [fin("1")] }], result: null })];
	const text = generateNativeLeanAdapters({ component: { id: "native-fin@1.0.0" }, pointerBits: 64, types: [], exports }).leanSource;
	const section = symbol => text.slice(text.indexOf(`@[export ${symbol}]`), text.indexOf("\n\n", text.indexOf(`@[export ${symbol}]`)) + 2);
	// The scalar adapter from VO #1418 is unchanged, so frozen receipts keep reproducing.
	assert.equal(section("lb_mirror"), "@[export lb_mirror]\ndef f_lb_mirror (a0 : _root_.Nat) : (_root_.Option _root_.Nat) :=\n  if _bridgeFin0 : (a0) < 10 then\n    _root_.Option.some ((_root_.NativeFin.mirror ⟨a0, _bridgeFin0⟩).val)\n  else\n    _root_.Option.none\n\n");
	// Containers construct every Fin inside a decidable check and erase results after one source call.
	const digits = section("lb_digits");
	assert.match(digits, /def f_lb_digits \(a0 : \(_root_\.Array _root_\.Nat\)\) : \(_root_\.Option \(_root_\.Array _root_\.Nat\)\) :=/);
	assert.match(digits, /match \(\(a0\)\.mapM \(fun _bridgeValue0 => \(if proof : \(_bridgeValue0\) < 10 then _root_\.Option\.some \(⟨\(_bridgeValue0\), proof⟩ : _root_\.Fin 10\) else _root_\.Option\.none\)\)\) with/);
	assert.match(digits, /let _bridgeResult := _root_\.NativeFin\.digits _bridgeSubtype0; \(\(_bridgeResult\)\.map \(fun _bridgeValue0 => \(_bridgeValue0\)\.val\)\)/);
	assert.equal((digits.match(/NativeFin\.digits/g) ?? []).length, 1);
	assert.match(section("lb_maybe"), /match \(a0\) with \| \.none => _root_\.Option\.some _root_\.Option\.none \| \.some _bridgeValue0 =>/);
});

test("every native profile has a Fin container consumer", async () => {
	assert.deepEqual(Object.keys(finContainerTargets).sort(), Object.keys(extensions).sort());
	for(const [profile, extension] of Object.entries(extensions)) await access(`tests/fixtures/fin-container-consumers/${profile}.${extension}`);
});

// Since VO #1445 C packages admit Fin in a host callback's arguments (Lean produces them), and since
// VO #1453 in its result where a Fin-free failure value exists; a callback nested in a callback, a
// result whose selected default needs a Fin and generic instantiations stay rejected.
test("native builds still reject Fin in callbacks and generic record instantiations, including containers there", { skip: !profiles.includes("c"), timeout: 1_800_000 }, async t => {
	const unchecked = /inside callbacks or generic record instantiations/;
	const cases = [
		["nested callback", "def callbackSite (value : (Array (Fin 5) → Nat) → Nat) : Nat := value (fun digits => digits.size)", unchecked]
		, ["result callback", "def resultSite (value : Nat → Except String (Fin 5)) : Nat := match value 0 with | .ok _ => 1 | .error _ => 0", /a host callback result needs a Fin-free failure value: scalar Fin, a Fin in its selected default, Subtype and checked records are refused/]
		, ["generic field", "structure Holder (α : Type) where\n  digits : Array (Fin 5)\n  value : α\nabbrev NatHolder := Holder Nat\ndef genericSite (value : NatHolder) : Nat := value.digits.size", unchecked]];
	for(const [name, source, pattern] of cases)
	{
		const directory = await mkdtemp(join(tmpdir(), `lean-bridge-fin-container-${name}-`));
		t.after(() => rm(directory, { recursive: true, force: true }));
		const projectRoot = join(directory, "project"), outputRoot = join(directory, "release");
		await cp(fixture, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "FinContainers.lean", `namespace FinContainers\n${source}\nend FinContainers\n`);
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["FinContainers"], targets: Object.fromEntries([finContainerTargets.c]) }));
		await assert.rejects(() => buildCanonicalProject({ projectRoot, outputRoot, targets: ["c"], environment: finContainerEnvironment(["c"]) })
			, error => pattern.test(JSON.stringify({ message: error.message, details: error.details })), name);
		await assert.rejects(() => access(outputRoot), name);
	}
	// Perl XS walks container bounds since VO #1431; the Perl profile below checks the archived XS, so a
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
	await saveLakeFile(root, "interposer.c", finContainerDispatchInterposer());
	await saveLakeFile(root, "probe.c", finContainerDispatchProbe());
	await runCopied("/usr/bin/cc", [...strict, "-shared", "-fPIC", "interposer.c", "-o", "libdispatch.so"], root, compile);
	const flags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", receipt.pkgConfig], root, compile)).stdout.trim().split(/\s+/);
	await runCopied("/usr/bin/cc", [...strict, "-isystem", join(leanPrefix, "include"), "probe.c", ...flags, "-lleanshared", "-o", "probe"], root, compile);
	const run = await runCopied(join(root, "probe"), [], root, { ...copiedCleanEnvironment, LD_PRELOAD: join(root, "libdispatch.so") });
	assert.equal(run.stderr, "");
	const observed = run.stdout.trim().split("\n").map(line => {
		const [step, status, ...counts] = line.split(" ");
		return [step, Number(status), counts.map(Number)];
	});
	assert.deepEqual(observed, finContainerDispatchExpected);
	const positiveControl = "valid public and raw calls increment source and adapter counts";
	return { columns: finContainerDispatchColumns, observed, interposer: "LD_PRELOAD", positiveControl };
};

/**
 * Count adapter and source dispatch in the installed CPAN package. Perl code cannot call the
 * typed adapter directly, so the direct-adapter column is observed in the C package probe.
 *
 * @param consumer - Consumer root containing the installed CPAN package.
 * @param command - Selected Perl interpreter.
 * @param adapters - Adapter symbol per Lean declaration, from the build's native model.
 */
const observePerlDispatch = async (consumer, command, adapters) => {
	const installed = join(consumer, "perl"), library = join(installed, "installed/lib/perl5");
	await saveLakeFile(installed, "interposer.c", perlContainerInterposer(adapters));
	await runCopied("/usr/bin/cc", ["-std=gnu11", "-Wall", "-Wextra", "-Werror", "-Wno-strict-prototypes", "-shared", "-fPIC", "interposer.c", "-o", "libdispatch.so"], installed
		, { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" });
	const observed = [];
	for(const [step, code, expected] of perlContainerDispatchSteps)
	{
		const counts = join(installed, `counts-${step}.txt`);
		const run = await runCopied(command, ["-e", perlContainerPrelude + code], installed
			, { ...copiedCleanEnvironment, PERL5LIB: library, LD_PRELOAD: join(installed, "libdispatch.so"), FIN_CONTAINER_COUNTS: counts });
		assert.equal(run.stderr, "", step);
		const counted = (await readFile(counts, "utf8")).trim().split(" ").map(Number);
		assert.deepEqual(counted, expected, step);
		observed.push([step, counted]);
	}
	const positiveControl = "valid public calls increment the adapter and source counts; direct adapter calls are counted in the C package probe";
	return { columns: perlContainerDispatchColumns, observed, interposer: "LD_PRELOAD", positiveControl };
};

const checkInstalledFinContainers = async (t, profiles, reviewed = false) => {
	const reports = [], archives = [];
	const targets = Object.fromEntries(profiles.map(profile => finContainerTargets[profile]));
	const environment = finContainerEnvironment(profiles);
	// CI exports the Ruby toolchain; local runs use the pinned MRI 3.3 beside the other toolchains.
	if(profiles.includes("ruby"))
	{
		environment.LEAN_BRIDGE_RUBY ??= resolve(".toolchains/ruby33/bin/ruby");
		environment.LEAN_BRIDGE_GEM ??= join(dirname(environment.LEAN_BRIDGE_RUBY), "gem");
	}
	for(const attempt of [0, 1])
	{
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-fin-container-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-fin-container-consumer-"));
		t.after(() => Promise.all([directory, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(directory, "project"), outputRoot = join(directory, "release"), handoff = join(consumer, "handoff");
		await cp(fixture, projectRoot, { recursive: true });
		const reviewedSource = reviewed ? canonicalJson(finContainerReviewedIr()) : null;
		if(reviewed) await saveLakeFile(projectRoot, "api.binding-ir.json", reviewedSource);
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["FinContainers"], targets }));
		t.diagnostic(`build ${attempt}: ${profiles.join(", ")}`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: Object.keys(targets), environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		if(reviewed)
		{
			assert.equal(model.sourceIdentity.reviewedBindingIr.source, reviewedSource);
			assert.equal(model.sourceIdentity.reviewedBindingIr.sourceSha256, sha256(reviewedSource));
		}
		// The model keeps the whole checked tree beside the erased Nat transport.
		assert.deepEqual(Object.fromEntries(model.exports.map(item => [item.name, item.refinements ?? null])), finContainerRefinements);
		for(const item of model.exports) for(const parameter of item.parameters) assert.ok(!JSON.stringify(parameter.type).includes('"refinement"'), item.name);
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		archives.push(Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))));
		if(profiles.includes("perl"))
		{
			// The archived XS carries one walker per refined parameter, each naming the parameter and the leaf bound.
			const archive = receipt.packages.find(pkg => pkg.target === "cpan" && pkg.role === "component").artifacts[0].path;
			const xs = await perlArchiveXs(join(handoff, archive), consumer);
			assert.equal((xs.match(/is not below its Fin \d+ bound/g) ?? []).length, 7);
			assert.match(xs, /croak\("%s\[%zu\] is not below its Fin 4 bound", "arg1", \(size_t\)k0\);/);
			assert.match(xs, /lean_cstr_to_nat\("1180591620717411303424"\); int below = lean_nat_lt\(e0, bound\)/);
		}
		const dependencies = attempt === 0 && profiles.includes("rust")
			? await prepareRustCorpusDependencies({ rustRoot: join(outputRoot, "native/rust"), directory, handoff: join(consumer, "dependencies"), environment }) : undefined;
		// Install from prepared archives only. No author workspace or build staging remains.
		await rm(directory, { recursive: true, force: true });
		if(attempt === 1) break;
		for(const profile of profiles)
		{
			t.diagnostic(`installing and checking ${profile}`);
			const target = finContainerTargets[profile][0];
			const packages = receipt.packages.filter(pkg => pkg.target === target);
			const { command, ...observation } = await installFinContainerConsumer({ profile, consumer, handoff, packages, dependencies, environment });
			// The interpreter path is machine-specific; the report keeps portable facts only.
			const dispatch = profile === "c" ? await observeDispatch(consumer, packages, environment.LEAN_BRIDGE_LEAN_PREFIX)
				: profile === "perl" ? await observePerlDispatch(consumer, command, Object.fromEntries(model.exports.map(item => [item.name, item.symbol])))
					: ["python", "rust"].includes(profile) ? await observeFinContainerHostDispatch({ profile, consumer, command, packages, environment })
						: { observed: false, reason: "counted in the C package, whose adapter this host's bundled library shares" };
			reports.push({ profile, path: reviewed ? "reviewed-ir" : "ordinary-source"
				, ...observation
				, dispatch
				, packages
				, refinements: finContainerRefinements
				, bindingIrSha256: built.bindingIrSha256
				, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
				, modelSha256: sha256(canonicalJson(model))
				, receiptSha256: sha256(await readFile(join(handoff, "package-set-receipt.json")))
				, ...(reviewed ? { reviewedSourceSha256: model.sourceIdentity.reviewedBindingIr.sourceSha256 } : {})
				, sourceRemovedBeforeInstallation: true });
			await rm(join(consumer, profile), { recursive: true, force: true });
		}
		await rm(consumer, { recursive: true, force: true });
	}
	// Two unrelated author roots produce byte-identical archives.
	assert.deepEqual(archives[1], archives[0]);
	const configuredReport = process.env[reviewed ? "LEAN_BRIDGE_REVIEWED_FIN_CONTAINER_REPORT" : "LEAN_BRIDGE_FIN_CONTAINER_REPORT"];
	const reportPath = resolve(configuredReport ?? `build/native-fin-containers/${reviewed ? "reviewed-" : ""}${profiles.join("-")}.json`);
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports, archives: archives[0], reproducible: true }));
};

test("relocated source-free native packages check Fin inside arrays, lists and options", { skip: !profiles.length, timeout: 2_400_000 }, t => checkInstalledFinContainers(t, profiles));

test("independently reviewed native packages check container and alias Fin bounds after source-free installation", { skip: !reviewedProfiles.length, timeout: 2_400_000 }, t => checkInstalledFinContainers(t, reviewedProfiles, true));
