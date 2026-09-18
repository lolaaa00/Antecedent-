# v0.2.18
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
MigrationExecutionConsumer — the real downstream state transition that
AntecedentNotary + AntecedentGate exist to protect.

AntecedentGate on its own only *records* that a certificate was accepted —
that is a necessary but not sufficient demonstration of the trust model this
product sells. This contract is the concrete consequential action from the
build directive's canonical demo: it is the "migration execution notice"
that may be canonically published only once a specific Gate has reached
EXECUTED against a matching, VALID, fresh certificate. It performs zero
semantic evaluation of its own; it inherits every guarantee already enforced
by the Gate (VALID status, pair-hash match, relation match, minimum
separation, freshness, one-time-per-certificate) purely by requiring
`gate.status == EXECUTED`, and adds its own independent replay guard so a
gate_id can drive this action at most once even if this contract were ever
pointed at more permissive gate logic.
"""

from dataclasses import dataclass

from genlayer import *


@gl.contract_interface
class IAntecedentGate:
    def get_gate(self, gate_id: str) -> Any: ...
    def get_receipt(self, gate_id: str) -> Any: ...


GATE_STATUS_EXECUTED = "EXECUTED"
MAX_NOTICE_LEN = 2000


@allow_storage
@dataclass
class PublishedNotice:
    gate_id: str
    certificate_id: str
    notice: str
    published_at: u64
    publisher: Address


class MigrationExecutionConsumer(gl.Contract):
    gate_address: Address
    notices: TreeMap[str, PublishedNotice]
    published_gate_ids: DynArray[str]

    def __init__(self, gate_address: str):
        self.gate_address = Address(gate_address)

    def _now(self) -> u64:
        return u64(gl.vm.get_current_transaction_time())

    @gl.public.write
    def publish_execution_notice(self, gate_id: str, certificate_id: str, notice: str) -> None:
        if gate_id in self.notices:
            raise Exception("gate_id already consumed — replay rejected")
        if len(notice) == 0 or len(notice) > MAX_NOTICE_LEN:
            raise Exception("invalid notice length")

        gate_contract = gl.ContractAt(self.gate_address).contract(IAntecedentGate)
        gate = gate_contract.view().get_gate(gate_id)
        if gate.status != GATE_STATUS_EXECUTED:
            raise Exception("gate has not reached EXECUTED with a valid certificate")

        receipt = gate_contract.view().get_receipt(gate_id)
        if receipt.certificate_id != certificate_id:
            raise Exception("certificate_id does not match this gate's execution receipt")

        self.notices[gate_id] = PublishedNotice(
            gate_id=gate_id,
            certificate_id=certificate_id,
            notice=notice,
            published_at=self._now(),
            publisher=gl.message.sender_address,
        )
        self.published_gate_ids.append(gate_id)

    @gl.public.view
    def get_notice(self, gate_id: str) -> PublishedNotice:
        n = self.notices.get(gate_id)
        if n is None:
            raise Exception("no notice published for gate_id")
        return n

    @gl.public.view
    def is_published(self, gate_id: str) -> bool:
        return gate_id in self.notices

    @gl.public.view
    def list_published_gate_ids(self) -> list[str]:
        return [g for g in self.published_gate_ids]
