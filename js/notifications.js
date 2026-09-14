// notifications.js - نظام الإشعارات المتكامل
import { getFirestore, collection, query, where, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

class NotificationSystem {
    constructor(app) {
        this.db = getFirestore(app);
        this.unsubscribe = null;
    }

    // بدء الاستماع للإشعارات
    startListening(callback) {
        const q = query(
            collection(this.db, "notifications"),
            orderBy("timestamp", "desc"),
            limit(20)
        );

        this.unsubscribe = onSnapshot(q, (snapshot) => {
            const notifications = [];
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    notifications.push({
                        id: change.doc.id,
                        ...change.doc.data()
                    });
                }
            });
            
            if (notifications.length > 0 && callback) {
                callback(notifications);
            }
        });
    }

    // إيقاف الاستماع
    stopListening() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }

    // عرض إشعار منبثق
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-family: 'Segoe UI', sans-serif;
            font-weight: bold;
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // طلب إذن الإشعارات للمتصفح
    async requestPermission() {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        }
        return false;
    }

    // إرسال إشعار للمتصفح
    sendBrowserNotification(title, body) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
                body: body,
                icon: '/assets/icon.png',
                badge: '/assets/badge.png'
            });
        }
    }
}

// إضافة أنماط CSS للإشعارات
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

export default NotificationSystem;