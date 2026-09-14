// database.js - عمليات القراءة والكتابة من Firebase

import {
    getFirestore,
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    serverTimestamp,
    increment,
    runTransaction
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

class Database {
    constructor(app) {
        this.db = getFirestore(app);
    }

    // ==============================
    // بيانات المستخدم
    // ==============================
    async getUserData(uid) {
        const userRef = doc(this.db, "users", uid);
        const userSnap = await getDoc(userRef);

        return userSnap.exists() ? userSnap.data() : null;
    }

    // ==============================
    // تحديث الرصيد
    // ==============================
    async updateUserBalance(uid, amount) {
        const userRef = doc(this.db, "users", uid);

        await updateDoc(userRef, {
            balance: increment(amount),
            lastUpdated: serverTimestamp()
        });
    }

    // ==============================
    // جلب المنشورات
    // ==============================
    async getPosts(
        collectionName,
        lastDoc = null,
        pageSize = CONFIG.postsPerPage
    ) {
        const colRef = collection(this.db, collectionName);

        let q = query(
            colRef,
            where("approved", "==", true),
            orderBy("createdAt", "desc"),
            limit(pageSize)
        );

        if (lastDoc) {
            q = query(
                colRef,
                where("approved", "==", true),
                orderBy("createdAt", "desc"),
                startAfter(lastDoc),
                limit(pageSize)
            );
        }

        const snapshot = await getDocs(q);

        const posts = [];

        snapshot.forEach((docSnap) => {
            posts.push({
                id: docSnap.id,
                ...docSnap.data()
            });
        });

        return {
            posts,
            lastVisible:
                snapshot.docs[snapshot.docs.length - 1] || null,
            hasMore: snapshot.docs.length === pageSize
        };
    }

    // ==============================
    // نشر إعلان ممول
    // ==============================
    async publishAd(userId, adData, durationDays) {
        const cost = durationDays * CONFIG.dailyAdCost;

        if (!Number.isFinite(cost) || cost <= 0) {
            throw new Error("قيمة الإعلان غير صحيحة");
        }

        const userRef = doc(this.db, "users", userId);
        const adRef = doc(collection(this.db, "ads"));
        const transactionRef = doc(collection(this.db, "transactions"));

        await runTransaction(this.db, async (transaction) => {

            // قراءة المستخدم
            const userSnap = await transaction.get(userRef);

            if (!userSnap.exists()) {
                throw new Error("حساب المستخدم غير موجود");
            }

            const userData = userSnap.data();
            const balance = Number(userData.balance || 0);

            // التحقق من الرصيد
            if (balance < cost) {
                throw new Error("رصيد غير كافي");
            }

            const newBalance = balance - cost;

            // خصم الرصيد
            transaction.update(userRef, {
                balance: newBalance,
                lastUpdated: serverTimestamp()
            });

            // إنشاء الإعلان
            transaction.set(adRef, {
                ...adData,
                userId: userId,
                durationDays: durationDays,
                cost: cost,
                status: "pending",
                approved: false,
                createdAt: new Date().toISOString()
            });

            // تسجيل العملية
            transaction.set(transactionRef, {
                userId: userId,
                type: "ad_purchase",
                amount: -cost,
                description: `نشر إعلان لمدة ${durationDays} أيام`,
                timestamp: serverTimestamp(),
                date: new Date().toISOString()
            });
        });

        return adRef.id;
    }

    // ==============================
    // نشر عقار
    // ==============================
    async publishRealEstate(userId, data) {
        const cost = Number(CONFIG.realEstatePostCost);

        if (!Number.isFinite(cost) || cost <= 0) {
            throw new Error("تكلفة نشر العقار غير صحيحة");
        }

        const userRef = doc(this.db, "users", userId);
        const postRef = doc(collection(this.db, "realEstatePosts"));
        const transactionRef = doc(collection(this.db, "transactions"));

        await runTransaction(this.db, async (transaction) => {

            // قراءة المستخدم
            const userSnap = await transaction.get(userRef);

            if (!userSnap.exists()) {
                throw new Error("حساب المستخدم غير موجود");
            }

            const userData = userSnap.data();
            const balance = Number(userData.balance || 0);

            // التحقق من الرصيد
            if (balance < cost) {
                throw new Error("رصيد غير كافي");
            }

            const newBalance = balance - cost;

            // خصم الرصيد
            transaction.update(userRef, {
                balance: newBalance,
                lastUpdated: serverTimestamp()
            });

            // إنشاء العقار
            transaction.set(postRef, {
                ...data,
                userId: userId,
                status: "pending",
                approved: false,
                createdAt: new Date().toISOString()
            });

            // تسجيل العملية
            transaction.set(transactionRef, {
                userId: userId,
                type: "realestate_publish",
                amount: -cost,
                description: "نشر عقار",
                timestamp: serverTimestamp(),
                date: new Date().toISOString()
            });
        });

        return postRef.id;
    }

    // ==============================
    // تسجيل عملية مالية منفردة
    // ==============================
    async logTransaction(userId, type, amount, description) {
        await addDoc(collection(this.db, "transactions"), {
            userId,
            type,
            amount,
            description,
            timestamp: serverTimestamp(),
            date: new Date().toISOString()
        });
    }

    // ==============================
    // الإشعارات
    // ==============================
    async sendNotificationToAll(title, body) {
        await addDoc(collection(this.db, "notifications"), {
            title,
            body,
            timestamp: serverTimestamp(),
            read: false,
            type: "global"
        });
    }
}

export default Database;