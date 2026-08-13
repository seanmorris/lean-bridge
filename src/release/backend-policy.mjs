const allowedOperations = new Set([
	"select"
	, "arrange"
	, "copy"
	, "rename"
	, "render-registry-metadata"
	, "archive"
	, "compress"
	, "sign"
	, "attest"
]);

const forbiddenExecutables = new Set([
	"lean"
	, "lake"
	, "leanc"
	, "cc"
	, "c++"
	, "gcc"
	, "g++"
	, "clang"
	, "clang++"
	, "emcc"
	, "em++"
	, "rustc"
	, "cargo"
	, "cmake"
	, "make"
	, "ninja"
	, "ld"
	, "lld"
	, "wasm-ld"
]);

const exactKeys = (value, keys, label) => {
	if(value === null || typeof value !== "object" || Array.isArray(value))
	{
		fail("invalid-backend-plan", `${label} must be an object`);
	}
	const actual = Object.keys(value).sort();
	const expected = [...keys].sort();
	if(JSON.stringify(actual) !== JSON.stringify(expected))
	{
		fail("invalid-backend-plan", `${label} fields must be closed`, { expected, actual });
	}
};

const fail = (code, message, details = {}) => {
	const error = new Error(message);
	error.name = "PackagingBackendPolicyError";
	error.code = code;
	error.details = details;
	throw error;
};

const requireIdentity = (value, field) => {
	if(typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value))
	{
		fail("invalid-backend-plan", `${field} must be a SHA-256 identity`, { field, value });
	}
};

const executableName = command => command.split(/[\\/]/).at(-1);

export const packagingBackendPolicy = Object.freeze({
	schemaVersion: 1
	, allowedOperations: Object.freeze([...allowedOperations])
	, forbiddenExecutables: Object.freeze([...forbiddenExecutables])
	, compilerAccess: false
	, scriptPolicy: "disabled"
	, versionSource: "canonical-manifest"
	, semanticSource: "canonical-manifest"
});

/**
 * Validates packaging backend plan against its closed contract before it enters the deterministic release and independent-verification pipeline.
 *
 * @param plan - Validated plan that defines the allowed operation and targets.
 */
export const validatePackagingBackendPlan = plan => {
	exactKeys(plan, [
		"schemaVersion"
		, "backend"
		, "ecosystem"
		, "bundle"
		, "compilerAccess"
		, "scriptPolicy"
		, "versionSource"
		, "semanticSource"
		, "operations"
		, "commands"
		, "coreArtifacts"
	], "packaging backend plan");
	if(plan.schemaVersion !== 1) fail("unsupported-backend-plan", "packaging backend plan version is not supported");
	for(const field of ["backend", "ecosystem"])
	{
		if(typeof plan[field] !== "string" || plan[field] === "")
		{
			fail("invalid-backend-plan", `${field} must be a non-empty string`);
		}
	}
	exactKeys(plan.bundle, ["id", "manifestSha256"], "bundle identity");
	if(typeof plan.bundle.id !== "string" || plan.bundle.id === "")
	{
		fail("invalid-backend-plan", "bundle id must be a non-empty string");
	}
	requireIdentity(plan.bundle.manifestSha256, "bundle.manifestSha256");
	if(plan.compilerAccess !== false)
	{
		fail("backend-compiler-access", "packaging backends cannot receive compiler access");
	}
	if(plan.scriptPolicy !== "disabled")
	{
		fail("backend-script-policy", "package lifecycle scripts must remain disabled during projection");
	}
	if(plan.versionSource !== "canonical-manifest")
	{
		fail("backend-version-authority", "package version must come from the canonical manifest");
	}
	if(plan.semanticSource !== "canonical-manifest")
	{
		fail("backend-semantic-authority", "binding semantics must come from the canonical manifest");
	}
	if(!Array.isArray(plan.operations) || plan.operations.length === 0)
	{
		fail("invalid-backend-plan", "packaging backend plan must declare at least one operation");
	}
	for(const operation of plan.operations)
	{
		if(typeof operation !== "string" || !allowedOperations.has(operation))
		{
			fail("backend-operation-forbidden", `packaging operation is forbidden: ${String(operation)}`, { operation });
		}
	}
	if(!Array.isArray(plan.commands)) fail("invalid-backend-plan", "commands must be an array");
	for(const command of plan.commands)
	{
		if(typeof command !== "string" || command.trim() === "")
		{
			fail("invalid-backend-plan", "backend command records must be non-empty strings");
		}
		const executable = executableName(command.trim().split(/\s+/, 1)[0]);
		if(forbiddenExecutables.has(executable))
		{
			fail("backend-compiler-command", `packaging backend invoked forbidden build command: ${executable}`, { command });
		}
	}
	if(!Array.isArray(plan.coreArtifacts)) fail("invalid-backend-plan", "coreArtifacts must be an array");
	const paths = new Set();
	for(const artifact of plan.coreArtifacts)
	{
		exactKeys(artifact, ["sourcePath", "packagePath", "sourceSha256", "packageSha256"], "core artifact projection");
		if(typeof artifact.sourcePath !== "string" || typeof artifact.packagePath !== "string")
		{
			fail("invalid-backend-plan", "core artifact paths must be strings");
		}
		requireIdentity(artifact.sourceSha256, "coreArtifacts.sourceSha256");
		requireIdentity(artifact.packageSha256, "coreArtifacts.packageSha256");
		if(artifact.sourceSha256 !== artifact.packageSha256)
		{
			fail("backend-core-artifact-mutation", `packaging backend changed core artifact ${artifact.sourcePath}`, { artifact });
		}
		if(paths.has(artifact.packagePath))
		{
			fail("backend-package-path-collision", `packaging backend wrote two core artifacts to ${artifact.packagePath}`);
		}
		paths.add(artifact.packagePath);
	}
	return true;
};
