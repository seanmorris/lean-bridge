use strict;
use warnings;
use LeanBridge::DirectProofErasure;

my $checks = 0;
for my $value (0 .. 1004) {
  die "payload changed\n"
    unless LeanBridge::DirectProofErasure::keep($value) == $value;
  ++$checks;
}
print "direct-proof-perl:$checks\n";
