# Privacy and consent (design notes; not legal advice)

- Consent screen before any recording, with a record per purpose (record, transcribe, share), timestamp and wording version.
- All-party consent wording everywhere by default (the validation doc lists 11 US all-party states; UK patients may generally record consultations they take part in; check with counsel before launch).
- Audio and transcripts stay on the device by default (browser storage). A delete control for every session; withdrawing consent deletes the session.
- Echo Care's optional "Your medicines" list (names only, typed by the user) stays on the device. It is used only to help the speech engine and the name matcher on that device; it is never put on a receipt or a shared summary. Each name can be removed, and the whole list deleted after a confirmation.
- Cloud use only through a capped proxy, transcript text only, after a visible toggle. No keys in the client. No content in logs.
- Family share through the device share sheet; no server in v1; exported files exclude audio by default; a file already sent cannot be recalled (say so).
- Label photos are not kept unless the user opts in.
- Demo and eval data use actors with written releases. No real patient or customer data anywhere in the repo or video.
- Echo is not an interpreter and is not an ADA accommodation; it must say so.
