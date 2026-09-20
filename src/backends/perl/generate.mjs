/**
 * Type-specific XS projection for checked native-library-v1 components.
 *
 * @file
 */
import { nativeCType, nativeObjectType, nativeTypeKey, validateNativeType, nativeCallbackDefault } from "../../build/native-model.mjs";
import { fixedPlatformInteger } from "../../abi/component-scalars.mjs";

const q = JSON.stringify;
const read = type => `lb_read_${nativeTypeKey(type)}`;
const write = type => `lb_write_${nativeTypeKey(type)}`;
const typeClass = (model, type) => type.kind === "callback"
	? `${model.moduleName}::Closure${nativeTypeKey(type)}`
	: `${model.moduleName}::${type.name.split(".").at(-1)}`;
const kind = (model, type) => {
	if(type.kind !== "resource") return `callback:${nativeTypeKey(type)}`;
	const source = model.sourceIdentity.modules.find(item => item.module === type.module);
	if(!source) throw new TypeError(`missing resource source identity: ${type.name}`);
	return `lean:${type.name}:${source.source.sha256}`;
};
const keep = expression => `lbp_keep(scope, ${expression})`;
const retain = (type, value) => nativeObjectType(type) ? `lean_inc(${value});` : "";
const unbox = (type, value) => {
	if(nativeObjectType(type)) return value;
	if(type.abi) return `((${nativeCType(type)})${type.abi.unbox}(${value}))`;
	if(["float32", "float64"].includes(type.name)) return `lean_unbox_${type.name === "float64" ? "float" : "float32"}(${value})`;
	if(type.name.endsWith("64")) return `lean_unbox_uint64(${value})`;
	if(type.name.endsWith("32")) return `lean_unbox_uint32(${value})`;
	return `((${nativeCType(type)})lean_unbox(${value}))`;
};
const box = (type, value) => {
	if(nativeObjectType(type)) return `(lean_inc(${value}), ${value})`;
	if(type.abi) return `${type.abi.box}(${value})`;
	if(["float32", "float64"].includes(type.name)) return `lean_box_${type.name === "float64" ? "float" : "float32"}(${value})`;
	if(type.name.endsWith("64")) return `lean_box_uint64(${value})`;
	if(type.name.endsWith("32")) return `lean_box_uint32(${value})`;
	return `lean_box(${value})`;
};

