/**
 * Whole Zend roots keep empty values and borrowed descendants tied to an owner.
 *
 * @file
 */
import { ownedPhpBorrowValue, ownedPhpBorrowAccess } from "./owned-borrows.mjs";

export const ownedZendBorrowValue = String.raw`
/** @template T */
final class Value
{
    private function __construct(private mixed $owner, private int $type,
        private mixed $payload, private ?\Closure $retainCall) {}
    /** @return T */
    public function get(): mixed {
        [, , $payload] = Internal\ValueAccess::snapshot($this); return $payload;
    }
    public function closed(): bool {
        if ($this->owner === null) return true;
        try { Internal\ValueAccess::snapshot($this); return false; }
        catch (LeanBridgeError $error) { if ($error->getCode() === 4) return true; throw $error; }
    }
    public function close(): void {
        if ($this->owner === null) return;
        Internal\Native::owner('close', $this->type, $this->owner);
        $this->owner = null; $this->payload = null; $this->retainCall = null;
    }
    /** @return Value<T> */
    public function share(): self {
        [$owner, $type, $payload, $retain] = Internal\ValueAccess::snapshot($this);
        return new self(Internal\Native::owner('share', $type, $owner), $type, $payload, $retain);
    }
    /** @return Value<T> */
    public function retain(): self {
        [, , $payload, $retain] = Internal\ValueAccess::snapshot($this);
        return $retain($payload);
    }
    public function equals(mixed $other): bool {
        [, $type, $payload] = Internal\ValueAccess::snapshot($this);
        if (!$other instanceof self) return false;
        [, $otherType, $otherPayload] = Internal\ValueAccess::snapshot($other);
        return $type === $otherType && Internal\Values::equal($payload, $otherPayload);
    }
    public function hashCode(): string {
        [, $type, $payload] = Internal\ValueAccess::snapshot($this);
        return hash('sha256', $type . ':' . Internal\Values::hash($payload));
    }
    public function __invoke(mixed ...$arguments): mixed { return ($this->get())(...$arguments); }
    private function __clone() {}
    public function __serialize(): array { throw new \LogicException('Lean owners cannot be serialized'); }
    public function __unserialize(array $data): void { throw new \LogicException('Lean owners cannot be deserialized'); }
    // The opaque Zend root's destructor invalidates the owner without entering
    // Lean from a Fiber. Native storage drains on the next main-context entry.
}
`;

export const ownedZendBorrowAccess = String.raw`
final class ValueAccess
{
    public static function wrap(mixed $owner, int $type, mixed $payload, \Closure $retain): @NAMESPACE@\Value {
        Native::owner('check', $type, $owner);
        $create = \Closure::bind(static fn() => new @NAMESPACE@\Value($owner, $type, $payload, $retain), null, @NAMESPACE@\Value::class);
        return $create();
    }
    public static function snapshot(@NAMESPACE@\Value $value, ?int $type = null): array {
        $read = \Closure::bind(static fn() => [$value->owner, $value->type, $value->payload, $value->retainCall], null, @NAMESPACE@\Value::class);
        $snapshot = $read();
        if ($snapshot[0] === null) throw new @NAMESPACE@\LeanBridgeError('Lean value is closed', 4);
        if ($type !== null && $snapshot[1] !== $type) throw new \TypeError('Wrong whole Lean value type');
        Native::owner('check', $snapshot[1], $snapshot[0]); return $snapshot;
    }
}
`;

/**
 * Whole-root resources differ from identity leaves and temporary native pins.
 * The lease runtime supplies checked pin/release and validity operations.
 */
export const ownedZendBorrowRoots = `
typedef struct {
  lgo_lease *lease;
  unsigned type;
} lgo_root;
static int lgo_root_resource_type;
static int lgo_root_fetch(zval *value, unsigned type, lgo_state *state,
    int closing, lgo_root **out) {
  *out = NULL; ZVAL_DEREF(value);
  if (Z_TYPE_P(value) != IS_RESOURCE || Z_RES_P(value)->type != lgo_root_resource_type
      || !Z_RES_P(value)->ptr) return LB_OWNED_INVALID;
  lgo_root *root = Z_RES_P(value)->ptr;
  if (root->type != type) return LB_OWNED_INVALID;
  if (!root->lease) { if (closing) { *out = root; return LB_OWNED_OK; } return LB_OWNED_CLOSED; }
  int status = closing ? lgo_affinity(root->lease->state) : lgo_lease_check(root->lease);
  if (status) return status;
  if (state && root->lease->state != state) return LB_OWNED_INVALID;
  *out = root; return LB_OWNED_OK;
}
static void lgo_root_release(lgo_root *root) {
  lgo_lease *lease = root->lease; root->lease = NULL;
  if (!lease) return;
  if (!lease->roots) { lean_bridge_native_runtime_retire(); return; }
  if (!--lease->roots) lease->invalid = 1;
  lgo_lease_release(lease);
}
static void lgo_root_destroy(zend_resource *resource) {
  lgo_root *root = resource->ptr; if (!root) return;
  resource->ptr = NULL; lgo_root_release(root); LB_ZEND_FREE(root);
}
static int lgo_root_wrap(lgo_lease *lease, unsigned type, zval *out) {
  int status = lgo_lease_check(lease); if (status) return status;
  if (lease->roots == SIZE_MAX) return LB_OWNED_LIMIT;
  lgo_root *root = LB_ZEND_CALLOC(1, sizeof(*root));
  if (!root) return LB_OWNED_ALLOC_FAILED;
  status = lgo_lease_retain(lease);
  if (status) { LB_ZEND_FREE(root); return status; }
  lease->whole = 1; ++lease->roots; root->lease = lease; root->type = type;
  zend_try { ZVAL_RES(out, zend_register_resource(root, lgo_root_resource_type)); }
  zend_catch { lgo_root_release(root); LB_ZEND_FREE(root); zend_bailout(); }
  zend_end_try(); return LB_OWNED_OK;
}
`;

