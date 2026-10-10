/**
 * Keep every host's existing checked-Subtype corpus while adding independently reviewed cases.
 * These source controls do not claim installed execution.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { validateReviewedSource, reviewedSourceSelection } from "../../src/analyze/reviewed-source.mjs";
import { generateCopiedJvmPackage } from "../../src/backends/jvm/copied-values.mjs";
import { generateCopiedDotnetPackage } from "../../src/backends/dotnet/copied-values.mjs";
import { generateCopiedPythonPackage } from "../../src/backends/python/copied-values.mjs";
import { generateCopiedRustPackage } from "../../src/backends/rust/copied-values.mjs";
import { generateCopiedRubyPackage } from "../../src/backends/ruby/copied-values.mjs";
import { generateCopiedPhpPackage } from "../../src/backends/php/copied-values.mjs";
import { generateWitPackage } from "../../src/backends/wit/generate.mjs";
import { reviewedSubtypeInstalledIr, reviewedSubtypeInstalledSource } from "./reviewed-subtype-installed-fixture.mjs";
import { assertReviewedSubtypeHostDiagnostics, relabelReviewedSubtypeHost, reviewedSubtypeHostConsumer, reviewedSubtypeHostExtensions, reviewedSubtypeHostIr, reviewedSubtypeHostProfiles, reviewedSubtypeHostSource } from "./reviewed-subtype-host-fixture.mjs";
import { reviewedSubtypeHostSupplements } from "./reviewed-subtype-host-supplements.mjs";
import { reviewedSubtypeHostChecks } from "./reviewed-subtype-host-install.mjs";
// Keep original installed-report controls in the registered native-host corpus suite.
import "./reviewed-subtype-remaining-archive-tests.mjs";

test("reviewed host fixture preserves checked types, constructor choices and all twelve exports under portable names", () => {
	const old = reviewedSubtypeInstalledIr(), review = reviewedSubtypeHostIr();
	const source = canonicalJson(review);
	const input = { schemaVersion: 1, path: "api.binding-ir.json", source
		, sourceSha256: sha256(source), semanticSha256: hashBindingIr(review) };
	validateReviewedSource(input);
	const selection = reviewedSourceSelection(input);
	assert.equal(review.declarations.length, 12);
	const previousByte = old.declarations.find(item => item.name === "byte");
	const portableByte = review.declarations.find(item => item.name === "byteValue");
	assert.equal(portableByte.id, "lean:Subtypes.byteValue");
	assert.equal(portableByte.overloadKey, "Subtypes.byteValue");
	assert.equal(portableByte.source.declaration, "Subtypes.byteValue");
	assert.deepEqual(portableByte.parameters, previousByte.parameters);
	assert.deepEqual(portableByte.result, previousByte.result);
	assert.deepEqual(portableByte.source.extensions, previousByte.source.extensions);
	assert.deepEqual(review.declarations.filter(item => item !== portableByte), old.declarations.filter(item => item !== previousByte));
	assert.ok(reviewedSubtypeHostSource.startsWith(reviewedSubtypeInstalledSource));
	assert.match(reviewedSubtypeHostSource, /def byteValue \(value : Byte\) : Byte := byte value/u);
	assert.deepEqual(selection.contracts["Subtypes.firstEven"].parameters[0].refinement, { constructor: "Subtypes.checkedEven" });
	assert.deepEqual(selection.contracts["Subtypes.secondEven"].parameters[0].refinement, { constructor: "Subtypes.normalizedEven" });
	assert.deepEqual(selection.contracts["Subtypes.zeroEven"].parameters, []);
	assert.equal(old.declarations.find(item => item.id === "lean:Subtypes.byte").name, "byte", "Do not mutate earlier reviewed evidence");
});

test("portable reviewed exports generate host packages before any installed build and retain the Java keyword refusal", () => {
	assert.throws(() => generateCopiedJvmPackage(reviewedSubtypeInstalledIr()), /Java function name collides: byte/u);
	const generators = [
		generateCopiedJvmPackage, generateCopiedDotnetPackage
		, generateCopiedPythonPackage, generateCopiedRustPackage
		, generateCopiedRubyPackage, generateCopiedPhpPackage, generateWitPackage
	];
	for(const generate of generators)
	{
		const review = reviewedSubtypeHostIr(), original = canonicalJson(review);
		const result = generate(review);
		assert.ok(Object.keys(generate === generateWitPackage ? result.files : result).length > 0);
		assert.equal(canonicalJson(review), original);
	}
});

test("all nine reviewed native callers retain every original case and add eight matching checks", async () => {
	assert.deepEqual([...reviewedSubtypeHostProfiles].sort(), ["dotnet", "java", "kotlin", "perl", "php-native", "python", "ruby", "rust", "wit-wasi"]);
	assert.deepEqual(Object.keys(reviewedSubtypeHostSupplements).sort(), [...reviewedSubtypeHostProfiles].sort());
	const counts = { python: 14, rust: 14, dotnet: 14, java: 15, kotlin: 15, ruby: 15, "php-native": 14, "wit-wasi": 14, perl: 17 };
	for(const profile of reviewedSubtypeHostProfiles)
	{
		const original = await readFile(`tests/fixtures/subtype-consumers/${profile}.${reviewedSubtypeHostExtensions[profile]}`, "utf8");
		const source = await reviewedSubtypeHostConsumer(profile), supplement = reviewedSubtypeHostSupplements[profile];
		const restored = source.replaceAll(/\bvalue(\d+) (was rejected by|is not below)/gu, "arg$1 $2")
			.replaceAll(/(["'])value(\d+)\1, (?=["'](?:Subtypes\.|\d))/gu, "$1arg$2$1, ");
		assert.equal(restored.split(supplement).length, 2, profile);
		assert.equal(restored.replace(supplement, ""), original, `${profile}: no original case was dropped or changed`);
		const checks = text => [...text.matchAll(/\b(?:check!?|Check|CHECK)\(/gu)].length;
		assert.equal(checks(source) - checks(original), 8, profile);
		assert.equal(assertReviewedSubtypeHostDiagnostics(source, profile), counts[profile]);
		assert.throws(() => assertReviewedSubtypeHostDiagnostics(original, profile), /Unknown parameter/u);
		assert.throws(() => relabelReviewedSubtypeHost(source, profile), /Expected an ordinary diagnostic label/u);
	}
});

test("reviewed Perl acceptance counts all 17 original checks, eight additions and 1000 rejection/recovery pairs", async () => {
	const original = await readFile("tests/fixtures/subtype-consumers/perl.pl", "utf8");
	const source = await reviewedSubtypeHostConsumer("perl");
	const count = text => [...text.matchAll(/^check\(/gmu)].length;
	assert.equal(count(original), 17);
	assert.equal(count(reviewedSubtypeHostSupplements.perl), 8);
	assert.equal(count(source), 25);
	assert.match(source, /for my \$i \(0 \.\. 999\) \{/u);
	assert.match(source, /die "invalid call accepted at \$i\\n" unless rejected/u);
	assert.match(source, /die "valid call failed at \$i\\n" unless LeanBridge::Subtypes::half/u);
	assert.match(source, /^\$checks \+= 2000;$/mu);
	assert.equal(reviewedSubtypeHostChecks.perl, 2000 + count(source));
});

test("reviewed host diagnostic checks reject stale names, changed calls, wrong constructors and bounds", async () => {
	for(const profile of reviewedSubtypeHostProfiles)
	{
		const source = await reviewedSubtypeHostConsumer(profile);
		assert.throws(() => assertReviewedSubtypeHostDiagnostics(source.replace("value0", "arg0"), profile), /Unknown parameter/u);
		assert.throws(() => assertReviewedSubtypeHostDiagnostics(source.replace("value0", "value1"), profile), /Unknown parameter|different checked parameter/u);
		assert.throws(() => assertReviewedSubtypeHostDiagnostics(source.replace("Subtypes.checkedWord", "Subtypes.checkedEven"), profile), /different checked parameter/u);
		const changedBound = source.replace("Fin 10 bound", "Fin 11 bound").replace(/(["'])value1\1, (["'])10\2/u, "$1value1$1, $211$2");
		assert.notEqual(changedBound, source, profile);
		assert.throws(() => assertReviewedSubtypeHostDiagnostics(changedBound, profile), /different checked parameter/u);
		const review = reviewedSubtypeHostIr();
		review.declarations = review.declarations.filter(item => item.name !== "shout");
		assert.throws(() => assertReviewedSubtypeHostDiagnostics(source, profile, review), /Unreviewed called export/u);
		assert.throws(() => assertReviewedSubtypeHostDiagnostics("", profile), /No reviewed diagnostics/u);
	}
	const review = reviewedSubtypeHostIr();
	review.declarations.find(item => item.name === "shout").parameters[0].name = "word";
	const line = "check(rejected(lambda: api.shout(''), 'arg0', 'Subtypes.checkedWord'), 'empty word')";
	const relabeled = relabelReviewedSubtypeHost(line, "python", review);
	assert.ok(relabeled.includes("'word', 'Subtypes.checkedWord'"));
	assert.equal(assertReviewedSubtypeHostDiagnostics(relabeled, "python", review), 1);
	assert.throws(() => assertReviewedSubtypeHostDiagnostics(relabeled, "python"), /Unknown parameter/u);
	for(const profile of ["", "unknown", "c", "cpp", "npm"])
	{
		assert.throws(() => relabelReviewedSubtypeHost(line, profile), /Unknown reviewed Subtype host/u);
		assert.throws(() => assertReviewedSubtypeHostDiagnostics(line, profile), /Unknown reviewed Subtype host/u);
		await assert.rejects(reviewedSubtypeHostConsumer(profile), /Unknown reviewed Subtype host/u);
	}
});
