sub receiver_members {
    {
        my $root = ticket(42); my $other = ticket(57);
        check(ref($root) eq 'LeanBridge::OwnedProbe::TicketValue', 'nominal ticket owner');
        check($root->serial->bcmp(42) == 0 && $root->get->serial->bcmp(42) == 0, 'whole and raw receiver properties');
        rejected(sub { $root->serial(99) }, qr/serial expects 1 arguments/);
        check(!$root->get->can('retain_ticket') && !$root->get->can('transfer_ticket'), 'raw receiver cannot anchor or consume');
        my $view = $root->retain_ticket; my $independent = $view->retain;
        my $selected = $root->choose_ticket($other);
        my $raw_selected = $root->get->choose_ticket($other);
        check($selected->serial->bcmp(57) == 0 && $raw_selected->serial->bcmp(57) == 0, 'member selects remaining parameter owner');
        $root->close;
        check($view->closed && $independent->serial->bcmp(42) == 0, 'member borrows original receiver');
        rejected(sub { $view->serial }, qr/status=4/);
        check($selected->serial->bcmp(57) == 0 && $raw_selected->serial->bcmp(57) == 0, 'member selects remaining parameter owner');
        $other->close;
        check($selected->closed && $raw_selected->closed, 'remaining parameter controls member expiration');
        dispose([$root, $other, $view, $independent, $selected, $raw_selected]);
    }
    {
        my $root = ticket(23); my $alias = $root->share;
        my $retained = $root->retain;
        my $copied = invoke('copy_value', $root);
        my $base_share = LeanBridge::OwnedProbe::Value::share($root);
        check(!(grep { ref($_) ne 'LeanBridge::OwnedProbe::TicketValue' } ($alias, $retained, $copied, $base_share)), 'share, retain and copy preserve nominal methods');
        my $borrowed = $root->retain_ticket;
        $root->close; $alias->close;
        check(!$borrowed->closed && $base_share->serial->bcmp(23) == 0, 'base share keeps original owner');
        $base_share->close;
        check($borrowed->closed && $retained->serial->bcmp(23) == 0 && $copied->serial->bcmp(23) == 0, 'independent owner methods survive original close');
        dispose([$root, $alias, $retained, $copied, $base_share, $borrowed]);
    }
    {
        my $root = ticket(31); my $record = invoke('copy_value', bundle($root->get));
        check(ref($record) eq 'LeanBridge::OwnedProbe::BundleValue', 'nominal record owner');
        my $primary = $record->primary; my $child = $record->echo_record;
        my $payload = $record->payload;
        check(ref($primary) eq 'LeanBridge::OwnedProbe::TicketValue' && ref($child) eq 'LeanBridge::OwnedProbe::BundleValue', 'members return nominal owners');
        my $retained = $primary->retain; my $escaped;
        my $returned = $record->callback_record(sub {
            $escaped = $_[0]->primary;
            check($escaped->serial->bcmp(31) == 0, 'callback raw member borrows its frame');
            return $_[0];
        });
        rejected(sub { $escaped->serial }, qr/closed|expired|status=4/);
        rejected(sub { $root->choose_ticket($record) }, qr/Wrong Lean identity type/);
        $record->close;
        check($primary->closed && $child->closed && $retained->serial->bcmp(31) == 0, 'record receiver expires descendants');
        check($payload->count->bcmp(-9) == 0, 'copied property survives receiver close');
        dispose([$root, $record, $primary, $child, $retained, $escaped, $returned]);
    }
    {
        my $root = ticket(71); my $record = invoke('copy_value', bundle($root->get));
        my $alias = $record->share; my $independent = $record->retain;
        my $moved = $record->move_record(sub {
            check($record->closed && $alias->closed, 'consuming receiver closes original before callback');
            return $_[0];
        });
        check(ref($moved) eq 'LeanBridge::OwnedProbe::BundleValue', 'consuming receiver returns nominal owner');
        my $primary = $moved->primary; my $safe = $independent->primary;
        check($primary->serial->bcmp(71) == 0 && $safe->serial->bcmp(71) == 0, 'independent member ownership survives consumption');
        dispose([$root, $record, $alias, $independent, $moved, $primary, $safe]);
    }
    {
        my $root = ticket(71); my $consumed = ticket(0);
        my $view = $root->mixed_ticket($consumed);
        check(!$root->closed && $consumed->closed && $view->serial->bcmp(71) == 0, 'member consumes remaining parameter without shifting receiver anchor');
        $root->close;
        check($view->closed, 'mixed member borrows original receiver');
        dispose([$root, $consumed, $view]);
    }
    {
        my $choice = invoke('copy_value', LeanBridge::OwnedProbe::Choice::Many->new(tickets => []));
        my $view = $choice->echo_variant; my $retained = $view->retain;
        check(ref($view) eq 'LeanBridge::OwnedProbe::ChoiceValue' && @{$view->get->tickets} == 0, 'empty variant receiver result');
        $choice->close;
        check($view->closed && !$retained->closed, 'empty variant member borrows original owner');
        dispose([$choice, $view, $retained]);
    }
    {
        my $tree = invoke('copy_value', LeanBridge::OwnedProbe::Tree::Branch->new(children => []));
        my $view = $tree->echo_recursive;
        my $callback = $tree->callback_recursive(sub { return $_[0] });
        my $closure = $tree->make_recursive; my $retained = $closure->retain;
        check(ref($view) eq 'LeanBridge::OwnedProbe::TreeValue' && ref($callback) eq 'LeanBridge::OwnedProbe::TreeValue', 'recursive members return nominal owners');
        $tree->close;
        check($view->closed && $callback->closed && $closure->closed, 'recursive member and closure borrow receiver');
        my $reply = $retained->call(LeanBridge::OwnedProbe::false, LeanBridge::OwnedProbe::Tree::Branch->new(children => []));
        check(ref($reply) eq 'LeanBridge::OwnedProbe::TreeValue' && @{$reply->get->children} == 0, 'retained closure returns nominal owner');
        dispose([$tree, $view, $callback, $closure, $retained, $reply]);
    }
    {
        my $view;
        { my $root = ticket(42); $view = $root->retain_ticket }
        check($view->closed, 'receiver finalization expires member result');
        $view->close;
    }
    {
        my $fake = bless {}, 'LeanBridge::OwnedProbe::TicketValue';
        rejected(sub { $fake->serial }, qr/Invalid or foreign Lean identity/);
        rejected(sub { LeanBridge::OwnedProbe::TicketValue->new }, qr/Value owners come from Lean/);
    }
}
