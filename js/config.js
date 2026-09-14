// ==========================================
// الإعدادات العامة للمشروع
// ==========================================

// تهيئة Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDk120B6zrzE1CRB4NZth6_Y-fMUXF3Np4",
    authDomain: "farsaml.firebaseapp.com",
    projectId: "farsaml",
    storageBucket: "farsaml.firebasestorage.app",
    messagingSenderId: "100868423567",
    appId: "1:100868423567:web:939c392225dee0d2db95fa"
};

firebase.initializeApp(firebaseConfig);

// الخدمات
const auth = firebase.auth();
const db = firebase.firestore();

// إعدادات التطبيق
const CONFIG = {
    adminWhatsApp: "963939286382",
    postsPerPage: 10,
    dailyAdCost: 10,
    realEstatePostCost: 5,
    maxImageSize: 500000
};

// متغيرات عامة
let currentUser = null;
let userData = null;
let currentSection = 'jobs';
let loadStates = {
    jobs: { lastDoc: null, hasMore: true, loading: false, loadedAll: false },
    realestate: { lastDoc: null, hasMore: true, loading: false, loadedAll: false },
    news: { lastDoc: null, hasMore: true, loading: false, loadedAll: false }
};

// ==========================================
// نظام الكاش الدائم IndexedDB
// ==========================================
const CacheDB = {
    dbName: 'FarsamlCacheDB',
    dbVersion: 1,
    db: null,

    async open() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('posts')) {
                    const postsStore = db.createObjectStore('posts', { keyPath: 'id' });
                    postsStore.createIndex('section', 'section', { unique: false });
                    postsStore.createIndex('createdAt', 'createdAt', { unique: false });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    },

    async savePosts(posts, section) {
        if (!this.db) await this.open();
        return new Promise((resolve) => {
            const tx = this.db.transaction('posts', 'readwrite');
            const store = tx.objectStore('posts');
            posts.forEach(post => {
                store.put({ ...post, section: section, cachedAt: Date.now() });
            });
            tx.oncomplete = () => resolve();
        });
    },

    async getAllPosts(section) {
        if (!this.db) await this.open();
        return new Promise((resolve) => {
            const tx = this.db.transaction('posts', 'readonly');
            const store = tx.objectStore('posts');
            const index = store.index('section');
            const request = index.getAll(section);
            request.onsuccess = () => {
                const posts = request.result || [];
                posts.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
                resolve(posts);
            };
            request.onerror = () => resolve([]);
        });
    },

    async getLatestDate(section) {
        const posts = await this.getAllPosts(section);
        if (posts.length === 0) return null;
        return posts[0].createdAt || null;
    }
};

// دالة إظهار رسالة
function showToast(message, type = 'error') {
    const toast = document.createElement('div');
    toast.className = type === 'error' ? 'error-toast' : 'success-toast';
    toast.textContent = (type === 'error' ? '❌ ' : '✅ ') + message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3000);
}

// توليد كود محفظة
function generateWalletCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'FA-';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// تحويل صورة إلى Base64
function imageToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject('خطأ في قراءة الصورة');
        reader.readAsDataURL(file);
    });
}

// ضغط الصورة
async function compressImage(file, maxWidth = 600, quality = 0.5) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => reject('خطأ في الصورة');
        img.src = URL.createObjectURL(file);
    });
}

async function uploadImageAsBase64(file) {
    if (!file) return null;
    try {
        if (file.size > 300000) {
            return await compressImage(file);
        }
        return await imageToBase64(file);
    } catch (e) {
        return null;
    }
}