<?php
declare(strict_types=0);
require 'vendor/autoload.php';
use Brick\Math\BigInteger;
use LeanRecursivesubtypes\{ChainEmpty, ChainNode, Some, LeanBridgeError};
use function LeanRecursivesubtypes\{first, second, echo_, groups, echo_groups, produce};
$checks = 0;
function check($condition, $label) { global $checks; if (!$condition) throw new Exception('failed: ' . $label); ++$checks; }
function n($value) { return BigInteger::of($value); }
function rejected(callable $call, string $message): bool {
    try { $call(); }
    catch (LeanBridgeError $error) { return $error->getCode() === 1 && $error->getMessage() === $message; }
    return false;
}
function bounded(callable $call, string $message): bool {
    try { $call(); }
    catch (ValueError $error) { return $error->getMessage() === $message; }
    return false;
}
function chainTotal($value): BigInteger {
    $total = n(0);
    while ($value instanceof ChainNode) { $total = $total->plus($value->value); $value = $value->tail; }
    check($value instanceof ChainEmpty, 'closed chain');
    return $total;
}
$tail = new ChainNode(n(80), n(1), new ChainEmpty());
$chain = new ChainNode(n(40), n(2), $tail);
check(first($chain)->isEqualTo(41), 'first uses its selected normalizer');
check(second($chain)->isEqualTo(42), 'second keeps its independent constructor choice');
check($chain->value->isEqualTo(40) && $tail->value->isEqualTo(80), 'successful calls preserve caller values');
$lateFirst = new ChainNode(n(40), n(2), new ChainNode(n(100), n(1), new ChainEmpty()));
check(rejected(fn() => first($lateFirst), 'arg0.node.tail.node.value was rejected by RecursiveSubtypes.plusOne'), 'late first rejection');
check($lateFirst->value->isEqualTo(40) && $lateFirst->tail->value->isEqualTo(100), 'late rejection preserves caller values');
$lateSecond = new ChainNode(n(40), n(2), new ChainNode(n(90), n(1), new ChainEmpty()));
check(rejected(fn() => second($lateSecond), 'arg0.node.tail.node.value was rejected by RecursiveSubtypes.plusTwo'), 'late second rejection');
$lateDigit = new ChainNode(n(40), n(2), new ChainNode(n(50), n(3), new ChainEmpty()));
check(rejected(fn() => first($lateDigit), 'arg0.node.tail.node.digit is not below its Fin 3 bound'), 'late Fin rejection');
check($lateDigit->tail->digit->isEqualTo(3), 'Fin rejection preserves caller values');
check(first($chain)->isEqualTo(41), 'call recovers after rejection');
$nestedLate = [null, new Some($lateFirst)];
check(rejected(fn() => groups($nestedLate), 'arg0[1]?.node.tail.node.value was rejected by RecursiveSubtypes.plusOne'), 'nested late rejection identifies the actual occurrence');
check($nestedLate[1]->value === $lateFirst && $lateFirst->tail->value->isEqualTo(100), 'nested rejection preserves the shared caller graph');
check(groups([new Some($chain), null])->isEqualTo(2), 'call recovers after nested rejection');
$copy = echo_($chain);
check($copy !== $chain && chainTotal($copy)->isEqualTo(122), 'recursive result erases the checked values');
$sharedGroups = [new Some($chain), new Some($chain)];
check(groups($sharedGroups)->isEqualTo(2), 'nested array, option and shared recursive input');
$groupCopy = echo_groups($sharedGroups);
check(count($groupCopy) === 2 && $groupCopy[0] instanceof Some && $groupCopy[1] instanceof Some
    && chainTotal($groupCopy[0]->value)->isEqualTo(122) && chainTotal($groupCopy[1]->value)->isEqualTo(122), 'nested shared recursive result');
check(groups([null, new Some(new ChainEmpty())])->isEqualTo(2), 'absent option and inactive variant branch need no fabricated refined default');
check(chainTotal(produce(n(40)))->isEqualTo(83), 'constructor-free recursive result');
$chainReflection = new ReflectionClass(ChainNode::class);
$valueProperty = new ReflectionProperty(ChainNode::class, 'value');
$digitProperty = new ReflectionProperty(ChainNode::class, 'digit');
$tailProperty = new ReflectionProperty(ChainNode::class, 'tail');
$uncheckedNode = function ($tail) use ($chainReflection, $valueProperty, $digitProperty, $tailProperty) {
    $node = $chainReflection->newInstanceWithoutConstructor();
    $valueProperty->setValue($node, n(40));
    $digitProperty->setValue($node, n(1));
    $tailProperty->setValue($node, $tail);
    return $node;
};
$deep = new ChainEmpty();
for ($depth = 0; $depth < 130; ++$depth) $deep = $uncheckedNode($deep);
check(bounded(fn() => first($deep), 'Copied value exceeds 128 levels'), 'recursive input depth is bounded');
$cycle = $chainReflection->newInstanceWithoutConstructor();
$valueProperty->setValue($cycle, n(40));
$digitProperty->setValue($cycle, n(1));
$tailProperty->setValue($cycle, $cycle);
check(bounded(fn() => first($cycle), 'Cyclic copied value'), 'recursive input cycles are bounded');
unset($cycle, $deep, $uncheckedNode); gc_collect_cycles();
check(first($chain)->isEqualTo(41), 'call recovers after bounded recursive inputs');
echo "recursive-subtype-ok:$checks\n";
