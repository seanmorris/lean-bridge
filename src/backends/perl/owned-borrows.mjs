/**
 * Whole Perl owners preserve empty values and the original borrowed-result anchor.
 *
 * @file
 */
import { perlStringLiteral as q } from "./naming.mjs";

export const ownedPerlBorrowRuntime = `
static void *lpo_leaf_borrow(pTHX_ SV *value, size_t type) {
  lpo_wrapper *wrapper = lpo_get_fetched(aTHX_ value, type);
  if (wrapper->is_value) lpo_status(aTHX_ 1);
  if (lpo_closed(wrapper)) lpo_status(aTHX_ 4);
  lpo_pin_owner(aTHX_ wrapper->owner);
  return wrapper->handle;
}
static lpo_wrapper *lpo_value_wrapper(pTHX_ SV *value, size_t type) {
  lpo_wrapper *wrapper = lpo_get(aTHX_ value, type);
  if (!wrapper->is_value) croak("Expected a generated Value owner");
  return wrapper;
}
static lpo_wrapper *lpo_value_require(pTHX_ SV *value, size_t type) {
  lpo_wrapper *wrapper = lpo_value_wrapper(aTHX_ value, type);
  if (lpo_closed(wrapper) || !wrapper->payload) lpo_status(aTHX_ 4);
  return wrapper;
}
static SV *lpo_value_input(pTHX_ SV *value, size_t type, lpo_owner **owner) {
  lpo_wrapper *wrapper = lpo_value_require(aTHX_ value, type);
  lpo_pin_owner(aTHX_ wrapper->owner);
  *owner = wrapper->owner;
  return lpg_pin(aTHX_ wrapper->payload);
}
static SV *lpo_wrap_value(pTHX_ lpg_scope *scope, lpo_owner *owner,
    SV *payload, size_t type, const char *package) {
  if (owner->values == SIZE_MAX) lpo_status(aTHX_ 2);
  /* The private wrapper owns the payload, never a user-visible hash field. */
  SV *value = lpo_wrap(aTHX_ scope, owner, (void *)owner, type, package);
  lpo_wrapper *wrapper = lpo_get_fetched(aTHX_ value, type);
  wrapper->is_value = 1; wrapper->payload = SvREFCNT_inc(payload);
  owner->whole = 1; ++owner->values;
  return value;
}
static void lpo_anchor_owner(pTHX_ lpo_owner *owner, lpo_owner *anchor) {
  if (!lpo_owner_open(anchor)) lpo_status(aTHX_ 4);
  lpo_hold(aTHX_ anchor);
  owner->anchor = anchor;
}
`;

export const ownedPerlBorrowTransfers = `
typedef struct lpo_input_group {
  lpo_owner *owner;
  int armed;
} lpo_input_group;
typedef struct {
  lpo_input_group *groups;
  size_t count;
} lpo_input_scope;
static int lpo_input_consumed(lpo_owner *owner) {
  return owner->input_move && owner->input_move->armed && !owner->result;
}
static void lpo_input_end(pTHX_ void *data) {
  lpo_input_group *group = data;
  lpo_owner *owner = group->owner;
  if (!owner) return;
  if (owner->input_move == group) {
    if (group->armed && !owner->result) owner->valid = 0;
    owner->input_move = NULL;
  }
  group->owner = NULL;
  PERL_UNUSED_CONTEXT;
}
static lpo_input_scope *lpo_begin_inputs(pTHX_ lpg_scope *scope, size_t count) {
  lpo_input_scope *inputs = lpg_allocate(aTHX_ scope, 1, sizeof(*inputs));
  inputs->count = count;
  inputs->groups = lpg_allocate(aTHX_ scope, count, sizeof(*inputs->groups));
  return inputs;
}
static void lpo_add_input(pTHX_ lpo_input_scope *inputs, size_t index, lpo_owner *owner) {
  if (!lpo_owner_open(owner)) lpo_status(aTHX_ 4);
  if (!owner->whole || owner->borrowed || owner->anchor) lpo_status(aTHX_ 1);
  if (owner->input_move) lpo_status(aTHX_ 8);
  lpo_input_group *group = &inputs->groups[index];
  SSGROW(4); SAVEDESTRUCTOR_X(lpo_input_end, group);
  group->owner = owner; owner->input_move = group;
}
static void lpo_arm_inputs(pTHX_ lpo_input_scope *inputs) {
  for (size_t i = 0; i < inputs->count; ++i)
    if (!lpo_owner_open(inputs->groups[i].owner)) lpo_status(aTHX_ 4);
  for (size_t i = 0; i < inputs->count; ++i) inputs->groups[i].armed = 1;
}
static void lpo_finish_inputs(pTHX_ lpo_input_scope *inputs) {
  for (size_t i = 0; i < inputs->count; ++i) lpo_input_end(aTHX_ &inputs->groups[i]);
}
`;

