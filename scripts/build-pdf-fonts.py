"""Build OFL-renamed PDF font subsets from the pinned Source Han Sans originals.

The output contains Latin/punctuation and every character in the local reading
source (including vendored engine vocabularies). Personal names are not printed.
Use the existing checkout-local fontTools cache; no runtime font conversion.
"""
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / '.cache/font-tools'))
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.ttGlyphPen import TTGlyphPen

characters = set(chr(code) for code in range(0x20, 0x7F))
characters.update(chr(code) for code in range(0x2000, 0x2070))
characters.update(chr(code) for code in range(0x3000, 0x3040))
for source in (root / 'public/experience').rglob('*.js'):
    if 'vendor' in source.parts and source.name not in ['lunar.js', 'iztro.min.js']:
        continue
    characters.update(source.read_text(encoding='utf-8'))
characters.update('甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥木火土金水正偏印財财官傷伤食神比肩劫七殺杀日主長长生沐浴冠帶带臨临帝旺衰病死墓絶绝胎養养空亡納纳音')

for weight in ['Regular', 'Bold']:
    font = TTFont(root / f'.cache/font-source/SourceHanSansK-{weight}.otf')
    original = font.getBestCmap()
    chosen = sorted(ord(char) for char in characters if ord(char) in original)
    options = subset.Options()
    options.name_IDs = ['*']
    options.name_legacy = True
    options.name_languages = ['*']
    options.layout_features = []
    options.hinting = False
    worker = subset.Subsetter(options=options)
    worker.populate(unicodes=chosen)
    worker.subset(font)
    names = {1:'SAI PDF Sans',2:weight,3:f'SAIPDFSans-{weight}-20261023',4:f'SAI PDF Sans {weight}',6:f'SAIPDFSans-{weight}',16:'SAI PDF Sans',17:weight}
    for record in font['name'].names:
        if record.nameID in names:
            record.string = names[record.nameID].encode(record.getEncoding(), errors='replace')
    cff = font['CFF '].cff
    cff.fontNames = [f'SAIPDFSans-{weight}']
    cff.topDictIndex[0].FamilyName = 'SAI PDF Sans'
    cff.topDictIndex[0].FullName = f'SAI PDF Sans {weight}'
    # Pinned fontkit 1.1.1 does not expose the CFF marker expected by
    # pdf-lib 1.17.1. Convert these OFL-renamed cubic outlines to quadratic
    # TrueType up front; visitors never convert or repair a font at runtime.
    glyph_set = font.getGlyphSet()
    order = font.getGlyphOrder()
    builder = FontBuilder(font['head'].unitsPerEm, isTTF=True)
    builder.setupGlyphOrder(order)
    builder.setupCharacterMap(font.getBestCmap())
    outlines = {}
    for name in order:
        pen = TTGlyphPen(glyph_set)
        glyph_set[name].draw(Cu2QuPen(pen, max_err=1.0, reverse_direction=True))
        outlines[name] = pen.glyph()
    builder.setupGlyf(outlines)
    builder.setupHorizontalMetrics(font['hmtx'].metrics)
    builder.setupHorizontalHeader(ascent=font['hhea'].ascent, descent=font['hhea'].descent, lineGap=font['hhea'].lineGap)
    builder.font['name'] = font['name']
    builder.setupOS2(sTypoAscender=font['OS/2'].sTypoAscender, sTypoDescender=font['OS/2'].sTypoDescender,
                    usWinAscent=font['OS/2'].usWinAscent, usWinDescent=font['OS/2'].usWinDescent,
                    usWeightClass=400 if weight == 'Regular' else 700, fsType=0)
    builder.setupPost()
    destination = root / f'public/experience/fonts/sai-pdf-{weight.lower()}.ttf'
    builder.save(destination)
    checked = TTFont(destination)
    assert all(ord(char) in checked.getBestCmap() for char in '사주甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥')
    assert checked['name'].getDebugName(1) == 'SAI PDF Sans'
    print(weight, 'glyphs', len(checked.getBestCmap()), 'bytes', destination.stat().st_size)
