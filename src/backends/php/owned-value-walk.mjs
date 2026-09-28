/**
 * Bounded PHP validation for recursive values with checked identity leaves.
 *
 * @file
 */

/**
 * Keep the cursor stack proportional to depth. Shared acyclic children remain
 * legal; array references and object identities detect path-local cycles.
 *
 * @param namespace - Validated generated component namespace.
 */
export const ownedPhpValueWalk = namespace => String.raw`
final class Values
{
    public static function check(int $type, mixed $value): void {
        foreach (self::walk($value, $type, new GraphBudget()) as $_) {}
    }
    public static function checkMany(array $types, array $values): void {
        if (!array_is_list($types) || !array_is_list($values) || count($types) !== count($values))
            throw new \ArgumentCountError('Wrong owned validation arity');
        $budget = new GraphBudget();
        foreach ($types as $index => $type) foreach (self::walk($values[$index], $type, $budget) as $_) {}
    }
    public static function checkFields(string $class, array $values): void {
        $fields = GraphTypes::CLASSES[$class]['fields'] ?? throw new \TypeError('Unknown owned constructor');
        if (count($fields) !== count($values)) throw new \ArgumentCountError('Wrong owned constructor arity');
        $budget = new GraphBudget(); $budget->step(0); $budget->children(count($fields));
        foreach ($fields as $index => $field) foreach (self::walk($values[$index], $field[1], $budget, 1) as $_) {}
    }
    private static function token(mixed $value, GraphBudget $budget, bool $checkedInteger): ?array {
        if ($value === null) return ['n', ''];
        if (is_bool($value)) return ['b', $value ? '1' : '0'];
        if (is_int($value)) return ['i', (string) $value];
        if (is_float($value)) return ['d', is_nan($value) ? 'nan' : pack('E', $value)];
        if (is_string($value)) { $budget->charge(strlen($value)); return ['s', $value]; }
        if ($value instanceof \Brick\Math\BigInteger) return ['g', $checkedInteger ? (string) $value : GraphScalars::decimal($value, $budget)];
        if ($value instanceof OWNED_NAMESPACE\Bytes) {
            try { $text = $value->toString(); }
            catch (\Error $error) { throw new \TypeError('Bytes must be initialized', 0, $error); }
            $budget->charge(strlen($text)); return ['y', $text];
        }
        return null;
    }
    private static function walk(mixed $value, ?int $type, GraphBudget $budget, int $depth = 0): \Generator {
        $stack = [[0, $type, $value, $depth, null]]; $active = [];
        while ($stack) {
            $frame = array_pop($stack);
            if ($frame[0] === 1) {
                [, $items, $fields, $element, $index, $count, $depth, $identity, $owner] = $frame;
                if ($index === $count) { if ($identity !== null) unset($active[$identity]); continue; }
                $key = $fields === null ? $index : $fields[$index][0];
                $childType = $fields === null ? $element : $fields[$index][1];
                $reference = \ReflectionReference::fromArrayElement($items, $key);
                $frame[4]++; $stack[] = $frame;
                $stack[] = [0, $childType, $items[$key], $depth + 1, $reference === null ? null : 'r' . $reference->getId()];
                continue;
            }
            [, $type, $current, $depth, $reference] = $frame;
            $budget->step($depth);
            $node = $type === null ? null : (GraphTypes::NODES[$type] ?? throw new \TypeError('Unknown owned type'));
            if ($current instanceof Resource) {
                ResourceAccess::binding($current);
                if ($node !== null && (!in_array($node['kind'], ['resource', 'callback'], true)
                    || $node['classes'] !== [$current::class])) throw new \TypeError('Wrong nominal Lean identity');
                yield ['r', $current::class . ':' . spl_object_id($current)];
                continue;
            }
            if ($node !== null && $node['kind'] === 'primitive') GraphScalars::check($node, $current, $budget);
            $token = self::token($current, $budget, $node !== null && $node['kind'] === 'primitive' && ($node['host'] ?? '') === 'bigint');
            if ($token !== null) {
                if ($node !== null && $node['kind'] !== 'primitive' && !($node['kind'] === 'option' && $current === null)) throw new \TypeError('Expected an owned container or identity');
                yield $token; continue;
            }
            if ($node !== null && ($node['kind'] === 'primitive' || in_array($node['kind'], ['resource', 'callback'], true))) throw new \TypeError('Expected an initialized Lean identity or scalar');
            $identity = is_object($current) ? 'o' . spl_object_id($current) : $reference;
            if ($identity !== null) {
                if (isset($active[$identity])) throw new \ValueError('Cyclic owned value');
                $active[$identity] = true;
            }
            $fields = null; $element = null;
            if (is_array($current)) {
                if (!array_is_list($current)) throw new \TypeError('Expected consecutive-key owned list');
                if ($node !== null) {
                    if ($node['kind'] === 'tuple') {
                        if (count($current) !== count($node['fields'])) throw new \TypeError('Wrong owned product arity');
                        $fields = $node['fields'];
                    } elseif ($node['kind'] === 'array' || $node['kind'] === 'list') $element = $node['element'];
                    else throw new \TypeError('Expected a nominal owned value');
                }
                $items = $current;
                yield ['a', (string) count($items)];
            } elseif (is_object($current)) {
                $class = $current::class;
                $entry = GraphTypes::CLASSES[$class] ?? throw new \TypeError('Expected an exact generated owned class');
                $fields = $entry['fields'];
                if ($node !== null) {
                    if ($node['kind'] === 'option' || $node['kind'] === 'result') {
                        $branch = array_search($class, $node['classes'], true);
                        if ($branch === false) throw new \TypeError('Wrong owned branch');
                        $fields = [['value', $node['fields'][$branch][1]]];
                    } elseif (!in_array($class, $node['classes'], true)) throw new \TypeError('Wrong nominal owned constructor');
                }
                $items = get_object_vars($current);
                if (array_keys($items) !== array_column($fields, 0)) throw new \TypeError('Owned fields must all be initialized');
                $budget->charge(strlen($class));
                yield ['o', $class];
            } else throw new \TypeError('Expected an owned value');
            $budget->children(count($items));
            $stack[] = [1, $items, $fields, $element, 0, count($items), $depth, $identity, $current];
        }
    }
    public static function equal(mixed $left, mixed $right): bool {
        $a = self::walk($left, null, new GraphBudget()); $b = self::walk($right, null, new GraphBudget());
        $same = true;
        while ($a->valid() || $b->valid()) {
            if (!$a->valid() || !$b->valid() || $a->current() !== $b->current()) $same = false;
            if ($a->valid()) $a->next();
            if ($b->valid()) $b->next();
        }
        return $same;
    }
    public static function hash(mixed $value): string {
        $hash = hash_init('sha256');
        foreach (self::walk($value, null, new GraphBudget()) as [$tag, $text]) {
            hash_update($hash, $tag . pack('N', strlen($text))); hash_update($hash, $text);
        }
        return hash_final($hash);
    }
}
`.replaceAll("OWNED_NAMESPACE", `\\${namespace}`);
