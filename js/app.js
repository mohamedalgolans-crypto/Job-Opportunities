// app.js - التطبيق الرئيسي لتطبيق الجمهور
import AuthManager from './auth.js';
import Database from './database.js';
import CacheManager from './cache.js';
import NotificationSystem from './notifications.js';
import Router from './router.js';

class App {
    constructor() {
        this.authManager = new AuthManager();
        this.db = new Database(this.authManager.app);
        this.cache = new CacheManager();
        this.notifications = new NotificationSystem(this.authManager.app);
        this.router = new Router();

        this.currentUser = null;
        this.userData = null;
        this.initialized = false;

        // حالة التحميل لكل قسم
        this.loadStates = {
            jobs: { lastDoc: null, hasMore: true, loading: false },
            realestate: { lastDoc: null, hasMore: true, loading: false },
            news: { lastDoc: null, hasMore: true, loading: false }
        };
    }

    // بدء التطبيق
    async init() {
        try {
            // انتظار تهيئة الكاش
            await this.cache.init();

            // إعداد أزرار النشر السريع
            this.setupQuickPublishButtons();

            // إعداد زر تسجيل الدخول مرة واحدة فقط
            this.setupLoginButton();

            // إعداد الأزرار العامة
            document.getElementById('loadMoreBtn')?.addEventListener('click', () => {
                this.loadMorePosts();
            });

            // الاستماع لتغيير القسم
            document.addEventListener('routeChanged', () => {
                this.loadCurrentSection();
            });

            // تهيئة أزرار التنقل
            try {
                this.router.initNavigation();
            } catch (e) {
                console.warn('فشل تهيئة التنقل:', e);
            }

            // مراقبة حالة المصادقة
            this.authManager.onAuthChange(async (user) => {
                await this.handleAuthChange(user);
            });

        } catch (error) {
            console.error('خطأ في تهيئة التطبيق:', error);
        }
    }

    // معالجة تغير حالة المصادقة
    async handleAuthChange(user) {
        console.log('AUTH CHANGE:', user ? user.uid : 'null');

        if (!user) {
            this.currentUser = null;
            this.userData = null;
            this.showLoginScreen();
            return;
        }

        // مستخدم جديد
        this.currentUser = user;

        // اعرض التطبيق أولاً حتى لا تظهر شاشة الدخول مؤقتاً
        this.showMainApp();

        // تحميل بيانات المستخدم
        try {
            await this.loadUserData();
        } catch (e) {
            console.error('فشل تحميل بيانات المستخدم:', e);
        }

        // الانتقال للقسم الافتراضي
        try {
            this.router.navigateTo('jobs');
        } catch (e) {
            console.warn('فشل التنقل للقسم الافتراضي:', e);
        }

        // تحميل محتوى القسم الحالي
        try {
            await this.loadCurrentSection();
        } catch (e) {
            console.error('فشل تحميل القسم:', e);
        }

        // بدء الإشعارات (منفصلة حتى لا تُسقط التطبيق)
        try {
            this.notifications.startListening((notifs) => {
                notifs.forEach(n => {
                    try {
                        this.notifications.showToast(n.body || n.title, 'info');
                        this.notifications.sendBrowserNotification(n.title, n.body);
                    } catch (e) {
                        console.warn('خطأ في عرض الإشعار:', e);
                    }
                });
            });
        } catch (e) {
            console.warn('startListening فشل:', e);
        }

        // طلب إذن الإشعارات
        try {
            await this.notifications.requestPermission();
        } catch (e) {
            console.warn('requestPermission فشل:', e);
        }

        // تنظيف الكاش القديم
        try {
            await this.cache.clearOldCache();
        } catch (e) {
            console.warn('clearOldCache فشل:', e);
        }
    }

