const DataStore = {
    PORTAL_STAFF_KEY: 'iacss_staff_details_v1',
    ATTENDANCE_KEY: 'attendance',
    LEAVE_KEY: 'leave',
    STAFF_TIMINGS_KEY: 'staff_timings',
    RECENT_LOGS_KEY: 'recentLogs',
    DEFAULT_TIMINGS: {
        startTime: '09:00',
        endTime: '18:00',
        graceMinutes: 10,
        halfDayHours: 4
    },
    _ready: null,

    init() {
        this._ready = this._pullAllFromServer().then(function() {
            console.log('[ATT-SYNC] DataStore ready, attendance:', DataStore.getAttendance().length, 'leave:', DataStore.getLeaves().length);
        }).catch(function(e) {
            console.error('[ATT-SYNC] DataStore init error:', e);
        });
        return this._ready;
    },

    whenReady() {
        return this._ready || Promise.resolve();
    },

    async _pullAllFromServer() {
        try {
            var results = await Promise.all([
                fetch('/api/att/staff').then(function(r) { return r.json(); }).catch(function() { return null; }),
                fetch('/api/att/records').then(function(r) { return r.json(); }).catch(function() { return null; }),
                fetch('/api/att/leaves').then(function(r) { return r.json(); }).catch(function() { return null; }),
                fetch('/api/att/timings').then(function(r) { return r.json(); }).catch(function() { return null; }),
                fetch('/api/att/logs').then(function(r) { return r.json(); }).catch(function() { return null; })
            ]);
            if (results[0] && results[0].success && results[0].data) {
                // merge server staff into local records without overwriting
                var local = DataStore.getPortalRecords();
                var server = results[0].data;
                server.forEach(function(s) {
                    if (!local.find(function(l) { return l.staffId === s.staffId; })) {
                        local.push(s);
                    }
                });
                localStorage.setItem(this.PORTAL_STAFF_KEY, JSON.stringify(local));
                console.log('[ATT-SYNC] Server pull staff:', results[0].data.length);
            }
            if (results[1] && results[1].success && results[1].data) {
                localStorage.setItem(this.ATTENDANCE_KEY, JSON.stringify(results[1].data));
                console.log('[ATT-SYNC] Server pull attendance:', results[1].data.length);
            }
            if (results[2] && results[2].success && results[2].data) {
                localStorage.setItem(this.LEAVE_KEY, JSON.stringify(results[2].data));
                console.log('[ATT-SYNC] Server pull leaves:', results[2].data.length);
            }
            if (results[3] && results[3].success && results[3].data) {
                localStorage.setItem(this.STAFF_TIMINGS_KEY, JSON.stringify(results[3].data));
                console.log('[ATT-SYNC] Server pull timings');
            }
            if (results[4] && results[4].success && results[4].data) {
                localStorage.setItem(this.RECENT_LOGS_KEY, JSON.stringify(results[4].data));
                console.log('[ATT-SYNC] Server pull logs:', results[4].data.length);
            }
        } catch (e) {
            console.error('[ATT-SYNC] Server pull failed, using localStorage:', e);
        }
    },

    async _pushToServer(endpoint, data) {
        try {
            var resp = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return await resp.json();
        } catch (e) {
            console.error('[ATT-SYNC] Server push failed for', endpoint, e);
            return { success: false };
        }
    },

    getPortalRecords() {
        try { return JSON.parse(localStorage.getItem(this.PORTAL_STAFF_KEY) || '[]'); } catch (e) { return []; }
    },

    getStaff() {
        const records = this.getPortalRecords();
        return records.map((r, i) => ({
            id: r.staffId || 'STF' + String(i + 1).padStart(3, '0'),
            name: r.fullName || '',
            email: r.phone || '',
            phone: r.phone || '',
            department: r.location || 'Office',
            position: r.jobTitle || r.role || 'Staff',
            joinDate: r.joinDate || '',
            status: r.status || 'active',
            photo: null
        })).filter(s => s.name);
    },

    getStaffById(id) {
        return this.getStaff().find(s => s.id === id);
    },

    saveStaff() {},
    addStaff() {},
    updateStaff() {},
    deleteStaff() {},

    saveNewStaffFromCheckIn(staffObj) {
        var list = this.getPortalRecords();
        var exists = list.find(function(s) {
            return (s.fullName || '').toLowerCase() === staffObj.name.toLowerCase();
        });
        if (exists) return;
        var num = list.length + 1;
        var newRecord = {
            staffId: 'STF' + String(num).padStart(3, '0'),
            fullName: staffObj.name,
            phone: staffObj.phone || '',
            location: staffObj.department || 'Office',
            jobTitle: staffObj.position || 'Staff',
            role: 'staff',
            joinDate: new Date().toISOString().split('T')[0],
            status: 'active'
        };
        list.push(newRecord);
        localStorage.setItem(this.PORTAL_STAFF_KEY, JSON.stringify(list));
        console.log('[ATT-SYNC] Auto-saved new staff:', newRecord.fullName, newRecord.staffId);
        this._pushToServer('/api/att/staff', { data: list });
    },

    getAttendance() {
        return JSON.parse(localStorage.getItem(this.ATTENDANCE_KEY) || '[]');
    },
    getAttendanceByStaff(staffId) {
        return this.getAttendance().filter(a => a.staffId === staffId);
    },
    getAttendanceByDate(date) {
        return this.getAttendance().filter(a => a.date === date);
    },

    addAttendance(record) {
        const records = this.getAttendance();
        const idx = records.findIndex(r => r.staffId === record.staffId && r.date === record.date);
        if (idx !== -1) records[idx] = record; else records.push(record);
        localStorage.setItem(this.ATTENDANCE_KEY, JSON.stringify(records));
        this._pushToServer('/api/att/records', { data: record });
    },

    getLeaves() {
        return JSON.parse(localStorage.getItem(this.LEAVE_KEY) || '[]');
    },
    getLeavesByStaff(staffId) {
        return this.getLeaves().filter(l => l.staffId === staffId);
    },
    addLeave(leave) {
        const list = this.getLeaves();
        const num = parseInt(localStorage.getItem('nextLeaveId') || '1');
        leave.id = `LV${String(num).padStart(3, '0')}`;
        leave.status = 'pending';
        leave.appliedOn = new Date().toISOString().split('T')[0];
        list.push(leave);
        localStorage.setItem(this.LEAVE_KEY, JSON.stringify(list));
        localStorage.setItem('nextLeaveId', String(num + 1));
        this._pushToServer('/api/att/leaves', { data: leave });
        return leave;
    },
    updateLeave(id, updates) {
        const list = this.getLeaves();
        const idx = list.findIndex(l => l.id === id);
        if (idx !== -1) {
            list[idx] = { ...list[idx], ...updates };
            localStorage.setItem(this.LEAVE_KEY, JSON.stringify(list));
            this._pushToServer('/api/att/leaves', { data: list[idx] });
            return list[idx];
        }
        return null;
    },

    getTimingsForStaff(staffId) {
        try {
            var all = JSON.parse(localStorage.getItem(this.STAFF_TIMINGS_KEY) || '{}');
            if (all[staffId]) return Object.assign({}, this.DEFAULT_TIMINGS, all[staffId]);
        } catch (e) {}
        return Object.assign({}, this.DEFAULT_TIMINGS);
    },

    saveTimingsForStaff(staffId, timings) {
        try {
            var all = JSON.parse(localStorage.getItem(this.STAFF_TIMINGS_KEY) || '{}');
            all[staffId] = timings;
            localStorage.setItem(this.STAFF_TIMINGS_KEY, JSON.stringify(all));
            var payload = {};
            payload[staffId] = timings;
            this._pushToServer('/api/att/timings', { data: payload });
            console.log('[ATT-SYNC] Timings saved for', staffId, timings);
        } catch (e) { console.error('[ATT-SYNC] saveTimingsForStaff error:', e); }
    },

    getAllStaffTimings() {
        try { return JSON.parse(localStorage.getItem(this.STAFF_TIMINGS_KEY) || '{}'); } catch (e) { return {}; }
    },

    getMonthlyReport(staffId, year, month) {
        const records = this.getAttendanceByStaff(staffId);
        const filtered = records.filter(r => {
            const d = new Date(r.date);
            return d.getFullYear() === year && d.getMonth() === month;
        });
        const present = filtered.filter(r => r.status === 'present' || r.status === 'late').length;
        const late = filtered.filter(r => r.status === 'late').length;
        const absent = filtered.filter(r => r.status === 'absent').length;
        const totalHours = filtered.reduce((sum, r) => sum + (r.hours || 0), 0);
        return { totalDays: filtered.length, present, late, absent, totalHours: parseFloat(totalHours.toFixed(1)), records: filtered };
    },
    getDepartmentSummary() {
        const staff = this.getStaff().filter(s => s.status === 'active');
        const today = new Date().toISOString().split('T')[0];
        const todayRecords = this.getAttendanceByDate(today);
        const depts = {};
        staff.forEach(s => {
            if (!depts[s.department]) depts[s.department] = { total: 0, present: 0, absent: 0, late: 0 };
            depts[s.department].total++;
            const rec = todayRecords.find(r => r.staffId === s.id);
            if (rec) {
                if (rec.status === 'absent') depts[s.department].absent++;
                else if (rec.status === 'late') depts[s.department].late++;
                else depts[s.department].present++;
            } else {
                depts[s.department].absent++;
            }
        });
        return depts;
    }
};

DataStore.init();
