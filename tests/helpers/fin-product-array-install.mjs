/**
 * Fin inside arrays of products for the shared installed-package harness (VO #1441).
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { installCopiedConsumer } from "./copied-fixture-install.mjs";
// The WIT host header and its C prefix both derive from this hyphen-free name.
const coordinate = { name: "finproductarrays", version: "1.0.0" };
export const finProductArrayTargets = Object.freeze({ c: ["c", coordinate]
	, cpp: ["cpp", coordinate]
	, python: ["pypi", coordinate]
	, rust: ["cargo", coordinate]
	, dotnet: ["nuget", { name: "FinProductArrays.Api", version: "1.0.0" }]
	, java: ["maven", { name: "org.leanbridge:finproductarrays", version: "1.0.0" }]
	, kotlin: ["maven", { name: "org.leanbridge:finproductarrays", version: "1.0.0" }]
	, ruby: ["rubygems", coordinate]
	, "php-native": ["php-native", { name: "example/finproductarrays", version: "1.0.0" }]
	, "wit-wasi": ["wit-wasi", coordinate]
	, perl: ["cpan", { module: "LeanBridge::FinProductArrays", version: "1.000" }] });

const fin = bound => ({ kind: "fin", bound });
/** Array (Fin 4 × Except (Fin 6) Nat): Except trees keep the IR order [ok, error]. */
export const finProductArrayTree = Object.freeze({ kind: "array", arguments: [{ kind: "tuple", arguments: [fin("4"), { kind: "result", arguments: [null, fin("6")] }] }] });
/** Checked refinement trees the native model must carry for every export. */
export const finProductArrayRefinements = Object.freeze({
	"FinProductArrays.reversed": { parameters: [finProductArrayTree], result: finProductArrayTree }
	, "FinProductArrays.rows": { parameters: [finProductArrayTree], result: null } });

/** WIT keeps Nat's limb list inside the result, the tuple and the list of tuples. */
export const finProductArrayWitPatterns = Object.freeze([/type (bridge-value-\d+) = list<u32>;[^]*type (bridge-value-\d+) = result<\1, \1>;[^]*type (bridge-value-\d+) = tuple<\1, \2>;[^]*type (bridge-value-\d+) = list<\3>;[^]*reversed: func\([^)]*: \4\) -> \4;[^]*rows: func\([^)]*: \4\) -> \1/]);

/**
 * Install and exercise the array exports through public host APIs.
 *
 * @param options - Verified archive handoff and selected consumer profile.
 */
export const installFinProductArrayConsumer = options => installCopiedConsumer({ ...options, fixture: {
	source: (profile, extension) => readFile(`tests/fixtures/fin-product-array-consumers/${profile}.${extension}`, "utf8")
	, wit: finProductArrayWitPatterns
	, success: "fin-product-array-ok"
} });
