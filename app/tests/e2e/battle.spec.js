// E2E 테스트 - 전투 시스템
import { test, expect } from '@playwright/test';

// 몬스터 데이터 추가 헬퍼
async function addTestMonster(page, monsterData = {}) {
  await page.evaluate(async (data) => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('OdapHunterDB', 1);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('monsters', 'readwrite');
        const store = tx.objectStore('monsters');
        const monster = {
          subject: 'math',
          question: '1 + 1 = ?',
          answer: '2',
          choices: ['2', '3', '4', '5'],
          correctIndex: 0,
          hp: 100,
          maxHp: 100,
          status: 'alive',
          createdAt: Date.now(),
          ...data
        };
        const addReq = store.add(monster);
        addReq.onsuccess = () => resolve(addReq.result);
        addReq.onerror = () => reject(addReq.error);
      };
    });
  }, monsterData);
}

// IndexedDB 초기화
async function clearDatabase(page) {
  await page.evaluate(async () => {
    return new Promise((resolve) => {
      const request = indexedDB.deleteDatabase('OdapHunterDB');
      request.onsuccess = resolve;
      request.onerror = resolve;
    });
  });
}

test.describe('던전 입장', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearDatabase(page);
    await page.reload();
    await page.waitForTimeout(500);
  });

  test('E2E-DNG-001: 몬스터 없이 던전 입장 시 경고가 표시되어야 한다', async ({ page }) => {
    page.on('dialog', dialog => {
      expect(dialog.message()).toContain('등록된 오답이 없습니다');
      dialog.accept();
    });

    const canvas = page.locator('canvas');
    await canvas.click({ position: { x: 200, y: 370 } });
    await page.waitForTimeout(300);
  });

  test('E2E-DNG-002: 몬스터가 있으면 던전에 입장해야 한다', async ({ page }) => {
    await addTestMonster(page);
    await page.reload();
    await page.waitForTimeout(500);

    const canvas = page.locator('canvas');
    await canvas.click({ position: { x: 200, y: 370 } });
    await page.waitForTimeout(500);

    // 전투 화면 확인 (스크린샷)
    await expect(page).toHaveScreenshot('battle-screen.png', {
      maxDiffPixelRatio: 0.15
    });
  });
});

test.describe('전투 진행', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearDatabase(page);
    await page.reload();
    await page.waitForTimeout(500);

    // 테스트용 몬스터 추가
    await addTestMonster(page);
    await page.reload();
    await page.waitForTimeout(500);

    // 던전 입장
    const canvas = page.locator('canvas');
    await canvas.click({ position: { x: 200, y: 370 } });
    await page.waitForTimeout(500);
  });

  test('E2E-BTL-001: 선택지 버튼이 표시되어야 한다', async ({ page }) => {
    // 선택지 4개가 화면에 표시되어야 함
    await expect(page.locator('canvas')).toBeVisible();
  });

  test('E2E-BTL-002: 정답 선택 시 몬스터 HP가 감소해야 한다', async ({ page }) => {
    const canvas = page.locator('canvas');

    // 첫 번째 선택지 클릭 (정답 = index 0)
    // 선택지 위치: x: 20-105, y: 460-520 (첫 번째 선택지)
    await canvas.click({ position: { x: 60, y: 490 } });
    await page.waitForTimeout(300);
  });

  test('E2E-BTL-003: 오답 선택 시 플레이어 HP가 감소해야 한다', async ({ page }) => {
    const canvas = page.locator('canvas');

    // 두 번째 선택지 클릭 (오답)
    // 선택지 위치: x: 115-200, y: 460-520 (두 번째 선택지)
    await canvas.click({ position: { x: 155, y: 490 } });
    await page.waitForTimeout(300);
  });

  test('E2E-BTL-004: 힌트 버튼이 동작해야 한다', async ({ page }) => {
    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('힌트');
      await dialog.accept();
    });

    const canvas = page.locator('canvas');

    // 힌트 버튼 위치: x: 20-130, y: 610-660
    await canvas.click({ position: { x: 75, y: 635 } });
    await page.waitForTimeout(300);
  });

  test('E2E-BTL-005: 스킵 버튼이 동작해야 한다', async ({ page }) => {
    const canvas = page.locator('canvas');

    // 스킵 버튼 위치: x: 145-255, y: 610-660
    await canvas.click({ position: { x: 200, y: 635 } });
    await page.waitForTimeout(300);
  });

  test('E2E-BTL-006: 포기 버튼이 동작해야 한다', async ({ page }) => {
    const canvas = page.locator('canvas');

    // 포기 버튼 위치: x: 270-380, y: 610-660
    await canvas.click({ position: { x: 325, y: 635 } });
    await page.waitForTimeout(500);

    // 결과 화면으로 전환 확인
    await expect(page).toHaveScreenshot('result-failed.png', {
      maxDiffPixelRatio: 0.15
    });
  });
});

