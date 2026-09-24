<?php
declare(strict_types=0);
// The host loads the installed npm or Composer API before this caller.

use Brick\Math\BigInteger as Big;
use LeanRecursive\{Bytes, Some, Ok, Err, Scalars, Tree, TreeBranch, TreeLeaf, SpineLeaf, SpineNext, LeftTreeLeaf, LeftTreeNext, RightTreeMany, Envelope, MarkerEmpty, MarkerUnit, MarkerNext, EmptyRecord, WideNext, WideLeaf};
use function LeanRecursive\{tree, forest, envelope, scalars, left, right, never_, spine, grow, empty_, join_trees, inspect, wide, units, word_max, signed_min, marker, empty_record};

$checks = 0; $rejections = 0;
function check(bool $value, string $message = ''): void {
    global $checks; ++$checks; if (!$value) throw new RuntimeException('Installed recursive PHP assertion ' . $checks . ': ' . $message);
}
function reject(callable $call, string $class, ?int $status = null): void {
    global $rejections;
    try { $call(); } catch (Throwable $error) {
        check($error instanceof $class, $error::class . ': ' . $error->getMessage()); ++$rejections;
        if ($status !== null) check($error->getCode() === $status, $error->getMessage()); return;
    }
    throw new RuntimeException('Expected rejection: ' . $class);
}
readonly class ForeignTree extends Tree {}
$request = json_decode(file_get_contents(__DIR__ . '/request.json'), true, 512, JSON_THROW_ON_ERROR);
$signatures = [
    'tree' => ['Tree', 1], 'forest' => ['array', 1], 'envelope' => ['Envelope', 1], 'scalars' => ['Scalars', 1],
    'left' => ['LeftTree', 1], 'right' => ['RightTree', 1], 'never_' => ['Never_', 1], 'spine' => ['Spine', 1],
    'grow' => ['Spine', 1], 'empty_' => ['Tree', 0], 'join_trees' => ['Tree', 2], 'inspect' => ['bool', 1],
    'wide' => ['Wide', 1], 'units' => ['array', 1], 'word_max' => ['bool', 1], 'signed_min' => ['bool', 1],
    'marker' => ['Marker', 1], 'empty_record' => ['EmptyRecord', 1],
];
foreach ($signatures as $name => [$result, $arity]) {
    $function = new ReflectionFunction('LeanRecursive\\' . $name);
    check($function->isUserDefined() && !$function->isVariadic());
    check($function->getNumberOfParameters() === $arity && $function->getNumberOfRequiredParameters() === $arity);
    check((string) $function->getReturnType() === (in_array($result, ['array', 'bool'], true) ? $result : 'LeanRecursive\\' . $result));
    foreach ($function->getParameters() as $index => $parameter) {
        check((string) $parameter->getType() === 'mixed' && !$parameter->isPassedByReference());
        $expected = ($request['path'] === 'reviewed-ir' ? 'value' : 'arg') . $index;
        check($parameter->getName() === $expected, $name . ' parameter ' . $index);
    }
}
$magnitude = Big::of(2)->power(128)->plus(1);
$fields = [null, true, 255, 65535, Big::of('4294967295'), Big::of('18446744073709551615'), -128, -32768, (-2147483647 - 1), Big::of('-9223372036854775808'),
    $magnitude, $magnitude->negated(), 1.5, -2.25, "A\0🌱", Bytes::fromString("\x00\xff\x01"), '🌱', Big::of('4294967295'), (-2147483647 - 1)];
