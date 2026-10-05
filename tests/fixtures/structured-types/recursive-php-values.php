<?php
declare(strict_types=0);

require __DIR__ . '/dependencies/brick-math/autoload.php';
require __DIR__ . '/src/Api.php';

use Brick\Math\BigInteger as Big;
use LeanRecursive\{Bytes, Some, Ok, Err, Scalars, Tree, TreeBranch, TreeLeaf, SpineLeaf, SpineNext, LeftTreeLeaf, LeftTreeNext, RightTreeMany, Envelope, MarkerEmpty, MarkerUnit, MarkerNext, EmptyRecord, WideNext, WideLeaf};
use LeanRecursive\Internal\{Values, GraphTypes};

const INTEGER_BITS = 64;
const WORD_BITS = 64;
$checks = 0; $rejections = 0;
function check(bool $condition, string $message = ''): void {
    global $checks; $checks++;
    if (!$condition) throw new RuntimeException('PHP recursive values: ' . $message);
}
function reject(callable $call, string $class = TypeError::class, string $message = ''): void {
    global $rejections;
    try { $call(); } catch (Throwable $error) {
        check($error instanceof $class, get_class($error) . ': ' . $error->getMessage());
        if ($message !== '') check(str_contains($error->getMessage(), $message), $error->getMessage());
        $rejections++; return;
    }
    throw new RuntimeException('Missing PHP rejection');
}
function exact(string $decimal, int $bits, bool $unsigned): int|Big {
    return $bits > INTEGER_BITS || ($unsigned && $bits === INTEGER_BITS) ? Big::of($decimal) : (int) $decimal;
}
$u32 = exact('4294967295', 32, true);
$i64 = exact('-9223372036854775808', 64, false);
$word = exact(WORD_BITS === 64 ? '18446744073709551615' : '4294967295', WORD_BITS, true);
$signed = exact(WORD_BITS === 64 ? '-9223372036854775808' : '-2147483648', WORD_BITS, false);
$fields = ['unit' => null, 'bool' => true, 'u8' => 255, 'u16' => 65535, 'u32' => $u32,
    'u64' => Big::of('18446744073709551615'), 'i8' => -128, 'i16' => -32768, 'i32' => -2147483647 - 1, 'i64' => $i64,
    'natural' => Big::of(str_repeat('9', 1000)), 'integer' => Big::of('-' . str_repeat('8', 1000)),
    'f32' => -0.0, 'f64' => NAN, 'text' => "雪\0🌲", 'bytes' => Bytes::fromString("\x00\xff"), 'char' => '🌲',
    'word' => $word, 'signedWord' => $signed];
$scalars = new Scalars(...$fields); $same = new Scalars(...$fields);
check($scalars !== $same); check($scalars->equals($same)); check($scalars->hashCode() === $same->hashCode());
foreach ($fields as $name => $value) check(is_float($value) && is_nan($value) ? is_nan($scalars->$name) : $scalars->$name === $value, $name);
$tree = new TreeLeaf($scalars);
$children = [$tree, new TreeBranch([])]; $branch = new TreeBranch($children); $children[] = $tree;
check(count($branch->children) === 2); check($branch->equals(new TreeBranch([$tree, new TreeBranch([])])));
check($branch->hashCode() === (new TreeBranch([$tree, new TreeBranch([])]))->hashCode());
check(!$tree->equals($branch)); check(!$tree->equals(new stdClass()));
$envelope = new Envelope($tree, [[$branch]], new Some($branch), new Ok([$tree, $branch]), new Some(new Some(null)));
check($envelope->equals(new Envelope($tree, [[$branch]], new Some($branch), new Ok([$tree, $branch]), new Some(new Some(null)))));
check(!$envelope->equals(new Envelope($tree, [[$branch]], new Some($branch), new Ok([$tree, $branch]), new Some(null))));
$left = new LeftTreeNext(new RightTreeMany([new LeftTreeLeaf($u32)]));
check($left->equals(new LeftTreeNext(new RightTreeMany([new LeftTreeLeaf($u32)]))));
check((new MarkerEmpty())->equals(new MarkerEmpty())); check(!(new MarkerEmpty())->equals(new MarkerUnit(null)));
check((new MarkerNext(new MarkerUnit(null)))->equals(new MarkerNext(new MarkerUnit(null))));
check((new EmptyRecord())->equals(new EmptyRecord()));
check(!class_exists('LeanRecursive\\Forest', false)); check(!class_exists('LeanRecursive\\TreeAlias', false));

