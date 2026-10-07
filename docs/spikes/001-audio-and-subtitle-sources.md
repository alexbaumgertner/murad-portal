# Spike 001 — Where do audio clips and subtitles come from?

Blocks Epic 2 (listening tools). Run as deep research (Gemini), paste findings here, then turn them into an ADR.

## Questions

1. **Real pronunciations of one word (Phonetic Puzzle).** 10–20 clips per word: different speakers, accents, speed,
   emotion. Options to evaluate: Forvo API (pricing, licence for embedding/caching), YouGlish (embed widget only?
   terms), Wikimedia Commons / Lingua Libre (CC licences), clipping from YouTube videos by timestamp via the IFrame
   API (no downloading), recording our own clips with Murad. For each: cost, licence, can we store/cache, coverage.
2. **Subtitles / transcripts (Player, Quizzer).** Murad's own videos: YouTube Data API `captions.download` with his
   OAuth — quotas, review requirements. Other people's videos: what is allowed by YouTube ToS; fallback = paste a
   transcript, or speech-to-text on audio we may legally process.
3. **Word-level timestamps** for "hide a word and play only that fragment": which STT gives word timings, price per hour.
4. **Level & interest matching:** existing graded content sources / CEFR estimators for English text.

## Findings

<!-- paste with links and dates -->

## Recommendation → ADR