/**
 * Generate idiomatic selectors without exposing layout indices to callers.
 *
 * @param moduleName - Checked public Perl namespace.
 * @param types - Canonical projected value nodes.
 * @param functions - Checked callable exports.
 * @param ir - Compiler-authenticated names and ownership choices.
 */
export const ownedPerlBorrowClasses = (moduleName, types, functions, ir) => {
	const declarations = new Map(ir.declarations.map(item => [item.id, item]));
	const nodes = new Map(types.map(node => [node.id, node]));
	const noncopied = types.filter(node => node.representation !== "copied");
	const resultEntries = functions.filter(fn => nodes.get(fn.result).representation !== "copied")
		.map(fn => `${q(fn.publicName)} => ${nodes.get(fn.result).index}`);
	const parameters = functions.flatMap(fn => fn.parameters.flatMap((id, index) => nodes.get(id).representation === "copied" ? [] : [
		`${q(`${fn.publicName}/${index}`)} => ${nodes.get(id).index}`
		, ...fn.receiver === 0 && index === 0 ? [] : [
			`${q(`${fn.publicName}/${declarations.get(fn.id).parameters[index - (fn.receiver === 0 ? 1 : 0)].name}`)} => ${nodes.get(id).index}`
		]
	]));
	const receivers = functions.some(fn => fn.receiver === 0);
	return `package ${moduleName}::Value;
sub new { CORE::die "Value owners come from Lean functions or copy_value\\n" }
sub CLONE_SKIP { 1 }
sub STORABLE_freeze { CORE::die "Lean owners cannot be serialized\\n" }
sub STORABLE_thaw { CORE::die "Lean owners cannot be deserialized\\n" }
sub call { my $self = CORE::shift; $self->get->call(@_) }
package ${moduleName};
sub copy_value {
  CORE::die "copy_value expects a value and optional named selector\\n" unless @_ % 2 == 1;
  my $value = CORE::shift; my %options;
  while (@_) {
    my ($key, $selected) = CORE::splice @_, 0, 2;
    CORE::die "invalid or duplicate copy selector\\n" if !CORE::defined($key) || CORE::ref($key) || CORE::exists($options{$key});
    $options{$key} = $selected;
  }
  CORE::die "choose result_of or parameter_of\\n" if CORE::keys(%options) > 1;
  my $type;
  if (CORE::exists($options{result_of})) {
    my %results = (${resultEntries.join(", ")});
    my $name = $options{result_of};
    CORE::die "result_of requires a function name\\n" if !CORE::defined($name) || CORE::ref($name);
    $type = $results{$name};
  } elsif (CORE::exists($options{parameter_of})) {
    my %parameters = (${parameters.join(", ")});
    my $site = $options{parameter_of};
    CORE::die "parameter_of requires [function, parameter]\\n" unless CORE::ref($site) eq 'ARRAY' && @$site == 2 && !CORE::grep { !CORE::defined($_) || CORE::ref($_) } @$site;
    $type = $parameters{CORE::join('/', @$site)};
  } elsif (!CORE::keys(%options)) {
    my %nominal = (${noncopied.flatMap(node => node.name ? [[node.publicType, node.index], ...node.cases.map(branch => [branch.publicName, node.index])] : []).map(([name, index]) => `${q(name)} => ${index}`).join(", ")});
    return $value->retain if ${receivers ? `CORE::ref($value) && UNIVERSAL::isa($value, '${moduleName}::Value')` : `CORE::ref($value) eq '${moduleName}::Value'`};
    $type = $nominal{CORE::ref($value)};
  } else { CORE::die "unknown copy selector\\n" }
  CORE::die "copy_value requires an owned type; select result_of or parameter_of for containers\\n" unless CORE::defined($type);
  my %copy = (${noncopied.map(node => `${node.index} => \\&_owned_copy${node.index}`).join(", ")});
  return $copy{$type}->($value);
}
`;
};

/**
 * Pass the original owner slot, including for empty and nested inputs.
 *
 * @param name - Public Perl method name.
 * @param fn - Checked C call descriptor.
 * @param model - Canonical Perl value projection.
 */