$wideFields = range(0, 254); $wideFields[] = new WideLeaf($u32);
$wide = new WideNext(...$wideFields); check($wide->field254 === 254); check($wide->child->value === $u32);
check($wide->equals(new WideNext(...$wideFields))); check($wide->hashCode() === (new WideNext(...$wideFields))->hashCode());
$wideFields[254] = 65536; reject(fn() => new WideNext(...$wideFields), ValueError::class);
reject(fn() => new TreeBranch([null])); reject(fn() => new TreeBranch([1 => $tree]));
reject(fn() => new TreeBranch(['0.0' => $tree])); reject(fn() => new TreeBranch([$scalars]));
reject(fn() => new TreeBranch([], 1), ArgumentCountError::class);
reject(fn() => new EmptyRecord(1), ArgumentCountError::class);
reject(fn() => new MarkerUnit(false)); reject(fn() => new Some(null, null), ArgumentCountError::class);
reject(fn() => new Envelope($tree, [], new Some(null), new Err('ok'), null));
reject(fn() => new Envelope($tree, [], null, new Ok([$tree]), null));
reject(fn() => new Envelope($tree, [], null, new Err(1), null));
reject(fn() => new Envelope($tree, [], null, new Err('ok'), new Some(new Some(1))));
reject(fn() => $branch->children = [], Error::class);
reject(fn() => $scalars->text = 'changed', Error::class);

foreach ([
    ['unit', 0, TypeError::class], ['bool', 1, TypeError::class], ['u8', '255', TypeError::class],
    ['u8', -1, ValueError::class], ['u8', 256, ValueError::class], ['u16', 65536, ValueError::class],
    ['u32', exact('4294967296', 32, true), ValueError::class], ['u64', Big::of('18446744073709551616'), ValueError::class],
    ['i8', -129, ValueError::class], ['i8', 128, ValueError::class], ['i16', -32769, ValueError::class],
    ['i32', 2147483648, PHP_INT_SIZE === 4 ? TypeError::class : ValueError::class], ['i64', '0', TypeError::class], ['natural', Big::of(-1), ValueError::class],
    ['integer', 1, TypeError::class], ['f32', 1, TypeError::class], ['f64', '1.0', TypeError::class],
    ['text', "\xff", ValueError::class], ['text', false, TypeError::class], ['bytes', '', TypeError::class],
    ['char', '', ValueError::class], ['char', 'ab', ValueError::class], ['char', "\xed\xa0\x80", ValueError::class],
    ['word', exact('-1', WORD_BITS, true), ValueError::class], ['signedWord', 1.0, TypeError::class],
    ['natural', Big::of(str_repeat('9', 16385)), ValueError::class]
] as [$name, $value, $error]) {
    $invalid = $fields; $invalid[$name] = $value; reject(fn() => new Scalars(...$invalid), $error);
}
if (INTEGER_BITS === 32) {
    $invalid = $fields; $invalid['i64'] = Big::of('-9223372036854775809');
    reject(fn() => new Scalars(...$invalid), ValueError::class);
}
$positiveZero = $fields; $positiveZero['f32'] = 0.0;
check(!$scalars->equals(new Scalars(...$positiveZero))); check($scalars->hashCode() !== (new Scalars(...$positiveZero))->hashCode());
foreach ([NAN, INF, -INF, -0.0, 0.0] as $number) {
    $floats = $fields; $floats['f32'] = $number; $floats['f64'] = $number;
    check((new Scalars(...$floats))->equals(new Scalars(...$floats)));
    check((new Scalars(...$floats))->hashCode() === (new Scalars(...$floats))->hashCode());
}
check(!Values::equal(1, '1')); check(!Values::equal(1, 1.0)); check(!Values::equal(true, 1));
check(!Values::equal(Big::of(1), 1)); check(!Values::equal(new Some(null), null));
check(!Values::equal(new Ok(null), new Err(null))); check(!Values::equal(Bytes::fromString('x'), 'x'));
check(Bytes::fromString("\xff")->equals(Bytes::fromString("\xff")));

