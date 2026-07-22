const App = {
    currentUser: null,
    publicClockInterval: null,

    init() {
        try {
            this.startPublicClock();
            this.showRecentActivity();
            document.getElementById('attNameInput').addEventListener('input', () => App.onNameInput());
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
        return { id: 'GUEST_' + trimmed.replace(/\s+/g, '_'), name: name.trim(), email: '', phone: '', department: 'Office', position: 'Guest', joinDate: '', status: 'active', photo: null, _auto: true };
    },

    onNameInput() {
        const name = document.getElementById('attNameInput').value.trim();
        const matchDiv = document.getElementById('attNameMatch');
        const leaveBtn = document.getElementById('btnLeaveRequest');
        if (!name) { matchDiv.innerHTML = ''; document.getElementById('attStatusDisplay').innerHTML = ''; leaveBtn.style.display = 'none'; return; }
        const staff = this.findStaffByName(name);
        if (staff) {
            var timings = DataStore.getTimingsForStaff(staff.id);
            matchDiv.innerHTML = '<span class="att-match-ok">Found: <strong>' + staff.name + '</strong> &mdash; ' + staff.department + '</span>' +
                '<div style="font-size:12px;color:rgba(255,255,255,0.55);margin-top:4px;">Your timings: ' + timings.startTime + ' - ' + timings.endTime + ' | Grace: ' + timings.graceMinutes + 'min | Half-day: ' + timings.halfDayHours + 'h</div>';
            var isRealStaff = !staff._auto && staff.id.indexOf('GUEST_') !== 0;
            leaveBtn.style.display = isRealStaff ? 'inline-block' : 'none';
            this._matchedStaff = isRealStaff ? staff : null;
            this.showAttStatus(staff.id);
        } else {
            matchDiv.innerHTML = '<span class="att-match-no">No match found. Check your name.</span>';
            document.getElementById('attStatusDisplay').innerHTML = '';
            leaveBtn.style.display = 'none';
            this._matchedStaff = null;
        }
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

    recordAttendance() {
        const name = document.getElementById('attNameInput').value.trim();
        if (!name) { this.toast('Please enter your name', 'error'); return; }
        const staff = this.findStaffByName(name);
        if (!staff) { this.toast('Name not found. Please check your name.', 'error'); return; }

        const staffId = staff.id;
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const time = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

        const timings = DataStore.getTimingsForStaff(staffId);
        const startParts = timings.startTime.split(':');
        const startH = parseInt(startParts[0], 10);
        const startM = parseInt(startParts[1], 10);
        const grace = timings.graceMinutes || 0;
        const lateThresholdMin = startH * 60 + startM + grace;
        const nowMin = now.getHours() * 60 + now.getMinutes();
        const isLate = nowMin > lateThresholdMin;

        const records = DataStore.getAttendance();
        const existing = records.find(r => r.staffId === staffId && r.date === today);

        if (existing && existing.clockIn) {
            this.toast('Already checked in today. Use Check Out.', 'error');
            return;
        }

        const record = {
            staffId: staffId,
            date: today,
            status: isLate ? 'late' : 'present',
            clockIn: time,
            clockOut: null,
            hours: 0
        };

        if (existing) {
            const idx = records.findIndex(r => r.staffId === staffId && r.date === today);
            records[idx] = record;
        } else {
            records.push(record);
        }
        localStorage.setItem('attendance', JSON.stringify(records));
        DataStore._pushToServer('/api/att/records', { data: record });

        if (staff._auto) {
            DataStore.saveNewStaffFromCheckIn(staff);
        }

        this.addRecentLog(staff.name, 'CHECKED IN', time);
        this.toast('Checked in at ' + time + ' - Welcome ' + staff.name + '!', 'success');
        this.showAttStatus(staffId);
        this.showRecentActivity();
    },

    clockOutPublic() {
        const name = document.getElementById('attNameInput').value.trim();
        if (!name) { this.toast('Please enter your name', 'error'); return; }
        const staff = this.findStaffByName(name);
        if (!staff) { this.toast('Name not found. Please check your name.', 'error'); return; }

        const staffId = staff.id;
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const time = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

        const records = DataStore.getAttendance();
        const idx = records.findIndex(r => r.staffId === staffId && r.date === today);

        if (idx === -1 || !records[idx].clockIn) {
            this.toast('No check-in record found for today', 'error');
            return;
        }
        if (records[idx].clockOut) {
            this.toast('Already checked out today', 'error');
            return;
        }

        records[idx].clockOut = time;
        const inh = parseInt(records[idx].clockIn.split(':')[0], 10);
        const inm = parseInt(records[idx].clockIn.split(':')[1], 10);
        const outh = parseInt(time.split(':')[0], 10);
        const outm = parseInt(time.split(':')[1], 10);
        records[idx].hours = parseFloat(((outh * 60 + outm - inh * 60 - inm) / 60).toFixed(1));
        localStorage.setItem('attendance', JSON.stringify(records));
        DataStore._pushToServer('/api/att/records', { data: records[idx] });

        this.addRecentLog(staff.name, 'CHECKED OUT', time);
        this.toast('Checked out at ' + time + ' (' + records[idx].hours + 'h)', 'success');
        this.showAttStatus(staffId);
        this.showRecentActivity();
    },

    addRecentLog(name, action, time) {
        const logs = JSON.parse(localStorage.getItem('recentLogs') || '[]');
        const now = new Date();
        const date = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        var entry = { name: name, action: action, time: time, date: date, timestamp: Date.now() };
        logs.unshift(entry);
        if (logs.length > 20) logs.length = 20;
        localStorage.setItem('recentLogs', JSON.stringify(logs));
        fetch('/api/att/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: entry })
        }).catch(function() {});
    },

    showRecentActivity() {
        const container = document.getElementById('publicHistory');
        if (!container) return;
        const logs = JSON.parse(localStorage.getItem('recentLogs') || '[]');
        if (!logs.length) { container.innerHTML = ''; return; }
        container.innerHTML = '<h3 class="section-title" style="text-align:center;margin-bottom:16px;">Recent Activity</h3>' +
            '<div class="recent-log-list">' + logs.map(function(l) {
                return '<div class="recent-log-item"><span class="recent-log-name">' + l.name +
                '</span> <span class="recent-log-action recent-log-' + (l.action === 'CHECKED IN' ? 'in' : 'out') +
                '">' + l.action + '</span> <span class="recent-log-time">' + l.time + ' &mdash; ' + l.date + '</span></div>';
            }).join('') + '</div>';
    },

    showAttStatus(staffId) {
        const today = new Date().toISOString().split('T')[0];
        const rec = DataStore.getAttendanceByStaff(staffId).find(function(r) { return r.date === today; });
        const display = document.getElementById('attStatusDisplay');

        if (!rec || !rec.clockIn) {
            display.innerHTML = '';
            return;
        }

        const dateStr = new Date(today + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const statusColors = { present: 'var(--success)', late: 'var(--warning)', absent: 'var(--danger)' };
        const border = statusColors[rec.status] || 'var(--gray-300)';
        const hoursHtml = rec.clockOut
            ? '<div class="att-status-row"><span><strong>Total Hours:</strong> ' + rec.hours + 'h</span></div>'
            : '<div class="att-status-row"><span style="color:var(--gray-500);font-style:italic;">Not checked out yet</span></div>';
        display.innerHTML =
            '<div class="att-status-card" style="border-left:4px solid ' + border + ';">' +
                '<div class="att-status-row">' +
                    '<span><strong>Status:</strong> <span class="badge badge-' + rec.status + '">' + rec.status.toUpperCase() + '</span></span>' +
                    '<span><strong>Date:</strong> ' + dateStr + '</span>' +
                '</div>' +
                '<div class="att-status-row">' +
                    '<span><strong>Check In:</strong> ' + rec.clockIn + '</span>' +
                    '<span><strong>Check Out:</strong> ' + (rec.clockOut || '---') + '</span>' +
                '</div>' +
                hoursHtml +
            '</div>';
    },

    showLeaveForm() {
        var staff = this._matchedStaff;
        if (!staff) { this.toast('Enter your name first', 'error'); return; }
        document.getElementById('leaveModalStaffLabel').textContent = staff.name + ' — ' + staff.department;
        document.getElementById('leaveType').value = 'Annual';
        var today = new Date().toISOString().split('T')[0];
        document.getElementById('leaveStartDate').value = today;
        document.getElementById('leaveEndDate').value = today;
        document.getElementById('leaveStartDate').min = today;
        document.getElementById('leaveEndDate').min = today;
        document.getElementById('leaveReason').value = '';
        this.openModal('leaveModal');
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
        this.closeModal('leaveModal');
        this.toast('Leave request submitted! Awaiting admin approval.', 'success');
    },

    openModal(id) { document.getElementById(id).classList.add('active'); },
    closeModal(id) { document.getElementById(id).classList.remove('active'); },

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
            if (targetId === 'attNameInput') App.onNameInput();
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