const replace = (source, before, after) => {
	if(source.split(before).length !== 2) throw new TypeError("Zend whole-owner source anchor changed");
	return source.replace(before, after);
};

/**
 * Keep the public ownership API identical without using native PHP's FFI lease.
 *
 * @param model - Whole-owner Zend model.
 */
export const ownedZendBorrowFiles = model => {
	const files = { ...model.files };
	if(!model.anchoredResults) return files;
	files["src/Api.php"] = replace(files["src/Api.php"], ownedPhpBorrowValue, ownedZendBorrowValue);
	const namespace = `\\${model.namespace}`;
	files["src/Internal/Values.php"] = replace(files["src/Internal/Values.php"],
		ownedPhpBorrowAccess.replaceAll("@NAMESPACE@", namespace),
		ownedZendBorrowAccess.replaceAll("@NAMESPACE@", namespace));
	files["src/Internal/Values.php"] = files["src/Internal/Values.php"]
		.replaceAll("instanceof NativeBinding", "instanceof ZendBinding")
		.replaceAll("Expected native PHP resources", "Expected Zend resources");
	files["src/Api.php"] += String.raw`
function copy_value(mixed $value, mixed $resultOf = null, mixed $parameterOf = null): Value {
    if (\func_num_args() > 3) throw new \ArgumentCountError('copy_value accepts a payload and optional selector');
    if (($resultOf !== null && !\is_string($resultOf)) || ($parameterOf !== null && !\is_array($parameterOf)))
        throw new \TypeError('copy_value requires a string resultOf or an array parameterOf');
    return Internal\Native::copyValue($value, $resultOf, $parameterOf);
}
`;
	return files;
};

/**
 * Preserve whole owners across checked PHP conversion and opaque Zend calls.
 *
 * @param source - Base Zend PHP call runtime.
 * @param model - Whole-owner schema and public function names.
 * @param literal - Existing checked PHP literal encoder.
 */
