document.addEventListener('DOMContentLoaded', function() {
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');

    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('show');
        });
    }

    document.querySelectorAll('.alert').forEach(function(alert) {
        setTimeout(function() {
            var bsAlert = bootstrap.Alert.getOrCreateInstance(alert);
            bsAlert.close();
        }, 4000);
    });

    document.querySelectorAll('[data-bs-toggle="modal"]').forEach(function(trigger) {
        trigger.addEventListener('click', function() {
            if (sidebar) sidebar.classList.remove('show');
        });
    });
});

function togglePassword(fieldId, btn) {
    const input = document.getElementById(fieldId);
    const icon = btn.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('bi-eye');
        icon.classList.add('bi-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('bi-eye-slash');
        icon.classList.add('bi-eye');
    }
}

function updateClock() {
    const el = document.getElementById('currentDateTime');
    if (!el) return;
    const now = new Date();
    const options = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
    el.textContent = now.toLocaleDateString('en-IN', options);
}
setInterval(updateClock, 1000);
updateClock();
