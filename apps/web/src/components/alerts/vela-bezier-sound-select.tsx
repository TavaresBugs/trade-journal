"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { AlertSoundName } from "@/lib/alerts/types";
import { alertAudioEngine } from "@/lib/alerts/alert-audio-engine";
import { VelaBezierDropdownShell } from "./vela-bezier-dropdown-shell";

export interface VelaBezierSoundSelectProps {
  value: AlertSoundName;
  onChange: (value: AlertSoundName) => void;
  disabled?: boolean;
  className?: string;
}

interface SoundItem {
  id: AlertSoundName;
  label: string;
}

interface SoundCategory {
  id: string;
  label: string;
  sounds: SoundItem[];
}

const SOUND_CATEGORIES: SoundCategory[] = [
  {
    id: "classic",
    label: "Classic",
    sounds: [
      { id: "fired", label: "Thin" },
      { id: "3_notes_reverb", label: "3 Notes Reverb" },
      { id: "alarm_clock", label: "Alarm Clock" },
      { id: "beep_beep", label: "Beep-beep" },
      { id: "call", label: "Calling" },
      { id: "chirpy", label: "Chirpy" },
      { id: "fault", label: "Fault" },
      { id: "hand_bell", label: "Hand Bell" },
    ],
  },
  {
    id: "soft",
    label: "Soft",
    sounds: [
      { id: "banjo", label: "Banjo" },
      { id: "droplet", label: "Droplet" },
      { id: "flickering", label: "Flickering" },
      { id: "hoarse", label: "Hoarse" },
      { id: "knock_knock", label: "Knock-knock" },
      { id: "promise", label: "Promise" },
      { id: "trumpets", label: "Trumpets" },
      { id: "you_win", label: "You win" },
    ],
  },
  {
    id: "nature",
    label: "Nature",
    sounds: [
      { id: "bullfrog", label: "Bullfrog" },
      { id: "cat", label: "Cat" },
      { id: "dog", label: "Dog" },
      { id: "raven", label: "Raven" },
      { id: "rooster", label: "Rooster" },
      { id: "thunder", label: "Thunder" },
      { id: "water_drop", label: "Water drop" },
      { id: "whale", label: "Whale" },
    ],
  },
  {
    id: "voices",
    label: "Voices",
    sounds: [
      { id: "attention", label: "Attention" },
      { id: "guess_what", label: "Guess what" },
      { id: "hey_pssst", label: "Hey, pssst" },
      { id: "hey_take_a_look", label: "Hey, take a look" },
      { id: "hey", label: "Hey!" },
      { id: "look_at_me", label: "Look at me" },
      { id: "sexy_mmm", label: "Sexy mmm" },
      { id: "oh", label: "Oh!" },
    ],
  },
  {
    id: "funny",
    label: "Funny",
    sounds: [
      { id: "applause", label: "Applause" },
      { id: "breaking_glass", label: "Breaking glass" },
      { id: "cash_register", label: "Cash register" },
      { id: "chimes_power_down", label: "Chimes power down" },
      { id: "dramatic_one_note", label: "Dramatic one note" },
      { id: "jackpot", label: "Jackpot" },
      { id: "man_laughing", label: "Man laughing" },
      { id: "martian_gun", label: "Martian gun" },
    ],
  },
];

const ALL_SOUNDS: SoundItem[] = SOUND_CATEGORIES.flatMap((c) => c.sounds);

