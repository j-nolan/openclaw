import { afterEach, expect, it, vi } from "vitest";
/* @vitest-environment jsdom */
import type { SessionParticipant } from "../../../packages/gateway-protocol/src/schema/session-participant.js";
import { listAssignableSessionOwners, type SessionCreatedActor } from "./session-owner-chip.ts";

type OwnerChipElement = HTMLElement & {
  owner: SessionCreatedActor | null;
  participants: readonly SessionParticipant[];
  participantCount: number;
  attribution: "created" | "owned" | "archived";
  size: "row" | "header";
  updateComplete: Promise<boolean>;
};

afterEach(() => {
  document.body.replaceChildren();
});

async function mount(params: { participants?: SessionParticipant[]; participantCount?: number }) {
  // SAFETY: the imported module registers this custom element with these reactive properties.
  const chip = document.createElement("openclaw-session-owner-chip") as OwnerChipElement;
  chip.owner = { type: "human", id: "profile-ada", label: "Ada" };
  chip.attribution = "owned";
  chip.size = "row";
  chip.participants = params.participants ?? [];
  chip.participantCount = params.participantCount ?? chip.participants.length;
  document.body.append(chip);
  await vi.waitFor(async () => {
    await chip.updateComplete;
    expect(chip.querySelector(".session-owner-chip")).not.toBeNull();
  });
  return chip;
}

it("keeps the single owner chip unchanged without participants", async () => {
  const chip = await mount({});
  expect(chip.querySelector(".session-owner-stack")).toBeNull();
  expect(chip.querySelectorAll(".session-owner-chip")).toHaveLength(1);
  expect(chip.querySelector(".session-owner-chip")?.getAttribute("aria-label")).toBe(
    "Owned by Ada",
  );
});

it("renders one participant behind the owner with combined accessibility", async () => {
  const chip = await mount({
    participants: [{ identity: { type: "agent", id: "research" }, label: "Research" }],
    participantCount: 1,
  });
  expect(chip.querySelector(".session-owner-stack__back .viewer-avatar")).not.toBeNull();
  expect(chip.querySelector(".session-owner-stack__front")).not.toBeNull();
  expect(chip.querySelector(".session-owner-stack")?.getAttribute("aria-label")).toBe(
    "Owned by Ada · with Research",
  );
});

it("renders the total participant count in the back slot for three identities", async () => {
  const chip = await mount({
    participants: [
      { identity: { type: "profile", id: "profile-bob" }, label: "Bob" },
      { identity: { type: "agent", id: "research" }, label: "Research" },
    ],
    participantCount: 2,
  });
  expect(chip.querySelector(".session-owner-stack__overflow")?.textContent).toBe("+2");
  expect(chip.querySelector(".session-owner-stack")?.getAttribute("aria-label")).toBe(
    "Owned by Ada · +2 more",
  );
});

it("treats a present owner facet as authoritative before adding self and configured agents", () => {
  const facet = [
    { type: "human" as const, id: "profile:channel:opaque", label: "Opaque Person" },
    { type: "agent" as const, id: "facet-agent", label: "Facet Agent" },
  ];

  expect(
    listAssignableSessionOwners({
      facet,
      agents: [{ id: "configured-agent", name: "Configured Agent" }],
      self: { id: "profile-self", name: "Self" },
    }),
  ).toEqual([
    {
      type: "agent",
      id: "configured-agent",
      identity: { type: "agent", id: "configured-agent" },
      label: "Configured Agent",
    },
    { type: "agent", id: "facet-agent", label: "Facet Agent" },
    { type: "human", id: "profile:channel:opaque", label: "Opaque Person" },
    {
      type: "human",
      id: "profile-self",
      identity: { type: "profile", id: "profile-self" },
      label: "Self",
    },
  ]);
});

it("does not reconstruct assignment candidates when the owner facet is absent", () => {
  expect(
    listAssignableSessionOwners({
      facet: undefined,
    }),
  ).toEqual([]);
});
