use v5.36;
use strict;
use warnings;
use Test::More;
if ($ARGV[0] eq 'journal-first') { require LeanBridge::Journal; require LeanBridge::Companion; }
else { require LeanBridge::Companion; require LeanBridge::Journal; }
is(LeanBridge::Journal::bump(5),5,'primary state');
is(LeanBridge::Companion::bump(9),9,'independent component state');
is(LeanBridge::Journal::count(),5,'secondary does not overwrite primary');
is(LeanBridge::Companion::count(),9,'secondary state persists');
my $ok=eval { LeanBridge::Companion::choose(!!1,!!0,'peer'); 1 }; my $error=$@;
ok(!$ok,'peer declared failure'); isa_ok($error,'LeanBridge::Companion::Error::choose');
isa_ok($error->payload,'LeanBridge::Companion::Err'); is($error->payload->value,37,'peer failure payload');
my $snapshot=LeanBridge::Runtime::_snapshot();
is($snapshot->{runtime_init_runs},1,'both packages use one runtime');
is_deeply([@{$snapshot}{qw(live_wrappers live_identities live_callbacks live_scopes)}],[0,0,0,0],'both packages drained');
done_testing;
