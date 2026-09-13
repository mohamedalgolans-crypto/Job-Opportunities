// auth.js - نظام المصادقة عبر Google
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { 
    getAuth, 
    signInWithPopup, 
    GoogleAuthProvider, 
    signOut,
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc 
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

class AuthManager {
    constructor() {
        this.app = initializeApp(CONFIG.firebase);
        this.auth = getAuth(this.app);
        this.db = getFirestore(this.app);
        this.provider = new GoogleAuthProvider();
        this.currentUser = null;
    }

    // توليد كود فريد للمستخدم
    generateUserCode() {
        const prefix = 'FA';
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        const timestamp = Date.now().toString().slice(-4);
        return `${prefix}${random}${timestamp}`;
    }

    // تسجيل الدخول عبر Google
    async signInWithGoogle() {
        try {
            const result = await signInWithPopup(this.auth, this.provider);
            const user = result.user;
            
            // التحقق من وجود المستخدم في قاعدة البيانات
            const userRef = doc(this.db, "users", user.uid);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) {
                // مستخدم جديد - إنشاء حسابه
                await setDoc(userRef, {
                    uid: user.uid,
                    email: user.email,
                    name: user.displayName,
                    userCode: this.generateUserCode(),
                    balance: 0,
                    createdAt: new Date().toISOString(),
                    isActive: true,
                    isFrozen: false
                });
            } else if (userSnap.data().isFrozen) {
                // تجميد الحساب
                await signOut(this.auth);
                throw new Error('الحساب مجمد، يرجى التواصل مع الإدارة');
            }

            this.currentUser = user;
            return user;
        } catch (error) {
            console.error("خطأ في تسجيل الدخول:", error);
            throw error;
        }
    }

    // تسجيل الخروج
    async logout() {
        try {
            await signOut(this.auth);
            this.currentUser = null;
        } catch (error) {
            console.error("خطأ في تسجيل الخروج:", error);
        }
    }

    // مراقبة حالة المستخدم
    onAuthChange(callback) {
        return onAuthStateChanged(this.auth, callback);
    }
}

export default AuthManager;