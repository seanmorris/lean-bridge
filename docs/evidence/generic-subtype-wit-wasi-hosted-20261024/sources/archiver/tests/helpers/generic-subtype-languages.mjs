/**
 * Independent selections and callers for generic Subtypes in Python, Ruby and Rust.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { nominalSubtypeInstalledConfiguration } from "./nominal-subtype-installed-fixture.mjs";

export const genericSubtypeLanguageRoutes = Object.freeze(["ordinary", "reviewed"]);
export const genericSubtypeLanguageExpected = Object.freeze({ checks: 18, rejections: 3 });

const specification = Object.freeze({
	python: { prefix: "LEAN_BRIDGE_GENERIC_SUBTYPE_PYTHON_", target: "pypi"
		, destination: { name: "nominalsubtypes", version: "1.0.0" } }
	, ruby: { prefix: "LEAN_BRIDGE_GENERIC_SUBTYPE_RUBY_", target: "rubygems"
		, destination: { name: "nominalsubtypes", version: "1.0.0" } }
	, rust: { prefix: "LEAN_BRIDGE_GENERIC_SUBTYPE_RUST_", target: "cargo"
		, destination: { name: "nominalsubtypes", version: "1.0.0" } }
});

/**
 * Select one complete generic-Subtype language lane.
 *
 * @param language - Python, Ruby or Rust.
 * @param environment - Explicit environment, injectable by negative controls.
 */
export const genericSubtypeLanguageSelection = (language, environment) => {
	assert.ok(Object.hasOwn(specification, language));
	const { prefix } = specification[language], flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag), `Invalid generic Subtype ${language} TEST`);
	const raw = environment[prefix + "ROUTES"], routes = raw?.split(",") ?? genericSubtypeLanguageRoutes;
	if(raw !== undefined) assert.equal(flag, "1", `Explicit generic Subtype ${language} routes require TEST=1`);
	assert.ok(routes.length && routes.every(route => genericSubtypeLanguageRoutes.includes(route)));
	assert.equal(new Set(routes).size, routes.length);
	if(environment[prefix + "OUTPUT"] !== undefined) assert.equal(flag, "1");
	if(language === "python" && environment.LEAN_BRIDGE_GENERIC_SUBTYPE_PYTHONS !== undefined)
		assert.equal(flag, "1", "Explicit generic Subtype Python interpreters require TEST=1");
	return { enabled: flag === "1", routes };
};

/**
 * Author the common closed generic surface for one package ecosystem.
 *
 * @param language - Python, Ruby or Rust.
 * @param route - Ordinary or reviewed author route.
 */
export const genericSubtypeLanguageConfiguration = (language, route) => {
	assert.ok(Object.hasOwn(specification, language));
	const item = specification[language];
	return { ...nominalSubtypeInstalledConfiguration(route, ["c"], false, { genericCompositions: true })
		, targets: { [item.target]: item.destination } };
};

/**
 * Load the independent caller and select route-specific diagnostic labels.
 *
 * @param language - Python, Ruby or Rust.
 * @param route - Ordinary or reviewed author route.
 */
export const genericSubtypeLanguageCaller = async (language, route) => {
	assert.ok(Object.hasOwn(specification, language)); assert.ok(genericSubtypeLanguageRoutes.includes(route));
	const extensions = { python: "py", ruby: "rb", rust: "rs" };
	const source = await readFile(`tests/fixtures/generic-subtype-consumers/${language}.${extensions[language]}`, "utf8");
	return route === "ordinary" ? source : source.replaceAll(/arg0/gu, "value0");
};

/**
 * Require the complete generic caller result.
 *
 * @param stdout - Original process stdout.
 */
export const parseGenericSubtypeLanguageResult = stdout => {
	const result = JSON.parse(stdout); assert.deepEqual(result, genericSubtypeLanguageExpected);
	return result;
};
