/**
 * Isolated XS instrumentation over verified package sources, never release files.
 *
 * @file
 */
import assert from "node:assert/strict";
import { nativeCType, nativeObjectType } from "../../src/build/native-model.mjs";

/**
 * Track active accessors, native entry and injected invalid helper tags.
 *
 * @param model - Original compiler-authenticated native model.
 * @param xs - Verified Component.xs bytes from the original archive.
 */
export const perlVariantProbe = (model, xs) => {
	const variants = model.types.filter(type => type.kind === "variant"), definitions = [], macros = [];
	assert.equal(variants.length, 7);
	for(const [index, type] of variants.entries())
	{
		const tag = `lb_t${type.key}_tag`, wrapper = `lb_test_tag_${type.key}`;
		definitions.push(`static uint32_t ${wrapper}(${nativeCType(type)} value) {
  uint32_t actual = ${tag}(value); return lb_test_invalid_tag == ${index + 1} ? UINT32_MAX : actual;
}`);
		macros.push(`#define ${tag} ${wrapper}`);
		for(const [branchIndex, branch] of type.cases.entries()) for(const [fieldIndex, field] of branch.fields.entries())
		{
			const name = `lb_t${type.key}_get${branchIndex}_${fieldIndex}`, checked = `lb_test_get_${type.key}_${branchIndex}_${fieldIndex}`;
			definitions.push(`static ${nativeCType(field.type)} ${checked}(${nativeCType(type)} value) {
  ${nativeObjectType(type) ? "lean_inc(value);" : ""} uint32_t actual = ${tag}(value);
  ++lb_test_getters; ++lb_test_total_getters; if (actual != ${branchIndex}) ++lb_test_wrong_getters;
  return ${name}(value);
}`);
			macros.push(`#define ${name} ${checked}`);
		}
	}
	for(const item of model.exports)
	{
		const wrapper = `lb_test_call_${item.symbol}`;
		definitions.push(`static ${nativeCType(item.result)} ${wrapper}(${item.parameters.map((p, i) => `${nativeCType(p.type)} a${i}`).join(", ")}) {
  ++lb_test_calls; return ${item.symbol}(${item.parameters.map((_, i) => `a${i}`).join(", ")});
}`);
		macros.push(`#define ${item.symbol} ${wrapper}`);
	}
	const marker = '#include "component.h"'; assert.equal(xs.split(marker).length, 2);
	return { families: variants.map((type, i) => ({ name: type.name.split(".").at(-1), index: i + 1 }))
		, source: xs.replace(marker, `${marker}\n#include "perl-probe.h"\nstatic UV lb_test_calls, lb_test_invalid_tag, lb_test_getters, lb_test_total_getters, lb_test_wrong_getters;\n${definitions.join("\n")}\n${macros.join("\n")}`) + `
MODULE = LeanBridge::Variants    PACKAGE = LeanBridge::Variants

void
_variant_probe(...)
  PPCODE:
    if (items != 1) croak("probe expects a failure index");
    UV previous = lb_test_count;
    lb_test_count = 0; lb_test_target = SvUV(ST(0)); lb_test_calls = 0;
    ST(0) = Perl_sv_2mortal(aTHX_ newSVuv(previous));
    XSRETURN(1);

void
_variant_tag_probe(...)
  PPCODE:
    if (items != 1) croak("probe expects a family index");
    UV previous = lb_test_getters;
    lb_test_getters = 0; lb_test_invalid_tag = SvUV(ST(0));
    ST(0) = Perl_sv_2mortal(aTHX_ newSVuv(previous));
    XSRETURN(1);

void
_variant_probe_state(...)
  PPCODE:
    AV *state = newAV();
    Perl_av_push(aTHX_ state, newSVuv(lb_test_calls));
    Perl_av_push(aTHX_ state, newSVuv(lb_test_total_getters));
    Perl_av_push(aTHX_ state, newSVuv(lb_test_wrong_getters));
    ST(0) = Perl_sv_2mortal(aTHX_ newRV_noinc((SV *)state));
    XSRETURN(1);
` };
};
