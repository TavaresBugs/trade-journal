#!/usr/bin/env python3
"""Standardize user-facing UI text in apps/web/src to LuxAlgo's canonical Sentence case."""

import argparse
import os
import re
from pathlib import Path
from typing import Dict, List, Tuple

REPO_ROOT = Path(__file__).resolve().parent.parent
WEB_SRC = REPO_ROOT / "apps" / "web" / "src"

# Words/tokens that must preserve their uppercase/capitalized form
PROTECTED_WORDS = {
    # Acronyms & technical terms
    "P&L", "ROI", "ATR", "MAE", "MFE", "FIFO", "UTC", "USD", "EUR", "GBP", "JPY", "CAD", "AUD",
    "AI", "CSV", "PDF", "PNG", "HTML", "SVG", "URL", "API", "ID", "ESC", "CTRL", "Ctrl+V", "WebP",
    "BYOK", "JSON", "OAuth",
    # Brand names & platform titles
    "LuxAlgo", "ECharts", "TradeZella", "TradingView", "MetaTrader", "ThinkorSwim", "IBKR",
    "Trade Journal", "TradeJournal", "Edge Score", "London Strategic Edge",
    # Timeframe identifiers
    "Monthly", "Weekly", "Daily", "4H", "1H", "15M", "5M", "M3/M1",
}

# Explicit string replacements to guarantee exact sentence case matching
# Kept in order from most specific to least specific
EXPLICIT_REPLACEMENTS = {
    # Component titles & headings
    "Visual Context & Screenshots": "Visual context & screenshots",
    "Pre-Market Context": "Pre-market context",
    "Post-Market (Executions)": "Post-market (executions)",
    "Pre-Market": "Pre-market",
    "Post-Market": "Post-market",
    # Button titles & tooltips
    "Remove Screenshot": "Remove screenshot",
    "Open Fullscreen Zoom": "Open fullscreen zoom",
    "Delete Screenshot (Delete)": "Delete screenshot (Del)",
    "Previous (Left Arrow)": "Previous (left arrow)",
    "Next (Right Arrow)": "Next (right arrow)",
    # Subtitles & descriptions
    "Macro Context & Secular Trend": "Macro context & secular trend",
    "Weekly Structure & Major Zones": "Weekly structure & major zones",
    "Daily Bias & Directional Trend": "Daily bias & directional trend",
    "4H Structure & Liquidity Pools": "4H structure & liquidity pools",
    "1H Intraday Structure": "1H intraday structure",
    "Points of Interest & 15M Structure": "Points of interest & 15M structure",
    "Operational Structure & Trigger": "Operational structure & trigger",
    "Refined Execution / Entry & Stop": "Refined execution / entry & stop",
}

def scan_file(file_path: Path) -> List[Tuple[int, str, str, str]]:
    """Scan a file for known Title Case occurrences or explicit replacements."""
    content = file_path.read_text(encoding="utf-8")
    lines = content.splitlines()
    findings = []

    # Sort replacements by length descending
    sorted_repls = sorted(EXPLICIT_REPLACEMENTS.items(), key=lambda x: len(x[0]), reverse=True)

    for line_idx, line in enumerate(lines, start=1):
        line_remaining = line
        for orig, target in sorted_repls:
            if orig in line_remaining:
                findings.append((line_idx, "explicit", orig, target))
                line_remaining = line_remaining.replace(orig, "")

    return findings

def apply_replacements(file_path: Path, replacements: Dict[str, str]) -> bool:
    """Apply string replacements cleanly to a file."""
    content = file_path.read_text(encoding="utf-8")
    original = content
    # Sort by descending length so longer phrases replace first
    for src in sorted(replacements.keys(), key=len, reverse=True):
        dst = replacements[src]
        content = content.replace(src, dst)
    if content != original:
        file_path.write_text(content, encoding="utf-8")
        return True
    return False

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Apply proposed replacements")
    args = parser.parse_args()

    all_findings = []
    files_to_update = {}

    for root, _, files in os.walk(WEB_SRC):
        for f in sorted(files):
            if not f.endswith((".tsx", ".ts")):
                continue
            path = Path(root) / f
            findings = scan_file(path)
            if findings:
                all_findings.extend((path, item) for item in findings)
                for _, _, orig, prop in findings:
                    files_to_update.setdefault(path, {})[orig] = prop

    print(f"=== Found {len(all_findings)} capitalization candidates across {len(files_to_update)} files ===")
    for path, (line_no, ctx, orig, prop) in all_findings:
        rel = path.relative_to(WEB_SRC)
        print(f"[{ctx}] {rel}:{line_no} -> '{orig}' => '{prop}'")

    if args.apply:
        print("\nApplying replacements...")
        changed = 0
        for path, repls in files_to_update.items():
            if apply_replacements(path, repls):
                changed += 1
                rel = path.relative_to(WEB_SRC)
                print(f"Updated: {rel}")
        print(f"\nSuccessfully updated {changed} files.")
    else:
        print("\nRun with --apply to execute replacements.")

if __name__ == "__main__":
    main()
