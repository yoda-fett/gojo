#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def w(rel: str, content: str) -> None:
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)
    print("wrote", rel)


w(
    "components/ui/pin-input.tsx",
    """'use client';

import { useId, useRef } from 'react';

type PinInputProps = {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  masked?: boolean;
};

export function PinInput({ length = 4, value, onChange, masked = true }: PinInputProps) {
  const inputId = useId();
  const hiddenRef = useRef<HTMLInputElement>(null);
  const digits = value.padEnd(length, ' ').slice(0, length).split('');
  const filled = value.length;

  return (
    <motionless />
  );
}
""",
)
