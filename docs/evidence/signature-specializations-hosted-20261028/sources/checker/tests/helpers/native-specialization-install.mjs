/**
 * Finite generic specialization cases for the shared installed-package harness.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { installCopiedConsumer } from "./copied-fixture-install.mjs";
export { nativeFixtureEnvironment as nativeSpecializationEnvironment } from "./copied-fixture-install.mjs";
// The WIT host header and its C prefix both derive from this hyphen-free name.
const coordinate = { name: "specialized", version: "1.0.0" };
export const nativeSpecializationTargets = Object.freeze({ c: ["c", coordinate]
	, cpp: ["cpp", coordinate]
	, python: ["pypi", coordinate]
	, rust: ["cargo", coordinate]
	, dotnet: ["nuget", { name: "Specialized.Api", version: "1.0.0" }]
	, java: ["maven", { name: "org.leanbridge:specialized", version: "1.0.0" }]
	, kotlin: ["maven", { name: "org.leanbridge:specialized", version: "1.0.0" }]
	, ruby: ["rubygems", coordinate]
	, perl: ["cpan", { module: "LeanBridge::Specialized", version: "1.000" }]
	, "php-native": ["php-native", { name: "example/specialized", version: "1.0.0" }]
	, "wit-wasi": ["wit-wasi", coordinate] });

/** Concrete exports: new name, generic source declaration and closed type arguments. */
export const nativeSpecializations = Object.freeze([
	{ name: "Specialized.echoWord", declaration: "Specialized.echo", types: ["Specialized.Word"] }
	, { name: "Specialized.echoText", declaration: "Specialized.echo", types: ["String"] }
	, { name: "Specialized.echoNat", declaration: "Specialized.echo", types: ["Nat"] }
	, { name: "Specialized.echoWords", declaration: "Specialized.echo", types: ["Specialized.Words"] }
	, { name: "Specialized.chooseWord", declaration: "Specialized.choose", types: ["UInt32"] }
	, { name: "Specialized.chooseText", declaration: "Specialized.choose", types: ["String"] }
	, { name: "Specialized.chooseWords", declaration: "Specialized.choose", types: ["Specialized.Words"] }
	, { name: "Specialized.firstTextWord", declaration: "Specialized.first", types: ["String", "UInt32"] }
	, { name: "Specialized.doubleWord", declaration: "Specialized.duplicate", types: ["UInt32"] }
	, { name: "Specialized.doubleNat", declaration: "Specialized.duplicate", types: ["Nat"] }]);

/** Compiled signatures after Lean resolved every type and instance argument; arrays name their element. */
export const nativeSpecializationSignatures = Object.freeze({
	"Specialized.echoWord": [["uint32"], "uint32"]
	, "Specialized.echoText": [["string"], "string"]
	, "Specialized.echoNat": [["nat"], "nat"]
	, "Specialized.echoWords": [[{ array: "uint32" }], { array: "uint32" }]
	, "Specialized.chooseWord": [["bool", "uint32"], "uint32"]
	, "Specialized.chooseText": [["bool", "string"], "string"]
	, "Specialized.chooseWords": [["bool", { array: "uint32" }], { array: "uint32" }]
	, "Specialized.firstTextWord": [["string", "uint32"], "string"]
	, "Specialized.doubleWord": [["uint32"], "uint32"]
	, "Specialized.doubleNat": [["nat"], "nat"]
	, "Specialized.plain": [["uint32"], "uint32"] });

/**
 * Install and exercise the concrete exports through public host APIs.
 *
 * @param options - Verified archive handoff and selected consumer profile.
 */
export const installSpecializationConsumer = options => installCopiedConsumer({ ...options, fixture: {
	source: (profile, extension) => readFile(`tests/fixtures/specialization-consumers/${profile}.${extension}`, "utf8")
	// The alias type argument keeps its WIT name; Nat keeps the shared limb-list type.
	, wit: [/type word = u32;/, /echo-word: func\([^)]*: word\) -> word/
		, /type (bridge-value-\d+) = list<u32>;[^]*echo-nat: func\([^)]*: \1\) -> \1/
		, /choose-text: func\([^)]*: bool, [^)]*: string\) -> string/
		, /first-text-word: func\([^)]*: string, [^)]*: u32\) -> string/]
	, success: "specialization-ok"
} });