const fromPrimitive = type => {
	const name = fixedPlatformInteger(type.name, 64);
	if(name === "unit") return 'lbp_plain(aTHX_ value); if (SvOK(value)) croak("Unit requires undef"); return lean_box(0);';
	if(name === "bool") return 'lbp_plain(aTHX_ value); if (!SvIsBOOL(value)) croak("Bool requires true() or false()"); return SvTRUE(value) ? 1 : 0;';
	if(name === "char") return `
    lbp_plain(aTHX_ value); if (!SvPOK(value)) croak("Char requires a text scalar");
    STRLEN length, consumed; const U8 *bytes = (const U8 *)SvPVutf8(value, length);
    if (!length || length > 4 || !is_utf8_string_flags(bytes, length, UTF8_DISALLOW_SURROGATE | UTF8_DISALLOW_SUPER)) croak("Char requires one Unicode scalar");
    UV point = utf8_to_uvchr_buf(bytes, bytes + length, &consumed);
    if (consumed != length) croak("Char requires one Unicode scalar");
    return (uint32_t)point;`;
	if(/^uint/.test(name)) return `return (${nativeCType(type)})lbp_unsigned(aTHX_ value, UINT${name.match(/\d+/)[0]}_MAX);`;
	if(/^int\d/.test(name))
	{
		const bits = name.match(/\d+/)[0];
		return `return (uint${bits}_t)lbp_signed(aTHX_ value, INT${bits}_MIN, INT${bits}_MAX);`;
	}
	if(name === "float32" || name === "float64") return `lbp_plain(aTHX_ value); if (!SvNOK(value) && !SvIOK(value)) croak("Float requires a numeric scalar"); return (${nativeCType(type)})SvNV(value);`;
	if(name === "nat" || name === "int") return `
    SV *text = lbp_bigint_text(aTHX_ value, ${name === "nat" ? 1 : 0});
    STRLEN length; const char *bytes = SvPV(text, length); lbp_budget(scope, length);
    return ${keep(name === "nat" ? "lean_cstr_to_nat(bytes)" : "lb_native_int_parse(lean_mk_string_from_bytes(bytes, length))")};`;
	if(name === "string") return `
    lbp_plain(aTHX_ value); if (!SvPOK(value)) croak("String requires a text scalar");
    STRLEN length; const U8 *bytes = (const U8 *)SvPVutf8(value, length); lbp_budget(scope, length);
    if (!is_utf8_string_flags(bytes, length, UTF8_DISALLOW_SURROGATE | UTF8_DISALLOW_SUPER)) croak("String contains invalid Unicode");
    return ${keep("lean_mk_string_from_bytes((const char *)bytes, length)")};`;
	if(name === "bytes") return `
    lbp_plain(aTHX_ value); if (!SvPOK(value) || SvUTF8(value)) croak("ByteArray requires an octet string, not Unicode text");
    STRLEN length; const char *bytes = SvPV(value, length); lbp_budget(scope, length);
    lean_object *result = ${keep("lean_alloc_sarray(1, length, length)")};
    memcpy(lean_sarray_cptr(result), bytes, length); return result;`;
	throw new TypeError(`unsupported Perl scalar ${name}`);
};
const toPrimitive = type => {
	const name = fixedPlatformInteger(type.name, 64);
	if(name === "unit") return "return &PL_sv_undef;";
	if(name === "bool") return "return boolSV(value != 0);";
	if(name === "char") return `
    if (value > 0x10ffff || (value >= 0xd800 && value <= 0xdfff)) croak("Invalid native Unicode scalar");
    U8 bytes[UTF8_MAXBYTES]; U8 *end = uvchr_to_utf8(bytes, value);
    SV *result = lbp_mortal(newSVpvn((const char *)bytes, end - bytes)); SvUTF8_on(result); return result;`;
	if(name.startsWith("uint")) return "return lbp_mortal(newSVuv(value));";
	if(/^int\d/.test(name)) return `return lbp_mortal(newSViv((int${name.match(/\d+/)[0]}_t)value));`;
	if(name === "float32" || name === "float64") return "return lbp_mortal(newSVnv(value));";
	if(name === "nat" || name === "int") return `
    lean_inc(value); lean_object *text = ${keep(`lb_native_${name}_text(value)`)};
    size_t length = lean_string_size(text) - 1; lbp_budget(scope, length);
    return lbp_bigint_from_text(aTHX_ lean_string_cstr(text), length);`;
	if(name === "string") return `
    size_t length = lean_string_size(value) - 1; lbp_budget(scope, length);
    SV *result = lbp_mortal(newSVpvn(lean_string_cstr(value), length)); SvUTF8_on(result); return result;`;
	if(name === "bytes") return `
    size_t length = lean_sarray_size(value); lbp_budget(scope, length);
    return lbp_mortal(newSVpvn((const char *)lean_sarray_cptr(value), length));`;
	throw new TypeError(`unsupported Perl scalar ${name}`);
};