export const ownedPerlAnchoredCall = (name, fn, model) => {
	const nodes = new Map(model.types.map(node => [node.id, node]));
	const inputs = fn.parameters.map(id => nodes.get(id)), result = nodes.get(fn.result);
	const moving = fn.transfers ?? [], wraps = index => moving.includes(index) || fn.anchor === index;
	const whole = result.representation !== "copied" && !fn.retain && !fn.copy;
	const args = inputs.flatMap((node, index) => [
		`${model.c.hostArgument?.(fn, index) || !node.leaf ? "&" : ""}input${index}`
		, ...moving.includes(index) ? [`&input_owner${index}->result`] : []
		, ...fn.anchor === index ? [`input_owner${index}->result`] : []
	]);
	return `void
${name}(...)
  PPCODE:
    if (items != ${inputs.length}) croak("${name} expects ${inputs.length} arguments");
    ENTER;
    lpo_enter_call(aTHX);
    lpg_scope *scope = lpg_begin(aTHX_ NULL);
    lpo_frame *frame = lpo_begin_frame(aTHX_ scope);
    lpo_owner *owner = lpo_begin_owner(aTHX_ 0);
    ${inputs.map((_, index) => `SV *argument${index} = lpg_pin(aTHX_ ST(${index}));`).join("\n    ")}
${moving.length ? `    lpo_input_scope *moves = lpo_begin_inputs(aTHX_ scope, ${moving.length});\n` : ""}\
${inputs.map((node, index) => [
	...wraps(index) ? [`    lpo_owner *input_owner${index} = NULL;`
		, `    argument${index} = lpo_value_input(aTHX_ argument${index}, ${node.index}, &input_owner${index});`] : []
	, ...moving.includes(index) ? [`    lpo_add_input(aTHX_ moves, ${moving.indexOf(index)}, input_owner${index});`] : []
	, model.c.hostArgument?.(fn, index)
		? `    ${node.cName}_host input${index} = lpo_host${node.index}(aTHX_ frame, argument${index});`
		: `    ${node.cName} input${index} = {0}; lpo_read${node.index}(aTHX_ scope, argument${index}, &input${index}, 0, 1);`
].join("\n")).join("\n")}
    lpo_context(aTHX);
    if (lpo_state.closed) lpo_status(aTHX_ 4);
${fn.anchor !== undefined ? `    if (!lpo_owner_open(input_owner${fn.anchor})) lpo_status(aTHX_ 4);\n` : ""}\
${moving.length ? "    lpo_arm_inputs(aTHX_ moves);\n" : ""}\
    ${result.cName} returned = {0};
    uint32_t status = ${fn.cName}(lpo_state.session, ${args.concat(["&returned", "&owner->result"]).join(", ")});
${moving.length ? "    lpo_finish_inputs(aTHX_ moves);\n" : ""}\
    lpo_finish_frame(aTHX_ frame, status);
${fn.anchor !== undefined ? `    lpo_anchor_owner(aTHX_ owner, input_owner${fn.anchor});\n` : ""}\
    SV *out = lpo_write${result.index}(aTHX_ scope, owner, &returned, 0, 1);
${whole ? `    out = lpo_wrap_value(aTHX_ scope, owner, out, ${result.index}, "${result.ownerType ?? model.moduleName + "::Value"}");\n` : ""}\
    lpo_publish(aTHX_ owner);
    LEAVE;
    SPAGAIN; SP = PL_stack_base + ax - 1; EXTEND(SP, 1); XPUSHs(out);
`;
};

/**
 * Checked whole-value access and typed independent copies.
 *
 * @param model - Canonical Perl projection and native copy functions.
 */
