import pytest

NOTARY_ADDR = "0x1111111111111111111111111111111111111111"
GATE_ADDR = "0x2222222222222222222222222222222222222222"
HTTPS_A = "https://example.org/notice-a"
HTTPS_B = "https://example.org/notice-b"


def _build_valid_certificate(notary, stub, relation="BEFORE"):
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

    notary.create_pair("p1", "a", "b", relation, 0, 0, "policy", False)
    notary.finalize_certificate("cert1", "p1")
    return notary.get_pair("p1"), notary.get_certificate("cert1")


def _wire(notary, gate, stub):
    stub.ContractAt.register(NOTARY_ADDR, notary)
    stub.ContractAt.register(GATE_ADDR, gate)


def test_publish_succeeds_once_gate_executed(notary, gate, make_consumer, stub):
    pair, cert = _build_valid_certificate(notary, stub)
    _wire(notary, gate, stub)
    gate.create_gate("g1", NOTARY_ADDR, pair.pair_hash, "BEFORE", 0, 0)
    gate.execute_with_certificate("g1", "cert1")

    consumer = make_consumer(GATE_ADDR)
    consumer.publish_execution_notice("g1", "cert1", "Migration Execution v3 is authorized.")

    assert consumer.is_published("g1") is True
    notice = consumer.get_notice("g1")
    assert notice.certificate_id == "cert1"
    assert notice.notice == "Migration Execution v3 is authorized."


def test_publish_rejects_gate_still_armed(notary, gate, make_consumer, stub):
    pair, cert = _build_valid_certificate(notary, stub)
    _wire(notary, gate, stub)
    gate.create_gate("g1", NOTARY_ADDR, pair.pair_hash, "BEFORE", 0, 0)
    # never executed

    consumer = make_consumer(GATE_ADDR)
    with pytest.raises(Exception):
        consumer.publish_execution_notice("g1", "cert1", "should not be allowed")
    assert consumer.is_published("g1") is False


def test_publish_rejects_gate_armed_after_invalid_relation_execution_attempt(notary, gate, make_consumer, stub):
    """The negative path through the CONSUMER, not just the gate: an
    invalid-relation certificate cannot get the gate to EXECUTED, so the
    consumer's protected action must also be unreachable."""
    pair, cert = _build_valid_certificate(notary, stub, relation="AFTER")
    _wire(notary, gate, stub)
    gate.create_gate("g1", NOTARY_ADDR, pair.pair_hash, "AFTER", 0, 0)

    with pytest.raises(Exception):
        gate.execute_with_certificate("g1", "cert1")

    consumer = make_consumer(GATE_ADDR)
    with pytest.raises(Exception):
        consumer.publish_execution_notice("g1", "cert1", "should not be allowed")


def test_publish_rejects_certificate_id_mismatch(notary, gate, make_consumer, stub):
    pair, cert = _build_valid_certificate(notary, stub)
    _wire(notary, gate, stub)
    gate.create_gate("g1", NOTARY_ADDR, pair.pair_hash, "BEFORE", 0, 0)
    gate.execute_with_certificate("g1", "cert1")

    consumer = make_consumer(GATE_ADDR)
    with pytest.raises(Exception):
        consumer.publish_execution_notice("g1", "some-other-certificate-id", "mismatched")


def test_publish_rejects_replay(notary, gate, make_consumer, stub):
    pair, cert = _build_valid_certificate(notary, stub)
    _wire(notary, gate, stub)
    gate.create_gate("g1", NOTARY_ADDR, pair.pair_hash, "BEFORE", 0, 0)
    gate.execute_with_certificate("g1", "cert1")

    consumer = make_consumer(GATE_ADDR)
    consumer.publish_execution_notice("g1", "cert1", "first publish")
    with pytest.raises(Exception):
        consumer.publish_execution_notice("g1", "cert1", "second publish should not be allowed")


def test_publish_rejects_stale_certificate(notary, gate, make_consumer, stub):
    pair, cert = _build_valid_certificate(notary, stub)
    _wire(notary, gate, stub)
    gate.create_gate("g1", NOTARY_ADDR, pair.pair_hash, "BEFORE", 0, 100)
    stub.CURRENT_TIME["value"] += 10_000

    with pytest.raises(Exception):
        gate.execute_with_certificate("g1", "cert1")

    consumer = make_consumer(GATE_ADDR)
    with pytest.raises(Exception):
        consumer.publish_execution_notice("g1", "cert1", "should not be allowed — stale")


def test_publish_rejects_inconclusive_certificate(notary, gate, make_consumer, stub):
    notary.create_event("a", "A", "criterion long enough for the check", [HTTPS_A], "policy")
    notary.seal_event("a")
    notary.create_event("b", "B", "criterion long enough for the check", [HTTPS_B], "policy")
    notary.seal_event("b")

    stub.WEB_FIXTURES[HTTPS_A] = "published 2024-01-01T00:00:00Z"
    resp_a = '{"occurrence": "CONFIRMED", "effective_time": "2024-01-01T00:00:00+00:00", "time_basis": "EXPLICIT_SOURCE_TIME", "source_support": [{"source_id": 1, "stance": "SUPPORTS", "excerpt": "x"}], "reason": "ok"}'
    stub.PROMPT_QUEUE.extend([resp_a, resp_a])
    notary.observe_event("a")

    stub.WEB_FIXTURES[HTTPS_B] = "unrelated"
    resp_b = '{"occurrence": "NOT_CONFIRMED", "effective_time": "UNKNOWN", "time_basis": "UNKNOWN", "source_support": [{"source_id": 1, "stance": "UNCLEAR", "excerpt": "x"}], "reason": "no"}'
    stub.PROMPT_QUEUE.extend([resp_b, resp_b])
    notary.observe_event("b")

    notary.create_pair("p1", "a", "b", "BEFORE", 0, 0, "policy", False)
    notary.finalize_certificate("cert1", "p1")
    cert = notary.get_certificate("cert1")
    assert cert.status == "INCONCLUSIVE"

    _wire(notary, gate, stub)
    gate.create_gate("g1", NOTARY_ADDR, "p1", "BEFORE", 0, 0)
    with pytest.raises(Exception):
        gate.execute_with_certificate("g1", "cert1")

    consumer = make_consumer(GATE_ADDR)
    with pytest.raises(Exception):
        consumer.publish_execution_notice("g1", "cert1", "should not be allowed — inconclusive")


def test_publish_rejects_invalid_notice_length(notary, gate, make_consumer, stub):
    pair, cert = _build_valid_certificate(notary, stub)
    _wire(notary, gate, stub)
    gate.create_gate("g1", NOTARY_ADDR, pair.pair_hash, "BEFORE", 0, 0)
    gate.execute_with_certificate("g1", "cert1")

    consumer = make_consumer(GATE_ADDR)
    with pytest.raises(Exception):
        consumer.publish_execution_notice("g1", "cert1", "")
