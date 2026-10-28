/**
 * Direct dependent Fin (`(bound : Nat) → Fin bound → …`) in installed,
 * source-free native and language-host packages: the bound is the live earlier
 * argument, compared before Lean runs, never a frozen constant.
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
import { compileCopiedDotnetModel } from "../src/backends/dotnet/copied-model.mjs";
import { renderCopiedDotnetPackage } from "../src/backends/dotnet/copied-values.mjs";
import { compileCopiedJvmModel } from "../src/backends/jvm/copied-model.mjs";
import { renderCopiedJvmPackage } from "../src/backends/jvm/copied-values.mjs";
import { renderCopiedKotlinPackage } from "../src/backends/jvm/copied-kotlin.mjs";
import { compileCopiedPhpModel } from "../src/backends/php/copied-model.mjs";
import { renderCopiedPhpPackage } from "../src/backends/php/copied-values.mjs";
import { compileCopiedPythonModel } from "../src/backends/python/copied-model.mjs";
import { renderCopiedPythonPackage } from "../src/backends/python/copied-values.mjs";
import { compileCopiedRubyModel } from "../src/backends/ruby/copied-model.mjs";
import { renderCopiedRubyPackage } from "../src/backends/ruby/copied-values.mjs";
import { compileCopiedRustModel } from "../src/backends/rust/copied-model.mjs";
import { renderCopiedRustPackage } from "../src/backends/rust/copied-values.mjs";
import { compileCopiedWitModel } from "../src/backends/wit/copied-model.mjs";
import { witFinReadme } from "../src/backends/wit/fin-refinements.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { prepareRustCorpusDependencies } from "./helpers/type-corpus-rust.mjs";
import {
	dependentFinEnvironment, dependentFinExtensions, dependentFinFixture, dependentFinRefinements
	, dependentFinReviewedIr, dependentFinTargets, installDependentFinConsumer
} from "./helpers/managed-dependent-fin.mjs";

const profiles = process.env.LEAN_BRIDGE_DEPENDENT_FIN_PROFILES?.split(",").sort() ?? [];
const reviewedProfiles = process.env.LEAN_BRIDGE_REVIEWED_DEPENDENT_FIN_PROFILES?.split(",").sort() ?? [];
for(const selection of [profiles, reviewedProfiles])
{
	assert.equal(new Set(selection).size, selection.length, "Duplicate dependent Fin profile");
	assert.ok(selection.every(profile => Object.hasOwn(dependentFinTargets, profile)), "Unknown or empty dependent Fin profile");
}

const zero = "0".repeat(64);
const rustEvidence = { library: "libdependentfin.so", libraries: { "libdependentfin.so": zero, "libleanshared.so": zero, "liblean_bridge_native.so": zero } };
/** Generated public sources and README of every managed host, from one Binding IR. */
const hosts = Object.freeze({
	python: ir => {
		const files = renderCopiedPythonPackage(compileCopiedPythonModel(ir));
		return { api: files["lean_dependentfin/__init__.pyi"], readme: files["README.md"], error: "LeanBridgeError message" };
	}
	, ruby: ir => {
		const files = renderCopiedRubyPackage(compileCopiedRubyModel(ir));
		return { api: files["lib/lean_bridge/dependentfin.rb"], readme: files["README.md"], error: "RangeError message" };
	}
	, "php-native": ir => {
		const files = renderCopiedPhpPackage(compileCopiedPhpModel(ir));
		return {
			api: files["src/Api.php"].replaceAll("$arg", "arg")
			, readme: files["README.md"].replaceAll("$arg", "arg")
			, error: "LeanBridgeError message"
		};
	}
	, rust: ir => {
		const files = renderCopiedRustPackage(compileCopiedRustModel(ir), rustEvidence, { name: "dependentfin", version: "1.0.0" });
		return { api: files["src/lib.rs"], readme: files["README.md"], error: "Error::Native message" };
	}
	, dotnet: ir => {
		const files = renderCopiedDotnetPackage(compileCopiedDotnetModel(ir));
		const api = Object.entries(files).find(([path, source]) => path.endsWith(".cs") && source.includes("public static class Api"))[1];
		return { api: api.replaceAll("&lt;", "<"), readme: files["README.md"], error: "ArgumentException message" };
	}
	, java: ir => {
		const files = renderCopiedJvmPackage(compileCopiedJvmModel(ir));
		const api = Object.entries(files).find(([path]) => path.endsWith("/Api.java"))[1];
		return { api: api.replaceAll("&lt;", "<"), readme: files["README.md"], error: "IllegalArgumentException message" };
	}
	, kotlin: ir => {
		// Kotlin callers share the Java API, native loader and README; the Kotlin layer adds no bound text.
		const kotlin = renderCopiedKotlinPackage(ir);
		const files = renderCopiedJvmPackage(compileCopiedJvmModel(ir));
		const api = Object.entries(files).find(([path]) => path.endsWith("/Api.java"))[1];
		return { api: api.replaceAll("&lt;", "<"), readme: files["README.md"], error: "IllegalArgumentException message", kotlin };
	}
	, "wit-wasi": ir => {
		// WIT text is unchanged by Fin; each export's bound is listed in the package README.
		const readme = witFinReadme(compileCopiedWitModel(ir, { name: "dependentfin", version: "1.0.0" }));
		return { api: readme.replace(/^- [a-z-]+: (.*)$/gmu, "Checked Lean Fin bounds: $1."), readme, error: "Wasmtime error message" };
	}
});
const refinements = (ir, name) => ir.declarations.find(item => item.id === `lean:DependentFin.${name}`).source.extensions["lean-lang.org/refinements"];