    // إعداد زر تسجيل الدخول (مرة واحدة فقط)
    setupLoginButton() {
        const btn = document.getElementById('googleLoginBtn');
        if (!btn) return;

        // احذف أي listener قديم باستخدام onclick
        btn.onclick = async () => {
            try {
                btn.disabled = true;
                await this.authManager.signInWithGoogle();
            } catch (error) {
                console.error('فشل تسجيل الدخول:', error);
                const msg = error?.message || 'حدث خطأ غير معروف';
                try {
                    this.notifications.showToast('فشل تسجيل الدخول: ' + msg, 'error');
                } catch (_) {
                    alert('فشل تسجيل الدخول: ' + msg);
                }
            } finally {
                btn.disabled = false;
            }
        };
    }

    // تحميل بيانات المستخدم
    async loadUserData() {
        if (!this.currentUser) return;

        // محاولة التحميل من الكاش أولاً
        try {
            const cachedData = await this.cache.getUserData(this.currentUser.uid);
            if (cachedData) {
                this.userData = cachedData;
                this.updateProfileUI();
            }
        } catch (e) {
            console.warn('cache.getUserData فشل:', e);
        }

        // تحديث من السيرفر
        try {
            const freshData = await this.db.getUserData(this.currentUser.uid);
            if (freshData) {
                this.userData = freshData;
                try {
                    await this.cache.storeUserData(freshData);
                } catch (e) {
                    console.warn('cache.storeUserData فشل:', e);
                }
                this.updateProfileUI();
            }
        } catch (error) {
            console.error('خطأ في تحميل بيانات المستخدم من السيرفر:', error);
        }
    }

    // تحديث واجهة الملف الشخصي
    updateProfileUI() {
        if (!this.userData) return;

        const nameEl = document.getElementById('profileName');
        const codeEl = document.getElementById('profileCode');
        const balEl = document.getElementById('profileBalance');

        if (nameEl) nameEl.textContent = this.userData.name || '';
        if (codeEl) codeEl.textContent = this.userData.userCode || '';
        if (balEl) balEl.textContent = this.userData.balance || 0;
    }

    // الحصول على اسم المجموعة من اسم القسم
    getCollectionName(route) {
        switch (route) {
            case 'jobs': return 'jobPosts';
            case 'realestate': return 'realEstatePosts';
            case 'news': return 'newsPosts';
            default: return null;
        }
    }

    // تحميل محتوى القسم الحالي
    async loadCurrentSection() {
        const route = this.router.getCurrentRoute();
        const state = this.loadStates[route];

        if (!state) return;
        if (state.loading) return;

        const collectionName = this.getCollectionName(route);
        if (!collectionName) return;

        state.loading = true;
        this.showLoader();

        try {
            // محاولة التحميل من الكاش أولاً
            try {
                const cachedPosts = await this.cache.getPosts(collectionName);
                if (cachedPosts && cachedPosts.length > 0) {
                    this.renderPosts(cachedPosts, route);
                }
            } catch (e) {
                console.warn('cache.getPosts فشل:', e);
            }

            // التحميل من السيرفر
            const result = await this.db.getPosts(collectionName, null, CONFIG.postsPerPage);

            if (result && result.posts && result.posts.length > 0) {
                // تخزين في الكاش
                try {
                    await this.cache.storePosts(result.posts, collectionName);
                } catch (e) {
                    console.warn('cache.storePosts فشل:', e);
                }

                // عرض المنشورات
                this.renderPosts(result.posts, route);

                // تحديث حالة التحميل
                state.lastDoc = result.lastVisible;
                state.hasMore = result.hasMore;
            } else {
                state.hasMore = false;
            }

        } catch (error) {
            console.error('خطأ في تحميل المحتوى:', error);
            try {
                this.notifications.showToast('خطأ في تحميل المحتوى', 'error');
            } catch (_) {}
        } finally {
            state.loading = false;
            this.hideLoader();
            this.updateLoadMoreButton();
        }
    }

