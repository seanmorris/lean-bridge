/**
 * Author-constructed Subtype cases for the shared installed-package harness.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { installCopiedConsumer } from "./copied-fixture-install.mjs";
export { nativeFixtureEnvironment as nativeSubtypeEnvironment } from "./copied-fixture-install.mjs";
// The WIT host header and its C prefix both derive from this hyphen-free name.
const coordinate = { name: "subtypes", version: "1.0.0" };
export const nativeSubtypeTargets = Object.freeze({ c: ["c", coordinate]
	, cpp: ["cpp", coordinate]
	, python: ["pypi", coordinate]
	, rust: ["cargo", coordinate]
	, dotnet: ["nuget", { name: "Subtypes.Api", version: "1.0.0" }]
	, java: ["maven", { name: "org.leanbridge:subtypes", version: "1.0.0" }]
	, kotlin: ["maven", { name: "org.leanbridge:subtypes", version: "1.0.0" }]
	, ruby: ["rubygems", coordinate]
	, "php-native": ["php-native", { name: "example/subtypes", version: "1.0.0" }]
	, "wit-wasi": ["wit-wasi", coordinate] });

const site = constructor => ({ ownership: "copy", lifetime: null, refinement: { constructor } });
const plain = { ownership: "copy", lifetime: null, refinement: "reject" };
/** Export contracts naming the checked constructor at every refined site. */
export const nativeSubtypeContracts = Object.freeze({
	"Subtypes.shout": { parameters: [site("Subtypes.checkedWord")], result: site("Subtypes.checkedWord") }
	, "Subtypes.half": { parameters: [site("Subtypes.checkedEven")], result: plain }
	, "Subtypes.scale": { parameters: [plain, site("Subtypes.checkedSmall")], result: plain }
	, "Subtypes.head": { parameters: [site("Subtypes.checkedPayload")], result: plain }
	, "Subtypes.pad": { parameters: [plain], result: site("Subtypes.checkedEven") }
	, "Subtypes.join": { parameters: [site("Subtypes.checkedWord"), site("Subtypes.checkedWord")], result: site("Subtypes.checkedWord") }
	, "Subtypes.clamp": { parameters: [site("Subtypes.checkedBounded")], result: plain }
	// A site without a refinement key accepts the compiler-checked Fin bound.
	, "Subtypes.mix": { parameters: [site("Subtypes.checkedEven"), { ownership: "copy", lifetime: null }], result: plain } });

const checked = constructor => ({ kind: "subtype", constructor });
/** Refinement trees the native model must carry for every export. */
/**
 * The refinement a contract site implies: a checked constructor, the fixture's Fin 10
 * digit when no refinement key is present, or nothing for a "reject" site.
 *
 * @param site - Export contract site.
 */
const refinementOf = site => typeof site.refinement === "object" ? checked(site.refinement.constructor) : site.refinement === undefined ? { kind: "fin", bound: "10" } : null;
export const nativeSubtypeRefinements = Object.freeze(Object.fromEntries(Object.entries(nativeSubtypeContracts)
	.map(([name, contract]) => [name, { parameters: contract.parameters.map(refinementOf), result: refinementOf(contract.result) }])));

/**
 * Install and exercise the checked exports through public host APIs.
 *
 * @param options - Verified archive handoff and selected consumer profile.
 */
export const installNativeSubtypeConsumer = options => installCopiedConsumer({ ...options, fixture: {
	source: (profile, extension) => readFile(`tests/fixtures/subtype-consumers/${profile}.${extension}`, "utf8")
	// Subtype keeps its base's WIT type; the constructor lives in the README, not the WIT text.
	, wit: [/shout: func\([^)]*: string\) -> string/, /half: func\([^)]*: (bridge-value-\d+)\) -> \1/]
	, success: "subtype-ok"
} });