test("every dependent Fin profile has a target and installed consumer", async () => {
	assert.deepEqual(Object.keys(dependentFinTargets).sort()
		, Object.keys(dependentFinExtensions).sort());
	for(const profile of Object.keys(hosts))
		assert.ok(Object.hasOwn(dependentFinTargets, profile), profile);
	for(const [profile, extension] of Object.entries(dependentFinExtensions))
	{
		const source = await readFile(`tests/fixtures/dependent-fin-consumers/${profile}.${extension}`, "utf8");
		// Each consumer covers Fin 0, Fin 1, the exact endpoint, a word bound, a 2^70 bound, a live bound
		// changing per call, a later dependency and 1000 recovering calls, then reports its check count.
		assert.match(source, /dependent Fin bound/, profile);
		assert.match(source, /dependent-fin-ok/, profile);
		assert.match(source, /1000/, profile);
		assert.match(source, /arg2[^\n]*arg1/, profile);
	}
});

test("the Lean fixture and the independent review state the same two direct dependencies", async () => {
	const source = await readFile(join(dependentFinFixture, "DependentFin.lean"), "utf8");
	assert.match(source, /def mirror \(bound : Nat\) \(value : Fin bound\) : Nat/);
	assert.match(source, /def label \(start : Nat\) \(bound : Nat\) \(value : Fin bound\) \(name : String\) : String/);
	const ir = dependentFinReviewedIr();
	assert.deepEqual(Object.fromEntries(ir.declarations.map(item => [item.id.slice("lean:".length), item.source.extensions["lean-lang.org/refinements"]])), dependentFinRefinements);
	assert.deepEqual(ir.declarations.map(item => item.parameters.map(parameter => parameter.name)), [["arg0", "arg1"], ["arg0", "arg1", "arg2", "arg3"]]);
	assert.ok(!JSON.stringify(ir).includes('"bound"'), "a dependent site never carries a frozen bound");
});

