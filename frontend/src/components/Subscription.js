// File purpose: Application logic for this Netflix Clone module.
import { useMemo, useState } from 'react';

const PLANS = [
  { id: 'mobile', label: 'Mobile', price: 199, quality: '480p', devices: 1 },
  { id: 'basic', label: 'Basic', price: 499, quality: '720p', devices: 1 },
  { id: 'standard', label: 'Standard', price: 799, quality: '1080p', devices: 2 },
  { id: 'premium', label: 'Premium', price: 1099, quality: '4K + HDR', devices: 4 },
];

const SERVICES = [
  { id: 'streaming-hd', label: 'HD Streaming', price: 0 },
  { id: 'download-pack', label: 'Offline Downloads', price: 50 },
  { id: 'family-pack', label: 'Family Profiles', price: 99 },
  { id: 'sports-plus', label: 'Sports Plus', price: 149 },
];

const GPAY_UPI_ID = (process.env.REACT_APP_GPAY_UPI_ID || 'yourname@okaxis').trim();
const GPAY_NAME = (process.env.REACT_APP_GPAY_NAME || 'Netflix Clone').trim();

function Subscription({ user, onUserUpdate }) {
  const currentPlan = user?.subscription?.plan || 'basic';
  const currentServices = Array.isArray(user?.subscription?.services) ? user.subscription.services : ['streaming-hd'];

  const [selectedPlan, setSelectedPlan] = useState(currentPlan);
  const [selectedServices, setSelectedServices] = useState(currentServices);
  const [statusMessage, setStatusMessage] = useState('');
  const [isPaying, setIsPaying] = useState(false);

  const planPrice = useMemo(
    () => PLANS.find((plan) => plan.id === selectedPlan)?.price || 0,
    [selectedPlan]
  );

  const servicePrice = useMemo(
    () => SERVICES
      .filter((service) => selectedServices.includes(service.id))
      .reduce((total, service) => total + service.price, 0),
    [selectedServices]
  );

  const nextBillingDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toLocaleDateString();
  }, []);

  const totalPrice = (planPrice + servicePrice).toFixed(2);

  const gpayDeepLink = useMemo(() => {
    const amount = Number(totalPrice).toFixed(2);
    const params = new URLSearchParams({
      pa: GPAY_UPI_ID,
      pn: GPAY_NAME,
      am: amount,
      cu: 'INR',
      tn: 'Netflix Clone subscription',
    });
    return `upi://pay?${params.toString()}`;
  }, [totalPrice]);

  const onToggleService = (serviceId) => {
    setStatusMessage('');
    setSelectedServices((current) => {
      if (current.includes(serviceId)) {
        return current.filter((id) => id !== serviceId);
      }
      return [...current, serviceId];
    });
  };

  const onSaveSubscription = () => {
    if (!onUserUpdate || !user) {
      return;
    }

    setStatusMessage('');
    setIsPaying(true);
    try {
      const renewalDate = new Date();
      renewalDate.setDate(renewalDate.getDate() + 30);

      onUserUpdate({
        ...user,
        subscription: {
          plan: selectedPlan,
          status: 'active',
          services: selectedServices.length ? selectedServices : ['streaming-hd'],
          renewalDate: renewalDate.toISOString(),
        },
      });
      setStatusMessage('Subscription updated. Please complete payment in Google Pay.');
    } catch (error) {
      setStatusMessage(error.message || 'Unable to update subscription.');
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <div className="mx-auto mt-10 w-full max-w-5xl rounded-lg border border-neutral-800 bg-neutral-900/90 p-6 text-white shadow-lg">
      <h2 className="text-2xl font-bold">Subscription Services</h2>
      <p className="mt-2 text-sm text-neutral-300">Pick your plan and add-on services.</p>

      <section className="mt-6">
        <h3 className="text-lg font-semibold">Plans</h3>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => {
                setStatusMessage('');
                setSelectedPlan(plan.id);
              }}
              className={`rounded-md border px-4 py-3 text-left transition ${
                selectedPlan === plan.id
                  ? 'border-red-500 bg-red-500/10'
                  : 'border-neutral-700 bg-neutral-900 hover:border-neutral-500'
              }`}
            >
              <p className="text-base font-semibold">{plan.label}</p>
              <p className="mt-1 text-sm text-neutral-300">Rs {plan.price.toFixed(2)} / month</p>
              <p className="text-xs text-neutral-400">{plan.quality}</p>
              <p className="text-xs text-neutral-400">{plan.devices} device(s)</p>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h3 className="text-lg font-semibold">Add-on Services</h3>
        <div className="mt-3 space-y-2">
          {SERVICES.map((service) => (
            <label
              key={service.id}
              className="flex items-center justify-between rounded-md border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm"
            >
              <span>{service.label}</span>
              <div className="flex items-center gap-4">
                <span className="text-neutral-300">
                  {service.price ? `+Rs ${service.price.toFixed(2)}` : 'Included'}
                </span>
                <input
                  type="checkbox"
                  checked={selectedServices.includes(service.id)}
                  onChange={() => onToggleService(service.id)}
                />
              </div>
            </label>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-md border border-neutral-700 bg-black/40 p-4">
        <h3 className="text-lg font-semibold">Billing Summary</h3>
        <p className="mt-2 text-sm text-neutral-300">Next billing date: {nextBillingDate}</p>
        <p className="mt-1 text-sm text-neutral-300">Subscription status: active</p>
        <p className="mt-3 text-xl font-bold">Rs {totalPrice} / month</p>
      </section>

      <section className="mt-6 rounded-md border border-neutral-700 bg-neutral-950/80 p-4">
        <h3 className="text-lg font-semibold">Google Pay</h3>
        <p className="mt-2 text-sm text-neutral-300">Pay manually using UPI ID: <span className="font-semibold text-white">{GPAY_UPI_ID}</span></p>
        <a
          href={gpayDeepLink}
          className="mt-3 inline-block rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
        >
          Open Google Pay
        </a>
      </section>

      {statusMessage && <p className="mt-4 text-sm text-green-400">{statusMessage}</p>}

      <button
        type="button"
        disabled={isPaying}
        onClick={onSaveSubscription}
        className="mt-6 w-full rounded bg-red-600 py-2 font-semibold transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPaying ? 'Updating subscription...' : 'Activate Subscription'}
      </button>
    </div>
  );
}

export default Subscription;
