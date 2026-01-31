// Database.js 단위 테스트
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../../../src/data/Database.js';

describe('Database', () => {
  let db;

  beforeEach(async () => {
    db = new Database();
    await db.open();
  });

  afterEach(async () => {
    if (db && db.db) {
      db.db.close();
      // DB 삭제
      await new Promise((resolve) => {
        const req = indexedDB.deleteDatabase(db.DB_NAME);
        req.onsuccess = resolve;
        req.onerror = resolve;
      });
    }
  });

  describe('초기화', () => {
    it('DB-INIT-001: 데이터베이스가 정상적으로 열려야 한다', async () => {
      expect(db.db).not.toBeNull();
      expect(db.db.name).toBe('OdapHunterDB');
    });

    it('DB-INIT-002: 필요한 모든 스토어가 생성되어야 한다', async () => {
      const storeNames = Array.from(db.db.objectStoreNames);
      expect(storeNames).toContain('player');
      expect(storeNames).toContain('monsters');
      expect(storeNames).toContain('items');
      expect(storeNames).toContain('runs');
    });

    it('DB-INIT-003: monsters 스토어에 인덱스가 생성되어야 한다', async () => {
      const tx = db.db.transaction('monsters', 'readonly');
      const store = tx.objectStore('monsters');
      expect(store.indexNames).toContain('subject');
      expect(store.indexNames).toContain('status');
      expect(store.indexNames).toContain('createdAt');
    });

    it('DB-INIT-004: runs 스토어에 date 인덱스가 생성되어야 한다', async () => {
      const tx = db.db.transaction('runs', 'readonly');
      const store = tx.objectStore('runs');
      expect(store.indexNames).toContain('date');
    });
  });

  describe('CRUD 작업', () => {
    describe('추가 (add)', () => {
      it('DB-ADD-001: 플레이어 데이터를 추가할 수 있어야 한다', async () => {
        const player = { id: 'player1', name: '테스트유저', level: 1 };
        await db.add('player', player);

        const result = await db.get('player', 'player1');
        expect(result).toEqual(player);
      });

      it('DB-ADD-002: 몬스터 데이터를 추가할 수 있어야 한다', async () => {
        const monster = {
          subject: '수학',
          question: '1+1=?',
          answer: '2',
          status: 'active',
          createdAt: new Date()
        };
        const id = await db.add('monsters', monster);

        expect(id).toBeDefined();
        expect(typeof id).toBe('number');
      });

      it('DB-ADD-003: 아이템 데이터를 추가할 수 있어야 한다', async () => {
        const item = { id: 'item1', name: '포션', type: 'consumable', rarity: 'common' };
        await db.add('items', item);

        const result = await db.get('items', 'item1');
        expect(result.name).toBe('포션');
      });

      it('DB-ADD-004: 런 기록을 추가할 수 있어야 한다', async () => {
        const run = {
          startTime: new Date(),
          floor: 5,
          score: 1000,
          defeated: 10
        };
        const id = await db.add('runs', run);

        expect(id).toBeDefined();
      });
    });

    describe('조회 (get/getAll)', () => {
      it('DB-GET-001: 단일 레코드를 조회할 수 있어야 한다', async () => {
        const player = { id: 'player1', name: '테스트유저' };
        await db.add('player', player);

        const result = await db.get('player', 'player1');
        expect(result).toEqual(player);
      });

      it('DB-GET-002: 존재하지 않는 레코드 조회시 undefined를 반환해야 한다', async () => {
        const result = await db.get('player', 'nonexistent');
        expect(result).toBeUndefined();
      });

      it('DB-GET-003: 전체 레코드를 조회할 수 있어야 한다', async () => {
        await db.add('items', { id: 'item1', name: '아이템1' });
        await db.add('items', { id: 'item2', name: '아이템2' });
        await db.add('items', { id: 'item3', name: '아이템3' });

        const results = await db.getAll('items');
        expect(results.length).toBe(3);
      });

      it('DB-GET-004: 빈 스토어에서 getAll은 빈 배열을 반환해야 한다', async () => {
        const results = await db.getAll('items');
        expect(results).toEqual([]);
      });
    });

    describe('수정 (put)', () => {
      it('DB-PUT-001: 기존 레코드를 수정할 수 있어야 한다', async () => {
        await db.add('player', { id: 'player1', name: '원래이름', level: 1 });
        await db.put('player', { id: 'player1', name: '수정된이름', level: 5 });

        const result = await db.get('player', 'player1');
        expect(result.name).toBe('수정된이름');
        expect(result.level).toBe(5);
      });

      it('DB-PUT-002: 존재하지 않는 레코드에 put하면 새로 생성되어야 한다', async () => {
        await db.put('player', { id: 'newplayer', name: '새플레이어' });

        const result = await db.get('player', 'newplayer');
        expect(result.name).toBe('새플레이어');
      });
    });

    describe('삭제 (delete)', () => {
      it('DB-DEL-001: 레코드를 삭제할 수 있어야 한다', async () => {
        await db.add('items', { id: 'item1', name: '삭제할아이템' });
        await db.delete('items', 'item1');

        const result = await db.get('items', 'item1');
        expect(result).toBeUndefined();
      });

      it('DB-DEL-002: 존재하지 않는 레코드 삭제도 에러 없이 처리되어야 한다', async () => {
        await expect(db.delete('items', 'nonexistent')).resolves.not.toThrow();
      });
    });

    describe('인덱스 조회 (getByIndex)', () => {
      beforeEach(async () => {
        await db.add('monsters', { subject: '수학', question: 'Q1', status: 'active', createdAt: new Date() });
        await db.add('monsters', { subject: '수학', question: 'Q2', status: 'active', createdAt: new Date() });
        await db.add('monsters', { subject: '영어', question: 'Q3', status: 'defeated', createdAt: new Date() });
      });

      it('DB-IDX-001: subject 인덱스로 몬스터를 조회할 수 있어야 한다', async () => {
        const mathMonsters = await db.getByIndex('monsters', 'subject', '수학');
        expect(mathMonsters.length).toBe(2);
      });

      it('DB-IDX-002: status 인덱스로 몬스터를 조회할 수 있어야 한다', async () => {
        const activeMonsters = await db.getByIndex('monsters', 'status', 'active');
        expect(activeMonsters.length).toBe(2);
      });

      it('DB-IDX-003: 매칭되는 레코드가 없으면 빈 배열을 반환해야 한다', async () => {
        const result = await db.getByIndex('monsters', 'subject', '과학');
        expect(result).toEqual([]);
      });
    });
  });

  describe('에러 처리', () => {
    it('DB-ERR-001: 존재하지 않는 스토어 접근 시 에러가 발생해야 한다', async () => {
      await expect(db.get('nonexistent', 'key')).rejects.toThrow();
    });

    it('DB-ERR-002: 존재하지 않는 인덱스 접근 시 에러가 발생해야 한다', async () => {
      await expect(db.getByIndex('monsters', 'nonexistent', 'value')).rejects.toThrow();
    });
  });

  describe('대용량 데이터', () => {
    it('DB-BULK-001: 100개의 레코드를 저장하고 조회할 수 있어야 한다', async () => {
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(db.add('monsters', {
          subject: '수학',
          question: `문제 ${i}`,
          status: 'active',
          createdAt: new Date()
        }));
      }
      await Promise.all(promises);

      const all = await db.getAll('monsters');
      expect(all.length).toBe(100);
    });
  });
});
