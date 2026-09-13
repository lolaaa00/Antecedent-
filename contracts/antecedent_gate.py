# v0.2.18
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
Antecedent Gate — downstream executable-eligibility gate.

Consumes a final certificate produced by AntecedentNotary and records whether
a consequential action (e.g. "migration execution notice may be published")
is eligible. This contract performs NO semantic/AI evaluation of its own —
it is a pure, deterministic consumer of an already-finalized certificate.
That separation is the composability boundary: any number of downstream
products can gate real actions on the same notary certificates without
re-running consensus.
"""

from dataclasses import dataclass

from genlayer import *


@gl.contract_interface
class IAntecedentNotary:
    def get_certificate(self, certificate_id: str) -> Any: ...


GATE_STATUS_ARMED = "ARMED"
GATE_STATUS_EXECUTED = "EXECUTED"

CERT_VALID = "VALID"


@dataclass
class GateRule:
    gate_id: str
    notary_address: Address
    expected_pair_hash: str
    required_relation: str
    min_separation_seconds: u64
    max_certificate_age_seconds: u64
    status: str
    creator: Address
    created_at: u64


@dataclass
class ExecutionReceipt:
    gate_id: str
    certificate_id: str
    executed_at: u64
    executor: Address
    receipt_hash: str


class AntecedentGate(gl.Contract):
    gates: TreeMap[str, GateRule]
    receipts: TreeMap[str, ExecutionReceipt]
    executed_certificate_ids: TreeMap[str, bool]
    gate_ids: DynArray[str]

    def __init__(self):
        self.gates = TreeMap()
        self.receipts = TreeMap()
        self.executed_certificate_ids = TreeMap()
        self.gate_ids = DynArray()

    def _now(self) -> u64:
        return u64(gl.vm.get_current_transaction_time())

    @gl.public.write
    def create_gate(
        self,
        gate_id: str,
        notary_address: str,
        expected_pair_hash: str,
        required_relation: str,
        min_separation_seconds: int,
        max_certificate_age_seconds: int,
    ) -> None:
        if gate_id in self.gates:
            raise Exception("gate_id already exists")
        if len(expected_pair_hash) == 0:
            raise Exception("expected_pair_hash required")
        if required_relation not in ("BEFORE", "AFTER", "SAME_DAY", "SUPERSEDES"):
            raise Exception("invalid required_relation")
        if min_separation_seconds < 0 or max_certificate_age_seconds < 0:
            raise Exception("bounds must be non-negative")

        self.gates[gate_id] = GateRule(
            gate_id=gate_id,
            notary_address=Address(notary_address),
            expected_pair_hash=expected_pair_hash,
            required_relation=required_relation,
            min_separation_seconds=u64(min_separation_seconds),
            max_certificate_age_seconds=u64(max_certificate_age_seconds),
            status=GATE_STATUS_ARMED,
            creator=gl.message.sender_address,
            created_at=self._now(),
        )
        self.gate_ids.append(gate_id)

    @gl.public.write
    def execute_with_certificate(self, gate_id: str, certificate_id: str) -> None:
        gate = self.gates.get(gate_id)
        if gate is None:
            raise Exception("unknown gate_id")
        if gate.status == GATE_STATUS_EXECUTED:
            raise Exception("gate already executed")

        if certificate_id in self.executed_certificate_ids:
            raise Exception("certificate already consumed by a gate execution")

        notary = gl.ContractAt(gate.notary_address).contract(IAntecedentNotary)
        certificate = notary.view().get_certificate(certificate_id)

        if certificate.status != CERT_VALID:
            raise Exception("certificate is not VALID")

        pair_hash = certificate.pair_hash
        relation = certificate.final_relation
        separation = certificate.separation_seconds
        finalized_ts = certificate.finalized_timestamp

        if pair_hash != gate.expected_pair_hash:
            raise Exception("certificate pair_hash does not match gate rule")
        if relation != gate.required_relation:
            raise Exception("certificate relation does not match gate rule")
        if gate.min_separation_seconds > 0 and int(separation) < int(gate.min_separation_seconds):
            raise Exception("certificate separation below gate minimum")

        now = self._now()
        if gate.max_certificate_age_seconds > 0:
            age = int(now) - int(finalized_ts)
            if age > int(gate.max_certificate_age_seconds):
                raise Exception("certificate exceeds gate max age — stale certificate")

        receipt_hash = self._receipt_hash(gate_id, certificate_id, str(now))

        self.receipts[gate_id] = ExecutionReceipt(
            gate_id=gate_id,
            certificate_id=certificate_id,
            executed_at=now,
            executor=gl.message.sender_address,
            receipt_hash=receipt_hash,
        )
        self.executed_certificate_ids[certificate_id] = True
        gate.status = GATE_STATUS_EXECUTED

    def _receipt_hash(self, gate_id: str, certificate_id: str, now: str) -> str:
        import hashlib
        h = hashlib.sha256()
        for p in (gate_id, certificate_id, now):
            h.update(p.encode("utf-8"))
            h.update(b"\x00")
        return h.hexdigest()

    @gl.public.view
    def get_gate(self, gate_id: str) -> GateRule:
        g = self.gates.get(gate_id)
        if g is None:
            raise Exception("unknown gate_id")
        return g

    @gl.public.view
    def get_receipt(self, gate_id: str) -> ExecutionReceipt:
        r = self.receipts.get(gate_id)
        if r is None:
            raise Exception("no receipt for gate_id")
        return r

    @gl.public.view
    def list_gate_ids(self) -> list[str]:
        return [g for g in self.gate_ids]
