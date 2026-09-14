// ==========================================
// الملف الشخصي والمحفظة
// ==========================================

function loadUserProfile() {
    if (!userData) return;
    
    const nameEl = document.getElementById('profileName');
    const codeEl = document.getElementById('profileCode');
    const balanceEl = document.getElementById('profileBalance');
    
    if (nameEl) nameEl.textContent = userData.name || '';
    
    const walletCode = userData.walletCode || userData.userCode || '------';
    if (codeEl) {
        codeEl.textContent = walletCode;
        codeEl.style.cursor = 'pointer';
        codeEl.title = 'اضغط للنسخ';
    }
    
    if (balanceEl) balanceEl.textContent = userData.balance || 0;
}

// نسخ كود المحفظة
document.addEventListener('click', function(e) {
    if (e.target && e.target.id === 'profileCode') {
        const code = e.target.textContent;
        if (code && code !== '------') {
            navigator.clipboard.writeText(code).then(() => {
                showToast('تم نسخ كود المحفظة: ' + code, 'success');
            }).catch(() => {
                const textArea = document.createElement('textarea');
                textArea.value = code;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                textArea.remove();
                showToast('تم نسخ كود المحفظة: ' + code, 'success');
            });
        }
    }
});