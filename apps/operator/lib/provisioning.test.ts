import { describe, it, expect } from "vitest";
import { provisioningState, soldButNotProvisioned, type ProvisioningFacts } from "./provisioning.js";

const base: ProvisioningFacts = {
  entitlements: { channelManager: false, reservation: false, pms: false },
  hasChannexCredential: false,
  channelsWithExternalProperty: 0,
  channelsConnected: 0,
  channelsLive: 0,
  isDemo: false,
};

const facts = (o: Partial<ProvisioningFacts>): ProvisioningFacts => ({ ...base, ...o });

describe("the six combinations that need nothing from us", () => {
  const noCm = [
    { name: "CRS only", e: { channelManager: false, reservation: true, pms: false } },
    { name: "PMS only", e: { channelManager: false, reservation: false, pms: true } },
    { name: "CRS + PMS", e: { channelManager: false, reservation: true, pms: true } },
  ];
  for (const c of noCm) {
    it(`${c.name} is ready immediately — the shared database IS the integration`, () => {
      const s = provisioningState(facts({ entitlements: c.e }));
      expect(s.ready).toBe(true);
      expect(s.steps).toEqual([]);
      // Silence is the correct permanent answer here, not "not checked yet".
      expect(s.headline).toBeNull();
    });
  }
});

describe("the one combination that does — anything with RevioLink", () => {
  const withCm = [
    { name: "Link only", e: { channelManager: true, reservation: false, pms: false } },
    { name: "Link + CRS", e: { channelManager: true, reservation: true, pms: false } },
    { name: "Link + PMS", e: { channelManager: true, reservation: false, pms: true } },
    { name: "all three", e: { channelManager: true, reservation: true, pms: true } },
  ];
  for (const c of withCm) {
    it(`${c.name} needs provisioning, and the other products do not change what`, () => {
      const s = provisioningState(facts({ entitlements: c.e }));
      expect(s.ready).toBe(false);
      expect(s.steps.map((x) => x.key)).toEqual([
        "channex_credential",
        "channex_property",
        "channel_connected",
      ]);
    });
  }
});

describe("the failure this module exists for", () => {
  const crsThenLink = facts({
    // A CRS client whose hotel setup is 100% complete, who has just bought RevioLink.
    entitlements: { channelManager: true, reservation: true, pms: false },
    hasChannexCredential: false,
    channelsWithExternalProperty: 0,
  });

  it("catches a product sold and switched on with nothing behind it", () => {
    const alarm = soldButNotProvisioned(crsThenLink);
    expect(alarm).toMatch(/nothing they do in it will reach an OTA/);
  });

  it("is silent once the Channex property exists", () => {
    expect(soldButNotProvisioned(facts({ ...crsThenLink, channelsWithExternalProperty: 1 }))).toBeNull();
  });

  it("is silent for a client who never bought RevioLink", () => {
    expect(soldButNotProvisioned(facts({ entitlements: { channelManager: false, reservation: true, pms: true } }))).toBeNull();
  });
});

describe("progression through the steps", () => {
  const cm = { channelManager: true, reservation: false, pms: false };

  it("drops the credential step once stored", () => {
    const s = provisioningState(facts({ entitlements: cm, hasChannexCredential: true }));
    expect(s.steps.map((x) => x.key)).toEqual(["channex_property", "channel_connected"]);
  });

  it("connecting a channel is only BLOCKING once the property exists", () => {
    // Before the property there is a prior blocker, so this one is not the thing to do next.
    const early = provisioningState(facts({ entitlements: cm }));
    expect(early.steps.find((x) => x.key === "channel_connected")?.severity).toBe("soon");

    const ready = provisioningState(facts({ entitlements: cm, hasChannexCredential: true, channelsWithExternalProperty: 1 }));
    expect(ready.steps.find((x) => x.key === "channel_connected")?.severity).toBe("blocking");
  });

  it("distinguishes connected from live — the distinction Channex bills on", () => {
    const s = provisioningState(
      facts({ entitlements: cm, hasChannexCredential: true, channelsWithExternalProperty: 1, channelsConnected: 1, channelsLive: 0 }),
    );
    expect(s.steps.map((x) => x.key)).toEqual(["channel_activated"]);
    expect(s.steps[0]!.why).toMatch(/Channex starts billing/);
  });

  it("is ready once a channel is live", () => {
    const s = provisioningState(
      facts({ entitlements: cm, hasChannexCredential: true, channelsWithExternalProperty: 1, channelsConnected: 1, channelsLive: 1 }),
    );
    expect(s.ready).toBe(true);
    expect(s.headline).toBeNull();
  });

  it("the headline leads with a blocker, never with a lesser step", () => {
    const s = provisioningState(facts({ entitlements: cm }));
    expect(s.headline).toBe("Store this hotel's Channex credential");
  });
});

describe("demo tenants", () => {
  it("are never chased — they are provisioned by hand on the sandbox on purpose", () => {
    const s = provisioningState(facts({ entitlements: { channelManager: true, reservation: true, pms: true }, isDemo: true }));
    expect(s.ready).toBe(true);
    expect(s.steps).toEqual([]);
    expect(soldButNotProvisioned(facts({ entitlements: { channelManager: true, reservation: false, pms: false }, isDemo: true }))).toBeNull();
  });
});
