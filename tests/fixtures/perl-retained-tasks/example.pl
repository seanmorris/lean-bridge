use v5.36;
use LeanBridge::Retained;

my $task = LeanBridge::Retained::repeat_call('go', sub ($s) { $s . '!' });
say $task->get;  # go!!
