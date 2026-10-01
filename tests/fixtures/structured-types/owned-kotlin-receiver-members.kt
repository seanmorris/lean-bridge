    private fun receiverMembers() {
        newTicket(java.math.BigInteger.valueOf(42), "receiver").use { receiver ->
            newTicket(java.math.BigInteger.valueOf(99), "other").use { other ->
                receiver.share().use { shared ->
                    receiver.retain().use { independent ->
                        receiver.retainTicket().use { borrowed ->
                            receiver.chooseTicket(other).use { selected ->
                                verify(receiver.serial == java.math.BigInteger.valueOf(42), "Kotlin read-only receiver property")
                                verify(receiver.get().serial == java.math.BigInteger.valueOf(42), "Kotlin raw receiver property")
                                verify(receiver.label == "receiver", "Kotlin second property")
                                verify(selected.serial == java.math.BigInteger.valueOf(99), "Kotlin other argument selection")
                                val erased: Value<Ticket> = receiver
                                erased.share().use { verify(it is org.leanbridge.owned_aggregates.kotlin.TicketValue, "Kotlin covariant share") }
                                erased.retain().use { verify(it is org.leanbridge.owned_aggregates.kotlin.TicketValue, "Kotlin covariant retain") }
                                receiver.close()
                                verify(shared.serial == java.math.BigInteger.valueOf(42), "Kotlin shared guard preserves owner")
                                shared.close()
                                OwnedBorrowProbe.status(4) { borrowed.serial }
                                verify(independent.serial == java.math.BigInteger.valueOf(42), "Kotlin retained member survives release")
                                verify(selected.serial == java.math.BigInteger.valueOf(99), "Kotlin result uses other argument owner")
                                other.close()
                                OwnedBorrowProbe.status(4) { selected.serial }
                            }
                        }
                    }
                }
            }
        }
        org.leanbridge.owned_aggregates.kotlin.Api.newTicket(BigInteger.valueOf(42), "aggregates").use { kept ->
            for (raw in listOf(false, true)) {
                org.leanbridge.owned_aggregates.kotlin.Api.newTicket(BigInteger.valueOf(81), "parameter").use { source ->
                    (if (raw) kept.get().chooseTicket(source) else kept.chooseTicket(source)).use { selected ->
                        verify(selected.serial == BigInteger.valueOf(81), "Kotlin raw and whole argument-anchored members")
                        source.close(); verify(selected.isClosed && kept.serial == BigInteger.valueOf(42), "Kotlin parameter lifetime")
                    }
                }
            }
            org.leanbridge.owned_aggregates.kotlin.Api.copyEchoRecordResult(bundle(kept.get())).use { record ->
                record.primary.use { primary ->
                    record.echoRecord().use { echoed ->
                        record.callbackRecord { incoming -> incoming }.use { callback ->
                            record.makeRecord().use { closure ->
                                closure.get().invoke(false, bundle(kept.get())).use { reply ->
                                    reply.primary.use { replyPrimary ->
                                        verify(primary.serial == BigInteger.valueOf(42) && record.get().primary.serial == BigInteger.valueOf(42), "Kotlin property versus record field")
                                        verify(record.payload.count == BigInteger.valueOf(-17), "Kotlin copied record property")
                                        record.close()
                                        verify(primary.isClosed && echoed.isClosed && callback.isClosed && closure.isClosed, "Kotlin member descendants expire")
                                        verify(!reply.isClosed && replyPrimary.serial == BigInteger.valueOf(42), "Kotlin typed independent closure reply")
                                    }
                                }
                            }
                        }
                    }
                }
            }
            for (branch: Choice in arrayOf(ChoiceEmpty(), ChoiceMany(emptyArray()), ChoiceOne(kept.get()))) {
                org.leanbridge.owned_aggregates.kotlin.Api.copyEchoVariantResult(branch).use { choice ->
                    choice.echoVariant().use { view ->
                        verify(view.get() == branch, "Kotlin variant methods")
                        choice.close(); verify(view.isClosed, "Kotlin variant member expiration")
                    }
                }
            }
            for (branch: Tree in arrayOf(TreeBranch(emptyArray()), TreeLeaf(kept.get()))) {
                org.leanbridge.owned_aggregates.kotlin.Api.copyEchoRecursiveResult(branch).use { tree ->
                    tree.echoRecursive().use { view ->
                        tree.callbackRecursive { it }.use { callback ->
                            tree.makeRecursive().use { closure ->
                                closure.get().invoke(false, branch).use { reply ->
                                    verify(reply.get() == branch && callback.get() == branch, "Kotlin recursive methods")
                                    tree.close(); verify(view.isClosed && callback.isClosed && closure.isClosed, "Kotlin recursive member expiration")
                                    verify(!reply.isClosed, "Kotlin recursive closure result owner")
                                }
                            }
                        }
                    }
                }
            }
            org.leanbridge.owned_aggregates.kotlin.Api.copyEchoRecordResult(bundle(kept.get())).use { record ->
                record.share().use { alias ->
                    record.echoRecord().use { view ->
                        var escaped: Ticket? = null
                        record.moveRecord { incoming ->
                            verify(record.isClosed && alias.isClosed && view.isClosed, "Kotlin member handoff before callback")
                            escaped = incoming.primary
                            verify(escaped!!.serial == BigInteger.valueOf(42), "Kotlin raw callback member")
                            incoming
                        }.use { moved ->
                            moved.primary.use { primary ->
                                verify(primary.serial == BigInteger.valueOf(42), "Kotlin consuming aggregate owner")
                                OwnedBorrowProbe.status(4) { escaped!!.serial }; escaped!!.close()
                            }
                        }
                    }
                }
            }
        }
        newTicket(java.math.BigInteger.ONE, "consuming").use { original ->
            original.share().use { alias ->
                original.retain().use { independent ->
                    original.transferTicket().use { result ->
                        verify(original.isClosed && alias.isClosed, "Kotlin member consumes original owner")
                        verify(result.serial == java.math.BigInteger.ONE, "Kotlin typed consuming result")
                        verify(independent.serial == java.math.BigInteger.ONE, "Kotlin retain survives consumption")
                    }
                }
            }
        }
    }
