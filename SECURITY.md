# Security

Echo Kit handles conversations about health and money, so privacy problems matter here.

## Reporting a problem

Please do not open a public issue for a security or privacy problem. Use GitHub's
**Report a vulnerability** button on the repository's Security tab (private advisory).
Say what you found, how to reproduce it, and which app and browser.

This is a hackathon project maintained by one person. I will read reports and reply as
soon as I can, but I cannot promise a fixed response time.

## What is in scope

- Audio or text leaving the device without the person choosing to share it.
- A fact shown with a quote that is not in the transcript, or a medicine or money value that
  is not in its quote ("no anchor, no claim").
- Recording starting without consent, or consent withdrawal not deleting a visit.
- A shared file that contains audio or HTML that runs script.

## What is not a security issue

Speech recognition mistakes. Echo marks uncertain words **Check this** and says so in the
README. If you find a case where a wrong medicine is marked **Heard clearly**, please report it
as a bug with the audio details (use a fictional recording, never a real visit).

## Third-party downloads

The speech model files come from Hugging Face and the speech runtime from jsDelivr. Models are
loaded at pinned commits (`ui/src/platform/whisper-models.ts`; docs/SOURCES.md).