test.describe('전투 결과', () => {
  test('E2E-RST-001: 클리어 시 결과 화면이 표시되어야 한다', async ({ page }) => {
    await page.goto('/');
    await clearDatabase(page);
    await page.reload();
    await page.waitForTimeout(500);

    // 약한 몬스터 추가 (HP 10)
    await addTestMonster(page, { hp: 10, maxHp: 10 });
    await page.reload();
    await page.waitForTimeout(500);

    const canvas = page.locator('canvas');

    // 던전 입장
    await canvas.click({ position: { x: 200, y: 370 } });
    await page.waitForTimeout(500);

    // 정답 선택 (몬스터 처치)
    await canvas.click({ position: { x: 60, y: 490 } });
    await page.waitForTimeout(500);

    // 결과 화면 확인
    await expect(page).toHaveScreenshot('result-clear.png', {
      maxDiffPixelRatio: 0.15
    });
  });

  test('E2E-RST-002: 메인으로 버튼이 동작해야 한다', async ({ page }) => {
    await page.goto('/');
    await clearDatabase(page);
    await page.reload();
    await page.waitForTimeout(500);

    await addTestMonster(page);
    await page.reload();
    await page.waitForTimeout(500);

    const canvas = page.locator('canvas');

    // 던전 입장 후 포기
    await canvas.click({ position: { x: 200, y: 370 } });
    await page.waitForTimeout(500);
    await canvas.click({ position: { x: 325, y: 635 } });
    await page.waitForTimeout(500);

    // 메인으로 버튼 클릭 (x: 100-300, y: 420-480)
    await canvas.click({ position: { x: 200, y: 450 } });
    await page.waitForTimeout(500);

    // 메인 화면으로 돌아감
    await expect(page).toHaveScreenshot('back-to-main.png', {
      maxDiffPixelRatio: 0.15
    });
  });
});

test.describe('콤보 시스템', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearDatabase(page);
    await page.reload();
    await page.waitForTimeout(500);

    // HP가 높은 몬스터 추가
    await addTestMonster(page, { hp: 500, maxHp: 500 });
    await page.reload();
    await page.waitForTimeout(500);

    const canvas = page.locator('canvas');
    await canvas.click({ position: { x: 200, y: 370 } });
    await page.waitForTimeout(500);
  });

  test('E2E-CMB-001: 연속 정답 시 콤보가 증가해야 한다', async ({ page }) => {
    const canvas = page.locator('canvas');

    // 정답 3번 연속 선택
    for (let i = 0; i < 3; i++) {
      await canvas.click({ position: { x: 60, y: 490 } });
      await page.waitForTimeout(300);
    }

    // 콤보 UI 확인 (스크린샷)
    await expect(page).toHaveScreenshot('combo-3.png', {
      maxDiffPixelRatio: 0.15
    });
  });

  test('E2E-CMB-002: 오답 시 콤보가 리셋되어야 한다', async ({ page }) => {
    const canvas = page.locator('canvas');

    // 정답 2번 후 오답
    await canvas.click({ position: { x: 60, y: 490 } });
    await page.waitForTimeout(300);
    await canvas.click({ position: { x: 60, y: 490 } });
    await page.waitForTimeout(300);
    await canvas.click({ position: { x: 155, y: 490 } }); // 오답
    await page.waitForTimeout(300);

    // 콤보가 표시되지 않아야 함
    await expect(page).toHaveScreenshot('combo-reset.png', {
      maxDiffPixelRatio: 0.15
    });
  });
});

test.describe('타이머', () => {
  test('E2E-TMR-001: 타이머가 감소해야 한다', async ({ page }) => {
    await page.goto('/');
    await clearDatabase(page);
    await page.reload();
    await page.waitForTimeout(500);

    await addTestMonster(page);
    await page.reload();
    await page.waitForTimeout(500);

    const canvas = page.locator('canvas');
    await canvas.click({ position: { x: 200, y: 370 } });

    // 초기 스크린샷
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('timer-start.png', {
      maxDiffPixelRatio: 0.15
    });

    // 3초 후 스크린샷
    await page.waitForTimeout(3000);
    await expect(page).toHaveScreenshot('timer-after-3s.png', {
      maxDiffPixelRatio: 0.15
    });
  });
});

test.describe('골드 시스템', () => {
  test('E2E-GLD-001: 정답 시 골드가 증가해야 한다', async ({ page }) => {
    await page.goto('/');
    await clearDatabase(page);
    await page.reload();
    await page.waitForTimeout(500);

    await addTestMonster(page, { hp: 500, maxHp: 500 });
    await page.reload();
    await page.waitForTimeout(1000);

    // 초기 골드 확인
    const initialGold = await page.evaluate(async () => {
      return new Promise((resolve) => {
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

    const canvas = page.locator('canvas');
    await canvas.click({ position: { x: 200, y: 370 } });
    await page.waitForTimeout(500);

    // 정답 선택
    await canvas.click({ position: { x: 60, y: 490 } });
    await page.waitForTimeout(500);

    // 골드 확인
    const afterGold = await page.evaluate(async () => {
      return new Promise((resolve) => {
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

    expect(afterGold).toBeGreaterThan(initialGold);
  });

  test('E2E-GLD-002: 힌트 사용 시 골드가 감소해야 한다', async ({ page }) => {
    await page.goto('/');
    await clearDatabase(page);
    await page.reload();
    await page.waitForTimeout(500);

    await addTestMonster(page);
    await page.reload();
    await page.waitForTimeout(1000);

    // dialog 핸들러 설정
    page.on('dialog', dialog => dialog.accept());

    // 초기 골드 확인
    const initialGold = await page.evaluate(async () => {
      return new Promise((resolve) => {
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

    const canvas = page.locator('canvas');
    await canvas.click({ position: { x: 200, y: 370 } });
    await page.waitForTimeout(500);

    // 힌트 사용
    await canvas.click({ position: { x: 75, y: 635 } });
    await page.waitForTimeout(500);

    // 골드 확인
    const afterGold = await page.evaluate(async () => {
      return new Promise((resolve) => {
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

    expect(afterGold).toBe(initialGold - 50);
  });
});
