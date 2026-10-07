/**
 * Finite generic specializations in installed, source-free native packages.
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
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { installSpecializationConsumer, nativeSpecializationEnvironment, nativeSpecializations
	, nativeSpecializationSignatures, nativeSpecializationTargets } from "./helpers/native-specialization-install.mjs";
import { prepareRustCorpusDependencies } from "./helpers/type-corpus-rust.mjs";

const profiles = process.env.LEAN_BRIDGE_SPECIALIZATION_PROFILES?.split(",").sort() ?? [];
assert.equal(new Set(profiles).size, profiles.length, "Duplicate specialization profile");
assert.ok(profiles.every(profile => Object.hasOwn(nativeSpecializationTargets, profile)), "Unknown or empty specialization profile");
const extensions = { c: "c", cpp: "cpp", python: "py", rust: "rs", dotnet: "cs", java: "java", kotlin: "kt", ruby: "rb", perl: "pl", "php-native": "php", "wit-wasi": "c" };
const exported = Object.keys(nativeSpecializationSignatures);
const type = value => value.kind === "primitive" ? value.name : value.kind === "array" ? { array: type(value.element) } : value.kind;

test("every native profile has a specialization consumer for the same concrete exports", async () => {
	assert.deepEqual(Object.keys(nativeSpecializationTargets).sort(), Object.keys(extensions).sort());
	assert.deepEqual(nativeSpecializations.map(item => item.name), exported.slice(0, -1));
	assert.equal(new Set(nativeSpecializations.map(item => item.declaration)).size, 4);
	assert.equal(nativeSpecializations.filter(item => item.types.includes("Specialized.Words")).length, 2);
	const source = await readFile("tests/fixtures/onboarding/native-specializations/Specialized.lean", "utf8");
	for(const { declaration, types } of nativeSpecializations)
	{
		assert.match(source, new RegExp(`^def ${declaration.split(".")[1]} `, "m"), declaration);
		assert.ok(types.length >= 1 && types.length <= 8);
	}
	// The concrete names exist only in configuration, never as Lean wrappers.
	for(const { name } of nativeSpecializations) assert.doesNotMatch(source, new RegExp(`\\b${name.split(".")[1]}\\b`), name);
	for(const [profile, extension] of Object.entries(extensions))
		await access(`tests/fixtures/specialization-consumers/${profile}.${extension}`);
});

test("native builds admit a generic structure instantiation named by an alias, with its provenance", { skip: !profiles.includes("c"), timeout: 900_000 }, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-specialization-generic-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const projectRoot = join(directory, "project"), outputRoot = join(directory, "release");
	await cp("tests/fixtures/onboarding/native-specializations", projectRoot, { recursive: true });
	const source = await readFile(join(projectRoot, "Specialized.lean"), "utf8");
	// A closed instantiation of a universe-polymorphic generic structure, named by an alias like every other type argument.
	await saveLakeFile(projectRoot, "Specialized.lean", `${source}\nnamespace Specialized\nabbrev WordPair := Pair Word String\nend Specialized\n`);
	await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
		, modules: ["Specialized"]
		, exports: ["Specialized.echoPair", "Specialized.plain"]
		, specializations: [{ name: "Specialized.echoPair", declaration: "Specialized.echo", types: ["Specialized.WordPair"] }]
		, targets: Object.fromEntries([nativeSpecializationTargets.c]) }));
	await buildCanonicalProject({ projectRoot, outputRoot, targets: ["c"], environment: nativeSpecializationEnvironment(["c"]) }).catch(error => {
		error.message += `: ${JSON.stringify(error.details)}`; throw error;
	});
	const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
	const record = model.types.find(type => type.kind === "record");
	// The alias is the record's identity; the structure and its resolved arguments are its provenance.
	assert.equal(record.name, "Specialized.WordPair"); assert.equal(record.lean, "Specialized.WordPair"); assert.equal(record.constructor, "Specialized.Pair.mk");
	assert.equal(record.provenance.structure, "Specialized.Pair");
	// Arguments travel like field types: the alias inline, with its own target.
	assert.deepEqual(record.provenance.arguments.map(argument => `${argument.kind}:${argument.name}${argument.target ? `=${argument.target.name}` : ""}`), ["alias:Specialized.Word=string", "primitive:string"]);
	assert.deepEqual(record.fields.map(field => [field.name, field.type.kind === "alias" ? field.type.name : field.type.name]), [["first", "Specialized.Word"], ["second", "string"]]);
	assert.equal(model.exports.find(item => item.name === "Specialized.echoPair").result.name, "Specialized.WordPair");
});

test("relocated source-free native packages install concrete specializations without the generic declaration", { skip: !profiles.length, timeout: 2_400_000 }, async t => {
	const reports = [], archives = [];
	const targets = Object.fromEntries(profiles.map(profile => nativeSpecializationTargets[profile]));
	const environment = nativeSpecializationEnvironment(profiles);
	// CI exports the Ruby toolchain; local runs use the pinned MRI 3.3 beside the other toolchains.
	if(profiles.includes("ruby"))
	{
		environment.LEAN_BRIDGE_RUBY ??= resolve(".toolchains/ruby33/bin/ruby");
		environment.LEAN_BRIDGE_GEM ??= join(dirname(environment.LEAN_BRIDGE_RUBY), "gem");
	}
	for(const attempt of [0, 1])
	{
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-specialization-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-specialization-consumer-"));
		t.after(() => Promise.all([directory, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(directory, "project"), outputRoot = join(directory, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/native-specializations", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Specialized"]
			, exports: exported
			, specializations: nativeSpecializations
			, targets }));
		t.diagnostic(`build ${attempt}: ${profiles.join(", ")}`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: Object.keys(targets), environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		// Lean resolved every type and instance argument: only concrete runtime parameters remain.
		assert.deepEqual(Object.fromEntries(model.exports.map(item => [item.name, [item.parameters.map(parameter => type(parameter.type)), type(item.result)]]))
			, nativeSpecializationSignatures);
		for(const { name, declaration } of nativeSpecializations)
		{
			const entry = model.bindingIr.declarations.find(item => item.id === `lean:${name}`);
			assert.equal(entry.source.declaration, declaration, name);
			assert.deepEqual(entry.typeParameters, [], name);
			assert.deepEqual(entry.assurance, [], name);
		}
		const echo = model.bindingIr.declarations.find(item => item.id === "lean:Specialized.echoWord");
		assert.deepEqual(echo.source.extensions["lean-lang.org/theorem-references"], ["Specialized.echo_spec"]);
		assert.match(echo.documentation.summary, /Return the value unchanged/);
		// The open declarations are not exported under their own names.
		for(const name of ["echo", "choose", "first", "duplicate"])
			assert.ok(!model.bindingIr.declarations.some(item => item.id === `lean:Specialized.${name}`), name);
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		archives.push(Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))));
		const dependencies = attempt === 0 && profiles.includes("rust")
			? await prepareRustCorpusDependencies({ rustRoot: join(outputRoot, "native/rust"), directory, handoff: join(consumer, "dependencies"), environment }) : undefined;
		// Install from prepared archives only. No author workspace or build staging remains.
		await rm(directory, { recursive: true, force: true });
		if(attempt === 1) break;
		for(const profile of profiles)
		{
			t.diagnostic(`installing and checking ${profile}`);
			const target = nativeSpecializationTargets[profile][0];
			const packages = receipt.packages.filter(pkg => pkg.target === target);
			const observation = await installSpecializationConsumer({ profile, consumer, handoff, packages, dependencies, environment });
			// The interpreter path is machine-specific; the report keeps portable facts only.
			delete observation.command;
			reports.push({ profile, path: "ordinary-source"
				, ...observation
				, packages
				, exports: exported
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
	const reportPath = resolve(process.env.LEAN_BRIDGE_SPECIALIZATION_REPORT ?? `build/native-specializations/${profiles.join("-")}.json`);
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports, archives: archives[0], reproducible: true }));
});
