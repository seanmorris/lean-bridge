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

/**
 * Return exact public WIT signatures for one authoring route.
 *
 * @param route - Ordinary or independently reviewed authoring route.
 */
export const optionalParameterWitPatterns = route => {
	if(!["ordinary", "reviewed"].includes(route))
		throw new TypeError("unknown optional-parameter authoring route");
	const argument = route === "ordinary" ? "arg0" : "value0";
	return Object.freeze(witDeclarations.flatMap(([name, input, output]) => [
		new RegExp(`${name}: func\\(${argument}: ${input}\\) -> ${output};`, "u")
		, new RegExp(`${name}-default: func\\(\\) -> ${output};`, "u")
	]));
};

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
