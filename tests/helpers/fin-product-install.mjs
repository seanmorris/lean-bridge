/**
 * Fin-inside-product and Except cases for the shared installed-package harness (VO #1441).
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { installCopiedConsumer } from "./copied-fixture-install.mjs";
export { nativeFixtureEnvironment as finProductEnvironment } from "./copied-fixture-install.mjs";
// The WIT host header and its C prefix both derive from this hyphen-free name.
const coordinate = { name: "finproducts", version: "1.0.0" };
export const finProductTargets = Object.freeze({ c: ["c", coordinate]
	, cpp: ["cpp", coordinate]
	, python: ["pypi", coordinate]
	, rust: ["cargo", coordinate]
	, dotnet: ["nuget", { name: "FinProducts.Api", version: "1.0.0" }]
	, java: ["maven", { name: "org.leanbridge:finproducts", version: "1.0.0" }]
	, kotlin: ["maven", { name: "org.leanbridge:finproducts", version: "1.0.0" }]
	, ruby: ["rubygems", coordinate]
	, "php-native": ["php-native", { name: "example/finproducts", version: "1.0.0" }]
	, "wit-wasi": ["wit-wasi", coordinate]
	, perl: ["cpan", { module: "LeanBridge::FinProducts", version: "1.000" }] });

const fin = bound => ({ kind: "fin", bound });
const pair = (first, second) => ({ kind: "tuple", arguments: [first, second] });
// Except trees keep the IR order: [ok, error].
const branches = (ok, error) => ({ kind: "result", arguments: [ok, error] });
const wide = "184467440737095516170";
/** Checked refinement trees the native model must carry for every export. */
export const finProductRefinements = Object.freeze({
	"FinProducts.first": { parameters: [pair(fin("10"), null)], result: pair(fin("10"), null) }
	, "FinProducts.second": { parameters: [pair(null, fin("1"))], result: null }
	, "FinProducts.wide": { parameters: [pair(fin(wide), fin("10"))], result: null }
	, "FinProducts.never": { parameters: [{ kind: "option", arguments: [pair(fin("0"), null)] }], result: null }
	, "FinProducts.okOnly": { parameters: [branches(fin("10"), null)], result: null }
	, "FinProducts.errorOnly": { parameters: [branches(null, fin("5"))], result: null }
	, "FinProducts.both": { parameters: [branches(fin("7"), fin("3"))], result: null }
	, "FinProducts.nested": { parameters: [{ kind: "list", arguments: [{ kind: "option", arguments: [pair(fin("3"), branches(null, fin("2")))] }] }], result: null }
	, "FinProducts.aliased": { parameters: [pair(fin("10"), fin("10"))], result: pair(fin("10"), fin("10")) }
	, "FinProducts.produce": { parameters: [null], result: branches(null, fin("10")) }
	, "FinProducts.pairUp": { parameters: [null], result: pair(fin("10"), null) } });

/**
 * Install and exercise the product exports through public host APIs.
 *
 * @param options - Verified archive handoff and selected consumer profile.
 */
export const installFinProductConsumer = options => installCopiedConsumer({ ...options, fixture: {
	source: (profile, extension) => readFile(`tests/fixtures/fin-product-consumers/${profile}.${extension}`, "utf8")
	// Fin keeps Nat's limb-list transport in WIT; products and results keep their WIT shapes, and the alias pair keeps its name.
	, wit: [/type (bridge-value-\d+) = list<u32>;[^]*type (bridge-value-\d+) = tuple<\1, \1>;[^]*first: func\([^)]*: \2\) -> \2/
		, /type (bridge-value-\d+) = list<u32>;[^]*type (bridge-value-\d+) = result<\1, \1>;[^]*both: func\([^)]*: \2\) -> \1/
		, /type digit = (bridge-value-\d+);[^]*type (bridge-alias-value-\d+) = tuple<digit, digit>;[^]*type digit-pair = \2;[^]*aliased: func\([^)]*: digit-pair\) -> digit-pair/]
	, success: "fin-product-ok"
} });
