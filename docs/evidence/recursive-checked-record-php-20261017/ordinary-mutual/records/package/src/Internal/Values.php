<?php
declare(strict_types=1);
namespace LeanMutualcheckedrecords\Internal;

require_once __DIR__ . '/GraphTypes.php';

final class GraphBudget
{
    private int $bytes = 16 * 1024 * 1024;
    private int $visits = 262144;
    public function step(int $depth): void {
        if ($depth > 128) throw new \ValueError('Copied value exceeds 128 levels');
        if ($this->visits-- <= 0) throw new \ValueError('Copied value exceeds 262144 visits');
        $this->charge(16);
    }
    public function children(int $count): void {
        if ($count < 0 || $count > $this->visits) throw new \ValueError('Copied value exceeds 262144 visits');
        $this->charge($count, 32);
    }
    public function charge(int $count, int $width = 1): void {
        if ($count < 0 || $width < 1 || $count > intdiv($this->bytes, $width)) throw new \ValueError('Copied value exceeds 16 MiB');
        $this->bytes -= $count * $width;
    }
}

final class GraphScalars
{
    public static function decimal(\Brick\Math\BigInteger $value, GraphBudget $budget): string {
        try { $text = (string) $value; }
        catch (\Error $error) { throw new \TypeError('BigInteger must be initialized', 0, $error); }
        $budget->charge(strlen($text));
        if (strlen($text) > 16385 || strlen(ltrim($text, '-')) > 16384
            || preg_match('/^(?:0|-?[1-9][0-9]*)$/D', $text) !== 1) throw new \ValueError('BigInteger requires at most 16384 canonical decimal digits');
        return $text;
    }
    private static function compare(string $left, string $right): int {
        $a = $left[0] === '-'; $b = $right[0] === '-';
        if ($a !== $b) return $a ? -1 : 1;
        $left = ltrim($left, '-'); $right = ltrim($right, '-');
        $order = strlen($left) <=> strlen($right);
        if ($order === 0) $order = strcmp($left, $right);
        return $a ? -$order : $order;
    }
    public static function check(array $type, mixed $value, GraphBudget $budget): void {
        $name = $type['name'];
        if ($name === 'unit') { if ($value !== null) throw new \TypeError('Unit requires null'); }
        elseif ($name === 'bool') { if (!is_bool($value)) throw new \TypeError('Bool requires bool'); }
        elseif ($name === 'float32' || $name === 'float64') { if (!is_float($value)) throw new \TypeError('Float requires float without coercion'); }
        elseif ($name === 'char') {
            if (!is_string($value)) throw new \TypeError('Char requires string');
            if (strlen($value) < 1 || strlen($value) > 4 || preg_match('/\A.\z/us', $value) !== 1) throw new \ValueError('Char requires one Unicode scalar');
        } elseif ($name === 'string') {
            if (!is_string($value)) throw new \TypeError('String requires string');
            if (strlen($value) > 16 * 1024 * 1024) throw new \ValueError('Copied value exceeds 16 MiB');
            if (preg_match('//u', $value) !== 1) throw new \ValueError('String requires valid UTF-8');
        } elseif ($name === 'bytes') {
            if (!$value instanceof \LeanMutualcheckedrecords\Bytes) throw new \TypeError('ByteArray requires Bytes');
        } else {
            if ($type['host'] === 'bigint') {
                if (!$value instanceof \Brick\Math\BigInteger) throw new \TypeError('Integer requires Brick Math BigInteger');
                $text = self::decimal($value, $budget);
            } else {
                if (!is_int($value)) throw new \TypeError('Integer requires int without coercion');
                $text = (string) $value;
            }
            if (($type['min'] !== null && self::compare($text, $type['min']) < 0)
                || ($type['max'] !== null && self::compare($text, $type['max']) > 0)) throw new \ValueError('Integer is outside the declared Lean range');
        }
    }
}


