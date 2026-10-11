export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // Prioritize absolute backend URL so server-side fetch does not fail with relative URL
  const backendUrl = (
    process.env.BACKEND_URL ||
    (process.env.NEXT_PUBLIC_HOST && process.env.NEXT_PUBLIC_HOST.startsWith('http') ? process.env.NEXT_PUBLIC_HOST : null) ||
    'https://api.anwesha.co.in'
  ).replace(/\/+$/, '');

  const wantsJson =
    req.headers.accept?.includes('application/json') ||
    req.headers['content-type']?.includes('application/json') ||
    req.query.format === 'json';

  // Extract any identifiable order ID from body or query for tracking
  const payloadSource = req.method === 'POST' ? req.body : req.query;
  let extractedOrderId =
    payloadSource?.order_id ||
    payloadSource?.orderId ||
    payloadSource?.merchTxnId ||
    payloadSource?.merch_txn_id ||
    req.query?.order ||
    req.query?.order_id ||
    null;

  // Prepare form-urlencoded payload for backend Lambda verify handler
  let forwardBody = '';
  if (typeof payloadSource === 'string') {
    forwardBody = payloadSource;
  } else if (payloadSource && typeof payloadSource === 'object') {
    const sp = new URLSearchParams();
    for (const [key, value] of Object.entries(payloadSource)) {
      if (value !== undefined && value !== null) {
        sp.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
      }
    }
    forwardBody = sp.toString();
  }

  // Setup abort controller for timeout tracking
  const controller = new AbortController();
  const timeoutMs = parseInt(process.env.PAYMENT_VERIFY_TIMEOUT_MS || '15000', 10);
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const verifyRes = await fetch(`${backendUrl}/payment/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json, text/plain, */*'
      },
      body: forwardBody,
      signal: controller.signal,
      redirect: 'manual'
    });
    clearTimeout(timeoutId);

    // 1. If backend redirected (302) to payment-status page
    if (verifyRes.status >= 300 && verifyRes.status < 400) {
      const location = verifyRes.headers.get('location');
      if (location) {
        let redirectUrl;
        try {
          redirectUrl = new URL(location, 'https://anwesha.live');
        } catch {
          redirectUrl = new URL(`/payment-status?${location.replace(/^[^?]*\?/, '')}`, 'https://anwesha.live');
        }

        const orderId = redirectUrl.searchParams.get('order') || extractedOrderId || 'UNKNOWN';
        const isSuccess = redirectUrl.searchParams.get('success') === 'true';
        const status = redirectUrl.searchParams.get('status') || (isSuccess ? 'PAID' : 'FAILED');
        const reason = redirectUrl.searchParams.get('reason') || redirectUrl.searchParams.get('error') || '';
        const message = redirectUrl.searchParams.get('message') || '';

        if (wantsJson) {
          return res.status(isSuccess ? 200 : 400).json({
            success: isSuccess,
            status,
            order_id: orderId,
            error: isSuccess ? undefined : (reason || 'payment_not_confirmed'),
            message: message || (isSuccess ? 'Payment confirmed successfully' : 'Payment verification was not successful'),
            redirect_url: `/payment-status${redirectUrl.search}`
          });
        }

        return res.redirect(302, `/payment-status${redirectUrl.search}`);
      }
    }

    // 2. If backend returned JSON or plain response
    const rawText = await verifyRes.text().catch(() => '');
    let verifyData = {};
    try {
      verifyData = JSON.parse(rawText);
    } catch {
      verifyData = {};
    }

    const orderId = verifyData.order_id || verifyData.orderId || extractedOrderId || 'UNKNOWN';
    const isSuccess = Boolean(verifyData.success || verifyData.status === 'PAID');
    const status = verifyData.status || (isSuccess ? 'PAID' : (verifyRes.status === 408 || verifyRes.status === 504 ? 'TIMEOUT' : 'FAILED'));
    const errorCode = verifyData.error || (!isSuccess ? (verifyData.message || `status_${verifyRes.status}`) : undefined);
    const message = verifyData.message || (isSuccess ? 'Payment verified successfully' : 'Payment verification failed');

    if (wantsJson) {
      return res.status(verifyRes.ok ? 200 : verifyRes.status || 400).json({
        success: isSuccess,
        status,
        order_id: orderId,
        error: errorCode,
        message,
        data: verifyData
      });
    }

    const sp = new URLSearchParams({
      order: String(orderId),
      success: String(isSuccess),
      status: String(status)
    });
    if (errorCode) sp.set('error', String(errorCode));
    if (message) sp.set('message', String(message));

    return res.redirect(302, `/payment-status?${sp.toString()}`);

  } catch (error) {
    clearTimeout(timeoutId);
    console.error('Payment Verification Error:', error);

    const isTimeout =
      error.name === 'AbortError' ||
      error.code === 'ETIMEDOUT' ||
      error.message?.toLowerCase().includes('timeout') ||
      error.message?.toLowerCase().includes('aborted');

    const status = isTimeout ? 'TIMEOUT' : 'FAILED';
    const errorCode = isTimeout ? 'timeout' : 'verification_error';
    const errorMessage = isTimeout
      ? 'Payment verification timed out while waiting for confirmation from payment gateway'
      : (error.message || 'Payment verification failed');

    const orderId = extractedOrderId || 'UNKNOWN';

    if (wantsJson) {
      return res.status(isTimeout ? 504 : 500).json({
        success: false,
        status,
        order_id: orderId,
        error: errorCode,
        message: errorMessage
      });
    }

    const sp = new URLSearchParams({
      order: String(orderId),
      success: 'false',
      status: status,
      error: errorCode,
      message: errorMessage
    });

    return res.redirect(302, `/payment-status?${sp.toString()}`);
  }
}