$scalars = new Scalars(...$fields); $leaf = new TreeLeaf($scalars); $tree = new TreeBranch([$leaf, new TreeBranch([])]);
reject(fn() => tree(1), TypeError::class);
reject(fn() => tree(new ForeignTree()), TypeError::class);
reject(fn() => tree($tree, $tree), ArgumentCountError::class);
reject(fn() => empty_($tree), ArgumentCountError::class);
reject(fn() => join_trees($tree), ArgumentCountError::class);
reject(fn() => join_trees($tree, new stdClass()), TypeError::class);
reject(fn() => forest(['bad' => $tree]), TypeError::class);
reject(fn() => units([null, false]), TypeError::class);
reject(fn() => signed_min((string) PHP_INT_MIN), TypeError::class);
reject(fn() => word_max(1), TypeError::class);
reject(fn() => word_max(Big::of(-1)), ValueError::class);
reject(fn() => never_(new stdClass()), TypeError::class);
foreach (['SpineNext', 'Never_Again'] as $type) {
    $reflection = new ReflectionClass('LeanRecursive\\' . $type); $cycle = $reflection->newInstanceWithoutConstructor();
    $reflection->getProperty('value')->setValue($cycle, $cycle);
    reject(fn() => $type === 'SpineNext' ? spine($cycle) : never_($cycle), ValueError::class);
}
reject(fn() => scalars((new ReflectionClass(Scalars::class))->newInstanceWithoutConstructor()), TypeError::class);
foreach ([0 => false, 1 => 1, 2 => '255', 3 => -1, 4 => Big::of('4294967296'), 5 => 1, 6 => -129, 7 => -32769,
    8 => -2147483649, 9 => 1.0, 10 => Big::of(-1), 11 => '1', 12 => 1, 13 => '1.5', 14 => "\xff", 15 => '',
    16 => 'ab', 17 => Big::of('4294967296'), 18 => '0'] as $index => $value) {
    reject(fn() => new Scalars(...array_replace($fields, [$index => $value])), in_array($index, [3, 4, 6, 7, 10, 14, 16, 17], true) ? ValueError::class : TypeError::class);
}
check(PHP_INT_SIZE === 4);
check(extension_loaded($request['extension']) === ($request['loading'] === 'startup'));
check(inspect($scalars) === true);
check(word_max(Big::of('4294967295')) === true);
check(signed_min(PHP_INT_MIN) === true);
foreach ([$fields, array_replace($fields, [10 => Big::of(str_repeat('9', 1000)), 11 => Big::of('-' . str_repeat('9', 1000))]),
    array_replace($fields, [10 => Big::of(0), 11 => Big::of(0), 14 => '', 15 => Bytes::fromString('')]),
    array_replace($fields, [12 => -INF, 13 => INF]), array_replace($fields, [12 => NAN, 13 => -0.0])] as $values) {
    $input = new Scalars(...$values); $copy = scalars($input); check($copy !== $input && $copy->equals($input));
    check($copy->hashCode() === $input->hashCode());
}
$copy = tree($tree); check($copy->equals($tree) && $copy !== $tree);
check(empty_()->equals(new TreeBranch([])));
check(join_trees($tree, $tree)->equals(new TreeBranch([$tree, $tree])));
$forest = array_fill(0, 512, $tree); $copy = forest($forest);
foreach ($copy as $index => $value) { check($value->equals($tree) && $value !== $tree); if ($index) check($value !== $copy[0]); }
check(forest([]) === []);
foreach ([null, new Some(null), new Some(new Some(null))] as $mark) foreach ([new Ok([$tree, $tree]), new Err("error\0🌱")] as $outcome) {
    $input = new Envelope($tree, [[], [$tree]], new Some($tree), $outcome, $mark);
    $copy = envelope($input); check($copy->equals($input)); check($copy->outcome::class === $outcome::class);
}
$left = new LeftTreeNext(new RightTreeMany([new LeftTreeLeaf(Big::of(9))])); check(left($left)->equals($left));
$right = new RightTreeMany([$left]); check(right($right)->equals($right));
$spine = new SpineLeaf(Big::of(41)); for ($index = 0; $index < 127; ++$index) $spine = new SpineNext($spine);
$copy = spine($spine); $a = $spine; $b = $copy;
for ($index = 0; $index < 127; ++$index) { check($a !== $b); $a = $a->value; $b = $b->value; }
check($a->value->isEqualTo(41) && $b->value->isEqualTo(41));
reject(fn() => grow($spine), LeanRecursive\LeanBridgeError::class, 2);
check(grow(new SpineLeaf(Big::of(7)))->equals(new SpineNext(new SpineLeaf(Big::of(7)))));
$wide = range(0, 254); $wide[] = new WideLeaf(Big::of(17)); $wide = new WideNext(...$wide); check(wide($wide)->equals($wide));
foreach ([new MarkerEmpty(), new MarkerUnit(null), new MarkerNext(new MarkerEmpty())] as $value) check(marker($value)->equals($value));
check(empty_record(new EmptyRecord())->equals(new EmptyRecord()));
check(units(array_fill(0, 123, null)) === array_fill(0, 123, null));
for ($index = 0; $index < 128; ++$index) check(tree($tree)->equals($tree));
check(extension_loaded($request['extension']));
$aliases = json_decode(file_get_contents($request['aliases']), true, 512, JSON_THROW_ON_ERROR);
check(array_column($aliases['aliases'], 'name') === ['Forest', 'TreeAlias']);
check(!class_exists('LeanRecursive\\Forest') && !class_exists('LeanRecursive\\TreeAlias'));
echo json_encode(['checks' => $checks, 'rejections' => $rejections, 'exports' => count($signatures),
    'hostVersion' => PHP_VERSION, 'actualPhpBits' => PHP_INT_SIZE * 8,
    'compiledLean' => true, 'installedPackage' => true], JSON_THROW_ON_ERROR) . "\n";
