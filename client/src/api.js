async function request(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('इंटरनेट कनेक्शन चेक करें, सर्वर से संपर्क नहीं हो पाया');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `कुछ गड़बड़ हुई (${res.status})`);
    err.status = res.status;
    err.reason = data.reason;
    throw err;
  }
  return data;
}

export const api = {
  config: () => request('/config'),
  summary: () => request('/summary'),
  listCustomers: (search, sort) =>
    request(`/customers?${new URLSearchParams({ search: search || '', sort: sort || 'balance' })}`),
  addCustomer: (data) => request('/customers', { method: 'POST', body: data }),
  getCustomer: (id) => request(`/customers/${id}`),
  updateCustomer: (id, data) => request(`/customers/${id}`, { method: 'PATCH', body: data }),
  deleteCustomer: (id) => request(`/customers/${id}`, { method: 'DELETE' }),
  addTxn: (id, data) => request(`/customers/${id}/transactions`, { method: 'POST', body: data }),
  deleteTxn: (txnId) => request(`/transactions/${txnId}`, { method: 'DELETE' }),
  reminder: (id) => request(`/customers/${id}/reminder`),
  sendReminder: (id) => request(`/customers/${id}/reminder/send`, { method: 'POST' }),
  resolveQr: (code) => request('/qr/resolve', { method: 'POST', body: { code } }),
  recentScans: (limit = 8) => request(`/qr/scans?limit=${limit}`),
  clearScans: () => request('/qr/scans', { method: 'DELETE' }),
  regenerateQr: (id) => request(`/customers/${id}/qr/regenerate`, { method: 'POST' }),
  logReminder: (id) => request(`/customers/${id}/reminder/logged`, { method: 'POST' }),
};
