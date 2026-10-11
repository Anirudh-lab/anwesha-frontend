import React, { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';

/* ------------------------------------------------------------------ */
/*  State configuration                                                */
/* ------------------------------------------------------------------ */
const STATES = {
  success: {
    label: 'Paid',
    accent: '#3ddc84',
    soft: 'rgba(61, 220, 132, 0.14)',
    ring: 'rgba(61, 220, 132, 0.45)',
    title: 'Payment successful',
    description: 'Your transaction has been confirmed and your registration is complete.',
    primary: { href: '/events', label: 'Back to events' },
    secondary: { href: '/profile', label: 'View my profile' },
  },
  timeout: {
    label: 'Timed out',
    accent: '#f0c05a',
    soft: 'rgba(240, 192, 90, 0.14)',
    ring: 'rgba(240, 192, 90, 0.45)',
    title: 'Verification timed out',
    description:
      'We did not hear back from the payment gateway in time. If money was deducted, your order will update automatically once verified, or your bank will refund it within 3–5 business days.',
    primary: { href: '/profile', label: 'Check my profile' },
    secondary: { href: '/events', label: 'Back to events' },
  },
  cancelled: {
    label: 'Cancelled',
    accent: '#b4a5c4',
    soft: 'rgba(180, 165, 196, 0.14)',
    ring: 'rgba(180, 165, 196, 0.4)',
    title: 'Payment cancelled',
    description: 'The transaction was cancelled before it was completed. You have not been charged.',
    primary: { href: '/events', label: 'Back to events' },
    secondary: { href: '/profile', label: 'Go to profile' },
  },
  failed: {
    label: 'Failed',
    accent: '#ff5c6e',
    soft: 'rgba(255, 92, 110, 0.14)',
    ring: 'rgba(255, 92, 110, 0.45)',
    title: 'Payment failed',
    description: 'Your payment could not be processed. No amount has been deducted.',
    primary: { href: '/events', label: 'Try again' },
    secondary: { href: '/profile', label: 'Go to profile' },
  },
};

/* ------------------------------------------------------------------ */
/*  Icons — bold, unambiguous: a tick for success, a cross for failure */
/* ------------------------------------------------------------------ */
const ICON_PATHS = {
  success: <path d="M6.5 12.5l3.6 3.6L17.5 8" />,
  timeout: (
    <>
      <circle cx="12" cy="12" r="0.01" />
      <path d="M12 7V12l3.2 2" />
    </>
  ),
  cancelled: <path d="M7.5 12h9" />,
  failed: <path d="M8 8l8 8M16 8l-8 8" />,
};

function StatusBadge({ kind, accent, soft, ring }) {
  return (
    <div className="badge" style={{ '--accent': accent, '--soft': soft, '--ring': ring }}>
      <div className="badge-ring" />
      <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke={accent} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {ICON_PATHS[kind]}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Small helpers                                                      */
/* ------------------------------------------------------------------ */
const pick = (v) => (Array.isArray(v) ? v[0] : v);

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable – fail silently */
    }
  };
  return (
    <button type="button" className="copy" onClick={copy} aria-label="Copy">
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function Row({ label, children, mono = false, copyValue }) {
  return (
    <div className="row">
      <dt>{label}</dt>
      <dd>
        <span className={mono ? 'mono' : ''}>{children}</span>
        {copyValue && <CopyButton value={copyValue} />}
      </dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function PaymentStatusPage() {
  const router = useRouter();
  const q = router.query;

  // Query params are empty on the first render – wait until the router is ready
  // so users never see a false "Payment failed" flash.
  const ready = router.isReady;

  const order = pick(q.order) || pick(q.merchTxnId) || pick(q.merch_txn_id);
  const success = pick(q.success);
  const status = pick(q.status);
  const error = pick(q.error);
  const message = pick(q.message);

  // Payment detail fields a gateway redirect commonly carries. All optional —
  // only the ones actually present in the URL get shown.
  const amount = pick(q.amount) || pick(q.amount_paid);
  const eventName = pick(q.eventName) || pick(q.event_name);
  const teamName = pick(q.teamName) || pick(q.team_name);
  const merchTxnId = pick(q.merchTxnId) || pick(q.merch_txn_id);
  const atomTxnId = pick(q.atomTxnId) || pick(q.atom_txn_id);
  const paymentMode = pick(q.paymentMode) || pick(q.payment_mode);
  const confirmedAt = pick(q.confirmedAt) || pick(q.confirmed_at);

  const kind =
    success === 'true' || status === 'PAID'
      ? 'success'
      : status === 'TIMEOUT' || error === 'timeout'
      ? 'timeout'
      : status === 'CANCELLED'
      ? 'cancelled'
      : 'failed';

  const s = STATES[kind];
  const description = message || s.description;
  const displayStatus = status || s.label;

  const detailRows = [
    eventName && { label: 'Event', value: eventName },
    teamName && { label: 'Team', value: teamName },
    amount && { label: 'Amount', value: `₹${amount}`, mono: true },
    order && { label: 'Order ID', value: order, mono: true, copy: order },
    merchTxnId && merchTxnId !== order && { label: 'Transaction reference', value: merchTxnId, mono: true, copy: merchTxnId },
    atomTxnId && { label: 'Gateway reference', value: atomTxnId, mono: true, copy: atomTxnId },
    paymentMode && { label: 'Payment mode', value: paymentMode },
    confirmedAt && { label: kind === 'success' ? 'Confirmed at' : 'Attempted at', value: confirmedAt },
    error && { label: 'Reason', value: error, mono: true },
    message && message !== description && { label: 'Details', value: message },
  ].filter(Boolean);

  const showDetails = detailRows.length > 0;

  return (
    <>

      <main className="page" style={{ '--accent': s.accent, '--soft': s.soft }}>
        <div className="glow" aria-hidden="true" />

        {!ready ? (
          <div className="loading" role="status" aria-live="polite">
            <div className="spinner" />
            <p>Checking your payment…</p>
          </div>
        ) : (
          <div className="wrap">

            <section className="card" aria-labelledby="status-title" role="status" aria-live="polite">
              {/* ---------- Outcome ---------- */}
              <div className="top">
                <StatusBadge kind={kind} accent={s.accent} soft={s.soft} ring={s.ring} />
                <span className="status-pill">{displayStatus}</span>
                <h1 id="status-title">{s.title}</h1>
                <p className="desc">{description}</p>
              </div>

              {/* ---------- Details ---------- */}
              {showDetails && (
                <>
                  <div className="divider" aria-hidden="true" />
                  <dl className="details">
                    {detailRows.map((row) => (
                      <Row key={row.label} label={row.label} mono={row.mono} copyValue={row.copy}>
                        {row.value}
                      </Row>
                    ))}
                  </dl>
                </>
              )}

              {/* ---------- Actions ---------- */}
              <div className="actions">
                <Link href={s.primary.href} className="btn primary">
                  {s.primary.label}
                </Link>
                <Link href={s.secondary.href} className="btn secondary">
                  {s.secondary.label}
                </Link>
              </div>

              {kind === 'timeout' && (
                <p className="help">
                  Still not updated after 24 hours? Email{' '}
                  <a href="mailto:dev.anweshaiitp@gmail.com">dev.anweshaiitp@gmail.com</a> with your order ID.
                </p>
              )}
              {kind === 'failed' && (
                <p className="help">
                  Facing a technical glitch? Email{' '}
                  <a href="mailto:dev.anweshaiitp@gmail.com">dev.anweshaiitp@gmail.com</a> and we'll help you out.
                </p>
              )}
            </section>
          </div>
        )}
      </main>

      <style jsx global>{`
        *,
        *::before,
        *::after {
          box-sizing: border-box;
        }
        html,
        body {
          margin: 0;
          background: #120a17;
        }
      `}</style>

      <style jsx>{`
        .page {
          position: relative;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 3rem 1.25rem;
          font-family: 'Manrope', system-ui, -apple-system, 'Segoe UI', sans-serif;
          color: #f3ecf7;
          background: #120a17;
          -webkit-font-smoothing: antialiased;
          overflow: hidden;
        }

        .glow {
          position: absolute;
          inset: 0;
          background: radial-gradient(42rem 28rem at 50% 8%, var(--soft), transparent 70%);
          pointer-events: none;
        }

        .wrap {
          position: relative;
          width: 100%;
          max-width: 30rem;
        }

        /* ---------- Brand ---------- */
        .brand {
          text-align: center;
          margin-bottom: 1.75rem;
        }
        .logo {
          width: 8rem;
          height: auto;
        }

        /* ---------- Card ---------- */
        .card {
          position: relative;
          background: linear-gradient(180deg, #1c1023 0%, #241530 100%);
          border: 1px solid rgba(212, 175, 78, 0.2);
          border-radius: 1.5rem;
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.03) inset,
            0 40px 80px -24px rgba(0, 0, 0, 0.7);
          overflow: hidden;
        }
        .card::before {
          content: '';
          position: absolute;
          inset: 0 0 auto 0;
          height: 3px;
          background: var(--accent);
          opacity: 0.9;
        }

        .top {
          padding: 3rem 2.25rem 2rem;
          text-align: center;
        }

        /* ---------- Status badge: large, unmistakable tick/cross ---------- */
        :global(.badge) {
          position: relative;
          width: 5.5rem;
          height: 5.5rem;
          margin: 0 auto 1.25rem;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: var(--soft);
          box-shadow: 0 0 0 1.5px var(--ring) inset;
          animation: pop 480ms cubic-bezier(0.2, 0.9, 0.3, 1.15) both;
        }
        :global(.badge-ring) {
          position: absolute;
          inset: -0.5rem;
          border-radius: 50%;
          border: 1px solid var(--ring);
          opacity: 0.5;
        }
        :global(.badge svg path) {
          stroke-dasharray: 44;
          stroke-dashoffset: 44;
          animation: draw 460ms 220ms ease-out forwards;
        }
        @keyframes pop {
          from {
            transform: scale(0.75);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes draw {
          to {
            stroke-dashoffset: 0;
          }
        }

        .status-pill {
          display: inline-block;
          padding: 0.3rem 0.85rem;
          margin-bottom: 1rem;
          border-radius: 999px;
          border: 1px solid var(--ring);
          background: var(--soft);
          color: var(--accent);
          font-size: 0.75rem;
          font-weight: 700;
        }

        h1 {
          margin: 0 0 0.65rem;
          font-size: 1.7rem;
          font-weight: 800;
          letter-spacing: -0.01em;
          line-height: 1.2;
          color: #f3ecf7;
        }

        .desc {
          margin: 0 auto;
          max-width: 23rem;
          font-size: 0.95rem;
          line-height: 1.65;
          color: #c3b5cd;
        }

        /* ---------- Divider ---------- */
        .divider {
          height: 1px;
          margin: 0 2.25rem;
          background: linear-gradient(90deg, rgba(212, 175, 78, 0) 0%, rgba(212, 175, 78, 0.35) 50%, rgba(212, 175, 78, 0) 100%);
        }

        /* ---------- Details ---------- */
        .details {
          margin: 0;
          padding: 1.5rem 2.25rem 0.5rem;
        }
        :global(.row) {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 1.25rem;
          padding: 0.7rem 0;
        }
        :global(.row + .row) {
          border-top: 1px solid rgba(212, 175, 78, 0.1);
        }
        :global(.row dt) {
          flex-shrink: 0;
          font-size: 0.82rem;
          font-weight: 500;
          color: #9c8aa8;
        }
        :global(.row dd) {
          margin: 0;
          min-width: 0;
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          text-align: right;
          font-size: 0.9rem;
          font-weight: 600;
          color: #f3ecf7;
          overflow-wrap: anywhere;
        }
        .mono {
          font-family: ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, Consolas, monospace;
          font-size: 0.84rem;
          font-variant-numeric: tabular-nums;
        }

        .copy {
          flex-shrink: 0;
          border: 1px solid rgba(212, 175, 78, 0.3);
          background: transparent;
          color: #c3b5cd;
          font: inherit;
          font-size: 0.7rem;
          font-weight: 600;
          padding: 0.2rem 0.5rem;
          border-radius: 0.4rem;
          cursor: pointer;
          transition: background 150ms, color 150ms, border-color 150ms;
        }
        .copy:hover {
          background: rgba(212, 175, 78, 0.12);
          color: #e7c165;
          border-color: rgba(212, 175, 78, 0.5);
        }
        .copy:focus-visible,
        :global(.btn:focus-visible) {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }

        /* ---------- Actions ---------- */
        .actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
          padding: 1.75rem 2.25rem 2.25rem;
        }
        :global(.btn) {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.85rem 1rem;
          border-radius: 999px;
          font-size: 0.9rem;
          font-weight: 700;
          text-decoration: none;
          text-align: center;
          transition: transform 120ms, filter 150ms, background 150ms, border-color 150ms;
        }
        :global(.btn:active) {
          transform: translateY(1px);
        }
        /* Primary stays on-brand gold regardless of outcome — same CTA
           treatment used across every confirmation and status touchpoint. */
        :global(.btn.primary) {
          background: linear-gradient(135deg, #f0d383, #d4af4e);
          color: #1c1023;
        }
        :global(.btn.primary:hover) {
          filter: brightness(1.05);
        }
        :global(.btn.secondary) {
          background: transparent;
          color: #f3ecf7;
          border: 1px solid rgba(212, 175, 78, 0.3);
        }
        :global(.btn.secondary:hover) {
          background: rgba(212, 175, 78, 0.08);
          border-color: rgba(212, 175, 78, 0.5);
        }

        .help {
          margin: -1rem 2.25rem 2rem;
          font-size: 0.78rem;
          line-height: 1.55;
          text-align: center;
          color: #9c8aa8;
        }
        .help a {
          color: #e7c165;
        }

        /* ---------- Loading ---------- */
        .loading {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          color: #c3b5cd;
          font-size: 0.9rem;
        }
        .loading p {
          margin: 0;
        }
        .spinner {
          width: 2.25rem;
          height: 2.25rem;
          border-radius: 50%;
          border: 3px solid rgba(212, 175, 78, 0.2);
          border-top-color: #d4af4e;
          animation: spin 800ms linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        /* ---------- Responsive & motion ---------- */
        @media (max-width: 480px) {
          .page {
            padding: 2rem 1rem;
          }
          .logo {
            width: 6.5rem;
          }
          .top {
            padding: 2.25rem 1.5rem 1.5rem;
          }
          .details {
            padding: 1.25rem 1.5rem 0.25rem;
          }
          .divider {
            margin: 0 1.5rem;
          }
          .actions {
            grid-template-columns: 1fr;
            padding: 1.25rem 1.5rem 1.75rem;
          }
          .help {
            margin: -0.75rem 1.5rem 1.5rem;
          }
          h1 {
            font-size: 1.45rem;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          :global(.badge),
          :global(.badge svg path),
          .spinner {
            animation: none;
          }
          :global(.badge svg path) {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </>
  );
}