const conversion = (model, type) => {
	let from, to;
	if(type.kind === "primitive")
	{ from = fromPrimitive(type); to = toPrimitive(type); }
	if(type.kind === "option" || type.kind === "result")
	{
		const optional = type.kind === "option";
		const branches = optional ? [["Some", type.element, "some"]] : [["Ok", type.arguments[0], "ok"], ["Err", type.arguments[1], "error"]];
		from = `
      SvGETMAGIC(value); lbp_budget(scope, sizeof(void *));
      ${optional ? `if (!SvOK(value)) return ${keep(`lb_t${type.key}_none(lean_box(0))`)};` : ""}
      ${branches.map(([branch, child, constructor]) => `if (lbp_is_branch(value, ${q(`${model.moduleName}::${branch}`)})) {
        ${nativeCType(child)} item = ${read(child)}(aTHX_ scope, lbp_branch_value(aTHX_ value, ${q(`${model.moduleName}::${branch}`)}));
        ${retain(child, "item")}
        return ${keep(`lb_t${type.key}_${constructor}(item)`)};
      }`).join("\n      ")}
      croak("${optional ? "Option requires undef or the generated Some class" : "Except requires the generated Ok or Err class"}");`;
		to = `
      lbp_budget(scope, sizeof(void *));
      ${retain(type, "value")} uint8_t present = lb_t${type.key}_has(value);
      ${optional ? "if (!present) return &PL_sv_undef;" : ""}
      ${branches.map(([branch, child], i) => `${optional ? "" : i === 0 ? "if (present)" : "else"} {
        ${retain(type, "value")} ${nativeCType(child)} item = lb_t${type.key}_get${i}(value);
        ${nativeObjectType(child) ? "lbp_keep(scope, item);" : ""}
        return lbp_branch(aTHX_ ${q(`${model.moduleName}::${branch}`)}, ${write(child)}(aTHX_ scope, item));
      }`).join("\n      ")}`;
	}
	if(type.kind === "tuple")
	{
		from = `
      SvGETMAGIC(value);
      if (!SvROK(value) || SvTYPE(SvRV(value)) != SVt_PVAV || SvOBJECT(SvRV(value)) || SvMAGICAL(SvRV(value))) croak("Prod requires a plain two-element array reference");
      AV *input = (AV *)sv_2mortal(SvREFCNT_inc(SvRV(value)));
      if (av_count(input) != 2) croak("Prod requires exactly two elements");
      lbp_budget(scope, 2 * sizeof(void *));
      /* Pin both slots before a child converter can invoke Perl code. */
      SV **entry0 = av_fetch(input, 0, 0); if (!entry0) croak("sparse Perl products are unsupported");
      SV *slot0 = sv_2mortal(SvREFCNT_inc(*entry0));
      SV **entry1 = av_fetch(input, 1, 0); if (!entry1) croak("sparse Perl products are unsupported");
      SV *slot1 = sv_2mortal(SvREFCNT_inc(*entry1));
      ${type.arguments.map((child, i) => `${nativeCType(child)} a${i} = ${read(child)}(aTHX_ scope, slot${i});`).join("\n      ")}
      ${type.arguments.map((child, i) => retain(child, `a${i}`)).join(" ")}
      return ${keep(`lb_t${type.key}_make(a0, a1)`)};`;
		to = `
      lbp_budget(scope, 2 * sizeof(void *));
      AV *output = (AV *)sv_2mortal((SV *)newAV());
      ${type.arguments.map((child, i) => `${retain(type, "value")} ${nativeCType(child)} a${i} = lb_t${type.key}_get${i}(value);
      ${nativeObjectType(child) ? `lbp_keep(scope, a${i});` : ""}
      av_push(output, SvREFCNT_inc(${write(child)}(aTHX_ scope, a${i})));`).join("\n      ")}
      return lbp_mortal(newRV_inc((SV *)output));`;
	}
	if(type.kind === "array")
	{
		from = `
      if (!SvROK(value) || SvTYPE(SvRV(value)) != SVt_PVAV) croak("Array requires an array reference");
      AV *array = (AV *)sv_2mortal(SvREFCNT_inc(SvRV(value))); size_t length = av_count(array);
      if (length > 16 * 1024 * 1024 / sizeof(void *)) croak("native copied array exceeds the 16 MiB per-call limit");
      lbp_budget(scope, length * sizeof(void *));
      lean_object *result = lean_alloc_array(length, length);
      /* Registration can fail and release result; every slot must already be valid. */
      for (size_t i = 0; i < length; ++i) lean_array_set_core(result, i, lean_box(0));
      lbp_keep(scope, result);
      for (size_t i = 0; i < length; ++i) {
        SV **entry = av_fetch(array, i, 0); if (!entry) croak("sparse Perl arrays are unsupported");
        ${nativeCType(type.element)} item = ${read(type.element)}(aTHX_ scope, sv_2mortal(SvREFCNT_inc(*entry)));
        lean_array_set_core(result, i, ${box(type.element, "item")});
      }
      return result;`;
		to = `
      size_t length = lean_array_size(value);
      if (length > 16 * 1024 * 1024 / sizeof(void *)) croak("native copied array exceeds the 16 MiB per-call limit");
      lbp_budget(scope, length * sizeof(void *));
      AV *array = (AV *)sv_2mortal((SV *)newAV());
      for (size_t i = 0; i < length; ++i) {
        SV *item = ${write(type.element)}(aTHX_ scope, ${unbox(type.element, "lean_array_get_core(value, i)")});
        av_push(array, SvREFCNT_inc(item));
      }
      return lbp_mortal(newRV_inc((SV *)array));`;
	}
	if(type.kind === "record")
	{
		const packageName = typeClass(model, type);
		from = `
      if (!SvROK(value) || SvTYPE(SvRV(value)) != SVt_PVHV || !sv_derived_from(value, ${q(packageName)})) croak("expected ${packageName}");
      if (HvUSEDKEYS((HV *)SvRV(value)) != ${type.fields.length}) croak("record fields do not match the generated schema");
      HV *input = (HV *)sv_2mortal(SvREFCNT_inc(SvRV(value)));
      lbp_budget(scope, ${type.fields.length} * sizeof(void *));
      ${type.fields.map((field, i) => `${nativeCType(field.type)} a${i} = ${read(field.type)}(aTHX_ scope, lbp_field(aTHX_ input, ${q(field.name)}, ${field.name.length}));`).join("\n      ")}
      ${type.fields.map((field, i) => retain(field.type, `a${i}`)).join(" ")}
      return ${nativeObjectType(type) ? "lbp_keep(scope, " : ""}lb_t${type.key}_make(${type.fields.map((_, i) => `a${i}`).join(", ") || "lean_box(0)"})${nativeObjectType(type) ? ")" : ""};`;
		to = `
      lbp_budget(scope, ${type.fields.length} * sizeof(void *));
      HV *record = (HV *)sv_2mortal((SV *)newHV());
      ${type.fields.map((field, i) => `${retain(type, "value")} ${nativeCType(field.type)} a${i} = lb_t${type.key}_get${i}(value);
      ${nativeObjectType(field.type) ? `lbp_keep(scope, a${i});` : ""}
      hv_store(record, ${q(field.name)}, ${field.name.length}, SvREFCNT_inc(${write(field.type)}(aTHX_ scope, a${i})), 0);`).join("\n      ")}
      return sv_bless(lbp_mortal(newRV_inc((SV *)record)), gv_stashpv(${q(packageName)}, GV_ADD));`;
	}
	if(type.kind === "resource" || type.kind === "callback")
	{
		from = `return lbp_borrow(aTHX_ scope, value, ${q(kind(model, type))});`;
		if(type.kind === "callback") from = `
      if (SvROK(value) && SvTYPE(SvRV(value)) == SVt_PVCV) {
        uint64_t token = lbp_callback_new(aTHX_ scope, value, get_cv(${q(`${model.moduleName}::_callback_${type.key}`)}, 0), (void (*)(void))lb_callback_${type.key});
        return ${keep(`lb_t${type.key}_wrap(token)`)};
      }
      ${from}`;
		to = `return lbp_resource(aTHX_ value, ${q(kind(model, type))}, ${q(typeClass(model, type))});`;
	}
	return `static ${nativeCType(type)} ${read(type)}(pTHX_ lbp_scope *scope, SV *value) {\n${from}\n}\nstatic SV *${write(type)}(pTHX_ lbp_scope *scope, ${nativeCType(type)} value) {\n${to}\n}\n`;
};

