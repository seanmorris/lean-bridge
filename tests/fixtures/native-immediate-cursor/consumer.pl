use v5.36;
use LeanBridge::Dials;
use Scalar::Util qw(weaken);
use Config;

sub check ($ok) { die "failed at line " . (caller)[2] . "\n" unless $ok }
my $mode = shift;
my $ns = 'LeanBridge::Dials';
check(LeanBridge::Dials::counts() == 0);
check(!exists $INC{'Future.pm'} && !exists $INC{'IO/Async/Loop.pm'});
if ($mode eq 'shutdown') {
    our $keep = LeanBridge::Dials::sequence(3);
    my ($first) = $keep->next; check($first == 0);
} elsif ($mode eq 'fork') {
    my $it = LeanBridge::Dials::sequence(3);
    my ($first) = $it->next; check($first == 0);
    my $pid = fork(); die $! unless defined $pid;
    if (!$pid) {
        my $ok = eval { my @item = $it->next; 1 };
        exit($ok || $@ !~ /initiating process|foreign/ ? 1 : 0);
    }
    waitpid($pid, 0); check($? == 0);
    open my $marker, '<', 'state' or die $!; check(<$marker> eq 'open'); close $marker;
    my ($second) = $it->next; check($second == 1);
    $it->close; check(LeanBridge::Dials::counts() == 10201);
} elsif ($mode eq 'iterate') {
    my $seq = LeanBridge::Dials::sequence(2);
    check(LeanBridge::Dials::counts() == 10000);
    my $ambiguous = eval { my $v = $seq->next; 1 };
    check(!$ambiguous && $@ =~ /list context/ && LeanBridge::Dials::counts() == 10000);
    my @seen; while (my ($item) = $seq->next) { push @seen, $item }
    check("@seen" eq "0 1" && LeanBridge::Dials::counts() == 10301);
    check(!(() = $seq->next)); $seq->close;
    my $fault = eval { LeanBridge::Dials::checked(0); 1 } ? undef : $@;
    check($fault->isa("${ns}::EIOError") && $fault->payload eq 'factory' && $fault->declaration eq 'Dials.checked');
    my $checked = LeanBridge::Dials::checked(1); my ($zero) = $checked->next; check($zero == 0);
    $fault = eval { my @bad = $checked->next; 1 } ? undef : $@;
    check($fault->isa("${ns}::StepError::checked") && $fault->payload eq 'step' && $fault->declaration eq 'Dials.checkedNext');
    my $units = LeanBridge::Dials::units(1); my @unit = $units->next;
    check(@unit == 1 && !defined $unit[0]);
    $fault = eval { my @bad = $units->next; 1 } ? undef : $@;
    check($fault->isa("${ns}::IOError") && $fault->message eq 'unit step' && $fault->declaration eq 'Dials.nextUnit');
    check(LeanBridge::Dials::counts() == 30703);
    my $early = LeanBridge::Dials::sequence(4);
    my $forged = bless \my $opaque, ref $early;
    check(!eval { my @items = $forged->next; 1 } && $@ =~ /Invalid or mismatched/);
    if ($Config{useithreads}) {
        require threads;
        my $thread = threads->create(sub {
            my $ok = eval { my @items = $early->next; 1 };
            return !$ok;
        });
        check($thread->join);
    }
    while (my ($n) = $early->next) { check($n == 0); last }
    $early->close; $early->close; check(LeanBridge::Dials::counts() == 40804);
    my $weak;
    { my $dropped = LeanBridge::Dials::units(4); my @v = $dropped->next; check(@v == 1);
      $weak = $dropped; weaken($weak); }
    check(!defined $weak && LeanBridge::Dials::counts() == 50905);
    my $caller = bless {}, 'Application::EarlyExit';
    eval {
        my $scoped = LeanBridge::Dials::sequence(2);
        while (my ($n) = $scoped->next) { die $caller }
    };
    check(ref($@) && Scalar::Util::refaddr($@) == Scalar::Util::refaddr($caller));
    check(LeanBridge::Dials::counts() == 61006);
    my $original = LeanBridge::Dials::issue(83);
    my $walk = LeanBridge::Dials::tickets($original); my ($ticket) = $walk->next;
    check($ticket->same_resource($original)); $original->close;
    $fault = eval { my @bad = $walk->next; 1 } ? undef : $@;
    check($fault->isa("${ns}::StepError::tickets") && $fault->declaration eq 'TicketPulls.nextTicket');
    my $payload = $fault->payload; check($payload->same_resource($ticket));
    $walk->close; $ticket->close; check(LeanBridge::Dials::read_ticket($payload) == 83);
    $payload->close; check(LeanBridge::Dials::closed_tickets() == 1);
    my $snap = LeanBridge::Runtime::_snapshot();
    check(!grep { $_ != 0 } @{$snap}{qw(live_identities live_wrappers live_callbacks live_scopes)});
} else { die "unknown mode"; }
say "$mode passed";
