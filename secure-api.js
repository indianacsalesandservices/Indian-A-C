const SecureAPI = (() => {
  const SERVER_URL = window.location.origin;

  async function apiCall(endpoint, data) {
    const response = await fetch(SERVER_URL + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await response.json();
  }

  async function encrypt(plaintext, password) {
    const result = await apiCall('/api/encrypt', { data: plaintext, password: password || '' });
    if (result.success) return result.encrypted;
    throw new Error(result.error || 'Encryption failed');
  }

  async function decrypt(encrypted, password) {
    const result = await apiCall('/api/decrypt', { encrypted: encrypted, password: password || '' });
    if (result.success) return result.data;
    throw new Error(result.error || 'Decryption failed');
  }

  async function logAttendance(username, system, role) {
    const result = await apiCall('/api/attendance/log', {
      username: username,
      system: system,
      role: role || 'user'
    });
    return result;
  }

  async function getAttendanceRecords(filters) {
    const params = new URLSearchParams(filters || {});
    const response = await fetch(`${SERVER_URL}/api/attendance/records?${params.toString()}`);
    return await response.json();
  }

  async function clearAttendance() {
    const response = await fetch(SERVER_URL + '/api/attendance/clear', { method: 'POST' });
    return await response.json();
  }

  async function encryptFile(filepath, password) {
    const result = await apiCall('/api/data/encrypt-file', { filepath: filepath, password: password || '' });
    return result;
  }

  async function decryptFile(filepath, password) {
    const result = await apiCall('/api/data/decrypt-file', { filepath: filepath, password: password || '' });
    return result;
  }

  async function batchEncrypt(filepaths, password) {
    const result = await apiCall('/api/data/batch-encrypt', { files: filepaths, password: password || '' });
    return result;
  }

  async function batchDecrypt(filepaths, password) {
    const result = await apiCall('/api/data/batch-decrypt', { files: filepaths, password: password || '' });
    return result;
  }

  async function secureStore(key, data, password) {
    const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
    const encrypted = await encrypt(jsonStr, password);
    localStorage.setItem('enc_' + key, encrypted);
  }

  async function secureRetrieve(key, password) {
    const encrypted = localStorage.getItem('enc_' + key);
    if (!encrypted) return null;
    const decrypted = await decrypt(encrypted, password);
    try {
      return JSON.parse(decrypted);
    } catch (e) {
      return decrypted;
    }
  }

  return {
    encrypt,
    decrypt,
    logAttendance,
    getAttendanceRecords,
    clearAttendance,
    encryptFile,
    decryptFile,
    batchEncrypt,
    batchDecrypt,
    secureStore,
    secureRetrieve
  };
})();
