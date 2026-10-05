use strict;
use warnings;
use Time::HiRes qw(clock_gettime CLOCK_MONOTONIC);
use JSON::PP;
use LeanBridge::Workshop;

my $bytes = pack('C*', 0..255) x 4;
my $callback = sub { $_[0] * 2 };
my $sink;
my %cases = (
  scalar => sub { $sink = LeanBridge::Workshop::add(19, 23) },
  bytes1024 => sub { $sink = LeanBridge::Workshop::echo_bytes($bytes) },
  callback => sub { $sink = LeanBridge::Workshop::with_callback(20, $callback) },
);
my %result;
for my $name (sort keys %cases) {
  my $call = $cases{$name};
  $call->() for 1..10000;
  my @samples;
  my $iterations = 100000;
  for (1..9) {
    my $start = clock_gettime(CLOCK_MONOTONIC);
    $call->() for 1..$iterations;
    push @samples, (clock_gettime(CLOCK_MONOTONIC) - $start) * 1e9 / $iterations;
  }
  @samples = sort { $a <=> $b } @samples;
  $result{$name} = { medianNs => $samples[4], minimumNs => $samples[0], iterations => $iterations, samples => 9 };
}
print JSON::PP->new->canonical->encode(\%result), "\n";
