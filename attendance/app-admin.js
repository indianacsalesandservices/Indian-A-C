const App = {
    currentUser: null,

    init() {
        try {
            if (typeof UnifiedAuth !== 'undefined' && UnifiedAuth.isAuthenticated()) {
                var session = UnifiedAuth.getSession();
                if (session && session.role === 'admin') {
                    this.currentUser = { role: 'admin', id: session.username, name: session.fullName || session.username };
                    localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
                    var self = this;
                    var readyFn = (typeof DataStore !== 'undefined' && DataStore.whenReady) ? DataStore.whenReady() : Promise.resolve();
                    readyFn.then(function() { self.showAdmin(); });
                    return;
                }
            }
            this.showLoginPage();
        } catch (e) {
            console.error('Init error:', e);
            this.showLoginPage();
        }
    },

    showLoginPage() {
        document.getElementById('loginPage').style.display = 'flex';
        document.getElementById('appLayout').classList.remove('active');
    },

    async adminLogin(e) {
        e.preventDefault();
        var user = document.getElementById('adminUser').value.trim();
        var pass = document.getElementById('adminPass').value;

        if (typeof UnifiedAuth !== 'undefined') {
            var result = await UnifiedAuth.login(user, pass);
            if (result && result.success) {
                if (result.user.role !== 'admin') {
                    this.toast('Admin access required', 'error');
                    return;
                }
                this.currentUser = { role: 'admin', id: result.user.username, name: result.user.fullName || result.user.username };
                localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
                this.showAdmin();
                return;
            }
            this.toast('Invalid credentials', 'error');
            return;
        }

        if (user === 'admin' && pass === 'admin123') {
            this.currentUser = { role: 'admin', id: 'admin', name: 'Administrator' };
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
            this.showAdmin();
        } else {
            this.toast('Invalid admin credentials', 'error');
        }
    },

    showAdmin() {
        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('appLayout').classList.add('active');
        document.getElementById('sidebarName').textContent = this.currentUser.name;
        document.getElementById('currentDate').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        this.navigate('dashboard');
    },

    logoutAdmin() {
        this.currentUser = null;
        localStorage.removeItem('currentUser');
        if (typeof UnifiedAuth !== 'undefined') UnifiedAuth.logout();
        this.showLoginPage();
        this.toast('Signed out', 'info');
    },

    resetAllData() {
        if (confirm('This will delete all attendance records. Continue?')) {
            if (confirm('Really reset? This cannot be undone!')) {
                localStorage.removeItem('attendance');
                localStorage.removeItem('leave');
                localStorage.removeItem('recentLogs');
                fetch('/api/att/records', { method: 'GET' }).then(function(r) { return r.json(); }).then(function(res) {
                    if (res.success && res.data) {
                        res.data.forEach(function(rec) {
                            fetch('/api/att/records/' + encodeURIComponent(rec.staffId) + '/' + encodeURIComponent(rec.date), { method: 'DELETE' }).catch(function() {});
                        });
                    }
                }).catch(function() {});
                fetch('/api/att/logs', { method: 'DELETE' }).catch(function() {});
                this.toast('Attendance data reset', 'info');
                this.navigate('dashboard');
                if (document.getElementById('appLayout').classList.contains('active')) {
                    this.renderDashboard();
                }
            }
        }
    },

    navigate(page) {
        document.querySelectorAll('.page').forEach(function(p) { p.style.display = 'none'; });
        document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
        var pageEl = document.getElementById('page-' + page);
        if (pageEl) pageEl.style.display = 'block';
        var navItem = document.querySelector('[data-page="' + page + '"]');
        if (navItem) navItem.classList.add('active');

        var titles = {
            dashboard: 'Dashboard',
            'manage-attendance': 'All Attendance',
            'manage-leave': 'Leave Requests',
            reports: 'Reports & Analytics',
            timings: 'Work Timings'
        };
        document.getElementById('pageTitle').textContent = titles[page] || page;

        var renderers = {
            dashboard: function() { App.renderDashboard(); },
            'manage-attendance': function() { App.renderAllAttendance(); },
            'manage-leave': function() { App.renderAllLeaves(); },
            reports: function() { App.renderReports(); },
            timings: function() { App.renderTimings(); }
        };
        if (renderers[page]) renderers[page]();
        document.getElementById('sidebar').classList.remove('open');
    },

    renderDashboard() {
        var today = new Date().toISOString().split('T')[0];
        var allStaff = DataStore.getStaff().filter(function(s) { return s.status === 'active'; });
        var todayRecords = DataStore.getAttendanceByDate(today);
        var presentCount = todayRecords.filter(function(r) { return r.status === 'present' || r.status === 'late'; }).length;
        var absentCount = allStaff.length - presentCount;
        var lateCount = todayRecords.filter(function(r) { return r.status === 'late'; }).length;
        var pendingLeaves = DataStore.getLeaves().filter(function(l) { return l.status === 'pending'; }).length;

        document.getElementById('dashboardStats').innerHTML =
            '<div class="stat-card"><div class="stat-icon blue">&#128101;</div><div class="stat-info"><h4>' + allStaff.length + '</h4><p>Total Staff</p></div></div>' +
            '<div class="stat-card"><div class="stat-icon green">&#9989;</div><div class="stat-info"><h4>' + presentCount + '</h4><p>Present Today</p></div></div>' +
            '<div class="stat-card"><div class="stat-icon yellow">&#9200;</div><div class="stat-info"><h4>' + lateCount + '</h4><p>Late Today</p></div></div>' +
            '<div class="stat-card"><div class="stat-icon red">&#10060;</div><div class="stat-info"><h4>' + absentCount + '</h4><p>Absent Today</p></div></div>';

        var depts = DataStore.getDepartmentSummary();
        document.getElementById('todayOverview').innerHTML = Object.entries(depts).map(function(entry) {
            var dept = entry[0], data = entry[1];
            return '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--gray-100);">' +
                '<div><strong>' + dept + '</strong><br><span style="font-size:12px;color:var(--gray-500);">' + data.total + ' staff</span></div>' +
                '<div style="display:flex;gap:12px;">' +
                    '<span class="badge badge-present">' + data.present + ' present</span>' +
                    '<span class="badge badge-late">' + data.late + ' late</span>' +
                    '<span class="badge badge-absent">' + data.absent + ' absent</span>' +
                '</div></div>';
        }).join('') || '<div class="empty-state"><p>No data</p></div>';

        var recentLeaves = DataStore.getLeaves().slice(-5).reverse();
        document.getElementById('recentActivity').innerHTML = recentLeaves.length ? recentLeaves.map(function(l) {
            var staff = DataStore.getStaffById(l.staffId);
            return '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--gray-100);">' +
                '<div><strong>' + (staff ? staff.name : l.staffId) + '</strong> - ' + l.type + ' Leave</div>' +
                '<span class="badge badge-' + l.status + '">' + l.status + '</span></div>';
        }).join('') : '<div class="empty-state"><p>No recent activity</p></div>';
    },

    renderAllAttendance() {
        var dateVal = document.getElementById('adminAttDate') ? document.getElementById('adminAttDate').value : '';
        if (!dateVal) dateVal = new Date().toISOString().split('T')[0];
        document.getElementById('adminAttDate').value = dateVal;
        var dept = document.getElementById('adminAttDept') ? document.getElementById('adminAttDept').value : '';
        var status = document.getElementById('adminAttStatus') ? document.getElementById('adminAttStatus').value : '';
        var search = document.getElementById('adminAttSearch') ? document.getElementById('adminAttSearch').value.toLowerCase() : '';
        var records = DataStore.getAttendanceByDate(dateVal);
        if (dept) records = records.filter(function(r) { var s = DataStore.getStaffById(r.staffId); return s && s.department === dept; });
        if (status) records = records.filter(function(r) { return r.status === status; });
        if (search) records = records.filter(function(r) { var s = DataStore.getStaffById(r.staffId); return s && s.name.toLowerCase().includes(search); });

        if (!records.length) {
            document.getElementById('allAttendanceTable').innerHTML = '<div class="empty-state"><p>No attendance records for this date</p></div>';
            return;
        }
        document.getElementById('allAttendanceTable').innerHTML = '<table>' +
            '<thead><tr><th>Staff ID</th><th>Name</th><th>Department</th><th>Status</th><th>Clock In</th><th>Clock Out</th><th>Hours</th><th>Action</th></tr></thead>' +
            '<tbody>' + records.map(function(r) {
                var s = DataStore.getStaffById(r.staffId);
                return '<tr>' +
                    '<td>' + r.staffId + '</td><td>' + (s ? s.name : r.staffId) + '</td><td>' + (s ? s.department : '-') + '</td>' +
                    '<td><span class="badge badge-' + r.status + '">' + r.status + '</span></td>' +
                    '<td>' + (r.clockIn || '-') + '</td><td>' + (r.clockOut || '-') + '</td><td>' + (r.hours || '-') + '</td>' +
                    '<td><button class="btn btn-sm btn-danger" onclick="App.deleteAttendance(\'' + r.staffId + '\',\'' + r.date + '\')" title="Delete">&#128465;</button></td>' +
                '</tr>';
            }).join('') + '</tbody></table>';
    },

    deleteAttendance(staffId, date) {
        if (!confirm('Delete this attendance record?')) return;
        var records = DataStore.getAttendance();
        var idx = records.findIndex(function(r) { return r.staffId === staffId && r.date === date; });
        if (idx !== -1) {
            records.splice(idx, 1);
            localStorage.setItem('attendance', JSON.stringify(records));
            fetch('/api/att/records/' + encodeURIComponent(staffId) + '/' + encodeURIComponent(date), {
                method: 'DELETE'
            }).catch(function() {});
            this.renderAllAttendance();
            this.renderDashboard();
            this.toast('Record deleted', 'success');
        }
    },

    renderAllLeaves() {
        var statusFilter = document.getElementById('leaveFilterStatus') ? document.getElementById('leaveFilterStatus').value : '';
        var search = document.getElementById('leaveSearch') ? document.getElementById('leaveSearch').value.toLowerCase() : '';
        var leaves = DataStore.getLeaves().sort(function(a, b) { return b.appliedOn.localeCompare(a.appliedOn); });
        if (statusFilter) leaves = leaves.filter(function(l) { return l.status === statusFilter; });
        if (search) leaves = leaves.filter(function(l) { var s = DataStore.getStaffById(l.staffId); return s && s.name.toLowerCase().includes(search); });

        if (!leaves.length) {
            document.getElementById('allLeavesList').innerHTML = '<div class="empty-state"><p>No leave requests</p></div>';
            return;
        }
        var icons = { Annual: '\uD83C\uDFD6\uFE0F', Sick: '\uD83E\uDD12', Personal: '\uD83D\uDCCC', Emergency: '\uD83D\uDEA8', Maternity: '\uD83D\uDC76' };
        document.getElementById('allLeavesList').innerHTML = leaves.map(function(l) {
            var staff = DataStore.getStaffById(l.staffId);
            var actions = l.status === 'pending'
                ? '<button class="btn btn-sm btn-success" onclick="App.processLeave(\'' + l.id + '\',\'approved\')">Approve</button>' +
                  '<button class="btn btn-sm btn-danger" onclick="App.processLeave(\'' + l.id + '\',\'rejected\')">Reject</button>'
                : '<span class="badge badge-' + l.status + '">' + l.status + '</span>';
            return '<div class="leave-card">' +
                '<div class="leave-icon" style="background:var(--gray-100);">' + (icons[l.type] || '\uD83D\uDCCB') + '</div>' +
                '<div class="leave-details">' +
                    '<h4>' + (staff ? staff.name : l.staffId) + ' &mdash; ' + l.type + ' Leave</h4>' +
                    '<p>' + new Date(l.startDate).toLocaleDateString() + ' - ' + new Date(l.endDate).toLocaleDateString() + ' | Applied: ' + l.appliedOn + '</p>' +
                    '<p>' + l.reason + '</p>' +
                '</div>' +
                '<div class="leave-actions">' + actions + '</div>' +
            '</div>';
        }).join('');
    },

    processLeave(id, status) {
        DataStore.updateLeave(id, { status: status });
        this.toast('Leave ' + status, 'success');
        this.renderAllLeaves();
    },

    renderReports() {
        var allStaff = DataStore.getStaff().filter(function(s) { return s.status === 'active'; });
        var today = new Date().toISOString().split('T')[0];
        var todayRecords = DataStore.getAttendanceByDate(today);
        var present = todayRecords.filter(function(r) { return r.status === 'present' || r.status === 'late'; }).length;
        var totalLeaves = DataStore.getLeaves().length;
        var approvedLeaves = DataStore.getLeaves().filter(function(l) { return l.status === 'approved'; }).length;

        document.getElementById('reportStats').innerHTML =
            '<div class="stat-card"><div class="stat-icon blue">&#128101;</div><div class="stat-info"><h4>' + allStaff.length + '</h4><p>Active Staff</p></div></div>' +
            '<div class="stat-card"><div class="stat-icon green">&#9989;</div><div class="stat-info"><h4>' + present + '</h4><p>Present Today</p></div></div>' +
            '<div class="stat-card"><div class="stat-icon yellow">&#128197;</div><div class="stat-info"><h4>' + totalLeaves + '</h4><p>Total Leave Requests</p></div></div>' +
            '<div class="stat-card"><div class="stat-icon red">&#9989;</div><div class="stat-info"><h4>' + approvedLeaves + '</h4><p>Approved Leaves</p></div></div>';

        var depts = DataStore.getDepartmentSummary();
        var maxVal = Math.max.apply(null, Object.values(depts).map(function(d) { return d.total; }).concat([1]));
        document.getElementById('deptChart').innerHTML = '<div class="bar-chart">' + Object.entries(depts).map(function(entry) {
            var dept = entry[0], data = entry[1];
            return '<div class="bar-group">' +
                '<div class="bar-value">' + data.present + '/' + data.total + '</div>' +
                '<div class="bar" style="height:' + ((data.present / maxVal) * 140) + 'px;background:var(--success);"></div>' +
                '<div class="bar-label">' + dept + '</div></div>';
        }).join('') + '</div>';

        document.getElementById('reportStaff').innerHTML = '<option value="">Select Staff</option>' +
            allStaff.map(function(s) { return '<option value="' + s.id + '">' + s.name + ' (' + s.id + ')</option>'; }).join('');
        var now = new Date();
        document.getElementById('reportMonth').value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
        document.getElementById('monthlyReport').innerHTML = '<p style="color:var(--gray-400);text-align:center;">Select a staff member and month</p>';

        var search = document.getElementById('reportSearch') ? document.getElementById('reportSearch').value.toLowerCase() : '';
        document.getElementById('reportTable').innerHTML = '<table>' +
            '<thead><tr><th>ID</th><th>Name</th><th>Department</th><th>Status</th><th>This Month</th><th>Late</th><th>Hours</th></tr></thead>' +
            '<tbody>' + allStaff.filter(function(s) { return !search || s.name.toLowerCase().includes(search); }).map(function(s) {
                var rec = DataStore.getMonthlyReport(s.id, now.getFullYear(), now.getMonth());
                return '<tr>' +
                    '<td>' + s.id + '</td><td>' + s.name + '</td><td>' + s.department + '</td>' +
                    '<td><span class="badge badge-' + s.status + '">' + s.status + '</span></td>' +
                    '<td>' + rec.present + '/' + rec.totalDays + '</td><td>' + rec.late + '</td><td>' + rec.totalHours + 'h</td></tr>';
            }).join('') + '</tbody></table>';
    },

    renderMonthlyReport() {
        var staffId = document.getElementById('reportStaff').value;
        var monthVal = document.getElementById('reportMonth').value;
        if (!staffId || !monthVal) { document.getElementById('monthlyReport').innerHTML = '<p style="color:var(--gray-400);text-align:center;">Select both fields</p>'; return; }
        var parts = monthVal.split('-');
        var year = parseInt(parts[0], 10);
        var month = parseInt(parts[1], 10);
        var report = DataStore.getMonthlyReport(staffId, year, month - 1);
        var staff = DataStore.getStaffById(staffId);

        document.getElementById('monthlyReport').innerHTML =
            '<div style="text-align:center;margin-bottom:20px;"><strong>' + (staff ? staff.name : staffId) + '</strong> &mdash; ' + new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) + '</div>' +
            '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;">' +
                '<div style="text-align:center;padding:16px;background:var(--success-bg);border-radius:8px;"><div style="font-size:24px;font-weight:700;color:#15803d;">' + report.present + '</div><div style="font-size:12px;color:#15803d;">Present</div></div>' +
                '<div style="text-align:center;padding:16px;background:var(--warning-bg);border-radius:8px;"><div style="font-size:24px;font-weight:700;color:#b45309;">' + report.late + '</div><div style="font-size:12px;color:#b45309;">Late</div></div>' +
                '<div style="text-align:center;padding:16px;background:var(--danger-bg);border-radius:8px;"><div style="font-size:24px;font-weight:700;color:#dc2626;">' + report.absent + '</div><div style="font-size:12px;color:#dc2626;">Absent</div></div>' +
            '</div>' +
            '<div style="text-align:center;color:var(--gray-600);">Total Hours: <strong>' + report.totalHours + 'h</strong></div>';
    },

    renderTimings() {
        var allStaff = DataStore.getStaff().filter(function(s) { return s.status === 'active'; });
        var select = document.getElementById('timingStaffSelect');
        var currentVal = select.value;
        select.innerHTML = '<option value="">-- Choose Staff --</option>' +
            allStaff.map(function(s) {
                return '<option value="' + s.id + '">' + s.name + ' (' + s.id + ')</option>';
            }).join('');
        if (currentVal) select.value = currentVal;
        document.getElementById('timingFormWrap').style.display = 'none';
        this.renderAllTimingsTable();
    },

    selectStaffTimings() {
        var staffId = document.getElementById('timingStaffSelect').value;
        if (!staffId) { document.getElementById('timingFormWrap').style.display = 'none'; return; }
        var staff = DataStore.getStaffById(staffId);
        if (!staff) return;
        var timings = DataStore.getTimingsForStaff(staffId);
        document.getElementById('timingStaffLabel').textContent = staff.name + ' (' + staff.id + ') — ' + staff.department;
        document.getElementById('timingStartTime').value = timings.startTime || '09:00';
        document.getElementById('timingEndTime').value = timings.endTime || '18:00';
        document.getElementById('timingGrace').value = timings.graceMinutes != null ? timings.graceMinutes : 10;
        document.getElementById('timingHalfDay').value = timings.halfDayHours != null ? timings.halfDayHours : 4;
        document.getElementById('timingsStatus').innerHTML = '<span style="color:var(--gray-400);font-size:13px;">Current: ' + timings.startTime + ' - ' + timings.endTime + ' | Grace: ' + timings.graceMinutes + 'min | Half-day: ' + timings.halfDayHours + 'h</span>';
        document.getElementById('timingFormWrap').style.display = 'block';
    },

    saveStaffTimings() {
        var staffId = document.getElementById('timingStaffSelect').value;
        if (!staffId) { this.toast('Select a staff member first', 'error'); return; }
        var timings = {
            startTime: document.getElementById('timingStartTime').value,
            endTime: document.getElementById('timingEndTime').value,
            graceMinutes: parseInt(document.getElementById('timingGrace').value, 10) || 0,
            halfDayHours: parseFloat(document.getElementById('timingHalfDay').value) || 4
        };
        DataStore.saveTimingsForStaff(staffId, timings);
        this.toast('Timings saved for ' + (DataStore.getStaffById(staffId) || {}).name, 'success');
        this.selectStaffTimings();
        this.renderAllTimingsTable();
    },

    renderAllTimingsTable() {
        var allStaff = DataStore.getStaff().filter(function(s) { return s.status === 'active'; });
        var allTimings = DataStore.getAllStaffTimings();
        if (!allStaff.length) {
            document.getElementById('allTimingsTable').innerHTML = '<div class="empty-state"><p>No staff found</p></div>';
            return;
        }
        document.getElementById('allTimingsTable').innerHTML = '<table>' +
            '<thead><tr><th>Name</th><th>ID</th><th>Start</th><th>End</th><th>Grace</th><th>Half-Day</th><th>Status</th></tr></thead>' +
            '<tbody>' + allStaff.map(function(s) {
                var t = allTimings[s.id];
                var hasCustom = t && t.startTime;
                return '<tr>' +
                    '<td>' + s.name + '</td><td>' + s.id + '</td>' +
                    '<td>' + (hasCustom ? t.startTime : DataStore.DEFAULT_TIMINGS.startTime) + '</td>' +
                    '<td>' + (hasCustom ? t.endTime : DataStore.DEFAULT_TIMINGS.endTime) + '</td>' +
                    '<td>' + (hasCustom && t.graceMinutes != null ? t.graceMinutes : DataStore.DEFAULT_TIMINGS.graceMinutes) + ' min</td>' +
                    '<td>' + (hasCustom && t.halfDayHours != null ? t.halfDayHours : DataStore.DEFAULT_TIMINGS.halfDayHours) + 'h</td>' +
                    '<td><span class="badge badge-' + (hasCustom ? 'present' : 'absent') + '">' + (hasCustom ? 'Custom' : 'Default') + '</span></td>' +
                '</tr>';
            }).join('') + '</tbody></table>';
    },

    toast(message, type) {
        type = type || 'info';
        var container = document.getElementById('toastContainer');
        var icons = { success: '\u2705', error: '\u274C', info: '\u2139\uFE0F' };
        var toast = document.createElement('div');
        toast.className = 'toast toast-' + type;
        toast.innerHTML = '<span>' + (icons[type] || '') + '</span> ' + message;
        container.appendChild(toast);
        setTimeout(function() { toast.style.opacity = '0'; setTimeout(function() { toast.remove(); }, 300); }, 3000);
    },

    startVoiceSearch(btn) {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            this.toast('Voice search requires HTTPS.', 'error');
            return;
        }
        var isSecure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
        if (!isSecure) {
            this.toast('Voice search requires HTTPS.', 'error');
            return;
        }
        var recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        var targetId = btn.getAttribute('data-target');
        btn.classList.add('mic-listening');
        this.toast('Listening... speak a name', 'info');
        var self = this;
        recognition.onresult = function(e) {
            var text = e.results[0][0].transcript;
            document.getElementById(targetId).value = text;
            btn.classList.remove('mic-listening');
            if (targetId === 'adminAttSearch') self.renderAllAttendance();
            else if (targetId === 'leaveSearch') self.renderAllLeaves();
            else if (targetId === 'reportSearch') self.renderReports();
        };
        recognition.onerror = function(e) {
            btn.classList.remove('mic-listening');
            self.toast('Voice search failed.', 'error');
        };
        recognition.onend = function() { btn.classList.remove('mic-listening'); };
        try { recognition.start(); } catch (e) {
            btn.classList.remove('mic-listening');
            this.toast('Could not start voice search.', 'error');
        }
    }
};

document.addEventListener('DOMContentLoaded', function() { App.init(); });
