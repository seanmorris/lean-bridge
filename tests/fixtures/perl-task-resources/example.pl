use v5.36;
use LeanBridge::Depot;

my $ticket = LeanBridge::Depot::make(42, 'delivery');
my $item = LeanBridge::Depot::checked(!!0, $ticket)->get;
$ticket->close;
say LeanBridge::Depot::count($item);  # 42
$item->close;
