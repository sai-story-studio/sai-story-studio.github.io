SAI PDF Sans Regular (400) and Bold (700), 2026-10-23

These PDF-only, renamed subsets derive from Adobe Source Han Sans K.
Source Han Sans copyright and SIL Open Font License 1.1 are retained in
SOURCE-HAN-SANS-LICENSE.txt. The reserved font name Source is not used in
the modified font family or PostScript names. Hinting and unused shaping
tables are removed; cubic outlines are converted to quadratic TrueType
curves with a maximum error of 1 font unit for PDF-engine compatibility.

Pinned upstream paths:
https://raw.githubusercontent.com/adobe-fonts/source-han-sans/release/OTF/Korean/SourceHanSansK-Regular.otf
https://raw.githubusercontent.com/adobe-fonts/source-han-sans/release/OTF/Korean/SourceHanSansK-Bold.otf

Reproducible subset builder: scripts/build-pdf-fonts.py
Coverage: 2,457 glyphs comprising the authored reading vocabulary, reading
engine Korean/Hanja vocabulary, Latin/digits, and punctuation. PDF reports
do not print a visitor's personal name; raw date/time is opt-in only.
When new report vocabulary is added, rebuild these two font subsets and
run PDF text, glyph coverage, deterministic output and visual QA.
The pure PDF renderer embeds these compact TrueType pre-subsets intact.
Poppler validates the embedded font programs without font-type warnings.
