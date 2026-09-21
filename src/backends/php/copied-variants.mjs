/**
 * Named readonly PHP constructors and private tagged-union conversions.
 *
 * @file
 */
/**
 * Capitalize constructor segments without discarding trailing underscores.
 *
 * @param value - Original Lean constructor name.
 */
const caseName = value => value.split("_").filter(Boolean).map(part => part[0].toUpperCase() + part.slice(1)).join("") + (value.match(/_+$/)?.[0] ?? "");
const forbiddenFields = new Set(["this", "GLOBALS", "_SERVER", "_GET", "_POST", "_FILES", "_COOKIE", "_SESSION", "_REQUEST", "_ENV", "__lbBudget"]);

/**
 * Bind original PHP payload names separately from escaped private C members.
 *
 * @param copy - Admitted variant and its dependency-ordered payload types.
 * @param names - Case-insensitive public class/function namespace.
 * @param fail - Source-aware diagnostic callback.
 */
export const configurePhpVariant = (copy, names, fail) => {
	const register = name => {
		if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(name) || names.has(name.toLowerCase())) fail(`PHP variant class is reserved or duplicated: ${name}`);
		names.add(name.toLowerCase()); return name;
	};
	copy.publicName = register(copy.variant.name);
	for(const [index, branch] of copy.cases.entries())
	{
		const original = copy.variant.cases[index];
		branch.publicName = register(copy.publicName + caseName(original.name));
		for(const [fieldIndex, field] of branch.fields.entries())
		{
			field.publicName = original.fields[fieldIndex].name;
			if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(field.publicName) || forbiddenFields.has(field.publicName)) fail(`PHP variant field is reserved or invalid: ${field.publicName}`);
		}
	}
};

/**
 * Expose families and final constructors without native discriminants.
 *
 * @param model - Validated PHP projection.
 */
export const phpVariantClasses = model => model.surface.copies.filter(copy => copy.variant).map(copy => `abstract readonly class ${copy.publicName} {}
${copy.cases.map(branch => `final readonly class ${branch.publicName} extends ${copy.publicName}
{
${branch.fields.map(field => `    /** @var ${field.type.docType} */\n    public ${field.type.publicType} $${field.publicName};`).join("\n")}
    public function __construct(${branch.fields.map(field => `mixed $${field.publicName}`).join(", ")}) {
        if (func_num_args() !== ${branch.fields.length}) throw new \\ArgumentCountError('${branch.publicName} requires exactly ${branch.fields.length} payload fields');
        $__lbBudget = new Internal\\Budget();
${branch.fields.map(field => `        $this->${field.publicName} = Internal\\Checks::check${field.type.index}($${field.publicName}, $__lbBudget);`).join("\n")}
    }
}`).join("\n\n")}`).join("\n\n");

/**
 * Render the C facade's union layout for PHP's FFI parser.
 *
 * @param copy - Checked variant with C-safe member names.
 */
export const phpVariantDefinition = copy => `typedef struct { uint32_t kind; union { ${copy.cases.map(branch => `struct { ${branch.fields.map(field => `${field.type.ctype} ${field.name};`).join(" ") || "uint8_t empty;"} } ${branch.name};`).join(" ")} } cases; } ${copy.ctype};\nvoid ${copy.name}_clear(${copy.ctype} *);`;

/**
 * Validate exact generated constructors, initialized fields and typed payloads.
 *
 * @param model - Public component namespace.
 * @param copy - Checked variant.
 */
export const phpVariantChecks = (model, copy) => [
	...copy.cases.flatMap(branch => [`if ($value instanceof \\${model.namespace}\\${branch.publicName}) {`
		, `    if (array_keys(get_object_vars($value)) !== [${branch.fields.map(field => `'${field.publicName}'`).join(", ")}]) throw new \\TypeError('${branch.publicName} requires exactly its initialized payload fields');`
		, ...branch.fields.map(field => `    self::check${field.type.index}($value->${field.publicName}, $budget);`)
		, "    return $value;", "}"])
	, `throw new \\TypeError('Expected an exact ${copy.publicName} constructor');`
];

/**
 * Copy only the active payload, checking returned tags before union reads.
 *
 * @param model - Component namespace.
 * @param copy - Checked variant with public and private names.
 */
export const phpVariantConversions = (model, copy) => ({
	input: [
		...copy.cases.flatMap((branch, index) => [`${index ? "else " : ""}if ($value instanceof \\${model.namespace}\\${branch.publicName}) {`
			, `    $out->kind = ${index};`
			, ...branch.fields.flatMap(field => [`    $item = self::to${field.type.index}($value->${field.publicName}, $scope);`
				, `    $out->cases->${branch.name}->${field.name} = $item${field.type.aggregate ? "" : "->cdata"};`])
			, "}"])
		, `else throw new \\TypeError('Expected an exact ${copy.publicName} constructor');`
	]
	, output: ["switch ($value->kind) {"
		, ...copy.cases.map((branch, index) => `case ${index}: return new \\${model.namespace}\\${branch.publicName}(${branch.fields.map(field => `self::from${field.type.index}($value->cases->${branch.name}->${field.name}, $scope)`).join(", ")});`)
		, `default: throw new \\RuntimeException('Invalid native ${copy.publicName} constructor');`
		, "}"]
});

/**
 * Describe constructor identity and copied-value semantics in the archive.
 *
 * @param model - Checked PHP projection.
 */
export const phpVariantReadme = model => !model.surface.copies.some(copy => copy.variant) ? "" : `
## Tagged variants

Concrete copied variants use abstract readonly family classes and final readonly constructor classes, such as SignalData extends Signal. Constructors take named or positional payload arguments with the original Lean field names. All payload checks apply in weak and strict PHP callers. Empty constructors and null Unit payloads stay distinct. Calls accept only exact generated constructor classes with their initialized fields; unknown family subclasses and uninitialized reflection-created objects reject. The native tag and union layout are private. Returned tags are checked before reading the active payload.

Accepted payloads include all nineteen primitives, copied arrays, Lists, records, options, results, products and other admitted variants. Returned payloads have independent copied storage. Readonly properties cannot be reassigned; arrays and objects still follow PHP's value and object semantics. PHP === compares object identity, while == compares properties under PHP rules. PHP does not check branch exhaustiveness. The 32-level schema limit and separate 16 MiB validation, PHP conversion and native-copy budgets remain in effect. Generic, indexed, proof-bearing, recursive, callable and identity-bearing payloads remain unsupported.
`;
