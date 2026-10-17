<?php
declare(strict_types=1);
namespace LeanMutualcheckedrecords\Internal;

require_once __DIR__ . '/Values.php';
require_once __DIR__ . '/GraphNativeTypes.php';
final class ScalarCodec
{
    public static function point(string $text): int {
        $length = strlen($text);
        $value = ord($text[0]) & [1 => 127, 2 => 31, 3 => 15, 4 => 7][$length];
        for ($i = 1; $i < $length; $i++) $value = ($value << 6) | (ord($text[$i]) & 63);
        return $value;
    }
    public static function text(int $value): string {
        if ($value < 0 || $value > 0x10ffff || ($value >= 0xd800 && $value <= 0xdfff)) throw new \RuntimeException('Invalid native Unicode scalar');
        if ($value < 128) return chr($value);
        if ($value < 0x800) return chr(0xc0 | ($value >> 6)) . chr(0x80 | ($value & 63));
        if ($value < 0x10000) return chr(0xe0 | ($value >> 12)) . chr(0x80 | (($value >> 6) & 63)) . chr(0x80 | ($value & 63));
        return chr(0xf0 | ($value >> 18)) . chr(0x80 | (($value >> 12) & 63)) . chr(0x80 | (($value >> 6) & 63)) . chr(0x80 | ($value & 63));
    }
}

final class IntegerCodec
{
    public static function limbs(string $decimal): array {
        $digits = ltrim($decimal, '-');
        $limbs = [];
        foreach (str_split(str_pad($digits, (int) (ceil(strlen($digits) / 9) * 9), '0', STR_PAD_LEFT), 9) as $part) {
            $carry = (int) $part;
            foreach ($limbs as $i => $word) {
                $value = $word * 1000000000 + $carry;
                $limbs[$i] = $value & 0xffffffff;
                $carry = intdiv($value, 4294967296);
            }
            if ($carry) $limbs[] = $carry;
        }
        return $limbs;
    }
    public static function decimal(array $limbs, bool $negative): string {
        // 1700 limbs fit in 16384 decimal digits; check the exact length below too.
        if (count($limbs) > 1701) throw new \ValueError('BigInteger decimal conversion limit exceeded');
        $chunks = [];
        foreach (array_reverse($limbs) as $word) {
            $carry = $word;
            foreach ($chunks as $i => $part) {
                $value = $part * 4294967296 + $carry;
                $chunks[$i] = $value % 1000000000;
                $carry = intdiv($value, 1000000000);
            }
            while ($carry) { $chunks[] = $carry % 1000000000; $carry = intdiv($carry, 1000000000); }
        }
        $text = $chunks ? (string) array_pop($chunks) : '0';
        foreach (array_reverse($chunks) as $part) $text .= str_pad((string) $part, 9, '0', STR_PAD_LEFT);
        if (strlen($text) > 16384) throw new \ValueError('BigInteger decimal conversion limit exceeded');
        return $negative && $text !== '0' ? '-' . $text : $text;
    }
}


final class GraphInvalidNative extends \RuntimeException {}

final readonly class GraphTarget
{
    public function __construct(public \FFI $ffi, public string $symbol, public string $clear,
        public ?string $before = null, public ?string $ready = null, public ?string $retire = null) {}
}

