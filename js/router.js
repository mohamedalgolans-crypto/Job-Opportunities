// router.js - نظام التنقل بين الأقسام
class Router {
    constructor() {
        this.routes = {
            'jobs': 'jobsSection',
            'realestate': 'realEstateSection',
            'news': 'newsSection',
            'profile': 'profileSection'
        };
        this.currentRoute = 'jobs';
        this.navButtons = {};
    }

    // تهيئة أزرار التنقل
    initNavigation() {
        this.navButtons = {
            jobs: document.getElementById('navJobs'),
            realestate: document.getElementById('navRealestate'),
            news: document.getElementById('navNews'),
            profile: document.getElementById('navProfile')
        };

        // إضافة مستمعي الأحداث
        Object.keys(this.navButtons).forEach(route => {
            this.navButtons[route]?.addEventListener('click', () => {
                this.navigateTo(route);
            });
        });
    }

    // التنقل إلى قسم معين
    navigateTo(route) {
        if (!this.routes[route]) return;

        // إخفاء جميع الأقسام
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
            section.style.display = 'none';
        });

        // إظهار القسم المطلوب
        const targetSection = document.getElementById(this.routes[route]);
        if (targetSection) {
            targetSection.classList.add('active');
            targetSection.style.display = 'block';
        }

        // تحديث الأزرار النشطة
        Object.keys(this.navButtons).forEach(key => {
            this.navButtons[key]?.classList.remove('active');
        });
        this.navButtons[route]?.classList.add('active');

        this.currentRoute = route;

        // إطلاق حدث تغيير القسم
        document.dispatchEvent(new CustomEvent('routeChanged', { 
            detail: { route: route } 
        }));
    }

    // الحصول على المسار الحالي
    getCurrentRoute() {
        return this.currentRoute;
    }
}

export default Router;