    // تحميل المزيد من المنشورات
    async loadMorePosts() {
        const route = this.router.getCurrentRoute();
        const state = this.loadStates[route];

        if (!state || !state.hasMore || state.loading) return;

        const collectionName = this.getCollectionName(route);
        if (!collectionName) return;

        state.loading = true;
        this.showLoader();

        try {
            const result = await this.db.getPosts(collectionName, state.lastDoc, CONFIG.postsPerPage);

            if (result && result.posts && result.posts.length > 0) {
                try {
                    await this.cache.storePosts(result.posts, collectionName);
                } catch (e) {
                    console.warn('cache.storePosts فشل:', e);
                }
                this.appendPosts(result.posts, route);

                state.lastDoc = result.lastVisible;
                state.hasMore = result.hasMore;
            } else {
                state.hasMore = false;
            }

        } catch (error) {
            console.error('خطأ في تحميل المزيد:', error);
        } finally {
            state.loading = false;
            this.hideLoader();
            this.updateLoadMoreButton();
        }
    }

    // عرض المنشورات
    renderPosts(posts, section) {
        const container = document.getElementById(`${section}Container`);
        if (!container) return;

        container.innerHTML = '';

        posts.forEach((post, index) => {
            if (index > 0 && index % 5 === 0) {
                this.renderAdSlot(container);
            }
            this.renderPostCard(post, container, section);
        });
    }

    // إضافة منشورات جديدة
    appendPosts(posts, section) {
        const container = document.getElementById(`${section}Container`);
        if (!container) return;

        posts.forEach((post, index) => {
            if (index > 0 && index % 5 === 0) {
                this.renderAdSlot(container);
            }
            this.renderPostCard(post, container, section);
        });
    }

    // عرض بطاقة منشور
    renderPostCard(post, container, section) {
        const card = document.createElement('div');
        card.className = 'post-card';

        let mediaContent = '';
        if (post.videoUrl) {
            mediaContent = `
                <video controls style="width:100%;max-height:300px;border-radius:8px;">
                    <source src="${post.videoUrl}" type="video/mp4">
                </video>`;
        } else if (post.imageUrl) {
            mediaContent = `<img src="${post.imageUrl}" alt="صورة" style="width:100%;max-height:300px;border-radius:8px;object-fit:cover;">`;
        }

        let contactButton = '';
        if (post.contactWhatsApp) {
            contactButton = `
                <a href="https://wa.me/${post.contactWhatsApp}" 
                   target="_blank" 
                   class="contact-btn">
                    تواصل واتساب
                </a>`;
        } else if (post.redirectUrl) {
            contactButton = `
                <a href="${post.redirectUrl}" 
                   target="_blank" 
                   class="contact-btn">
                    زيارة الموقع
                </a>`;
        }

        const createdAt = post.createdAt
            ? new Date(post.createdAt).toLocaleDateString('ar-SA')
            : '';

        card.innerHTML = `
            <div class="post-header">
                <h3>${post.title || ''}</h3>
                ${post.isPinned ? '<span class="pinned-badge">📌 مثبت</span>' : ''}
            </div>
            ${mediaContent}
            <div class="post-description">${post.description || ''}</div>
            ${post.price ? `<div class="post-price">السعر: ${post.price}</div>` : ''}
            ${post.location ? `<div class="post-location">📍 ${post.location}</div>` : ''}
            ${post.area ? `<div class="post-area">📐 المساحة: ${post.area}</div>` : ''}
            ${post.source ? `<div class="post-source">📰 المصدر: ${post.source}</div>` : ''}
            <div class="post-footer">
                ${contactButton}
                <span class="post-date">${createdAt}</span>
            </div>
        `;

        container.appendChild(card);
    }