export const ownedPerlBorrowXs = model => {
	const valueClass = `${model.moduleName}::Value`;
	const types = model.types.filter(node => node.representation !== "copied");
	const declarations = types.map(node => {
		const copy = [...model.c.copies ?? [], ...model.c.retains].find(fn => fn.result === node.id);
		if(!copy) throw new TypeError(`Missing Perl whole-value copy transport: ${node.id}`);
		return `static SV *lpo_copy_value${node.index}(pTHX_ lpg_scope *scope, SV *value) {
  lpo_owner *owner = lpo_begin_owner(aTHX_ 0);
  ${node.cName} input = {0}, returned = {0};
  lpo_read${node.index}(aTHX_ scope, value, &input, 0, 1);
  lpo_status(aTHX_ ${copy.cName}(lpo_state.session, ${node.leaf ? "" : "&"}input, &returned, &owner->result));
  SV *out = lpo_write${node.index}(aTHX_ scope, owner, &returned, 0, 1);
  out = lpo_wrap_value(aTHX_ scope, owner, out, ${node.index}, "${node.ownerType ?? valueClass}");
  lpo_publish(aTHX_ owner);
  return out;
}`;
	}).join("\n");
	const nodes = new Map(model.types.map(node => [node.id, node]));
	const callbackFactories = model.c.callbacks.some(fn => fn.anchor !== undefined)
		? model.c.callbacks.flatMap(fn => {
			const callback = nodes.get(fn.id);
			const sites = fn.parameters.slice(1).map((id, index) => [`copy_arg${index}`, nodes.get(id)]);
			sites.push(["copy_result", nodes.get(fn.result)]);
			return sites.filter(([, node]) => node.representation !== "copied").map(([name, node]) => `MODULE = ${model.moduleName} PACKAGE = ${callback.publicType}

void
${name}(self, value)
    SV *self
    SV *value
  PPCODE:
    ENTER;
    lpo_enter_call(aTHX);
    (void)lpo_borrow(aTHX_ self, ${callback.index});
    lpg_scope *scope = lpg_begin(aTHX_ NULL);
    SV *out = lpo_copy_value${node.index}(aTHX_ scope, value);
    LEAVE;
    SPAGAIN; SP = PL_stack_base + ax - 1; EXTEND(SP, 1); XPUSHs(out);
`);
		}) : [];
	const xs = [`MODULE = ${model.moduleName} PACKAGE = ${model.moduleName}\n`
		, ...types.map(node => `void
_owned_copy${node.index}(value)
    SV *value
  PPCODE:
    ENTER;
    lpo_enter_call(aTHX);
    lpg_scope *scope = lpg_begin(aTHX_ NULL);
    SV *out = lpo_copy_value${node.index}(aTHX_ scope, value);
    LEAVE;
    SPAGAIN; SP = PL_stack_base + ax - 1; EXTEND(SP, 1); XPUSHs(out);
`)
		, ...callbackFactories
		, `MODULE = ${model.moduleName} PACKAGE = ${valueClass}

void
get(value)
    SV *value
  PPCODE:
    lpo_wrapper *wrapper = lpo_value_require(aTHX_ value, SIZE_MAX);
    SV *out = lpg_pin(aTHX_ wrapper->payload);
    XPUSHs(out);

void
close(value)
    SV *value
  PPCODE:
    lpo_wrapper_close(aTHX_ lpo_value_wrapper(aTHX_ value, SIZE_MAX));

int
closed(value)
    SV *value
  CODE:
    RETVAL = lpo_closed(lpo_value_wrapper(aTHX_ value, SIZE_MAX));
  OUTPUT:
    RETVAL

void
share(value)
    SV *value
  PPCODE:
    ENTER;
    lpo_enter_call(aTHX);
    lpg_scope *scope = lpg_begin(aTHX_ NULL);
    lpo_wrapper *wrapper = lpo_value_require(aTHX_ value, SIZE_MAX);
    SV *out = lpo_wrap_value(aTHX_ scope, wrapper->owner, wrapper->payload, wrapper->type, ${model.receiverExports ? "wrapper->package" : `"${valueClass}"`});
    LEAVE;
    SPAGAIN; SP = PL_stack_base + ax - 1; EXTEND(SP, 1); XPUSHs(out);

void
retain(value)
    SV *value
  PPCODE:
    ENTER;
    lpo_enter_call(aTHX);
    lpg_scope *scope = lpg_begin(aTHX_ NULL);
    lpo_wrapper *wrapper = lpo_value_require(aTHX_ value, SIZE_MAX);
    lpo_pin_owner(aTHX_ wrapper->owner);
    SV *payload = lpg_pin(aTHX_ wrapper->payload), *out = NULL;
    switch (wrapper->type) {
${types.map(node => `    case ${node.index}: out = lpo_copy_value${node.index}(aTHX_ scope, payload); break;`).join("\n")}
    default: lpo_status(aTHX_ 1);
    }
    LEAVE;
    SPAGAIN; SP = PL_stack_base + ax - 1; EXTEND(SP, 1); XPUSHs(out);
`];
	return { declarations, xs: xs.join("\n") };
};
