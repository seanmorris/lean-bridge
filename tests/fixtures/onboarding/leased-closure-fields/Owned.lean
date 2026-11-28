namespace Owned

structure Ticket where
  serial : UInt32
  label : String

structure Tariff where
  quote : UInt32 → UInt32

def newTicket (serial : UInt32) : Ticket := ⟨serial, "ticket"⟩
def makeTariff (base : UInt32) : Tariff := ⟨fun units => base + units⟩
def echoTariff (value : Tariff) : Tariff := value
def applyTariff (value : Tariff) (units : UInt32) : UInt32 := value.quote units
def unpackQuote (value : Tariff) : UInt32 → UInt32 := value.quote
def packQuote (quote : UInt32 → UInt32) : Tariff := ⟨quote⟩

-- Construct the input here so no outside result owner keeps its function alive.
def exchangeTariff (revise : Tariff → Tariff) (base units : UInt32) : UInt32 :=
  (revise (makeTariff base)).quote units

-- Identical Lean types and bodies; the export contract selects the host call boundary.
def stagedQuote (choose : UInt32 → UInt32 → UInt32) (base units : UInt32) : UInt32 := choose base units
def flatQuote (choose : UInt32 → UInt32 → UInt32) (base units : UInt32) : UInt32 := choose base units

end Owned
