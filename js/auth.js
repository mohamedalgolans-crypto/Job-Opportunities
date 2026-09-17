// ==========================================
// نظام المصادقة وتسجيل الدخول (النسخة المحدثة)
// ==========================================

// التأكد من تعريف المتغيرات في النطاق العام
let currentUser = null;
let userData = null;

auth.onAuthStateChanged(async (user) => {
    const loadingScreen = document.getElementById('loadingScreen');
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('mainApp');
    const googleLoginBtn = document.getElementById('googleLoginBtn');

    if (user) {
        currentUser = user;
        
        try {
            const userRef = db.collection('users').doc(user.uid);
            let userSnap = await userRef.get();
            
            if (!userSnap.exists) {
                const userCode = generateWalletCode();
                const newUser = {
                    uid: user.uid,
                    email: user.email || '',
                    name: user.displayName || 'مستخدم جديد',
                    userCode: userCode,
                    walletCode: userCode,
                    balance: 0,
                    createdAt: new Date().toISOString(),
                    isActive: true,
                    isFrozen: false,
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                };
                await userRef.set(newUser);
                userData = newUser;
            } else {
                await userRef.update({
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                }).catch((err) => console.warn('تعذر تحديث آخر دخول:', err));
                
                const existingData = userSnap.data();
                if (!existingData.walletCode) {
                    const walletCode = generateWalletCode();
                    await userRef.update({
                        walletCode: walletCode,
                        userCode: walletCode
                    });
                    existingData.walletCode = walletCode;
                    existingData.userCode = walletCode;
                }
                userData = existingData;
            }

            // إخفاء شاشة التسجيل وإظهار التطبيق بعد نجاح جلب البيانات
            loadingScreen.style.display = 'none';
            loginScreen.style.display = 'none';
            mainApp.style.display = 'flex';

            if (typeof loadUserProfile === 'function') loadUserProfile();
            if (typeof loadPosts === 'function') loadPosts('jobs');

        } catch (error) {
            console.error('خطأ في تحميل بيانات المستخدم من Firestore:', error);
            alert('حدث خطأ أثناء تحميل بيانات الحساب، يرجى التأكد من اتصال الشبكة أو قواعد Firestore.');
            
            // في حال فشل جلب البيانات، نعيد إظهار شاشة الدخول
            loadingScreen.style.display = 'none';
            loginScreen.style.display = 'flex';
            mainApp.style.display = 'none';
        } finally {
            // إعادة تفعيل الزر لاستخدامه مستقبلاً
            if (googleLoginBtn) {
                googleLoginBtn.disabled = false;
                googleLoginBtn.textContent = 'تسجيل الدخول بحساب Google';
            }
        }
    } else {
        currentUser = null;
        userData = null;
        loadingScreen.style.display = 'none';
        loginScreen.style.display = 'flex';
        mainApp.style.display = 'none';

        if (googleLoginBtn) {
            googleLoginBtn.disabled = false;
            googleLoginBtn.textContent = 'تسجيل الدخول بحساب Google';
        }
    }
});

// تسجيل الدخول عبر Google
document.getElementById('googleLoginBtn').addEventListener('click', async function() {
    this.disabled = true;
    this.textContent = '⏳ جاري الاتصال...';
    const errorEl = document.getElementById('loginError');
    if (errorEl) errorEl.style.display = 'none';

    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        await auth.signInWithPopup(provider);
    } catch (error) {
        console.error('خطأ في تسجيل الدخول:', error);
        let msg = 'يوجد خطأ، المرجو إعادة المحاولة';
        if (error.code === 'auth/popup-closed-by-user') msg = 'تم إغلاق نافذة تسجيل الدخول';
        if (error.code === 'auth/cancelled-popup-request') msg = 'تم إلغاء الطلب';
        if (error.code === 'auth/unauthorized-domain') msg = 'هذا النطاق غير مصرح له في Firebase Console';

        if (errorEl) {
            errorEl.textContent = '❌ ' + msg;
            errorEl.style.display = 'block';
        }
        
        this.disabled = false;
        this.textContent = 'تسجيل الدخول بحساب Google';
    }
});

// تسجيل الخروج
document.getElementById('logoutBtn').addEventListener('click', async () => {
    if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
        try {
            await auth.signOut();
        } catch (error) {
            console.error('خطأ أثناء تسجيل الخروج:', error);
        }
    }
});
