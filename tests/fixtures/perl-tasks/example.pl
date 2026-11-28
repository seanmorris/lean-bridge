use v5.36;
use LeanBridge::Pulse;

my $answer = LeanBridge::Pulse::checked(!!0, !!0, '')->get;
say $answer->value;
my $cursor = LeanBridge::Pulse::series(!!0, !!0, 'first');
while (my @item = $cursor->next->get) {
    say $item[0]->value;
}
$cursor->close;
