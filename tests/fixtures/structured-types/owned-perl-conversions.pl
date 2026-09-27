use strict;
use warnings;
use utf8;
use JSON::PP;
use Math::BigInt;
use Scalar::Util qw(blessed refaddr);
use LeanBridge::OwnedProbe;

my $checks = 0;
sub check { my ($ok, $why) = @_; die "conversion check " . ($checks + 1) . ": $why\n" unless $ok; ++$checks; }
sub rejected {
    my ($code, $expected) = @_;
    my $ok = eval { $code->(); 1 };
    check(!$ok && $@ =~ $expected, "expected $expected; received $@");
}
sub snapshot { [LeanBridge::OwnedProbe::snapshot()] }
sub restored {
    my ($before) = @_;
    my $after = snapshot();
    check(join(',', @$before[0 .. 3, 6, 7]) eq join(',', @$after[0 .. 3, 6, 7]),
        'balanced owner ledger: ' . encode_json($after));
}
my $empty = snapshot();
my $large = Math::BigInt->new(2)->bpow(521)->badd(12345);
my $ticket = LeanBridge::OwnedProbe::converted_new_ticket($large, "forest 🌿\0tail");
check(LeanBridge::OwnedProbe::converted_serial($ticket)->bcmp($large) == 0, 'unbounded Nat enters and leaves real Lean');
my $negative = $large->copy()->bneg();
my $payload = LeanBridge::OwnedProbe::Payload->new(count => $negative, bytes => "\xff\0\x01");
my $bundle = LeanBridge::OwnedProbe::Bundle->new(primary => $ticket,
    spare => LeanBridge::OwnedProbe::Some->new($ticket),
    peers => [$ticket, $ticket], history => [$ticket], payload => $payload);
my $baseline = snapshot();
{
    my $copy = LeanBridge::OwnedProbe::converted_echo_record($bundle);
    check(blessed($copy) eq 'LeanBridge::OwnedProbe::Bundle', 'nominal record result');
    check(refaddr($copy) != refaddr($bundle), 'copied outer record');
    check(refaddr($copy->primary) != refaddr($ticket), 'independently owned result leaf');
    check(LeanBridge::OwnedProbe::converted_serial($copy->primary)->bcmp($large) == 0, 'primary value');
    check(LeanBridge::OwnedProbe::converted_serial($copy->spare->value)->bcmp($large) == 0, 'optional resource value');
    check(@{$copy->peers} == 2 && @{$copy->history} == 1, 'array and List preserve length');
    check($copy->payload->count->bcmp($negative) == 0 && $copy->payload->bytes eq "\xff\0\x01", 'negative Int and raw bytes');
    LeanBridge::OwnedProbe::close($copy->primary);
    check(LeanBridge::OwnedProbe::converted_serial($copy->peers->[1])->bcmp($large) == 0, 'closing one leaf preserves siblings');
    $copy->payload->{bytes} = 'changed';
    check($payload->bytes eq "\xff\0\x01", 'returned payload is independent');
}
restored($baseline);
{
    my $none = LeanBridge::OwnedProbe::Bundle->new(primary => $ticket, spare => undef,
        peers => [], history => [], payload => $payload);
    my $out = LeanBridge::OwnedProbe::converted_echo_record($none);
    check(!defined($out->spare) && !@{$out->peers} && !@{$out->history}, 'None and empty sequences');
    my $tree = LeanBridge::OwnedProbe::Tree::Branch->new(children => [
        LeanBridge::OwnedProbe::Tree::Leaf->new(ticket => $ticket),
        LeanBridge::OwnedProbe::Tree::Branch->new(children => [])]);
    my $cloned = LeanBridge::OwnedProbe::copy_Tree($tree);
    check(blessed($cloned) eq 'LeanBridge::OwnedProbe::Tree::Branch', 'recursive constructor retained');
    check(LeanBridge::OwnedProbe::converted_serial($cloned->children->[0]->ticket)->bcmp($large) == 0, 'recursive resource value');
    check(!@{$cloned->children->[1]->children}, 'empty recursive branch');
}
restored($baseline);
for my $text ('', "\0", "ascii\0tail", "é🌿\0尾") {
    check(LeanBridge::OwnedProbe::copy_string($text) eq $text, 'Unicode and embedded NUL');
}
check(LeanBridge::OwnedProbe::copy_int($negative)->bcmp($negative) == 0, 'GMP Int copied through native facade');
rejected(sub { LeanBridge::OwnedProbe::converted_new_ticket($negative, '') }, qr/Nat cannot be negative/);
rejected(sub { LeanBridge::OwnedProbe::converted_new_ticket(731, '') }, qr/Math::BigInt/);
rejected(sub { LeanBridge::OwnedProbe::converted_echo_record(bless {}, 'LeanBridge::OwnedProbe::Bundle') }, qr/fields/);
{
    my $cycle = LeanBridge::OwnedProbe::Tree::Branch->new(children => []);
    push @{$cycle->children}, $cycle;
    rejected(sub { LeanBridge::OwnedProbe::copy_Tree($cycle) }, qr/Cyclic/);
    @{$cycle->children} = ();
    my $deep = LeanBridge::OwnedProbe::Tree::Leaf->new(ticket => $ticket);
    for (1 .. 100) { $deep = LeanBridge::OwnedProbe::Tree::Branch->new(children => [$deep]); }
    rejected(sub { LeanBridge::OwnedProbe::copy_Tree($deep) }, qr/depth or node limit/);
}
restored($baseline);

LeanBridge::OwnedProbe::reset();
{ my $out = LeanBridge::OwnedProbe::converted_echo_record($bundle); }
my $steps = snapshot();
my ($allocator, $exceptions, $native) = (0, 0, 0);
for my $index (1 .. $steps->[4]) {
    LeanBridge::OwnedProbe::reset($index);
    rejected(sub { my $out = LeanBridge::OwnedProbe::converted_echo_record($bundle) }, qr/allocation failed/);
    ++$allocator;
    LeanBridge::OwnedProbe::reset(); restored($baseline);
}
for my $index (1 .. $steps->[5]) {
    LeanBridge::OwnedProbe::reset(0, $index);
    rejected(sub { my $out = LeanBridge::OwnedProbe::converted_echo_record($bundle) }, qr/injected Perl ownership exception/);
    ++$exceptions;
    LeanBridge::OwnedProbe::reset(); restored($baseline);
}
my $completed = 0;
for my $index (0 .. 255) {
    LeanBridge::OwnedProbe::reset(0, 0, $index);
    my $ok = eval { my $out = LeanBridge::OwnedProbe::converted_echo_record($bundle); 1 };
    my $error = $@;
    LeanBridge::OwnedProbe::reset(); restored($baseline);
    if ($ok) { $completed = 1; last; }
    check($error =~ /allocation failed/, "native conversion allocator: $error"); ++$native;
}
check($completed, 'native allocation fault walk completes');
undef $bundle; undef $payload;
LeanBridge::OwnedProbe::close($ticket); undef $ticket;
restored($empty);
LeanBridge::OwnedProbe::shutdown();
my $final = snapshot();
check(!(grep { $_ != 0 } @$final[0 .. 3, 6, 7]), 'all conversion storage and native identities released');
print encode_json({ checks => $checks, allocatorFailures => $allocator, exceptions => $exceptions,
    nativeFailures => $native, live => $final->[0], identities => $final->[2] }), "\n";
