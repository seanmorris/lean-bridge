/**
 * Independent ordinary and reviewed checked-constructor selections for wasm32 PHP.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { nativeSubtypeContracts, nativeSubtypeRefinements } from "./native-subtype-install.mjs";
import { reviewedSubtypeInstalledIr, reviewedSubtypeInstalledSource } from "./reviewed-subtype-installed-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const site = constructor => ({ ownership: "copy", lifetime: null, refinement: { constructor } });
const checked = constructor => ({ kind: "subtype", constructor });
const extras = {
	byte: ["Subtypes.checkedByte", "Subtypes.checkedByte"]
	, firstEven: ["Subtypes.checkedEven", "Subtypes.checkedEven"]
	, secondEven: ["Subtypes.normalizedEven", "Subtypes.checkedEven"]
	, zeroEven: [null, "Subtypes.checkedEven"]
};
const contracts = { ...nativeSubtypeContracts }, refinements = { ...nativeSubtypeRefinements };
for(const [name, [input, output]] of Object.entries(extras))
{
	contracts[`Subtypes.${name}`] = { parameters: input === null ? [] : [site(input)], result: site(output) };
	refinements[`Subtypes.${name}`] = { parameters: input === null ? [] : [checked(input)], result: checked(output) };
}
export const phpWasmSubtypeContracts = Object.freeze(contracts);
export const phpWasmSubtypeRefinements = Object.freeze(refinements);
export const phpWasmSubtypeSpecializations = Object.freeze(["firstEven", "secondEven"].map(name => ({
	name: `Subtypes.${name}`, declaration: "Subtypes.echo"
	, types: ["Subtypes.Even"]
})));

/** Keep reviewed parameter names identical to the original public PHP caller's names. */
export const phpWasmSubtypeReview = () => {
	const review = reviewedSubtypeInstalledIr();
	for(const declaration of review.declarations)
		declaration.parameters.forEach((parameter, index) => { parameter.name = `arg${index}`; });
	return review;
};

const supplemental = `// Distinct checked and normalizing constructors for one generic, plus a scalar base and a zero-argument result.
check(\\LeanSubtypes\\byte(255) === 255, 'nonzero byte');
check(rejected(fn() => \\LeanSubtypes\\byte(0), 'arg0 was rejected by Subtypes.checkedByte'), 'zero byte');
check(\\LeanSubtypes\\first_even(n(6))->isEqualTo(6), 'checked specialization');
check(rejected(fn() => \\LeanSubtypes\\first_even(n(7)), 'arg0 was rejected by Subtypes.checkedEven'), 'specialized rejection');
$unchanged = n(7);
check(\\LeanSubtypes\\second_even($unchanged)->isEqualTo(14) && $unchanged->isEqualTo(7), 'normalized specialization retains input');
$huge = n(2)->power(100);
check(\\LeanSubtypes\\second_even($huge)->isEqualTo(n(2)->power(101)) && $huge->isEqualTo(n(2)->power(100)), 'wide normalization retains input');
check(\\LeanSubtypes\\zero_even()->isEqualTo(0), 'zero-argument result');
$word = "unchanged";
check(rejected(fn() => join($word, ''), 'arg1 was rejected by Subtypes.checkedWord') && $word === 'unchanged', 'late heap rejection retains input');
`;

/**
 * Preserve every native PHP case, appending the independent specialization controls.
 *
 * @param t - Test context owning the temporary project and public caller.
 */
export const phpWasmSubtypeFixture = async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-subtype-fixture-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const root = join(directory, "project"), consumer = join(directory, "consumer.php");
	const originalRoot = "tests/fixtures/onboarding/native-subtype";
	await cp(originalRoot, root, { recursive: true });
	await saveLakeFile(root, "Subtypes.lean", await readFile(join(originalRoot, "Subtypes.lean"), "utf8") + reviewedSubtypeInstalledSource);
	const original = await readFile("tests/fixtures/subtype-consumers/php-native.php", "utf8");
	const marker = "$checks += 2000;\n";
	assert.equal(original.split(marker).length, 2);
	await saveLakeFile(directory, "consumer.php", original.replace(marker, supplemental + marker));
	return { root, consumer, module: "Subtypes", namespace: "LeanSubtypes"
		, operation: "half"
		, settings: { npm: { name: "lean-bridge-subtypes-wasm", version: "1.0.0" }
			, composer: { name: "lean-bridge-subtypes/wasm", version: "1.0.0" } }
		, contracts: phpWasmSubtypeContracts
		, specializations: phpWasmSubtypeSpecializations
		, exports: Object.keys(phpWasmSubtypeContracts)
		, refinements: phpWasmSubtypeRefinements, review: phpWasmSubtypeReview };
};
