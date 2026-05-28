"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  ROOM_CODE_LENGTH,
  isValidRoomCode,
  normaliseRoomCode,
} from "@/lib/roomCode";

export default function JoinRoomForm(): React.JSX.Element {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, ROOM_CODE_LENGTH);
      setCode(val);
      setError(null);
    },
    [],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      // Re-derive from state inside callback — avoids stale closure on isValid.
      const trimmed = code.trim();
      if (!isValidRoomCode(trimmed)) {
        setError(
          `Room code must be exactly ${ROOM_CODE_LENGTH} letters or numbers.`,
        );
        return;
      }
      if (isSubmitting) return; // guard double-submit
      setIsSubmitting(true);
      const normalised = normaliseRoomCode(trimmed);
      router.push(`/game-waiting?gameCode=${encodeURIComponent(normalised)}`);
    },
    [code, isSubmitting, router],
  );

  const isValid = isValidRoomCode(code);

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="space-y-2">
        <Label
          htmlFor="room-code"
          className="text-[var(--tycoon-accent)] font-orbitron font-bold"
        >
          Room Code
        </Label>
        <Input
          id="room-code"
          type="text"
          value={code}
          onChange={handleChange}
          placeholder="e.g. TYCOON"
          maxLength={ROOM_CODE_LENGTH}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-describedby={error !== null ? "room-code-error" : undefined}
          aria-invalid={error !== null}
          className="bg-[var(--tycoon-bg)] border-[var(--tycoon-border)] text-[var(--tycoon-text)] placeholder:text-[var(--tycoon-text)]/40 focus-visible:ring-[var(--tycoon-accent)] font-orbitron tracking-widest uppercase"
        />
        {error !== null && (
          <p id="room-code-error" role="alert" className="text-red-400 text-sm">
            {error}
          </p>
        )}
      </div>
      <Button
        type="submit"
        disabled={!isValid || isSubmitting}
        aria-disabled={!isValid || isSubmitting}
        className="w-full bg-[var(--tycoon-accent)] text-[var(--tycoon-bg)] font-orbitron font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? "Joining..." : "Join"}
      </Button>
    </form>
  );
}
