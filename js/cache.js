// cache.js - نظام تخزين مؤقت قوي طويل الأمد
class CacheManager {
    constructor() {
        this.dbName = 'FarsamlDB';
        this.dbVersion = 1;
        this.db = null;
        this.init();
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // إنشاء مخازن البيانات
                if (!db.objectStoreNames.contains('posts')) {
                    const postsStore = db.createObjectStore('posts', { keyPath: 'id' });
                    postsStore.createIndex('category', 'category', { unique: false });
                    postsStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                if (!db.objectStoreNames.contains('userData')) {
                    db.createObjectStore('userData', { keyPath: 'uid' });
                }

                if (!db.objectStoreNames.contains('lastSync')) {
                    db.createObjectStore('lastSync', { keyPath: 'category' });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error('خطأ في تهيئة IndexedDB:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    // تخزين المنشورات
    async storePosts(posts, category) {
        const tx = this.db.transaction('posts', 'readwrite');
        const store = tx.objectStore('posts');

        for (const post of posts) {
            await store.put({ ...post, category, timestamp: Date.now() });
        }

        // تحديث وقت المزامنة
        const syncTx = this.db.transaction('lastSync', 'readwrite');
        const syncStore = syncTx.objectStore('lastSync');
        await syncStore.put({ category, lastSync: Date.now() });
    }

    // استرداد المنشورات من الكاش
    async getPosts(category) {
        return new Promise((resolve) => {
            const tx = this.db.transaction('posts', 'readonly');
            const store = tx.objectStore('posts');
            const index = store.index('category');
            const request = index.getAll(category);
            
            request.onsuccess = () => {
                // ترتيب تنازلي حسب التوقيت
                const sorted = (request.result || []).sort((a, b) => b.timestamp - a.timestamp);
                resolve(sorted);
            };
        });
    }

    // تخزين بيانات المستخدم
    async storeUserData(userData) {
        const tx = this.db.transaction('userData', 'readwrite');
        const store = tx.objectStore('userData');
        await store.put(userData);
    }

    // استرداد بيانات المستخدم
    async getUserData(uid) {
        return new Promise((resolve) => {
            const tx = this.db.transaction('userData', 'readonly');
            const store = tx.objectStore('userData');
            const request = store.get(uid);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
        });
    }

    // مسح الكاش القديم (أكثر من 7 أيام)
    async clearOldCache() {
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const tx = this.db.transaction('posts', 'readwrite');
        const store = tx.objectStore('posts');
        const index = store.index('timestamp');
        const range = IDBKeyRange.upperBound(sevenDaysAgo);
        
        const request = index.openCursor(range);
        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                store.delete(cursor.primaryKey);
                cursor.continue();
            }
        };
    }
}

export default CacheManager;