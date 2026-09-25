def callNestedAlias (seed : Payload) (callback : Array (Option Alias) → Array (Option Alias)) : String :=
  (callback #[some seed, none, some seed]).foldl
    (fun result item => result ++ (item.map (·.text)).getD "<none>") ""

def makeNestedAlias (seed : Alias) : Array (Option Alias) → Array (Option Alias) :=
  fun _ => #[some seed, none, some seed]

def callNestedPlain (seed : Payload) (callback : Array (Option Payload) → Array (Option Payload)) : String :=
  (callback #[some seed, none, some seed]).foldl
    (fun result item => result ++ (item.map (·.text)).getD "<none>") ""

def makeNestedPlain (seed : Payload) : Array (Option Payload) → Array (Option Payload) :=
  fun _ => #[some seed, none, some seed]
