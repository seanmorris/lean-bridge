/**
 * Exact, bounded XS defects for callback-result semantic negative controls.
 *
 * @file
 */
import assert from "node:assert/strict";
import { sha256 } from "../../src/capsule/node.mjs";

/**
 * Construct independently named defects without changing the native producer.
 *
 * @param source - Complete original instrumented XS translation unit.
 * @param model - Generated Perl model with concrete callback and value indices.
 */
export const ownedPerlCallbackMutations = (source, model) => {
	const bundle = model.types.find(node => node.id === "lean:Owned.Bundle");
	const tree = model.types.find(node => node.id === "lean:Owned.Tree");
	const callback = model.c.callbacks.find(fn => fn.result === bundle.id && fn.parameters.length === 2 && fn.anchor === 1);
	assert.ok(bundle && tree && callback);
	const closure = model.types.find(node => node.id === callback.id);
	const nativeCall = `    uint32_t status = ${callback.cName}(lpo_state.session, input0, &input1, input_owner1->result, &returned, &owner->result);\n    lpo_finish_frame(aTHX_ frame, status);\n    lpo_anchor_owner(aTHX_ owner, input_owner1);`;
	const wrongOwner = `lpo_get_fetched(aTHX_ argument0, ${closure.index})->owner`;
	const valueGuard = `static lpo_wrapper *lpo_value_require(pTHX_ SV *value, size_t type) {\n  lpo_wrapper *wrapper = lpo_value_wrapper(aTHX_ value, type);\n  if (lpo_closed(wrapper) || !wrapper->payload) lpo_status(aTHX_ 4);\n  return wrapper;\n}`;
	const emptyGuard = `static lpo_wrapper *lpo_value_require(pTHX_ SV *value, size_t type) {\n  lpo_wrapper *wrapper = lpo_value_wrapper(aTHX_ value, type);\n  SV **children = wrapper->type == ${tree.index} && wrapper->payload && SvROK(wrapper->payload)\n    && SvTYPE(SvRV(wrapper->payload)) == SVt_PVHV\n    ? hv_fetch((HV *)SvRV(wrapper->payload), "children", 8, 0) : NULL;\n  int empty_tree = children && SvROK(*children) && SvTYPE(SvRV(*children)) == SVt_PVAV\n    && av_len((AV *)SvRV(*children)) == -1;\n  if ((!empty_tree && lpo_closed(wrapper)) || !wrapper->payload) lpo_status(aTHX_ 4);\n  return wrapper;\n}`;
	const marker = `_owned_callback_${closure.index}(...)\n`;
	assert.equal(source.split(marker).length, 2);
	const converter = marker + source.split(marker)[1].split("\nvoid\n")[0];
	const unwrap = `lpo_read${bundle.index}(aTHX_ scope, lpo_callback_value(aTHX_ scope, returned, ${bundle.index}, 0), &input, 0, 1);`;
	assert.equal(converter.split(unwrap).length, 2);
	const definitions = [
		{
			name: "closure-owner-instead-of-original-argument"
			, before: nativeCall
			, after: nativeCall.replace("input_owner1->result", `${wrongOwner}->result`).replace("owner, input_owner1", `owner, ${wrongOwner}`)
			, semantic: { name: "callback-original-owner-must-match-argument", pattern: "^Lean ownership failed \\(status=1\\): invalid argument at consumer\\.pl line 70\\.$" }
		}
		, {
			name: "expired-empty-whole-value-validity-bypass"
			, before: valueGuard, after: emptyGuard
			, semantic: { name: "expired-empty-tree-get-must-reject", pattern: "^callback-result check 31: expected [^\\n]*status=4[^\\n]*; got[ \\t]*$" }
		}
		, {
			name: "host-callback-frame-escape"
			, before: "if (!owner->published || owner->borrowed) {"
			, after: "if (!owner->published && !owner->borrowed) {"
			, semantic: { name: "host-callback-argument-borrow-expires", pattern: "^callback-result check 38: host callback argument borrow expires$" }
		}
		, {
			name: "omitted-whole-host-reply-unwrap"
			, before: converter
			, after: converter.replace(unwrap, `lpo_read${bundle.index}(aTHX_ scope, returned, &input, 0, 1);`)
			, semantic: { name: "whole-bundle-reply-needs-unwrap", pattern: "^Expected exact LeanBridge::OwnedProbe::Bundle with a plain untied hash(?: at [^\\n]+)?$" }
		}
	];
	return definitions.map(definition => {
		const occurrences = source.split(definition.before).length - 1;
		assert.equal(occurrences, 1, definition.name);
		assert.notEqual(definition.before, definition.after);
		const mutated = source.replace(definition.before, definition.after);
		return { ...definition, occurrences, source: mutated, sourceSha256: sha256(mutated) };
	});
};
