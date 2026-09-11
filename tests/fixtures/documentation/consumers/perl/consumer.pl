use strict;
use warnings;
use Math::BigInt;
use LeanBridge::Workshop;

print LeanBridge::Workshop::add(19, 23), "\n";
my $large = Math::BigInt->new(2)->bpow(256)->badd(1);
die "integer conversion" unless LeanBridge::Workshop::echo_nat($large)->bcmp($large) == 0;

my $counter = LeanBridge::Workshop::new_counter(42);
my $adder = LeanBridge::Workshop::make_adder(7);
my $ok = eval {
  print LeanBridge::Workshop::read_counter($counter), "\n";
  print $adder->call(35), "\n";
  print LeanBridge::Workshop::with_callback(20, sub { $_[0] * 2 }), "\n";
  1;
};
my $error = $@;
$adder->close;
$counter->close;
die $error unless $ok;
