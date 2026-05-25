-- Hotfix-10: persist voice clip duration on issue reports.
-- The HK API already validated voiceSeconds ≤ 60 but never stored it; the
-- dashboard had to wait for the audio file to load before showing duration.

ALTER TABLE "issue_reports"
  ADD COLUMN "voice_seconds" INTEGER;
