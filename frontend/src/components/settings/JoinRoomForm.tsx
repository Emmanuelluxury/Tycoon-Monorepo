"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_REGEX = /^[A-Za-z0-9]+$/;
const ERROR_ID = "room-code-error";

/**
 * Returns true only when the trimmed value is exactly ROOM_CODE_LENGTH
 * alphanumeric characters.
 */
export function isValidRoomCode(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length === ROOM_CODE_LENGTH && ROOM_CODE_REGEX.test(trimmed);
}

export default function JoinRoomForm(): React.JSX.Element {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // Normalise to uppercase and cap at max length immediately
    const val = e.target.value.toUpperCase().slice(0, ROOM_CODE_LENGTH);
    setCode(val);
    setError(null);
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      // Re-derive validity at submit time to avoid stale-closure issues
      const normalised = code.trim().toUpperCase();
      if (!isValidRoomCode(normalised)) {
        setError(
          `Room code must be exactly ${ROOM_CODE_LENGTH} letters or numbers.`,
        );
        return;
      }
      router.push(`/game-waiting?gameCode=${encodeURIComponent(normalised)}`);
    },
    [code, router],
  );

  const hasError = error !== null;

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
          aria-required="true"
          aria-invalid={hasError}
          aria-describedby={hasError ? ERROR_ID : undefined}
          className="bg-[var(--tycoon-bg)] border-[var(--tycoon-border)] text-[var(--tycoon-text)] placeholder:text-[var(--tycoon-text)]/40 focus-visible:ring-[var(--tycoon-accent)] font-orbitron tracking-widest uppercase"
        />
        {hasError && (
          <p id={ERROR_ID} role="alert" className="text-red-400 text-sm">
            {error}
          </p>
        )}
      </div>
      <Button
        type="submit"
        disabled={!isValidRoomCode(code)}
        className="w-full bg-[var(--tycoon-accent)] text-[var(--tycoon-bg)] font-orbitron font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Join
      </Button>
    </form>
  );
}
