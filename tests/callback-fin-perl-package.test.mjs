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
	assert.match(xs, new RegExp(`visit\\(\\.\\.\\.\\)[\\s\\S]+lb_read_${visitKey}_recovered\\(aTHX_ scope, ST\\(0\\)\\)`, "u"));
	const visitReader = xs.slice(xs.indexOf(`static lean_object * lb_read_${visitKey}(`), xs.indexOf(`static SV *lb_write_${visitKey}(`));
	assert.match(visitReader, /if \(SvROK\(value\) && SvTYPE\(SvRV\(value\)\) == SVt_PVCV\)/u);
	assert.match(xs, new RegExp(`lb_callback_recovery_${visitKey}_install\\(aTHX_ token, recovery\\)`, "u"));
	assert.match(xs, new RegExp(`lb_callback_recovery_${visitKey}_get\\(\\(lbp_callback \\*\\)context\\)`, "u"));
	assert.match(xs, /checked callback requires LeanBridge::FinCallbacks::Runtime::Callback->new/u);
	assert.ok(!xs.includes(`lb_t${digitsKey}_wrap(token)`));
	assert.ok(xs.includes(`lb_t${digitsKey}_call`));
	const scaler = model.exports.find(item => item.name === "Sample.scaler");
	const scalerKey = nativeTypeKey(scaler.result);
	const closureStart = xs.indexOf(`PACKAGE = LeanBridge::FinCallbacks::Closure${scalerKey}`);
	const closureEnd = xs.indexOf("XSRETURN(1);", closureStart);
	const closure = xs.slice(closureStart, closureEnd);
	assert.match(closure, /if \(!below\) croak\("%s", "arg0 is not below its Fin 10 bound"\)/u);
	assert.match(closure, /lean_object \*checked = lb_t[a-f0-9]+_call\(a0, a1\)/u);
	assert.match(closure, /if \(lean_is_scalar\(checked\)\) croak\("Lean rejected an argument outside its Fin bound"\)/u);
	assert.match(closure, /lean_object \*boxed = lean_ctor_get\(checked, 0\)/u);
	assert.ok(model.types.some(type => type.kind === "callback" && type.checked?.some(Boolean)));
	const pod = files["lib/LeanBridge/FinCallbacks.pm"];
	assert.match(pod, /package LeanBridge::FinCallbacks::Runtime::Callback;/u);
	assert.match(pod, /new expects code and recovery/u);
	assert.match(pod, /Checked Lean Fin bounds: arg0\.arg0 < 5\./u);
	assert.match(pod, /Checked Lean Fin bounds: result\.arg0 < 10\./u);
	assert.match(pod, /Synchronous host callbacks and returned Lean closures apply the same checks/u);
});
