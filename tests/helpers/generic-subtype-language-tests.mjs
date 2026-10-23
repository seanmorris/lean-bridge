/**
 * Static and oracle controls for generic Subtype language callers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import {
	genericSubtypeLanguageCaller
	, genericSubtypeLanguageConfiguration
	, genericSubtypeLanguageExpected
	, genericSubtypeLanguageSelection
	, parseGenericSubtypeLanguageResult
} from "./generic-subtype-languages.mjs";
import {
	assertGenericSubtypeLanguageTap
	, genericSubtypeLanguageSafePath
	, parseGenericSubtypeLanguageCiArgs
} from "./generic-subtype-language-report.mjs";
import { checkNominalSubtypeRustApiProbe, genericSubtypeRustInputNames } from "./nominal-subtype-rust-install.mjs";

const rustc = resolve(process.env.LEAN_BRIDGE_RUSTC
	?? ".toolchains/rust-1.90.0/bin/rustc");

test("generic Subtype language selections and configurations remain closed", () => {
	for(const language of ["python", "ruby", "rust"])
	{
		const prefix = `LEAN_BRIDGE_GENERIC_SUBTYPE_${language.toUpperCase()}_`;
		assert.deepEqual(genericSubtypeLanguageSelection(language, {}), {
			enabled: false, routes: ["ordinary", "reviewed"]
		});
		assert.deepEqual(genericSubtypeLanguageSelection(language, {
			[prefix + "TEST"]: "1", [prefix + "ROUTES"]: "reviewed"
		}), { enabled: true, routes: ["reviewed"] });
		for(const flag of ["", "true", "2"])
			assert.throws(() => genericSubtypeLanguageSelection(language, { [prefix + "TEST"]: flag }));
		for(const routes of ["", "unknown", "ordinary,ordinary", "reviewed,"])
			assert.throws(() => genericSubtypeLanguageSelection(language, {
				[prefix + "TEST"]: "1", [prefix + "ROUTES"]: routes
			}));
		for(const route of ["ordinary", "reviewed"])
		{
			const configuration = genericSubtypeLanguageConfiguration(language, route);
			assert.deepEqual(configuration.modules, ["NominalSubtypes", "NominalSubtypes.GenericCompositions"]);
			assert.deepEqual(Object.keys(configuration.targets), [
				{ python: "pypi", ruby: "rubygems", rust: "cargo" }[language]
			]);
		}
	}
	assert.deepEqual(parseGenericSubtypeLanguageResult(JSON.stringify(genericSubtypeLanguageExpected))
		, genericSubtypeLanguageExpected);
	assert.throws(() => parseGenericSubtypeLanguageResult('{"checks":17,"rejections":3}'));
});

test("generic Subtype language hosted controls remain fixed and path-safe", async () => {
	const producer = "a".repeat(40);
	const selected = parseGenericSubtypeLanguageCiArgs([
		"--language", "python", "--route", "ordinary", "--producer", producer
		, "--directory", "build/records", "--tap", "build/run.tap"
	]);
	assert.deepEqual(selected, {
		language: "python", route: "ordinary"
		, producerCommit: producer
		, directory: "build/records", tap: "build/run.tap"
	});
	const invalidLanguage = ["--language", "php", "--route", "ordinary"
		, "--producer", producer, "--directory", "build/records"
		, "--tap", "build/run.tap"];
	for(const arguments_ of [[], invalidLanguage])
		assert.throws(() => parseGenericSubtypeLanguageCiArgs(arguments_));
	assert.equal(genericSubtypeLanguageSafePath("build-0/NominalSubtypes.GenericCompositions.lean")
		, "build-0/NominalSubtypes.GenericCompositions.lean");
	for(const path of ["/absolute", "../escape", "a//b", "a/./b"])
		assert.throws(() => genericSubtypeLanguageSafePath(path));
	const label = "installed generic Subtype Python compositions reproduce and relocate ordinary full";
	const tap = `TAP version 13\n# Subtest: ${label}\nok 1 - ${label}\n1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 1\n`;
	assertGenericSubtypeLanguageTap(tap, "python", "ordinary");
	assert.throws(() => assertGenericSubtypeLanguageTap(tap.replace("# pass 1", "# pass 0"), "python", "ordinary"));
	const probe = checkNominalSubtypeRustApiProbe({ code: 0, stderr: ""
		, stdout: '{"reason":"build-finished","success":true}\n' }, "full", true);
	assert.deepEqual(probe, { absent: [], present: [...genericSubtypeRustInputNames] });
	const workflow = await readFile(".github/workflows/generic-subtype-languages.yml", "utf8");
	for(const language of ["python", "ruby", "rust"])
	{
		const runner = await readFile(`scripts/run-generic-subtype-${language}-ci.sh`, "utf8");
		assert.match(runner, new RegExp(`LEAN_BRIDGE_GENERIC_SUBTYPE_${language.toUpperCase()}_TEST=1`, "u"));
		assert.match(runner, /check-generic-subtype-language-ci\.mjs/u);
		assert.match(workflow, new RegExp(`run-generic-subtype-${language}-ci\\.sh`, "u"));
	}
});

test("generic Subtype Python caller detects normalization and exact rejection", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-generic-subtype-python-caller-"));
	t.after(() => rm(root, { recursive: true }));
	for(const route of ["ordinary", "reviewed"])
	{
		const directory = join(root, route), label = route === "ordinary" ? "arg0" : "value0";
		await saveLakeFile(directory, "lean_nominalsubtypes.py", `from dataclasses import dataclass
class LeanBridgeError(Exception):
    def __init__(self, message): super().__init__(message); self.status = 1
@dataclass(frozen=True)
class GenericNat: value: int; marker: int
def _apply(value, limit, step, constructor):
    if value.value >= limit: raise LeanBridgeError('${label}.value was rejected by NominalSubtypes.' + constructor)
    return value.value + step
def generic_use(value): return _apply(value, 100, 1, 'plusOne') + value.marker
def echo_generic_first(value): return GenericNat(_apply(value, 100, 1, 'plusOne'), value.marker)
def echo_generic_second(value): return GenericNat(_apply(value, 90, 2, 'plusTwo'), value.marker)
`);
		await saveLakeFile(directory, "consumer.py", await genericSubtypeLanguageCaller("python", route));
		const run = await runCopied("/usr/bin/python3", ["-B", "consumer.py"], directory, { PATH: "/unavailable", PYTHONPATH: directory });
		assert.equal(run.stderr, ""); assert.deepEqual(parseGenericSubtypeLanguageResult(run.stdout), genericSubtypeLanguageExpected);
	}
});

test("generic Subtype Ruby caller detects normalization and exact rejection", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-generic-subtype-ruby-caller-"));
	t.after(() => rm(root, { recursive: true }));
	for(const route of ["ordinary", "reviewed"])
	{
		const directory = join(root, route), label = route === "ordinary" ? "arg0" : "value0";
		await saveLakeFile(directory, "lean_bridge/nominalsubtypes.rb", `module LeanBridge
module Nominalsubtypes
  class GenericNat
    attr_reader :value, :marker
    def initialize(value:, marker:) @value = value; @marker = marker end
  end
  def self.apply(value, limit, step, constructor)
    raise RangeError, "${label}.value was rejected by NominalSubtypes.#{constructor}" if value.value >= limit
    value.value + step
  end
  def self.generic_use(value) apply(value, 100, 1, "plusOne") + value.marker end
  def self.echo_generic_first(value) GenericNat.new(value: apply(value, 100, 1, "plusOne"), marker: value.marker) end
  def self.echo_generic_second(value) GenericNat.new(value: apply(value, 90, 2, "plusTwo"), marker: value.marker) end
end
end
`);
		await saveLakeFile(directory, "consumer.rb", await genericSubtypeLanguageCaller("ruby", route));
		const run = await runCopied("/usr/bin/ruby", ["--disable-gems", "-I", directory, "consumer.rb"], directory, { PATH: "/unavailable" });
		assert.equal(run.stderr, ""); assert.deepEqual(parseGenericSubtypeLanguageResult(run.stdout), genericSubtypeLanguageExpected);
	}
});

test("generic Subtype Rust caller compiles against an independent public oracle", { skip: !existsSync(rustc) }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-generic-subtype-rust-caller-"));
	t.after(() => rm(root, { recursive: true }));
	for(const route of ["ordinary", "reviewed"])
	{
		const directory = join(root, route), label = route === "ordinary" ? "arg0" : "value0";
		await saveLakeFile(directory, "lib.rs", `#[derive(Clone, Debug, PartialEq, Eq)] pub struct BigUint(u64);
impl From<u64> for BigUint { fn from(value: u64) -> Self { Self(value) } }
impl BigUint { pub fn to_u32_digits(&self) -> Vec<u32> { vec![self.0 as u32] } }
#[derive(Debug)] pub enum Error { Native { code: u32, message: String }, Other }
#[derive(Debug)] pub struct GenericNat { pub value: BigUint, pub marker: BigUint }
fn apply(value: &GenericNat, limit: u64, step: u64, constructor: &str) -> Result<BigUint, Error> {
    if value.value.0 >= limit { return Err(Error::Native { code: 1, message: format!("${label}.value was rejected by NominalSubtypes.{constructor}") }); }
    Ok(BigUint(value.value.0 + step))
}
pub fn generic_use(value: &GenericNat) -> Result<BigUint, Error> { Ok(BigUint(apply(value, 100, 1, "plusOne")?.0 + value.marker.0)) }
pub fn echo_generic_first(value: &GenericNat) -> Result<GenericNat, Error> { Ok(GenericNat { value: apply(value, 100, 1, "plusOne")?, marker: value.marker.clone() }) }
pub fn echo_generic_second(value: &GenericNat) -> Result<GenericNat, Error> { Ok(GenericNat { value: apply(value, 90, 2, "plusTwo")?, marker: value.marker.clone() }) }
`);
		await saveLakeFile(directory, "main.rs", await genericSubtypeLanguageCaller("rust", route));
		const libraryArgs = ["--crate-name", "nominalsubtypes", "--crate-type", "rlib"
			, "--edition", "2021", "lib.rs", "-o", "libnominalsubtypes.rlib"];
		const consumerArgs = ["--edition", "2021", "main.rs", "--extern"
			, "nominalsubtypes=libnominalsubtypes.rlib", "-o", "consumer"];
		const compileEnvironment = { PATH: "/usr/bin" };
		await runCopied(rustc, libraryArgs, directory, compileEnvironment);
		await runCopied(rustc, consumerArgs, directory, compileEnvironment);
		const run = await runCopied(join(directory, "consumer"), [], directory, { PATH: "/unavailable" });
		assert.equal(run.stderr, ""); assert.deepEqual(parseGenericSubtypeLanguageResult(run.stdout), genericSubtypeLanguageExpected);
	}
});
