import React from 'react';

export const UnauthorizedPage = () => {
  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '1rem' }}>403 - Từ chối truy cập</h1>
      <p style={{ color: '#9499A8' }}>Nội dung 403 - Từ chối truy cập đang được đồng bộ và tải dữ liệu.</p>
    </div>
  );
};

export default UnauthorizedPage;
