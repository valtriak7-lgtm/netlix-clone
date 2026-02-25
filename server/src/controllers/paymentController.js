// File purpose: Application logic for this Netflix Clone module.
const crypto = require('crypto');
const mongoose = require('mongoose');
const fetch = require('node-fetch');
const User = require('../models/User');

const PLAN_PRICES_INR = {
  mobile: 199,
  basic: 499,
  standard: 799,
  premium: 1099,
};

const SERVICE_PRICES_INR = {
  'streaming-hd': 0,
  'download-pack': 50,
  'family-pack': 99,
  'sports-plus': 149,
};

function sanitizeUser(userDoc) {
  return {
    id: userDoc._id.toString(),
    name: userDoc.name,
    email: userDoc.email,
    avatar: userDoc.avatar,
    role: userDoc.role || 'user',
    subscription: {
      plan: userDoc.subscription?.plan || 'basic',
      status: userDoc.subscription?.status || 'active',
      services: Array.isArray(userDoc.subscription?.services) ? userDoc.subscription.services : [],
      renewalDate: userDoc.subscription?.renewalDate || null,
    },
    createdAt: userDoc.createdAt,
  };
}

function assertDbConnected() {
  if (mongoose.connection.readyState !== 1) {
    const error = new Error('Database is not connected. Check server MongoDB config.');
    error.status = 503;
    throw error;
  }
}

function assertRazorpayConfigured() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    const error = new Error('Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
    error.status = 500;
    throw error;
  }
}

function normalizePlan(plan) {
  const value = String(plan || '').trim().toLowerCase();
  if (!PLAN_PRICES_INR[value]) {
    return null;
  }
  return value;
}

function normalizeServices(services) {
  if (!Array.isArray(services)) {
    return ['streaming-hd'];
  }

  const deduped = [...new Set(services.map((value) => String(value || '').trim().toLowerCase()))]
    .filter((value) => Object.prototype.hasOwnProperty.call(SERVICE_PRICES_INR, value));

  return deduped.length ? deduped : ['streaming-hd'];
}

function computeAmountPaise(plan, services) {
  const planPrice = PLAN_PRICES_INR[plan] || 0;
  const servicesPrice = services.reduce((total, serviceId) => total + (SERVICE_PRICES_INR[serviceId] || 0), 0);
  return Math.round((planPrice + servicesPrice) * 100);
}

async function createOrder(req, res, next) {
  try {
    assertDbConnected();
    assertRazorpayConfigured();

    const { userId = '', plan = '', services = [] } = req.body || {};
    if (!String(userId).trim()) {
      return res.status(400).json({ message: 'User id is required.' });
    }

    const safePlan = normalizePlan(plan);
    if (!safePlan) {
      return res.status(400).json({ message: 'Invalid plan selected.' });
    }

    const safeServices = normalizeServices(services);
    const amount = computeAmountPaise(safePlan, safeServices);
    const currency = process.env.RAZORPAY_CURRENCY || 'INR';
    const receipt = `sub_${String(userId).trim()}_${Date.now()}`;

    const orderResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
        ).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount,
        currency,
        receipt,
        notes: {
          userId: String(userId).trim(),
          plan: safePlan,
          services: safeServices.join(','),
        },
      }),
    });

    const payload = await orderResponse.json().catch(() => ({}));
    if (!orderResponse.ok) {
      return res.status(502).json({
        message: payload?.error?.description || 'Unable to create Razorpay order.',
      });
    }

    return res.status(200).json({
      message: 'Order created',
      data: {
        orderId: payload.id,
        amount: payload.amount,
        currency: payload.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        plan: safePlan,
        services: safeServices,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function verifyPayment(req, res, next) {
  try {
    assertDbConnected();
    assertRazorpayConfigured();

    const {
      userId = '',
      plan = '',
      services = [],
      razorpay_order_id: orderId = '',
      razorpay_payment_id: paymentId = '',
      razorpay_signature: signature = '',
    } = req.body || {};

    if (!String(userId).trim()) {
      return res.status(400).json({ message: 'User id is required.' });
    }
    if (!String(orderId).trim() || !String(paymentId).trim() || !String(signature).trim()) {
      return res.status(400).json({ message: 'Missing payment verification fields.' });
    }

    const safePlan = normalizePlan(plan);
    if (!safePlan) {
      return res.status(400).json({ message: 'Invalid plan selected.' });
    }
    const safeServices = normalizeServices(services);

    const body = `${String(orderId).trim()}|${String(paymentId).trim()}`;
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    const receivedBuffer = Buffer.from(String(signature).trim());
    const expectedBuffer = Buffer.from(expected);
    if (
      receivedBuffer.length !== expectedBuffer.length
      || !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
    ) {
      return res.status(400).json({ message: 'Invalid payment signature.' });
    }

    const user = await User.findById(String(userId).trim());
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const renewalDate = new Date();
    renewalDate.setDate(renewalDate.getDate() + 30);

    user.subscription = {
      plan: safePlan,
      status: 'active',
      services: safeServices,
      renewalDate,
    };
    await user.save();

    return res.status(200).json({
      message: 'Payment verified and subscription updated.',
      data: {
        user: sanitizeUser(user),
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createOrder,
  verifyPayment,
};

