/**
 * Exact, side-effect-free checker contracts shared by optional-parameter
 * installed-package acceptance.
 *
 * @file
 */

const witDeclarations = Object.freeze([
	["character", "char", "char"]
	, ["maybe", "bridge-value-[0-9]+", "bridge-value-[0-9]+"]
	, ["natural", "bridge-value-[0-9]+", "bridge-value-[0-9]+"]
	, ["present", "bridge-value-[0-9]+", "bridge-value-[0-9]+"]
	, ["text", "string", "string"]
	, ["unit-value", "bridge-value-[0-9]+", "bridge-value-[0-9]+"]
	, ["word", "u32", "u32"]
]);
const managedPatterns = Object.freeze({
	dotnet: /(?:CS1503|cannot convert from '<null>'|non-nullable value type)/iu
	, java: /(?:incompatible types|cannot be converted to (?:long|int))/iu
	, kotlin: /(?:null can(?:not| not) be a value of a non-null type|type mismatch)/iu
});
const routeBinder = route => {
	if(!["ordinary", "reviewed"].includes(route))
		throw new TypeError("unknown optional-parameter authoring route");
	return route === "ordinary" ? "arg0" : "value0";
};

/**
 * Return exact public WIT signatures for one authoring route.
 *
 * @param route - Ordinary or independently reviewed authoring route.
 */
export const optionalParameterWitPatterns = route => {
	const argument = routeBinder(route);
	return Object.freeze(witDeclarations.flatMap(([name, input, output]) => [
		new RegExp(`${name}: func\\(${argument}: ${input}\\) -> ${output};`, "u")
		, new RegExp(`${name}-default: func\\(\\) -> ${output};`, "u")
	]));
};

/**
 * Return exact public PHP signatures for one authoring route.
 *
 * @param route - Ordinary or independently reviewed authoring route.
 */
export const optionalParameterPhpPatterns = route => {
	const argument = routeBinder(route);
	return Object.freeze([
		new RegExp(`function word\\(mixed \\$${argument} = 7\\): int`, "u")
		, new RegExp(`function natural\\(mixed \\$${argument} = null\\)`, "u")
		, new RegExp(`function present\\(mixed \\$${argument} = null\\)`, "u")
		, new RegExp(`\\$${argument} = new Some\\(9\\)`, "u")
		, new RegExp(
			`function unit_value\\(mixed \\$${argument} = null\\): null`, "u")
	]);
};

/**
 * Return exact public PHP signatures for one authoring route and runtime.
 *
 * @param route - Ordinary or independently reviewed authoring route.
 * @param profile - Native PHP or PHP-Wasm package profile.
 */
export const optionalParameterPhpProfilePatterns = (route, profile) => {
	const argument = routeBinder(route);
	if(!["php-native", "php-wasm"].includes(profile))
		throw new TypeError("unknown optional-parameter PHP profile");
	if(profile === "php-native") return optionalParameterPhpPatterns(route);
	return Object.freeze([
		new RegExp(
			`function word\\(mixed \\$${argument} = null\\): \\\\Brick\\\\Math\\\\BigInteger`, "u")
		, /Brick\\Math\\BigInteger::of\('7'\)/u
		, new RegExp(`function natural\\(mixed \\$${argument} = null\\)`, "u")
		, new RegExp(`function present\\(mixed \\$${argument} = null\\)`, "u")
		, new RegExp(
			`\\$${argument} = new Some\\(\\\\Brick\\\\Math\\\\BigInteger::of\\('9'\\)\\)`, "u")
		, new RegExp(
			`function unit_value\\(mixed \\$${argument} = null\\): null`, "u")
	]);
};

/**
 * Return exact TypeScript declarations for one authoring route.
 *
 * @param route - Ordinary or independently reviewed authoring route.
 */
export const optionalParameterTypescriptPatterns = route => {
	const argument = routeBinder(route);
	return Object.freeze([
		new RegExp(`word\\(${argument}\\?: number\\): number;`, "u")
		, new RegExp(`natural\\(${argument}\\?: bigint\\): bigint;`, "u")
		, new RegExp(`present\\(${argument}\\?: Readonly<`, "u")
		, new RegExp(`unitValue\\(${argument}\\?: void\\): void;`, "u")
	]);
};

/**
 * Return exact Python signatures for one authoring route.
 *
 * @param route - Ordinary or independently reviewed authoring route.
 */
export const optionalParameterPythonPatterns = route => {
	const argument = routeBinder(route);
	return Object.freeze([
		new RegExp(`def word\\(${argument}: int = 7\\) -> int:`, "u")
		, new RegExp(
			`def present\\(${argument}: Option\\[int\\] = Some\\(9\\)\\)`, "u")
	]);
};

/**
 * Return exact Ruby signatures for one authoring route.
 *
 * @param route - Ordinary or independently reviewed authoring route.
 */
export const optionalParameterRubyPatterns = route => {
	// Ruby exposes positional arguments under stable generated names.  The
	// reviewed route retains its source binder in the IR, but the generated gem
	// deliberately normalizes both routes to arg0.
	routeBinder(route);
	const argument = "arg0";
	return Object.freeze([
		new RegExp(`def word\\(${argument} = 7\\)`, "u")
		, new RegExp(`def present\\(${argument} = Some\\.new\\(9\\)\\)`, "u")
		, new RegExp(`def unit_value\\(${argument} = UNIT\\)`, "u")
	]);
};

/**
 * Return the exact C++ optional signature for one authoring route.
 *
 * @param route - Ordinary or independently reviewed authoring route.
 */
export const optionalParameterCppPattern = route => new RegExp(
	`inline std::optional<uint32_t> present\\(std::optional<uint32_t> const& ${routeBinder(route)} =`
	, "u"
);

/**
 * Preserve compiler diagnostics regardless of which captured stream a tool
 * uses. In particular, dotnet build writes C# diagnostics to stdout.
 *
 * @param error - Rejected checked-process error.
 */
export const managedCompilationDiagnostic = error => {
	const streams = [error?.details?.stdout, error?.details?.stderr]
		.filter(value => typeof value === "string" && value.length > 0);
	return streams.join("\n") || String(error?.message ?? error);
};

/**
 * Return the accepted compiler diagnostic language for one managed profile.
 *
 * @param profile - Managed consumer profile.
 */
export const managedDiagnosticPattern = profile => {
	if(!Object.hasOwn(managedPatterns, profile))
		throw new TypeError("unknown managed consumer profile");
	return managedPatterns[profile];
};

/**
 * Count independently rejected host-null calls in compiler output.
 *
 * @param profile - Managed consumer profile.
 * @param diagnostic - Complete captured compiler output.
 */
export const managedDiagnosticCount = (profile, diagnostic) => {
	if(profile === "dotnet") return (diagnostic.match(/CS1503/gu) ?? []).length;
	if(profile === "java")
		return (diagnostic.match(/incompatible types/gu) ?? []).length;
	if(profile === "kotlin") return (diagnostic.match(
		/(?:null can(?:not| not) be a value of a non-null type|type mismatch)/giu
	) ?? []).length;
	throw new TypeError("unknown managed consumer profile");
};
