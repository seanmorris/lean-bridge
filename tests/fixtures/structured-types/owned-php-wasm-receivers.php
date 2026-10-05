<?php
function receiver_members(): void {
    $root = ticket(); $alias = $root->share(); $view = $root->retainTicket();
    $kept = $view->retain(); $copy = copy_value($view);
    foreach ([$root, $alias, $view, $kept, $copy] as $owner)
        check($owner instanceof LeanOwnedAggregates\TicketValue, 'nominal resource owner');
    $raw = $root->get();
    check((string) $root->serial === '17' && (string) $raw->serial === '17', 'whole and raw properties');
    check($root->label === "wasm\0🙂" && isset($root->serial), 'copied string property');
    check(!method_exists($raw, 'retainTicket'), 'raw resources omit original-owner members');
    reject(fn() => $root->retainTicket(1), null, ArgumentCountError::class);
    reject(static function() use ($root): void { $root->serial = Big::of(99); }, null, LogicException::class);
    reject(static function() use ($root): void { unset($root->serial); }, null, LogicException::class);
    reject(fn() => $root->unknownProperty, null, OutOfBoundsException::class);
    $root->close(); check(!$view->closed(), 'member share preserves the original anchor');
    $alias->close(); check($view->closed(), 'member follows the original anchor');
    reject(fn() => $view->serial, 4); reject(fn() => $raw->serial, 4);
    check((string) $kept->serial === '17' && (string) $copy->serial === '17', 'independent nominal copies');
    dispose([$root, $alias, $view, $kept, $copy, $raw]);

    $receiver = ticket(); $source = ticket(29);
    $selected = $receiver->chooseTicket($source);
    $staticSelected = owned_call('chooseTicket', [$receiver->get(), $source]);
    $receiver->close();
    check(!$selected->closed(), 'nonreceiver anchor survives receiver close');
    check((string) $selected->serial === '29' && $selected->equals($staticSelected), 'member preserves a nonreceiver anchor');
    $source->close(); check($selected->closed() && $staticSelected->closed(), 'parameter anchor expires both calls');
    dispose([$receiver, $source, $selected, $staticSelected]);

    $record = bundle_value(); $alias = $record->share(); $view = $record->echoRecord();
    $primary = $view->primary; $payload = $record->payload;
    check($record instanceof LeanOwnedAggregates\BundleValue && $view instanceof LeanOwnedAggregates\BundleValue, 'nominal record owner');
    check($alias instanceof LeanOwnedAggregates\BundleValue && $primary instanceof LeanOwnedAggregates\TicketValue, 'typed shared and property results');
    check((string) $primary->serial === '17', 'receiver-anchored property');
    $escaped = null;
    $callback = $record->callbackRecord(static function($value) use (&$escaped) { $escaped = $value; return $value; });
    check($callback->equals($record), 'callback member preserves records');
    reject(fn() => $escaped->primary->serial, 4);
    $closure = $record->makeRecord(); $out = $closure(true, $record->get());
    check($out instanceof LeanOwnedAggregates\BundleValue && $out->equals($record), 'closure result preserves nominal owner');
    $record->close(); $alias->close();
    check($view->closed() && $primary->closed() && $callback->closed() && $closure->closed(), 'member descendants expire');
    check(semantic_value($payload) === semantic_value(payload()), 'copied property survives its receiver');
    dispose([$record, $alias, $view, $primary, $callback, $closure, $out, $escaped]);

    $choice = copy_value(new ChoiceEmpty()); $choiceView = $choice->echoVariant();
    $tree = copy_value(new TreeBranch([])); $treeView = $tree->echoRecursive();
    check($choice instanceof LeanOwnedAggregates\ChoiceValue && $choiceView instanceof LeanOwnedAggregates\ChoiceValue, 'nominal empty variant');
    check($tree instanceof LeanOwnedAggregates\TreeValue && $treeView instanceof LeanOwnedAggregates\TreeValue, 'nominal empty recursive value');
    $treeCopy = $treeView->retain(); $treeAlias = $tree->share();
    $choice->close(); $tree->close(); $treeAlias->close();
    check($choiceView->closed() && $treeView->closed(), 'empty member results expire');
    check($treeCopy instanceof LeanOwnedAggregates\TreeValue && $treeCopy->get() instanceof TreeBranch, 'empty nominal retain survives');
    dispose([$choice, $choiceView, $tree, $treeView, $treeCopy, $treeAlias]);

    $anchor = ticket(); $consumed = ticket(31); $alias = $consumed->share();
    $oldView = $consumed->retainTicket(); $kept = $consumed->retain();
    $mixed = $anchor->mixedTicket($consumed);
    check($consumed->closed() && $alias->closed() && $oldView->closed(), 'member consumes original parameter');
    check(!$anchor->closed() && (string) $mixed->serial === '31', 'mixed member retains receiver anchor');
    $anchor->close(); check($mixed->closed() && (string) $kept->serial === '31', 'mixed member anchor expiration');
    dispose([$anchor, $consumed, $alias, $oldView, $kept, $mixed]);

    $root = ticket(); $alias = $root->share(); $view = $root->retainTicket();
    $before = owned_transfer_stats()['handoffs']; $moved = $root->transferTicket();
    check($root->closed() && $alias->closed() && $view->closed(), 'member consumes the original receiver');
    check(owned_transfer_stats()['handoffs'] === $before + 1 && (string) $moved->serial === '17', 'one original receiver handoff');
    dispose([$root, $alias, $view, $moved]);

    $record = bundle_value(); $alias = $record->share(); $view = $record->echoRecord();
    $moved = $record->moveRecord(static function($value) use ($record, $alias, $view) {
        check($record->closed() && $alias->closed() && $view->closed(), 'receiver consumed before callback');
        return $value;
    });
    check($moved instanceof LeanOwnedAggregates\BundleValue && (string) $moved->primary->serial === '17', 'typed consuming aggregate result');
    dispose([$record, $alias, $view, $moved]);
}