for(const [profile, render] of Object.entries(hosts))
	test(`${profile} documents the live earlier argument as each dependent bound`, () => {
		const { api, readme, error, kotlin } = render(dependentFinReviewedIr());
		assert.match(api, /Checked Lean Fin bounds: arg1 < arg0\./);
		assert.match(api, /Checked Lean Fin bounds: arg2 < arg1\./);
		assert.match(readme, /: arg1 < arg0\n/);
		assert.match(readme, /: arg2 < arg1\n/);
		assert.match(readme, new RegExp(`is that argument's value in the same call: [^"]*${error.replace(/[.:]/g, "\\$&")} names the value and its bound parameter, such as "arg1 is not below its dependent Fin bound arg0"\\.`));
		// No frozen number appears as either bound.
		assert.doesNotMatch(readme, /arg[12] < \d/);
		if(kotlin) assert.doesNotMatch(JSON.stringify(kotlin), /Checked Lean Fin bounds/);
	});

test("a static Fin keeps its previous documentation without the dependent paragraph", () => {
	const ir = dependentFinReviewedIr();
	refinements(ir, "mirror").parameters[1] = { kind: "fin", bound: "10" };
	refinements(ir, "label").parameters[2] = { kind: "fin", bound: "4" };
	for(const [profile, render] of Object.entries(hosts))
	{
		const { api, readme } = render(structuredClone(ir));
		assert.match(api, /Checked Lean Fin bounds: arg1 < 10\./, profile);
		assert.match(readme, /: arg2 < 4\n/, profile);
		assert.doesNotMatch(readme, /dependent Fin bound/, profile);
	}
});

test("altered dependencies and forged dependent sites are refused by every host renderer", () => {
	const forgeries = [
		["self dependency", ir => { refinements(ir, "mirror").parameters[1] = { kind: "fin-parameter", parameter: 1 }; }]
		, ["later dependency", ir => { refinements(ir, "label").parameters[2] = { kind: "fin-parameter", parameter: 3 }; }]
		, ["negative dependency", ir => { refinements(ir, "mirror").parameters[1] = { kind: "fin-parameter", parameter: -1 }; }]
		, ["fractional dependency", ir => { refinements(ir, "mirror").parameters[1] = { kind: "fin-parameter", parameter: 0.5 }; }]
		, ["frozen bound beside the dependency", ir => { refinements(ir, "mirror").parameters[1] = { kind: "fin-parameter", parameter: 0, bound: "10" }; }]
		, ["dependency on a String", ir => {
			const label = ir.declarations.find(item => item.id === "lean:DependentFin.label");
			label.parameters[1].type = label.parameters[3].type;
		}]
		, ["dependent result", ir => { refinements(ir, "mirror").result = { kind: "fin-parameter", parameter: 0 }; }]
		, ["dependent first parameter", ir => { refinements(ir, "mirror").parameters[0] = { kind: "fin-parameter", parameter: 0 }; }]];
	for(const [label, forge] of forgeries)
		for(const [profile, render] of Object.entries(hosts))
		{
			const ir = dependentFinReviewedIr();
			forge(ir);
			assert.throws(() => render(ir), TypeError, `${profile}: ${label}`);
		}
});

test("moving the dependency to a different earlier Nat moves every documented bound", () => {
	const ir = dependentFinReviewedIr();
	refinements(ir, "label").parameters[2] = { kind: "fin-parameter", parameter: 0 };
	for(const [profile, render] of Object.entries(hosts))
	{
		const { api, readme } = render(structuredClone(ir));
		assert.match(api, /Checked Lean Fin bounds: arg2 < arg0\./, profile);
		assert.match(readme, /: arg2 < arg0\n/, profile);
		assert.doesNotMatch(readme, /: arg2 < arg1\n/, profile);
	}
});

