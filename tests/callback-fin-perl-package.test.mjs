/**
 * Source-only admission for checked callback annotations in CPAN packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { generatePerlBindingPackage, validatePerlModel } from "../src/backends/perl/generate.mjs";
import { nativeTypeKey } from "../src/build/native-model.mjs";
import { finCallbackCompilerModel } from "./helpers/fin-callback-model.mjs";

const receipt = {
	library: "libcomponent.so"
	, nativeLibrary: { sha256: "b".repeat(64) }
	, runtimeIdentity: "c".repeat(64)
	, initializer: "initialize_FinCallbacks"
};

test("Perl admits compiler-checked callback Fin annotations without widening its native schema", () => {
	const model = finCallbackCompilerModel();
	assert.ok(model.types.some(type => type.checked !== undefined));
	assert.doesNotThrow(() => validatePerlModel(model));
	const malformed = structuredClone(model);
	malformed.types[0].unexpectedRepresentationField = true;
	assert.throws(() => validatePerlModel(malformed), /invalid native type fields/u);
});

test("Perl leaves outer callback refinements to the generated callable adapters", () => {
	const compiled = finCallbackCompilerModel();
	const model = {
		...compiled, moduleName: "LeanBridge::FinCallbacks"
		, exports: compiled.exports.map(item => ({
			...item, publicName: item.name.split(".").at(-1)
		}))
	};
	const files = generatePerlBindingPackage(model, receipt);
	const xs = files["Component.xs"];
	const visit = model.exports.find(item => item.name === "Sample.visit");
	const digits = model.exports.find(item => item.name === "Sample.digits");
	const visitKey = nativeTypeKey(visit.parameters[0].type);
	const digitsKey = nativeTypeKey(digits.result);
	assert.match(xs, /lb_callback_[a-f0-9]+\(void \*context,/u);
	assert.match(xs, /lbp_callback_invoke\(\(lbp_callback \*\)context, &frame\)/u);
	assert.match(xs, new RegExp(`\\nvisit\\(\\.\\.\\.\\)[\\s\\S]+${visit.symbol}\\(`, "u"));
	assert.ok(xs.includes(`lb_t${visitKey}_wrap(token)`));
	assert.ok(!xs.includes(`lb_t${digitsKey}_wrap(token)`));
	assert.ok(xs.includes(`lb_t${digitsKey}_call`));
	assert.ok(model.types.some(type => type.kind === "callback" && type.checked?.some(Boolean)));
	const pod = files["lib/LeanBridge/FinCallbacks.pm"];
	assert.match(pod, /Checked Lean Fin bounds: arg0\.arg0 < 5\./u);
	assert.match(pod, /Checked Lean Fin bounds: result\.arg0 < 10\./u);
	assert.match(pod, /Synchronous host callbacks and returned Lean closures apply the same checks/u);
});
