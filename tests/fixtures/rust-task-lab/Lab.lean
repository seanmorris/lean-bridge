import Depot
import Pulse
import Wide
import Retained

namespace Lab
def bytes := Pulse.bytes
def checked := Pulse.checked
def ioTask := Pulse.ioTask
def gated := Pulse.late
def reset := Pulse.reset
def release := Pulse.release
def phase := Pulse.state
def pulls := Pulse.pulls
def closes := Pulse.closes
def series := Pulse.series
def pull := Pulse.next
def close := Pulse.close

def sum := Wide.sum
def wideChecked := Wide.checked
def wideSeries := Wide.series
def widePull := Wide.next
def wideClose := Wide.close

def make := Depot.make
def badge := Depot.badge
def add := Depot.add
def count := Depot.count
def alias := Depot.alias
def pending := Depot.pending
def leaseChecked := Depot.checked
def tickets := Depot.tickets
def ticketPull := Depot.next
def ticketClose := Depot.close
def depotReset := Depot.reset
def depotRelease := Depot.release
def depotPhase := Depot.state
def cbRepeatCall := Retained.repeatCall
def cbDuringStart := Retained.duringStart
def cbRecover := Retained.recover
def cbReplaceError := Retained.replaceError
def cbTypedStart := Retained.typedStart
def cbPlain := Retained.plain
def cbTerminal := Retained.terminal
def cbRemember := Retained.remember
def cbUseExpired := Retained.useExpired
def cbForget := Retained.forget
def cbReset := Retained.reset
def cbRelease := Retained.release
def cbState := Retained.state
def cbCancelLate := Retained.cancelLate
def cbQueued := Retained.queued
def cbScalarTour := Retained.scalarTour
def localStart (reject : Bool) : IO (Task (Except IO.Error UInt32)) := do
  if reject then throw (IO.userError "early IO")
  pure (Task.pure (.ok 18))
end Lab
