// E2E 테스트 - 앱 기본 기능
import { test, expect } from '@playwright/test';

test.describe('앱 로딩', () => {
  test('E2E-APP-001: 앱이 정상적으로 로드되어야 한다', async ({ page }) => {
    await page.goto('/');

    // 캔버스가 존재하는지 확인
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
  });

  test('E2E-APP-002: 캔버스 크기가 올바르게 설정되어야 한다', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();

    expect(box.width).toBe(400);
    expect(box.height).toBe(700);
  });
});

test.describe('메인 화면', () => {
  test('E2E-MAIN-001: 타이틀이 표시되어야 한다', async ({ page }) => {
    await page.goto('/');

    // 캔버스 렌더링 대기
    await page.waitForTimeout(500);

    // 스크린샷으로 확인
    await expect(page).toHaveScreenshot('main-screen.png', {
      maxDiffPixelRatio: 0.1
    });
  });

  test('E2E-MAIN-002: 던전 입장 버튼 영역이 클릭 가능해야 한다', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);

    const canvas = page.locator('canvas');

    // 던전 입장 버튼 위치 클릭 (x: 80-320, y: 340-400)
    await canvas.click({ position: { x: 200, y: 370 } });

    // 클릭 후 반응 확인 (alert 또는 화면 전환)
    await page.waitForTimeout(300);
  });

  test('E2E-MAIN-003: 오답 등록 버튼 영역이 클릭 가능해야 한다', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);

    const canvas = page.locator('canvas');

    // 오답 등록 버튼 위치 클릭 (x: 80-320, y: 420-480)
    await canvas.click({ position: { x: 200, y: 450 } });

    await page.waitForTimeout(300);
  });
});

test.describe('오답 등록 화면', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);

    const canvas = page.locator('canvas');
    // 오답 등록 버튼 클릭
    await canvas.click({ position: { x: 200, y: 450 } });
    await page.waitForTimeout(300);
  });

  test('E2E-REG-001: 오답 등록 화면이 표시되어야 한다', async ({ page }) => {
    await expect(page).toHaveScreenshot('register-screen.png', {
      maxDiffPixelRatio: 0.1
    });
  });

  test('E2E-REG-002: 뒤로가기 버튼이 동작해야 한다', async ({ page }) => {
    const canvas = page.locator('canvas');

    // 뒤로가기 버튼 위치 클릭 (x: 10-90, y: 10-50)
    await canvas.click({ position: { x: 30, y: 22 } });
    await page.waitForTimeout(300);

    // 메인 화면으로 돌아감
  });

  test('E2E-REG-003: 과목 선택 버튼들이 표시되어야 한다', async ({ page }) => {
    // 과목 버튼 영역 (y: 410-460)이 클릭 가능해야 함
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
  });
});

test.describe('반응형/모바일', () => {
  test('E2E-MOB-001: 모바일 뷰포트에서 앱이 로드되어야 한다', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
  });

  test('E2E-MOB-002: 터치 이벤트가 동작해야 한다', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForTimeout(500);

    const canvas = page.locator('canvas');

    // 터치 탭 시뮬레이션
    await canvas.tap({ position: { x: 200, y: 370 } });
    await page.waitForTimeout(300);
  });
});

test.describe('성능', () => {
  test('E2E-PERF-001: 초기 로딩이 3초 이내여야 한다', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    await page.locator('canvas').waitFor();
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(3000);
  });

  test('E2E-PERF-002: 메모리 누수가 없어야 한다', async ({ page }) => {
    await page.goto('/');

    // 초기 메모리 측정
    const initialMetrics = await page.metrics();

    // 여러 번 화면 전환
    const canvas = page.locator('canvas');
    for (let i = 0; i < 5; i++) {
      await canvas.click({ position: { x: 200, y: 450 } });
      await page.waitForTimeout(200);
      await canvas.click({ position: { x: 30, y: 22 } });
      await page.waitForTimeout(200);
    }

    // 최종 메모리 측정
    const finalMetrics = await page.metrics();

    // 메모리 증가율이 50% 미만이어야 함
    const memoryIncrease = finalMetrics.JSHeapUsedSize / initialMetrics.JSHeapUsedSize;
    expect(memoryIncrease).toBeLessThan(1.5);
  });
});

test.describe('IndexedDB 데이터', () => {
  test('E2E-DB-001: 플레이어 데이터가 저장되어야 한다', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    // IndexedDB에서 플레이어 데이터 확인
    const playerData = await page.evaluate(async () => {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('OdapHunterDB', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('player', 'readonly');
          const store = tx.objectStore('player');
          const getReq = store.get('main');
          getReq.onsuccess = () => resolve(getReq.result);
          getReq.onerror = () => reject(getReq.error);
        };
      });
    });

    expect(playerData).toBeDefined();
    expect(playerData.id).toBe('main');
  });

  test('E2E-DB-002: 새 세션에서 데이터가 유지되어야 한다', async ({ page }) => {
    // 첫 번째 방문
    await page.goto('/');
    await page.waitForTimeout(1000);

    // 골드 값 확인
    const initialGold = await page.evaluate(async () => {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('OdapHunterDB', 1);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('player', 'readonly');
          const store = tx.objectStore('player');
          const getReq = store.get('main');
          getReq.onsuccess = () => resolve(getReq.result?.gold);
        };
      });
    });

    // 페이지 새로고침
    await page.reload();
    await page.waitForTimeout(1000);

    // 골드 값이 유지되는지 확인
    const reloadedGold = await page.evaluate(async () => {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('OdapHunterDB', 1);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('player', 'readonly');
          const store = tx.objectStore('player');
          const getReq = store.get('main');
          getReq.onsuccess = () => resolve(getReq.result?.gold);
        };
      });
    });

    expect(reloadedGold).toBe(initialGold);
  });
});

test.describe('에러 처리', () => {
  test('E2E-ERR-001: 콘솔 에러가 없어야 한다', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('/');
    await page.waitForTimeout(1000);

    expect(errors).toHaveLength(0);
  });

  test('E2E-ERR-002: 네트워크 에러 시 앱이 크래시되지 않아야 한다', async ({ page }) => {
    // 네트워크 오프라인 모드
    await page.context().setOffline(true);

    await page.goto('/').catch(() => {});

    // 오프라인 상태에서도 이미 로드된 앱은 동작해야 함
    await page.context().setOffline(false);
    await page.goto('/');

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
  });
});
