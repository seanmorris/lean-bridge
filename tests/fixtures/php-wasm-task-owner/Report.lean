prelude
import Init.System.Promise

namespace Report

def caughtMessage (s : String) (f : String → IO String) : BaseIO (Task (Except IO.Error String)) :=
  IO.asTask do
    try f s catch e =>
      match e with
      | .userError message => pure message
      | other => throw other

end Report
