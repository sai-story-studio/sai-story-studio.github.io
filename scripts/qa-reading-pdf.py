"""Read-back QA and compact contact sheets for the three synthetic PDF fixtures."""
from pathlib import Path
from collections import Counter
import json
import re
from pypdf import PdfReader
import pdfplumber
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1]
folder = root / 'output/pdf'
expectation_file = folder / 'sai-pdf-highlight-expectations.json'
highlight_expectations = json.loads(expectation_file.read_text(encoding='utf-8')) if expectation_file.exists() else {}
def normalized(value):
    return re.sub(r'\s+', '', re.sub('[\u2011\u2012\u2013\u2014\u2212]', '-', value))
for mode in ['saju', 'ziwei', 'zodiac']:
    source = folder / f'sai-{mode}-sample.pdf'
    reader = PdfReader(source)
    assert len(reader.pages) > 0
    extracted = []
    body_chars = []
    body_pages = []
    with pdfplumber.open(source) as pdf:
        for index, page in enumerate(pdf.pages):
            text = page.extract_text() or ''
            assert text.strip(), f'{mode} blank page {index + 1}'
            extracted.append(text)
            body_pages.append(page.crop((39, 65, float(page.width) - 37, float(page.height) - 50)).extract_text() or '')
            for char in page.chars:
                assert char['x0'] >= 39.0 and char['x1'] <= float(page.width) - 37, (mode, index + 1, 'horizontal clip', char)
                assert char['top'] >= 20 and char['bottom'] < float(page.height) - 13, (mode, index + 1, 'vertical clip', char)
                if 65 <= char['top'] < float(page.height) - 50 and normalized(char['text']):
                    body_chars.append(char)
            fonts = page.objects.get('char', [])
            assert any('SAIPDFSans' in char.get('fontname', '') for char in fonts)
    text = '\n'.join(extracted)
    assert '\ufffd' not in text and '\x00' not in text
    if mode != 'ziwei':
        assert '네 글자로 연결한 이유' in text
    if mode == 'saju':
        for term in ['생시', '생일', '생월', '생년', '壬', '辛', '戊', '乙', '辰', '巳', '子', '酉', '타고난 구조', '이 원국에서 연결되는 핵심 성향']:
            assert term in text, (mode, 'missing', term)
    if mode != 'zodiac':
        assert len(normalized(body_pages[-1])) > 180, (mode, 'lonely closing note or final sentence on last page')
        # The renderer's fixed safety-note heading is not a report task.
        # Every authored result sentence still receives the strict check.
        explanatory_text = text.replace('읽기 전에 기억해 주세요', '')
        assert not re.search(r'보세요|주세요|답해|적어\s*보|기록해|작성해|체크해|떠올려|남겨\s*두세요|자기 성찰 질문|균형을 위한 질문|실제 상황 선택|구체적인 실천|관찰 질문|시도할 행동|현실 비교 과제|90일\s*행동|[?？]', explanatory_text), (mode, 'homework copy returned in rendered PDF')
    if mode == 'ziwei':
        body = normalized('\n'.join(body_pages))
        assert body.startswith('[해석안내]') and '[입력상태]' in normalized(body_pages[0])
        assert '네글자로연결한이유' not in body
        for term in ['22세', '자동계산', '2026-02-17', '2036-01-28', '해석종합', '중심성향이나온이유', 'Disclosure·해석범위와조건', '명궁은판단의기준,신궁은힘이실리는행동영역,복덕궁은만족과회복의방식']:
            assert term in body, ('ziwei', 'missing automatic-age/report fact', term)
        assert body.endswith(normalized('이 해석은 전통 자미두수의 상징 체계에 따른 참고 관점이며, 중요한 현실 결정은 사실 정보와 전문 조언을 함께 검토해야 합니다.'))
    if mode in highlight_expectations:
        # Look at the actual embedded font of each semantic phrase, even if
        # it wraps to another line/page. A heading copy of the phrase does
        # not satisfy this: only report body characters are considered.
        flattened = []
        for char in body_chars:
            for letter in normalized(char['text']):
                flattened.append((letter, 'Bold' in char.get('fontname', '')))
        body_text = ''.join(letter for letter, _ in flattened)
        phrases = set(highlight_expectations[mode])
        assert phrases, f'{mode} must have authored semantic highlights'
        for phrase in phrases:
            target = normalized(phrase)
            positions = [match.start() for match in re.finditer(re.escape(target), body_text)]
            assert positions, (mode, 'semantic phrase missing from PDF', phrase)
            assert any(all(strong for _, strong in flattened[start:start + len(target)]) for start in positions), (mode, 'semantic phrase not bold', phrase)
        assert any(not strong for _, strong in flattened), f'{mode} body must retain normal weight prose'
        print(f'PASS {mode}: {len(phrases)} authored semantic phrases are actually bold, with normal-weight body retained')
    for page in reader.pages:
        for ref in page['/Resources']['/Font'].values():
            font = ref.get_object()
            if font.get('/Subtype') != '/Type0':
                continue
            descriptor = font['/DescendantFonts'][0].get_object()['/FontDescriptor'].get_object()
            assert '/FontFile2' in descriptor, 'TrueType font must be embedded'
            assert descriptor['/FontFile2'].get_object().get_data()[:4] == b'\x00\x01\x00\x00'
    images = sorted(folder.glob(f'sai-{mode}-page-*.png'))[:len(reader.pages)]
    thumbs = []
    for index, image in enumerate(images):
        thumb = Image.open(image).convert('RGB')
        thumb.thumbnail((260, 370))
        card = Image.new('RGB', (280, 400), '#EAE6ED')
        card.paste(thumb, ((280 - thumb.width) // 2, 16))
        ImageDraw.Draw(card).text((12, 382), f'{mode.upper()} - PAGE {index + 1}', fill='#40364E')
        thumbs.append(card)
    columns = min(3, len(thumbs))
    sheet = Image.new('RGB', (columns * 280, ((len(thumbs) + columns - 1) // columns) * 400), 'white')
    for index, thumb in enumerate(thumbs):
        sheet.paste(thumb, ((index % columns) * 280, (index // columns) * 400))
    sheet.save(folder / f'sai-{mode}-contact-sheet.png')
    print(f'PASS {mode}: {len(reader.pages)} pages; embedded TrueType, extracted Korean/Hanja, no replacement glyphs, no clipped text')
