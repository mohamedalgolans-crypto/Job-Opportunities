// app.js - التطبيق الرئيسي لتطبيق الجمهور
import AuthManager from './auth.js';
import Database from './database.js';
import CacheManager from './cache.js';
import NotificationSystem from './notifications.js';
import Router from './router.js';

class App {
    constructor() {
        try {
            this.authManager = new AuthManager();
            this.db = new Database(this.authManager.app);
            this.cache = new CacheManager();
            this.notifications = new NotificationSystem(this.authManager.app);
            this.router = new Router();
        } catch (err) {
            console.error('خطأ أثناء إنشاء الكائنات:', err);
        }
        
        this.currentUser = null;
        this.userData = null;
        
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
            // انتظار تهيئة الكاش إن وجد
            if (this.cache && typeof this.cache.init === 'function') {
                await this.cache.init().catch(e => console.warn('فشل تهيئة الكاش:', e));
            }
            
            // إعداد أزرار النشر السريع
            this.setupQuickPublishButtons();
            
            // مراقبة حالة المصادقة
            this.authManager.onAuthChange(async (user) => {
                if (user) {
                    this.currentUser = user;
                    
                    // إظهار الواجهة الرئيسية فوراً لتفادي الرجوع لشاشة الدخول
                    this.showMainApp();
                    
                    try {
                        await this.loadUserData();
                    } catch (e) {
                        console.error('فشل جلب بيانات المستخدم، متابعة التشغيل:', e);
                    }

                    if (this.router) {
                        this.router.navigateTo('jobs');
                    }
                    this.loadCurrentSection();
                    
                    // بدء الإشعارات بشكل آمن
                    if (this.notifications) {
                        try {
                            this.notifications.startListening((notifs) => {
                                notifs.forEach(n => {
                                    this.notifications.showToast(n.body || n.title, 'info');
                                    this.notifications.sendBrowserNotification(n.title, n.body);
                                });
                            });
                            await this.notifications.requestPermission().catch(() => {});
                        } catch (e) {
                            console.warn('تجاوز خطأ الإشعارات:', e);
                        }
                    }
                    
                    // تنظيف الكاش القديم
                    if (this.cache && typeof this.cache.clearOldCache === 'function') {
                        this.cache.clearOldCache().catch(() => {});
                    }
                } else {
                    this.showLoginScreen();
                }
            });

            // الاستماع لتغيير القسم
            document.addEventListener('routeChanged', () => {
                this.loadCurrentSection();
            });

            // إعداد زر تحميل المزيد
            document.getElementById('loadMoreBtn')?.addEventListener('click', () => {
                this.loadMorePosts();
            });

            // تهيئة أزرار التنقل
            if (this.router && typeof this.router.initNavigation === 'function') {
                this.router.initNavigation();
            }

        } catch (error) {
            console.error('خطأ في تهيئة التطبيق:', error);
        }
    }

    // تحميل بيانات المستخدم
    async loadUserData() {
        if (!this.currentUser) return;
        
        // محاولة التحميل من الكاش أولاً
        if (this.cache && typeof this.cache.getUserData === 'function') {
            try {
                const cachedData = await this.cache.getUserData(this.currentUser.uid);
                if (cachedData) {
                    this.userData = cachedData;
                    this.updateProfileUI();
                }
            } catch (e) {
                console.warn('خطأ كاش المستخدم:', e);
            }
        }

        // تحديث من السيرفر
        try {
            const freshData = await this.db.getUserData(this.currentUser.uid);
            if (freshData) {
                this.userData = freshData;
                if (this.cache && typeof this.cache.storeUserData === 'function') {
                    await this.cache.storeUserData(freshData).catch(() => {});
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
        const balanceEl = document.getElementById('profileBalance');

        if (nameEl) nameEl.textContent = this.userData.name || '';
        if (codeEl) codeEl.textContent = this.userData.userCode || this.userData.walletCode || '';
        if (balanceEl) balanceEl.textContent = this.userData.balance || 0;
    }

    // تحميل محتوى القسم الحالي
    async loadCurrentSection() {
        const route = this.router ? this.router.getCurrentRoute() : 'jobs';
        const state = this.loadStates[route];
        
        if (!state || state.loading) return;
        
        state.loading = true;
        this.showLoader();

        try {
            let collectionName;
            switch(route) {
                case 'jobs': collectionName = 'jobPosts'; break;
                case 'realestate': collectionName = 'realEstatePosts'; break;
                case 'news': collectionName = 'newsPosts'; break;
                default: collectionName = 'jobPosts'; break;
            }

            // محاولة التحميل من الكاش أولاً
            if (this.cache && typeof this.cache.getPosts === 'function') {
                const cachedPosts = await this.cache.getPosts(collectionName).catch(() => null);
                if (cachedPosts && cachedPosts.length > 0) {
                    this.renderPosts(cachedPosts, route);
                }
            }

            // التحميل من السيرفر
            const postsPerPage = typeof CONFIG !== 'undefined' ? CONFIG.postsPerPage : 10;
            const result = await this.db.getPosts(collectionName, null, postsPerPage);
            
            if (result && result.posts && result.posts.length > 0) {
                if (this.cache && typeof this.cache.storePosts === 'function') {
                    await this.cache.storePosts(result.posts, collectionName).catch(() => {});
                }
                
                this.renderPosts(result.posts, route);
                
                state.lastDoc = result.lastVisible;
                state.hasMore = result.hasMore;
            }

        } catch (error) {
            console.error('خطأ في تحميل المحتوى:', error);
            if (this.notifications) this.notifications.showToast('خطأ في تحميل المحتوى', 'error');
        } finally {
            state.loading = false;
            this.hideLoader();
            this.updateLoadMoreButton();
        }
    }

    // تحميل المزيد من المنشورات
    async loadMorePosts() {
        const route = this.router ? this.router.getCurrentRoute() : 'jobs';
        const state = this.loadStates[route];
        
        if (!state || !state.hasMore || state.loading) return;
        
        state.loading = true;
        this.showLoader();

        try {
            let collectionName;
            switch(route) {
                case 'jobs': collectionName = 'jobPosts'; break;
                case 'realestate': collectionName = 'realEstatePosts'; break;
                case 'news': collectionName = 'newsPosts'; break;
                default: return;
            }

            const postsPerPage = typeof CONFIG !== 'undefined' ? CONFIG.postsPerPage : 10;
            const result = await this.db.getPosts(collectionName, state.lastDoc, postsPerPage);
            
            if (result && result.posts && result.posts.length > 0) {
                if (this.cache && typeof this.cache.storePosts === 'function') {
                    await this.cache.storePosts(result.posts, collectionName).catch(() => {});
                }
                this.appendPosts(result.posts, route);
                
                state.lastDoc = result.lastVisible;
                state.hasMore = result.hasMore;
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

        const formattedDate = post.createdAt ? new Date(post.createdAt).toLocaleDateString('ar-SA') : '';

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
                <span class="post-date">${formattedDate}</span>
            </div>
        `;

        container.appendChild(card);
    }

    // عرض فتحة إعلان ممول
    renderAdSlot(container) {
        const adSlot = document.createElement('div');
        adSlot.className = 'ad-slot';
        adSlot.id = `ad-slot-${Date.now()}`;
        adSlot.innerHTML = '<div class="ad-placeholder">إعلان ممول</div>';
        container.appendChild(adSlot);
        
        this.loadSponsoredAd(adSlot.id);
    }

    // تحميل إعلان ممول
    async loadSponsoredAd(slotId) {
        try {
            const { getFirestore, collection, query, where, orderBy, limit, getDocs } = await import("https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js");
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
            if (typeof CONFIG !== 'undefined') window.open(CONFIG.getWhatsAppLink('السلام عليكم اريد نشر فرصة عمل'), '_blank');
        });

        document.getElementById('quickPublishNews')?.addEventListener('click', () => {
            if (typeof CONFIG !== 'undefined') window.open(CONFIG.getWhatsAppLink('السلام عليكم اريد نشر خبر'), '_blank');
        });

        document.getElementById('chargeBalanceBtn')?.addEventListener('click', () => {
            if (typeof CONFIG !== 'undefined') window.open(CONFIG.getWhatsAppLink('السلام عليكم اريد شحن رصيد في تطبيق فرص عمل ماهي طرق الدفع المتاحة'), '_blank');
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
        const dailyCost = typeof CONFIG !== 'undefined' ? CONFIG.dailyAdCost : 10;
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
                        <input type="number" id="adDuration" placeholder="عدد الأيام (${dailyCost} رصيد لليوم)" min="1" required>
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
            document.getElementById('adCost').textContent = days * dailyCost;
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
                if (this.notifications) this.notifications.showToast('تم إرسال الإعلان للمراجعة', 'success');
                document.getElementById('adFormModal').remove();
                await this.loadUserData();
            } catch (error) {
                if (this.notifications) this.notifications.showToast(error.message, 'error');
            }
        });
    }

    // عرض نموذج نشر عقار
    showPublishRealEstateForm() {
        const postCost = typeof CONFIG !== 'undefined' ? CONFIG.realEstatePostCost : 0;
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
                        <div class="cost-info">تكلفة النشر: ${postCost} رصيد</div>
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
                if (this.notifications) this.notifications.showToast('تم إرسال العقار للمراجعة', 'success');
                document.getElementById('realEstateFormModal').remove();
                await this.loadUserData();
            } catch (error) {
                if (this.notifications) this.notifications.showToast(error.message, 'error');
            }
        });
    }

    // عرض شاشة تسجيل الدخول
    showLoginScreen() {
        const loginEl = document.getElementById('loginScreen');
        const mainEl = document.getElementById('mainApp');
        if (loginEl) loginEl.style.display = 'flex';
        if (mainEl) mainEl.style.display = 'none';

        const googleBtn = document.getElementById('googleLoginBtn');
        if (googleBtn) {
            googleBtn.onclick = async () => {
                try {
                    await this.authManager.signInWithGoogle();
                } catch (error) {
                    if (this.notifications) {
                        this.notifications.showToast('فشل تسجيل الدخول: ' + error.message, 'error');
                    } else {
                        alert('فشل تسجيل الدخول: ' + error.message);
                    }
                }
            };
        }
    }

    // عرض التطبيق الرئيسي
    showMainApp() {
        const loginEl = document.getElementById('loginScreen');
        const mainEl = document.getElementById('mainApp');
        if (loginEl) loginEl.style.display = 'none';
        if (mainEl) mainEl.style.display = 'flex';
    }

    // عرض مؤشر التحميل
    showLoader() {
        const loader = document.getElementById('loader');
        if (loader) loader.style.display = 'block';
    }

    // إخفاء مؤشر التحميل
    hideLoader() {
        const loader = document.getElementById('loader');
        if (loader) loader.style.display = 'none';
    }

    // تحديث زر تحميل المزيد
    updateLoadMoreButton() {
        const route = this.router ? this.router.getCurrentRoute() : 'jobs';
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
