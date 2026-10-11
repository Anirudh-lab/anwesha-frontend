import React from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function PaymentStatusPage() {
  const router = useRouter();
  const { order, success, status, error, message } = router.query;

  const isSuccess = success === 'true' || status === 'PAID';
  const isTimeout = status === 'TIMEOUT' || error === 'timeout';
  const isCancelled = status === 'CANCELLED';

  let icon = '✕';
  let iconBg = '#991b1b';
  let titleColor = '#f87171';
  let title = 'Payment Failed';
  let description = message || 'Your payment could not be processed. Please try again.';

  if (isSuccess) {
    icon = '✓';
    iconBg = '#166534';
    titleColor = '#4ade80';
    title = 'Payment Successful!';
    description = message || 'Your transaction has been confirmed and registered successfully.';
  } else if (isTimeout) {
    icon = '⏱';
    iconBg = '#854d0e';
    titleColor = '#fbbf24';
    title = 'Payment Verification Timed Out';
    description = message || 'Verification timed out while waiting for confirmation from payment gateway. If money was deducted, it will automatically update once verified, or be refunded by your bank within 3-5 business days.';
  } else if (isCancelled) {
    icon = '⊘';
    iconBg = '#475569';
    titleColor = '#94a3b8';
    title = 'Payment Cancelled';
    description = message || 'The transaction was cancelled before completion. No amount was charged.';
  }

  const displayStatus = status || (isSuccess ? 'PAID' : isTimeout ? 'TIMEOUT' : isCancelled ? 'CANCELLED' : 'FAILED');

  return (
    <div style={{ maxWidth: '38rem', margin: '4rem auto', padding: '2.5rem', fontFamily: 'system-ui, sans-serif', backgroundColor: '#0f172a', color: '#f8fafc', borderRadius: '1rem', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}>
      <div style={{ width: '4.5rem', height: '4.5rem', borderRadius: '50%', backgroundColor: iconBg, color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.25rem', margin: '0 auto 1.5rem', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)' }}>
        {icon}
      </div>

      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.75rem', color: titleColor }}>
        {title}
      </h1>

      <p style={{ color: '#94a3b8', marginBottom: '1.5rem', lineHeight: '1.6', fontSize: '0.95rem' }}>
        {description}
      </p>

      {(order || status || error) && (
        <div style={{ padding: '1.25rem', backgroundColor: '#1e293b', borderRadius: '0.75rem', marginBottom: '1.75rem', fontSize: '0.875rem', fontFamily: 'monospace', textAlign: 'left', border: '1px solid #334155' }}>
          {order && <p style={{ marginBottom: '0.5rem' }}><strong>Order ID:</strong> <span style={{ color: '#38bdf8' }}>{order}</span></p>}
          <p style={{ marginBottom: (error || message) ? '0.5rem' : '0' }}><strong>Status:</strong> <span style={{ color: isSuccess ? '#4ade80' : isTimeout ? '#fbbf24' : '#f87171', fontWeight: 'bold' }}>{displayStatus}</span></p>
          {error && <p style={{ marginBottom: message ? '0.5rem' : '0' }}><strong>Error / Reason:</strong> <span style={{ color: '#fca5a5' }}>{error}</span></p>}
          {message && message !== description && <p><strong>Details:</strong> <span style={{ color: '#cbd5e1' }}>{message}</span></p>}
        </div>
      )}

      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link href="/events" style={{ padding: '0.75rem 1.5rem', backgroundColor: '#0284c7', color: '#ffffff', borderRadius: '0.5rem', textDecoration: 'none', fontWeight: 600 }}>
          Back to Events
        </Link>
        <Link href="/profile" style={{ padding: '0.75rem 1.5rem', backgroundColor: '#334155', color: '#ffffff', borderRadius: '0.5rem', textDecoration: 'none', fontWeight: 600 }}>
          Go to Profile
        </Link>
      </div>
    </div>
  );
}
