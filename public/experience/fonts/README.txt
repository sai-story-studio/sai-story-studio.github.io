Current font and logo roles, 2026-10-22
Accent text/headings: Arita Buri Medium 500 and SemiBold 600 only.
Body/UI: Pretendard Variable at weights 400, 500, 600, and 700.
Logo: the original transparent bitmap derived from the user's supplied
handwritten reference, public/experience/assets/sai-handwritten-lockup.png.
The logo is rendered through a CSS mask colored with currentColor. It does not
use an Arita, Ownglyph, Handlee, or Source Han font face.

The previous handwritten font comparisons and their licenses are archived in
ignored outputs/font-qa-20261022 outside the public site. Earlier Source Han
subset files remain in this directory for reference/rollback and are unused.

Arita Buri / Arita-buri-M.woff and Arita-buri-SB.woff
Unmodified original webfonts linked by Amorepacific Creatives' official CSS:
https://design.amorepacific.com/wp-content/themes/by26-locale/assets/css/font.css?ver=1762490334
Source files:
https://cdn-design.amorepacific.com/assets-v2/font/Arita-buri-M.woff
https://cdn-design.amorepacific.com/assets-v2/font/Arita-buri-SB.woff
Medium has actual OpenType weight 500; SemiBold has actual weight 600.
Publisher CSS maps the same files to 400 and 500 for its own typography scale.
Both original files contain all 11,172 modern Hangul syllables.
No Regular-named face is supplied by the official Korean Buri family.
See ARITA-BURI-LICENSE.txt for copyright, source, and authoritative conditions.
Do not convert/subset/modify; CI/BI use is prohibited, so these are text assets.

SAIEditorial Light / sai-editorial.woff2 (retained, unused)
An optimized glyph subset of Adobe Source Han Serif K Light (본명조 Light).
Upstream: https://github.com/adobe-fonts/source-han-serif
Official source:
https://raw.githubusercontent.com/adobe-fonts/source-han-serif/release/OTF/Korean/SourceHanSerifK-Light.otf
License: SIL Open Font License 1.1; see SOURCE-HAN-SERIF-LICENSE.txt.
The modified subset is renamed SAIEditorial to respect the reserved font name
Source, including family/style/PostScript metadata and CFF names. Upstream
copyright, authorship, trademark, and license metadata are retained unchanged.
The glyph outlines were not redesigned. This Light (300) asset includes 사이,
basic Latin letters, digits, and spaces for earlier lettering experiments.
It is not a general Korean body-text font and is not the current logo.

Pretendard Variable / PretendardVariable.woff2 (current body/UI)
Unmodified official v1.3.9 variable WOFF2 by Kil Hyung-jin.
Upstream: https://github.com/orioncactus/pretendard/tree/v1.3.9
Official pinned source:
https://raw.githubusercontent.com/orioncactus/pretendard/v1.3.9/packages/pretendard/dist/web/variable/woff2/PretendardVariable.woff2
Official license source:
https://raw.githubusercontent.com/orioncactus/pretendard/v1.3.9/LICENSE
License: SIL Open Font License 1.1; see PRETENDARD-LICENSE.txt.
The site uses weights 400, 500, 600, and 700. The reserved font name Pretendard
and original metadata remain unchanged.
This font contains Korean body-text glyphs and a continuous variable wght axis
from 45 through 930, with default weight 400, as stored in the official file.

Retained, unused: sai-wordmark.woff2 / SAI Wordmark Heavy
An earlier optimized subset of Adobe Source Han Sans K Heavy, retained for
rollback/reference. It is not used by the current bitmap logo or site typography.
Upstream: https://github.com/adobe-fonts/source-han-sans
Font source: release/OTF/Korean/SourceHanSansK-Heavy.otf
License: SIL Open Font License 1.1; see SOURCE-HAN-SANS-LICENSE.txt.
The modified subset is renamed SAI Wordmark to respect the reserved font name
Source. Original copyright and license metadata are retained.

Archived handwritten comparisons (not public or active)
Location: ignored outputs/font-qa-20261022, together with their associated
OWNGLYPH-LICENSE.txt and HANDLEE-OFL.txt notices and comparison HTML/PNG.

Ownglyph Uiyeun / OwnglyphUiyeun.ttf
Unmodified official TTF; actual family Ownglyph EuiyeonChae, one regular face.
Noonnu: https://noonnu.cc/font_page/667
Publisher: https://www.ownglyph.com/trial/368dc898-8353-490d-9a65-c8fe9264c8f3

Ownglyph Park Dahyun / OwnglyphParkDahyun.ttf
Unmodified official TTF; actual family Ownglyph PDH Regular.
Noonnu: https://noonnu.cc/font_page/1541
Publisher: https://www.ownglyph.com/trial/11ebf7f8-0997-4f03-a393-0959a07286aa
Neither original font was converted, subsetted, or internally renamed. Their
publisher's original-font license permits web embedding and logos while
prohibiting font-file modification. These candidates were not selected.

Handlee / Handlee-Regular.ttf
Unmodified official Google Fonts distribution; SIL OFL 1.1.
https://github.com/google/fonts/tree/main/ofl/handlee
Retained solely as a comparison, not as the current logo's English lettering.

Caveat Variable / Caveat-Variable.ttf (current English brand lettering)
Unmodified official Google Fonts variable font, default Regular 400.
https://github.com/google/fonts/tree/main/ofl/caveat
License: SIL Open Font License 1.1; see Caveat-OFL.txt.

InkLipquid Regular / InkLipquid-Regular.woff (current Korean brand lettering)
Unmodified WOFF linked by Noonnu; no conversion, subsetting, outline changes,
artificial bold/slant, or nonuniform scaling is applied.
Font file: https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_one@1.0/InkLipquid.woff
Listing: https://noonnu.cc/font_page/68
Publisher: https://www.thefaceshop.com/brand/introduction/brand.jsp?tab_seq=1#FontDownload
Publisher guide: https://www.thefaceshop.com/images/data/download/bi/%EB%8D%94%ED%8E%98%EC%9D%B4%EC%8A%A4%EC%83%B5_%EC%9E%89%ED%81%AC%EB%A6%BD%ED%80%B4%EB%93%9C%EC%B2%B4_%EA%B0%80%EC%9D%B4%EB%93%9C%EB%9D%BC%EC%9D%B8.pdf
The 20-page official guide was inspected, including page 19 (printed 18),
which prohibits stretched, squashed, slanted, thickened, outlined and
patterned lettering. It did not establish a blanket personal-site/logo ban
or a blanket logo-use permission. Third-party summaries differ; this record
does not certify every legal use. Applied to the requested personal Site
without those alterations. Font copyright remains with its rights holder.
SHA256: 4bbf7b38ff5e316bb9f0c89bd82c61b90028fd5e35245fbf12c2a8fd755f7c3e
