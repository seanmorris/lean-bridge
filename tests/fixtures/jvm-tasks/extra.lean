
namespace Timers
def owner : IO String := IO.FS.readFile "/proc/thread-self/stat"
def finalIO (fail : Bool) : IO (Task (Except IO.Error String)) := BaseIO.asTask do
  if fail then return .error (IO.userError "terminal failure")
  return .ok "done"
def octets (b : ByteArray) : Task ByteArray := Task.pure b
end Timers
