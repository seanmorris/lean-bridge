/**
 * Closed hosted contracts for the non-PHP-Wasm owned checked-record lanes.
 *
 * Each lane names the workflow job and artifact that produce it, the exact
 * uploaded directories, the aggregate report and its per-route evidence
 * prefix, the Node test names, and the report fields that must hold on
 * every route or only on full routes.
 *
 * @file
 */

export const ownedCheckedRecordHostedRoutes = Object.freeze([
	"ordinary-full", "ordinary-result-only"
	, "reviewed-full", "reviewed-result-only"
]);

const freeze = value => Object.freeze(Object.fromEntries(Object.entries(value)
	.map(([key, item]) => [key, Array.isArray(item) ? Object.freeze(item) : item])));

const nativeLane = freeze({
	kind: "native"
	, workflow: ".github/workflows/owned-checked-record-native-perl.yml"
	, job: "Ordinary and reviewed owned checked records in C and C++"
	, prefix: "owned-checked-record-native"
	, acceptanceStep: "Execute source-free C and C++ acceptance"
	, enforceStep: "Enforce installed native acceptance"
	, test: "tests/owned-checked-record-native-packaging.test.mjs"
	, ci: "owned-checked-record-native-ci"
	, packaging: "owned-checked-record-native-packaging"
	, report: "report.json"
	, reportProfile: "installed-owned-checked-record-native"
	, evidence: "evidence"
	, targets: ["c", "cpp"]
	, staticTests: [
		"owned checked-record C and C++ generators retain exact callback directions"
		, "owned checked-record native acceptance is a required recurring job"
	]
	, routeTest: "installed {route} owned checked records execute through C and C++ archives"
	, keys: ["authorRoute", "bindingIrSha256", "callbackRecovery"
		, "componentReceipt", "deterministicReassembly", "earlyAndLateRejection"
		, "lifecycle", "mode", "observed", "outputAtomicity", "packageSetReceipt"
		, "relocated", "relocatedInstallation", "retainedPackageSet", "route"
		, "sourceFreeInstallation", "sourceUnchanged", "unchangedRejectedInputs"]
	, always: ["deterministicReassembly", "relocatedInstallation"
		, "sourceFreeInstallation", "sourceUnchanged"]
	, fullOnly: ["callbackRecovery", "earlyAndLateRejection", "outputAtomicity"
		, "unchangedRejectedInputs"]
});

const perlLane = freeze({
	kind: "perl"
	, workflow: ".github/workflows/owned-checked-record-native-perl.yml"
	, job: "Ordinary and reviewed owned checked records across four Perl ABIs"
	, prefix: "owned-checked-record-perl"
	, acceptanceStep: "Execute source-free CPAN acceptance"
	, enforceStep: "Enforce installed Perl acceptance"
	, test: "tests/owned-checked-record-perl-packaging.test.mjs"
	, ci: "owned-checked-record-perl-ci"
	, packaging: "owned-checked-record-perl-packaging"
	, report: "report.json"
	, reportProfile: "installed-owned-checked-record-perl"
	, evidence: "evidence"
	, targets: ["cpan"]
	, staticTests: [
		"owned checked-record CPAN projection retains mixed transport"
		, "owned checked-record Perl acceptance is a required recurring job"
	]
	, routeTest: "installed {route} owned checked records execute through CPAN archives"
	, keys: ["authorRoute", "bindingIrSha256", "callbackRecovery"
		, "componentReceipt", "consumerSha256", "deterministicReassembly"
		, "earlyAndLateRejection", "immutableConsumer", "independentlyVerified"
		, "lifecycle", "mode", "observations", "packageSetReceipt"
		, "relocatedInstallation", "retainedPackageSet", "route"
		, "sourceFreeInstallation", "sourceUnchanged", "unchangedRejectedInputs"]
	, always: ["deterministicReassembly", "immutableConsumer"
		, "independentlyVerified", "relocatedInstallation"
		, "sourceFreeInstallation", "sourceUnchanged"]
	, fullOnly: ["callbackRecovery", "earlyAndLateRejection"
		, "unchangedRejectedInputs"]
});

const languageTargets = Object.freeze({
	python: "pypi", ruby: "rubygems", rust: "cargo"
});

const languageLane = profile => freeze({
	kind: "language", profile
	, workflow: ".github/workflows/owned-checked-record-languages.yml"
	, job: `Owned checked records in ${profile} packages`
	, prefix: `owned-checked-record-${profile}`
	, acceptanceStep: "Execute source-free language acceptance"
	, enforceStep: "Enforce installed language acceptance"
	, test: "tests/owned-checked-record-language-packaging.test.mjs"
	, ci: "owned-checked-record-language-ci"
	, packaging: "owned-checked-record-language-packaging"
	, report: "report.json"
	, reportProfile: "installed-owned-checked-record-languages"
	, evidence: `evidence/${profile}`
	, targets: [languageTargets[profile]]
	, profiles: [profile]
	, staticTests: [
		"owned checked-record language generators preserve the exact API modes"
		, "owned checked-record language consumers and recurring workflow stay registered"
	]
	, routeTest: "installed {route} owned checked records execute through selected language archives"
	, keys: ["authorRoute", "bindingIrSha256", "componentReceipts"
		, "constructorRejectionAndRecovery", "deterministicReassembly"
		, "earlyAndLateRejection", "exactApiMode"
		, "handoffRemovedBeforeRelocatedExecution", "hostCallbackRecovery"
		, "lifecycle", "mixedOwnedAndCopiedTransport", "mode", "observations"
		, "packageSetReceipt", "profiles", "reassembled", "relocatedInstallation"
		, "retainedPackageSet", "returnedClosureRecovery", "route"
		, "sourceFreeInstallation", "sourceUnchanged"
		, "transferredInputCheckedBeforeHandoff", "unchangedRejectedInputs"
		, "versions", ...profile === "rust" ? ["dependencies"] : []].toSorted()
	, always: ["deterministicReassembly", "exactApiMode"
		, "handoffRemovedBeforeRelocatedExecution", "relocatedInstallation"
		, "sourceFreeInstallation", "sourceUnchanged"]
	, fullOnly: ["constructorRejectionAndRecovery", "earlyAndLateRejection"
		, "hostCallbackRecovery", "mixedOwnedAndCopiedTransport"
		, "returnedClosureRecovery", "transferredInputCheckedBeforeHandoff"
		, "unchangedRejectedInputs"]
	, resultOnlyChecks: { [profile]: profile === "rust" ? 3 : 5 }
	, lifecycle: { [profile]: profile === "rust"
		? "drop-plus-explicit-close" : "gc-finalizer-plus-explicit-close" }
});

