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

/**
 * Run the complete original primitive-site corpus plus the independent review's extra cases.
 *
 * @param profile - C or C++ consumer.
 */
export const reviewedSubtypeNativeConsumer = async profile => {
	assert.ok(Object.hasOwn(supplemental, profile));
	const source = await readFile(`tests/fixtures/subtype-consumers/${profile}.${profile === "c" ? "c" : "cpp"}`, "utf8");
	const marker = "  checks += 2000;\n";
	assert.equal(source.split(marker).length, 2);
	return source.replace(marker, supplemental[profile] + marker);
};
