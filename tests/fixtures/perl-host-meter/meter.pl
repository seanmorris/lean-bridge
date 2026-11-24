use strict;
use warnings;
use LeanBridge::Workshop;

{
    package App::Meter;
    sub new      { bless {level => $_[1]}, $_[0] }
    sub level    { $_[0]->{level} = $_[1] if @_ == 2; return $_[0]->{level} }
    sub read     { $_[0]->{level} }
    sub identity { $_[0] }
}

my $meter = LeanBridge::Workshop::with_hosts({Box => 'App::Meter'}, sub {
    my $m = LeanBridge::Workshop::make(18);
    LeanBridge::Workshop::update($m, 42);
    return LeanBridge::Workshop::identity($m);
});
print $meter->read, "\n";  # 42