const scalarFastType = type => type.kind === "primitive" && !["nat", "int", "string", "bytes"].includes(type.name);
const publicXsub = (name, symbol, parameters, result) => {
	if([...parameters, result].every(scalarFastType)) return `
void
${name}(...)
  PPCODE:
    if (items != ${parameters.length}) croak("${name} expects ${parameters.length} arguments");
    lbp_check_interpreter(aTHX);
    ${parameters.map((type, i) => `${nativeCType(type)} a${i} = ${read(type)}(aTHX_ NULL, ST(${i}));`).join("\n    ")}
    ${nativeCType(result)} result = ${symbol}(${parameters.map((_, i) => `a${i}`).join(", ") || "lean_box(0)"});
    ST(0) = ${write(result)}(aTHX_ NULL, result);
    XSRETURN(1);
`;
	return `
void
${name}(...)
  PPCODE:
    if (items != ${parameters.length}) croak("${name} expects ${parameters.length} arguments");
    LBP_ENTER();
    ${parameters.map((type, i) => `${nativeCType(type)} a${i} = ${read(type)}(aTHX_ scope, ST(${i}));`).join("\n    ")}
    ${parameters.map((type, i) => retain(type, `a${i}`)).join(" ")}
    ${nativeCType(result)} result = ${symbol}(${parameters.map((_, i) => `a${i}`).join(", ") || "lean_box(0)"});
    ${nativeObjectType(result) ? "lbp_keep(scope, result);" : ""}
    lbp_finish(aTHX_ scope);
    SV *out = SvREFCNT_inc(${write(result)}(aTHX_ scope, result));
    LBP_LEAVE();
    ST(0) = sv_2mortal(out);
    XSRETURN(1);
`;
};

/**
 * Check Perl admission and namespace collisions before native linking.
 *
 * @param model - Compiler-checked native model and Binding IR.
 */
