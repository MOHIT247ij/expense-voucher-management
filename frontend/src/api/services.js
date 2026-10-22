import { request } from './client';

const toFormData = (fields, fileField, file) => {
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => form.append(k, v ?? ''));
  if (file) form.append(fileField, file);
  return form;
};

export const authApi = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  me: () => request('/auth/me'),
  uploadSignature: (file) =>
    request('/users/me/signature', { method: 'POST', body: toFormData({}, 'signature', file) }),
  signatureBlob: () => request('/users/me/signature', { raw: true }).then((r) => r.blob()),
};

export const voucherApi = {
  meta: () => request('/meta'),
  dashboard: () => request('/dashboard'),
  list: (params) => request('/vouchers', { params }),
  get: (id) => request(`/vouchers/${id}`),
  create: (fields, signatureFile) =>
    request('/vouchers', { method: 'POST', body: toFormData(fields, 'employeeSignature', signatureFile) }),
  update: (id, fields, signatureFile) =>
    request(`/vouchers/${id}`, { method: 'PUT', body: toFormData(fields, 'employeeSignature', signatureFile) }),
  remove: (id) => request(`/vouchers/${id}`, { method: 'DELETE' }),
  submit: (id) => request(`/vouchers/${id}/submit`, { method: 'POST' }),
  approve: (id, signatureFile) =>
    request(`/vouchers/${id}/approve`, {
      method: 'POST',
      body: signatureFile ? toFormData({}, 'directorSignature', signatureFile) : undefined,
    }),
  reject: (id, reason) => request(`/vouchers/${id}/reject`, { method: 'POST', body: { reason } }),
  signatureBlob: (id, type) =>
    request(`/vouchers/${id}/signatures/${type}`, { raw: true }).then((r) => r.blob()),
};
