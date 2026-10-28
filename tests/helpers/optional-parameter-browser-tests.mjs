/**
 * Compiler-free controls for optional npm and browser acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	checkOptionalParameters
} from "../fixtures/optional-parameter-consumers/javascript.mjs";
import {
	optionalParameterBrowserExpected
	, optionalParameterBrowserPhases
	, optionalParameterBrowserProfiles
	, validateOptionalParameterBrowserObservation
	, validateOptionalParameterBrowserPhases
} from "./optional-parameter-browser.mjs";

/**
 * Build a one-parameter omission-aware test double.
 *
 * @param fallback - Value used only when no argument is supplied.
 * @param valid - Host-value validator.
 */
const optional = (fallback, valid) => {
	/**
	 * Apply the synthetic omission contract.
	 *
	 * @param value - Supplied host value.
	 */
	function call(value)
	{
		if(arguments.length === 0) value = structuredClone(fallback);
		if(!valid(value)) throw new TypeError("invalid optional value");
		return value;
	}
	return call;
};
/**
 * Validate the tagged JavaScript Option representation.
 *
 * @param value - Candidate host value.
 */
const option = value => value !== null && typeof value === "object"
	&& (value.tag === "none" && Object.keys(value).length === 1
		|| value.tag === "some" && Number.isInteger(value.value));
const model = {
	word: optional(7, value => Number.isInteger(value)
		&& value >= 0 && value <= 0xffffffff)
	, natural: optional(184467440737095516160n
		, value => typeof value === "bigint" && value >= 0n)
	, text: optional("Lean\nBridge", value => typeof value === "string")
	, character: optional("λ", value =>
		typeof value === "string" && [...value].length === 1)
	, maybe: optional({ tag: "none" }, option)
	, present: optional({ tag: "some", value: 9 }, option)
	, unitValue: optional(undefined, value => value === undefined)
};

test("the independent optional caller covers omission and explicit values", () => {
	assert.deepEqual(checkOptionalParameters(model), optionalParameterBrowserExpected);
});

test("browser observations bind every package realm and lifecycle phase", () => {
	const engines = ["chromium", "firefox", "webkit"];
	assert.deepEqual(optionalParameterBrowserProfiles
		, ["browser-javascript", "browser-react", "browser-worker"]);
	for(const profile of optionalParameterBrowserProfiles)
	{
		const observation = {
			schemaVersion: 1, profile, module: "optional-parameters"
			, realm: profile === "browser-worker" ? "dedicated-worker" : "window"
			, results: {
				module: "optional-parameters", ...optionalParameterBrowserExpected
			}
			, hostVersion: "test-browser"
		};
		const variants = profile === "browser-react"
			? ["production", "strict"] : ["production"];
		const phases = engines.flatMap(engine =>
			variants.flatMap(variant =>
				optionalParameterBrowserPhases(profile).map(phase => ({
					engine, variant, phase, observation
				}))
			)
		);
		validateOptionalParameterBrowserObservation(observation, profile);
		validateOptionalParameterBrowserPhases(phases, profile, engines);
		for(const mutate of [
			value => { value.results.checks--; }
			, value => { value.results.rejections--; }
			, value => { value.realm = "wrong"; }
			, value => { value.hostVersion = ""; }
		]) {
			const changed = structuredClone(observation); mutate(changed);
			assert.throws(() =>
				validateOptionalParameterBrowserObservation(changed, profile));
		}
	}
});
