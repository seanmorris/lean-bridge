/**
 * Bounded PHP values for the private recursive Zend wire, without native handles.
 *
 * @file
 */

/** Iterative conversion used on either side of one generated Zend invocation. */
export const phpGraphWire = String.raw`
final class GraphInvalidWire extends \RuntimeException {}

final class GraphWireFrame
{
    public bool $entered = false;
    public int $index = 0;
    public int $count = 0;
    public array $items = [];
    public array $fields = [];
    public array $values = [];
    public ?string $class = null;
    public ?int $branch = null;
    public function __construct(public int $type, public mixed $value, public int $depth, public ?string $identity = null) {}
}

final class GraphWire
{
    // No user callback runs during conversion. Tests inject failures here to
    // exercise each construction point without modifying the production API.
    private static function checkpoint(): void {}

    public static function arguments(array $types, array $values): array {
        if (!array_is_list($values) || count($types) !== count($values)) throw new \ArgumentCountError('Wrong copied call arity');
        foreach ($types as $index => $type) Values::check($type, $values[$index]);
        $budget = new GraphBudget(); $budget->children(count($values)); $result = [];
        foreach ($types as $index => $type) $result[] = self::walk($type, $values[$index], false, $budget);
        return $result;
    }
    public static function toWire(int $type, mixed $value): mixed {
        Values::check($type, $value);
        return self::walk($type, $value, false, new GraphBudget());
    }
    public static function fromWire(int $type, mixed $value): mixed {
        $result = self::walk($type, $value, true, new GraphBudget());
        Values::check($type, $result);
        return $result;
    }
    private static function list(mixed $value, ?int $count = null): array {
        if (!is_array($value) || !array_is_list($value) || ($count !== null && count($value) !== $count))
            throw new GraphInvalidWire('Malformed copied wire list or arity');
        return $value;
    }
    private static function scalar(array $node, mixed $value, bool $reading, GraphBudget $budget): mixed {
        if ($reading) {
            if (($node['host'] ?? '') === 'bigint') {
                if (!is_string($value)) throw new GraphInvalidWire('Integer wire requires canonical decimal text');
                $budget->charge(strlen($value));
                if (strlen($value) > 16385 || strlen(ltrim($value, '-')) > 16384
                    || preg_match('/^(?:0|-?[1-9][0-9]*)$/D', $value) !== 1)
                    throw new GraphInvalidWire('Integer wire requires at most 16384 canonical decimal digits');
                self::checkpoint(); $value = \Brick\Math\BigInteger::of($value);
            } elseif ($node['name'] === 'bytes') {
                if (!is_string($value)) throw new GraphInvalidWire('ByteArray wire requires string bytes');
                $budget->charge(strlen($value)); self::checkpoint(); $value = GRAPH_NAMESPACE\Bytes::fromString($value);
            }
            // Keep allocation/depth failures recoverable. Range/type failures
            // indicate a broken private transport and must not be normalized.
            try { GraphScalars::check($node, $value, new GraphBudget()); }
            catch (\TypeError|\ValueError $error) { throw new GraphInvalidWire($error->getMessage(), 0, $error); }
        } else GraphScalars::check($node, $value, $budget);
        if (($node['host'] ?? '') === 'bigint') return $reading ? $value : (string) $value;
        if ($node['name'] === 'bytes') {
            if (!$reading) { $text = $value->toString(); $budget->charge(strlen($text)); return $text; }
        } elseif (is_string($value)) $budget->charge(strlen($value));
        return $value;
    }
    private static function enter(GraphWireFrame $frame, array $node, bool $reading, GraphBudget $budget): void {
        $kind = $node['kind']; $value = $frame->value;
        if ($kind === 'array' || $kind === 'list') $frame->items = self::list($value);
        elseif ($reading) {
            if ($kind === 'variant') {
                $wire = self::list($value, 2);
                if (!is_int($wire[0]) || $wire[0] < 0 || !isset($node['classes'][$wire[0]])) throw new GraphInvalidWire('Invalid copied variant wire tag');
                $frame->branch = $wire[0]; $frame->class = $node['classes'][$wire[0]];
                $frame->fields = GraphTypes::CLASSES[$frame->class]['fields'];
                $frame->items = self::list($wire[1], count($frame->fields));
            } elseif ($kind === 'option') {
                if ($value === null) return;
                $frame->items = self::list($value, 1); $frame->class = $node['classes'][0];
                $frame->fields = [['value', $node['fields'][0][1]]];
            } elseif ($kind === 'result') {
                $wire = self::list($value, 2);
                if (!is_bool($wire[0])) throw new GraphInvalidWire('Except wire tag requires bool');
                $frame->branch = $wire[0] ? 0 : 1; $frame->class = $node['classes'][$frame->branch];
                $frame->fields = [['value', $node['fields'][$frame->branch][1]]]; $frame->items = [$wire[1]];
            } else {
                $frame->fields = $node['fields']; $frame->items = self::list($value, count($frame->fields));
                $frame->class = $kind === 'record' ? $node['classes'][0] : null;
            }
        } elseif ($kind === 'tuple') {
            $frame->fields = $node['fields']; $frame->items = self::list($value, count($frame->fields));
        } elseif ($kind === 'option' && $value === null) return;
        else {
            $frame->class = $value::class; $branch = array_search($frame->class, $node['classes'], true);
            if ($branch === false) throw new \TypeError('Wrong copied constructor');
            $frame->branch = $branch;
            $frame->fields = $kind === 'option' || $kind === 'result' ? [['value', $node['fields'][$branch][1]]]
                : GraphTypes::CLASSES[$frame->class]['fields'];
            $properties = get_object_vars($value);
            if (array_keys($properties) !== array_column($frame->fields, 0)) throw new \TypeError('Copied fields must all be initialized');
            $frame->items = array_values($properties);
        }
        $frame->count = count($frame->items); $budget->children($frame->count);
        if ($frame->class !== null) $budget->charge(strlen($frame->class));
    }
    private static function construct(GraphWireFrame $frame, array $node, bool $reading): mixed {
        self::checkpoint();
        if ($node['kind'] === 'option' && $frame->class === null) return null;
        if (!$reading) {
            if ($node['kind'] === 'variant') return [$frame->branch, $frame->values];
            if ($node['kind'] === 'result') return [$frame->branch === 0, $frame->values[0]];
            return $frame->values;
        }
        if ($frame->class === null) return $frame->values;
        // Only exact final generated classes occur in the catalog. Constructing
        // once avoids recursive constructor validation of every completed tail.
        $reflection = new \ReflectionClass($frame->class); $value = $reflection->newInstanceWithoutConstructor();
        foreach ($frame->fields as $index => $field) $reflection->getProperty($field[0])->setValue($value, $frame->values[$index]);
        return $value;
    }
    private static function walk(int $type, mixed $value, bool $reading, GraphBudget $budget): mixed {
        $stack = [new GraphWireFrame($type, $value, 0)]; $active = [];
        while ($stack) {
            $frame = $stack[count($stack) - 1]; $node = GraphTypes::NODES[$frame->type] ?? throw new \TypeError('Unknown copied type');
            if (!$frame->entered) {
                $budget->step($frame->depth); $budget->charge(128); $frame->entered = true;
                if ($frame->identity !== null) {
                    if (isset($active[$frame->identity])) throw new GraphInvalidWire('Cyclic copied wire value');
                    $active[$frame->identity] = true;
                }
                if ($node['kind'] !== 'primitive') self::enter($frame, $node, $reading, $budget);
            }
            if ($node['kind'] === 'primitive' || $frame->index === $frame->count) {
                $result = $node['kind'] === 'primitive' ? self::scalar($node, $frame->value, $reading, $budget) : self::construct($frame, $node, $reading);
                if ($frame->identity !== null) unset($active[$frame->identity]);
                array_pop($stack);
                if (!$stack) return $result;
                $stack[count($stack) - 1]->values[] = $result; continue;
            }
            $index = $frame->index++; $child = $node['element'] ?? $frame->fields[$index][1];
            $reference = \ReflectionReference::fromArrayElement($frame->items, $index);
            self::checkpoint();
            $stack[] = new GraphWireFrame($child, $frame->items[$index], $frame->depth + 1, $reference === null ? null : $reference->getId());
        }
        throw new GraphInvalidWire('Missing copied result');
    }
}
`;
