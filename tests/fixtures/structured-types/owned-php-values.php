<?php
declare(strict_types=0);

require __DIR__ . '/dependencies/brick-math/autoload.php';
require __DIR__ . '/src/Api.php';
require __DIR__ . '/scalars/src/Api.php';
require __DIR__ . '/foreign/src/Api.php';

use Brick\Math\BigInteger as Big;
use LeanOwnedAggregates\{Bytes, Some, Ok, Err, Ticket, Payload, Bundle, Mixed_, ChainStop, ChainLink, ChoiceEmpty, ChoiceOne, ChoicePair, ChoiceMany, Tree, TreeLeaf, TreeBranch};
use LeanOwnedAggregates\Internal\{Values, GraphTypes, ResourceAccess, ResourceBinding};
use LeanOwnedScalars\Scalars;

const INTEGER_BITS = 64;
const WORD_BITS = 64;
$checks = 0; $rejections = 0;
function check(bool $condition, string $message = ''): void {
    global $checks; $checks++;
    if (!$condition) throw new RuntimeException('PHP owned values: ' . $message);
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

// Exercise only the value-to-transport interface here. This binding is not a
// native Lean owner and these observations do not claim compiled transport.
final class ProbeBinding implements ResourceBinding
{
    public bool $closed = false;
    public int $calls = 0;
    public int $closes = 0;
    public function __construct(private ?object $borrow = null) {}
    public function check(): void {
        if ($this->closed) throw new LogicException('Closed identity');
        if ($this->borrow !== null && !$this->borrow->alive) throw new LogicException('Expired callback borrow');
    }
    public function close(): void { if (!$this->closed) { $this->closed = true; $this->closes++; } }
    public function retain(): ResourceBinding { $this->check(); return new self(); }
    public function invoke(array $arguments): mixed { $this->check(); $this->calls++; return $arguments[0] ?? null; }
}
$binding = new ProbeBinding(); $ticket = ResourceAccess::wrap(Ticket::class, $binding);
$payload = new Payload(count: Big::of('42'), bytes: Bytes::fromString("a\0\xff"));
$bundle = new Bundle(primary: $ticket, spare: new Some($ticket), peers: [$ticket], history: [], payload: $payload);
check($bundle->primary === $ticket); check($bundle->spare->value === $ticket);
check($bundle->payload->bytes->toString() === "a\0\xff");
check($bundle->equals(new Bundle($ticket, new Some($ticket), [$ticket], [], $payload)));
check($bundle->hashCode() === (new Bundle($ticket, new Some($ticket), [$ticket], [], $payload))->hashCode());
check(!$bundle->equals(new Bundle($ticket, null, [$ticket], [], $payload)));
check(!class_exists('LeanOwnedAggregates\\BundleAlias', false)); check(!class_exists('LeanOwnedAggregates\\TicketRow', false));
check((new Some(null))->value === null); check((new Some(new Some(null)))->value instanceof Some);
check(!Values::equal(new Some(null), null)); check(!Values::equal(new Some(null), new Some(new Some(null))));
check(!Values::equal(new Ok(null), new Err(null))); check(!Values::equal([], null));
check((new ChoiceEmpty())->equals(new ChoiceEmpty())); check(!(new ChoiceEmpty())->equals(new ChainStop()));
check((new ChoiceOne($ticket))->ticket === $ticket);
check((new ChoicePair(second: $ticket, first: $ticket))->first === $ticket);
check((new ChoiceMany([$ticket, $ticket]))->tickets === [$ticket, $ticket]);
check((new ChainLink($ticket, new Some(new ChainStop())))->next->value instanceof ChainStop);
$tree = new TreeLeaf($ticket); $children = [$tree, new TreeBranch([])]; $branch = new TreeBranch($children); $children[] = $tree;
check(count($branch->children) === 2); check($branch->equals(new TreeBranch([$tree, new TreeBranch([])])));
check($branch->hashCode() === (new TreeBranch([$tree, new TreeBranch([])]))->hashCode());
$mixed = [
    'ticket' => $ticket, 'markers' => [null, new Some(null), new Some(new Some(true))], 'unit' => new Some(null),
    'result' => new Ok($bundle), 'signed' => Big::of('-1000'), 'unsigned' => Big::of('1000'), 'scalar' => '🌲',
    'precise' => NAN, 'approximate' => -0.0, 'bytes' => Bytes::fromString("\xff"), 'words' => [Big::of('18446744073709551615')],
    'product' => [$ticket, [new Some($ticket), $payload]], 'chain' => new ChainLink($ticket, null)
];
check((new Mixed_(...$mixed))->equals(new Mixed_(...$mixed)));
check((new Mixed_(...$mixed))->hashCode() === (new Mixed_(...$mixed))->hashCode());
$failure = $mixed; $failure['result'] = new Err($ticket); check((new Mixed_(...$failure))->result->value === $ticket);
foreach ([['result', new Ok($ticket)], ['result', new Err($bundle)], ['markers', [new Some(false)]],
    ['unit', new Some(false)], ['product', [$ticket, new Some($ticket), $payload]], ['ticket', null],
    ['words', [1]], ['chain', $tree]] as [$name, $value]) {
    $invalid = $mixed; $invalid[$name] = $value; reject(fn() => new Mixed_(...$invalid));
}
reject(fn() => new Ticket(), Error::class); reject(fn() => clone $ticket, Error::class);
reject(fn() => serialize($ticket), LogicException::class); reject(fn() => serialize($bundle), LogicException::class);
reject(fn() => unserialize('O:26:"LeanOwnedAggregates\\Ticket":0:{}'), LogicException::class);
$forged = (new ReflectionClass(Ticket::class))->newInstanceWithoutConstructor();
reject(fn() => new TreeLeaf($forged), TypeError::class, 'initialized');
reject(fn() => Values::hash($forged), TypeError::class, 'initialized');
reject(fn() => $forged->retain(), TypeError::class, 'initialized');
reject(fn() => ResourceAccess::wrap(Bundle::class, $binding));
$foreign = (new ReflectionClass(LeanForeignOwned\Ticket::class))->newInstanceWithoutConstructor();
reject(fn() => new TreeLeaf($foreign));
reject(fn() => new TreeBranch([null])); reject(fn() => new TreeBranch([1 => $tree]));
reject(fn() => new TreeBranch([$bundle])); reject(fn() => new TreeBranch([], 1), ArgumentCountError::class);
reject(fn() => new ChoiceEmpty(1), ArgumentCountError::class); reject(fn() => new Some(null, null), ArgumentCountError::class);
reject(fn() => new Some(), ArgumentCountError::class); reject(fn() => new Ok(), ArgumentCountError::class);
reject(fn() => new Err(), ArgumentCountError::class);
reject(fn() => new Payload(Big::of(1)), ArgumentCountError::class);
reject(fn() => new Payload(count: Big::of(1), bytes: Bytes::fromString(''), extra: true), Error::class);
reject(function() use ($payload) { $payload->count = Big::of(0); }, Error::class);

$retained = $ticket->retain(); check($retained instanceof Ticket); check($retained !== $ticket);
check(!Values::equal($ticket, $retained)); check(!Values::equal(new Some($ticket), new Some($retained)));
$frame = (object) ['alive' => true]; $borrowBinding = new ProbeBinding($frame);
$borrowed = ResourceAccess::wrap(Ticket::class, $borrowBinding); $kept = $borrowed->retain();
$borrowedTree = new TreeLeaf($borrowed); $frame->alive = false;
reject(fn() => new TreeLeaf($borrowed), LogicException::class, 'Expired');
reject(fn() => $borrowed->retain(), LogicException::class, 'Expired');
reject(fn() => $borrowedTree->hashCode(), LogicException::class, 'Expired');
check((new TreeLeaf($kept))->ticket === $kept); $kept->close();
reject(fn() => new TreeLeaf($kept), LogicException::class, 'Closed');
foreach (GraphTypes::IDENTITIES as $class => $index) {
    if (GraphTypes::NODES[$index]['kind'] !== 'callback') continue;
    $probe = new ProbeBinding(); $closure = ResourceAccess::wrap($class, $probe);
    $arity = (new ReflectionMethod($closure, '__invoke'))->getNumberOfParameters();
    $args = array_fill(0, $arity, $bundle); check($closure(...$args) === $bundle); check($probe->calls === 1);
    reject(fn() => $closure(...[...$args, null]), ArgumentCountError::class);
    reject(fn() => serialize($closure), LogicException::class);
    reject(fn() => new TreeLeaf($closure), TypeError::class, 'Wrong nominal');
    $closure->close(); reject(fn() => $closure(...$args), LogicException::class, 'Closed');
    check($probe->calls === 1);
}

$fields = ['unit' => null, 'flag' => true, 'char' => '🌲', 'natural' => Big::of(str_repeat('9', 1000)),
    'integer' => Big::of('-' . str_repeat('8', 1000)), 'u8' => 255, 'u16' => 65535,
    'u32' => exact('4294967295', 32, true), 'u64' => Big::of('18446744073709551615'),
    'i8' => -128, 'i16' => -32768, 'i32' => -2147483647 - 1, 'i64' => exact('-9223372036854775808', 64, false),
    'word' => exact(WORD_BITS === 64 ? '18446744073709551615' : '4294967295', WORD_BITS, true),
    'signedWord' => exact(WORD_BITS === 64 ? '-9223372036854775808' : '-2147483648', WORD_BITS, false),
    'f32' => -0.0, 'f64' => NAN, 'text' => "雪\0🌲", 'bytes' => LeanOwnedScalars\Bytes::fromString("\x00\xff")];
$scalars = new Scalars(...$fields); $same = new Scalars(...$fields);
check($scalars !== $same); check($scalars->equals($same)); check($scalars->hashCode() === $same->hashCode());
foreach ($fields as $name => $value) check(is_float($value) && is_nan($value) ? is_nan($scalars->$name) : $scalars->$name === $value, $name);
foreach ([['unit', false, TypeError::class], ['flag', 1, TypeError::class], ['u8', -1, ValueError::class],
    ['u8', 256, ValueError::class], ['u16', 65536, ValueError::class], ['u32', exact('4294967296', 32, true), ValueError::class],
    ['u64', Big::of('18446744073709551616'), ValueError::class], ['i8', -129, ValueError::class], ['i16', -32769, ValueError::class],
    ['i32', 2147483648, PHP_INT_SIZE === 4 ? TypeError::class : ValueError::class], ['i64', '0', TypeError::class],
    ['natural', Big::of(-1), ValueError::class], ['integer', 1, TypeError::class], ['f32', 1, TypeError::class], ['f64', '1.0', TypeError::class],
    ['text', "\xff", ValueError::class], ['bytes', '', TypeError::class], ['bytes', Bytes::fromString(''), TypeError::class],
    ['char', '', ValueError::class], ['char', 'ab', ValueError::class], ['char', "\xed\xa0\x80", ValueError::class],
    ['word', exact('-1', WORD_BITS, true), ValueError::class], ['signedWord', 1.0, TypeError::class],
    ['natural', Big::of(str_repeat('9', 16385)), ValueError::class]] as [$name, $value, $error]) {
    $invalid = $fields; $invalid[$name] = $value; reject(fn() => new Scalars(...$invalid), $error);
}
if (INTEGER_BITS === 32) {
    $invalid = $fields; $invalid['i64'] = Big::of('-9223372036854775809'); reject(fn() => new Scalars(...$invalid), ValueError::class);
}
$positiveZero = $fields; $positiveZero['f32'] = 0.0;
check(!$scalars->equals(new Scalars(...$positiveZero))); check($scalars->hashCode() !== (new Scalars(...$positiveZero))->hashCode());
foreach ([NAN, INF, -INF, -0.0, 0.0] as $number) {
    $floats = $fields; $floats['f32'] = $number; $floats['f64'] = $number;
    check((new Scalars(...$floats))->equals(new Scalars(...$floats)));
    check((new Scalars(...$floats))->hashCode() === (new Scalars(...$floats))->hashCode());
}
check(!Values::equal(1, '1')); check(!Values::equal(1, 1.0)); check(!Values::equal(true, 1));
check(!Values::equal(Big::of(1), 1)); check(!Values::equal(Bytes::fromString('x'), 'x'));
$deep = new TreeBranch([]);
for ($index = 0; $index < 63; $index++) $deep = new TreeBranch([$deep]);
check($deep->equals($deep)); check(strlen($deep->hashCode()) === 64);
reject(fn() => new TreeBranch([$deep]), ValueError::class, '128 levels');
$uninitialized = (new ReflectionClass(TreeLeaf::class))->newInstanceWithoutConstructor();
reject(fn() => $uninitialized->hashCode()); reject(fn() => new TreeBranch([$uninitialized]));
$cycle = (new ReflectionClass(TreeBranch::class))->newInstanceWithoutConstructor();
(new ReflectionProperty(TreeBranch::class, 'children'))->setValue($cycle, [$cycle]);
reject(fn() => $cycle->hashCode(), ValueError::class, 'Cyclic'); reject(fn() => $cycle->equals($cycle), ValueError::class, 'Cyclic');
reject(fn() => new TreeBranch([$cycle]), ValueError::class, 'Cyclic');
readonly class ForeignTree extends Tree {}
reject(fn() => new TreeBranch([new ForeignTree()])); reject(fn() => Values::hash(new ForeignTree()));
$arrayCycle = []; $arrayCycle[] = &$arrayCycle;
reject(fn() => Values::hash($arrayCycle), ValueError::class, 'Cyclic');
reject(fn() => Values::equal([1, $arrayCycle], [2, []]), ValueError::class, 'Cyclic');
$shared = [new TreeBranch([])]; $dag = [&$shared, &$shared];
check(Values::equal($dag, [[new TreeBranch([])], [new TreeBranch([])]]));
check(Values::hash($dag) === Values::hash([[new TreeBranch([])], [new TreeBranch([])]]));
reject(fn() => Values::hash(array_fill(0, 262145, null)), ValueError::class, 'visits');
reject(fn() => Values::hash(str_repeat('x', 16 * 1024 * 1024)), ValueError::class, '16 MiB');
$emptyBytes = (new ReflectionClass(Bytes::class))->newInstanceWithoutConstructor();
reject(fn() => $emptyBytes->hashCode(), TypeError::class, 'initialized');
$emptyInteger = (new ReflectionClass(Big::class))->newInstanceWithoutConstructor();
reject(fn() => Values::hash($emptyInteger), TypeError::class, 'initialized');
$ticket->close(); $ticket->close(); check($binding->closes === 1);
reject(fn() => $ticket->retain(), LogicException::class, 'Closed');
reject(fn() => $bundle->hashCode(), LogicException::class, 'Closed');
reject(fn() => $bundle->equals($bundle), LogicException::class, 'Closed');
check((new TreeLeaf($retained))->ticket === $retained); $retained->close();
echo json_encode(['checks' => $checks, 'rejections' => $rejections, 'integerBits' => INTEGER_BITS,
    'wordBits' => WORD_BITS, 'actualPhpBits' => PHP_INT_SIZE * 8, 'compiledLean' => false, 'installedPackage' => false]), "\n";