export function VelaBezierSoundSelect({
  value,
  onChange,
  disabled = false,
  className = "",
}: VelaBezierSoundSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [previewId, setPreviewId] = useState<AlertSoundName | null>(null);

  // Initialize category expanded state (keep the category containing value open by default)
  const initialCategoryOpenState = useMemo(() => {
    const state: Record<string, boolean> = {
      classic: true,
      soft: true,
      nature: false,
      voices: false,
      funny: false,
    };
    for (const cat of SOUND_CATEGORIES) {
      if (cat.sounds.some((s) => s.id === value)) {
        state[cat.id] = true;
      }
    }
    return state;
  }, [value]);

  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(
    initialCategoryOpenState,
  );

  // When value changes from outside, ensure its category is expanded
  useEffect(() => {
    for (const cat of SOUND_CATEGORIES) {
      if (cat.sounds.some((s) => s.id === value)) {
        setOpenCategories((prev) => ({ ...prev, [cat.id]: true }));
      }
    }
  }, [value]);

  const toggleCategory = (catId: string) => {
    setOpenCategories((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  };

  const triggerRef = useRef<HTMLButtonElement>(null);

  const selectedSound =
    ALL_SOUNDS.find((s) => s.id === value) ?? ALL_SOUNDS[0]!;

  const handlePlayPreview = (e: React.MouseEvent, soundId: AlertSoundName) => {
    e.stopPropagation();

    if (previewId === soundId) {
      alertAudioEngine.stop("preview");
      setPreviewId(null);
    } else {
      setPreviewId(soundId);
      alertAudioEngine.stop("preview");
      void alertAudioEngine
        .play(soundId, { loopId: "preview" })
        .finally(() => {
          setTimeout(() => setPreviewId(null), 1200);
        });
    }
  };

  const renderSoundRow = (snd: SoundItem) => {
    const isSelected = snd.id === value;
    const isPlaying = previewId === snd.id;

    return (
      <div
        key={snd.id}
        onClick={() => {
          onChange(snd.id);
          setIsOpen(false);
        }}
        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-[6px] text-[13px] transition-colors cursor-pointer group ${
          isSelected
            ? "bg-[#252830] text-white font-medium"
            : "text-[var(--vela-fg-bright,#f0f3fa)] hover:bg-[var(--vela-hover,rgba(255,255,255,0.06))]"
        }`}
      >
        <span className="truncate">{snd.label}</span>

        {/* Audition Play Button (▶ / ⏹) */}
        <button
          type="button"
          onClick={(e) => handlePlayPreview(e, snd.id)}
          className={`p-1 rounded-full transition-colors ${
            isPlaying
              ? "text-[#2962ff]"
              : isSelected
              ? "text-white/80 hover:text-white"
              : "text-[var(--vela-fg-muted,#787b86)] hover:text-white"
          }`}
          title={isPlaying ? "Stop" : `Listen to ${snd.label}`}
        >
          {isPlaying ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 18 18"
              width="18"
              height="18"
            >
              <path
                fill="currentColor"
                d="M2 9a7 7 0 1 1 14 0A7 7 0 0 1 2 9Zm7-8a8 8 0 1 0 0 16A8 8 0 0 0 9 1ZM6 6h6v6H6V6Z"
              />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 18 18"
              width="18"
              height="18"
            >
              <path
                fill="currentColor"
                d="M2 9a7 7 0 1 1 14 0A7 7 0 0 1 2 9Zm7-8a8 8 0 1 0 0 16A8 8 0 0 0 9 1ZM7.79 5.09A.5.5 0 0 0 7 5.5v7a.5.5 0 0 0 .79.41l5-3.5a.5.5 0 0 0 0-.82l-5-3.5ZM11.63 9 8 11.54V6.46L11.63 9Z"
              />
            </svg>
          )}
        </button>
      </div>
    );
  };

  return (
    <div className={`relative w-full ${className}`}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-expanded={isOpen}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full h-[32px] px-2.5 flex items-center justify-between gap-2 border transition-all text-[12px] cursor-pointer ${
          disabled
            ? "opacity-40 cursor-not-allowed bg-transparent border-[var(--vela-border,#2a2e39)]"
            : isOpen
            ? "bg-[#151619] border-[var(--vela-border,#2a2e39)] border-b-transparent rounded-t-[6px] rounded-b-none text-white z-50 relative"
            : "bg-[var(--vela-bg,#131722)] border-[var(--vela-border,#2a2e39)] hover:border-[#4a4b52] hover:bg-[rgba(255,255,255,0.03)] rounded-[6px] text-[var(--vela-fg-bright,#f0f3fa)]"
        }`}
      >
        <span className="truncate">{selectedSound.label}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 18 18"
          width="14"
          height="14"
          className={`text-[var(--vela-fg-muted,#787b86)] shrink-0 transition-transform duration-150 ${
            isOpen ? "rotate-180" : ""
          }`}
        >
          <path
            fill="currentColor"
            d="M3.92 7.83 9 12.29l5.08-4.46-1-1.13L9 10.29l-4.09-3.6-.99 1.14Z"
          />
        </svg>
      </button>

      {/* Floating Popup with Natural Bézier Join */}
      <VelaBezierDropdownShell
        isOpen={isOpen}
        onClose={() => {
          alertAudioEngine.stop("preview");
          setPreviewId(null);
          setIsOpen(false);
        }}
        triggerRef={triggerRef}
        minWidth={220}
        maxHeight={320}
        backgroundColor="#151619"
        borderColor="#2a2e39"
      >
        <div className="flex flex-col space-y-1">
          {SOUND_CATEGORIES.map((cat, idx) => {
            const isCatOpen = !!openCategories[cat.id];
            return (
              <div
                key={cat.id}
                className={
                  idx > 0
                    ? "pt-1 border-t border-[var(--vela-border,#2a2e39)]/60"
                    : ""
                }
              >
                <button
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold tracking-wider text-[var(--vela-fg-muted,#787b86)] hover:text-white uppercase transition-colors rounded hover:bg-[var(--vela-hover,rgba(255,255,255,0.04))]"
                >
                  <span>{cat.label}</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 18 18"
                    width="14"
                    height="14"
                    className={`transition-transform duration-150 ${
                      isCatOpen ? "rotate-180" : ""
                    }`}
                  >
                    <path
                      fill="currentColor"
                      d="m14.078 7.827-.99-1.128L9 10.29 4.911 6.7l-.99 1.128L9 12.285z"
                    />
                  </svg>
                </button>

                {isCatOpen && (
                  <div className="space-y-0.5 mt-0.5">
                    {cat.sounds.map(renderSoundRow)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </VelaBezierDropdownShell>
    </div>
  );
}