$spine = new SpineLeaf($u32);
for ($index = 0; $index < 127; $index++) $spine = new SpineNext($spine);
check($spine->equals($spine)); check(strlen($spine->hashCode()) === 64);
reject(fn() => new SpineNext($spine), ValueError::class, '128 levels');
$uninitialized = (new ReflectionClass(SpineNext::class))->newInstanceWithoutConstructor();
reject(fn() => $uninitialized->hashCode()); reject(fn() => new SpineNext($uninitialized));
$cycle = (new ReflectionClass(SpineNext::class))->newInstanceWithoutConstructor();
(new ReflectionProperty(SpineNext::class, 'value'))->setValue($cycle, $cycle);
reject(fn() => $cycle->hashCode(), ValueError::class, 'Cyclic');
reject(fn() => $cycle->equals($cycle), ValueError::class, 'Cyclic');
reject(fn() => new SpineNext($cycle), ValueError::class, 'Cyclic');
readonly class ForeignTree extends Tree {}
reject(fn() => new TreeBranch([new ForeignTree()]));
reject(fn() => Values::hash(new ForeignTree()));
$emptyBytes = (new ReflectionClass(Bytes::class))->newInstanceWithoutConstructor();
reject(fn() => $emptyBytes->hashCode(), TypeError::class, 'initialized');
$emptyInteger = (new ReflectionClass(Big::class))->newInstanceWithoutConstructor();
reject(fn() => Values::hash($emptyInteger), TypeError::class, 'initialized');

$arrayCycle = []; $arrayCycle[] = &$arrayCycle;
reject(fn() => Values::hash($arrayCycle), ValueError::class, 'Cyclic');
reject(fn() => Values::equal($arrayCycle, $arrayCycle), ValueError::class, 'Cyclic');
reject(fn() => Values::equal([1, $arrayCycle], [2, []]), ValueError::class, 'Cyclic');
$shared = [new TreeBranch([])]; $dag = [&$shared, &$shared];
check(Values::equal($dag, [[new TreeBranch([])], [new TreeBranch([])]]));
check(Values::hash($dag) === Values::hash([[new TreeBranch([])], [new TreeBranch([])]]));
$objectCycle = (new ReflectionClass(TreeBranch::class))->newInstanceWithoutConstructor();
(new ReflectionProperty(TreeBranch::class, 'children'))->setValue($objectCycle, [$objectCycle]);
reject(fn() => $objectCycle->hashCode(), ValueError::class, 'Cyclic');
reject(fn() => new TreeBranch([$objectCycle]), ValueError::class, 'Cyclic');
$never = (new ReflectionClass(LeanRecursive\Never_Again::class))->newInstanceWithoutConstructor();
(new ReflectionProperty(LeanRecursive\Never_Again::class, 'value'))->setValue($never, $never);
reject(fn() => $never->hashCode(), ValueError::class, 'Cyclic');
reject(fn() => new LeanRecursive\Never_Again($never), ValueError::class, 'Cyclic');

$unitArray = null; $primitives = [];
foreach (GraphTypes::NODES as $id => $node) {
    if ($node['kind'] === 'primitive') $primitives[] = $node['name'];
    if ($node['kind'] === 'array' && (GraphTypes::NODES[$node['element']]['name'] ?? null) === 'unit') $unitArray = $id;
}
check(count(array_unique($primitives)) === 19); check(is_int($unitArray));
Values::check($unitArray, array_fill(0, 262143, null)); check(true);
reject(fn() => Values::check($unitArray, array_fill(0, 262144, null)), ValueError::class, '262144');
$large = str_repeat('a', 8 * 1024 * 1024);
reject(fn() => Values::hash([$large, $large]), ValueError::class, '16 MiB');
reject(fn() => Values::hash(new stdClass()));
$resource = fopen('php://memory', 'r'); reject(fn() => Values::hash($resource)); fclose($resource);

// EXTRA_VALUES

echo json_encode(['checks' => $checks, 'rejections' => $rejections, 'integerBits' => INTEGER_BITS,
    'wordBits' => WORD_BITS, 'actualPhpBits' => PHP_INT_SIZE * 8, 'phpVersion' => PHP_VERSION, 'maximumSpineLinks' => 127,
    'maximumVisits' => 262144, 'wideFields' => 256, 'nativeCalls' => 0], JSON_THROW_ON_ERROR) . "\n";
