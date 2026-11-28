use v5.36;
use LeanBridge::Journal;

say LeanBridge::Journal::bump(42);
my $returned = LeanBridge::Journal::choose(!!0, !!0, 'not used');
say $returned->value;  # An Err returned as data.

my $ok = eval { LeanBridge::Journal::choose(!!1, !!1, 'out of stock'); 1 };
unless ($ok) {
    my $error = $@;
    die $error unless ref($error) && $error->isa('LeanBridge::Journal::Error::choose');
    say $error->payload->value;
}
