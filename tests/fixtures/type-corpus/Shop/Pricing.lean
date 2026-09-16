import Catalog

namespace Shop.Pricing

structure Basket where
  label : String
  units : Nat
  credit : Int
  batches : Array (Array UInt32)
  active : Bool

def quoteUnits (units : UInt32) : UInt32 := Catalog.quote units + 1
def basketTotal (price : Nat) (quantity : UInt32) : Nat := price * quantity.toNat
def refund (balance amount : Int) : Int := balance - amount
def receiptLabel (heading suffix : String) : String := heading ++ "/" ++ suffix
def restock (values : Array UInt32) (amount : UInt32) : Array UInt32 :=
  values.map (· + amount)
def regroup (values : Array (Array UInt32)) : Array (Array UInt32) := values.reverse
def revise (basket : Basket) : Basket :=
  { basket with units := basket.units + 1, credit := basket.credit - 1
                batches := basket.batches.reverse, active := !basket.active }
def nextSerial (serial : UInt64) : UInt64 := serial + 1
def previousBalance (balance : Int64) : Int64 := balance - 1
def enabled (flag : Bool) : Bool := !flag
def keepMarker (marker : Unit) : Unit := marker
def reverseBlob (bytes : ByteArray) : ByteArray := ⟨bytes.data.reverse⟩

theorem basketTotal_zero (price : Nat) : basketTotal price 0 = 0 := by
  simp [basketTotal]
theorem revise_label (basket : Basket) : (revise basket).label = basket.label := rfl
theorem regroup_twice (values : Array (Array UInt32)) :
    regroup (regroup values) = values := by simp [regroup]

end Shop.Pricing
