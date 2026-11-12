# How to use this bundle
1. Copy the contents into the root of your new public repo. Rename README.template.md to README.md and fill the blanks.
2. Add the lines in .gitignore.snippet to your .gitignore. Keep `private/` out of git. Do NOT ignore `.kiro/`.
3. Export the PRD document "Echo Kit: engineering PRD for Kiro" as Markdown into docs/PRD.md.
4. Open the repo in Kiro. All development uses Kiro only. Steering files load automatically; the specs in `.kiro/specs/` (echo-engine, echo-care, echo-cover) hold the requirements, design and task lists.
5. Tell Kiro: "Read .kiro/steering, docs/PRD.md and docs/BUILD-GUIDE.md. Run Step 0 only." Then paste the prompt for each next step from docs/BUILD-GUIDE.md. One step at a time; commit after each.
6. Work through docs/RULES-COMPLIANCE.md; request the Kiro credits today.
