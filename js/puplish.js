// ==========================================
// نظام النشر - أزرار سريعة الاستجابة
// ==========================================

// زر نشر فرصة عمل
document.getElementById('quickPublishJob').onclick = function() {
    const link = `https://wa.me/${CONFIG.adminWhatsApp}?text=${encodeURIComponent('السلام عليكم اريد نشر فرصة عمل')}`;
    window.open(link, '_blank');
};

// زر نشر خبر
document.getElementById('quickPublishNews').onclick = function() {
    const link = `https://wa.me/${CONFIG.adminWhatsApp}?text=${encodeURIComponent('السلام عليكم اريد نشر خبر')}`;
    window.open(link, '_blank');
};

// زر شحن رصيد
document.getElementById('chargeBalanceBtn').onclick = function() {
    const walletCode = userData?.walletCode || userData?.userCode || '';
    const link = `https://wa.me/${CONFIG.adminWhatsApp}?text=${encodeURIComponent('السلام عليكم اريد شحن رصيد - كود المحفظة: ' + walletCode)}`;
    window.open(link, '_blank');
};

// زر نشر إعلان ممول
document.getElementById('publishAdBtn').onclick = function() {
    const cost = CONFIG.dailyAdCost;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h2>نشر إعلان ممول</h2>
            <input type="text" id="adOwnerName" placeholder="اسم صاحب الإعلان" required>
            <input type="tel" id="adPhone" placeholder="رقم الهاتف">
            <input type="url" id="adRedirectUrl" placeholder="رابط التوجيه">
            <textarea id="adDescription" placeholder="وصف الإعلان" rows="3" required></textarea>
            <label>صورة (اختياري):</label>
            <input type="file" id="adImage" accept="image/*">
            <input type="number" id="adDuration" placeholder="عدد الأيام (10 رصيد لليوم)" min="1" required>
            <div class="cost-info">التكلفة: <span id="adCost">0</span> رصيد</div>
            <div class="form-buttons">
                <button class="btn-primary" id="submitAdBtn">نشر</button>
                <button class="btn-secondary" id="cancelAdBtn">إلغاء</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('adDuration').oninput = function() {
        document.getElementById('adCost').textContent = (parseInt(this.value) || 0) * CONFIG.dailyAdCost;
    };

    document.getElementById('cancelAdBtn').onclick = function() {
        modal.remove();
    };

    document.getElementById('submitAdBtn').onclick = async function() {
        const durationDays = parseInt(document.getElementById('adDuration').value) || 0;
        const costTotal = durationDays * CONFIG.dailyAdCost;
        
        if ((userData?.balance || 0) < costTotal) {
            showToast('رصيد غير كافي');
            return;
        }

        this.disabled = true;
        this.textContent = '⏳...';

        try {
            const imageFile = document.getElementById('adImage').files[0];
            const imageBase64 = await uploadImageAsBase64(imageFile);

            await db.collection('users').doc(currentUser.uid).update({
                balance: firebase.firestore.FieldValue.increment(-costTotal)
            });

            await db.collection('ads').add({
                ownerName: document.getElementById('adOwnerName').value,
                phone: document.getElementById('adPhone').value,
                redirectUrl: document.getElementById('adRedirectUrl').value,
                description: document.getElementById('adDescription').value,
                imageUrl: imageBase64 || '',
                durationDays: durationDays,
                cost: costTotal,
                userId: currentUser.uid,
                status: 'pending',
                approved: false,
                publishedBy: 'user',
                createdAt: new Date().toISOString()
            });

            modal.remove();
            const snap = await db.collection('users').doc(currentUser.uid).get();
            userData = snap.data();
            loadUserProfile();
            showToast('تم إرسال الإعلان للمراجعة', 'success');

        } catch (e) {
            showToast(e.message || 'حدث خطأ');
            this.disabled = false;
            this.textContent = 'نشر';
        }
    };
};

// زر نشر عقار
document.getElementById('publishRealEstateBtn').onclick = function() {
    const cost = CONFIG.realEstatePostCost;
    
    if ((userData?.balance || 0) < cost) {
        showToast('رصيد غير كافي');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h2>نشر عقار</h2>
            <input type="text" id="reTitle" placeholder="عنوان العقار" required>
            <select id="reType"><option value="sale">للبيع</option><option value="rent">للإيجار</option></select>
            <input type="text" id="reLocation" placeholder="الموقع">
            <input type="text" id="rePrice" placeholder="السعر">
            <input type="tel" id="reContactWhatsApp" placeholder="واتساب">
            <textarea id="reDescription" placeholder="وصف العقار" rows="3"></textarea>
            <label>صورة (اختياري):</label>
            <input type="file" id="reImage" accept="image/*">
            <div class="cost-info">تكلفة النشر: ${cost} رصيد</div>
            <div class="form-buttons">
                <button class="btn-primary" id="submitREBtn">نشر</button>
                <button class="btn-secondary" id="cancelREBtn">إلغاء</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('cancelREBtn').onclick = function() {
        modal.remove();
    };

    document.getElementById('submitREBtn').onclick = async function() {
        this.disabled = true;
        this.textContent = '⏳...';

        try {
            const imageFile = document.getElementById('reImage').files[0];
            const imageBase64 = await uploadImageAsBase64(imageFile);

            await db.collection('users').doc(currentUser.uid).update({
                balance: firebase.firestore.FieldValue.increment(-cost)
            });

            await db.collection('realEstatePosts').add({
                title: document.getElementById('reTitle').value,
                type: document.getElementById('reType').value,
                location: document.getElementById('reLocation').value,
                price: document.getElementById('rePrice').value,
                contactWhatsApp: document.getElementById('reContactWhatsApp').value,
                description: document.getElementById('reDescription').value,
                imageUrl: imageBase64 || '',
                userId: currentUser.uid,
                status: 'pending',
                approved: false,
                publishedBy: 'user',
                createdAt: new Date().toISOString()
            });

            modal.remove();
            const snap = await db.collection('users').doc(currentUser.uid).get();
            userData = snap.data();
            loadUserProfile();
            showToast('تم إرسال العقار للمراجعة', 'success');

        } catch (e) {
            showToast(e.message || 'حدث خطأ');
            this.disabled = false;
            this.textContent = 'نشر';
        }
    };
};