/**
 * Closed GitHub Actions identities for the non-PHP-Wasm generic-Subtype
 * promotion. Every contract names one independently downloadable artifact.
 *
 * @file
 */
import assert from "node:assert/strict";

const workflow = name => `.github/workflows/${name}.yml`;
const routes = Object.freeze(["ordinary", "reviewed"]);

const definitions = [
	{
		lane: "npm-ordinary", workflow: workflow("generic-subtype-npm-browser")
		, job: "ordinary generic Subtypes in Node and browsers"
		, workflowJob: "${{ matrix.route }} generic Subtypes in Node and browsers"
		, artifactPrefix: "generic-subtype-npm-browser-ordinary-"
		, workflowArtifactPrefix: "generic-subtype-npm-browser-${{ matrix.route }}-"
		, acceptanceStep: "Install and exercise the selected generic Subtype route"
		, enforceStep: "Enforce generic Subtype acceptance"
		, profiles: ["node-javascript", "node-typescript", "browser-javascript"
			, "browser-react", "browser-worker"]
		, routes: ["ordinary"], outputKind: "npm-browser"
	}
	, {
		lane: "npm-reviewed", workflow: workflow("generic-subtype-npm-browser")
		, job: "reviewed generic Subtypes in Node and browsers"
		, workflowJob: "${{ matrix.route }} generic Subtypes in Node and browsers"
		, artifactPrefix: "generic-subtype-npm-browser-reviewed-"
		, workflowArtifactPrefix: "generic-subtype-npm-browser-${{ matrix.route }}-"
		, acceptanceStep: "Install and exercise the selected generic Subtype route"
		, enforceStep: "Enforce generic Subtype acceptance"
		, profiles: ["node-javascript", "node-typescript", "browser-javascript"
			, "browser-react", "browser-worker"]
		, routes: ["reviewed"], outputKind: "npm-browser"
	}
	, {
		lane: "foundation", workflow: workflow("generic-subtype-native-perl")
		, job: "Dependent generic checked Subtype compiler and review contract"
		, artifactPrefix: "dependent-generic-subtype-"
		, acceptanceStep: "Verify dependent generic checked Subtypes"
		, enforceStep: "Enforce dependent generic checked Subtype acceptance"
		, profiles: [], routes, outputKind: "foundation"
	}
	, {
		lane: "native", workflow: workflow("generic-subtype-native-perl")
		, job: "Ordinary and reviewed generic Subtypes in C and C++"
		, artifactPrefix: "generic-subtype-native-"
		, acceptanceStep: "Execute source-free C and C++ acceptance"
		, enforceStep: "Enforce installed native acceptance"
		, profiles: ["c", "cpp"], routes, outputKind: "native"
	}
	, {
		lane: "perl", workflow: workflow("generic-subtype-native-perl")
		, job: "Ordinary and reviewed generic Subtypes across four Perl ABIs"
		, artifactPrefix: "generic-subtype-perl-"
		, acceptanceStep: "Execute source-free CPAN acceptance"
		, enforceStep: "Enforce installed Perl acceptance"
		, profiles: ["perl"], routes, outputKind: "perl"
	}
	, {
		lane: "python", workflow: workflow("generic-subtype-languages")
		, job: "Ordinary and reviewed generic Subtypes on Python 3.11 and 3.12"
		, artifactPrefix: "generic-subtype-python-"
		, acceptanceStep: "Execute installed Python acceptance"
		, enforceStep: "Enforce installed Python acceptance"
		, profiles: ["python"], routes, outputKind: "language"
	}
	, {
		lane: "ruby", workflow: workflow("generic-subtype-languages")
		, job: "Ordinary and reviewed generic Subtypes on Ruby 3.3"
		, artifactPrefix: "generic-subtype-ruby-"
		, acceptanceStep: "Execute installed Ruby acceptance"
		, enforceStep: "Enforce installed Ruby acceptance"
		, profiles: ["ruby"], routes, outputKind: "language"
	}
	, {
		lane: "rust", workflow: workflow("generic-subtype-languages")
		, job: "Ordinary and reviewed generic Subtypes on Rust 1.90"
		, artifactPrefix: "generic-subtype-rust-"
		, acceptanceStep: "Execute source-free Rust acceptance"
		, enforceStep: "Enforce installed Rust acceptance"
		, profiles: ["rust"], routes, outputKind: "language"
	}
	, {
		lane: "dotnet", workflow: workflow("generic-subtype-managed-wit")
		, job: "Generic Subtypes in .NET"
		, artifactPrefix: "generic-subtype-dotnet-"
		, acceptanceStep: "Execute installed .NET acceptance"
		, enforceStep: "Enforce installed .NET acceptance"
		, profiles: ["dotnet"], routes, outputKind: "managed-wit"
	}
	, {
		lane: "jvm", workflow: workflow("generic-subtype-managed-wit")
		, job: "Generic Subtypes in Java and Kotlin"
		, artifactPrefix: "generic-subtype-jvm-"
		, acceptanceStep: "Execute installed JVM acceptance"
		, enforceStep: "Enforce installed JVM acceptance"
		, profiles: ["java", "kotlin"], routes, outputKind: "managed-wit"
	}
	, {
		lane: "php-native", workflow: workflow("generic-subtype-managed-wit")
		, job: "Generic Subtypes in native PHP"
		, artifactPrefix: "generic-subtype-php-"
		, acceptanceStep: "Execute installed native PHP acceptance"
		, enforceStep: "Enforce installed native PHP acceptance"
		, profiles: ["php-native"], routes, outputKind: "managed-wit"
	}
	, {
		lane: "wit-wasi", workflow: workflow("generic-subtype-managed-wit")
		, job: "Generic Subtypes in WIT and WASI components"
		, artifactPrefix: "generic-subtype-wit-"
		, acceptanceStep: "Execute installed WIT acceptance"
		, enforceStep: "Enforce installed WIT acceptance"
		, profiles: ["wit-wasi"], routes, outputKind: "managed-wit"
	}
];

const freezeContract = definition => Object.freeze({
	...definition, profiles: Object.freeze(definition.profiles)
	, routes: Object.freeze(definition.routes)
});

export const genericSubtypeHostedContracts = Object.freeze(Object.fromEntries(
	definitions.map(definition => [definition.lane, freezeContract(definition)])
));

export const genericSubtypeHostedLaneNames = Object.freeze(
	definitions.map(definition => definition.lane));

/**
 * Select one immutable hosted contract.
 *
 * @param lane - Closed hosted lane name.
 */
export const genericSubtypeHostedContract = lane => {
	assert.ok(genericSubtypeHostedLaneNames.includes(lane), lane);
	return genericSubtypeHostedContracts[lane];
};
