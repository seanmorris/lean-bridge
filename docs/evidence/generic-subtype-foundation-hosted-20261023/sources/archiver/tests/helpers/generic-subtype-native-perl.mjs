/**
 * Independent installed-consumer selections for closed generic Subtype compositions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { nominalSubtypeInstalledConfiguration } from "./nominal-subtype-installed-fixture.mjs";
import { nominalSubtypePerlModule } from "./nominal-subtype-perl-fixture.mjs";

export const genericSubtypeRoutes = Object.freeze(["ordinary", "reviewed"]);
export const genericSubtypeNativeProfiles = Object.freeze(["c", "cpp"]);
export const genericSubtypeNativeExpected = Object.freeze({ c: 14, cpp: 12 });
export const genericSubtypePerlExpected = Object.freeze({ checks: 18, rejections: 3 });

const selection = (environment, prefix, profiles = false) => {
	const flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag), `Invalid ${prefix}TEST`);
	const select = (name, permitted) => {
		const raw = environment[prefix + name], selected = raw?.split(",") ?? permitted;
		if(raw !== undefined) assert.equal(flag, "1", `Explicit ${prefix}${name} requires TEST=1`);
		assert.ok(selected.length && selected.every(value => permitted.includes(value)), `Invalid ${prefix}${name}`);
		assert.equal(new Set(selected).size, selected.length, `Duplicate ${prefix}${name}`);
		return selected;
	};
	if(environment[prefix + "OUTPUT"] !== undefined) assert.equal(flag, "1", `Explicit ${prefix}OUTPUT requires TEST=1`);
	return { enabled: flag === "1"
		, routes: select("ROUTES", genericSubtypeRoutes)
		, ...profiles ? { profiles: select("PROFILES", genericSubtypeNativeProfiles) } : {} };
};

/**
 * Select complete C/C++ generic-composition installed checks.
 *
 * @param environment - Explicit environment, injectable by negative controls.
 */
export const genericSubtypeNativeSelection = environment =>
	selection(environment, "LEAN_BRIDGE_GENERIC_SUBTYPE_NATIVE_", true);

/**
 * Select complete four-ABI Perl generic-composition installed checks.
 *
 * @param environment - Explicit environment, injectable by negative controls.
 */
export const genericSubtypePerlSelection = environment =>
	selection(environment, "LEAN_BRIDGE_GENERIC_SUBTYPE_PERL_");

/**
 * Independent C or C++ caller with route-specific diagnostic labels.
 *
 * @param profile - C or C++.
 * @param route - Ordinary or reviewed author route.
 */
export const genericSubtypeNativeCaller = async (profile, route) => {
	assert.ok(genericSubtypeNativeProfiles.includes(profile));
	assert.ok(genericSubtypeRoutes.includes(route));
	const source = await readFile(`tests/fixtures/generic-subtype-consumers/${profile}.${profile}`, "utf8");
	return route === "ordinary" ? source : source.replaceAll(/arg0/gu, "value0");
};

/**
 * Independent Perl caller with route-specific diagnostic labels.
 *
 * @param route - Ordinary or reviewed author route.
 */
export const genericSubtypePerlCaller = async route => {
	assert.ok(genericSubtypeRoutes.includes(route));
	const source = await readFile("tests/fixtures/generic-subtype-consumers/perl.pl", "utf8");
	return route === "ordinary" ? source : source.replaceAll(/arg0/gu, "value0");
};

/**
 * Select the closed generic surface and CPAN delivery identity.
 *
 * @param route - Ordinary or reviewed author route.
 */
export const genericSubtypePerlConfiguration = route => ({
	...nominalSubtypeInstalledConfiguration(route, ["c"], false, { genericCompositions: true })
	, targets: { cpan: { module: nominalSubtypePerlModule, version: "1.000" } }
});

/**
 * Require the complete generic Perl caller result.
 *
 * @param stdout - Original complete caller output.
 */
export const parseGenericSubtypePerlResult = stdout => {
	const result = JSON.parse(stdout);
	assert.deepEqual(result, genericSubtypePerlExpected);
	return result;
};
