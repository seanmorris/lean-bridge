/**
 * Additive original VO #1427 edge cases. Existing fixture and consumer bytes stay unchanged.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { finContainerRefinements } from "./fin-container-install.mjs";
import { finContainerReviewedIr } from "./reviewed-fin-container-fixture.mjs";
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";

/** All original non-Perl native profiles. Perl's separate acceptance is not replaced. */
export const finContainerEdgeProfiles = Object.freeze(["c", "cpp", "python", "rust", "ruby", "dotnet", "java", "kotlin", "php-native", "wit-wasi"]);
const fin = bound => ({ kind: "fin", bound });
const inside = (kind, child) => ({ kind, arguments: [child] });
const roundTrip = type => ({ parameters: [structuredClone(type)], result: structuredClone(type) });
export const finContainerEdgeRefinements = Object.freeze({
	...finContainerRefinements
	, "FinContainers.emptyArray": roundTrip(inside("array", fin("0")))
	, "FinContainers.emptyList": roundTrip(inside("list", fin("0")))
	, "FinContainers.emptyOption": roundTrip(inside("option", fin("0")))
	, "FinContainers.optionalDigits": roundTrip(inside("option", inside("list", fin("10"))))
});

/** Append the new namespace block without rewriting the original eight exports. */
export const finContainerEdgeSource = async () => await readFile("tests/fixtures/onboarding/native-fin-containers/FinContainers.lean", "utf8")
	+ "\n" + await readFile("tests/fixtures/fin-container-edges.lean", "utf8");

/** Independent signatures for source/header checks; installed acceptance must reconcile them with Lean. */
export const finContainerEdgeReviewedIr = () => {
	const ir = finContainerReviewedIr();
	const signatures = [
		["emptyArray", { array: "nat" }]
		, ["emptyList", { list: "nat" }]
		, ["emptyOption", { option: "nat" }]
		, ["optionalDigits", { option: { list: "nat" } }]
	];
	const extra = corpusReviewedIr({ id: "fincontainers" }, signatures.map(([name, type]) => ({ name: `FinContainers.${name}`, parameters: [type], result: type })));
	assert.equal(extra.types.length, 0);
	for(const entry of extra.declarations)
	{
		entry.parameters[0].name = "arg0";
		entry.source.extensions["lean-lang.org/refinements"] = structuredClone(finContainerEdgeRefinements[entry.source.declaration]);
	}
	ir.declarations.push(...extra.declarations);
	ir.declarations.sort((left, right) => left.id.localeCompare(right.id));
	return ir;
};

/**
 * Insert at exactly one complete marker. Duplicate or missing markers are fixture drift.
 *
 * @param source - Original source text.
 * @param marker - Complete line at the insertion point.
 * @param fragment - Additional consumer statements.
 */
export const insertFinContainerEdgeFragment = (source, marker, fragment) => {
	assert.ok(typeof marker === "string" && marker.length > 0, "Expected a nonempty insertion marker");
	const at = source.indexOf(marker);
	assert.ok(at >= 0 && source.indexOf(marker, at + marker.length) < 0, "Expected exactly one edge consumer insertion marker");
	assert.ok((at === 0 || source[at - 1] === "\n") && (at + marker.length === source.length || source[at + marker.length] === "\n"), "Insertion marker must occupy a complete line");
	assert.ok(!fragment.includes(marker), "Edge fragment must not duplicate the insertion marker");
	return source.slice(0, at) + fragment + "\n" + source.slice(at);
};

const consumers = Object.freeze({
	c: { extension: "c", marker: '  printf("fin-container-ok:%u\\n", checks);' }
	, cpp: { extension: "cpp", marker: '  std::printf("fin-container-ok:%u\\n", checks);' }
	, python: { extension: "py", marker: "print('fin-container-ok:' + str(checks))" }
	, rust: { extension: "rs", marker: '    println!("fin-container-ok:{checks}");' }
	, ruby: { extension: "rb", marker: 'puts "fin-container-ok:#{$checks}"' }
	, dotnet: { extension: "cs", marker: '        Console.WriteLine($"fin-container-ok:{checks}");' }
	, java: { extension: "java", marker: '        System.out.println("fin-container-ok:" + checks);' }
	, kotlin: { extension: "kt", marker: '    println("fin-container-ok:$checks")' }
});
/** Source development is staged; this list is not a support or installed-acceptance claim. */
export const implementedFinContainerEdgeProfiles = Object.freeze(Object.keys(consumers));

/**
 * Compose the original public consumer and the additive host-specific assertions.
 *
 * @param profile - Native host profile with an implemented fragment.
 */
export const finContainerEdgeConsumer = async profile => {
	assert.ok(Object.hasOwn(consumers, profile), `Fin container edge consumer is not implemented: ${profile}`);
	const { extension, marker } = consumers[profile];
	const original = await readFile(`tests/fixtures/fin-container-consumers/${profile}.${extension}`, "utf8");
	const fragment = await readFile(`tests/fixtures/fin-container-edge-consumers/${profile}.${extension}`, "utf8");
	return insertFinContainerEdgeFragment(original, marker, fragment);
};
