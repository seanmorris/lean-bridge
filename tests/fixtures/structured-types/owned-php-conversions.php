<?php
declare(strict_types=1);

require __DIR__ . '/probe.php';

use Brick\Math\BigInteger as Big;
use LeanOwnedAggregates\{Bytes, Some, Ok, Err, Payload, Bundle, TreeLeaf, TreeBranch, ChainStop, ChainLink, ChoiceEmpty, ChoiceOne, ChoicePair, ChoiceMany, Mixed_, Packet};
use LeanOwnedAggregates\Internal\{OwnedConversions, OwnedConversionScope, ResourceAccess};

$ticket = native_call('newTicket', [Big::of(42), "A\0雪🙂"]);
$scalar = ($argv[1] ?? '') === 'scalars'; $primitives = $scalar ? 19 : 0;
if ($scalar) {
    $packet = native_call('makePacket', [$ticket]);
    check(native_call('inspect', [$packet]) === true);
    $copy = native_call('echo', [$packet]); check(native_call('inspect', [$copy]) === true);
    check($copy !== $packet && $copy->scalars !== $packet->scalars && $copy->ticket !== $ticket);
    check($copy->scalars->equals($packet->scalars)); dispose($copy); unset($copy);
    foreach ([null, new Some(null), new Some(new Some(null))] as $index => $option) {
        $input = new Packet($ticket, $packet->scalars, $option, $packet->empty);
        $output = native_call('echo', [$input]); check(native_call('optionCase', [$output]) === $index);
        dispose($output); unset($input, $output);
    }
    foreach ([-0.0, INF, -INF, NAN, 1.00000001] as $number) {
        $input = replace_value($packet, ['scalars' => replace_value($packet->scalars, ['f32' => $number, 'f64' => $number])]);
        $output = native_call('echo', [$input]);
        if (is_nan($number)) check(is_nan($output->scalars->f32) && is_nan($output->scalars->f64));
        else {
            check(pack('g', $output->scalars->f32) === pack('g', $number));
            check(pack('e', $output->scalars->f64) === pack('e', $number));
        }
        dispose($output); unset($input, $output);
    }
    check(native_call('units', [[null, null, null]]) === [null, null, null]);
    check(native_call('units', [[]]) === []);
    foreach (['0', '1', str_repeat('9', 16384)] as $decimal) {
        foreach (['nat', 'int'] as $name) {
            $type = $model['types'][$name]; $number = Big::of($decimal);
            check((string) native_call('copy:' . $type, [$number]) === $decimal);
            if ($name === 'int' && $decimal !== '0') check((string) native_call('copy:' . $type, [Big::of('-' . $decimal)]) === '-' . $decimal);
        }
    }
    reject(fn() => native_call('newTicket', [Big::of(-1), 'invalid']));
    reject(fn() => native_call('newTicket', [42, 'invalid']));
    reject(fn() => native_call('newTicket', [Big::of(1), "\xed\xa0\x80"]));
    reject(fn() => native_call('newTicket', [Big::of(str_repeat('9', 16385)), 'too long']));
    foreach (['unit', 'flag', 'char', 'text', 'natural'] as $key) {
        output_fault('echo', $packet, static function(int $type, FFI\CData $out, OwnedConversionScope $scope) use ($schema, $key): void {
            [$record, $pointer] = field_pointer($type, $out, 'scalars');
            [$child, $at] = field_pointer($record, $pointer, $key);
            if ($key === 'unit' || $key === 'flag') $at[0] = 2;
            elseif ($key === 'char') $schema->ffi->cast('uint32_t*', $at)[0] = 0xd800;
            elseif ($key === 'natural') $schema->writePointer($at, $scope->integer('-1'));
            else $schema->readPointer($at + $schema->nodes[$child]['dataOffset'])[0] = 255;
        });
    }
    output_fault('echo', $packet, static function(int $type, FFI\CData $out) use ($schema): void {
        [$child, $at] = field_pointer($type, $out, 'optional'); $at[$schema->nodes[$child]['flagOffset']] = 2;
    }, 9);
    foreach (['null', 'overflow'] as $kind) output_fault('units', [null], static function(int $type, FFI\CData $out) use ($schema, $kind): void {
        $node = $schema->nodes[$type];
        if ($kind === 'null') $schema->writePointer($out + $node['dataOffset'], null);
        else $schema->ffi->cast('size_t*', $out + $node['lengthOffset'])[0] = -1;
    });
    [$phpFailures, $nativeFailures] = fault_sweep('echo', $packet);
    $field = array_values(array_filter($schema->nodes[$model['types']['Packet']]['branches'][0]['fields'], fn($field) => $field['key'] === 'scalars'))[0];
    $beforeRead = static function(int $type, FFI\CData $out) use ($schema, $field): void { $schema->writePointer($out + $field['offset'], null); };
    $live = $ffi->owned_test_live(); $identities = $ffi->owned_test_identities();
    reject(fn() => native_call('echo', [$packet]), 9); $beforeRead = null;
    check($ffi->owned_test_live() === $live && $ffi->owned_test_identities() === $identities);
    dispose($packet); unset($packet);
} else {
    $second = native_call('newTicket', [Big::of('340282366920938463463374607431768211457'), 'second']);
    check((string) native_call('serial', [$second]) === '340282366920938463463374607431768211457');
    check(native_call('label', [$ticket]) === "A\0雪🙂");
    $payload = new Payload(Big::of('-340282366920938463463374607431768211457'), Bytes::fromString("\0\xffpayload"));
    $bundle = new Bundle($ticket, new Some($second), [$ticket, $second], [$second, $ticket], $payload);
    $tree = new TreeBranch([new TreeLeaf($ticket), new TreeBranch([new TreeLeaf($second)])]);
    $chain = new ChainLink($ticket, new Some(new ChainLink($second, new Some(new ChainStop()))));
    $mixed = new Mixed_($ticket, [null, new Some(null), new Some(new Some(false)), new Some(new Some(true))],
        new Some(null), new Ok($bundle), Big::of('-99999999999999999999'), Big::of('99999999999999999999'), '🙂', -0.0, 1.5,
        Bytes::fromString("\xff\0bytes"), [Big::of(0), Big::of('18446744073709551615')], [$second, [new Some($ticket), $payload]], $chain);
    foreach ([['echoArray', []], ['echoList', []], ['echoArray', [$ticket, $second]], ['echoList', [$second, $ticket]],
        ['echoOption', null], ['echoOption', new Some($ticket)], ['echoResult', new Ok($bundle)], ['echoResult', new Err($ticket)],
        ['echoTuple', [$ticket, [new Some($second), $payload]]], ['echoRecord', $bundle], ['echoAlias', $bundle],
        ['echoVariant', new ChoiceEmpty()], ['echoVariant', new ChoiceOne($ticket)], ['echoVariant', new ChoicePair($ticket, $second)],
        ['echoVariant', new ChoiceMany([$ticket, $second])], ['echoRow', [null, new Some($ticket), new Some($second)]],
        ['echoRecursive', $tree], ['echoRecursive', new TreeBranch([])], ['echoChain', $chain], ['echoChain', new ChainStop()],
        ['echoNested', [[null, new Some(new Ok($bundle)), new Some(new Err($ticket))], []]], ['echoMixed', $mixed]] as [$name, $input]) {
        $output = native_call($name, [$input]);
        check(semantic_value($output) === semantic_value($input), $name . ' preserves every field');
        dispose($output); unset($output);
    }
    unset($input);
    $copy = native_call('echoMixed', [$mixed]);
    check($copy !== $mixed && $copy->ticket !== $ticket && $copy->chain !== $chain);
    check((string) native_call('serial', [$copy->ticket]) === '42');
    check($copy->markers[1]->value === null && $copy->markers[2]->value->value === false && $copy->markers[3]->value->value === true);
    check($copy->unit instanceof Some && $copy->unit->value === null);
    check($copy->result instanceof Ok && $copy->result->value->payload->equals($payload));
    check((string) $copy->signed === '-99999999999999999999' && (string) $copy->unsigned === '99999999999999999999');
    check($copy->scalar === '🙂' && pack('e', $copy->precise) === pack('e', -0.0));
    check($copy->bytes->toString() === "\xff\0bytes" && (string) $copy->words[1] === '18446744073709551615');
    check((string) native_call('serial', [$copy->product[0]]) === '340282366920938463463374607431768211457');
    $kept = $copy->ticket->retain(); dispose($copy); unset($copy);
    check((string) native_call('serial', [$kept]) === '42'); $kept->close(); unset($kept);
    $closure = native_call('makeRecord', [$bundle]);
    $output = $closure(true, $bundle); check($output->payload->equals($payload)); dispose($output); unset($output);
    $retained = $closure->retain(); $closure->close();
    $output = $retained(false, $bundle); check($output->payload->equals($payload)); dispose($output); unset($output);
    $retained->close(); reject(fn() => $retained(false, $bundle), 4); unset($closure, $retained);
    $identity = native_call('identityClosure', [null]); $dispatch = native_call('dispatch', [$bundle]);
    $output = $dispatch($identity); check($output->payload->equals($payload)); dispose($output); unset($output);
    $identity->close(); $dispatch->close(); unset($identity, $dispatch);
    foreach (['cycle', 'misaligned'] as $kind) output_fault('echoRecursive', $tree, static function(int $type, FFI\CData $out) use ($schema, $kind): void {
        [$array, $at] = field_pointer($type, $out, 'children', 1); $node = $schema->nodes[$array];
        $data = $kind === 'cycle' ? $out : $schema->readPointer($at + $node['dataOffset']) + 1;
        $schema->writePointer($at + $node['dataOffset'], $data);
        $schema->ffi->cast('size_t*', $at + $node['lengthOffset'])[0] = 1;
    }, 9);
    $reflection = new ReflectionClass(TreeBranch::class); $cycle = $reflection->newInstanceWithoutConstructor();
    $reflection->getProperty('children')->setValue($cycle, [$cycle]);
    try { native_call('echoRecursive', [$cycle]); throw new RuntimeException('Missing cycle rejection'); }
    catch (ValueError $error) { check(str_contains($error->getMessage(), 'Cyclic')); }
    unset($cycle); gc_collect_cycles();
    $deep = new TreeLeaf($ticket);
    for ($index = 0; $index < 130; $index++) {
        $parent = $reflection->newInstanceWithoutConstructor(); $reflection->getProperty('children')->setValue($parent, [$deep]); $deep = $parent;
    }
    try { native_call('echoRecursive', [$deep]); throw new RuntimeException('Missing nesting rejection'); }
    catch (ValueError $error) { check(str_contains($error->getMessage(), '128')); }
    unset($parent, $deep);
    [$phpFailures, $nativeFailures] = fault_sweep('echoMixed', $mixed);
    $live = $ffi->owned_test_live(); $identities = $ffi->owned_test_identities();
    $beforeRead = static function(int $type, FFI\CData $out) use ($schema): void {
        $schema->ffi->cast('uint32_t*', $out + $schema->nodes[$type]['flagOffset'])[0] = 4294967295;
    };
    reject(fn() => native_call('echoRecursive', [$tree]), 9); $beforeRead = null;
    check($ffi->owned_test_live() === $live && $ffi->owned_test_identities() === $identities);
    // Conversion pins a lease independently of the wrapper being closed.
    $pinned = native_call('newTicket', [Big::of(77), 'pinned']);
    $scope = new OwnedConversionScope($schema, $runtime->current());
    OwnedConversions::write($model['types']['Ticket'], $pinned, $scope);
    $pinned->close(); check($ffi->owned_test_identities() > $identities);
    $scope->close(); unset($scope, $pinned);
    check($ffi->owned_test_live() === $live && $ffi->owned_test_identities() === $identities);
    dispose($mixed); dispose($tree); dispose($bundle); dispose($chain); $second->close();
    unset($mixed, $tree, $bundle, $chain, $second);
}
$ticket->close(); unset($ticket); gc_collect_cycles(); $runtime->close();
check($ffi->owned_test_live() === 0, 'final native allocations');
check($ffi->owned_test_identities() === 0, 'final broker identities');
echo json_encode(['checks' => $checks, 'primitives' => $primitives, 'phpFailures' => $phpFailures, 'nativeFailures' => $nativeFailures,
    'live' => $ffi->owned_test_live(), 'identities' => $ffi->owned_test_identities()]), "\n";
