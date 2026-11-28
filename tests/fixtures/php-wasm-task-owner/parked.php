<?php
// Appended to the normal Jobs application, in the same installed PHP request.
use function LeanJobs\{open_read, read_pulls, read_closes, on_read, release_read, finished_read, ready_sibling};

$before=read_closes(); $pulls=read_pulls(); $calls=0; $items=0;
$cursor=open_read(\Brick\Math\BigInteger::of(2));
$interrupt=on_read(function($n) use($cursor,&$calls) {
    ++$calls; check((string)$n==='1','Lean worker did not enter its read');
    check($cursor->cancel() && !$cursor->cancel(),'cancel a blocked read exactly once');
    return $n;
});
try {
    rejects(\LeanJobs\TaskCancelled::class,static function() use($cursor,&$items) {
        foreach ($cursor as $item) ++$items;
    });
    check((string)$interrupt->await()==='1' && $calls===1 && $items===0,'cancelled read delivered a value');
    check(read_pulls()->isEqualTo($pulls->plus(1)) && read_closes()->isEqualTo($before),'worker drained before its gate opened');
    check((string)ready_sibling(\Brick\Math\BigInteger::of(41))->await()==='42','independent task while read parked');
    $late=finished_read();
    release_read(\Brick\Math\BigInteger::of(71));
    check((string)$late->await()==='73','actual late worker result');
} finally {
    release_read(\Brick\Math\BigInteger::of(0));
    $cursor->close(); $cursor->close();
}
check($items===0 && read_closes()->isEqualTo($before->plus(1)) && read_pulls()->isEqualTo($pulls->plus(1)),'late delivery or duplicate finalizer');
echo '; parked reader cancelled before gate, zero items, late 73, one finalizer';