    // عرض فتحة إعلان ممول
    renderAdSlot(container) {
        const adSlot = document.createElement('div');
        adSlot.className = 'ad-slot';
        adSlot.id = `ad-slot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        adSlot.innerHTML = '<div class="ad-placeholder">إعلان ممول</div>';
        container.appendChild(adSlot);

        this.loadSponsoredAd(adSlot.id);
    }

    // تحميل إعلان ممول
    async loadSponsoredAd(slotId) {
        try {
            const { getFirestore, collection, query, where, orderBy, limit, getDocs } =
                await import("https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js");
            const db = getFirestore(this.authManager.app);

            const q = query(
                collection(db, "ads"),
                where("approved", "==", true),
                where("status", "==", "approved"),
                orderBy("createdAt", "desc"),
                limit(1)
            );

            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                const ad = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
                const slot = document.getElementById(slotId);
                if (slot) {
                    slot.innerHTML = this.createAdContent(ad);
                }
            }
        } catch (error) {
            console.error('خطأ في تحميل الإعلان:', error);
        }
    }

    // إنشاء محتوى الإعلان
    createAdContent(ad) {
        let mediaContent = '';
        if (ad.videoUrl) {
            mediaContent = `<video controls style="width:100%;max-height:200px;"><source src="${ad.videoUrl}" type="video/mp4"></video>`;
        } else if (ad.imageUrl) {
            mediaContent = `<img src="${ad.imageUrl}" alt="إعلان" style="width:100%;max-height:200px;object-fit:cover;">`;
        }

        return `
            <div class="ad-content" style="border:2px solid #1a237e;padding:10px;border-radius:8px;background:#f5f5f5;">
                <span class="ad-label">إعلان ممول</span>
                ${mediaContent}
                <p>${ad.description || ''}</p>
                ${ad.redirectUrl ? `<a href="${ad.redirectUrl}" target="_blank" class="contact-btn" style="display:inline-block;margin-top:8px;">معرفة المزيد</a>` : ''}
                ${ad.contactWhatsApp ? `<a href="https://wa.me/${ad.contactWhatsApp}" target="_blank" class="contact-btn" style="display:inline-block;margin-top:8px;">تواصل واتساب</a>` : ''}
            </div>
        `;
    }

    // إعداد أزرار النشر السريع
    setupQuickPublishButtons() {
        document.getElementById('quickPublishJob')?.addEventListener('click', () => {
            window.open(CONFIG.getWhatsAppLink('السلام عليكم اريد نشر فرصة عمل'), '_blank');
        });

        document.getElementById('quickPublishNews')?.addEventListener('click', () => {
            window.open(CONFIG.getWhatsAppLink('السلام عليكم اريد نشر خبر'), '_blank');
        });

        document.getElementById('chargeBalanceBtn')?.addEventListener('click', () => {
            window.open(CONFIG.getWhatsAppLink('السلام عليكم اريد شحن رصيد في تطبيق فرص عمل ماهي طرق الدفع المتاحة'), '_blank');
        });

        document.getElementById('publishAdBtn')?.addEventListener('click', () => {
            this.showPublishAdForm();
        });

        document.getElementById('publishRealEstateBtn')?.addEventListener('click', () => {
            this.showPublishRealEstateForm();
        });
    }

    // عرض نموذج نشر إعلان ممول
    showPublishAdForm() {
        if (document.getElementById('adFormModal')) return;

        const formHTML = `
            <div id="adFormModal" class="modal">
                <div class="modal-content">
                    <h2>نشر إعلان ممول</h2>
                    <form id="adForm">
                        <input type="text" id="adOwnerName" placeholder="اسم صاحب الإعلان" required>
                        <input type="tel" id="adPhone" placeholder="رقم الهاتف">
                        <input type="url" id="adRedirectUrl" placeholder="رابط التوجيه (اختياري)">
                        <select id="adTargetSection">
                            <option value="all">جميع الأقسام</option>
                            <option value="jobs">فرص عمل فقط</option>
                            <option value="realestate">عقارات فقط</option>
                            <option value="news">أخبار فقط</option>
                        </select>
                        <textarea id="adDescription" placeholder="وصف الإعلان" rows="3" required></textarea>
                        <input type="number" id="adDuration" placeholder="عدد الأيام (10 رصيد لليوم)" min="1" required>
                        <div class="cost-preview">التكلفة: <span id="adCost">0</span> رصيد</div>
                        <div class="form-buttons">
                            <button type="submit" class="btn-primary">نشر (في انتظار الموافقة)</button>
                            <button type="button" class="btn-secondary" onclick="document.getElementById('adFormModal').remove()">إلغاء</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', formHTML);

        document.getElementById('adDuration').addEventListener('input', (e) => {
            const days = parseInt(e.target.value) || 0;
            document.getElementById('adCost').textContent = days * CONFIG.dailyAdCost;
        });

        document.getElementById('adForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const adData = {
                ownerName: document.getElementById('adOwnerName').value,
                phone: document.getElementById('adPhone').value,
                redirectUrl: document.getElementById('adRedirectUrl').value,
                targetSection: document.getElementById('adTargetSection').value,
                description: document.getElementById('adDescription').value
            };
            const duration = parseInt(document.getElementById('adDuration').value);

            try {
                await this.db.publishAd(this.currentUser.uid, adData, duration);
                this.notifications.showToast('تم إرسال الإعلان للمراجعة', 'success');
                document.getElementById('adFormModal').remove();
                await this.loadUserData();
            } catch (error) {
                this.notifications.showToast(error.message, 'error');
            }
        });
    }

    // عرض نموذج نشر عقار
    showPublishRealEstateForm() {
        if (document.getElementById('realEstateFormModal')) return;

        const formHTML = `
            <div id="realEstateFormModal" class="modal">
                <div class="modal-content">
                    <h2>نشر عقار</h2>
                    <form id="realEstateForm">
                        <input type="text" id="reTitle" placeholder="عنوان العقار" required>
                        <select id="reType">
                            <option value="sale">للبيع</option>
                            <option value="rent">للإيجار</option>
                        </select>
                        <select id="reCategory">
                            <option value="house">بيت</option>
                            <option value="apartment">شقة</option>
                            <option value="shop">محل</option>
                            <option value="land">أرض</option>
                        </select>
                        <input type="text" id="reLocation" placeholder="الموقع">
                        <input type="text" id="reArea" placeholder="المساحة">
                        <input type="text" id="rePrice" placeholder="السعر">
                        <input type="tel" id="reContactWhatsApp" placeholder="رقم الواتساب للتواصل">
                        <textarea id="reDescription" placeholder="وصف العقار" rows="3"></textarea>
                        <div class="cost-info">تكلفة النشر: ${CONFIG.realEstatePostCost} رصيد</div>
                        <div class="form-buttons">
                            <button type="submit" class="btn-primary">نشر (في انتظار الموافقة)</button>
                            <button type="button" class="btn-secondary" onclick="document.getElementById('realEstateFormModal').remove()">إلغاء</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', formHTML);

        document.getElementById('realEstateForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                title: document.getElementById('reTitle').value,
                type: document.getElementById('reType').value,
                category: document.getElementById('reCategory').value,
                location: document.getElementById('reLocation').value,
                area: document.getElementById('reArea').value,
                price: document.getElementById('rePrice').value,
                contactWhatsApp: document.getElementById('reContactWhatsApp').value,
                description: document.getElementById('reDescription').value
            };

            try {
                await this.db.publishRealEstate(this.currentUser.uid, data);
                this.notifications.showToast('تم إرسال العقار للمراجعة', 'success');
                document.getElementById('realEstateFormModal').remove();
                await this.loadUserData();
            } catch (error) {
                this.notifications.showToast(error.message, 'error');
            }
        });
    }

    // عرض شاشة تسجيل الدخول
    showLoginScreen() {
        const loginScreen = document.getElementById('loginScreen');
        const mainApp = document.getElementById('mainApp');
        if (loginScreen) loginScreen.style.display = 'flex';
        if (mainApp) mainApp.style.display = 'none';
    }

    // عرض التطبيق الرئيسي
    showMainApp() {
        const loginScreen = document.getElementById('loginScreen');
        const mainApp = document.getElementById('mainApp');
        if (loginScreen) loginScreen.style.display = 'none';
        if (mainApp) mainApp.style.display = 'flex';
    }

    // عرض مؤشر التحميل
    showLoader() {
        const el = document.getElementById('loader');
        if (el) el.style.display = 'block';
    }

    // إخفاء مؤشر التحميل
    hideLoader() {
        const el = document.getElementById('loader');
        if (el) el.style.display = 'none';
    }

    // تحديث زر تحميل المزيد
    updateLoadMoreButton() {
        const route = this.router.getCurrentRoute();
        const state = this.loadStates[route];
        const btn = document.getElementById('loadMoreBtn');

        if (btn) {
            btn.style.display = state?.hasMore ? 'block' : 'none';
        }
    }
}

// بدء التطبيق عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});
