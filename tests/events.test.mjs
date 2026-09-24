import assert from "node:assert/strict";
import test from "node:test";
import { xdr, nativeToScVal } from "@stellar/stellar-sdk";

import { decodeEvent } from "../dist/stellar/decode.js";

const VALID_ACCOUNT = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

function mockEvent({
  source = "market",
  contractId = "CCONTRACTID",
  ledger = 100,
  txHash = "0xhash",
  ledgerClosedAt = "2026-01-01T00:00:00Z",
  id = "100-1",
  topic = [],
  value = nativeToScVal(null),
} = {}) {
  return {
    source,
    eventResponse: {
      contractId,
      ledger,
      txHash,
      ledgerClosedAt,
      id,
      topic,
      value,
    },
  };
}

test("decodes valid claim_created market event", () => {
  const topics = [
    xdr.ScVal.scvSymbol("claim_created"),
    nativeToScVal(123), // claimId
    nativeToScVal(VALID_ACCOUNT), // creator strkey
  ];
  const value = nativeToScVal({ category: "crypto" });

  const { eventResponse } = mockEvent({ topic: topics, value });
  const decoded = decodeEvent("market", eventResponse);

  assert.equal(decoded.source, "market");
  assert.equal(decoded.ledger, 100);
  assert.equal(decoded.payload.name, "claim_created");
  if (decoded.payload.name === "claim_created") {
    assert.equal(decoded.payload.claimId, 123);
    assert.equal(decoded.payload.creator, VALID_ACCOUNT);
    assert.equal(decoded.payload.category, "crypto");
  }
});

test("decodes valid market_created squad event", () => {
  const topics = [
    xdr.ScVal.scvSymbol("market_created"),
    nativeToScVal(456), // marketId
    nativeToScVal(VALID_ACCOUNT), // captain strkey
  ];
  const value = nativeToScVal({
    deadline: 1700000000,
    fee_bps: 100,
    question: "Will Soroban launch?",
  });

  const { eventResponse } = mockEvent({ source: "squad", topic: topics, value });
  const decoded = decodeEvent("squad", eventResponse);

  assert.equal(decoded.source, "squad");
  assert.equal(decoded.payload.name, "market_created");
  if (decoded.payload.name === "market_created") {
    assert.equal(decoded.payload.marketId, 456);
    assert.equal(decoded.payload.captain, VALID_ACCOUNT);
    assert.equal(decoded.payload.deadline, 1700000000);
    assert.equal(decoded.payload.feeBps, 100);
    assert.equal(decoded.payload.question, "Will Soroban launch?");
  }
});

test("handles unknown event name gracefully without throwing", () => {
  const topics = [xdr.ScVal.scvSymbol("unknown_admin_event")];
  const value = nativeToScVal({});

  const { eventResponse } = mockEvent({ topic: topics, value });
  const decoded = decodeEvent("market", eventResponse);

  assert.equal(decoded.payload.name, "unknown");
  if (decoded.payload.name === "unknown") {
    assert.equal(decoded.payload.eventName, "unknown_admin_event");
    assert.equal(decoded.payload.reason, "no decoder");
  }
});

test("handles malformed topic/value types without crashing", () => {
  // Topic missing required claimId (index 1)
  const topics = [xdr.ScVal.scvSymbol("claim_created")];
  const value = nativeToScVal({});

  const { eventResponse } = mockEvent({ topic: topics, value });
  const decoded = decodeEvent("market", eventResponse);

  assert.equal(decoded.payload.name, "unknown");
  if (decoded.payload.name === "unknown") {
    assert.equal(decoded.payload.eventName, "claim_created");
    assert.match(decoded.payload.reason, /missing topic\[1\]/);
  }
});

test("handles invalid address strkey gracefully", () => {
  const topics = [
    xdr.ScVal.scvSymbol("claim_created"),
    nativeToScVal(123),
    nativeToScVal("INVALID_ADDRESS"),
  ];
  const value = nativeToScVal({ category: "crypto" });

  const { eventResponse } = mockEvent({ topic: topics, value });
  const decoded = decodeEvent("market", eventResponse);

  assert.equal(decoded.payload.name, "unknown");
  if (decoded.payload.name === "unknown") {
    assert.equal(decoded.payload.eventName, "claim_created");
    assert.match(decoded.payload.reason, /expected a Stellar address strkey/);
  }
});

test("batch decoding containing malformed event does not fail whole batch", () => {
  const validTopic = [
    xdr.ScVal.scvSymbol("claim_created"),
    nativeToScVal(1),
    nativeToScVal(VALID_ACCOUNT),
  ];
  const validValue = nativeToScVal({ category: "crypto" });

  const invalidTopic = [xdr.ScVal.scvSymbol("claim_created")]; // missing topic[1]

  const rawEvents = [
    mockEvent({ id: "100-1", topic: validTopic, value: validValue }).eventResponse,
    mockEvent({ id: "100-2", topic: invalidTopic, value: validValue }).eventResponse,
    mockEvent({ id: "100-3", topic: validTopic, value: validValue }).eventResponse,
  ];

  const decodedBatch = rawEvents.map((e) => decodeEvent("market", e));

  assert.equal(decodedBatch.length, 3);
  assert.equal(decodedBatch[0].payload.name, "claim_created");
  assert.equal(decodedBatch[1].payload.name, "unknown");
  assert.equal(decodedBatch[2].payload.name, "claim_created");
});
