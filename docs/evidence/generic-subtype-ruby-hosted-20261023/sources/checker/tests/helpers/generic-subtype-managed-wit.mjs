/**
 * Independent installed-consumer selections for generic Subtypes in managed hosts, PHP and WIT.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { nominalSubtypeInstalledConfiguration, nominalSubtypeInstalledReview } from "./nominal-subtype-installed-fixture.mjs";
import { nominalSubtypeJvmConfiguration, nominalSubtypeJvmReview } from "./nominal-subtype-jvm-fixture.mjs";
import { nominalSubtypePhpConfiguration, nominalSubtypePhpReview } from "./nominal-subtype-php-fixture.mjs";

export const genericSubtypeManagedWitHosts = Object.freeze(["dotnet", "jvm", "php", "wit"]);
export const genericSubtypeManagedWitRoutes = Object.freeze(["ordinary", "reviewed"]);
export const genericSubtypeManagedWitExpected = Object.freeze({ checks: 18, rejections: 3 });
export const genericSubtypeJvmProfiles = Object.freeze(["java", "kotlin"]);

const specifications = Object.freeze({
	dotnet: { prefix: "LEAN_BRIDGE_GENERIC_SUBTYPE_DOTNET_", target: "nuget"
		, destination: { name: "Nominalsubtypes.Api", version: "1.0.0" }
		, extension: "cs" }
	, jvm: { prefix: "LEAN_BRIDGE_GENERIC_SUBTYPE_JVM_", target: "maven"
		, destination: { name: "org.leanbridge:nominalsubtypes", version: "1.0.0" } }
	, php: { prefix: "LEAN_BRIDGE_GENERIC_SUBTYPE_PHP_", target: "php-native"
		, destination: { name: "example/nominalsubtypes", version: "1.0.0" }
		, extension: "php" }
	, wit: { prefix: "LEAN_BRIDGE_GENERIC_SUBTYPE_WIT_", target: "wit-wasi"
		, destination: { name: "nominalsubtypes", version: "1.0.0" }, extension: "c" }
});

/**
 * Select a complete, explicit generic installed-package lane.
 *
 * @param host - Closed host identity.
 * @param environment - Explicit producer environment.
 */
export const genericSubtypeManagedWitSelection = (host, environment) => {
	assert.ok(genericSubtypeManagedWitHosts.includes(host));
	const prefix = specifications[host].prefix, flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag), `Invalid generic Subtype ${host} TEST`);
	const raw = environment[prefix + "ROUTES"], routes = raw?.split(",") ?? genericSubtypeManagedWitRoutes;
	if(raw !== undefined) assert.equal(flag, "1", `Explicit generic Subtype ${host} routes require TEST=1`);
	assert.ok(routes.length && routes.every(route => genericSubtypeManagedWitRoutes.includes(route)));
	assert.equal(new Set(routes).size, routes.length);
	for(const name of host === "php" ? ["OUTPUT", "VERSION", "COMPOSER_VERSION"] : ["OUTPUT"])
		if(environment[prefix + name] !== undefined) assert.equal(flag, "1");
	return { enabled: flag === "1", routes };
};

/**
 * Keep the shared generic contract while selecting one package ecosystem.
 *
 * @param host - Closed host identity.
 * @param route - Ordinary or independently reviewed author route.
 */
export const genericSubtypeManagedWitConfiguration = (host, route) => {
	assert.ok(genericSubtypeManagedWitHosts.includes(host));
	if(host === "jvm") return nominalSubtypeJvmConfiguration(route, "full", { genericCompositions: true });
	if(host === "php") return nominalSubtypePhpConfiguration(route, "full", { genericCompositions: true });
	const item = specifications[host];
	return { ...nominalSubtypeInstalledConfiguration(route, ["c"], false, { genericCompositions: true })
		, targets: { [item.target]: item.destination } };
};

/**
 * Return the shared independently reviewed generic contract.
 *
 * @param host - Closed host identity.
 */
export const genericSubtypeManagedWitReview = host => {
	assert.ok(genericSubtypeManagedWitHosts.includes(host));
	if(host === "jvm") return nominalSubtypeJvmReview("full", { genericCompositions: true });
	if(host === "php") return nominalSubtypePhpReview("full", { genericCompositions: true });
	return nominalSubtypeInstalledReview(false, { genericCompositions: true });
};

/**
 * Load one unchanged public caller and select route-specific diagnostic labels.
 *
 * @param host - Closed host identity.
 * @param route - Ordinary or independently reviewed author route.
 * @param profile - Java or Kotlin for the JVM lane.
 */
export const genericSubtypeManagedWitCaller = async (host, route, profile = null) => {
	assert.ok(genericSubtypeManagedWitHosts.includes(host)); assert.ok(genericSubtypeManagedWitRoutes.includes(route));
	if(host === "jvm") assert.ok(genericSubtypeJvmProfiles.includes(profile)); else assert.equal(profile, null);
	const name = host === "jvm" ? profile : host === "php" ? "php-native" : host === "wit" ? "wit-wasi" : host;
	const extension = host === "jvm" ? (profile === "java" ? "java" : "kt") : specifications[host].extension;
	let source = await readFile(`tests/fixtures/generic-subtype-consumers/${name}.${extension}`, "utf8");
	if(host === "wit")
	{
		const include = '#include "../nominal-subtype-consumers/wit-values.h"';
		assert.equal(source.split(include).length, 2);
		source = source.replace(include, await readFile("tests/fixtures/nominal-subtype-consumers/wit-values.h", "utf8"));
	}
	return route === "ordinary" ? source : source.replaceAll(/arg0/gu, "value0");
};

/**
 * Require the complete generic caller result.
 *
 * @param stdout - Original caller standard output.
 */
export const parseGenericSubtypeManagedWitResult = stdout => {
	const result = JSON.parse(stdout); assert.deepEqual(result, genericSubtypeManagedWitExpected); return result;
};
