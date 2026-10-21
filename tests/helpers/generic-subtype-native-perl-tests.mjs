/**
 * Static controls for generic Subtype composition consumers outside JavaScript.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { generateCBindingPackage } from "../../src/backends/c/generate.mjs";
import { generateGmpProjection } from "../../src/backends/c/gmp-projection.mjs";
import { generateCppBindingPackage } from "../../src/backends/cpp/generate.mjs";
import { boostSources } from "../../src/backends/cpp/boost.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { nominalSubtypeInstalledConfiguration, nominalSubtypeInstalledReview } from "./nominal-subtype-installed-fixture.mjs";
import { nominalSubtypePerlModule } from "./nominal-subtype-perl-fixture.mjs";
import { genericSubtypeSafePath } from "./generic-subtype-native-perl-report.mjs";
import {
	genericSubtypeNativeCaller
	, genericSubtypeNativeExpected
	, genericSubtypeNativeSelection
	, genericSubtypePerlCaller
	, genericSubtypePerlConfiguration
	, genericSubtypePerlExpected
	, genericSubtypePerlSelection
	, parseGenericSubtypePerlResult
} from "./generic-subtype-native-perl.mjs";

test("generic Subtype hosted lanes retain both native consumer families", async () => {
	const workflow = await readFile(".github/workflows/generic-subtype-native-perl.yml", "utf8");
	for(const text of ["name: Generic Subtypes in C, C++ and Perl"
		, "bash scripts/run-generic-subtype-native-ci.sh"
		, "bash scripts/run-generic-subtype-perl-ci.sh"
		, "name: generic-subtype-native-${{ github.sha }}"
		, "name: generic-subtype-perl-${{ github.sha }}"])
		assert.ok(workflow.includes(text), text);
	for(const [path, prefix, checker] of [
		["scripts/run-generic-subtype-native-ci.sh", "LEAN_BRIDGE_GENERIC_SUBTYPE_NATIVE_", "--kind native"]
		, ["scripts/run-generic-subtype-perl-ci.sh", "LEAN_BRIDGE_GENERIC_SUBTYPE_PERL_", "--kind perl"]
	]) {
		const source = await readFile(path, "utf8");
		assert.ok(source.includes(`${prefix}TEST=1`));
		assert.ok(source.includes(`${prefix}ROUTES="$route"`));
		assert.ok(source.includes("for route in ordinary reviewed"));
		assert.ok(source.includes(checker));
		assert.ok(source.includes("$(git rev-parse HEAD)"));
	}
	for(const path of ["report.json", "build-0/model.json", "5.38.2-threaded/prebuilt-only/first.json"])
		assert.equal(genericSubtypeSafePath(path), path);
	for(const path of ["", "/report.json", "../report.json", "a//b", "a/./b", "a/../b"])
		assert.throws(() => genericSubtypeSafePath(path));
});

test("generic Subtype native and Perl gates require explicit complete selections", () => {
	assert.deepEqual(genericSubtypeNativeSelection({}), { enabled: false
		, routes: ["ordinary", "reviewed"], profiles: ["c", "cpp"] });
	assert.deepEqual(genericSubtypePerlSelection({}), { enabled: false
		, routes: ["ordinary", "reviewed"] });
	for(const [prefix, select] of [["LEAN_BRIDGE_GENERIC_SUBTYPE_NATIVE_", genericSubtypeNativeSelection]
		, ["LEAN_BRIDGE_GENERIC_SUBTYPE_PERL_", genericSubtypePerlSelection]]) {
		assert.equal(select({ [prefix + "TEST"]: "1" }).enabled, true);
		for(const value of ["", "true", "2"]) assert.throws(() => select({ [prefix + "TEST"]: value }));
		for(const value of ["", "unknown", "ordinary,ordinary", "reviewed,"])
			assert.throws(() => select({ [prefix + "TEST"]: "1", [prefix + "ROUTES"]: value }));
		assert.throws(() => select({ [prefix + "ROUTES"]: "ordinary" }));
		assert.throws(() => select({ [prefix + "OUTPUT"]: "build/forged" }));
		}
	for(const value of ["", "perl", "c,c", "cpp,"])
		assert.throws(() => genericSubtypeNativeSelection({ LEAN_BRIDGE_GENERIC_SUBTYPE_NATIVE_TEST: "1"
			, LEAN_BRIDGE_GENERIC_SUBTYPE_NATIVE_PROFILES: value }));
});

test("generic Subtype configuration selects the closed record and both specializations", () => {
	for(const route of ["ordinary", "reviewed"])
	{
		const actual = genericSubtypePerlConfiguration(route);
		const expected = nominalSubtypeInstalledConfiguration(route, ["c"], false, { genericCompositions: true });
		assert.deepEqual({ ...actual, targets: expected.targets }, expected);
		assert.deepEqual(actual.targets, { cpan: { module: nominalSubtypePerlModule, version: "1.000" } });
		assert.deepEqual(actual.modules, ["NominalSubtypes", "NominalSubtypes.GenericCompositions"]);
		if(route === "ordinary")
		{
			assert.deepEqual(actual.specializations.map(item => item.name), [
				"NominalSubtypes.GenericCompositions.echoGenericFirst"
				, "NominalSubtypes.GenericCompositions.echoGenericSecond"
			]);
		}
	}
	assert.deepEqual(parseGenericSubtypePerlResult(JSON.stringify(genericSubtypePerlExpected))
		, genericSubtypePerlExpected);
	assert.throws(() => parseGenericSubtypePerlResult('{"checks":17,"rejections":3}'));
});

test("C and C++ generic Subtype callers compile against the generated public surface", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-generic-subtype-native-callers-"));
	t.after(() => rm(root, { recursive: true }));
	const review = nominalSubtypeInstalledReview(false, { genericCompositions: true });
	for(const profile of ["c", "cpp"])
	{
		const directory = join(root, profile);
		const files = { ...generateCBindingPackage(review)
			, ...profile === "c" ? generateGmpProjection(review).files
				: { ...generateCppBindingPackage(review), ...boostSources() } };
		for(const [path, source] of Object.entries(files)) await saveLakeFile(directory, path, source);
		for(const route of ["ordinary", "reviewed"])
		{
			const source = await genericSubtypeNativeCaller(profile, route);
			assert.ok(source.includes(`generic-subtype-ok:%u`));
			assert.ok(source.includes(`${genericSubtypeNativeExpected[profile] === 14 ? "nominalsubtypes_generic_use" : "api::generic_use"}`));
			await saveLakeFile(directory, `consumer.${profile}`, source);
			await runCopied(profile === "c" ? "/usr/bin/cc" : "/usr/bin/c++"
				, [`-std=${profile === "c" ? "c11" : "c++20"}`
					, "-Wall", "-Wextra", "-Werror"
					, "-fsyntax-only", "-Iinclude", `consumer.${profile}`], directory);
			t.diagnostic(`${profile} ${route}: generic public-header syntax only`);
		}
	}
});

test("Perl generic Subtype caller checks normalization, rejection and recovery", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-generic-subtype-perl-caller-"));
	t.after(() => rm(root, { recursive: true }));
	for(const route of ["ordinary", "reviewed"])
	{
		const directory = join(root, route);
		const label = route === "ordinary" ? "arg0" : "value0";
		await saveLakeFile(directory, "LeanBridge/NominalSubtypes.pm", `package LeanBridge::NominalSubtypes::GenericNat;
sub new { my ($class, %value) = @_; bless \\%value, $class }
package LeanBridge::NominalSubtypes;
use strict; use warnings; use Carp qw(croak); use Math::BigInt;
sub _apply { my ($value, $limit, $step, $constructor) = @_; croak "${label}.value was rejected by NominalSubtypes.$constructor" if $value->{value}->bcmp($limit) >= 0; return $value->{value}->copy->badd($step) }
sub generic_use { my ($value) = @_; return _apply($value, 100, 1, 'plusOne')->badd($value->{marker}) }
sub echo_generic_first { my ($value) = @_; return LeanBridge::NominalSubtypes::GenericNat->new(value => _apply($value, 100, 1, 'plusOne'), marker => $value->{marker}->copy) }
sub echo_generic_second { my ($value) = @_; return LeanBridge::NominalSubtypes::GenericNat->new(value => _apply($value, 90, 2, 'plusTwo'), marker => $value->{marker}->copy) }
1;
`);
		await saveLakeFile(directory, "consumer.pl", await genericSubtypePerlCaller(route));
		const result = await runCopied("/usr/bin/perl", ["consumer.pl"], directory, { PERL5LIB: directory, PATH: "/unavailable" });
		assert.equal(result.stderr, "");
		assert.deepEqual(parseGenericSubtypePerlResult(result.stdout), genericSubtypePerlExpected);
	}
});
