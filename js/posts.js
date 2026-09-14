// ==========================================
// نظام عرض المنشورات - 10 منشورات + تحميل المزيد
// ==========================================

// التنقل بين الأقسام
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const section = this.dataset.section;
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.getElementById(section + 'Section').classList.add('active');
        currentSection = section;
        
        if (section !== 'profile') {
            const container = document.getElementById(section + 'Container');
            if (!container || container.children.length === 0) {
                loadPosts(section);
            }
        }
    });
});

function getCollectionName(section) {
    switch(section) {
        case 'jobs': return 'jobPosts';
        case 'realestate': return 'realEstatePosts';
        case 'news': return 'newsPosts';
        default: return null;
    }
}

// تحميل المنشورات
async function loadPosts(section, loadMore = false) {
    const state = loadStates[section];
    if (!state || state.loading) return;
    
    state.loading = true;
    
    const collectionName = getCollectionName(section);
    if (!collectionName) return;

    const container = document.getElementById(section + 'Container');
    const loaderId = 'loader' + section.charAt(0).toUpperCase() + section.slice(1);
    const loaderEl = document.getElementById(loaderId);
    const btnId = 'loadMoreBtn' + section.charAt(0).toUpperCase() + section.slice(1);
    const btnEl = document.getElementById(btnId);

    if (loadMore) {
        if (loaderEl) loaderEl.style.display = 'block';
    }

    try {
        // بناء الاستعلام - 10 منشورات فقط
        let q = db.collection(collectionName)
            .orderBy('createdAt', 'desc')
            .limit(CONFIG.postsPerPage);

        if (loadMore && state.lastDoc) {
            q = q.startAfter(state.lastDoc);
        }

        const snapshot = await q.get();
        const posts = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.approved === true || data.publishedBy === 'admin' || data.approved === undefined) {
                posts.push({ id: doc.id, ...data });
            }
        });

        // إذا لم يكن تحميل المزيد - امسح الحاوية
        if (!loadMore) {
            container.innerHTML = '';
            
            // تحميل من الكاش أولاً
            const cachedPosts = await CacheDB.getAllPosts(section);
            const firstCached = cachedPosts.slice(0, CONFIG.postsPerPage);
            
            if (firstCached.length > 0 && posts.length === 0) {
                // عرض من الكاش فقط إذا فشل السيرفر
                firstCached.forEach(post => renderPostCard(post, container));
            }
        }

        // عرض المنشورات من السيرفر
        if (posts.length > 0) {
            if (!loadMore) {
                container.innerHTML = '';
                // حفظ في الكاش
                CacheDB.savePosts(posts, section).catch(() => {});
            }
            
            posts.forEach(post => renderPostCard(post, container));
        }

        // تحديث حالة التحميل
        state.lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
        state.hasMore = snapshot.docs.length === CONFIG.postsPerPage;

        // إظهار/إخفاء زر تحميل المزيد
        if (btnEl) {
            if (state.hasMore) {
                btnEl.style.display = 'block';
                btnEl.textContent = 'تحميل المزيد';
                btnEl.disabled = false;
            } else {
                btnEl.style.display = 'none';
            }
        }

        if (posts.length === 0 && container.children.length === 0) {
            container.innerHTML = '<p style="text-align:center;padding:40px;color:#999;">لا توجد منشورات حالياً</p>';
            if (btnEl) btnEl.style.display = 'none';
        }

    } catch (error) {
        console.error('خطأ في التحميل:', error);
        
        // عند الفشل - عرض من الكاش
        const cachedPosts = await CacheDB.getAllPosts(section);
        const firstCached = cachedPosts.slice(0, CONFIG.postsPerPage);
        
        if (firstCached.length > 0) {
            container.innerHTML = '';
            firstCached.forEach(post => renderPostCard(post, container));
        }
    } finally {
        state.loading = false;
        if (loaderEl) loaderEl.style.display = 'none';
    }
}

// عرض بطاقة منشور
function renderPostCard(post, container) {
    const card = document.createElement('div');
    card.className = 'post-card';
    card.dataset.postId = post.id;

    let mediaHTML = '';
    if (post.imageUrl && post.imageUrl.startsWith('data:image')) {
        mediaHTML = `<div class="post-media"><img src="${post.imageUrl}" alt="صورة" loading="lazy"></div>`;
    }

    let contactBtn = '';
    if (post.contactWhatsApp) {
        contactBtn = `<a href="https://wa.me/${post.contactWhatsApp}" target="_blank" class="contact-btn">تواصل واتساب</a>`;
    } else if (post.redirectUrl) {
        contactBtn = `<a href="${post.redirectUrl}" target="_blank" class="contact-btn">زيارة الموقع</a>`;
    }

    card.innerHTML = `
        <div class="post-header">
            <h3>${post.title || ''}</h3>
            ${post.isPinned ? '<span class="pinned-badge">📌 مثبت</span>' : ''}
        </div>
        ${mediaHTML}
        ${post.description ? `<div class="post-description">${post.description}</div>` : ''}
        ${post.price ? `<div class="post-price">السعر: ${post.price}</div>` : ''}
        ${post.location ? `<div class="post-location">📍 ${post.location}</div>` : ''}
        ${post.source ? `<div class="post-source">📰 المصدر: ${post.source}</div>` : ''}
        <div class="post-footer">
            ${contactBtn}
            <span class="post-date">${post.createdAt ? new Date(post.createdAt).toLocaleDateString('ar-SA') : ''}</span>
        </div>
    `;

    container.appendChild(card);
}

// أزرار تحميل المزيد - ربط مباشر
document.getElementById('loadMoreBtnJobs').onclick = function() {
    this.disabled = true;
    this.textContent = '⏳ جاري التحميل...';
    loadPosts('jobs', true).finally(() => {
        this.disabled = false;
        this.textContent = 'تحميل المزيد';
    });
};

document.getElementById('loadMoreBtnRealestate').onclick = function() {
    this.disabled = true;
    this.textContent = '⏳ جاري التحميل...';
    loadPosts('realestate', true).finally(() => {
        this.disabled = false;
        this.textContent = 'تحميل المزيد';
    });
};

document.getElementById('loadMoreBtnNews').onclick = function() {
    this.disabled = true;
    this.textContent = '⏳ جاري التحميل...';
    loadPosts('news', true).finally(() => {
        this.disabled = false;
        this.textContent = 'تحميل المزيد';
    });
};

// فتح قاعدة البيانات المحلية
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await CacheDB.open();
        console.log('✅ قاعدة البيانات المحلية جاهزة');
    } catch (e) {
        console.error('خطأ في قاعدة البيانات:', e);
    }
});