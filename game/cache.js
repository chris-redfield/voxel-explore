// ============================================================
// IndexedDB Cave Cache
// ============================================================

const CaveCache = {
    DB_NAME: 'SeaCavesCache',
    DB_VERSION: 1,
    STORE_NAME: 'caveTemplates',
    NUM_CAVES: 5,

    async open() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
                }
            };
        });
    },

    async getCaveCount() {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.STORE_NAME, 'readonly');
            const store = tx.objectStore(this.STORE_NAME);
            const request = store.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async saveCave(id, voxels) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.STORE_NAME, 'readwrite');
            const store = tx.objectStore(this.STORE_NAME);
            const request = store.put({ id, voxels });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    async getCave(id) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.STORE_NAME, 'readonly');
            const store = tx.objectStore(this.STORE_NAME);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result?.voxels || null);
            request.onerror = () => reject(request.error);
        });
    },

    async getRandomCave() {
        const count = await this.getCaveCount();
        if (count === 0) return null;
        const id = Math.floor(Math.random() * count);
        return this.getCave(id);
    },

    async clearAll() {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.STORE_NAME, 'readwrite');
            const store = tx.objectStore(this.STORE_NAME);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
};
