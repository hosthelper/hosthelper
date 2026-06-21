import {
  isYouTubeUrl,
  parseYouTubeId,
  secondsToLabel,
  pickCaptionTrack,
  parseJson3Transcript,
  parseHtmlMeta,
} from './extractor';

describe('parseYouTubeId', () => {
  it('watch?v= 형식', () => {
    expect(parseYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('youtu.be 단축', () => {
    expect(parseYouTubeId('https://youtu.be/dQw4w9WgXcQ?t=10')).toBe('dQw4w9WgXcQ');
  });
  it('shorts 경로', () => {
    expect(parseYouTubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('embed 경로', () => {
    expect(parseYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('유튜브가 아니면 null', () => {
    expect(parseYouTubeId('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull();
  });
  it('잘못된 id 길이는 null', () => {
    expect(parseYouTubeId('https://youtu.be/short')).toBeNull();
  });
  it('잘못된 URL은 null', () => {
    expect(parseYouTubeId('not a url')).toBeNull();
  });
});

describe('isYouTubeUrl', () => {
  it('m.youtube.com 도 인식', () => {
    expect(isYouTubeUrl('https://m.youtube.com/watch?v=x')).toBe(true);
  });
  it('일반 사이트는 false', () => {
    expect(isYouTubeUrl('https://vimeo.com/123')).toBe(false);
  });
});

describe('secondsToLabel', () => {
  it('분:초', () => {
    expect(secondsToLabel(125)).toBe('2:05');
  });
  it('시:분:초', () => {
    expect(secondsToLabel(3661)).toBe('1:01:01');
  });
  it('0 이하는 빈 문자열', () => {
    expect(secondsToLabel(0)).toBe('');
  });
});

describe('pickCaptionTrack', () => {
  it('한국어 우선', () => {
    const track = pickCaptionTrack([
      { baseUrl: 'u-en', languageCode: 'en' },
      { baseUrl: 'u-ko', languageCode: 'ko' },
    ]);
    expect(track?.baseUrl).toBe('u-ko');
  });
  it('한국어 없으면 영어', () => {
    const track = pickCaptionTrack([
      { baseUrl: 'u-ja', languageCode: 'ja' },
      { baseUrl: 'u-en', languageCode: 'en' },
    ]);
    expect(track?.baseUrl).toBe('u-en');
  });
  it('둘 다 없으면 첫 번째', () => {
    const track = pickCaptionTrack([{ baseUrl: 'u-ja', languageCode: 'ja' }]);
    expect(track?.baseUrl).toBe('u-ja');
  });
  it('baseUrl 없는 트랙은 제외', () => {
    expect(pickCaptionTrack([{ languageCode: 'ko' }])).toBeNull();
  });
  it('빈 배열은 null', () => {
    expect(pickCaptionTrack([])).toBeNull();
  });
});

describe('parseJson3Transcript', () => {
  it('events/segs/utf8 결합', () => {
    const json = {
      events: [
        { segs: [{ utf8: '안녕' }, { utf8: '하세요' }] },
        { segs: [{ utf8: ' 반갑습니다' }] },
      ],
    };
    expect(parseJson3Transcript(json)).toBe('안녕하세요 반갑습니다');
  });
  it('events 없으면 빈 문자열', () => {
    expect(parseJson3Transcript({})).toBe('');
  });
  it('객체 아니면 빈 문자열', () => {
    expect(parseJson3Transcript(null)).toBe('');
  });
});

describe('parseHtmlMeta', () => {
  it('og:title / og:description 추출', () => {
    const html =
      '<html><head>' +
      '<meta property="og:title" content="멋진 영상" />' +
      '<meta property="og:description" content="설명입니다 &amp; 더보기" />' +
      '<title>fallback</title></head></html>';
    const meta = parseHtmlMeta(html);
    expect(meta.title).toBe('멋진 영상');
    expect(meta.description).toBe('설명입니다 & 더보기');
  });
  it('og:title 없으면 <title> 폴백', () => {
    const meta = parseHtmlMeta('<head><title>제목만</title></head>');
    expect(meta.title).toBe('제목만');
  });
});