final class GraphSchema
{
    public readonly \FFI $ffi;
    public readonly array $nodes;
    public function __construct() {
        if (PHP_INT_SIZE !== 8 || PHP_OS_FAMILY !== 'Linux' || php_uname('m') !== 'x86_64'
            || pack('S', 1) !== "\x01\x00") throw new \RuntimeException('Native PHP copied graphs require Linux x86-64');
        $this->ffi = \FFI::cdef(GraphNativeTypes::DEFINITIONS);
        $nodes = GraphNativeTypes::NODES;
        foreach ($nodes as &$node) {
            $type = $this->ffi->type($node['ctype']);
            $node['size'] = \FFI::sizeof($type); $node['alignment'] = \FFI::alignof($type);
            $node['pointerType'] = $this->ffi->type($node['ctype'] . '*');
            foreach ($node['branches'] as &$branch) {
                foreach ($branch['fields'] as &$field) {
                    $offset = 0; $current = $type;
                    foreach ($field['path'] as $name) {
                        $offset += $current->getStructFieldOffset($name); $current = $current->getStructFieldType($name);
                    }
                    $field['offset'] = $offset;
                }
                unset($field);
            }
            unset($branch);
        }
        unset($node); $this->nodes = $nodes;
    }
    public function address(\FFI\CData $pointer): int { return $this->ffi->cast('uintptr_t', $pointer)->cdata; }
    public function pointer(?\FFI\CData $pointer, int $count, int $width, int $alignment): ?\FFI\CData {
        if ($count < 0 || $width < 1 || $count > intdiv(16 * 1024 * 1024, $width)) throw new GraphInvalidNative('Invalid native span length');
        if ($count === 0) return null;
        $address = $pointer === null ? 0 : $this->address($pointer);
        if ($address < 4096 || $address % $alignment !== 0 || $address > PHP_INT_MAX - $count * $width)
            throw new GraphInvalidNative('Missing, misaligned or overflowing native pointer');
        return $this->ffi->cast('lb_php_graph_byte_pointer', $pointer);
    }
    public function readPointer(\FFI\CData $at): ?\FFI\CData { return $this->ffi->cast('lb_php_graph_byte_slot', $at)[0]; }
    public function writePointer(\FFI\CData $at, ?\FFI\CData $value): void { $this->ffi->cast('lb_php_graph_byte_slot', $at)[0] = $value; }
}

final class GraphScope
{
    private array $owners = [];
    public readonly GraphBudget $storage;
    public readonly GraphBudget $native;
    public function __construct(public readonly GraphSchema $schema, public readonly bool $checkOnly = false) {
        $this->storage = new GraphBudget(); $this->native = new GraphBudget();
    }
    public static function checkpoint(): void {}
    public function allocate(int $size): ?\FFI\CData {
        $words = intdiv($size + 7, 8); $this->native->charge($words, 8); $this->storage->charge(128);
        if ($this->checkOnly || $size === 0) return null;
        self::checkpoint(); $owner = $this->schema->ffi->new('uint64_t[' . $words . ']');
        $this->owners[] = $owner;
        return $this->schema->ffi->cast('lb_php_graph_byte_pointer', \FFI::addr($owner[0]));
    }
    public function close(): void { $this->owners = []; }
}

final class GraphScalarNative
{
    public static function write(array $node, mixed $value, ?\FFI\CData $out, GraphScope $scope): void {
        $ffi = $scope->schema->ffi; $name = $node['scalar'];
        if ($node['aggregate']) {
            $limbs = $name === 'nat' || $name === 'int';
            if ($limbs) {
                $words = IntegerCodec::limbs((string) $value); $length = count($words); $width = 4;
                $scope->storage->charge($length, 32); $bytes = '';
                if (!$scope->checkOnly) foreach ($words as $word) $bytes .= pack('V', $word);
            } else { $bytes = $name === 'bytes' ? $value->toString() : $value; $length = strlen($bytes); $width = 1; }
            $scope->storage->charge($length, $width);
            $data = $scope->allocate($length * $width);
            if (!$scope->checkOnly) {
                if ($length) \FFI::memcpy($data, $bytes, $length * $width);
                $scope->schema->writePointer($out + 16, $data); $ffi->cast('size_t*', $out + 24)[0] = $length;
                if ($name === 'int') $out[32] = str_starts_with((string) $value, '-') ? 1 : 0;
            }
            return;
        }
        if ($scope->checkOnly) return;
        if ($name === 'uint64' || $name === 'usize') {
            $words = IntegerCodec::limbs((string) $value);
            \FFI::memcpy($out, pack('V2', $words[0] ?? 0, $words[1] ?? 0), 8);
        } elseif ($name === 'unit' || $name === 'bool') $out[0] = $value ? 1 : 0;
        elseif ($name === 'char') $ffi->cast('uint32_t*', $out)[0] = ScalarCodec::point($value);
        else $ffi->cast($node['pointerType'], $out)[0] = $value;
    }
    public static function read(array $node, \FFI\CData $value, GraphScope $scope): mixed {
        $ffi = $scope->schema->ffi; $name = $node['scalar']; GraphScope::checkpoint();
        if ($node['aggregate']) {
            $limbs = $name === 'nat' || $name === 'int'; $width = $limbs ? 4 : 1;
            $length = $ffi->cast('size_t*', $value + 24)[0];
            $scope->native->charge($length, $width); $scope->storage->charge($length, $limbs ? 32 : 1);
            if ($limbs && $length > 1701) throw new GraphInvalidNative('Native integer exceeds 16384 decimal digits');
            $data = $scope->schema->pointer($scope->schema->readPointer($value + 16), $length, $width, $width);
            $bytes = $length ? \FFI::string($data, $length * $width) : '';
            if ($limbs) {
                $negative = $name === 'int' ? $value[32] : 0;
                if ($negative > 1 || ($negative && !$length)) throw new GraphInvalidNative('Invalid native integer sign');
                $words = $length ? array_values(unpack('V*', $bytes)) : [];
                if ($length && $words[$length - 1] === 0) throw new GraphInvalidNative('Noncanonical native integer magnitude');
                return \Brick\Math\BigInteger::of(IntegerCodec::decimal($words, (bool) $negative));
            }
            if ($name === 'string') {
                if (preg_match('//u', $bytes) !== 1) throw new GraphInvalidNative('Invalid native UTF-8');
                return $bytes;
            }
            return \LeanMutualcheckedrecords\Bytes::fromString($bytes);
        }
        if ($name === 'unit' || $name === 'bool') {
            $raw = $value[0];
            if ($raw > ($name === 'unit' ? 0 : 1)) throw new GraphInvalidNative('Invalid native Unit or Bool');
            return $name === 'unit' ? null : (bool) $raw;
        }
        if ($name === 'uint64' || $name === 'usize')
            return \Brick\Math\BigInteger::of(IntegerCodec::decimal(array_values(unpack('V2', \FFI::string($value, 8))), false));
        $raw = $ffi->cast($node['pointerType'], $value)[0];
        if ($name === 'char') {
            if ($raw > 0x10ffff || ($raw >= 0xd800 && $raw <= 0xdfff)) throw new GraphInvalidNative('Invalid native Char');
            return ScalarCodec::text($raw);
        }
        return $raw;
    }
}


