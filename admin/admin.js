// Shared admin JS

// Check auth on every admin page
(async () => {
    try {
        const r = await fetch('/api/auth/me');
        if (r.status === 401) {
            window.location.href = '/login.html';
            return;
        }
        const d = await r.json();
        if (!d.authenticated || d.user.role !== 'admin') {
            window.location.href = '/login.html';
            return;
        }
        const badge = document.getElementById('userBadge');
        if (badge) {
            badge.textContent = '👑 ' + (d.user.full_name || d.user.username);
        }
    } catch (e) {
        window.location.href = '/login.html';
    }
})();

async function logout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    window.location.href = '/login.html';
}

function showToast(message, isError = false) {
    let toast = document.getElementById('toastEl');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toastEl';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.toggle('error', isError);
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function confirmDelete(message) {
    return confirm(message || 'هل أنت متأكد من الحذف؟');
}

// Mobile sidebar toggle - injects hamburger button + overlay automatically
(function setupMobileMenu() {
    function init() {
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar || document.querySelector('.menu-toggle')) return;

        const btn = document.createElement('button');
        btn.className = 'menu-toggle';
        btn.setAttribute('aria-label', 'القائمة');
        btn.innerHTML = '☰';
        document.body.appendChild(btn);

        const overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        document.body.appendChild(overlay);

        const close = () => { sidebar.classList.remove('open'); overlay.classList.remove('open'); };
        btn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            overlay.classList.toggle('open');
        });
        overlay.addEventListener('click', close);
        sidebar.querySelectorAll('a.nav-link').forEach(a => a.addEventListener('click', close));
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
