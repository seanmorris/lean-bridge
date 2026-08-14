/**
 * Implements the contract module in the capsule subsystem.
 *
 * @file
 */

const PACKAGE_ID = /^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*@[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/;
const SHA256 = /^[0-9a-f]{64}$/;
const SYMBOL = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SAFE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[^\\]+$/;
const PROFILES = new Set(["side-startup", "side-lazy", "final-static"]);

/**
 * Reports capsule contract failures with stable machine-readable codes and structured diagnostic context.
 */
export class CapsuleContractError extends Error
{
	/**
   * Initializes the error used to report capsule contract failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "CapsuleContractError";
		this.code = code;
		this.details = Object.freeze({ ...details });
	}
}

const fail = (code, message, details) => {
	throw new CapsuleContractError(code, message, details);
};

const isObject = value =>
	value !== null && typeof value === "object" && !Array.isArray(value);

const object = (value, path) => {
	if(!isObject(value)) fail("invalid-type", `${path} must be an object`, { path });
	return value;
};

const exactKeys = (value, required, optional, path) => {
	object(value, path);
	const allowed = new Set([...required, ...optional]);
	const missing = required.filter(key => !(key in value));
	if(missing.length)
	{
		fail("missing-property", `${path} is missing ${missing.join(", ")}`, {
			path
			, missing
			, action: "Regenerate or repair the capsule metadata."
		});
	}
	const unknown = Object.keys(value).filter(key => !allowed.has(key));
	if(unknown.length)
	{
		fail("unknown-property", `${path} contains unknown ${unknown.join(", ")}`, {
			path
			, unknown
			, action: "Remove the field or upgrade the capsule schema version."
		});
	}
};

const string = (value, path, pattern) => {
	if(typeof value !== "string" || value.length === 0 || (pattern && !pattern.test(value)))
	{
		fail("invalid-value", `${path} has an invalid value`, { path, actual: value });
	}
	return value;
};

const stringArray = (value, path, { pattern, allowed } = {}) => {
	if(!Array.isArray(value)) fail("invalid-type", `${path} must be an array`, { path });
	const seen = new Set();
	value.forEach((entry, index) => {
    string(entry, `${path}[${index}]`, pattern);
    if(allowed && !allowed.has(entry))
{
      fail("invalid-value", `${path}[${index}] is not supported`, {
        path: `${path}[${index}]`
        , actual: entry
      });
}
    if(seen.has(entry))
{
      fail("duplicate-value", `${path} contains duplicate ${entry}`, { path, actual: entry });
}
    seen.add(entry);
	});
	return value;
};

const validateFile = (value, path) => string(value, path, SAFE_PATH);

const validateArtifact = (artifact, path) => {
	exactKeys(artifact, ["file", "mediaType", "sha256"], [], path);
	validateFile(artifact.file, `${path}.file`);
	string(artifact.mediaType, `${path}.mediaType`);
	string(artifact.sha256, `${path}.sha256`, SHA256);
};

const validateDependency = (dependency, path) => {
	exactKeys(dependency, ["id"], [], path);
	string(dependency.id, `${path}.id`, PACKAGE_ID);
};

/**
 * Validates capsule against its closed contract before it enters the deterministic capsule resolver.
 *
 * @param capsule - Capsule descriptor whose identity, dependencies, and artifact paths are validated or embedded.
 * @param path - Logical or filesystem path used to locate the input and anchor precise validation diagnostics.
 */
export const validateCapsule = (capsule, path = "capsule") => {
	exactKeys(
		capsule,
		[
			"schemaVersion"
			, "id"
			, "runtime"
			, "artifacts"
			, "symbols"
			, "initializer"
			, "dependencies"
			, "fragments"
			, "capabilities"
		],
		[],
		path,
	);
	if(capsule.schemaVersion !== 1)
	{
		fail("unsupported-schema", `${path}.schemaVersion must be 1`, {
			path: `${path}.schemaVersion`
			, actual: capsule.schemaVersion
			, expected: 1
		});
	}
	string(capsule.id, `${path}.id`, PACKAGE_ID);

	exactKeys(
		capsule.runtime,
		["abiVersion", "leanCommit", "patchSetSha256", "profiles", "sharedRuntime"],
		[],
		`${path}.runtime`,
	);
	if(capsule.runtime.abiVersion !== 1)
	{
		fail("abi-version", `${capsule.id} requires unsupported ABI version`, {
			package: capsule.id
			, expected: 1
			, actual: capsule.runtime.abiVersion
			, action: "Install a runtime compatible with the capsule ABI."
		});
	}
	string(capsule.runtime.leanCommit, `${path}.runtime.leanCommit`, /^[0-9a-f]{40}$/);
	string(capsule.runtime.patchSetSha256, `${path}.runtime.patchSetSha256`, SHA256);
	stringArray(capsule.runtime.profiles, `${path}.runtime.profiles`, { allowed: PROFILES });
	if(capsule.runtime.sharedRuntime !== true)
	{
		fail("private-runtime", `${capsule.id} must depend on the application runtime`, {
			package: capsule.id
			, path: `${path}.runtime.sharedRuntime`
			, action: "Rebuild this library as a runtime-free capsule."
		});
	}

	exactKeys(capsule.artifacts, ["targets"], [], `${path}.artifacts`);
	if(!Array.isArray(capsule.artifacts.targets) || capsule.artifacts.targets.length === 0)
	{
		fail("invalid-value", `${path}.artifacts.targets must be non-empty`, {
			path: `${path}.artifacts.targets`
		});
	}
	const targets = new Set();
	capsule.artifacts.targets.forEach((target, targetIndex) => {
    const targetPath = `${path}.artifacts.targets[${targetIndex}]`;
    exactKeys(target, ["target", "sideModule", "staticObjects"], [], targetPath);
    string(target.target, `${targetPath}.target`);
    if(targets.has(target.target))
{
      fail("duplicate-target", `${capsule.id} contains duplicate target ${target.target}`, {
        package: capsule.id
        , target: target.target
      });
}
    targets.add(target.target);
    validateArtifact(target.sideModule, `${targetPath}.sideModule`);
    if(!Array.isArray(target.staticObjects) || target.staticObjects.length === 0)
{
      fail("invalid-value", `${targetPath}.staticObjects must be non-empty`, {
        path: `${targetPath}.staticObjects`
      });
}
    target.staticObjects.forEach((artifact, index) =>
      validateArtifact(artifact, `${targetPath}.staticObjects[${index}]`),
    );
	});

	exactKeys(capsule.symbols, ["exports", "requires"], [], `${path}.symbols`);
	stringArray(capsule.symbols.exports, `${path}.symbols.exports`, { pattern: SYMBOL });
	stringArray(capsule.symbols.requires, `${path}.symbols.requires`, { pattern: SYMBOL });

	if(capsule.initializer?.mode === "required")
	{
		exactKeys(capsule.initializer, ["mode", "symbol"], [], `${path}.initializer`);
		string(capsule.initializer.symbol, `${path}.initializer.symbol`, SYMBOL);
	} else if(capsule.initializer?.mode === "none")
	{
		exactKeys(capsule.initializer, ["mode"], [], `${path}.initializer`);
	} else
	{
		fail("initializer-mode", `${path}.initializer.mode must be required or none`, {
			package: capsule.id
			, actual: capsule.initializer?.mode
		});
	}

	if(!Array.isArray(capsule.dependencies))
	{
		fail("invalid-type", `${path}.dependencies must be an array`, { path: `${path}.dependencies` });
	}
	capsule.dependencies.forEach((dependency, index) =>
		validateDependency(dependency, `${path}.dependencies[${index}]`),
	);
	const dependencyIds = capsule.dependencies.map(dependency => dependency.id);
	if(new Set(dependencyIds).size !== dependencyIds.length)
	{
		fail("duplicate-dependency", `${capsule.id} contains duplicate dependencies`, {
			package: capsule.id
		});
	}

	exactKeys(capsule.fragments, ["bindings", "schema", "assurance"], [], `${path}.fragments`);
	for(const field of ["bindings", "schema", "assurance"])
	{
		const value = capsule.fragments[field];
		if(value !== null) validateFile(value, `${path}.fragments.${field}`);
	}

	exactKeys(capsule.capabilities, ["hosts", "threads", "effects"], [], `${path}.capabilities`);
	stringArray(capsule.capabilities.hosts, `${path}.capabilities.hosts`);
	stringArray(capsule.capabilities.threads, `${path}.capabilities.threads`);
	stringArray(capsule.capabilities.effects, `${path}.capabilities.effects`);
	return capsule;
};

const validateHashReference = (reference, path) => {
	exactKeys(reference, ["id", "sha256"], [], path);
	string(reference.id, `${path}.id`, PACKAGE_ID);
	string(reference.sha256, `${path}.sha256`, SHA256);
};

const validateInput = (input, path) => {
	exactKeys(input, ["path", "sha256"], [], path);
	validateFile(input.path, `${path}.path`);
	string(input.sha256, `${path}.sha256`, SHA256);
};

/**
 * Validates graph lock against its closed contract before it enters the deterministic capsule resolver.
 *
 * @param lock - Graph-lock document whose roots, dependency edges, and capsule identities are validated.
 * @param path - Logical or filesystem path used to locate the input and anchor precise validation diagnostics.
 */
export const validateGraphLock = (lock, path = "lock") => {
	exactKeys(lock, ["schemaVersion", "graphId", "runtime", "roots", "libraries"], [], path);
	if(lock.schemaVersion !== 2)
	{
		fail("unsupported-lock-schema", `${path}.schemaVersion must be 2`, {
			expected: 2
			, actual: lock.schemaVersion
		});
	}
	string(lock.graphId, `${path}.graphId`);
	exactKeys(lock.runtime, ["abiVersion", "leanCommit", "patchSetSha256"], [], `${path}.runtime`);
	if(lock.runtime.abiVersion !== 1)
	{
		fail("abi-version", `${path}.runtime.abiVersion must be 1`, {
			expected: 1
			, actual: lock.runtime.abiVersion
		});
	}
	string(lock.runtime.leanCommit, `${path}.runtime.leanCommit`, /^[0-9a-f]{40}$/);
	string(lock.runtime.patchSetSha256, `${path}.runtime.patchSetSha256`, SHA256);
	if(!Array.isArray(lock.roots) || lock.roots.length === 0)
	{
		fail("invalid-value", `${path}.roots must be non-empty`, { path: `${path}.roots` });
	}
	lock.roots.forEach((root, index) => validateHashReference(root, `${path}.roots[${index}]`));
	if(!Array.isArray(lock.libraries) || lock.libraries.length === 0)
	{
		fail("invalid-value", `${path}.libraries must be non-empty`, { path: `${path}.libraries` });
	}
	lock.libraries.forEach((library, index) => {
    const itemPath = `${path}.libraries[${index}]`;
    exactKeys(
      library,
      ["id", "module", "capsule", "dependencies", "source", "shim", "bindingIr"],
      [],
      itemPath,
    );
    string(library.id, `${itemPath}.id`, PACKAGE_ID);
    string(library.module, `${itemPath}.module`, /^[A-Z][A-Za-z0-9_]*$/);
    validateInput(library.capsule, `${itemPath}.capsule`);
    if(!Array.isArray(library.dependencies))
{
      fail("invalid-type", `${itemPath}.dependencies must be an array`, {
        path: `${itemPath}.dependencies`
      });
}
    library.dependencies.forEach((dependency, dependencyIndex) =>
      validateHashReference(dependency, `${itemPath}.dependencies[${dependencyIndex}]`),
    );
    validateInput(library.source, `${itemPath}.source`);
    validateInput(library.shim, `${itemPath}.shim`);
    if(library.bindingIr !== null)
{
      exactKeys(
        library.bindingIr,
        ["path", "sha256", "semanticSha256"],
        [],
        `${itemPath}.bindingIr`,
      );
      validateFile(library.bindingIr.path, `${itemPath}.bindingIr.path`);
      string(library.bindingIr.sha256, `${itemPath}.bindingIr.sha256`, SHA256);
      string(
        library.bindingIr.semanticSha256,
        `${itemPath}.bindingIr.semanticSha256`,
        SHA256,
      );
}
	});
	return lock;
};

const sameSet = (left, right) =>
	left.length === right.length && left.every(value => right.includes(value));

/**
 * Resolves locked graph while rejecting missing, ambiguous, or incompatible inputs for the deterministic capsule resolver.
 *
 * @param root0 - Named inputs and dependency overrides used to resolve locked graph.
 * @param root0.lock - Graph-lock document whose roots, dependency edges, and capsule identities are validated.
 * @param root0.capsules - Available capsule descriptors indexed while resolving locked dependencies.
 * @param root0.capsuleDigests - Expected content digests used to reject capsule drift while resolving the graph.
 * @param root0.profile - Named runtime, graph, transport, or measurement profile selecting the closed behavior to execute.
 * @param root0.roots - Root capsule identifiers from which locked dependency traversal begins.
 */
export const resolveLockedGraph = ({ lock, capsules, capsuleDigests, profile, roots }) => {
	validateGraphLock(lock);
	if(!PROFILES.has(profile))
	{
		fail("unsupported-profile", `Unknown composition profile ${profile}`, {
			actual: profile
			, expected: [...PROFILES]
		});
	}

	const capsuleMap = new Map();
	for(const capsule of capsules)
	{
		validateCapsule(capsule);
		if(capsuleMap.has(capsule.id))
		{
			fail("duplicate-package", `Multiple capsules claim ${capsule.id}`, {
				package: capsule.id
				, action: "Select one content identity in the graph lock."
			});
		}
		capsuleMap.set(capsule.id, capsule);
	}

	const libraryMap = new Map();
	for(const library of lock.libraries)
	{
		if(libraryMap.has(library.id))
		{
			fail("duplicate-lock-entry", `The graph lock contains ${library.id} twice`, {
				package: library.id
			});
		}
		libraryMap.set(library.id, library);
		const capsule = capsuleMap.get(library.id);
		if(!capsule)
		{
			fail("missing-capsule", `The graph lock requires missing capsule ${library.id}`, {
				package: library.id
				, action: `Provide ${library.capsule.path} from the locked package closure.`
			});
		}
		const actualDigest = capsuleDigests?.get(library.id);
		if(actualDigest !== undefined && actualDigest !== library.capsule.sha256)
		{
			fail("integrity-mismatch", `Capsule integrity mismatch for ${library.id}`, {
				package: library.id
				, path: library.capsule.path
				, expected: library.capsule.sha256
				, actual: actualDigest
				, action: "Restore the locked capsule or regenerate and review the graph lock."
			});
		}
		for(const field of ["abiVersion", "leanCommit", "patchSetSha256"])
		{
			if(capsule.runtime[field] !== lock.runtime[field])
			{
				fail("runtime-conflict", `${library.id} has incompatible runtime ${field}`, {
					package: library.id
					, property: field
					, expected: lock.runtime[field]
					, actual: capsule.runtime[field]
					, action: "Rebuild the package against the locked shared runtime."
				});
			}
		}
		if(!capsule.runtime.profiles.includes(profile))
		{
			fail("profile-conflict", `${library.id} does not support ${profile}`, {
				package: library.id
				, profile
				, action: "Choose a supported profile or rebuild the capsule for this profile."
			});
		}
		const declared = capsule.dependencies.map(dependency => dependency.id);
		const locked = library.dependencies.map(dependency => dependency.id);
		if(!sameSet(declared, locked))
		{
			fail("dependency-drift", `${library.id} dependencies disagree with the lock`, {
				package: library.id
				, expected: locked
				, actual: declared
				, action: "Regenerate and review the lock from the capsule descriptors."
			});
		}
	}

	for(const library of lock.libraries)
	{
		for(const dependency of library.dependencies)
		{
			const target = libraryMap.get(dependency.id);
			if(!target)
			{
				fail("missing-dependency", `${library.id} requires missing ${dependency.id}`, {
					package: library.id
					, dependency: dependency.id
					, action: "Add the exact dependency capsule to the locked closure."
				});
			}
			if(dependency.sha256 !== target.capsule.sha256)
			{
				fail("dependency-integrity-conflict", `${library.id} pins conflicting content for ${dependency.id}`, {
					package: library.id
					, dependency: dependency.id
					, expected: target.capsule.sha256
					, actual: dependency.sha256
					, action: "Resolve the dependency to one content identity before composition."
				});
			}
		}
	}

	const requestedRoots = roots ?? lock.roots;
	requestedRoots.forEach((root, index) => validateHashReference(root, `roots[${index}]`));
	const visiting = [];
	const visited = new Set();
	const order = [];
	const visit = reference => {
		const library = libraryMap.get(reference.id);
		if(!library)
		{
			fail("missing-root", `Requested package ${reference.id} is not locked`, {
				package: reference.id
				, action: "Add the package to the graph lock before loading it."
			});
		}
		if(reference.sha256 !== library.capsule.sha256)
		{
			fail("root-integrity-conflict", `Requested content for ${reference.id} differs from the lock`, {
				package: reference.id
				, expected: library.capsule.sha256
				, actual: reference.sha256
			});
		}
		if(visited.has(reference.id)) return;
		const cycleIndex = visiting.indexOf(reference.id);
		if(cycleIndex !== -1)
		{
			const cycle = [...visiting.slice(cycleIndex), reference.id];
			fail("dependency-cycle", `Library dependency cycle: ${cycle.join(" -> ")}`, {
				cycle
				, action: "Break the package dependency cycle before composition."
			});
		}
		visiting.push(reference.id);
		[...library.dependencies]
      .sort((left, right) => left.id.localeCompare(right.id))
      .forEach(visit);
		visiting.pop();
		visited.add(reference.id);
		order.push(reference.id);
	};
	[...requestedRoots].sort((left, right) => left.id.localeCompare(right.id)).forEach(visit);

	const exportOwners = new Map();
	const initializerOwners = new Map();
	for(const id of order)
	{
		const capsule = capsuleMap.get(id);
		for(const symbol of capsule.symbols.exports)
		{
			const owner = exportOwners.get(symbol);
			if(owner)
			{
				fail("symbol-conflict", `${id} and ${owner} both export ${symbol}`, {
					package: id
					, otherPackage: owner
					, symbol
					, action: "Rename or hide one symbol before linking the graph."
				});
			}
			exportOwners.set(symbol, id);
		}
		if(capsule.initializer.mode === "required")
		{
			const owner = initializerOwners.get(capsule.initializer.symbol);
			if(owner)
			{
				fail("initializer-conflict", `${id} and ${owner} share initializer ${capsule.initializer.symbol}`, {
					package: id
					, otherPackage: owner
					, symbol: capsule.initializer.symbol
					, action: "Give each library initializer a unique generated symbol."
				});
			}
			initializerOwners.set(capsule.initializer.symbol, id);
		}
	}
	for(const id of order)
	{
		const capsule = capsuleMap.get(id);
		for(const symbol of capsule.symbols.requires)
		{
			if(!exportOwners.has(symbol))
			{
				fail("unresolved-symbol", `${id} requires unresolved package symbol ${symbol}`, {
					package: id
					, symbol
					, action: "Add a locked dependency that exports the symbol."
				});
			}
		}
	}

	return Object.freeze({
		schemaVersion: 1
		, graphId: lock.graphId
		, profile
		, roots: Object.freeze(requestedRoots.map(root => Object.freeze({ ...root })))
		, order: Object.freeze(order)
		, libraries: Object.freeze(
			order.map(id =>
				Object.freeze({
					id
					, sha256: libraryMap.get(id).capsule.sha256
					, capsule: capsuleMap.get(id)
					, build: libraryMap.get(id)
				}),
			),
		)
	});
};
