// localStorage 안전 래퍼 (시크릿 모드/Private Browsing 대응)

export function safeGetItem(key, fallback = null) {
  try {
    return localStorage.getItem(key);
  } catch {
    return fallback;
  }
}

export function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 시크릿 모드 등에서 quota 초과 시 무시
  }
}

export function safeRemoveItem(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