final class GraphReadFrame
{
    public bool $entered = false;
    public int $index = 0;
    public int $count = 0;
    public array $values = [];
    public array $fields = [];
    public ?string $class = null;
    public ?string $identity = null;
    public ?\FFI\CData $data = null;
    public function __construct(public int $type, public \FFI\CData $pointer, public int $depth) {}
}

final class GraphRuntime
{
    private static ?GraphSchema $schema = null;
    public static function schema(): GraphSchema { return self::$schema ??= new GraphSchema(); }
    private static function branch(array $node, mixed $value): int {
        if ($node['kind'] === 'option') return $value === null ? 0 : 1;
        if ($node['kind'] === 'result') return $value instanceof \LeanMutualcheckedrecords\Ok ? 1 : 0;
        if ($node['kind'] === 'variant') {
            foreach ($node['branches'] as $index => $branch) if ($value::class === $branch['class']) return $index;
            throw new \TypeError('Unknown copied variant');
        }
        return 0;
    }
    private static function write(int $type, mixed $value, ?\FFI\CData $out, GraphScope $scope): void {
        $schema = $scope->schema; $stack = [[0, $type, $value, $out, 0]];
        while ($stack) {
            $frame = array_pop($stack);
            if ($frame[0] === 1) {
                [, $items, $fields, $element, $index, $count, $data, $depth] = $frame;
                if ($index === $count) continue;
                $frame[4]++; $stack[] = $frame;
                $field = $element === null ? $fields[$index] : null;
                $child = $schema->nodes[$element ?? $field['type']];
                $input = $items[$field === null ? $index : $field['key']];
                $at = $scope->checkOnly ? null : $data + ($field === null ? $index * $child['size'] : $field['offset']);
                if ($field !== null && $field['pointer']) {
                    $pointer = $scope->allocate($child['size']);
                    if (!$scope->checkOnly) $schema->writePointer($at, $pointer);
                    $at = $pointer;
                }
                $stack[] = [0, $element ?? $field['type'], $input, $at, $depth + 1]; continue;
            }
            [, $type, $value, $at, $depth] = $frame; $node = $schema->nodes[$type];
            $scope->storage->step($depth);
            if (!$node['inhabited']) throw new \ValueError('The declared copied type has no finite value');
            if ($node['kind'] === 'primitive') {
                GraphScalars::check(GraphTypes::NODES[$type], $value, $scope->storage);
                GraphScalarNative::write($node, $value, $at, $scope); continue;
            }
            $fields = []; $element = $node['element'];
            if ($element !== null) {
                if (!is_array($value) || !array_is_list($value)) throw new \TypeError('Expected consecutive-key copied list');
                $items = $value; $count = count($items); $child = $schema->nodes[$element];
                $scope->storage->children($count);
                $data = $scope->allocate($count * $child['size']);
                if (!$scope->checkOnly) { $schema->writePointer($at + 16, $data); $schema->ffi->cast('size_t*', $at + 24)[0] = $count; }
            } else {
                $tag = self::branch($node, $value); $fields = $node['branches'][$tag]['fields'];
                $class = $node['branches'][$tag]['class'];
                if ($class !== null && (!is_object($value) || $value::class !== $class)) throw new \TypeError('Wrong copied constructor');
                if ($class === null && $node['kind'] === 'tuple' && (!is_array($value) || !array_is_list($value) || count($value) !== count($fields)))
                    throw new \TypeError('Wrong copied product arity');
                $items = is_object($value) ? get_object_vars($value) : ($value ?? []); $count = count($fields); $data = $at;
                if ($class !== null && array_keys($items) !== array_column($fields, 'key')) throw new \TypeError('Copied fields must all be initialized');
                $scope->storage->children($count);
                if (!$scope->checkOnly) {
                    if ($node['kind'] === 'variant') $schema->ffi->cast('uint32_t*', $at + 16)[0] = $tag;
                    elseif ($node['kind'] === 'option' || $node['kind'] === 'result') $at[16] = $tag;
                }
            }
            $stack[] = [1, $items, $fields, $element, 0, $count, $data, $depth];
        }
    }
    private static function construct(GraphReadFrame $frame, array $node): mixed {
        GraphScope::checkpoint();
        if ($node['kind'] === 'option' && $frame->class === null) return null;
        if ($frame->class === null) return $frame->values;
        // These exact generated final readonly classes have no user hooks.
        // Initializing once avoids recursively revalidating every completed tail.
        // The complete returned value is checked before the call returns.
        $reflection = new \ReflectionClass($frame->class); $result = $reflection->newInstanceWithoutConstructor();
        foreach ($frame->fields as $index => $field) $reflection->getProperty($field['key'])->setValue($result, $frame->values[$index]);
        return $result;
    }
    private static function read(int $type, \FFI\CData $pointer, GraphScope $scope): mixed {
        $schema = $scope->schema; $stack = [new GraphReadFrame($type, $pointer, 0)]; $active = [];
        while ($stack) {
            $frame = $stack[count($stack) - 1]; $node = $schema->nodes[$frame->type];
            if (!$frame->entered) {
                $scope->storage->step($frame->depth); $scope->storage->charge(128); $frame->entered = true;
                if (!$node['inhabited']) throw new GraphInvalidNative('Uninhabited native copied value');
                $frame->identity = $frame->type . ':' . $schema->address($frame->pointer);
                if (isset($active[$frame->identity])) throw new GraphInvalidNative('Cyclic native copied value');
                $active[$frame->identity] = true;
                if ($node['kind'] !== 'primitive') {
                    if ($node['element'] !== null) {
                        $child = $schema->nodes[$node['element']]; $frame->count = $schema->ffi->cast('size_t*', $frame->pointer + 24)[0];
                        $scope->storage->children($frame->count); $scope->native->charge($frame->count, $child['size']);
                        $frame->data = $schema->pointer($schema->readPointer($frame->pointer + 16), $frame->count, $child['size'], $child['alignment']);
                    } else {
                        $tag = $node['kind'] === 'variant' ? $schema->ffi->cast('uint32_t*', $frame->pointer + 16)[0]
                            : (($node['kind'] === 'option' || $node['kind'] === 'result') ? $frame->pointer[16] : 0);
                        $branch = $node['branches'][$tag] ?? throw new GraphInvalidNative('Invalid native branch tag');
                        $frame->fields = $branch['fields']; $frame->class = $branch['class']; $frame->count = count($frame->fields);
                        $scope->storage->children($frame->count);
                    }
                }
            }
            if ($node['kind'] === 'primitive' || $frame->index === $frame->count) {
                $value = $node['kind'] === 'primitive' ? GraphScalarNative::read($node, $frame->pointer, $scope) : self::construct($frame, $node);
                unset($active[$frame->identity]); array_pop($stack);
                if (!$stack) return $value;
                $stack[count($stack) - 1]->values[] = $value; continue;
            }
            $index = $frame->index++;
            $field = $node['element'] === null ? $frame->fields[$index] : null;
            $childType = $node['element'] ?? $field['type']; $child = $schema->nodes[$childType];
            $at = $field === null ? $frame->data + $index * $child['size'] : $frame->pointer + $field['offset'];
            if ($field !== null && $field['pointer']) {
                $scope->native->charge($child['size']); $at = $schema->pointer($schema->readPointer($at), 1, $child['size'], $child['alignment']);
            }
            $stack[] = new GraphReadFrame($childType, $at, $frame->depth + 1);
        }
        throw new GraphInvalidNative('Missing native result');
    }
    private static function checkedStatus(int $status, \FFI $ffi): void {
        if ($status !== 1) { self::status($status); return; }
        $message = $ffi->mutualcheckedrecords_graph_error();
        if ($message === null) { self::status($status); return; }
        if (!\is_string($message) || \preg_match('//u', $message) !== 1) throw new GraphInvalidNative('Malformed native refinement diagnostic');
        throw new \LeanMutualcheckedrecords\LeanBridgeError($message, $status);
    }
    private static function status(int $status): void {
        if (!in_array($status, [0, 1, 2, 3, 5], true)) throw new GraphInvalidNative('Invalid native copied result or status', 4);
        if ($status !== 0) throw new \LeanMutualcheckedrecords\LeanBridgeError('Native copied call failed with status ' . $status, $status);
    }
    public static function call(int $function, callable $load, array $arguments): mixed {
        $fn = GraphNativeTypes::FUNCTIONS[$function] ?? throw new \TypeError('Unknown copied function');
        if (!array_is_list($arguments) || count($arguments) !== count($fn['parameters'])) throw new \ArgumentCountError('Wrong copied call arity');
        // Invalid host values never initialize FFI or run a package loader.
        foreach ($fn['parameters'] as $index => $type) Values::check($type, $arguments[$index]);
        $schema = self::schema(); $result = $schema->nodes[$fn['result']];
        $checked = new GraphScope($schema, true);
        foreach ($fn['parameters'] as $index => $type) {
            $checked->allocate($schema->nodes[$type]['size']); self::write($type, $arguments[$index], null, $checked);
        }
        $checked->allocate($result['size']);
        $scope = new GraphScope($schema); $target = null; $output = null;
        try {
            $inputs = [];
            foreach ($fn['parameters'] as $index => $type) {
                $input = $scope->allocate($schema->nodes[$type]['size']); self::write($type, $arguments[$index], $input, $scope); $inputs[] = $input;
            }
            $output = $scope->allocate($result['size']);
            if ($result['kind'] === 'variant') $schema->ffi->cast('uint32_t*', $output + 16)[0] = 4294967295;
            $target = $load();
            if (!$target instanceof GraphTarget) throw new \TypeError('Expected an authenticated graph target');
            if ($target->before !== null) self::status($target->ffi->{$target->before}());
            self::checkedStatus($target->ffi->{$target->symbol}(...[...$inputs, $output]), $target->ffi);
            try {
                $reading = new GraphScope($schema); $reading->native->charge($result['size']);
                $value = self::read($fn['result'], $output, $reading); Values::check($fn['result'], $value);
            } catch (\ValueError|\TypeError $error) { throw new GraphInvalidNative('Invalid native copied result: ' . $error->getMessage(), 0, $error); }
            if ($target->ready !== null && !$target->ffi->{$target->ready}()) self::status(5);
            return $value;
        } catch (GraphInvalidNative $error) {
            if ($target instanceof GraphTarget && $target->retire !== null) $target->ffi->{$target->retire}();
            throw $error;
        } finally {
            try { if ($target instanceof GraphTarget && $output !== null && $result['aggregate']) $target->ffi->{$target->clear}($output); }
            finally { $scope->close(); }
        }
    }
}

