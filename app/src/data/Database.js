// IndexedDB 래퍼
export class Database {
  constructor() {
    this.db = null;
    this.DB_NAME = 'OdapHunterDB';
    this.DB_VERSION = 1;
  }

  async open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        this.db = request.result;
        console.log('📦 Database opened');
        resolve(this.db);
      };

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        this.createStores(db);
      };
    });
  }

  createStores(db) {
    // 플레이어
    if (!db.objectStoreNames.contains('player')) {
      db.createObjectStore('player', { keyPath: 'id' });
    }

    // 몬스터 (오답)
    if (!db.objectStoreNames.contains('monsters')) {
      const store = db.createObjectStore('monsters', {
        keyPath: 'id',
        autoIncrement: true
      });
      store.createIndex('subject', 'subject');
      store.createIndex('status', 'status');
      store.createIndex('createdAt', 'createdAt');
    }

    // 아이템
    if (!db.objectStoreNames.contains('items')) {
      db.createObjectStore('items', { keyPath: 'id' });
    }

    // 런 기록
    if (!db.objectStoreNames.contains('runs')) {
      const store = db.createObjectStore('runs', {
        keyPath: 'id',
        autoIncrement: true
      });
      store.createIndex('date', 'startTime');
    }
  }

  // 추가
  async add(storeName, data) {
    return this._transaction(storeName, 'readwrite', (store) => store.add(data));
  }

  // 조회
  async get(storeName, key) {
    return this._transaction(storeName, 'readonly', (store) => store.get(key));
  }

  // 전체 조회
  async getAll(storeName) {
    return this._transaction(storeName, 'readonly', (store) => store.getAll());
  }

  // 수정
  async put(storeName, data) {
    return this._transaction(storeName, 'readwrite', (store) => store.put(data));
  }

  // 삭제
  async delete(storeName, key) {
    return this._transaction(storeName, 'readwrite', (store) => store.delete(key));
  }

  // 인덱스로 조회
  async getByIndex(storeName, indexName, value) {
    return this._transaction(storeName, 'readonly', (store) => {
      const index = store.index(indexName);
      return index.getAll(value);
    });
  }

  // 트랜잭션 헬퍼
  _transaction(storeName, mode, callback) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const request = callback(store);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}
