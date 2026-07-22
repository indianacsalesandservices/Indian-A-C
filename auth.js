const UnifiedAuth = (() => {
  const USERS_KEY = 'iacss_unified_users';
  const SESSION_KEY = 'iacss_unified_session';
  const ATTENDANCE_KEY = 'iacss_unified_attendance';
  const SALT = 'iacss_unified_salt_v1';

  const DEFAULT_USERS = [
    { id: 1, username: 'Ramesh', password: 'Indiana/c', role: 'admin', fullName: 'Ramesh', source: 'attendance' },
    { id: 2, username: 'staff', password: 'staff123', role: 'staff', fullName: 'Staff Member', source: 'billing' }
  ];

  async function sha256(message) {
    var hash = 0x811c9dc5;
    var msg = message + SALT;
    for (var i = 0; i < msg.length; i++) {
      hash ^= msg.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    var h2 = 0x62b89943;
    for (var j = 0; j < msg.length; j++) {
      h2 ^= msg.charCodeAt(j);
      h2 = Math.imul(h2, 0x01000193);
      h2 = (h2 + (hash >>> 0)) | 0;
    }
    var h3 = 0xc58f1a7b;
    for (var k = 0; k < msg.length; k++) {
      h3 ^= msg.charCodeAt(k);
      h3 = Math.imul(h3, 0x01000193);
      h3 = (h3 + (h2 >>> 0)) | 0;
    }
    return (hash >>> 0).toString(16).padStart(8, '0') +
           (h2 >>> 0).toString(16).padStart(8, '0') +
           (h3 >>> 0).toString(16).padStart(8, '0');
  }

   function getUsers() {
     const data = localStorage.getItem(USERS_KEY);
     if (!data) {
       localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
       return [...DEFAULT_USERS];
     }
     return JSON.parse(data);
   }

   function saveUsers(users) {
     localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

    async function syncUsersToCloud(users) {
      console.log('[SYNC] Cloud sync removed, skipping push');
    }

   async function pullUsersFromServer() {
    try {
      var resp = await fetch('/api/auth/users');
      var result = await resp.json();
      if (result.success && result.users && result.users.length > 0) {
        var localUsers = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
        result.users.forEach(function(su) {
          var existing = localUsers.find(function(u) { return u.username && u.username.toLowerCase() === su.username.toLowerCase(); });
          if (existing) {
            existing.id = su.id;
            existing.role = su.role;
            existing.fullName = su.fullName;
            existing.source = 'server';
          } else {
            localUsers.push({ id: su.id, username: su.username, password: 'server_managed', role: su.role, fullName: su.fullName, source: 'server' });
          }
        });
        DEFAULT_USERS.forEach(function(def) {
          var match = localUsers.find(function(u) { return u.username && u.username.toLowerCase() === def.username.toLowerCase(); });
          if (!match) {
            localUsers.push(def);
          } else if (match.password === 'server_managed') {
            match.password = def.password;
          }
        });
        localStorage.setItem(USERS_KEY, JSON.stringify(localUsers));
        console.log('[AUTH] Server pull OK, merged', localUsers.length, 'users');
      }
    } catch (e) {
      console.log('[AUTH] Server pull unavailable:', e.message);
    }
   }

    var _cloudReady;

   async function ensureCloudReady() {
    if (_cloudReady) return _cloudReady;
    _cloudReady = (async function() {
      console.log('[SYNC] ensureCloudReady starting');
      await pullUsersFromServer();
      console.log('[SYNC] ensureCloudReady local users:', getUsers().length);
    })();
    return _cloudReady;
  }

  ensureCloudReady();

  async function login(username, password) {
    try {
      var resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username, password: password })
      });
      var result = await resp.json();
      if (result.success) {
        console.log('[AUTH] Server-side login OK for', username);
        return createSession(result.user);
      }
      console.log('[AUTH] Server login failed, falling back to localStorage');
    } catch (e) {
      console.log('[AUTH] Server login unavailable, falling back to localStorage:', e.message);
    }

    await ensureCloudReady();
    var users = getUsers();
    var hash = await sha256(password);

    var user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.passwordHash === hash);
    if (user) {
      return createSession(user);
    }
    var plainUser = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
    if (plainUser) {
      plainUser.passwordHash = await sha256(plainUser.password);
      saveUsers(users);
      return createSession(plainUser);
    }

    var defaultUser = DEFAULT_USERS.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
    if (defaultUser) {
      defaultUser.passwordHash = await sha256(defaultUser.password);
      var existing = users.find(u => u.username.toLowerCase() === username.toLowerCase());
      if (existing) {
        existing.password = defaultUser.password;
        existing.passwordHash = defaultUser.passwordHash;
        existing.role = defaultUser.role;
      } else {
        users.push(defaultUser);
      }
      saveUsers(users);
      return createSession(defaultUser);
    }

    return { success: false, message: 'Invalid username or password' }
  }

  function createSession(user) {
    const session = {
      id: user.id,
      username: user.username,
      role: user.role,
      fullName: user.fullName || user.username,
      loginTime: new Date().toISOString()
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { success: true, user: session };
  }

  function getSession() {
    const data = sessionStorage.getItem(SESSION_KEY);
    return data ? JSON.parse(data) : null;
  }

  function isAuthenticated() {
    return getSession() !== null;
  }

  function requireAuth() {
    if (!isAuthenticated()) {
      window.location.href = getBasePath() + 'index.html';
      return false;
    }
    return true;
  }

  function requireAdmin() {
    const session = getSession();
    if (!session || session.role !== 'admin') {
      return false;
    }
    return true;
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function getBasePath() {
    const path = window.location.pathname;
    if (path.endsWith('index.html') || path.endsWith('/')) {
      const parts = path.split('/').filter(Boolean);
      if (parts.length === 0) return './';
      const lastPart = parts[parts.length - 1];
      if (lastPart === 'index.html' || lastPart === '') {
        return './';
      }
    }
    const depth = window.location.pathname.split('/').filter(Boolean).length;
    if (depth <= 1) return './';
    return '../'.repeat(depth - 1);
  }

  async function recordAttendance(system) {
    const session = getSession();
    if (!session) return;

    if (typeof SecureAPI !== 'undefined') {
      try {
        await Promise.race([
          SecureAPI.logAttendance(session.username, system, session.role),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
        ]);
      } catch (e) {
        console.warn('Server attendance log skipped');
      }
    }

    const record = {
      id: Date.now(),
      username: session.username,
      fullName: session.fullName,
      role: session.role,
      system: system,
      timestamp: new Date().toISOString(),
      date: new Date().toLocaleDateString('en-CA'),
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      gpsCoords: null,
      location: null
    };

    var savedLoc = sessionStorage.getItem('iacss_saved_location');
    if (savedLoc) {
      try {
        var parsed = JSON.parse(savedLoc);
        if (parsed.coords) record.gpsCoords = parsed.coords;
        if (parsed.address) record.location = parsed.address;
      } catch (e) {}
    }

    if (!record.gpsCoords) {
      try {
        const pos = await Promise.race([
          new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 });
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 6000))
        ]);
        record.gpsCoords = pos.coords.latitude + ',' + pos.coords.longitude;
        try {
          const resp = await fetch('https://nominatim.openstreetmap.org/reverse?lat=' + pos.coords.latitude + '&lon=' + pos.coords.longitude + '&format=json');
          const data = await resp.json();
          record.location = data.display_name || 'GPS: ' + record.gpsCoords;
        } catch (e) {
          record.location = 'GPS: ' + record.gpsCoords;
        }
      } catch (e) {}
    }

    if (!record.gpsCoords) {
      try {
        const resp = await Promise.race([
          fetch('/api/geo'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
        ]);
        const geoData = await resp.json();
        if (geoData.success && geoData.coords) {
          record.gpsCoords = geoData.coords;
          record.location = geoData.address || 'GPS: ' + geoData.coords;
        }
      } catch (e) {}
    }

    if (!record.gpsCoords) {
      try {
        const resp = await Promise.race([
          fetch('http://ip-api.com/json/?fields=lat,lon,city,regionName,country'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
        ]);
        const ipData = await resp.json();
        if (ipData.status === 'success' && ipData.lat && ipData.lon) {
          record.gpsCoords = ipData.lat + ',' + ipData.lon;
          record.location = [ipData.city, ipData.regionName, ipData.country].filter(Boolean).join(', ');
        }
      } catch (e) {}
    }

    if (!record.location) {
      record.location = 'Location unavailable';
    }

    if (record.gpsCoords) {
      sessionStorage.setItem('iacss_saved_location', JSON.stringify({ coords: record.gpsCoords, address: record.location }));
    }

    const records = await getAttendanceRecords();
    records.unshift(record);
    if (records.length > 500) records.length = 500;
    localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(records));
    if (typeof CloudAPI !== 'undefined') {
      try { CloudAPI.syncSettings('set', ATTENDANCE_KEY, records); } catch (e) {}
    }
    return record;
  }

  async function getAttendanceRecords() {
    if (typeof SecureAPI !== 'undefined') {
      try {
        const result = await SecureAPI.getAttendanceRecords();
        if (result.success && result.records.length > 0) return result.records;
      } catch (e) {}
    }
    var data = localStorage.getItem(ATTENDANCE_KEY);
    if (data) return JSON.parse(data);
    if (typeof CloudAPI !== 'undefined') {
      try {
        var result = await CloudAPI.syncSettings('get', ATTENDANCE_KEY);
        if (result && result.success && result.data && Array.isArray(result.data) && result.data.length > 0) {
          localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(result.data));
          return result.data;
        }
      } catch (e) {}
    }
    return [];
  }

  async function addUser(username, password, role, fullName) {
    console.log('[SYNC] addUser called:', username, role);

    try {
      var resp = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username, password: password, role: role || 'staff', fullName: fullName || username })
      });
      var result = await resp.json();
      if (result.success) {
        console.log('[AUTH] Server-side register OK for', username);
        var serverUsers = getUsers();
        var existing = serverUsers.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (existing) {
          existing.password = password;
          existing.role = role || 'staff';
          existing.fullName = fullName || username;
        } else {
          serverUsers.push({ id: result.user ? result.user.id : Date.now(), username: username, password: password, role: role || 'staff', fullName: fullName || username, source: 'server' });
        }
        saveUsers(serverUsers);
        return { success: true };
      }
      return { success: false, message: result.message || 'Failed to create user' };
    } catch (e) {
      console.log('[AUTH] Server register unavailable, falling back to localStorage:', e.message);
    }

    var users = getUsers();
    if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
      return { success: false, message: 'Username already exists' };
    }
    var newUser = {
      id: Math.max(...users.map(u => u.id), 0) + 1,
      username,
      password,
      role: role || 'staff',
      fullName: fullName || username,
      source: 'portal'
    };
    users.push(newUser);
    saveUsers(users);
    console.log('[SYNC] addUser saved to localStorage, total users:', users.length);
    return { success: true };
  }

  async function deleteUser(userId) {
    try {
      var resp = await fetch('/api/auth/users/' + userId, { method: 'DELETE' });
      var result = await resp.json();
      if (result.success) {
        console.log('[AUTH] Server-side delete OK for', userId);
        return { success: true };
      }
    } catch (e) {
      console.log('[AUTH] Server delete unavailable, falling back to localStorage:', e.message);
    }

    const users = getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) return { success: false, message: 'User not found' };
    users.splice(idx, 1);
    saveUsers(users);
    return { success: true };
  }

  return {
    login,
    logout,
    getSession,
    isAuthenticated,
    requireAuth,
    requireAdmin,
    getBasePath,
    recordAttendance,
    getAttendanceRecords,
    getUsers,
    addUser,
    deleteUser,
    sha256,
    ensureCloudReady,
    pullUsersFromServer
  };
})();
