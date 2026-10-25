/**
 * Nominal PHP members preserve original whole owners and argument positions.
 *
 * @file
 */
import { ownedPhpBorrowValue, ownedPhpBorrowAccess } from "./owned-borrows.mjs";

const reserved = new Set("get close closed share retain equals hashcode sameidentity".split(" "));
/**
 * Convert the generated function spelling to PHP instance-member spelling.
 *
 * @param name - Public function identifier.
 */
export const ownedPhpMemberName = name => name.replace(/_([a-z])/gu, (_, letter) => letter.toUpperCase());

/**
 * Produce methods and virtual read-only properties without PHP 8.4 hooks.
 *
 * @param node - The nominal resource or aggregate.
 * @param functions - Exports retaining their original receiver and anchor slots.
 * @param types - Public result annotations and owner classes.
 * @param raw - Omit members requiring the receiver's original whole owner.
 * @param options - Optional callback-local owner capabilities.
 * @param options.callbackResultAnchors - Reserve authenticated callback factories.
 */
export const ownedPhpReceiverMembers = (node, functions, types, raw = false, { callbackResultAnchors = false } = {}) => {
	const names = new Set([...reserved, ...callbackResultAnchors ? ["copyarg", "copyresult"] : []]), methods = [], properties = [];
	for(const fn of functions)
	{
		if(fn.receiver !== 0 || fn.parameters[0] !== node.id) continue;
		const name = ownedPhpMemberName(fn.publicName), original = fn.anchor === 0 || fn.transfers?.includes(0);
		if(names.has(name.toLowerCase()) || name.startsWith("__")) throw new TypeError(`Reserved or duplicate PHP receiver member: ${node.publicType}::${name}`);
		names.add(name.toLowerCase()); if(raw && original) continue;
		const receiver = raw || original ? "$this" : "$this->get()";
		const arguments_ = fn.publicParameters.slice(1), result = types.find(node => node.id === fn.result);
		const whole = result.representation !== "copied";
		const resultType = whole ? result.ownerType ?? "Value" : result.publicType;
		const returnDoc = whole ? result.ownerType ?? `Value<${result.docType}>` : result.docType;
		const call = `${fn.publicName}(${[receiver, ...arguments_.map(name => "$" + name)].join(", ")})`;
		if(fn.declaration.kind === "property") properties.push({ name, call, doc: returnDoc });
		else methods.push(`    /** @return ${returnDoc} */
    public function ${name}(${arguments_.map(name => `mixed $${name}`).join(", ")}): ${resultType} {
        if (\\func_num_args() !== ${arguments_.length}) throw new \\ArgumentCountError('${name} requires exactly ${arguments_.length} arguments');
        return ${call};
    }
`);
	}
	const doc = properties.length ? "/**\n" + properties.map(({ name, doc }) => ` * @property-read ${doc} $${name}`).join("\n") + "\n */\n" : "";
	const access = properties.length ? `    public function __get(string $name): mixed {
        return match ($name) {
${properties.map(({ name, call }) => `            '${name}' => ${call},`).join("\n")}
            default => throw new \\OutOfBoundsException('Unknown Lean property: ' . $name)
        };
    }
    public function __isset(string $name): bool {
        return \\in_array($name, [${properties.map(({ name }) => `'${name}'`).join(", ")}], true) && $this->__get($name) !== null;
    }
    public function __set(string $name, mixed $value): void { throw new \\LogicException('Lean properties are read-only'); }
    public function __unset(string $name): void { throw new \\LogicException('Lean properties are read-only'); }
` : "";
	return { doc, source: methods.join("") + access };
};

/**
 * Keep the original private constructor while selecting only generated subtypes.
 *
 * @param namespace - Public namespace.
 * @param types - Nominal owners and runtime type indices.
 * @param functions - Checked receiver exports.
 * @param templates - Transport-specific storage with the same owner API.
 * @param templates.valueSource - Whole-owner class before nominal specialization.
 * @param templates.accessSource - Private factory and snapshot implementation.
 * @param templates.callbackResultAnchors - Reserve authenticated callback factories.
 */
export const ownedPhpReceiverOwners = (namespace, types, functions, { valueSource = ownedPhpBorrowValue, accessSource = ownedPhpBorrowAccess, callbackResultAnchors = false } = {}) => {
	let value = valueSource.replace("final class Value", "class Value")
		.replaceAll("    public function ", "    final public function ")
		.replace("public function share(): self", "public function share(): static")
		.replace("public function retain(): self", "public function retain(): static")
		.replace("return new self(", "return new static(");
	for(const node of types.filter(node => node.ownerType))
	{
		const members = ownedPhpReceiverMembers(node, functions, types, false, { callbackResultAnchors });
		const doc = members.doc ? members.doc.replace("/**\n", `/**\n * @extends Value<${node.docType}>\n`) : `/** @extends Value<${node.docType}> */\n`;
		value += `\n${doc}final class ${node.ownerType} extends Value\n{\n${members.source}}\n`;
	}
	const classes = types.filter(node => node.ownerType).map(node => `            ${node.index} => @NAMESPACE@\\${node.ownerType}::class,`).join("\n");
	const access = accessSource.replace(
		"$create = \\Closure::bind(static fn() => new @NAMESPACE@\\Value("
		, `$class = match ($type) {\n${classes}\n            default => @NAMESPACE@\\Value::class\n        };\n        $create = \\Closure::bind(static fn() => new $class(`)
		.replaceAll("@NAMESPACE@", `\\${namespace}`);
	return { value, access };
};
