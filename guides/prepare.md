# Application pack: writing runbook

The person shortlisted a role. Prepare everything they need to apply in a few minutes. They review and submit; you never apply, email or message anyone.

## Steps
1. Run `job-scout prepare <ref>`. It prints the role, the posting, the CV variant for its lane, the person's LinkedIn connections there, the files with facts about them, where to write the pack, and the command that files it.
2. Read every file on the "Facts about" line. The profile's `application.md` holds their CV variants, standard form answers, salary rule, what never to claim, their voice, and how to deliver the pack. Their CV is the only source of facts about them.
3. Write the pack (format below) to the path `prepare` printed.
4. Run the "Then file it" command. It saves the pack into the role's note, renders the cover letter as a PDF, and prints the message to send. Deliver it the way `application.md` says; if it says nothing, show the output to the person.

## Pack format (Markdown, in this order)

**CV:** `<file name>`, plus one line on why it fits this posting. Use the lane's variant unless the posting clearly leans elsewhere (`application.md` says what each variant leads with).

**Cover letter**: 150–250 words, three short paragraphs, signed with the person's full name. It also becomes a PDF, so keep this shape: a line with only `**Cover letter**`, then the greeting ("Dear Colin," or "Hello Checkly team,"), the paragraphs separated by blank lines, and their name on the last line. No bullets or headings inside the letter.
1. What in *this* posting made them want it. Name one concrete thing they wrote (a practice, a problem, a product), not generic praise.
2. Two or three facts from the CV that answer the posting's most important requirements, with numbers where the CV has them.
3. A plain close: what they'd like to talk about. No begging and no "I believe I would be a great fit".

**Form answers**: short, ready to paste.
- *Why this company / role*: 2–3 sentences, specific to the posting.
- The standard answers from `application.md` (why looking, notice period, work authorisation, location, experience, salary), adapted to the role where it says so.
- Any question the posting itself asks or clearly implies (e.g. "How do you feel about engineers writing specs?"): answer it in 2–3 sentences from their real experience.

**Who to contact**: connections from `prepare`, if any. If the posting names a hiring manager or recruiter, give their name and role and draft a note of at most 300 characters the person can send themselves. Otherwise write "Nobody in their network; apply directly."

**Before you apply**: at most three bullets: the scout's gaps worth checking, and one question worth asking in a first interview.

## Voice and truth rules
- First person, plain and direct, warm but not gushing. Short sentences. No buzzwords ("passionate", "thrilled", "leverage", "synergy", "cutting-edge", "fast-paced", "rockstar"). No em dashes.
- Every claim about the person must be in their CV. Don't round numbers up or invent new ones.
- Follow the profile's "Never claim" and "Voice" sections.
- Write in the posting's language if it isn't English, unless the profile says they don't speak it.
