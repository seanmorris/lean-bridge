/** @file */
import assert from "node:assert/strict";
import test from "node:test";
import {
	managedCompilationDiagnostic, managedDiagnosticCount, managedDiagnosticPattern
	, optionalParameterPhpPatterns, optionalParameterWitPatterns
} from "./helpers/optional-parameter-installed-contract.mjs";
import {
	validateOptionalParameterLanguageClosure
} from "./helpers/optional-parameter-language-report.mjs";

const ordinary = `
character: func(arg0: char) -> char;
character-default: func() -> char;
maybe: func(arg0: bridge-value-2) -> bridge-value-2;
maybe-default: func() -> bridge-value-2;
natural: func(arg0: bridge-value-3) -> bridge-value-3;
natural-default: func() -> bridge-value-3;
present: func(arg0: bridge-value-2) -> bridge-value-2;
present-default: func() -> bridge-value-2;
text: func(arg0: string) -> string;
text-default: func() -> string;
unit-value: func(arg0: bridge-value-5) -> bridge-value-5;
unit-value-default: func() -> bridge-value-5;
word: func(arg0: u32) -> u32;
word-default: func() -> u32;
`;

test("optional-parameter WIT contracts retain route-specific binders", () => {
	for(const pattern of optionalParameterWitPatterns("ordinary"))
		assert.match(ordinary, pattern);
	const reviewed = ordinary.replaceAll("arg0", "value0");
	for(const pattern of optionalParameterWitPatterns("reviewed"))
		assert.match(reviewed, pattern);
	assert.throws(() => optionalParameterWitPatterns("foreign"), /unknown/u);
	assert.doesNotMatch(ordinary, optionalParameterWitPatterns("reviewed").at(-2));
});

test("optional-parameter PHP contracts retain route-specific binders", () => {
	const source = `
function natural(mixed $arg0 = null): \\Brick\\Math\\BigInteger {}
function present(mixed $arg0 = null): Some|null {
  if (\\func_num_args() <= 0) { $arg0 = new Some(9); }
}
function unit_value(mixed $arg0 = null): null {}
function word(mixed $arg0 = 7): int {}
`;
	for(const pattern of optionalParameterPhpPatterns("ordinary"))
		assert.match(source, pattern);
	const reviewed = source.replaceAll("arg0", "value0");
	for(const pattern of optionalParameterPhpPatterns("reviewed"))
		assert.match(reviewed, pattern);
	assert.throws(() => optionalParameterPhpPatterns("foreign"), /unknown/u);
	assert.doesNotMatch(source, optionalParameterPhpPatterns("reviewed")[0]);
});

test("managed compiler diagnostics retain stdout and stderr", () => {
	assert.equal(managedCompilationDiagnostic({
		message: "command failed"
		, details: { stdout: "CS1503 one", stderr: "CS1503 two" }
	}), "CS1503 one\nCS1503 two");
	assert.equal(managedCompilationDiagnostic({
		message: "command failed", details: { stdout: "CS1503 one", stderr: "" }
	}), "CS1503 one");
	assert.equal(managedCompilationDiagnostic({ message: "command failed" })
		, "command failed");
	const kotlin = "null cannot be a value of a non-null type 'Long'\n"
		+ "null can not be a value of a non-null type 'BigInteger'";
	assert.match(kotlin, managedDiagnosticPattern("kotlin"));
	assert.equal(managedDiagnosticCount("kotlin", kotlin), 2);
	assert.throws(() => managedDiagnosticPattern("foreign"), /unknown/u);
});

test("optional Python closure retains version and receipt identity", () => {
	const sha = "a".repeat(64);
	const closure = {
		baselineSha256: sha, environmentSha256: sha, interpreterSha256: sha
		, python: "3.12.15", receiptSha256: sha
	};
	assert.doesNotThrow(() => validateOptionalParameterLanguageClosure(
		"python", closure));
	assert.throws(() => validateOptionalParameterLanguageClosure("python", {
		...closure, receiptSha256: undefined
	}));
	assert.throws(() => validateOptionalParameterLanguageClosure("python", {
		...closure, python: sha
	}));
});
