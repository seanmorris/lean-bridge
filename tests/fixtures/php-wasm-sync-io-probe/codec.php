<?php
declare(strict_types=1);
use Brick\Math\BigInteger;
use LeanLedger\Bytes;
use LeanLedger\Internal\{Budget,WireValues};

require_once '/vendor/lean-bridge/ledger/bootstrap.php';
if (PHP_INT_SIZE!==4) throw new Exception('Expected real wasm32 Zend');
$vectors=[
    ['unit', null, '0000000000000000'], ['bool', true, '0100000000000000'],
    ['int8', -128, '80ffffffffffffff'], ['int16', -32768, '0080ffffffffffff'],
    ['int32', PHP_INT_MIN, '00000080ffffffff'], ['isize', PHP_INT_MIN, '00000080ffffffff'],
    ['uint8', 255, 'ff00000000000000'], ['uint16', 65535, 'ffff000000000000'],
    ['uint32', BigInteger::of('4294967295'), 'ffffffff00000000'],
    ['usize', BigInteger::of('4294967295'), 'ffffffff00000000'],
    ['int64', BigInteger::of('-9223372036854775808'), '0000000000000080'],
    ['int64', BigInteger::of('9223372036854775807'), 'ffffffffffffff7f'],
    ['uint64', BigInteger::of('18446744073709551615'), 'ffffffffffffffff'],
    ['nat', BigInteger::of('18446744073709551616'), '000000000000000000000000000000000100000000000000'],
    ['int', BigInteger::of('-18446744073709551616'), '010000000000000000000000000000000100000000000000'],
    ['int', BigInteger::zero(), '0000000000000000'], ['char', '🗝', 'ddf5010000000000'],
    ['float32', -1.5, '0000c0bf00000000'], ['float64', 1.0, '000000000000f03f'],
    ['bytes', Bytes::fromString("\x00\xff"), '00ff'], ['string', "δ\0", 'ceb400']
];
foreach ($vectors as [$kind,$value,$hex]) {
    if (bin2hex(WireValues::input($kind,$value,new Budget()))!==$hex) throw new Exception("Wrong encoded ".$kind);
    $decoded=WireValues::output($kind,"\0",hex2bin($hex));
    $valid=$value instanceof BigInteger ? $decoded instanceof BigInteger && $value->isEqualTo($decoded)
        : ($value instanceof Bytes ? $value->equals($decoded) : $value===$decoded);
    if (!$valid) throw new Exception("Wrong decoded ".$kind);
}
echo "codec:",count($vectors);
