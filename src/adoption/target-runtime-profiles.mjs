import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const expectedProfiles = Object.freeze(["dotnet", "jvm", "ruby"]);
const expectedAcceptance = Object.freeze([
	"deterministic-generation"
	, "public-surface"
	, "host-compilation"
	, "deterministic-package"
	, "clean-install"
	, "real-lean-execution"
	, "semantic-parity"
	, "deterministic-lifecycle"
	, "shared-runtime"
	, "compile-once"
	, "provenance"
	, "end-user-performance"
]);
const expectedProfileFacts = Object.freeze({
	dotnet: Object.freeze({
		language: "C#"
		, runtime: ".NET"
		, minimumRuntimeVersion: "8.0"
		, interop: "library-import"
		, ecosystem: "nuget"
		, coordinate: "LeanBridge.Alpha"
		, requiredPrivate: "System.Runtime.InteropServices.LibraryImport"
		, requiredForbidden: "public IntPtr"
	})
	, jvm: Object.freeze({
		language: "Java"
		, runtime: "JDK"
		, minimumRuntimeVersion: "22"
		, interop: "foreign-function-and-memory"
		, ecosystem: "maven"
		, coordinate: "org.leanbridge:lean-alpha"
		, requiredPrivate: "java.lang.foreign.Linker"
		, requiredForbidden: "JNI"
	})
	, ruby: Object.freeze({
		language: "Ruby"
		, runtime: "MRI Ruby"
		, minimumRuntimeVersion: "3.3"
		, interop: "fiddle"
		, ecosystem: "rubygems"
		, coordinate: "lean_bridge_alpha"
		, requiredPrivate: "Fiddle::Function"
		, requiredForbidden: "native extension build"
	})
});

const exactKeys = (value, keys, label) => {
	if(value === null || typeof value !== "object" || Array.isArray(value))
	{
		throw new TargetRuntimeProfileError("invalid-target-runtime-profiles", `${label} must be an object`);
	}
	const actual = Object.keys(value).sort();
	const expected = [...keys].sort();
	if(JSON.stringify(actual) !== JSON.stringify(expected))
	{
		throw new TargetRuntimeProfileError("invalid-target-runtime-profiles", `${label} fields must be closed`, { actual, expected });
	}
};

const nonempty = (value, label) => {
	if(typeof value !== "string" || value === "")
	{
		throw new TargetRuntimeProfileError("invalid-target-runtime-profiles", `${label} must be a nonempty string`);
	}
};

const uniqueStrings = (value, label) => {
	if(!Array.isArray(value) || value.length === 0 || value.some(item => typeof item !== "string" || item === ""))
	{
		throw new TargetRuntimeProfileError("invalid-target-runtime-profiles", `${label} must contain strings`);
	}
	if(new Set(value).size !== value.length)
	{
		throw new TargetRuntimeProfileError("invalid-target-runtime-profiles", `${label} must be unique`);
	}
};

/**
 * Reports target runtime profile failures with stable machine-readable codes and structured diagnostic context.
 */
