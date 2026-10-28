/**
 * Direct dependent Fin (`(bound : Nat) → Fin bound → …`) for the managed and
 * language-host packages: .NET, Java, Kotlin, Python, Ruby, Rust and WIT/WASI.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { installCopiedConsumer } from "./copied-fixture-install.mjs";
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";
export { nativeFixtureEnvironment as dependentFinEnvironment } from "./copied-fixture-install.mjs";

export const dependentFinFixture = "tests/fixtures/onboarding/native-dependent-fin";
// The WIT host header and its C prefix both derive from this hyphen-free name.
const coordinate = { name: "dependentfin", version: "1.0.0" };
export const dependentFinTargets = Object.freeze({ python: ["pypi", coordinate]
	, rust: ["cargo", coordinate]
	, dotnet: ["nuget", { name: "DependentFin.Api", version: "1.0.0" }]
	, java: ["maven", { name: "org.leanbridge:dependentfin", version: "1.0.0" }]
	, kotlin: ["maven", { name: "org.leanbridge:dependentfin", version: "1.0.0" }]
	, ruby: ["rubygems", coordinate]
	, "wit-wasi": ["wit-wasi", coordinate] });
export const dependentFinExtensions = Object.freeze({
	python: "py", rust: "rs", dotnet: "cs", java: "java"
	, kotlin: "kt", ruby: "rb", "wit-wasi": "c" });

const dependent = parameter => ({ kind: "fin-parameter", parameter });
/** Checked refinement trees the native model must carry: a live parameter index, never a bound. */
export const dependentFinRefinements = Object.freeze({
	"DependentFin.mirror": { parameters: [null, dependent(0)], result: null }
	, "DependentFin.label": { parameters: [null, null, dependent(1), null], result: null } });

/** Describe the two dependent declarations independently of Lean extraction. */
export const dependentFinReviewedIr = () => {
	const signatures = [
		["mirror", ["nat", "nat"], "nat"]
		, ["label", ["nat", "nat", "nat", "string"], "string"]];
	const ir = corpusReviewedIr({ id: "dependentfin" }, signatures.map(([name, parameters, result]) => ({ name: `DependentFin.${name}`, parameters, result })));
	for(const declaration of ir.declarations)
	{
		// Keep the public argument labels shared with the ordinary-source consumers.
		// A review can rename parameters, and those names appear in host diagnostics.
		declaration.parameters.forEach((parameter, position) => { parameter.name = `arg${position}`; });
		declaration.source.extensions["lean-lang.org/refinements"] = structuredClone(dependentFinRefinements[declaration.id.slice("lean:".length)]);
	}
	return ir;
};

/**
 * Install and exercise the dependent exports through public host APIs.
 *
 * @param options - Verified archive handoff and selected consumer profile.
 */
export const installDependentFinConsumer = options => installCopiedConsumer({ ...options, fixture: {
	source: (profile, extension) => readFile(`tests/fixtures/dependent-fin-consumers/${profile}.${extension}`, "utf8")
	// A dependent Fin keeps Nat's limb-list transport in WIT; the bound is a live argument, not WIT text.
	, wit: [/type (bridge-value-\d+) = list<u32>;[^]*mirror: func\([^)]*\) -> \1/]
	, success: "dependent-fin-ok"
} });
