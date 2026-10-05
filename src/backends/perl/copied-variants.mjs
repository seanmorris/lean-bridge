/**
 * Named Perl variant cases with compiler-owned construction and field access.
 *
 * @file
 */
import { nativeCType, nativeObjectType, nativeTypeKey } from "../../build/native-model.mjs";

const family = (model, type) => `${model.moduleName}::${type.name.split(".").at(-1)}`;
const caseClass = (model, type, branch) => `${family(model, type)}::${branch.name[0].toUpperCase()}${branch.name.slice(1)}`;
const reserved = new Set(["new", "DESTROY", "CLONE", "CLONE_SKIP", "can", "isa", "DOES", "VERSION", "import", "unimport", "AUTOLOAD", "BEGIN", "UNITCHECK", "CHECK", "INIT", "END"]);
const retain = (type, name) => nativeObjectType(type) ? `lean_inc(${name});` : "";
const keep = (type, expression) => nativeObjectType(type) ? `lbp_keep(scope, ${expression})` : expression;

/**
 * Reject case collisions and accessor names that replace Perl object methods.
 *
 * @param model - Compiler-checked native model.
 * @param classes - Already reserved public class names.
 */
export const validatePerlVariants = (model, classes) => {
	for(const type of model.types.filter(type => type.kind === "variant")) for(const branch of type.cases)
	{
		const name = caseClass(model, type, branch);
		if(classes.has(name)) throw new TypeError(`Perl class name collision: ${name}`);
		classes.add(name);
		for(const field of branch.fields) if(reserved.has(field.name)) throw new TypeError(`Perl reserved variant field: ${field.name}`);
	}
};

/**
 * Pin every input slot before conversion; inspect the checked tag before getters.
 *
 * @param model - Compiler-checked native model.
 * @param type - Concrete native variant with a stable type key.
 */
export const perlVariantConversions = (model, type) => ({
	from: `
      SvGETMAGIC(value);
${type.cases.map((branch, index) => `      if (lbp_is_branch(value, ${JSON.stringify(caseClass(model, type, branch))})) {
        HV *input = (HV *)sv_2mortal(SvREFCNT_inc(SvRV(value)));
        if (HvUSEDKEYS(input) != ${branch.fields.length}) croak("constructor fields do not match the generated schema");
        lbp_budget(scope, ${branch.fields.length + 1} * sizeof(void *));
        /* Pin all fields before a child converter can invoke Perl code. */
${branch.fields.map((field, i) => `        SV *slot${i} = lbp_field(aTHX_ input, ${JSON.stringify(field.name)}, ${field.name.length});`).join("\n")}
${branch.fields.map((field, i) => `        ${nativeCType(field.type)} a${i} = lb_read_${nativeTypeKey(field.type)}(aTHX_ scope, slot${i});`).join("\n")}
        ${branch.fields.map((field, i) => retain(field.type, `a${i}`)).join(" ")}
        return ${keep(type, `lb_t${type.key}_make${index}(${branch.fields.map((_, i) => `a${i}`).join(", ") || "lean_box(0)"})`)};
      }`).join("\n")}
      croak("expected an exact ${family(model, type)} constructor with a plain untied hash");`
	, to: `
      ${retain(type, "value")} uint32_t tag = lb_t${type.key}_tag(value);
      switch (tag) {
${type.cases.map((branch, index) => `      case ${index}: {
        lbp_budget(scope, ${branch.fields.length + 1} * sizeof(void *));
        HV *output = (HV *)sv_2mortal((SV *)newHV());
${branch.fields.map((field, i) => `        ${retain(type, "value")} ${nativeCType(field.type)} a${i} = lb_t${type.key}_get${index}_${i}(value);
        ${nativeObjectType(field.type) ? `lbp_keep(scope, a${i});` : ""}
        hv_store(output, ${JSON.stringify(field.name)}, ${field.name.length}, SvREFCNT_inc(lb_write_${nativeTypeKey(field.type)}(aTHX_ scope, a${i})), 0);`).join("\n")}
        return sv_bless(lbp_mortal(newRV_inc((SV *)output)), gv_stashpv(${JSON.stringify(caseClass(model, type, branch))}, GV_ADD));
      }`).join("\n")}
      default: croak("Invalid native ${family(model, type)} constructor");
      }`
});

/**
 * Public mutable constructor values. Conversion performs the payload type checks.
 *
 * @param model - Compiler-checked native model.
 */
export const perlVariantClasses = model => model.types.filter(type => type.kind === "variant").flatMap(type => [
	`package ${family(model, type)};`
	, 'sub new { die "select a named variant constructor\\n" }', ""
	, ...type.cases.flatMap(branch => {
		const name = caseClass(model, type, branch);
		return [`package ${name};`
			, `our @ISA = ('${family(model, type)}');`, "sub new {"
			, `  die "${name}->new expects named fields\\n" unless @_ % 2 == 1 && $_[0] eq '${name}';`
			, "  shift; my %fields;"
			, "  while (@_) {"
			, "    my ($key, $value) = splice @_, 0, 2;"
			, '    die "invalid constructor field\\n" if !defined($key) || ref($key);'
			, '    die "duplicate constructor field\\n" if exists $fields{$key};'
			, "    $fields{$key} = $value;", "  }"
			, `  my @required = qw(${branch.fields.map(field => field.name).join(" ")});`
			, '  die "constructor fields do not match the generated schema\\n" if keys(%fields) != @required || grep { !exists $fields{$_} } @required;'
			, `  return bless \\%fields, '${name}';`, "}"
			, ...branch.fields.map(field => `sub ${field.name} { $_[0]->{${field.name}} }`)
			, ""];
	})
]);

/**
 * Describe public constructor identities and copied-value rules in installed POD.
 *
 * @param model - Compiler-checked native model.
 */
export const perlVariantPod = model => !model.types.some(type => type.kind === "variant") ? [] : [
	"=head1 TAGGED VARIANTS", ""
	, "Concrete copied Lean variants use named constructor classes with keyword fields. Construct a case with C<< Signal::Data->new(count => 42, label => 'ready') >> under this component's namespace. The family itself cannot be constructed. Payload accessors keep the original field names. Calls require the exact generated class and field set, reject tied or magical hashes and unknown subclasses, and copy only the active payload. Empty cases and cases carrying undef for Unit stay distinct."
	, ""
	, "Fields and contained arrays remain mutable. Returned payloads own independent storage. Perl reference equality is not deep value equality, and Perl does not check match exhaustiveness. Input field slots are pinned before conversion can invoke Perl. Scoped cleanup releases partial conversions. The shared per-call copied-value limit is 16 MiB and schema nesting is limited to 32 levels. Generic, indexed, recursive, proof-bearing, callable and identity-bearing payloads remain unsupported."
	, "", "=over 4", ""
	, ...model.types.filter(type => type.kind === "variant").flatMap(type => type.cases.flatMap(branch => [
		`=item C<${caseClass(model, type, branch)}>`, ""
		, branch.fields.length ? `Required fields: ${branch.fields.map(field => `C<${field.name}>`).join(", ")}.` : "No payload fields."
		, ""
	]))
	, "=back", ""
];
