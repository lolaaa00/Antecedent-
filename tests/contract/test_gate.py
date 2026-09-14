import pytest

NOTARY_ADDR = "0x1111111111111111111111111111111111111111"
HTTPS_A = "https://example.org/notice-a"
HTTPS_B = "https://example.org/notice-b"


def _build_valid_certificate(notary, stub, relation="BEFORE", min_sep=0):
    notary.create_event("a", "A", "criterion long enough for the check", [HTTPS_A], "policy")
    notary.seal_event("a")
    notary.create_event("b", "B", "criterion long enough for the check", [HTTPS_B], "policy")
    notary.seal_event("b")

    stub.WEB_FIXTURES[HTTPS_A] = "published 2024-01-01T00:00:00Z"
    resp_a = '{"occurrence": "CONFIRMED", "effective_time": "2024-01-01T00:00:00+00:00", "time_basis": "EXPLICIT_SOURCE_TIME", "source_support": [{"source_id": 1, "stance": "SUPPORTS", "excerpt": "x"}], "reason": "ok"}'
    stub.PROMPT_QUEUE.extend([resp_a, resp_a])
    notary.observe_event("a")

    stub.WEB_FIXTURES[HTTPS_B] = "published 2024-06-01T00:00:00Z"
    resp_b = '{"occurrence": "CONFIRMED", "effective_time": "2024-06-01T00:00:00+00:00", "time_basis": "EXPLICIT_SOURCE_TIME", "source_support": [{"source_id": 1, "stance": "SUPPORTS", "excerpt": "x"}], "reason": "ok"}'
    stub.PROMPT_QUEUE.extend([resp_b, resp_b])
    notary.observe_event("b")

    notary.create_pair("p1", "a", "b", relation, min_sep, 0, "policy", False)
    notary.finalize_certificate("cert1", "p1")
    return notary.get_pair("p1"), notary.get_certificate("cert1")


def _wire(notary, stub):
    stub.ContractAt.register(NOTARY_ADDR, notary)


def test_valid_execution_receipt(notary, gate, stub):
    pair, cert = _build_valid_certificate(notary, stub)
    _wire(notary, stub)
    gate.create_gate("g1", NOTARY_ADDR, pair.pair_hash, "BEFORE", 0, 0)
    gate.execute_with_certificate("g1", "cert1")

    receipt = gate.get_receipt("g1")
    assert receipt.certificate_id == "cert1"
    g = gate.get_gate("g1")
    assert g.status == "EXECUTED"


def test_wrong_pair_hash_rejected(notary, gate, stub):
    pair, cert = _build_valid_certificate(notary, stub)
    _wire(notary, stub)
    gate.create_gate("g1", NOTARY_ADDR, "not-the-real-pair-hash", "BEFORE", 0, 0)
    with pytest.raises(Exception):
        gate.execute_with_certificate("g1", "cert1")


def test_invalid_relation_rejected(notary, gate, stub):
    pair, cert = _build_valid_certificate(notary, stub, relation="AFTER")
    _wire(notary, stub)
    # cert will be INVALID_RELATION because A actually precedes B while AFTER was required
    gate.create_gate("g1", NOTARY_ADDR, pair.pair_hash, "AFTER", 0, 0)
    with pytest.raises(Exception):
        gate.execute_with_certificate("g1", "cert1")


def test_replay_rejected(notary, gate, stub):
    pair, cert = _build_valid_certificate(notary, stub)
    _wire(notary, stub)
    gate.create_gate("g1", NOTARY_ADDR, pair.pair_hash, "BEFORE", 0, 0)
    gate.execute_with_certificate("g1", "cert1")
    with pytest.raises(Exception):
        gate.execute_with_certificate("g1", "cert1")


def test_second_gate_cannot_reuse_same_certificate(notary, gate, stub):
    pair, cert = _build_valid_certificate(notary, stub)
    _wire(notary, stub)
    gate.create_gate("g1", NOTARY_ADDR, pair.pair_hash, "BEFORE", 0, 0)
    gate.create_gate("g2", NOTARY_ADDR, pair.pair_hash, "BEFORE", 0, 0)
    gate.execute_with_certificate("g1", "cert1")
    with pytest.raises(Exception):
        gate.execute_with_certificate("g2", "cert1")


def test_stale_certificate_rejected_by_max_age(notary, gate, stub):
    pair, cert = _build_valid_certificate(notary, stub)
    _wire(notary, stub)
    stub.CURRENT_TIME["value"] += 10_000
    gate.create_gate("g1", NOTARY_ADDR, pair.pair_hash, "BEFORE", 0, 100)
    with pytest.raises(Exception):
        gate.execute_with_certificate("g1", "cert1")


def test_minimum_separation_enforced_at_gate(notary, gate, stub):
    pair, cert = _build_valid_certificate(notary, stub, min_sep=0)
    _wire(notary, stub)
    # certificate separation is ~5 months; gate demands more than that
    gate.create_gate("g1", NOTARY_ADDR, pair.pair_hash, "BEFORE", 999_999_999, 0)
    with pytest.raises(Exception):
        gate.execute_with_certificate("g1", "cert1")
