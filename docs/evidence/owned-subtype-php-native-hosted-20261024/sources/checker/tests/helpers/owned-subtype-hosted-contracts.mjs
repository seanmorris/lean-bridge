/**
 * Closed hosted contracts for owned-Subtype package and browser evidence.
 *
 * @file
 */

const freeze = value => Object.freeze(value);

const direct = ({ lane, workflow, job, prefix, ci, packaging, report
	, profiles, test, acceptanceStep, enforceStep }) => freeze({
	lane, workflow, job, prefix, ci, packaging, report, profiles, test
	, acceptanceStep, enforceStep
	, tap: `${ci}/acceptance.log`
	, toolchain: `${ci}/toolchain.log`
	});

const remaining = (lane, profiles) => freeze({
	lane
	, workflow: ".github/workflows/owned-subtype-remaining.yml"
	, job: `Checked owned aggregates in ${lane}`
	, prefix: `owned-subtype-remaining-${lane}`
	, ci: null
	, packaging: "owned-subtype-remaining-packaging"
	, report: `${lane}.json`
	, profiles: freeze(profiles)
	, test: "tests/owned-subtype-remaining-packaging.test.mjs"
	, acceptanceStep: "Require both author routes and relocated installed consumers"
	, enforceStep: "Enforce installed owned Subtype acceptance"
	, tap: `owned-subtype-remaining-${lane}.log`
	, toolchain: `owned-subtype-remaining-${lane}-toolchain.log`
});

export const ownedSubtypeHostedContracts = freeze({
	native: direct({
		lane: "native"
		, workflow: ".github/workflows/owned-subtype-native.yml"
		, job: "Ordinary and reviewed owned Subtypes in C and C++"
		, prefix: "owned-subtype-native"
		, ci: "owned-subtype-native-ci"
		, packaging: "owned-subtype-native-packaging"
		, report: "report.json", profiles: freeze(["c", "cpp"])
		, test: "tests/owned-subtype-native-packaging.test.mjs"
		, acceptanceStep: "Execute source-free C and C++ acceptance"
		, enforceStep: "Enforce installed native acceptance"
	})
	, perl: direct({
		lane: "perl"
		, workflow: ".github/workflows/owned-subtype-perl.yml"
		, job: "Ordinary and reviewed owned Subtypes across four Perl ABIs"
		, prefix: "owned-subtype-perl"
		, ci: "owned-subtype-perl-ci"
		, packaging: "owned-subtype-perl-packaging"
		, report: "report.json", profiles: freeze(["perl"])
		, test: "tests/owned-subtype-perl-packaging.test.mjs"
		, acceptanceStep: "Execute source-free CPAN acceptance"
		, enforceStep: "Enforce installed Perl acceptance"
	})
	, languages: direct({
		lane: "languages"
		, workflow: ".github/workflows/owned-subtype-languages.yml"
		, job: "Ordinary and reviewed owned Subtypes in three language packages"
		, prefix: "owned-subtype-languages"
		, ci: "owned-subtype-languages-ci"
		, packaging: "owned-subtype-language-packaging"
		, report: "report.json", profiles: freeze(["python", "ruby", "rust"])
		, test: "tests/owned-subtype-language-packaging.test.mjs"
		, acceptanceStep: "Execute source-free language acceptance"
		, enforceStep: "Enforce installed language acceptance"
	})
	, dotnet: remaining("dotnet", ["dotnet"])
	, jvm: remaining("jvm", ["java", "kotlin"])
	, "php-native": remaining("php-native", ["php-native"])
	, "wit-wasi": remaining("wit-wasi", ["wit-wasi"])
	, javascript: freeze({
		lane: "javascript", kind: "javascript"
		, workflow: ".github/workflows/consumer-matrix.yml"
		, job: "Owned JavaScript and production Wasm runtime"
		, prefix: "owned-javascript-wasm"
		, packaging: "owned-subtype-javascript-packaging"
		, report: "report.json"
		, profiles: freeze(["node-javascript", "node-typescript"
			, "browser-javascript", "browser-react", "browser-worker"])
		, test: "tests/owned-subtype-javascript-packaging.test.mjs"
		, acceptanceStep: "Build and install owned npm packages through the standalone CLI"
		, archiveStep: "Preserve owned JavaScript and runtime execution logs"
		, runConclusions: freeze(["success", "failure"])
		, tap: "owned-javascript-wasm/installed.log"
		, retainedRoots: freeze(["owned-subtype-javascript-packaging/"])
		, retainedFiles: freeze(["owned-javascript-wasm/installed.log"])
	})
});

export const ownedSubtypeHostedLaneNames
	= freeze(Object.keys(ownedSubtypeHostedContracts));
