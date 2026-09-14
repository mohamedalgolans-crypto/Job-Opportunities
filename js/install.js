// ==========================================
// نظام التثبيت - زر واحد فقط في الملف الشخصي
// ==========================================

let deferredPrompt = null;

// الاستماع لحدث التثبيت
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    // إظهار زر التثبيت فقط إذا لم يكن مثبتاً
    updateInstallButton();
});

// التحقق من حالة التثبيت
function isAppInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches || 
           window.navigator.standalone === true;
}

// تحديث نص زر التثبيت
function updateInstallButton() {
    const btn = document.getElementById('installAppBtn');
    if (!btn) return;
    
    if (isAppInstalled()) {
        btn.textContent = '✅ التطبيق مثبت بالفعل';
        btn.disabled = true;
        btn.style.background = '#4caf50';
        btn.style.opacity = '0.7';
        btn.style.cursor = 'default';
    } else if (deferredPrompt) {
        btn.textContent = '📱 تثبيت التطبيق';
        btn.disabled = false;
        btn.style.background = '#4caf50';
        btn.style.opacity = '1';
    } else {
        btn.textContent = '📱 تثبيت التطبيق';
        btn.disabled = false;
        btn.style.background = '#4caf50';
    }
}

// زر التثبيت
document.getElementById('installAppBtn').onclick = async function() {
    if (isAppInstalled()) {
        showToast('التطبيق مثبت بالفعل', 'success');
        return;
    }
    
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const result = await deferredPrompt.userChoice;
        
        if (result.outcome === 'accepted') {
            showToast('تم تثبيت التطبيق بنجاح', 'success');
            deferredPrompt = null;
            updateInstallButton();
        }
    } else {
        // توجيه المستخدم حسب المتصفح
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isAndroid = /Android/.test(navigator.userAgent);
        
        if (isIOS) {
            alert('للتثبيت:\n1. اضغط زر المشاركة (مربع مع سهم للأعلى)\n2. اختر "إضافة إلى الشاشة الرئيسية"');
        } else if (isAndroid) {
            alert('للتثبيت:\n1. اضغط قائمة المتصفح (⋮)\n2. اختر "تثبيت التطبيق" أو "Add to Home Screen"');
        } else {
            alert('للتثبيت:\nاضغط أيقونة التثبيت في شريط عنوان المتصفح');
        }
    }
};

// عند اكتمال التثبيت
window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    showToast('تم تثبيت التطبيق بنجاح', 'success');
    updateInstallButton();
});

// تحديث الزر عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    updateInstallButton();
});