const App = {
    _matchedStaff: null,
    publicClockInterval: null,

    init() {
        try {
            this.startPublicClock();
            document.getElementById('leaveNameInput').addEventListener('input', () => App.onNameInput());
        } catch (e) {
            console.error('Init error:', e);
        }
    },

    findStaffByName(name) {
        const trimmed = name.trim().toLowerCase();
        if (!trimmed) return null;
        var staff = DataStore.getStaff().filter(s => s.status === 'active');
        var match = staff.find(s => s.name.toLowerCase() === trimmed);
        if (match) return match;
        match = staff.find(s => s.name.toLowerCase().includes(trimmed) || trimmed.includes(s.name.toLowerCase()));
        if (match) return match;
        return null;
    },

    onNameInput() {
        const name = document.getElementById('leaveNameInput').value.trim();
        const matchDiv = document.getElementById('leaveNameMatch');
        if (!name) {
            matchDiv.innerHTML = '';
            document.getElementById('leaveFormWrap').style.display = 'none';
            document.getElementById('leaveHistoryWrap').style.display = 'none';
            this._matchedStaff = null;
            return;
        }
        const staff = this.findStaffByName(name);
        if (staff) {
            matchDiv.innerHTML = '<span class="att-match-ok">Found: <strong>' + staff.name + '</strong> &mdash; ' + staff.department + '</span>';
            this._matchedStaff = staff;
            this.showLeaveForm();
            this.showLeaveHistory();
        } else {
            matchDiv.innerHTML = '<span class="att-match-no">No match found. Only registered staff can request leave.</span>';
            document.getElementById('leaveFormWrap').style.display = 'none';
            document.getElementById('leaveHistoryWrap').style.display = 'none';
            this._matchedStaff = null;
        }
    },

    showLeaveForm() {
        var staff = this._matchedStaff;
        if (!staff) return;
        document.getElementById('leaveStaffLabel').textContent = staff.name + ' (' + staff.id + ') \u2014 ' + staff.department;
        document.getElementById('leaveType').value = 'Annual';
        var today = new Date().toISOString().split('T')[0];
        document.getElementById('leaveStartDate').value = today;
        document.getElementById('leaveEndDate').value = today;
        document.getElementById('leaveStartDate').min = today;
        document.getElementById('leaveEndDate').min = today;
        document.getElementById('leaveReason').value = '';
        document.getElementById('leaveFormWrap').style.display = 'block';
    },

    submitLeave() {
        var staff = this._matchedStaff;
        if (!staff) { this.toast('Enter your name first', 'error'); return; }
        var type = document.getElementById('leaveType').value;
        var startDate = document.getElementById('leaveStartDate').value;
        var endDate = document.getElementById('leaveEndDate').value;
        var reason = document.getElementById('leaveReason').value.trim();
        if (!startDate || !endDate) { this.toast('Select start and end dates', 'error'); return; }
        if (endDate < startDate) { this.toast('End date cannot be before start date', 'error'); return; }
        if (!reason) { this.toast('Please enter a reason', 'error'); return; }
        var leave = {
            staffId: staff.id,
            type: type,
            startDate: startDate,
            endDate: endDate,
            reason: reason
        };
        DataStore.addLeave(leave);
        this.toast('Leave request submitted! Awaiting admin approval.', 'success');
        this.showLeaveForm();
        this.showLeaveHistory();
    },

    showLeaveHistory() {
        var staff = this._matchedStaff;
        if (!staff) return;
        var leaves = DataStore.getLeavesByStaff(staff.id).sort(function(a, b) {
            return (b.appliedOn || '').localeCompare(a.appliedOn || '');
        });
        var wrap = document.getElementById('leaveHistoryWrap');
        var list = document.getElementById('leaveHistoryList');
        if (!leaves.length) {
            list.innerHTML = '<div style="text-align:center;color:var(--gray-400);padding:20px;font-size:14px;">No leave requests yet</div>';
            wrap.style.display = 'block';
            return;
        }
        var icons = { Annual: '\uD83C\uDFD6\uFE0F', Sick: '\uD83E\uDD12', Personal: '\uD83D\uDCCC', Emergency: '\uD83D\uDEA8', Maternity: '\uD83D\uDC76' };
        var statusColors = { pending: 'var(--warning)', approved: 'var(--success)', rejected: 'var(--danger)' };
        list.innerHTML = leaves.map(function(l) {
            var border = statusColors[l.status] || 'var(--gray-300)';
            var startStr = new Date(l.startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            var endStr = new Date(l.endDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            return '<div style="display:flex;align-items:flex-start;gap:12px;padding:14px;margin-bottom:10px;background:var(--gray-50);border-radius:10px;border-left:4px solid ' + border + ';">' +
                '<div style="font-size:24px;line-height:1;">' + (icons[l.type] || '\uD83D\uDCCB') + '</div>' +
                '<div style="flex:1;">' +
                    '<div style="font-weight:600;color:var(--gray-800);">' + l.type + ' Leave</div>' +
                    '<div style="font-size:13px;color:var(--gray-500);">' + startStr + ' - ' + endStr + '</div>' +
                    '<div style="font-size:13px;color:var(--gray-600);margin-top:4px;">' + l.reason + '</div>' +
                    '<div style="font-size:11px;color:var(--gray-400);margin-top:4px;">Applied: ' + (l.appliedOn || '-') + '</div>' +
                '</div>' +
                '<div style="text-align:right;">' +
                    '<span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;background:' + border + '22;color:' + border + ';">' + l.status + '</span>' +
                '</div>' +
            '</div>';
        }).join('');
        wrap.style.display = 'block';
    },

    startPublicClock() {
        this.updatePublicClock();
        this.publicClockInterval = setInterval(() => this.updatePublicClock(), 1000);
    },

    updatePublicClock() {
        const el = document.getElementById('publicClock');
        if (!el) return;
        const now = new Date();
        const t = now.toLocaleTimeString('en-US', { hour12: false });
        const d = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const day = now.toLocaleDateString('en-US', { weekday: 'long' });
        el.innerHTML = '<div class="clock-time">' + t + '</div><div class="clock-date">' + d + '</div><div class="clock-day">' + day.toUpperCase() + '</div>';
    },

    toast(message, type) {
        type = type || 'info';
        const container = document.getElementById('toastContainer');
        const icons = { success: '\u2705', error: '\u274C', info: '\u2139\uFE0F' };
        const toast = document.createElement('div');
        toast.className = 'toast toast-' + type;
        toast.innerHTML = '<span>' + (icons[type] || '') + '</span> ' + message;
        container.appendChild(toast);
        setTimeout(function() { toast.style.opacity = '0'; setTimeout(function() { toast.remove(); }, 300); }, 3000);
    },

    startVoiceSearch(btn) {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            this.toast('Voice search requires HTTPS. Try Chrome and enable insecure origin flag.', 'error');
            return;
        }
        const isSecure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
        if (!isSecure) {
            this.toast('Voice search requires HTTPS.', 'error');
            return;
        }
        const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        const targetId = btn.getAttribute('data-target');
        btn.classList.add('mic-listening');
        this.toast('Listening... speak a name', 'info');
        recognition.onresult = function(e) {
            const text = e.results[0][0].transcript;
            document.getElementById(targetId).value = text;
            btn.classList.remove('mic-listening');
            if (targetId === 'leaveNameInput') App.onNameInput();
        };
        recognition.onerror = function(e) {
            btn.classList.remove('mic-listening');
            var msg = 'Voice search failed. ';
            if (e.error === 'not-allowed') msg += 'Microphone access denied.';
            else if (e.error === 'network') msg += 'Network error.';
            else msg += 'Try again.';
            App.toast(msg, 'error');
        };
        recognition.onend = function() { btn.classList.remove('mic-listening'); };
        try { recognition.start(); } catch (e) {
            btn.classList.remove('mic-listening');
            this.toast('Could not start voice search.', 'error');
        }
    }
};

document.addEventListener('DOMContentLoaded', function() { App.init(); });
