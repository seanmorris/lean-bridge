/**
 * Shared immutable policy for native PHP and PHP-Wasm HostNull evidence.
 *
 * @file
 */
import assert from "node:assert/strict";

const common = Object.freeze([
	"The explicit compiler-authenticated HostNull wrapper maps its null branch to PHP null and its payload branch directly to T; Option remains a distinct tagged None or Some value."
	, "Ordinary Lean source and independently reviewed Binding IR are exercised through source-free installed packages at parameters, results, fields and synchronous callback positions."
	, "Both author routes retain complete package-set receipts, verifiers and archives, install offline after source removal, relocate and repeat execution."
	, "The original GitHub artifact ZIP, workflow API records, reports, package handoffs and selected source closure are retained and independently replayed."
	, "External PHP, Composer, browser, Node, compiler, Nix and operating-system distributions remain trusted recorded inputs rather than copied toolchains."
]);

export const hostNullPhpHostedProfiles = Object.freeze({
	"php-native": Object.freeze({
		artifactPrefix: "host-null-php-native"
		, evidence: "docs/evidence/host-null-php-native-20261029"
		, jobName: "Native PHP", kind: "host-null-php-native-installed-v1"
		, reportPath: "php-native.json"
		, packagesPath: "packages/php-native"
		, limitations: Object.freeze([
			...common
			, "Native PHP acceptance covers weak and strict callers on the hosted 64-bit PHP FFI runtime; PHP-Wasm and other host targets require separate evidence."
		])
	})
	, "php-wasm": Object.freeze({
		artifactPrefix: "host-null-php-wasm"
		, evidence: "docs/evidence/host-null-php-wasm-20261029"
		, jobName: "PHP-Wasm corpus (values-graph)"
		, kind: "host-null-php-wasm-installed-v1"
		, reportPath: "php-wasm.json"
		, packagesPath: "packages/php-wasm"
		, limitations: Object.freeze([
			...common
			, "PHP-Wasm acceptance covers weak and strict callers through Node embedded and Composer arrangements plus bundled Chromium, with startup and lazy loading; native PHP and other hosts require separate evidence."
		])
	})
});

/**
 * Select one supported evidence policy.
 *
 * @param profile - Native PHP or PHP-Wasm evidence profile.
 */
export const hostNullPhpHostedPolicy = profile => {
	assert.ok(Object.hasOwn(hostNullPhpHostedProfiles, profile)
		, `Unsupported HostNull PHP evidence profile ${profile}`);
	return hostNullPhpHostedProfiles[profile];
};
