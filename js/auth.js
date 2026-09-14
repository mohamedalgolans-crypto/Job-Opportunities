// ==========================================
// نظام المصادقة وتسجيل الدخول
// ==========================================

auth.onAuthStateChanged(async (user) => {
    const loadingScreen = document.getElementById('loadingScreen');
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('mainApp');
    
    if (user) {
        currentUser = user;
        loadingScreen.style.display = 'none';
        loginScreen.style.display = 'none';
        mainApp.style.display = 'flex';
        
        try {
            const userSnap = await db.collection('users').doc(user.uid).get();
            
            if (!userSnap.exists) {
                const userCode = generateWalletCode();
                await db.collection('users').doc(user.uid).set({
                    uid: user.uid,
                    email: user.email,
                    name: user.displayName,
                    userCode: userCode,
                    walletCode: userCode,
                    balance: 0,
                    createdAt: new Date().toISOString(),
                    isActive: true,
                    isFrozen: false,
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                await db.collection('users').doc(user.uid).update({
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                }).catch(() => {});
                
                const existingData = userSnap.data();
                if (!existingData.walletCode) {
                    const walletCode = generateWalletCode();
                    await db.collection('users').doc(user.uid).update({
                        walletCode: walletCode,
                        userCode: walletCode
                    });
                }
            }

            const snap = await db.collection('users').doc(user.uid).get();
            userData = snap.data();
            loadUserProfile();
            loadPosts('jobs');

        } catch (error) {
            console.error('خطأ في تحميل بيانات المستخدم:', error);
        }
    } else {
        currentUser = null;
        userData = null;
        loadingScreen.style.display = 'none';
        loginScreen.style.display = 'flex';
        mainApp.style.display = 'none';
    }
});

// تسجيل الدخول
document.getElementById('googleLoginBtn').addEventListener('click', async function() {
    this.disabled = true;
    this.textContent = '⏳ جاري الاتصال...';
    document.getElementById('loginError').style.display = 'none';

    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        await auth.signInWithPopup(provider);
    } catch (error) {
        console.error('خطأ:', error);
        let msg = 'يوجد خطأ، المرجو إعادة المحاولة';
        if (error.code === 'auth/popup-closed-by-user') msg = 'تم إغلاق نافذة تسجيل الدخول';
        if (error.code === 'auth/cancelled-popup-request') msg = 'تم إلغاء الطلب';
        document.getElementById('loginError').textContent = '❌ ' + msg;
        document.getElementById('loginError').style.display = 'block';
        this.disabled = false;
        this.textContent = 'تسجيل الدخول بحساب Google';
    }
});

// تسجيل الخروج
document.getElementById('logoutBtn').addEventListener('click', async () => {
    if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
        await auth.signOut();
    }
});