export const validatePerlModel = model => {
	if(model?.profile !== "native-library-v1" || model.pointerBits !== 64) throw new TypeError("Perl requires the checked native-library-v1 model");
	const containsCompound = type => ["option", "result", "tuple"].includes(type.kind)
		|| (type.kind === "array" && containsCompound(type.element))
		|| (type.kind === "record" && type.fields.some(field => containsCompound(field.type)));
	model.types.forEach(({ key, ...type }) => {
    validateNativeType(type);
    if(type.kind === "callback" && [...type.parameters, type.result].some(containsCompound))
      throw Object.assign(new TypeError("Perl compound callbacks are not implemented"), { code: "unsupported-perl-signature" });
    if(key !== nativeTypeKey(type)) throw new TypeError("native type identity changed");
	});
	const branches = [...(model.types.some(type => type.kind === "option") ? ["Some"] : [])
		, ...(model.types.some(type => type.kind === "result") ? ["Ok", "Err"] : [])];
	const classes = new Set(branches.map(name => `${model.moduleName}::${name}`));
	for(const type of model.types.filter(type => ["record", "resource", "callback"].includes(type.kind)))
	{
		const name = typeClass(model, type);
		if(classes.has(name)) throw new TypeError(`Perl class name collision: ${name}`);
		classes.add(name);
	}
	return branches;
};

/**
 * Generate public functions and private XS converters from canonical native metadata.
 *
 * @param model - Compiler-checked native model and Binding IR.
 * @param receipt - Native compilation receipt with exact library and runtime identities.
 */