export const ownedZendBorrowPhpRuntime = (source, model, literal) => {
	if(!model.anchoredResults) return source;
	const nodes = new Map(model.types.map(node => [node.id, node]));
	const nominals = Object.fromEntries(model.types.filter(node => node.representation !== "copied").flatMap(node =>
		(node.identity || node.kind === "record" ? [node.publicType] : node.cases.map(branch => branch.publicName))
			.map(name => [`${model.namespace}\\${name}`, node.index])));
	const results = Object.fromEntries(model.functions.filter(fn => nodes.get(fn.result).representation !== "copied")
		.map(fn => [fn.publicName, nodes.get(fn.result).index]));
	const parameters = {};
	for(const fn of model.functions) for(const [index, id] of fn.parameters.entries())
	{
		if(nodes.get(id).representation === "copied") continue;
		parameters[`${fn.publicName}/${index}`] = nodes.get(id).index;
		parameters[`${fn.publicName}/${fn.publicParameters[index]}`] = nodes.get(id).index;
	}
	source = replace(source, "    // The Zend resource destructor handles implicit release", String.raw`    public function sameIdentity(self $other): bool {
        $this->check(); $other->check();
        return $this->type === $other->type && Native::sameIdentity($this->type, $this->resource, $other->resource);
    }
    // The Zend resource destructor handles implicit release`);
	source = replace(source, "    private static int $depth = 0;", `    private const NOMINALS = ${literal(nominals)};
    private const RESULTS = ${literal(results)};
    private const PARAMETERS = ${literal(parameters)};
    private static int $depth = 0;`);
	source = replace(source, "    private static function malformed(GraphInvalidWire $error): never {", String.raw`    public static function owner(string $entry, int $type, mixed $owner): mixed {
        self::main();
        if (!in_array($entry, ['check', 'close', 'share'], true)) throw new \TypeError('Unknown whole-owner operation');
        $symbol = self::symbol('owner_' . $entry);
        try { return $symbol($type, $owner); }
        catch (\Exception $error) { throw new @NAMESPACE@\LeanBridgeError($error->getMessage(), $error->getCode(), $error); }
    }
    public static function sameIdentity(int $type, mixed $left, mixed $right): bool {
        self::main(); $symbol = self::symbol('equal');
        try { return $symbol($type, $left, $right); }
        catch (\Exception $error) { throw new @NAMESPACE@\LeanBridgeError($error->getMessage(), $error->getCode(), $error); }
    }
    private static function copyTyped(int $type, mixed $value): @NAMESPACE@\Value {
        return self::execute(['entry' => 'copy' . $type, 'parameters' => [$type], 'host' => [false],
            'wholeParameters' => [], 'result' => $type, 'whole' => true], [$value]);
    }
    public static function copyValue(mixed $value, ?string $resultOf, ?array $parameterOf): @NAMESPACE@\Value {
        self::main();
        if ($resultOf !== null && $parameterOf !== null) throw new \TypeError('Choose resultOf or parameterOf');
        $type = null;
        if ($resultOf !== null) $type = self::RESULTS[$resultOf] ?? null;
        elseif ($parameterOf !== null) {
            if (!array_is_list($parameterOf) || count($parameterOf) !== 2 || !is_string($parameterOf[0])
                || (!is_string($parameterOf[1]) && !is_int($parameterOf[1]))) throw new \TypeError('parameterOf requires [function, parameter]');
            $type = self::PARAMETERS[$parameterOf[0] . '/' . $parameterOf[1]] ?? null;
        } elseif ($value instanceof @NAMESPACE@\Value) return $value->retain();
        elseif (is_object($value)) $type = self::NOMINALS[$value::class] ?? null;
        if ($type === null) throw new \TypeError('Select an owned resultOf or parameterOf for this value');
        if ($value instanceof @NAMESPACE@\Value) { ValueAccess::snapshot($value, $type); return $value->retain(); }
        return self::copyTyped($type, $value);
    }
    private static function malformed(GraphInvalidWire $error): never {`);
	source = replace(source, "        $frame = new ZendFrame(); $prepared = [];", String.raw`        $frame = new ZendFrame(); $prepared = []; $owners = []; $wholeInputs = [];
        $unpublishedOwner = null; $wire = null; $payload = null;
        foreach ($fn['wholeParameters'] as $position) {
            $wholeInputs[$position] = $arguments[$position];
            [$owners[$position], , $arguments[$position]] = ValueAccess::snapshot($wholeInputs[$position], $fn['parameters'][$position]);
        }`);
	source = replace(source, `            foreach ($fn['parameters'] as $index => $type)
                $inputs[] = $fn['host'][$index] ? self::host($type, $prepared[$index], $frame)
                    : GraphWire::transfer($type, $arguments[$index], false, $frame->writing);`, String.raw`            foreach ($fn['parameters'] as $index => $type) {
                $wire = $fn['host'][$index] ? self::host($type, $prepared[$index], $frame)
                    : GraphWire::transfer($type, $arguments[$index], false, $frame->writing);
                $inputs[] = isset($owners[$index]) ? [$owners[$index], $wire] : $wire;
            }`);
	source = replace(source, "            return self::decode($fn['result'], $wire, $frame);", String.raw`            if (!$fn['whole']) return self::decode($fn['result'], $wire, $frame);
            if (!is_array($wire) || !array_is_list($wire) || count($wire) !== 2 || !is_resource($wire[0]))
                self::malformed(new GraphInvalidWire('Expected a whole-result owner and payload'));
            $type = $fn['result']; $unpublishedOwner = $wire[0]; self::owner('check', $type, $unpublishedOwner);
            $payload = self::decode($type, $wire[1], $frame);
            $result = ValueAccess::wrap($unpublishedOwner, $type, $payload, static fn(mixed $value) => self::copyTyped($type, $value));
            $unpublishedOwner = null; return $result;`);
	source = replace(source, "        } finally { $frame->active = false; --self::$depth; }", String.raw`        } finally {
            $frame->active = false; --self::$depth;
            // A retained exception can hold the opaque resource passed to a
            // failed PHP constructor. It never acquired a public whole owner.
            if ($unpublishedOwner !== null) self::owner('close', $fn['result'], $unpublishedOwner);
            $unpublishedOwner = null; $wire = null; $payload = null;
            $owners = []; $wholeInputs = []; $inputs = []; $prepared = []; $arguments = [];
        }`);
	return source;
};

