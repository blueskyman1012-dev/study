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

// sessionStorage 래퍼 (민감 데이터용: 토큰, API 키)
// 탭 종료 시 자동 삭제되어 localStorage보다 안전

export function secureGetItem(key, fallback = null) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return fallback;
  }
}

export function secureSetItem(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

export function secureRemoveItem(key) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}