const managedGroups = Object.freeze({
	dotnet: { target: "nuget", profiles: ["dotnet"] }
	, jvm: { target: "maven", profiles: ["java", "kotlin"] }
	, php: { target: "php-native", profiles: ["php-native"] }
	, wit: { target: "wit-wasi", profiles: ["wit-wasi"] }
});

const managedLane = group => freeze({
	kind: "managed", group
	, workflow: ".github/workflows/owned-checked-record-managed.yml"
	, job: `Owned checked records in ${group} packages`
	, prefix: `owned-checked-record-managed-${group}`
	, acceptanceStep: "Execute source-free managed acceptance"
	, enforceStep: "Enforce installed managed acceptance"
	, test: "tests/owned-checked-record-managed-packaging.test.mjs"
	, ci: "owned-checked-record-managed-ci"
	, packaging: "owned-checked-record-managed-packaging"
	, report: `${group}.json`
	, reportProfile: "installed-owned-checked-record-managed"
	, evidence: `evidence/${group}`
	, targets: [managedGroups[group].target]
	, profiles: managedGroups[group].profiles
	, staticTests: [
		"managed owned checked-record generators preserve exact API modes"
		, "managed owned checked-record consumers are independently authored"
	]
	, routeTest: `installed {route} owned checked records execute through ${group} packages`
	, keys: ["authorRoute", "deterministicReassembly", "group"
		, "handoffRemovedBeforeRelocatedExecution", "immutableInstalledInputs"
		, "mode", "observations", "packageSetReceiptSha256", "profiles"
		, "reassembled", "relocatedInstallation", "repeated"
		, "retainedPackageSet", "route", "sourceFreeInstallation"
		, "sourceUnchanged"]
	, always: ["deterministicReassembly", "handoffRemovedBeforeRelocatedExecution"
		, "immutableInstalledInputs", "relocatedInstallation"
		, "sourceFreeInstallation", "sourceUnchanged"]
	, fullOnly: []
});

const javascriptLane = freeze({
	kind: "javascript"
	, workflow: ".github/workflows/consumer-matrix.yml"
	, job: "Owned JavaScript and production Wasm runtime"
	, prefix: "owned-javascript-wasm"
	, acceptanceStep: "Build and install owned npm packages through the standalone CLI"
	, archiveStep: "Preserve owned JavaScript and runtime execution logs"
	, test: "tests/owned-checked-record-javascript-packaging.test.mjs"
	, packaging: "owned-checked-record-javascript-packaging"
	, report: "report.json"
	, reportProfile: "installed-owned-checked-record-javascript"
	, evidence: "evidence"
	, acceptance: "owned-checked-record-javascript-packaging/acceptance.log"
	, verification: "owned-checked-record-javascript-packaging/verification.json"
	, retainedRoots: ["owned-checked-record-javascript-packaging/"]
	, targets: ["npm"]
	, staticTests: [
		"ordinary and reviewed JavaScript authors select the same full and result-only boundaries"
	]
	, routeTest: "installed {route} owned checked records execute from source-free npm archives"
	, keys: ["archiveReproduction", "archives", "authorRoute"
		, "bindingIrSha256", "browser", "componentIdentity", "installedNode"
		, "installedTypeScript", "mode", "observed", "packageSetReceipt"
		, "relocatedInstallation", "retainedPackageSet", "route"
		, "sourceIdentity", "sourceRemovedBeforeInstall", "wasm"]
	, always: ["archiveReproduction", "installedNode", "installedTypeScript"
		, "relocatedInstallation", "sourceRemovedBeforeInstall"]
	, fullOnly: []
});

export const ownedCheckedRecordHostedLanes = Object.freeze({
	native: nativeLane
	, perl: perlLane
	, python: languageLane("python")
	, ruby: languageLane("ruby")
	, rust: languageLane("rust")
	, dotnet: managedLane("dotnet")
	, jvm: managedLane("jvm")
	, php: managedLane("php")
	, wit: managedLane("wit")
	, javascript: javascriptLane
});

export const ownedCheckedRecordHostedLaneNames
	= Object.freeze(Object.keys(ownedCheckedRecordHostedLanes));

/**
 * Name the exact Node test points one lane's acceptance log must contain.
 *
 * @param lane - Hosted lane contract.
 */
export const ownedCheckedRecordHostedTestNames = lane => [
	...lane.staticTests
	, ...ownedCheckedRecordHostedRoutes.map(route =>
		lane.routeTest.replace("{route}", route))
];