export const generatePerlBindingPackage = (model, receipt) => {
	const branches = validatePerlModel(model);
	const lines = ['#include "runtime.h"', '#include "component.h"', ""];
	for(const type of model.types.filter(t => t.kind === "callback"))
	{
		lines.push(`typedef struct { ${type.parameters.map((p, i) => `${nativeCType(p)} argument${i};`).join(" ")} ${nativeCType(type.result)} result; int returned; } lb_callback_frame_${type.key};`);
		lines.push(`static ${nativeCType(type.result)} lb_callback_${type.key}(void *context, ${type.parameters.map((p, i) => `${nativeCType(p)} argument${i}`).join(", ")});`);
	}
	for(const type of model.types) lines.push(conversion(model, type));
	for(const type of model.types.filter(t => t.kind === "callback"))
	{
		// Default return values are created by Lean's generated representation-safe helpers.
		// Failure remains pending until the initiating exported call returns.
		const fallback = nativeCallbackDefault(type.result);
		lines.push(`static ${nativeCType(type.result)} lb_callback_${type.key}(void *context, ${type.parameters.map((p, i) => `${nativeCType(p)} argument${i}`).join(", ")}) {
      lb_callback_frame_${type.key} frame = { ${type.parameters.map((_, i) => `.argument${i} = argument${i}`).join(", ")} };
      int ok = lbp_callback_invoke((lbp_callback *)context, &frame);
      ${type.parameters.map((p, i) => nativeObjectType(p) ? `lean_dec(argument${i});` : "").join(" ")}
      if (!ok || !frame.returned) return ${fallback};
      return frame.result;
    }`);
	}
	lines.push(`MODULE = ${model.moduleName}    PACKAGE = ${model.moduleName}`, "PROTOTYPES: DISABLE", "");
	for(const item of model.exports) lines.push(publicXsub(item.publicName, item.symbol, item.parameters.map(p => p.type), item.result));
	for(const type of model.types.filter(t => t.kind === "callback"))
	{
		lines.push(`
void
_callback_${type.key}(...)
  PPCODE:
    lbp_invocation *invocation = lbp_callback_current(aTHX);
    if (invocation->callback->invoker != cv) croak("wrong generated callback converter");
    lb_callback_frame_${type.key} *frame = invocation->frame;
    LBP_ENTER();
    ${type.parameters.map((p, i) => `SV *argument${i} = ${write(p)}(aTHX_ scope, frame->argument${i});`).join("\n    ")}
    SPAGAIN;
    PUSHMARK(SP); ${type.parameters.map((_, i) => `XPUSHs(argument${i});`).join(" ")} PUTBACK;
    int count = call_sv(invocation->callback->code, G_SCALAR);
    SPAGAIN;
    if (count != 1) croak("host callback must return one value");
    SV *returned = POPs;
    frame->result = ${read(type.result)}(aTHX_ scope, returned);
    ${retain(type.result, "frame->result")}
    frame->returned = 1;
    SPAGAIN;
    PUTBACK;
    LBP_LEAVE();
    XSRETURN_EMPTY;
`);
	}
	for(const type of model.types.filter(t => t.kind === "callback"))
	{
		lines.push(`MODULE = ${model.moduleName}    PACKAGE = ${typeClass(model, type)}`, publicXsub("call", `lb_t${type.key}_call`, [type, ...type.parameters], type.result));
	}
	lines.push(`BOOT:\n  lbp_check_interpreter(aTHX);\n  extern lean_object *${receipt.initializer}(uint8_t);\n  if (!lean_bridge_native_component_initialize(${q(`${model.component.id}:${receipt.nativeLibrary.sha256}`)}, (lean_bridge_native_initializer)${receipt.initializer})) croak("Lean component initialization failed");\n`);
	const pm = [`package ${model.moduleName};`
		, "use strict;"
		, "use warnings;"
		, "use Math::BigInt;"
		, "use LeanBridge::Runtime;"
		, "use XSLoader;"
		, `our $VERSION = '0.001';`
		, `LeanBridge::Runtime::_load_component(__FILE__, ${q(receipt.library)}, ${q(receipt.nativeLibrary.sha256)}, ${q(receipt.runtimeIdentity)}, { ${model.sourceIdentity.modules.map(item => `${q(item.module)} => ${q(item.source.sha256)}`).join(", ")} });`
		, `XSLoader::load(__PACKAGE__, $VERSION);`
		, "sub true () { !!1 }"
		, "sub false () { !!0 }"
		, "sub CLONE_SKIP { 1 }"
		, ""];
	for(const branch of branches)
	{
		const name = `${model.moduleName}::${branch}`;
		pm.push(`package ${name};`, "sub new {"
			, `  die "${name}->new expects one payload\\n" unless @_ == 2 && $_[0] eq '${name}';`
			, `  return bless { value => $_[1] }, '${name}';`, "}"
			, "sub value { $_[0]->{value} }", "");
	}
	for(const type of model.types.filter(t => ["record", "resource", "callback"].includes(t.kind)))
	{
		pm.push(`package ${typeClass(model, type)};`);
		if(type.kind === "record")
		{
			pm.push("sub new {", "  my ($class, %fields) = @_;", `  my @required = qw(${type.fields.map(f => f.name).join(" ")});`,
				'  die "record fields do not match the generated schema\\n" if keys(%fields) != @required || grep { !exists $fields{$_} } @required;',
				"  return bless \\%fields, $class;", "}");
			for(const field of type.fields) pm.push(`sub ${field.name} { $_[0]->{${field.name}} }`);
		} else pm.push("our @ISA = ('LeanBridge::Runtime::Resource');", "sub CLONE_SKIP { 1 }");
	}
	pm.push("1;", "", "__END__", "=head1 NAME", "", `${model.moduleName} - Generated functions from ${model.component.name}`, "", "=head1 API", "");
	for(const item of model.exports) pm.push(`=head2 ${item.publicName}`, "", `Calls C<${item.name}> in the compiled Lean component.`, "");
	if(branches.length) pm.push("=head1 COPIED VALUES", ""
		, "Option uses undef for None and Some->new($value) for Some, including Some->new(undef). Unit uses undef. Except uses distinct Ok->new($value) and Err->new($value) objects; ->value returns the payload. Branch classes live under this component's namespace. Prod uses a plain two-element array reference; nested pairs stay nested."
		, "", "Branches are mutable one-field hashes. Calls check the exact class and field set, reject tied branches and products, and copy their contents. Returned arrays, records and payloads are independent of input values. Perl reference equality is not deep value equality. The shared per-call copied-value limit is 16 MiB; schema nesting is limited to 32 levels. Compound callbacks and resources inside copied values are unsupported.", "");
	pm.push("=head1 OWNERSHIP", "", "Close resource and closure objects when finished. Host callbacks are synchronous and may not be retained by Lean.", "", "=cut", "");
	const publicModule = `lib/${model.moduleName.replaceAll("::", "/")}.pm`;
	return {
		"Component.xs": `${lines.join("\n")}\n`
		, [publicModule]: pm.join("\n")
		, "binding-manifest.json": JSON.stringify({
			schemaVersion: 1
			, backend: "perl"
			, profile: "native-library-v1"
			, bindingIrSha256: model.bindingIrSha256
			, publicModule
			, runtimeIdentity: receipt.runtimeIdentity
		}, null, 2) + "\n"
	};
};
