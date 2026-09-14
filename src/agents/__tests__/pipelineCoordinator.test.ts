import type { NextRequest } from "next/server";
import { PipelineCoordinator } from "@/agents/pipelineCoordinator";
import { CreditService } from "@/lib/referral-system";
import { createSession, resetStore, updateSession, getSession, appendError } from "@/lib/agentic/sessionStore";

const createMockRequest = () => ({}) as unknown as NextRequest;

describe("PipelineCoordinator", () => {
  beforeEach(() => {
    resetStore();
  });

  it("runs agents sequentially and returns completed session", async () => {
    const session = createSession({
      userId: "user-1",
      prompt: "Trip",
      preferences: { interests: ["food"], durationDays: 2 },
    });

    const concierge = {
      initialize: jest.fn(async () => ({
        authSession: { user: { id: "user-1" } },
        creditBalance: undefined,
        requestBody: { prompt: "Trip" },
        requestSession: session,
      })),
      markInProgress: jest.fn(() => updateSession(session.id, { status: "in_progress" })),
      failSession: jest.fn(),
      markCompleted: jest.fn(() => updateSession(session.id, { status: "completed" })),
    };

    const contextScout = {
      execute: jest.fn(async () =>
        updateSession(session.id, {
          context: {
            weather: {
              description: "sunny",
              temperatureC: 24,
              raw: {},
            },
          },
        })
      ),
    };

    const retrievalStrategist = {
      execute: jest.fn(async () =>
        updateSession(session.id, {
          retrieval: {
            candidates: [{ title: "A", score: 1 }],
            expandedQueries: [],
            coverageScore: 1,
          },
        })
      ),
    };

    const itineraryComposer = {
      execute: jest.fn(async () =>
        updateSession(session.id, {
          itinerary: { json: { title: "Done" } },
          status: "completed",
        })
      ),
    };

    const coordinator = new PipelineCoordinator({
      concierge: concierge as any,
      contextScout: contextScout as any,
      retrievalStrategist: retrievalStrategist as any,
      itineraryComposer: itineraryComposer as any,
      creditService: { consumeCredits: jest.fn().mockResolvedValue({}) } as any,
    });

    const result = await coordinator.handleRequest(createMockRequest());

    expect(concierge.initialize).toHaveBeenCalled();
    expect(contextScout.execute).toHaveBeenCalled();
    expect(retrievalStrategist.execute).toHaveBeenCalled();
    expect(itineraryComposer.execute).toHaveBeenCalled();
    expect(result.status).toBe("completed");
    expect(result.itinerary?.json).toEqual({ title: "Done" });
  });

  it("invokes failSession when downstream agent throws", async () => {
    const session = createSession({
      userId: "user-2",
      prompt: "Trip",
      preferences: { interests: [], durationDays: null },
    });

    const concierge = {
      initialize: jest.fn(async () => ({
        authSession: { user: { id: "user-2" } },
        creditBalance: undefined,
        requestBody: { prompt: "Trip" },
        requestSession: session,
      })),
      markInProgress: jest.fn(() => updateSession(session.id, { status: "in_progress" })),
      failSession: jest.fn(),
    };

    const contextScout = {
      execute: jest.fn(async () => updateSession(session.id, { context: {} })),
    };

    const retrievalStrategist = {
      execute: jest.fn(async () => {
        throw new Error("retrieval failed");
      }),
    };

    const itineraryComposer = {
      execute: jest.fn(),
    };

    const coordinator = new PipelineCoordinator({
      concierge: concierge as any,
      contextScout: contextScout as any,
      retrievalStrategist: retrievalStrategist as any,
      itineraryComposer: itineraryComposer as any,
      creditService: { consumeCredits: jest.fn().mockResolvedValue({}) } as any,
    });

    await expect(coordinator.handleRequest(createMockRequest())).rejects.toThrow("retrieval failed");

    expect(concierge.failSession).toHaveBeenCalled();
  });

  it("still refunds and preserves the original error when session bookkeeping misses", async () => {
    // The session below is fabricated, never stored: resetStore() ran and
    // createSession was never called. failSession delegates to the real
    // appendError (sessionStore imports nothing heavy), so a throwing
    // bookkeeping call must not mask the refund or replace the original
    // downstream error.
    const fabricated = {
      id: "00000000-0000-0000-0000-000000000099",
      userId: "user-9",
      prompt: "Trip",
      preferences: { interests: [], durationDays: null },
    };
    const refundSpy = jest.spyOn(CreditService, "refundCredits").mockResolvedValue(undefined);
    try {
      const coordinator = new PipelineCoordinator({
        concierge: {
          initialize: jest.fn(async () => ({
            authSession: { user: { id: "user-9" } },
            creditBalance: undefined,
            requestBody: { prompt: "Trip" },
            requestSession: fabricated,
          })),
          markInProgress: jest.fn(() => fabricated),
          failSession: jest.fn((sessionId: string, message: string, detail?: unknown) =>
            appendError(sessionId, {
              agent: "concierge",
              stage: "fatal",
              message,
              detail,
              timestamp: Date.now(),
            })
          ),
        } as any,
        contextScout: { execute: jest.fn(async () => fabricated) } as any,
        retrievalStrategist: {
          execute: jest.fn(async () => {
            throw new Error("retrieval failed");
          }),
        } as any,
        itineraryComposer: { execute: jest.fn() } as any,
        creditService: { consumeCredits: jest.fn().mockResolvedValue({}) } as any,
      });

      await expect(coordinator.handleRequest(createMockRequest())).rejects.toThrow("retrieval failed");
      expect(refundSpy).toHaveBeenCalledTimes(1);
    } finally {
      refundSpy.mockRestore();
    }
  });
});