export class TargetRuntimeProfileError extends Error
{
	/**
   * Initializes the error used to report target runtime profile failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "TargetRuntimeProfileError";
		this.code = code;
		this.details = details;
	}
}

const fail = (code, message, details = {}) => {
	throw new TargetRuntimeProfileError(code, message, details);
};

/**
 * Validates target runtime profiles against its closed contract before it enters the documented consumer acceptance workflow.
 *
 * @param document - Candidate document validated against this module’s closed schema and invariants.
 */
export const validateTargetRuntimeProfiles = document => {
	exactKeys(document, [
		"schemaVersion", "contractVersion", "verifiedAt", "bindingIrSchemaVersion"
		, "platform", "boundary", "acceptance", "profiles"
	], "target runtime contract");
	if(document.schemaVersion !== 1 || document.bindingIrSchemaVersion !== 3)
	{
		fail("invalid-target-runtime-profiles", "target runtime and Binding IR schema versions must be 1 and 3");
	}
	if(!/^\d+\.\d+\.\d+$/.test(document.contractVersion) || !/^\d{4}-\d{2}-\d{2}$/.test(document.verifiedAt))
	{
		fail("invalid-target-runtime-profiles", "contract version and verification date are invalid");
	}

	exactKeys(document.platform, ["id", "operatingSystem", "architecture", "libc", "minimumLibcVersion"], "platform");
	const expectedPlatform = {
		id: "linux-x64-gnu.2.38"
		, operatingSystem: "linux"
		, architecture: "x86-64"
		, libc: "glibc"
		, minimumLibcVersion: "2.38"
	};
	if(JSON.stringify(document.platform) !== JSON.stringify(expectedPlatform))
	{
		fail("unsupported-target-platform", "version 1 supports only the canonical Linux x64 glibc profile");
	}

	exactKeys(document.boundary, [
		"transport", "runtimeScope", "sharedRuntime", "compileOnce", "runtimeLibrary"
		, "componentLibrary", "header", "failureProtocol", "callbackThread"
	], "native boundary");
	const expectedBoundary = {
		transport: "generated-c"
		, runtimeScope: "process"
		, sharedRuntime: true
		, compileOnce: true
		, runtimeLibrary: "liblean_bridge_native.so"
		, componentLibrary: "liblean_alpha_component.so"
		, header: "lean_alpha.h"
		, failureProtocol: "status-and-error-envelope"
		, callbackThread: "initiating-runtime-thread"
	};
	if(JSON.stringify(document.boundary) !== JSON.stringify(expectedBoundary))
	{
		fail("target-boundary-drift", "managed targets must reuse the canonical generated C boundary and process runtime");
	}

	if(!Array.isArray(document.acceptance)) fail("invalid-target-runtime-profiles", "acceptance must be an array");
	for(const item of document.acceptance)
	{
		exactKeys(item, ["id", "requirement", "evidence"], `acceptance ${item?.id ?? "unknown"}`);
		nonempty(item.id, "acceptance id");
		nonempty(item.requirement, `${item.id} requirement`);
		nonempty(item.evidence, `${item.id} evidence`);
	}
	const acceptanceIds = document.acceptance.map(item => item.id);
	if(JSON.stringify(acceptanceIds) !== JSON.stringify(expectedAcceptance))
	{
		fail("target-acceptance-drift", "acceptance order and coverage must match the version 1 contract", { actual: acceptanceIds, expected: expectedAcceptance });
	}

	if(!Array.isArray(document.profiles)) fail("invalid-target-runtime-profiles", "profiles must be an array");
	if(JSON.stringify(document.profiles.map(item => item.id)) !== JSON.stringify(expectedProfiles))
	{
		fail("target-profile-coverage", "profile order and coverage must be dotnet, jvm, and ruby");
	}
	let commonFeatures;
	for(const profile of document.profiles)
	{
		exactKeys(profile, [
			"id", "language", "runtime", "minimumRuntimeVersion", "interop", "package"
			, "publicConventions"
			, "privateMechanisms"
			, "forbiddenMechanisms"
			, "supportedFeatures"
			, "capabilityGaps", "lifecycle"
		], `profile ${profile?.id ?? "unknown"}`);
		const facts = expectedProfileFacts[profile.id];
		if(!facts || ["language", "runtime", "minimumRuntimeVersion", "interop"].some(key => profile[key] !== facts[key]))
		{
			fail("target-profile-drift", `${profile.id} runtime or interop selection differs from the accepted profile`);
		}
		exactKeys(profile.package, ["ecosystem", "coordinate", "nativeLayout", "scriptsDisabled"], `${profile.id} package`);
		if(profile.package.ecosystem !== facts.ecosystem || profile.package.coordinate !== facts.coordinate
      || profile.package.scriptsDisabled !== true) {
			fail("target-package-drift", `${profile.id} package identity or script policy differs from the accepted profile`);
      }
		nonempty(profile.package.nativeLayout, `${profile.id} native layout`);
		for(const [field, value] of [
			["public conventions", profile.publicConventions]
			, ["private mechanisms", profile.privateMechanisms]
			, ["forbidden mechanisms", profile.forbiddenMechanisms]
			, ["supported features", profile.supportedFeatures]
		]) uniqueStrings(value, `${profile.id} ${field}`);
		if(!profile.privateMechanisms.includes(facts.requiredPrivate) || !profile.forbiddenMechanisms.includes(facts.requiredForbidden))
		{
			fail("target-interop-drift", `${profile.id} does not enforce its accepted private interop boundary`);
		}
		if(commonFeatures === undefined) commonFeatures = profile.supportedFeatures;
		else if(JSON.stringify(profile.supportedFeatures) !== JSON.stringify(commonFeatures))
		{
			fail("target-semantic-drift", `${profile.id} does not declare the common supported semantic subset`);
		}
		if(!Array.isArray(profile.capabilityGaps) || profile.capabilityGaps.length === 0)
		{
			fail("target-capability-gaps-missing", `${profile.id} must report unsupported capabilities`);
		}
		const gaps = new Set();
		for(const gap of profile.capabilityGaps)
		{
			exactKeys(gap, ["feature", "reason"], `${profile.id} capability gap`);
			nonempty(gap.feature, `${profile.id} gap feature`);
			nonempty(gap.reason, `${profile.id} gap reason`);
			if(gaps.has(gap.feature) || profile.supportedFeatures.includes(gap.feature))
			{
				fail("target-capability-conflict", `${profile.id} capability ${gap.feature} is duplicated or both supported and blocked`);
			}
			gaps.add(gap.feature);
		}
		nonempty(profile.lifecycle, `${profile.id} lifecycle`);
	}
	return true;
};

/**
 * Loads target runtime profiles, verifies its structure and identity, and returns it to the documented consumer acceptance workflow.
 *
 * @param path - Logical or filesystem path used to locate the input and anchor precise validation diagnostics.
 */
export const readTargetRuntimeProfiles = async (path = "docs/target-runtime-profiles.v1.json") => {
	const document = JSON.parse(await readFile(resolve(path), "utf8"));
	validateTargetRuntimeProfiles(document);
	return document;
};

export const targetRuntimeProfileIds = expectedProfiles;
export const targetRuntimeAcceptanceIds = expectedAcceptance;
