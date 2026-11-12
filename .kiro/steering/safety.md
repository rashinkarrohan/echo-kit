---
inclusion: always
---
# Safety and privacy
- Separate consent per purpose; keep a consent ledger.
- Never store audio by default; never put API keys in client code; cloud calls need a spend cap and a visible toggle.
- Demo data uses actors, never real patients or customers.
- If extraction is unsure, show "Check this" or "Not said"; never guess.
- Speech engines may write numbers as words: normalise before checking doses or amounts.
