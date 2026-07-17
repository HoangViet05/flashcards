# Reader decks and Anki library implementation plan

## Goal

Make each reading article own a vocabulary deck named after the article.  Marked
words can be saved in one operation, and Anki packages become an import-only
reference library whose rich data is used whenever a reader word becomes a
study card.

## Decisions

1. `Article.deck_id` is the authoritative association to its vocabulary deck.
   Creating an article creates this deck with the article title.  Existing
   articles receive a deck lazily, the first time a card is saved.
2. Anki imports populate a new user-scoped `anki_entries` table rather than
   `decks`, `cards`, or `reviews`.  It retains normalized headword, all card
   fields, source metadata, media URLs, import timestamp, and a fingerprint
   for idempotency.
3. A reusable backend card-creation service resolves the best matching Anki
   entry first (richest media/metadata, then newest import), and falls back to
   caller-provided dictionary data.  It creates the review record and rejects
   duplicates in the target deck case-insensitively.
4. A bulk endpoint creates cards for every article highlight.  It derives a
   sentence from article content as fallback context, skips existing cards,
   and returns added/skipped plus Anki-match counts.
5. The reader popup targets only the current article's deck.  The remembered
   words panel exposes one clear "add all" action and reports its result.

## Work items

1. Add models, lightweight migrations, schemas, importer summary changes and
   tests for a user-owned Anki entry library.
2. Refactor the importer to store parsed notes and media in that library, with
   duplicate-safe re-imports and no learning cards/decks created.
3. Add article deck provisioning, shared Anki-aware card creation, individual
   reader save and bulk-highlight endpoints; cover ownership and duplicate
   behavior with API tests.
4. Update TypeScript contracts and UI text, bind `WordPopup` to its article,
   and add the bulk action in the remembered-word panel.
5. Run backend tests plus the frontend production build, then resolve any
   regressions.

## Compatibility

Existing imported cards cannot be identified reliably as imported Anki data,
so users should import their `.apkg` again to make it available as a source.
Existing reader articles continue to work because their deck is provisioned on
first save.
