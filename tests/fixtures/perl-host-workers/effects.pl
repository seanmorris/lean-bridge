use v5.36;
use LeanBridge::Workshop;

my $path = 'state';
sub read_state () { open my $fh, '<', $path or die $!; local $/; return <$fh>; }
sub save ($s) { open my $fh, '>', $path or die $!; print {$fh} $s; }

{ package App::Box;
  sub new ($class,$v) { bless {v=>$v},$class }
  sub read ($self) { $self->{v} }
  sub level ($self,@v) { $self->{v}=$v[0] if @v; $self->{v} }
  sub identity ($self) { $self }
}
LeanBridge::Workshop::with_hosts({Box=>'App::Box'},sub {
    die 'wrong host class' unless LeanBridge::Workshop::read(App::Box->new(41)) == 41;
    die 'initializer did not read the deployment environment' unless LeanBridge::Workshop::read_boot() eq 'from-app';
    local $ENV{LEAN_BRIDGE_EFFECT_BOOT} = 'after-init';
    die 'initializer was rerun for a call' unless LeanBridge::Workshop::read_boot() eq 'from-app';
    save('open');
    die 'ordinary IO became asynchronous' unless LeanBridge::Workshop::observe($path) == 37;
    my $task = LeanBridge::Workshop::worker($path);
    die 'worker did not return a real Future' unless $task->isa('Future') && $task->get == 37;
    my $cursor = LeanBridge::Workshop::walk($path);
    die 'open ran the close action' unless read_state() eq 'open';
    die 'first pull missed live file contents' unless $cursor->next->get == 37;
    save('changed');
    die 'next pull reused the first result' unless $cursor->next->get == 0 && read_state() eq 'changed';
    $cursor->close;
    die 'early exit did not run the Lean finalizer' unless read_state() eq 'closed';
    save('after-close');
    my @no_more = $cursor->next->get;
    $cursor->close;
    undef $cursor;
    die 'closed cursor ran a second finalizer or another pull' if @no_more || read_state() ne 'after-close';
    print "startup, sync IO, worker, independent pulls and exactly one effective close passed\n";
});
