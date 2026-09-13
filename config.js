// config.js - إعدادات Firebase والعناصر الأساسية
const CONFIG = {
    // تكوين Firebase
    firebase: {
        apiKey: "AIzaSyDk120B6zrzE1CRB4NZth6_Y-fMUXF3Np4",
        authDomain: "farsaml.firebaseapp.com",
        projectId: "farsaml",
        storageBucket: "farsaml.firebasestorage.app",
        messagingSenderId: "100868423567",
        appId: "1:100868423567:web:939c392225dee0d2db95fa"
    },
    
    // المفتاح السري للإدارة - تم تغييره
    adminSecretKey: "Farsaml@2024Secure#Admin!X9",
    
    // رقم الواتساب للإدارة
    adminWhatsApp: "963934969847",
    
    // الإعدادات العامة
    postsPerPage: 10,
    dailyAdCost: 10,
    realEstatePostCost: 5,
    
    // دوال مساعدة للواتساب
    getWhatsAppLink: function(message) {
        return `https://wa.me/${this.adminWhatsApp}?text=${encodeURIComponent(message)}`;
    }
};

export default CONFIG;