/**
 * Separate public roots, temporary call pins and references to lease storage.
 * Last-root release revokes access immediately. Native storage can drain after
 * a pinned call returns even when PHP still holds expired identity wrappers.
 *
 * @param source - Existing Zend lifetime implementation.
 * @param model - Explicitly enabled whole-owner schema.
 */
export const ownedZendBorrowOwnership = (source, model) => {
	if(!model.anchoredResults) return source;
	source = replace(source, "  int pending, clearing;", `  int pending, clearing;
  size_t roots, pins;
  int whole, invalid;
  lgo_lease *anchor;`);
	source = replace(source, "static void lgo_lease_destroy(lgo_lease *lease) {", `static void lgo_lease_release(lgo_lease *lease);
static void lgo_lease_destroy(lgo_lease *lease) {`);
	source = replace(source, "  *position = lease->next; LB_ZEND_FREE(lease); lgo_state_release(state);", `  lgo_lease *anchor = lease->anchor;
  *position = lease->next; LB_ZEND_FREE(lease);
  if (anchor) lgo_lease_release(anchor);
  lgo_state_release(state);`);
	const start = source.indexOf("static int lgo_drain(lgo_state *state) {"), end = source.indexOf("static int lgo_lease_retain(lgo_lease *lease) {");
	if(start < 0 || end <= start) throw new TypeError("Zend drain source anchor changed");
	source = source.slice(0, start) + `static int lgo_drain(lgo_state *state) {
  int status = lgo_affinity(state); if (status) return status;
  status = lgo_state_retain(state); if (status) return status;
  int failure = LB_OWNED_OK;
  for (;;) {
    lgo_lease *lease = state->leases;
    while (lease) {
      if (!lease->clearing && !lease->pins
          && (!lease->references || (lease->whole && lease->invalid && !ov_owner_empty(&lease->owner)))) break;
      lease = lease->next;
    }
    if (!lease) break;
    lease->clearing = 1;
    int released = ov_owner_clear(&lease->owner); lease->clearing = 0;
    if (!failure) failure = released;
    if (!ov_owner_empty(&lease->owner)) break;
    if (!lease->references) lgo_lease_destroy(lease);
    // Releasing a child's strong anchor can destroy another registered lease.
    // Search the live list again instead of following a cached next pointer.
  }
  lgo_state_release(state); return failure;
}
static void lgo_lease_release(lgo_lease *lease) {
  if (!lease || !lease->references) return;
  if (!--lease->references) lease->pending = 1;
  if (!lease->references && lease->state->closing && ov_owner_empty(&lease->owner)) lgo_lease_destroy(lease);
  else if (lgo_main()) (void)lgo_drain(lease->state);
}
` + source.slice(end);
	source = replace(source, `  for (lgo_lease *lease = state->leases, *next; lease; lease = next) {
    next = lease->next;
    int released = ov_owner_clear(&lease->owner);
    if (!status) status = released;
    if (!lease->references && ov_owner_empty(&lease->owner)) lgo_lease_destroy(lease);
  }`, `  for (;;) {
    lgo_lease *lease = state->leases;
    while (lease && lease->references && ov_owner_empty(&lease->owner)) lease = lease->next;
    if (!lease) break;
    int released = ov_owner_clear(&lease->owner);
    if (!status) status = released;
    if (!ov_owner_empty(&lease->owner)) break;
    if (!lease->references) lgo_lease_destroy(lease);
  }`);
	source = replace(source, "static int lgo_handle_check(lgo_handle *handle) {", `static int lgo_lease_check(lgo_lease *lease) {
  if (!lease) return LB_OWNED_CLOSED;
  int status = lgo_ready(lease->state); if (status) return status;
  size_t depth = 0;
  for (lgo_lease *current = lease; current; current = current->anchor) {
    if (++depth > 129) return LB_OWNED_LIMIT;
    if (current->state != lease->state) return LB_OWNED_INVALID;
    if (!current->references || current->invalid || current->pending || current->clearing)
      return LB_OWNED_CLOSED;
    if (!lb_owned_batch_find(&current->state->native, &current->owner.batch,
        current->owner.batch.generation)) return LB_OWNED_CLOSED;
  }
  return LB_OWNED_OK;
}
static int lgo_lease_pin(lgo_lease *lease) {
  int status = lgo_lease_check(lease); if (status) return status;
  if (lease->pins == SIZE_MAX) return LB_OWNED_LIMIT;
  status = lgo_lease_retain(lease); if (!status) ++lease->pins; return status;
}
static void lgo_lease_unpin(lgo_lease *lease) {
  if (!lease || !lease->pins) return;
  --lease->pins; lgo_lease_release(lease);
}
static int lgo_handle_check(lgo_handle *handle) {`);
	source = replace(source, "    int status = lgo_ready(lease->state); if (status) return status;",
		"    int status = lgo_lease_check(lease); if (status) return status;");
	return source + ownedZendBorrowRoots;
};