const checkInstalledDependentFin = async (t, selected, reviewed = false) => {
	const reports = [], archives = [];
	const targets = Object.fromEntries(selected.map(profile => dependentFinTargets[profile]));
	const environment = dependentFinEnvironment(selected);
	// CI exports the Ruby toolchain; local runs use the pinned MRI 3.3 beside the other toolchains.
	if(selected.includes("ruby"))
	{
		environment.LEAN_BRIDGE_RUBY ??= resolve(".toolchains/ruby33/bin/ruby");
		environment.LEAN_BRIDGE_GEM ??= join(dirname(environment.LEAN_BRIDGE_RUBY), "gem");
	}
	for(const attempt of [0, 1])
	{
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-dependent-fin-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-dependent-fin-consumer-"));
		t.after(() => Promise.all([directory, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(directory, "project"), outputRoot = join(directory, "release"), handoff = join(consumer, "handoff");
		await cp(dependentFinFixture, projectRoot, { recursive: true });
		const reviewedSource = reviewed ? canonicalJson(dependentFinReviewedIr()) : null;
		if(reviewed) await saveLakeFile(projectRoot, "api.binding-ir.json", reviewedSource);
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["DependentFin"], targets }));
		t.diagnostic(`build ${attempt}: ${selected.join(", ")}`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: Object.keys(targets), environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		if(reviewed)
		{
			assert.equal(model.sourceIdentity.reviewedBindingIr.source, reviewedSource);
			assert.equal(model.sourceIdentity.reviewedBindingIr.sourceSha256, sha256(reviewedSource));
		}
		// The model keeps each live parameter index beside the erased Nat transport and never a bound.
		assert.deepEqual(Object.fromEntries(model.exports.map(item => [item.name, item.refinements ?? null])), dependentFinRefinements);
		for(const item of model.exports) for(const parameter of item.parameters) assert.ok(!JSON.stringify(parameter.type).includes('"refinement"'), item.name);
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		archives.push(Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))));
		const dependencies = attempt === 0 && selected.includes("rust")
			? await prepareRustCorpusDependencies({ rustRoot: join(outputRoot, "native/rust"), directory, handoff: join(consumer, "dependencies"), environment }) : undefined;
		// Install from prepared archives only. No author workspace or build staging remains.
		await rm(directory, { recursive: true, force: true });
		if(attempt === 1) break;
		for(const profile of selected)
		{
			t.diagnostic(`installing and checking ${profile}`);
			const target = dependentFinTargets[profile][0];
			const packages = receipt.packages.filter(pkg => pkg.target === target);
			const observation = await installDependentFinConsumer({ profile, consumer, handoff, packages, dependencies, environment });
			// The interpreter path is machine-specific; the report keeps portable facts only.
			delete observation.command;
			reports.push({ profile, path: reviewed ? "reviewed-ir" : "ordinary-source"
				, ...observation
				, dispatch: { observed: false, reason: "the dependent comparison runs in the bundled C adapter before Lean; its rejection text and recovery are observed through the public host API" }
				, packages
				, refinements: dependentFinRefinements
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
	const configuredReport = process.env[reviewed ? "LEAN_BRIDGE_REVIEWED_DEPENDENT_FIN_REPORT" : "LEAN_BRIDGE_DEPENDENT_FIN_REPORT"];
	const reportPath = resolve(configuredReport ?? `build/managed-dependent-fin/${reviewed ? "reviewed-" : ""}${selected.join("-")}.json`);
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports, archives: archives[0], reproducible: true }));
};

test("the installed-consumer fixture directory is complete before any build", async () => {
	for(const name of ["DependentFin.lean", "lakefile.toml", "lean-toolchain", "LICENSE", "package.json"]) await access(join(dependentFinFixture, name));
});

test("source-free installed host packages check a direct dependent Fin against the live earlier argument", { skip: !profiles.length, timeout: 2_400_000 }, t => checkInstalledDependentFin(t, profiles));

test("independently reviewed host packages check a direct dependent Fin after source-free installation", { skip: !reviewedProfiles.length, timeout: 2_400_000 }, t => checkInstalledDependentFin(t, reviewedProfiles, true));
