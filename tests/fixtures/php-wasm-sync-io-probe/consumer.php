<?php
declare(strict_types=1);
use Brick\Math\BigInteger;
use function LeanLedger\{add,read_total,choose,signed,magnitude,wide,io_failure};
use LeanLedger\{Ok, Err, ChooseError, IOError};

require_once '/vendor/lean-bridge/ledger/bootstrap.php';
$checks=0;
function check(bool $condition): void {
    global $checks;
    if (!$condition) throw new RuntimeException("Failed PHP consumer check ".($checks+1));
    ++$checks;
}
function raises(string $class, Closure $run): Throwable {
    try { $run(); } catch (Throwable $e) { check($e instanceof $class); return $e; }
    throw new RuntimeException("Expected ".$class);
}
$big=BigInteger::of('4000000000');
raises(TypeError::class,fn()=>add('4000000000'));
raises(ValueError::class,fn()=>add(BigInteger::of('4294967296')));
raises(ValueError::class,fn()=>add(BigInteger::of(-1)));
check(read_total()->isZero());
check(add($big)->isEqualTo($big));
check(read_total()->isEqualTo($big));
raises(TypeError::class,fn()=>add(1));
check(read_total()->isEqualTo($big));
check(signed(PHP_INT_MIN)===PHP_INT_MIN);
check(signed(PHP_INT_MAX)===PHP_INT_MAX);
foreach (['0','1','-1','-9223372036854775808','18446744073709551615','-1208925819614629174706177'] as $text)
    check((string)magnitude(BigInteger::of($text))===$text);
check((string)wide(BigInteger::of('18446744073709551615'))==='18446744073709551615');
raises(ValueError::class,fn()=>wide(BigInteger::of('18446744073709551616')));
foreach ([false,true] as $text) {
    $expected=$text ? new Ok("a\0b") : new Err($big);
    $value=choose(false,$text,"a\0b");
    check($expected->equals($value));
    check($expected->hashCode()===$value->hashCode());
    $error=raises(ChooseError::class,fn()=>choose(true,$text,"a\0b"));
    check($error->declaration==='Ledger.choose' && $expected->equals($error->payload));
}
$failure=raises(IOError::class,fn()=>io_failure());
check($failure->declaration==='Ledger.ioFailure' && $failure->payload==='ledger offline');
raises(ValueError::class,fn()=>choose(false,true,"\xff"));
check(read_total()->isEqualTo($big));
echo "php-api:",$checks;
