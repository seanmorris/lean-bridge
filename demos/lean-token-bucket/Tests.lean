import TokenBucket

open LeanTokenBucket

#guard (request ⟨10, 2⟩ ⟨10, 0⟩ 0 7).state = ⟨3, 0⟩
#guard (request ⟨10, 2⟩ ⟨3, 0⟩ 1 6).status = 1
#guard (request ⟨10, 2⟩ ⟨3, 0⟩ 1 6).retryAfter = some 1
#guard (request ⟨10, 2⟩ ⟨3, 0⟩ 2 6).state = ⟨1, 2⟩
#guard (request ⟨10, 2⟩ ⟨3, 10⟩ 9 0).state = ⟨3, 10⟩
#guard (request ⟨10, 2⟩ ⟨3, 10⟩ 9 0).status = 2
#guard (request ⟨0, 0⟩ ⟨0, 0⟩ 0 0).status = 0
#guard (request ⟨0, 0⟩ ⟨0, 0⟩ 0 1).retryAfter = none
#guard (request ⟨10, 0⟩ ⟨3, 0⟩ 100 4).retryAfter = none
#guard (request ⟨10, 2⟩ ⟨3, 0⟩ 100 11).retryAfter = none
#guard (request ⟨10, 2⟩ ⟨3, 0⟩ 100 10).state = ⟨0, 100⟩
#guard (request ⟨10, 2147483647⟩ ⟨3, 0⟩ 2147483647 10).state = ⟨0, 2147483647⟩
#guard refill 10 3 2 3 = 9
#guard refill 10 3 2 4 = 10
#guard refill 10 12 2 0 = 10
#guard refill 10 3 (2 ^ 128) (2 ^ 128) = 10
#guard (request ⟨10, 3⟩ ⟨0, 0⟩ 0 10).retryAfter = some 4
#guard (request ⟨10, 3⟩ ⟨0, 0⟩ 3 10).status = 1
#guard (request ⟨10, 3⟩ ⟨0, 0⟩ 4 10).status = 0
#guard (exportedRun (exportedEmpty 10 2 0) #[0, 7, 1, 6, 2, 6]).output =
  #[0, 3, 0, 10, 0, 1, 0, 1, 5, 1, 5, 2, 1, 1, 0, 1, 2, 7, 2, 1, 0]

#print axioms refill_eq
#print axioms request_valid
#print axioms admitted_iff
#print axioms request_conservation
#print axioms trace_no_over_admission
#print axioms trace_interval_bound
#print axioms retryDelay_earliest
#print axioms request_retry_earliest
#print axioms exportedStep_admitted_iff
#print axioms runCredits_eq
#print axioms exportedRun_valid
#print axioms exportedRun_wire
#print axioms exportedRun_no_over_admission
#print axioms exportedRun_word_bounds
