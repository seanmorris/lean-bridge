/**
 * Independent reviewed Subtype decisions, including two constructors for one specialization
 * source and a genuinely zero-argument result. No compiled model supplies this review.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { reviewedSubtypeExtraSource, reviewedSubtypeIr } from "./reviewed-subtype-fixture.mjs";
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";

export const reviewedSubtypeInstalledSource = `${reviewedSubtypeExtraSource}
namespace Subtypes
def zeroEven : Even := ⟨0, by decide⟩
end Subtypes
`;

/** Describe every reviewed export before compiling the fixture. */
export const reviewedSubtypeInstalledIr = () => {
	const review = reviewedSubtypeIr(true);
	const zero = corpusReviewedIr({ id: "subtypes" }, [{ name: "Subtypes.zeroEven", parameters: [], result: "nat" }]).declarations[0];
	zero.source.extensions["lean-lang.org/refinements"] = { parameters: [], result: { kind: "subtype", constructor: "Subtypes.checkedEven" } };
	review.declarations.push(zero);
	return review;
};

const supplemental = {
	c: `  /* Independent reviewed choices add a UInt8 base, two concrete instances of echo, and a zero-argument result. */
  uint8_t byte_result = 99;
  CHECK(OK(subtypes_byte(255, &byte_result, &error)) && byte_result == 255);
  CHECK(rejected(subtypes_byte(0, &byte_result, &error), &error, "arg0 was rejected by Subtypes.checkedByte") && byte_result == 255);
  mpz_set_ui(in, 6); CHECK(OK(subtypes_first_even(in, result, &error)) && mpz_cmp_ui(result, 6) == 0);
  mpz_set_ui(in, 7); CHECK(rejected(subtypes_first_even(in, result, &error), &error, "arg0 was rejected by Subtypes.checkedEven"));
  CHECK(OK(subtypes_second_even(in, result, &error)) && mpz_cmp_ui(result, 14) == 0 && mpz_cmp_ui(in, 7) == 0);
  mpz_set_ui(in, 0); mpz_setbit(in, 100);
  CHECK(OK(subtypes_second_even(in, result, &error)) && mpz_popcount(result) == 1 && mpz_tstbit(result, 101));
  CHECK(OK(subtypes_zero_even(result, &error)) && mpz_cmp_ui(result, 0) == 0);
`
	, cpp: `  /* The same generic source uses a rejecting constructor and a normalizing constructor independently. */
  CHECK(api::byte(255) == 255);
  CHECK(rejected([] { api::byte(0); }, "arg0 was rejected by Subtypes.checkedByte"));
  CHECK(api::first_even(6) == 6);
  CHECK(rejected([] { api::first_even(7); }, "arg0 was rejected by Subtypes.checkedEven"));
  CHECK(api::second_even(7) == 14);
  CHECK(api::second_even(Nat(1) << 100) == Nat(1) << 101);
  CHECK(api::zero_even() == 0);
`
};

// An expected public diagnostic names one parameter and either its constructor or its Fin bound.
const diagnostic = /"(\w+) (was rejected by ([\w.]+)|is not below its Fin (\d+) bound)"/gu;
const calls = { c: /\bsubtypes_([a-z_]+)\(/gu, cpp: /\bapi::([a-z_]+)\(/gu };

/**
 * The one reviewed declaration an expected diagnostic's line calls.
 *
 * @param review - Reviewed Binding IR.
 * @param profile - C or C++ consumer.
 * @param line - Consumer source line holding the diagnostic.
 */
const calledDeclaration = (review, profile, line) => {
	const names = [...new Set([...line.matchAll(calls[profile])].map(match => match[1]))];
	assert.equal(names.length, 1, `one export call per expected diagnostic: ${line}`);
	const id = `lean:Subtypes.${names[0].replace(/_([a-z])/gu, (_, letter) => letter.toUpperCase())}`;
	const declaration = review.declarations.find(item => item.id === id);
	assert.ok(declaration, `${id} is not reviewed`);
	return declaration;
};

/**
 * Check that a reviewed parameter has the diagnostic's constructor or Fin bound.
 *
 * @param declaration - Reviewed declaration.
 * @param position - Parameter index.
 * @param constructor - Named constructor, for a constructor rejection.
 * @param bound - Fin bound, for a bound rejection.
 * @param text - Diagnostic, for failure messages.
 */
const checkedParameter = (declaration, position, constructor, bound, text) => {
	assert.ok(declaration.parameters[position], `${declaration.id} has no reviewed parameter ${position}: ${text}`);
	const refinement = declaration.source.extensions["lean-lang.org/refinements"].parameters[position];
	assert.deepEqual(refinement, constructor === undefined ? { kind: "fin", bound } : { kind: "subtype", constructor }, text);
	return declaration.parameters[position];
};

/**
 * Relabel the original corpus's ordinary argument labels with the reviewed parameter names. Only
 * expected parameter diagnostics change; every other byte, status check and recovery case stays.
 *
 * @param source - Original consumer source plus the supplemental cases.
 * @param profile - C or C++ consumer.
 * @param review - Reviewed Binding IR whose names the public diagnostics carry.
 */
export const relabelReviewedSubtypeDiagnostics = (source, profile, review = reviewedSubtypeInstalledIr()) => {
	const relabel = line => line.replace(diagnostic, (text, label, rest, constructor, bound) => {
		const position = /^arg(\d+)$/u.exec(label);
		assert.ok(position, `expected an ordinary argument label: ${text}`);
		return JSON.stringify(`${checkedParameter(calledDeclaration(review, profile, line), Number(position[1]), constructor, bound, text).name} ${rest}`);
	});
	return source.split("\n").map(relabel).join("\n");
};

/**
 * Assert every expected parameter diagnostic carries the reviewed name of the parameter it checks,
 * and return how many there are.
 *
 * @param source - Generated consumer source.
 * @param profile - C or C++ consumer.
 * @param review - Reviewed Binding IR.
 */
export const assertReviewedSubtypeDiagnostics = (source, profile, review = reviewedSubtypeInstalledIr()) => {
	let count = 0;
	for(const line of source.split("\n"))
		for(const [text, label, , constructor, bound] of line.matchAll(diagnostic))
		{
			const declaration = calledDeclaration(review, profile, line);
			const position = declaration.parameters.findIndex(parameter => parameter.name === label);
			assert.ok(position >= 0, `stale or unreviewed diagnostic label: ${text}`);
			checkedParameter(declaration, position, constructor, bound, text);
			count++;
		}
	return count;
};

/**
 * Run the complete original primitive-site corpus plus the independent review's extra cases. The
 * public diagnostics name the reviewed parameters, so the expected labels follow the review.
 *
 * @param profile - C or C++ consumer.
 */
export const reviewedSubtypeNativeConsumer = async profile => {
	assert.ok(Object.hasOwn(supplemental, profile));
	const source = await readFile(`tests/fixtures/subtype-consumers/${profile}.${profile === "c" ? "c" : "cpp"}`, "utf8");
	const marker = "  checks += 2000;\n";
	assert.equal(source.split(marker).length, 2);
	const relabeled = relabelReviewedSubtypeDiagnostics(source.replace(marker, supplemental[profile] + marker), profile);
	assertReviewedSubtypeDiagnostics(relabeled, profile);
	return relabeled;
};
