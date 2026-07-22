(function() {
    var session = UnifiedAuth.getSession();
    if (!session || session.role !== 'admin') {
        window.location.href = '/index.html';
        return;
    }

    var STORAGE_KEY = 'iacss_employees_v1';
    var employees = loadEmployees();

    function loadEmployees() {
        try {
            var data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) { return []; }
    }

    function saveEmployees() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(employees)); } catch (e) {}
    }

    async function loadFromCloud() {
        try {
            var resp = await fetch('/api/auth/users');
            var result = await resp.json();
            if (result.success && result.users && result.users.length > 0) {
                employees = result.users;
                try { localStorage.setItem(STORAGE_KEY, JSON.stringify(employees)); } catch (e) {}
                renderTable();
            }
        } catch (e) {}
    }

    loadFromCloud();

    function getNextId() {
        var max = 0;
        employees.forEach(function(e) {
            var num = parseInt((e.employeeId || '').replace('EMP', ''), 10);
            if (num > max) max = num;
        });
        return 'EMP' + String(max + 1).padStart(3, '0');
    }

    window.openAddModal = function() {
        document.getElementById('formTitle').textContent = 'Add Staff';
        document.getElementById('editIndex').value = -1;
        clearForm();
        document.getElementById('f-empId').value = getNextId();
        document.getElementById('f-doj').value = new Date().toISOString().split('T')[0];
        document.getElementById('formModal').classList.add('active');
    };

    window.closeFormModal = function() {
        document.getElementById('formModal').classList.remove('active');
    };

    window.openEditModal = function(idx) {
        var emp = employees[idx];
        if (!emp) return;
        document.getElementById('formTitle').textContent = 'Edit Staff';
        document.getElementById('editIndex').value = idx;
        document.getElementById('f-fullName').value = emp.fullName || '';
        document.getElementById('f-dob').value = emp.dob || '';
        document.getElementById('f-phone').value = emp.phone || '';
        document.getElementById('f-emergency').value = emp.emergencyContact || '';
        document.getElementById('f-address').value = emp.address || '';
        document.getElementById('f-empId').value = emp.employeeId || '';
        document.getElementById('f-jobTitle').value = emp.jobTitle || '';
        document.getElementById('f-qualification').value = emp.qualification || '';
        document.getElementById('f-empType').value = emp.employmentType || '';
        document.getElementById('f-doj').value = emp.dateOfJoining || '';
        document.getElementById('f-location').value = emp.workLocation || '';
        document.getElementById('f-languages').value = emp.languages || '';
        document.getElementById('f-status').value = emp.status || 'active';

        if (emp.aadhaarDoc) {
            var u1 = document.getElementById('aadhaarUpload');
            u1.classList.add('has-file');
            u1.querySelector('.upload-text').textContent = 'File uploaded';
        }
        if (emp.qualDoc) {
            var u2 = document.getElementById('qualUpload');
            u2.classList.add('has-file');
            u2.querySelector('.upload-text').textContent = 'File uploaded';
        }

        document.getElementById('formModal').classList.add('active');
    };

    window.closeViewModal = function() {
        document.getElementById('viewModal').classList.remove('active');
    };

    window.viewEmployee = function(idx) {
        var emp = employees[idx];
        if (!emp) return;
        var html = '<div class="emp-detail-grid">';
        html += detail('Full Name', emp.fullName);
        html += detail('Employee ID', emp.employeeId);
        html += detail('Date of Birth', emp.dob);
        html += detail('Phone', emp.phone);
        html += detail('Emergency Contact', emp.emergencyContact);
        html += detail('Address', emp.address);
        html += detail('Job Title', emp.jobTitle);
        html += detail('Qualification', emp.qualification);
        html += detail('Employment Type', emp.employmentType);
        html += detail('Date of Joining', emp.dateOfJoining);
        html += detail('Work Location', emp.workLocation);
        html += detail('Languages', emp.languages);
        html += detail('Status', '<span class="badge badge-' + emp.status + '">' + emp.status + '</span>');
        html += '</div>';
        if (emp.aadhaarDoc || emp.qualDoc) {
            html += '<div class="section-title" style="margin-top:20px;">Documents</div>';
            if (emp.aadhaarDoc) html += '<p style="margin:4px 0;"><i class="bi bi-file-earmark"></i> Aadhaar Card: <a href="' + emp.aadhaarDoc + '" target="_blank" style="color:var(--primary);">View</a></p>';
            if (emp.qualDoc) html += '<p style="margin:4px 0;"><i class="bi bi-file-earmark"></i> Qualification Certificate: <a href="' + emp.qualDoc + '" target="_blank" style="color:var(--primary);">View</a></p>';
        }
        document.getElementById('viewContent').innerHTML = html;
        document.getElementById('viewEditBtn').onclick = function() { closeViewModal(); openEditModal(idx); };
        document.getElementById('viewModal').classList.add('active');
    };

    function detail(label, value) {
        return '<div class="detail-item"><div class="detail-label">' + label + '</div><div class="detail-value">' + (value || '-') + '</div></div>';
    }

    window.handleFile = function(input, type) {
        var upload = input.closest('.file-upload');
        if (input.files && input.files[0]) {
            upload.classList.add('has-file');
            upload.querySelector('.upload-text').textContent = input.files[0].name;
        } else {
            upload.classList.remove('has-file');
            upload.querySelector('.upload-text').textContent = 'No file chosen';
        }
    };

    window.deleteEmployee = function(idx) {
        if (!confirm('Delete this staff member? This cannot be undone.')) return;
        var empId = employees[idx].employeeId;
        employees.splice(idx, 1);
        saveEmployees();
        renderTable();
        if (typeof CloudAPI !== 'undefined' && empId) {
            CloudAPI.syncEmployees('delete', empId).catch(function() {});
        }
    };

    window.saveEmployee = function() {
        var idx = parseInt(document.getElementById('editIndex').value, 10);
        var data = {
            fullName: document.getElementById('f-fullName').value.trim(),
            dob: document.getElementById('f-dob').value,
            phone: document.getElementById('f-phone').value.trim(),
            emergencyContact: document.getElementById('f-emergency').value.trim(),
            address: document.getElementById('f-address').value.trim(),
            employeeId: document.getElementById('f-empId').value.trim(),
            jobTitle: document.getElementById('f-jobTitle').value.trim(),
            qualification: document.getElementById('f-qualification').value,
            employmentType: document.getElementById('f-empType').value,
            dateOfJoining: document.getElementById('f-doj').value,
            workLocation: document.getElementById('f-location').value.trim(),
            languages: document.getElementById('f-languages').value.trim(),
            status: document.getElementById('f-status').value
        };

        if (!data.fullName || !data.phone || !data.emergencyContact || !data.address || !data.jobTitle || !data.qualification || !data.employmentType || !data.dateOfJoining || !data.languages) {
            alert('Please fill in all required fields.');
            return;
        }

        var aadhaarFile = document.querySelector('#aadhaarUpload input[type="file"]').files[0];
        var qualFile = document.querySelector('#qualUpload input[type="file"]').files[0];

        function finishSave(aadhaarData, qualData) {
            if (aadhaarData) data.aadhaarDoc = aadhaarData;
            else if (idx >= 0 && employees[idx].aadhaarDoc) data.aadhaarDoc = employees[idx].aadhaarDoc;
            if (qualData) data.qualDoc = qualData;
            else if (idx >= 0 && employees[idx].qualDoc) data.qualDoc = employees[idx].qualDoc;
            data.updatedAt = new Date().toISOString();

            if (idx >= 0) {
                data.createdAt = employees[idx].createdAt;
                employees[idx] = data;
            } else {
                data.createdAt = new Date().toISOString();
                employees.push(data);
            }
            saveEmployees();
            closeFormModal();
            renderTable();
        }

        var pending = 0;
        var aadhaarResult = null;
        var qualResult = null;

        if (aadhaarFile) {
            pending++;
            var reader = new FileReader();
            reader.onload = function(e) { aadhaarResult = e.target.result; if (--pending === 0) finishSave(aadhaarResult, qualResult); };
            reader.readAsDataURL(aadhaarFile);
        }
        if (qualFile) {
            pending++;
            var reader2 = new FileReader();
            reader2.onload = function(e) { qualResult = e.target.result; if (--pending === 0) finishSave(aadhaarResult, qualResult); };
            reader2.readAsDataURL(qualFile);
        }
        if (pending === 0) finishSave(null, null);
    };

    function clearForm() {
        ['f-fullName','f-dob','f-phone','f-emergency','f-address','f-jobTitle','f-languages'].forEach(function(id) {
            document.getElementById(id).value = '';
        });
        ['f-qualification','f-empType','f-status'].forEach(function(id) {
            document.getElementById(id).selectedIndex = 0;
        });
        document.getElementById('f-location').value = 'Kovilpatti Head Office';
        document.getElementById('f-empId').value = '';
        ['aadhaarUpload','qualUpload'].forEach(function(id) {
            var u = document.getElementById(id);
            u.classList.remove('has-file');
            u.querySelector('.upload-text').textContent = 'No file chosen';
            u.querySelector('input[type="file"]').value = '';
        });
    }

    window.renderTable = function() {
        var search = (document.getElementById('searchInput').value || '').toLowerCase();
        var filterStatus = document.getElementById('filterStatus').value;
        var filterType = document.getElementById('filterType').value;

        var filtered = employees.filter(function(e) {
            if (filterStatus && e.status !== filterStatus) return false;
            if (filterType && e.employmentType !== filterType) return false;
            if (search) {
                var haystack = [e.fullName, e.employeeId, e.phone, e.jobTitle, e.qualification, e.languages].join(' ').toLowerCase();
                return haystack.indexOf(search) !== -1;
            }
            return true;
        });

        var total = employees.length;
        var active = employees.filter(function(e) { return e.status === 'active'; }).length;
        document.getElementById('statTotal').textContent = total;
        document.getElementById('statActive').textContent = active;
        document.getElementById('statInactive').textContent = total - active;

        var tbody = document.getElementById('employeeTable');
        var noData = document.getElementById('noData');

        if (filtered.length === 0) {
            tbody.innerHTML = '';
            noData.style.display = 'block';
            return;
        }
        noData.style.display = 'none';

        tbody.innerHTML = filtered.map(function(emp) {
            var idx = employees.indexOf(emp);
            return '<tr>'
                + '<td><div class="emp-name">' + esc(emp.fullName) + '</div><div class="emp-id">' + esc(emp.jobTitle || '') + '</div></td>'
                + '<td><code style="background:var(--bg-input);padding:2px 8px;border-radius:4px;font-size:0.8rem;">' + esc(emp.employeeId) + '</code></td>'
                + '<td>' + esc(emp.phone) + '</td>'
                + '<td>' + esc(emp.jobTitle || '-') + '</td>'
                + '<td>' + esc(emp.employmentType || '-') + '</td>'
                + '<td>' + (emp.dateOfJoining || '-') + '</td>'
                + '<td><span class="badge badge-' + emp.status + '">' + emp.status + '</span></td>'
                + '<td><div class="action-btns">'
                + '<button onclick="viewEmployee(' + idx + ')" title="View"><i class="bi bi-eye"></i></button>'
                + '<button onclick="openEditModal(' + idx + ')" title="Edit"><i class="bi bi-pencil"></i></button>'
                + '<button class="delete" onclick="deleteEmployee(' + idx + ')" title="Delete"><i class="bi bi-trash"></i></button>'
                + '</div></td></tr>';
        }).join('');
    };

    window.esc = function(str) {
        var div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    };

    renderTable();
})();
