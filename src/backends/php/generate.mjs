import { createHash } from "node:crypto";

import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { validateBindingIr } from "../../binding-ir/contract.mjs";
import { auditPhpPackage } from "./package-audit.mjs";
import { compilePhpProjection } from "./projection.mjs";

export class PhpBindingGenerationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PhpBindingGenerationError";
    this.code = code;
    this.details = Object.freeze(structuredClone(details));
  }
}

const fail = (code, message, details = {}) => {
  throw new PhpBindingGenerationError(code, message, details);
};

const sha256 = source => createHash("sha256").update(source, "utf8").digest("hex");
const phpString = value => `'${String(value).replaceAll("\\", "\\\\").replaceAll("'", "\\'").replaceAll("\n", "\\n")}'`;
const namedType = (ir, id) => ir.types.find(type => type.id === id);
const namedTypeId = ref => ref.kind === "named" ? ref.id : null;

const snake = value => String(value)
  .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
  .replace(/[^A-Za-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "")
  .toLowerCase();

const pascal = value => String(value)
  .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
  .split(/[^A-Za-z0-9]+/)
  .filter(Boolean)
  .map(word => `${word[0].toUpperCase()}${word.slice(1)}`)
  .join("");

const resolveAlias = (ir, ref, seen = new Set()) => {
  if (ref.kind !== "named") return ref;
  const type = namedType(ir, ref.id);
  if (type?.kind !== "alias") return ref;
  if (seen.has(type.id)) fail("alias-cycle", `PHP generator found an alias cycle at ${type.id}`);
  seen.add(type.id);
  return resolveAlias(ir, type.target, seen);
};

const isIdentity = (ir, ref) => {
  const resolved = resolveAlias(ir, ref);
  return resolved.kind === "named" && namedType(ir, resolved.id)?.representation === "identity";
};

const validateTypeRefCoverage = (ir, ref, path) => {
  const resolved = resolveAlias(ir, ref);
  if (resolved.kind !== "apply") return;
  if (resolved.constructor === "result") {
    fail("unsupported-result-type", `${path} requires a generated PHP Result value`, { path, type: resolved });
  }
  if (resolved.constructor === "option") {
    const inner = resolveAlias(ir, resolved.arguments[0]);
    if (
      inner.kind === "apply" && inner.constructor === "option" ||
      inner.kind === "primitive" && inner.name === "unit"
    ) {
      fail("ambiguous-nullable-option", `${path} cannot use PHP null without losing an Option case`, {
        path,
        type: resolved,
      });
    }
  }
  resolved.arguments.forEach((argument, index) => validateTypeRefCoverage(ir, argument, `${path}.arguments[${index}]`));
};

const validateCoverage = ir => {
  for (const error of ir.errors) {
    if (error.payload !== null) {
      fail("unsupported-error-payload", `${error.id} has a payload that the PHP POC cannot preserve`, {
        error: error.id,
      });
    }
  }
  for (const type of ir.types) {
    if (type.typeParameters.length > 0) {
      fail("unsupported-generic-type", `${type.id} requires a generic PHP value class`, { type: type.id });
    }
    if (type.kind === "resource" && type.resource.disposal !== "required") {
      fail("unsupported-disposal-policy", `${type.id} must declare required disposal for PHP`, {
        type: type.id,
        disposal: type.resource.disposal,
      });
    }
    if (type.kind === "callback" && type.callable.resultMode !== "value") {
      fail("unsupported-async-callback", `${type.id} is an asynchronous callback`, { type: type.id });
    }
    if (type.kind === "record") {
      type.fields.forEach(field => validateTypeRefCoverage(ir, field.type, `${type.id}.${field.name}`));
    }
    if (type.kind === "alias") validateTypeRefCoverage(ir, type.target, type.id);
    if (type.kind === "callback") {
      type.callable.parameters.forEach(parameter => validateTypeRefCoverage(ir, parameter.type, `${type.id}.${parameter.name}`));
      validateTypeRefCoverage(ir, type.callable.result.type, `${type.id}.result`);
    }
  }
  const publicNames = new Map();
  for (const declaration of ir.declarations) {
    if (declaration.typeParameters.length > 0) {
      fail("unsupported-generic-declaration", `${declaration.id} requires PHP generic specialization`, {
        declaration: declaration.id,
      });
    }
    if (declaration.receiver && (
      declaration.receiver.ownership !== "borrow" ||
      declaration.receiver.lifetime?.scope !== "call"
    )) {
      fail("unsupported-receiver-lifetime", `${declaration.id} must borrow its receiver for one call`);
    }
    for (const parameter of declaration.parameters) {
      if (isIdentity(ir, parameter.type) && (
        parameter.ownership !== "borrow" || parameter.lifetime?.scope !== "call"
      )) {
        fail("unsupported-identity-parameter", `${declaration.id}.${parameter.name} must be a call-scoped borrow`);
      }
    }
    if (declaration.result.ownership === "transfer") {
      fail("unsupported-transfer-result", `${declaration.id} transfers a result into PHP`, {
        declaration: declaration.id,
      });
    }
    declaration.parameters.forEach(parameter => validateTypeRefCoverage(ir, parameter.type, `${declaration.id}.${parameter.name}`));
    validateTypeRefCoverage(ir, declaration.result.type, `${declaration.id}.result`);
    const scope = declaration.receiver?.type?.id ?? "namespace";
    const propertyRole = declaration.kind === "property"
      ? `:${declaration.parameters.length === 0 ? "get" : "set"}`
      : "";
    const publicKey = `${scope}:${declaration.kind === "constructor" ? "__construct" : declaration.name}${propertyRole}`;
    if (publicNames.has(publicKey)) {
      fail("unsupported-overload", `${declaration.id} collides with ${publicNames.get(publicKey)} in PHP`, {
        declaration: declaration.id,
        other: publicNames.get(publicKey),
      });
    }
    publicNames.set(publicKey, declaration.id);
  }
};

const typeKey = ref => {
  if (ref.kind === "primitive") return pascal(ref.name);
  if (ref.kind === "named") return pascal(ref.id.replace(":", " "));
  if (ref.kind === "parameter") return pascal(ref.id);
  return `${pascal(ref.constructor)}${ref.arguments.map(typeKey).join("")}`;
};

const collectTypeRefs = ir => {
  const refs = new Map();
  const add = ref => {
    const resolved = resolveAlias(ir, ref);
    const key = JSON.stringify(resolved);
    if (!refs.has(key)) refs.set(key, resolved);
    if (resolved.kind === "apply") resolved.arguments.forEach(add);
  };
  for (const type of ir.types) {
    if (type.kind === "record") type.fields.forEach(field => add(field.type));
    if (type.kind === "alias") add(type.target);
    if (type.kind === "callback") {
      type.callable.parameters.forEach(parameter => add(parameter.type));
      add(type.callable.result.type);
    }
  }
  for (const declaration of ir.declarations) {
    if (declaration.receiver) add(declaration.receiver.type);
    declaration.parameters.forEach(parameter => add(parameter.type));
    add(declaration.result.type);
  }
  return [...refs.values()];
};

const projectionForRef = (projection, ref) => {
  const operationSites = projection.operations.flatMap(operation => [
    operation.receiver,
    ...operation.parameters,
    operation.result,
  ]).filter(Boolean);
  const matching = operationSites.find(site => JSON.stringify(site.type.binding) === JSON.stringify(ref.id ?? ref.name));
  if (matching && ref.kind !== "apply") return matching.type;
  const type = ref.kind === "named" ? projection.types.find(item => item.id === ref.id) : null;
  if (type?.projection === "value-object" || type?.projection === "resource-object") {
    return { phpType: `\\${type.fqcn}`, phpDocType: `\\${type.fqcn}` };
  }
  if (type?.projection === "invokable-object") {
    return { phpType: "callable", phpDocType: `\\${type.fqcn}|callable` };
  }
  if (ref.kind === "primitive") {
    const field = projection.types.flatMap(item => item.fields ?? []).find(item => item.type.binding === ref.name);
    if (field) return field.type;
    const site = operationSites.find(item => item.type.binding === ref.name);
    if (site) return site.type;
  }
  if (ref.kind === "apply") {
    const field = projection.types.flatMap(item => item.fields ?? []).find(item => item.type.binding === ref.constructor);
    if (field) return field.type;
  }
  fail("missing-type-projection", "PHP generator cannot resolve a projected type", { ref });
};

const phpType = (projection, ref, { role = "parameter", ownership = "copy" } = {}) => {
  const resolved = projectionForRef(projection, ref);
  if (resolved.kind === "callback" || ref.kind === "named" && projection.types.find(type => type.id === ref.id)?.projection === "invokable-object") {
    return role === "result" && ownership !== "copy" ? `\\${resolved.class ?? projection.types.find(type => type.id === ref.id).fqcn}` : "callable";
  }
  return resolved.phpType;
};

const phpDocType = (projection, ref) => projectionForRef(projection, ref).phpDocType;
const validatorName = ref => `assert${typeKey(ref)}`;

const phpDefault = value => {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return phpString(value);
  fail("unsupported-default", "PHP generator supports scalar defaults", { value });
};

const parameterCode = (projection, parameter) => {
  const type = phpType(projection, parameter.type, { role: "parameter", ownership: parameter.ownership });
  return `${type} $${parameter.name}${parameter.optional ? ` = ${phpDefault(parameter.default)}` : ""}`;
};

const resultType = (projection, operation) => operation.delivery.phpType;

const docBlock = (documentation, tags = []) => {
  const text = [documentation.summary, documentation.details].filter(Boolean).join("\n\n");
  const lines = text.replaceAll("*/", "* /").split("\n");
  return ["/**", ...lines.map(line => ` * ${line}`), ...tags.map(tag => ` * ${tag}`), " */"];
};

const fileHeader = (namespace, hash, imports = []) => [
  "<?php",
  "declare(strict_types=1);",
  "",
  `// Generated from Binding IR SHA-256 ${hash}.`,
  `namespace ${namespace};`,
  "",
  ...imports.map(name => `use ${name};`),
  ...(imports.length ? [""] : []),
];

const emitValidators = (ir, projection) => {
  const namespace = `${projection.package.namespace}\\Internal`;
  const lines = fileHeader(namespace, projection.bindingIrSha256, [
    `${projection.package.namespace}\\BigInteger`,
    `${projection.package.namespace}\\Bytes`,
  ]);
  lines.push("final class Validators", "{");
  for (const ref of collectTypeRefs(ir)) {
    const projected = projectionForRef(projection, ref);
    const method = validatorName(ref);
    if (ref.kind === "primitive") {
      if (ref.name === "unit") continue;
      lines.push(`    public static function ${method}(${projected.phpType} $value, string $path): void`, "    {");
      if (ref.name.startsWith("uint") && ref.name !== "uint64") {
        const maximum = (2n ** BigInt(Number(ref.name.slice(4))) - 1n).toString();
        lines.push(`        if ($value < 0 || $value > ${maximum}) {`, `            throw new \\ValueError($path . ' must be ${ref.name}');`, "        }");
      } else if (ref.name.startsWith("int") && !new Set(["int", "int64"]).has(ref.name)) {
        const bits = Number(ref.name.slice(3));
        const minimum = (-(2n ** BigInt(bits - 1))).toString();
        const maximum = (2n ** BigInt(bits - 1) - 1n).toString();
        lines.push(`        if ($value < ${minimum} || $value > ${maximum}) {`, `            throw new \\ValueError($path . ' must be ${ref.name}');`, "        }");
      } else if (ref.name === "int64") {
        lines.push("        if (PHP_INT_SIZE < 8) {", "            throw new \\LogicException('int64 requires a 64-bit PHP build');", "        }");
      } else if (new Set(["uint64", "nat"]).has(ref.name)) {
        lines.push("        if (str_starts_with((string) $value, '-')) {", `            throw new \\ValueError($path . ' must be ${ref.name}');`, "        }");
      } else if (ref.name === "string") {
        lines.push("        if (preg_match('//u', $value) !== 1) {", "            throw new \\ValueError($path . ' must contain valid UTF-8');", "        }");
      } else if (ref.name === "float32") {
        lines.push("        if (!is_finite($value) || abs($value) > 3.4028234663852886e+38) {", "            throw new \\ValueError($path . ' must fit float32');", "        }");
      }
      lines.push("    }", "");
      continue;
    }
    if (ref.kind === "named") {
      const type = namedType(ir, ref.id);
      const typeCode = type.kind === "callback" ? "callable" : `\\${projection.package.namespace}\\${type.name}`;
      lines.push(`    public static function ${method}(${typeCode} $value, string $path): void`, "    {", "    }", "");
      continue;
    }
    if (ref.kind === "apply") {
      if (ref.constructor === "result") {
        fail("unsupported-result-type", "PHP POC does not yet generate Result value objects", { ref });
      }
      lines.push(`    public static function ${method}(${projected.phpType} $value, string $path): void`, "    {");
      if (ref.constructor === "array") {
        lines.push("        if (!array_is_list($value)) {", "            throw new \\ValueError($path . ' must be a list');", "        }", "        foreach ($value as $index => $item) {", `            self::${validatorName(resolveAlias(ir, ref.arguments[0]))}($item, $path . '[' . $index . ']');`, "        }");
      } else if (ref.constructor === "option") {
        lines.push("        if ($value !== null) {", `            self::${validatorName(resolveAlias(ir, ref.arguments[0]))}($value, $path);`, "        }");
      } else if (ref.constructor === "tuple") {
        lines.push(`        if (!array_is_list($value) || count($value) !== ${ref.arguments.length}) {`, `            throw new \\ValueError($path . ' must be a ${ref.arguments.length}-tuple');`, "        }");
        ref.arguments.forEach((argument, index) => lines.push(`        self::${validatorName(resolveAlias(ir, argument))}($value[${index}], $path . '[${index}]');`));
      }
      lines.push("    }", "");
    }
  }
  lines.push("}", "");
  return lines.join("\n");
};

const emitTransport = projection => {
  const namespace = `${projection.package.namespace}\\Internal`;
  const lines = fileHeader(namespace, projection.bindingIrSha256);
  lines.push("interface Transport", "{", "    public function initialize(): void;", "");
  for (const operation of projection.operations) {
    const parameters = [];
    if (operation.receiver) parameters.push(`${operation.receiver.transportType} $self`);
    parameters.push(...operation.parameters.map(parameter => `${parameter.transportType} $${parameter.name}`));
    const result = operation.delivery.kind === "value" ? operation.result.transportType : operation.delivery.phpType;
    lines.push(`    public function ${operation.transportMethod}(${parameters.join(", ")}): ${result};`, "");
  }
  for (const operation of projection.lifecycle) {
    if (operation.kind === "resource-close" || operation.kind === "callable-close") {
      lines.push(`    public function ${operation.transportMethod}(${operation.parameterType} $self): void;`, "");
    } else {
      const parameters = [`${operation.receiverType} $self`, ...operation.parameters.map(parameter => `${parameter.transportType} $${parameter.name}`)];
      const result = operation.delivery.kind === "value" ? operation.result.transportType : operation.delivery.phpType;
      lines.push(`    public function ${operation.transportMethod}(${parameters.join(", ")}): ${result};`, "");
    }
  }
  lines.push("}", "");
  return lines.join("\n");
};

const emitIdentity = projection => `${fileHeader(`${projection.package.namespace}\\Internal`, projection.bindingIrSha256).join("\n")}
final readonly class Identity
{
    public function __construct(
        private string $kind,
        private string $key,
        private mixed $value,
    ) {
        if ($kind === '' || $key === '') {
            throw new \\InvalidArgumentException('Identity kind and key must be non-empty');
        }
    }

    public function kind(): string
    {
        return $this->kind;
    }

    public function cacheKey(): string
    {
        return $this->kind . "\\0" . $this->key;
    }

    public function value(): mixed
    {
        return $this->value;
    }
}
`;

const emitIdentityCache = projection => `${fileHeader(`${projection.package.namespace}\\Internal`, projection.bindingIrSha256).join("\n")}
final class IdentityCache
{
    /** @var array<string, \\WeakReference<object>> */
    private array $byIdentity = [];

    /** @var \\WeakMap<object, Identity> */
    private \\WeakMap $byObject;

    public function __construct()
    {
        $this->byObject = new \\WeakMap();
    }

    public function get(Identity $identity): ?object
    {
        $key = $identity->cacheKey();
        $object = $this->byIdentity[$key] ?? null;
        $object = $object?->get();
        if ($object === null) {
            unset($this->byIdentity[$key]);
        }
        return $object;
    }

    public function register(Identity $identity, object $object): object
    {
        $key = $identity->cacheKey();
        $existing = $this->get($identity);
        if ($existing !== null && $existing !== $object) {
            throw new \\LogicException('A live PHP wrapper already owns this runtime identity');
        }
        $this->byIdentity[$key] = \\WeakReference::create($object);
        $this->byObject[$object] = $identity;
        return $object;
    }

    public function identity(object $object): Identity
    {
        return $this->byObject[$object] ?? throw new \\LogicException('Object is not registered with this Lean runtime');
    }

    public function forget(object $object): void
    {
        $identity = $this->byObject[$object] ?? null;
        if ($identity === null) {
            return;
        }
        unset($this->byObject[$object], $this->byIdentity[$identity->cacheKey()]);
    }

    public function clear(): void
    {
        $this->byIdentity = [];
        $this->byObject = new \\WeakMap();
    }
}
`;

const emitRuntime = projection => {
  const root = projection.package.namespace;
  return `${fileHeader(`${root}\\Internal`, projection.bindingIrSha256, [`${root}\\InitializationError`, `${root}\\RuntimeUnavailable`, `${root}\\UnexpectedError`]).join("\n")}
final class Runtime
{
    private static ?Transport $transport = null;
    private static string $state = 'absent';
    private static ?\\Throwable $initializationFailure = null;
    private static ?\\Throwable $unexpectedFailure = null;
    private static ?IdentityCache $identities = null;

    public static function install(Transport $transport): void
    {
        if (self::$transport !== null) {
            throw new \\LogicException('A PHP transport is already installed for this Lean runtime');
        }
        self::$transport = $transport;
        self::$state = 'fresh';
        self::$initializationFailure = null;
        self::$unexpectedFailure = null;
        self::$identities = new IdentityCache();
    }

    public static function transport(): Transport
    {
        $transport = self::$transport ?? throw new RuntimeUnavailable('Install a native Zend or PHP-Wasm transport before the first Lean call');
        if (self::$state === 'failed') {
            throw new InitializationError('Lean runtime initialization previously failed', previous: self::$initializationFailure);
        }
        if (self::$state === 'poisoned') {
            throw new UnexpectedError('Lean runtime is unavailable after an unexpected transport failure', previous: self::$unexpectedFailure);
        }
        if (self::$state === 'fresh') {
            try {
                $transport->initialize();
                self::$state = 'ready';
            } catch (\\Throwable $error) {
                self::$state = 'failed';
                self::$initializationFailure = $error;
                throw new InitializationError('Lean runtime initialization failed', previous: $error);
            }
        }
        return $transport;
    }

    public static function identities(): IdentityCache
    {
        self::transport();
        return self::$identities ?? throw new RuntimeUnavailable('Lean identity cache is unavailable');
    }

    public static function unexpected(\\Throwable $error, bool $poison): UnexpectedError
    {
        if ($poison) {
            self::$state = 'poisoned';
            self::$unexpectedFailure = $error;
        }
        return new UnexpectedError('Generated PHP binding detected an unexpected transport failure', previous: $error);
    }

    public static function resetForTesting(): void
    {
        self::$identities?->clear();
        self::$identities = null;
        self::$transport = null;
        self::$state = 'absent';
        self::$initializationFailure = null;
        self::$unexpectedFailure = null;
    }
}
`;
};

const emitHydrator = projection => `${fileHeader(`${projection.package.namespace}\\Internal`, projection.bindingIrSha256).join("\n")}
final class Hydrator
{
    /** @template T of object
     * @param class-string<T> $class
     * @return T
     */
    public static function canonical(string $class, Identity $identity): object
    {
        $cache = Runtime::identities();
        $existing = $cache->get($identity);
        if ($existing !== null) {
            if (!$existing instanceof $class) {
                throw new \\LogicException('Runtime identity changed its projected PHP class');
            }
            return $existing;
        }
        $reflection = new \\ReflectionClass($class);
        $object = $reflection->newInstanceWithoutConstructor();
        $reflection->getProperty('identity')->setValue($object, $identity);
        $reflection->getProperty('closed')->setValue($object, false);
        return $cache->register($identity, $object);
    }

    public static function identity(object $object): Identity
    {
        return Runtime::identities()->identity($object);
    }
}
`;

const emitTransportError = projection => `${fileHeader(`${projection.package.namespace}\\Internal`, projection.bindingIrSha256).join("\n")}
final class TransportError extends \\RuntimeException
{
    public function __construct(
        private readonly string $errorId,
        string $message = 'Lean transport reported a declared error',
        ?\\Throwable $previous = null,
    ) {
        parent::__construct($message, 0, $previous);
    }

    public function errorId(): string
    {
        return $this->errorId;
    }
}
`;

const emitBytes = projection => `${fileHeader(projection.package.namespace, projection.bindingIrSha256).join("\n")}
final readonly class Bytes implements \\Countable, \\Stringable
{
    private function __construct(private string $value)
    {
    }

    public static function fromString(string $value): self
    {
        return new self($value);
    }

    public function toString(): string
    {
        return $this->value;
    }

    public function count(): int
    {
        return strlen($this->value);
    }

    public function __toString(): string
    {
        return $this->value;
    }
}
`;

const emitBigInteger = projection => `${fileHeader(projection.package.namespace, projection.bindingIrSha256).join("\n")}
final readonly class BigInteger implements \\Stringable
{
    private function __construct(private string $decimal)
    {
    }

    public static function fromDecimal(string $decimal): self
    {
        if (preg_match('/^-?(?:0|[1-9][0-9]*)$/D', $decimal) !== 1) {
            throw new \\ValueError('BigInteger requires canonical decimal text');
        }
        return new self($decimal);
    }

    public function __toString(): string
    {
        return $this->decimal;
    }
}
`;

const emitAwaitable = projection => `${fileHeader(projection.package.namespace, projection.bindingIrSha256).join("\n")}
/** @template T */
interface Awaitable
{
    /** @return T */
    public function await(): mixed;

    public function cancel(): void;
}
`;

const emitAsyncIterator = projection => `${fileHeader(projection.package.namespace, projection.bindingIrSha256).join("\n")}
/** @template T */
interface AsyncIterator
{
    /** @return Awaitable<?T> */
    public function next(): Awaitable;

    public function close(): void;
}
`;

const emitError = (projection, name, documentation, id = null) => {
  const lines = fileHeader(projection.package.namespace, projection.bindingIrSha256);
  lines.push(...docBlock(documentation), `class ${name} extends \\RuntimeException`, "{");
  if (id !== null) lines.push(`    public const ID = ${phpString(id)};`);
  lines.push("}", "");
  return lines.join("\n");
};

const emitRecord = (ir, projection, type, projected) => {
  const lines = fileHeader(projection.package.namespace, projection.bindingIrSha256, [`${projection.package.namespace}\\Internal\\Validators`]);
  const tags = type.fields
    .filter(field => phpDocType(projection, resolveAlias(ir, field.type)) !== phpType(projection, resolveAlias(ir, field.type)))
    .map(field => `@property-read ${phpDocType(projection, resolveAlias(ir, field.type))} $${field.name}`);
  lines.push(...docBlock(type.documentation, tags), `${projected.readonly ? "final readonly" : "final"} class ${type.name}`, "{");
  for (const field of type.fields) {
    lines.push(`    public ${phpType(projection, resolveAlias(ir, field.type))} $${field.name};`);
  }
  lines.push("");
  const parameters = type.fields.map(field => `${phpType(projection, resolveAlias(ir, field.type))} $${field.name}`);
  lines.push(`    public function __construct(${parameters.join(", ")})`, "    {");
  for (const field of type.fields) {
    const ref = resolveAlias(ir, field.type);
    lines.push(`        Validators::${validatorName(ref)}($${field.name}, ${phpString(`${type.name}.${field.name}`)});`);
    if (ref.kind === "apply" && new Set(["array", "tuple"]).has(ref.constructor)) {
      lines.push(`        $this->${field.name} = array_values($${field.name});`);
    } else {
      lines.push(`        $this->${field.name} = $${field.name};`);
    }
  }
  lines.push("    }", "}", "");
  return lines.join("\n");
};

const errorTranslation = (projection, operation, indent) => {
  const errors = new Map(projection.errors.map(error => [error.id, error]));
  const branches = operation.failure.errors.map(id => {
    const error = errors.get(id);
    return `${indent}        ${phpString(id)} => new \\${error.fqcn}($error->getMessage(), previous: $error),`;
  });
  const poison = operation.failure.unexpected === "poison-runtime" ? "true" : "false";
  return [
    `${indent}} catch (TransportError $error) {`,
    `${indent}    throw match ($error->errorId()) {`,
    ...branches,
    `${indent}        default => Runtime::unexpected($error, ${poison}),`,
    `${indent}    };`,
    `${indent}} catch (\\Throwable $error) {`,
    `${indent}    throw Runtime::unexpected($error, ${poison});`,
    `${indent}}`,
  ];
};

const transportArgument = (ir, parameter) => isIdentity(ir, parameter.type) && namedType(ir, namedTypeId(resolveAlias(ir, parameter.type)))?.kind === "resource"
  ? `Hydrator::identity($${parameter.name})`
  : `$${parameter.name}`;

const resultLines = (ir, projection, operation, expression, indent) => {
  const declaration = ir.declarations.find(item => item.id === operation.id);
  const resolved = resolveAlias(ir, declaration.result.type);
  const resultNamed = resolved.kind === "named" ? namedType(ir, resolved.id) : null;
  if (operation.delivery.kind !== "value") return [`${indent}return ${expression};`];
  if (resolved.kind === "primitive" && resolved.name === "unit") return [`${indent}${expression};`, `${indent}return;`];
  if (resultNamed?.representation === "identity") {
    return [
      `${indent}$identity = ${expression};`,
      `${indent}/** @var \\${projection.package.namespace}\\${resultNamed.name} $result */`,
      `${indent}$result = Hydrator::canonical(${resultNamed.name}::class, $identity);`,
      `${indent}return $result;`,
    ];
  }
  const ref = resolveAlias(ir, declaration.result.type);
  return [
    `${indent}$result = ${expression};`,
    `${indent}Validators::${validatorName(ref)}($result, ${phpString(`${declaration.name}.result`)});`,
    `${indent}return $result;`,
  ];
};

const operationBody = (ir, projection, operation, expression, indent = "        ") => [
  `${indent}try {`,
  ...resultLines(ir, projection, operation, expression, `${indent}    `),
  ...errorTranslation(projection, operation, indent),
];

const emitResource = (ir, projection, type, projected) => {
  const imports = [
    `${projection.package.namespace}\\Internal\\Hydrator`,
    `${projection.package.namespace}\\Internal\\Identity`,
    `${projection.package.namespace}\\Internal\\Runtime`,
    `${projection.package.namespace}\\Internal\\TransportError`,
    `${projection.package.namespace}\\Internal\\Validators`,
  ];
  const lines = fileHeader(projection.package.namespace, projection.bindingIrSha256, imports);
  const operations = projection.operations.filter(operation => operation.public.class === projected.fqcn);
  const constructor = operations.find(operation => operation.public.kind === "constructor");
  const properties = new Map();
  for (const operation of operations.filter(operation => operation.public.kind === "property")) {
    const group = properties.get(operation.public.name) ?? {};
    group[operation.parameters.length === 0 ? "getter" : "setter"] = operation;
    properties.set(operation.public.name, group);
  }
  const propertyTags = [...properties].map(([name, group]) => {
    const ref = group.getter
      ? ir.declarations.find(item => item.id === group.getter.id).result.type
      : ir.declarations.find(item => item.id === group.setter.id).parameters[0].type;
    return `@property${group.setter ? "" : "-read"} ${phpDocType(projection, resolveAlias(ir, ref))} $${name}`;
  });
  lines.push(...docBlock(type.documentation, propertyTags), `final class ${type.name}`, "{", "    private Identity $identity;", "    private bool $closed;", "");
  if (!constructor) fail("missing-constructor", `${type.id} has no generated PHP constructor`);
  const declaration = ir.declarations.find(item => item.id === constructor.id);
  lines.push(`    public function __construct(${declaration.parameters.map(parameter => parameterCode(projection, parameter)).join(", ")})`, "    {");
  for (const parameter of declaration.parameters) {
    lines.push(`        Validators::${validatorName(resolveAlias(ir, parameter.type))}($${parameter.name}, ${phpString(`${declaration.name}.${parameter.name}`)});`);
  }
  lines.push(
    "        $transport = Runtime::transport();",
    "        try {",
    `            $this->identity = $transport->${constructor.transportMethod}(${declaration.parameters.map(parameter => transportArgument(ir, parameter)).join(", ")});`,
    ...errorTranslation(projection, constructor, "        "),
    "        $this->closed = false;",
    "        Runtime::identities()->register($this->identity, $this);",
    "    }",
    "",
  );
  for (const operation of operations.filter(item => item.public.kind === "method")) {
    const method = ir.declarations.find(item => item.id === operation.id);
    lines.push(...docBlock(method.documentation), `    public function ${method.name}(${method.parameters.map(parameter => parameterCode(projection, parameter)).join(", ")}): ${resultType(projection, operation)}`, "    {", "        $this->requireOpen();");
    for (const parameter of method.parameters) lines.push(`        Validators::${validatorName(resolveAlias(ir, parameter.type))}($${parameter.name}, ${phpString(`${method.name}.${parameter.name}`)});`);
    const args = ["$this->identity", ...method.parameters.map(parameter => transportArgument(ir, parameter))];
    lines.push(...operationBody(ir, projection, operation, `Runtime::transport()->${operation.transportMethod}(${args.join(", ")})`), "    }", "");
  }
  if (properties.size > 0) {
    lines.push("    public function __get(string $name): mixed", "    {", "        $this->requireOpen();", "        switch ($name) {");
    for (const [name, group] of properties) {
      if (!group.getter) continue;
      const getter = ir.declarations.find(item => item.id === group.getter.id);
      lines.push(`            case ${phpString(name)}:`);
      lines.push(...operationBody(
        ir,
        projection,
        group.getter,
        `Runtime::transport()->${group.getter.transportMethod}($this->identity)`,
        "                ",
      ));
    }
    lines.push("            default:", "                throw new \\LogicException('Unknown generated property ' . $name);", "        }", "    }", "");
    if ([...properties.values()].some(group => group.setter)) {
      lines.push("    public function __set(string $name, mixed $value): void", "    {", "        $this->requireOpen();", "        switch ($name) {");
      for (const [name, group] of properties) {
        if (!group.setter) continue;
        const setter = ir.declarations.find(item => item.id === group.setter.id);
        const parameter = setter.parameters[0];
        lines.push(
          `            case ${phpString(name)}:`,
          `                Validators::${validatorName(resolveAlias(ir, parameter.type))}($value, ${phpString(`${name}.value`)});`,
          ...operationBody(
            ir,
            projection,
            group.setter,
            `Runtime::transport()->${group.setter.transportMethod}($this->identity, $value)`,
            "                ",
          ),
        );
      }
      lines.push("            default:", "                throw new \\LogicException('Unknown generated property ' . $name);", "        }", "    }", "");
    }
  }
  const close = projection.lifecycle.find(operation => operation.kind === "resource-close" && operation.type === type.id);
  lines.push(
    "    public function close(): void",
    "    {",
    "        if ($this->closed) {",
    "            return;",
    "        }",
    "        $this->closed = true;",
    "        try {",
    `            Runtime::transport()->${close.transportMethod}($this->identity);`,
    ...errorTranslation(projection, close, "        "),
    "        finally {",
    "            Runtime::identities()->forget($this);",
    "        }",
    "    }",
    "",
    "    public function __destruct()",
    "    {",
    "        try {",
    "            $this->close();",
    "        } catch (\\Throwable) {",
    "        }",
    "    }",
    "",
    "    private function requireOpen(): void",
    "    {",
    "        if ($this->closed) {",
    `            throw new DisposedResource(${phpString(`${type.name} is closed`)});`,
    "        }",
    "    }",
    "}",
    "",
  );
  return lines.join("\n");
};

const emitCallback = (ir, projection, type, projected) => {
  const imports = [
    `${projection.package.namespace}\\Internal\\Identity`,
    `${projection.package.namespace}\\Internal\\Runtime`,
    `${projection.package.namespace}\\Internal\\TransportError`,
    `${projection.package.namespace}\\Internal\\Validators`,
  ];
  const lines = fileHeader(projection.package.namespace, projection.bindingIrSha256, imports);
  const call = projection.lifecycle.find(operation => operation.kind === "callable-call" && operation.type === type.id);
  const close = projection.lifecycle.find(operation => operation.kind === "callable-close" && operation.type === type.id);
  lines.push(...docBlock(type.documentation), `final class ${type.name}`, "{", "    private Identity $identity;", "    private bool $closed;", "", "    private function __construct()", "    {", "    }", "", `    public function __invoke(${type.callable.parameters.map(parameter => parameterCode(projection, parameter)).join(", ")}): ${call.delivery.phpType}`, "    {", "        $this->requireOpen();");
  for (const parameter of type.callable.parameters) lines.push(`        Validators::${validatorName(resolveAlias(ir, parameter.type))}($${parameter.name}, ${phpString(`${type.name}.${parameter.name}`)});`);
  const expression = `Runtime::transport()->${call.transportMethod}($this->identity${type.callable.parameters.length ? ", " : ""}${type.callable.parameters.map(parameter => `$${parameter.name}`).join(", ")})`;
  lines.push(
    "        try {",
    `            $result = ${expression};`,
    `            Validators::${validatorName(resolveAlias(ir, type.callable.result.type))}($result, ${phpString(`${type.name}.result`)});`,
    "            return $result;",
    ...errorTranslation(projection, call, "        "),
    "    }",
    "",
    "    public function close(): void",
    "    {",
    "        if ($this->closed) {",
    "            return;",
    "        }",
    "        $this->closed = true;",
    "        try {",
    `            Runtime::transport()->${close.transportMethod}($this->identity);`,
    ...errorTranslation(projection, close, "        "),
    "        finally {",
    "            Runtime::identities()->forget($this);",
    "        }",
    "    }",
    "",
    "    public function __destruct()",
    "    {",
    "        try {",
    "            $this->close();",
    "        } catch (\\Throwable) {",
    "        }",
    "    }",
    "",
    "    private function requireOpen(): void",
    "    {",
    "        if ($this->closed) {",
    `            throw new DisposedResource(${phpString(`${type.name} is closed`)});`,
    "        }",
    "    }",
    "}",
    "",
  );
  return lines.join("\n");
};

const emitFunctions = (ir, projection) => {
  const imports = [
    `${projection.package.namespace}\\Internal\\Hydrator`,
    `${projection.package.namespace}\\Internal\\Runtime`,
    `${projection.package.namespace}\\Internal\\TransportError`,
    `${projection.package.namespace}\\Internal\\Validators`,
  ];
  const lines = fileHeader(projection.package.namespace, projection.bindingIrSha256, imports);
  for (const operation of projection.operations.filter(item => item.public.kind === "function")) {
    const declaration = ir.declarations.find(item => item.id === operation.id);
    lines.push(...docBlock(declaration.documentation), `function ${declaration.name}(${declaration.parameters.map(parameter => parameterCode(projection, parameter)).join(", ")}): ${resultType(projection, operation)}`, "{");
    for (const parameter of declaration.parameters) lines.push(`    Validators::${validatorName(resolveAlias(ir, parameter.type))}($${parameter.name}, ${phpString(`${declaration.name}.${parameter.name}`)});`);
    lines.push(...operationBody(ir, projection, operation, `Runtime::transport()->${operation.transportMethod}(${declaration.parameters.map(parameter => transportArgument(ir, parameter)).join(", ")})`, ""), "}", "");
  }
  return lines.join("\n");
};

const stubParameter = (projection, parameter) => parameterCode(projection, parameter);

const emitStub = (ir, projection, support) => {
  const lines = ["<?php", `// Generated from Binding IR SHA-256 ${projection.bindingIrSha256}.`, `namespace ${projection.package.namespace};`, ""];
  if (support.bytes) lines.push("final readonly class Bytes implements \\Countable, \\Stringable { public static function fromString(string $value): self {} public function toString(): string {} public function count(): int {} public function __toString(): string {} }", "");
  if (support.bigInteger) lines.push("final readonly class BigInteger implements \\Stringable { public static function fromDecimal(string $decimal): self {} public function __toString(): string {} }", "");
  if (support.awaitable) lines.push("/** @template T */ interface Awaitable { /** @return T */ public function await(); public function cancel(): void; }", "");
  if (support.asyncIterator) lines.push("/** @template T */ interface AsyncIterator { /** @return Awaitable<?T> */ public function next(): Awaitable; public function close(): void; }", "");
  for (const error of projection.errors) lines.push(`class ${error.name} extends \\RuntimeException { public const ID = ${phpString(error.id)}; }`, "");
  for (const name of ["RuntimeUnavailable", "InitializationError", "UnexpectedError"]) lines.push(`class ${name} extends \\RuntimeException {}`, "");
  for (const type of ir.types.filter(item => item.kind === "record")) {
    lines.push(...docBlock(type.documentation), `final readonly class ${type.name}`, "{");
    for (const field of type.fields) lines.push(`    public ${phpType(projection, resolveAlias(ir, field.type))} $${field.name};`);
    lines.push(`    public function __construct(${type.fields.map(field => `${phpType(projection, resolveAlias(ir, field.type))} $${field.name}`).join(", ")}) {}`, "}", "");
  }
  for (const type of ir.types.filter(item => item.kind === "resource")) {
    const projected = projection.types.find(item => item.id === type.id);
    const operations = projection.operations.filter(operation => operation.public.class === projected.fqcn);
    const constructor = operations.find(operation => operation.public.kind === "constructor");
    const constructorDeclaration = ir.declarations.find(item => item.id === constructor.id);
    const propertyGroups = new Map();
    for (const operation of operations.filter(item => item.public.kind === "property")) {
      const group = propertyGroups.get(operation.public.name) ?? {};
      group[operation.parameters.length === 0 ? "getter" : "setter"] = operation;
      propertyGroups.set(operation.public.name, group);
    }
    const propertyTags = [...propertyGroups].map(([name, group]) => {
      const typeName = group.getter?.result.type.phpDocType ?? group.setter.parameters[0].type.phpDocType;
      return `@property${group.setter ? "" : "-read"} ${typeName} $${name}`;
    });
    lines.push(...docBlock(type.documentation, propertyTags), `final class ${type.name}`, "{", `    public function __construct(${constructorDeclaration.parameters.map(parameter => stubParameter(projection, parameter)).join(", ")}) {}`);
    for (const operation of operations.filter(item => item.public.kind === "method")) {
      const declaration = ir.declarations.find(item => item.id === operation.id);
      lines.push(`    public function ${declaration.name}(${declaration.parameters.map(parameter => stubParameter(projection, parameter)).join(", ")}): ${resultType(projection, operation)} {}`);
    }
    lines.push("    public function close(): void {}", "}", "");
  }
  for (const type of ir.types.filter(item => item.kind === "callback")) {
    const projected = projection.types.find(item => item.id === type.id);
    lines.push(...docBlock(type.documentation), `final class ${type.name}`, "{", "    private function __construct() {}", `    public function __invoke(${type.callable.parameters.map(parameter => stubParameter(projection, parameter)).join(", ")}): ${projected.delivery.phpType} {}`, "    public function close(): void {}", "}", "");
  }
  for (const operation of projection.operations.filter(item => item.public.kind === "function")) {
    const declaration = ir.declarations.find(item => item.id === operation.id);
    lines.push(...docBlock(declaration.documentation), `function ${declaration.name}(${declaration.parameters.map(parameter => stubParameter(projection, parameter)).join(", ")}): ${resultType(projection, operation)} {}`, "");
  }
  return lines.join("\n");
};

const exampleValue = (ir, projection, ref, stack = new Set()) => {
  const resolved = resolveAlias(ir, ref);
  if (resolved.kind === "primitive") {
    if (resolved.name === "unit") return "null";
    if (resolved.name === "bool") return "false";
    if (new Set(["uint64", "int64", "nat", "int"]).has(resolved.name)) {
      return `\\${projection.package.namespace}\\BigInteger::fromDecimal('1')`;
    }
    if (resolved.name.startsWith("uint") || resolved.name.startsWith("int")) return "1";
    if (resolved.name.startsWith("float")) return "1.0";
    if (resolved.name === "string") return "'example'";
    if (resolved.name === "bytes") return `\\${projection.package.namespace}\\Bytes::fromString("\\x00\\x7f\\xff")`;
  }
  if (resolved.kind === "apply") {
    if (resolved.constructor === "option") return "null";
    if (resolved.constructor === "array") return `[${exampleValue(ir, projection, resolved.arguments[0], stack)}]`;
    if (resolved.constructor === "tuple") {
      return `[${resolved.arguments.map(argument => exampleValue(ir, projection, argument, stack)).join(", ")}]`;
    }
  }
  if (resolved.kind === "named") {
    const type = namedType(ir, resolved.id);
    if (stack.has(type.id)) return null;
    const next = new Set(stack).add(type.id);
    if (type.kind === "record") {
      const fields = type.fields.map(field => exampleValue(ir, projection, field.type, next));
      if (fields.some(value => value === null)) return null;
      return `new \\${projection.package.namespace}\\${type.name}(${fields.join(", ")})`;
    }
    if (type.kind === "callback") {
      const result = exampleValue(ir, projection, type.callable.result.type, next);
      return result === null ? null : `static fn() => ${result}`;
    }
  }
  return null;
};

const emitReadme = (ir, projection) => {
  const firstFunction = ir.declarations.find(declaration => declaration.kind === "function");
  const lines = [
    `# ${ir.component.name} for PHP`,
    "",
    ir.documentation.summary,
    "",
    "Install the package and one transport adapter. Native PHP and PHP-Wasm expose the same namespace, classes, functions, exceptions, and ownership behavior.",
    "",
    "```sh",
    `composer require ${projection.package.composerName}`,
    "```",
    "",
  ];
  const argumentsCode = firstFunction?.parameters.map(parameter => exampleValue(ir, projection, parameter.type));
  if (firstFunction && argumentsCode.every(value => value !== null)) {
    lines.push(
      "```php",
      "<?php",
      "",
      `$result = \\${projection.package.namespace}\\${firstFunction.name}(${argumentsCode.join(", ")});`,
      "```",
      "",
    );
  }
  lines.push("Copied values cross as typed PHP objects. Text remains text, byte sequences use `Bytes`, integers retain their declared range, and typed lists retain element validation. The transport does not serialize the value to JSON.", "", "Identity-bearing Lean values become canonical PHP objects. Call `close()` when ownership is explicit. The destructor is a fallback.", "", `Binding IR SHA-256: \`${projection.bindingIrSha256}\``, "", "## Assurance", "");
  for (const claim of ir.assurance) lines.push(`- \`${claim.state}\` ${claim.claim}`);
  lines.push("");
  return lines.join("\n");
};

const supportProfile = projection => ({
  bytes: projection.requiredCapabilities.includes("bytes-value-v1"),
  bigInteger: projection.requiredCapabilities.includes("big-integer-value-v1"),
  awaitable: projection.requiredCapabilities.includes("bridge-awaitable-v1"),
  asyncIterator: projection.requiredCapabilities.includes("bridge-async-iterator-v1"),
});

const publicExports = (projection, support) => [
  ...(support.bytes ? [`${projection.package.namespace}\\Bytes`] : []),
  ...(support.bigInteger ? [`${projection.package.namespace}\\BigInteger`] : []),
  ...(support.awaitable ? [`${projection.package.namespace}\\Awaitable`] : []),
  ...(support.asyncIterator ? [`${projection.package.namespace}\\AsyncIterator`] : []),
  ...projection.types
    .filter(type => new Set(["value-object", "resource-object", "invokable-object"]).has(type.projection))
    .map(type => type.fqcn),
  ...projection.errors.map(error => error.fqcn),
  ...["RuntimeUnavailable", "InitializationError", "UnexpectedError"].map(name => `${projection.package.namespace}\\${name}`),
  ...projection.operations
    .filter(operation => operation.public.kind === "function")
    .map(operation => `${projection.package.namespace}\\${operation.public.name}`),
].filter((value, index, values) => values.indexOf(value) === index);

export const generatePhpBindingPackage = ir => {
  validateBindingIr(ir);
  validateCoverage(ir);
  const projection = compilePhpProjection(ir);
  const support = supportProfile(projection);
  const root = projection.package.namespace;
  const files = {};
  const publicFiles = [];
  const internalFiles = [];
  const addPublic = (path, source) => { files[path] = source; publicFiles.push(path); };
  const addInternal = (path, source) => { files[path] = source; internalFiles.push(path); };

  if (support.bytes) addPublic("src/Bytes.php", emitBytes(projection));
  if (support.bigInteger) addPublic("src/BigInteger.php", emitBigInteger(projection));
  if (support.awaitable) addPublic("src/Awaitable.php", emitAwaitable(projection));
  if (support.asyncIterator) addPublic("src/AsyncIterator.php", emitAsyncIterator(projection));
  for (const error of projection.errors) addPublic(`src/${error.name}.php`, emitError(projection, error.name, error.documentation, error.id));
  for (const [name, summary] of [
    ["RuntimeUnavailable", "No PHP transport has been installed for the shared Lean runtime."],
    ["InitializationError", "The shared Lean runtime failed initialization."],
    ["UnexpectedError", "The transport violated the generated PHP contract."],
  ]) addPublic(`src/${name}.php`, emitError(projection, name, { summary, details: "" }));
  for (const type of ir.types) {
    const projected = projection.types.find(item => item.id === type.id);
    if (type.kind === "record") addPublic(`src/${type.name}.php`, emitRecord(ir, projection, type, projected));
    if (type.kind === "resource") addPublic(`src/${type.name}.php`, emitResource(ir, projection, type, projected));
    if (type.kind === "callback") addPublic(`src/${type.name}.php`, emitCallback(ir, projection, type, projected));
  }
  addPublic("src/functions.php", emitFunctions(ir, projection));

  addInternal("src/Internal/Transport.php", emitTransport(projection));
  addInternal("src/Internal/Identity.php", emitIdentity(projection));
  addInternal("src/Internal/IdentityCache.php", emitIdentityCache(projection));
  addInternal("src/Internal/Runtime.php", emitRuntime(projection));
  addInternal("src/Internal/Hydrator.php", emitHydrator(projection));
  addInternal("src/Internal/TransportError.php", emitTransportError(projection));
  addInternal("src/Internal/Validators.php", emitValidators(ir, projection));

  const stub = `stubs/${snake(root)}.php`;
  files[stub] = emitStub(ir, projection, support);
  files["README.md"] = emitReadme(ir, projection);
  files["reflection.json"] = `${JSON.stringify({
    schemaVersion: 1,
    component: ir.component.id,
    bindingIrSha256: projection.bindingIrSha256,
    namespace: root,
    types: projection.types,
    errors: projection.errors,
    operations: projection.operations,
    lifecycle: projection.lifecycle,
  }, null, 2)}\n`;
  files["assurance.json"] = `${JSON.stringify({
    schemaVersion: 1,
    component: ir.component.id,
    bindingIrSha256: projection.bindingIrSha256,
    claims: ir.assurance,
  }, null, 2)}\n`;
  files["capability-gaps.json"] = `${JSON.stringify({
    schemaVersion: 1,
    component: ir.component.id,
    bindingIrSha256: projection.bindingIrSha256,
    target: "php-shared",
    supported: true,
    capabilityGaps: [],
    transportSelectionRequired: true,
    requiredTransportCapabilities: projection.requiredCapabilities,
  }, null, 2)}\n`;
  files["composer.json"] = `${JSON.stringify({
    name: projection.package.composerName,
    version: ir.component.version,
    description: ir.documentation.summary,
    type: "library",
    require: { php: ">=8.2" },
    autoload: {
      "psr-4": { [`${root}\\`]: "src/" },
      files: ["src/functions.php"],
    },
    extra: {
      "lean-bridge": {
        bindingIrSha256: projection.bindingIrSha256,
        transportInterface: `${root}\\Internal\\Transport`,
        stub,
      },
    },
  }, null, 2)}\n`;

  const manifestFiles = [...Object.keys(files), "binding-manifest.json"];
  const filesSha256 = Object.fromEntries(Object.entries(files).map(([path, source]) => [path, sha256(source)]));
  files["binding-manifest.json"] = `${JSON.stringify({
    schemaVersion: 1,
    component: ir.component.id,
    bindingIrSha256: hashBindingIr(ir),
    generator: { id: "lean-wasm/php", version: 1 },
    composerPackage: projection.package.composerName,
    namespace: root,
    transportInterface: projection.transport.interface,
    exports: publicExports(projection, support),
    capabilityGaps: [],
    requiredTransportCapabilities: projection.requiredCapabilities,
    publicFiles,
    internalFiles,
    stub,
    files: manifestFiles,
    filesSha256,
  }, null, 2)}\n`;
  auditPhpPackage(ir, files);
  return Object.freeze(files);
};