final class Values
{
    public static function check(int $type, mixed $value): void {
        foreach (self::walk($value, $type, new GraphBudget()) as $_) {}
    }
    public static function checkFields(string $class, array $values): void {
        $fields = GraphTypes::CLASSES[$class]['fields'] ?? throw new \TypeError('Unknown copied constructor');
        if (count($fields) !== count($values)) throw new \ArgumentCountError('Wrong copied constructor arity');
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
        if ($value instanceof \LeanMutualcheckedrecords\Bytes) {
            try { $text = $value->toString(); }
            catch (\Error $error) { throw new \TypeError('Bytes must be initialized', 0, $error); }
            $budget->charge(strlen($text)); return ['y', $text];
        }
        return null;
    }
    private static function walk(mixed $value, ?int $type, GraphBudget $budget, int $depth = 0): \Generator {
        // Enter frames: [0, type, value, depth, reference]. Cursor frames hold
        // one container and its next slot, never a work item for every element.
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
            $node = $type === null ? null : (GraphTypes::NODES[$type] ?? throw new \TypeError('Unknown copied type'));
            if ($node !== null && $node['kind'] === 'primitive') GraphScalars::check($node, $current, $budget);
            $token = self::token($current, $budget, $node !== null && $node['kind'] === 'primitive' && ($node['host'] ?? '') === 'bigint');
            if ($token !== null) {
                if ($node !== null && $node['kind'] !== 'primitive' && !($node['kind'] === 'option' && $current === null)) throw new \TypeError('Expected a copied container');
                yield $token; continue;
            }
            if ($node !== null && $node['kind'] === 'primitive') throw new \TypeError('Expected a copied scalar');
            $identity = is_object($current) ? 'o' . spl_object_id($current) : $reference;
            if ($identity !== null) {
                if (isset($active[$identity])) throw new \ValueError('Cyclic copied value');
                $active[$identity] = true;
            }
            $fields = null; $element = null;
            if (is_array($current)) {
                if (!array_is_list($current)) throw new \TypeError('Expected consecutive-key copied list');
                if ($node !== null) {
                    if ($node['kind'] === 'tuple') {
                        if (count($current) !== count($node['fields'])) throw new \TypeError('Wrong copied product arity');
                        $fields = $node['fields'];
                    } elseif ($node['kind'] === 'array' || $node['kind'] === 'list') $element = $node['element'];
                    else throw new \TypeError('Expected a nominal copied value');
                }
                $items = $current;
                yield ['a', (string) count($items)];
            } elseif (is_object($current)) {
                $class = $current::class;
                $entry = GraphTypes::CLASSES[$class] ?? throw new \TypeError('Expected an exact generated copied class');
                $fields = $entry['fields'];
                if ($node !== null) {
                    if ($node['kind'] === 'option' || $node['kind'] === 'result') {
                        $branch = array_search($class, $node['classes'], true);
                        if ($branch === false) throw new \TypeError('Wrong copied branch');
                        $fields = [['value', $node['fields'][$branch][1]]];
                    } elseif (!in_array($class, $node['classes'], true)) throw new \TypeError('Wrong nominal copied constructor');
                }
                $items = get_object_vars($current);
                if (array_keys($items) !== array_column($fields, 0)) throw new \TypeError('Copied fields must all be initialized');
                $budget->charge(strlen($class));
                yield ['o', $class];
            } else throw new \TypeError('Expected a pure copied value');
            $budget->children(count($items));
            $stack[] = [1, $items, $fields, $element, 0, count($items), $depth, $identity, $current];
        }
    }
    public static function equal(mixed $left, mixed $right): bool {
        $a = self::walk($left, null, new GraphBudget()); $b = self::walk($right, null, new GraphBudget());
        $same = true;
        // Complete both walks even after a mismatch, so a cycle or malformed
        // tail cannot be concealed by an earlier difference or identical root.
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
