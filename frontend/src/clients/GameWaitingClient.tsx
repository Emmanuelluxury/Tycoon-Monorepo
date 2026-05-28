"use client";

import React, { useState, useEffect } from "react";
import GameWaiting from "@/components/game/GameWaiting";
import { Spinner } from "@/components/ui/spinner";

/**
 * Client wrapper for the game waiting page.
 *
 * Handles the initial loading phase and a registration check.
 * Both are mocked for the demo; replace with real auth/API calls when ready.
 */
export default function GameWaitingClient(): React.JSX.Element {
  const [loading, setLoading] = useState(true);
  // TODO: replace with real auth check (e.g. useSession / wallet connection)
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);

  useEffect(() => {
    // Simulate async registration check
    const timer = setTimeout(() => {
      setIsRegistered(true); // mock: always registered
      setLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  if (loading || isRegistered === null) {
    return (
      <main className="w-full min-h-screen flex items-center justify-center bg-[#010F10] overflow-x-hidden">
        <div className="flex flex-col items-center gap-6">
          <Spinner size="lg" />
          <div className="text-center space-y-2">
            <h1 className="text-[#00F0FF] text-2xl font-black font-orbitron tracking-[0.3em] animate-pulse">
              ENTERING LOBBY...
            </h1>
            <p className="text-[#869298] text-xs font-bold tracking-widest uppercase">
              Verifying credentials...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!isRegistered) {
    return (
      <main className="w-full min-h-screen flex items-center justify-center bg-[#010F10] overflow-x-hidden">
        <p className="text-[#00F0FF] font-orbitron text-center px-4">
          Please register to join the game.
        </p>
      </main>
    );
  }

  return (
    <main className="w-full min-h-screen overflow-x-hidden bg-[#010F10]">
      <GameWaiting />
    </main>
  );
}
