import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  CreditCard,
  QrCode,
  Sparkles,
  Plus,
  Minus,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Star,
  X,
  Radio
} from 'lucide-react';
import { bridge } from '../../miniapp-bridge';
import { Product, CartItem, PaymentProvider, RequestPaymentResult } from '../../types';

const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod_ble_beacon',
    title: 'Goat Pro Beacon Node',
    category: 'Hardware',
    price: 49.00,
    currency: 'USD',
    rating: 4.9,
    reviewsCount: 128,
    stock: 14,
    tag: 'Bestseller',
    image: '📡',
    description: 'Enterprise BLE 5.3 GATT beacon with ultra-low latency broadcasting and accelerometer telemetry.'
  },
  {
    id: 'prod_nfc_card',
    title: 'Titanium NFC Smart Card',
    category: 'Security',
    price: 29.00,
    currency: 'USD',
    rating: 4.8,
    reviewsCount: 94,
    stock: 25,
    tag: 'Encrypted',
    image: '💳',
    description: 'High-frequency NDEF writable titanium card with biometric vault authorization keys.'
  },
  {
    id: 'prod_sensor_hub',
    title: 'IoT 9-Axis Motion Hub',
    category: 'Sensors',
    price: 89.00,
    currency: 'USD',
    rating: 5.0,
    reviewsCount: 47,
    stock: 8,
    tag: 'New Gen',
    image: '🧭',
    description: 'Calibrated gyroscope, accelerometer, and magnetometer hub with 100Hz real-time bridge streaming.'
  },
  {
    id: 'prod_field_terminal',
    title: 'Rugged GPS Telemetry Tag',
    category: 'Field Service',
    price: 119.00,
    currency: 'USD',
    rating: 4.7,
    reviewsCount: 62,
    stock: 19,
    tag: 'Industrial',
    image: '📍',
    description: 'Sub-meter accurate RTK GPS logger with autonomous circular geofencing triggers.'
  }
];

export const EcommerceApp: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [cart, setCart] = useState<CartItem[]>([
    { product: INITIAL_PRODUCTS[0], quantity: 1 },
    { product: INITIAL_PRODUCTS[1], quantity: 2 }
  ]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider>('bakong');
  const [couponCode, setCouponCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentResult, setPaymentResult] = useState<RequestPaymentResult | null>(null);

  useEffect(() => {
    // Configure Native Navigation Bar for E-Commerce Mini-App
    bridge.setNavBar({
      title: 'Goat SuperApp Store',
      subtitle: 'Native Multi-Rail Checkout',
      backgroundColor: '#0f172a',
      textColor: '#ffffff',
      isDark: true
    }).catch(() => {});

    // Preload StoreKit / Play IAP products
    bridge.getPurchaseProducts(['stars_100', 'pro_subscription_monthly'])
      .catch(() => {});
  }, []);

  const categories = ['All', 'Hardware', 'Security', 'Sensors', 'Field Service'];

  const filteredProducts = selectedCategory === 'All'
    ? INITIAL_PRODUCTS
    : INITIAL_PRODUCTS.filter((p) => p.category === selectedCategory);

  const addToCart = async (product: Product) => {
    await bridge.triggerImpact('light');
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    await bridge.showToast({ title: `Added ${product.title}`, icon: 'success' });
  };

  const updateQuantity = async (productId: string, delta: number) => {
    await bridge.triggerSelection();
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const discountAmount = (subtotal * discountPercent) / 100;
  const tax = (subtotal - discountAmount) * 0.08;
  const shipping = subtotal > 100 || subtotal === 0 ? 0 : 9.99;
  const grandTotal = Math.max(0, subtotal - discountAmount + tax + shipping);

  const applyCoupon = async () => {
    if (couponCode.trim().toUpperCase() === 'GOAT2026') {
      setDiscountPercent(15);
      await bridge.triggerNotification('success');
      await bridge.showToast({ title: '15% Discount Applied!', icon: 'success' });
    } else {
      await bridge.triggerNotification('error');
      await bridge.showToast({ title: 'Invalid Promo Code', icon: 'error' });
    }
  };

  const openCheckoutSheet = async () => {
    if (cart.length === 0) {
      await bridge.showToast({ title: 'Cart is empty', icon: 'none' });
      return;
    }
    await bridge.triggerImpact('medium');
    setIsCheckoutOpen(true);

    // Call Native Bridge Bottom Sheet snap points
    try {
      await bridge.setSheetSnapPoints({
        snapPoints: [0.25, 0.65, 0.95],
        initialSnap: 0.95,
        isDismissible: true,
        showDragHandle: true
      });
      await bridge.expandBottomSheet(0.95);
    } catch (e) {
      console.warn('Native bottom sheet hook fallback:', e);
    }
  };

  const closeCheckoutSheet = async () => {
    setIsCheckoutOpen(false);
    try {
      await bridge.collapseBottomSheet();
    } catch {
      // ignore
    }
  };

  const executePayment = async () => {
    setIsProcessingPayment(true);
    setPaymentResult(null);

    try {
      await bridge.triggerImpact('heavy');

      const intentId = `pi_goat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const orderId = `ord_${Date.now()}`;

      // Multi-rail payment call
      const res = await bridge.requestPayment({
        provider: selectedProvider,
        orderId,
        intentId,
        amount: Math.round(grandTotal * 100),
        currency: 'USD',
        nonce: Math.random().toString(16).substring(2),
        signedPayload: `ed25519_sig_${intentId}_${grandTotal}`,
        metadata: {
          itemsCount: cart.length,
          discountApplied: discountPercent > 0
        }
      });

      setPaymentResult(res);
      await bridge.triggerNotification('success');
      // Clear cart on success
      setCart([]);
    } catch (err: any) {
      await bridge.triggerNotification('error');
      await bridge.showModal({
        title: 'Payment Error',
        content: err.message || 'Transaction could not be processed.'
      });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const executeIapPurchase = async (productId: string) => {
    try {
      await bridge.triggerImpact('medium');
      const invoice = await bridge.openInvoice({
        invoiceSlug: `iap_${productId}`,
        title: `StoreKit In-App: ${productId}`,
        amount: 299,
        currency: 'USD'
      });
      await bridge.showToast({
        title: `IAP ${invoice.status}: ${invoice.invoiceSlug}`,
        icon: 'success'
      });
    } catch (e: any) {
      await bridge.showToast({ title: e.message || 'IAP Error', icon: 'error' });
    }
  };

  return (
    <div className="pb-24 pt-3 px-4 max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Banner / Store Header */}
      <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-emerald-950/70 via-slate-900/80 to-slate-950 border border-emerald-500/20 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              Production Showcase Mini-App
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Enterprise E-Commerce & Hardware Store
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-xl">
              Equipped with Apple Pay, Google Pay, StoreKit 2 IAP, and Multi-Rail Payment Gateway (Alipay, Bakong KHQR Radar, PayPay).
            </p>
          </div>

          <button
            onClick={openCheckoutSheet}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/25 hover:brightness-110 active:scale-95 transition-all self-start md:self-auto touch-press"
          >
            <ShoppingBag className="w-4 h-4" />
            Cart ({cart.reduce((s, i) => s + i.quantity, 0)}) • ${grandTotal.toFixed(2)}
          </button>
        </div>
      </div>

      {/* Categories Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all touch-press ${
              selectedCategory === cat
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30 font-bold'
                : 'bg-slate-900/80 text-slate-400 border border-white/10 hover:text-white'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredProducts.map((product) => (
          <div
            key={product.id}
            className="glass-card rounded-2xl p-4 border border-white/10 flex flex-col justify-between hover:border-emerald-500/40 transition-all group"
          >
            <div>
              <div className="flex items-start justify-between">
                <span className="text-3xl p-3 bg-slate-800/80 rounded-2xl border border-white/10 shadow-inner group-hover:scale-110 transition-transform">
                  {product.image}
                </span>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {product.tag}
                </span>
              </div>

              <h3 className="font-bold text-white text-base mt-3 group-hover:text-emerald-300 transition-colors">
                {product.title}
              </h3>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                {product.description}
              </p>

              <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                <span className="flex items-center text-amber-400 font-semibold">
                  <Star className="w-3.5 h-3.5 fill-amber-400 mr-1" />
                  {product.rating}
                </span>
                <span>•</span>
                <span>{product.reviewsCount} reviews</span>
                <span>•</span>
                <span className="text-emerald-400 font-mono">{product.stock} in stock</span>
              </div>
            </div>

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
              <span className="text-lg font-black text-white font-mono">
                ${product.price.toFixed(2)}
              </span>

              <button
                onClick={() => addToCart(product)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold hover:bg-emerald-500 hover:text-slate-950 transition-all touch-press active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                Add to Cart
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* In-App Purchases / StoreKit 2 Section */}
      <div className="glass-card rounded-2xl p-4 border border-purple-500/20 bg-gradient-to-br from-purple-950/40 via-slate-900/60 to-slate-950">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-bold text-white tracking-wide">
              StoreKit 2 / Google Play In-App Purchase Rails
            </h2>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
            OPEN_INVOICE
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10 flex items-center justify-between">
            <div>
              <div className="font-semibold text-xs text-white">100 SuperApp Stars</div>
              <div className="text-[11px] text-slate-400 font-mono">$1.99 • Micro-credits</div>
            </div>
            <button
              onClick={() => executeIapPurchase('stars_100')}
              className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-bold hover:bg-purple-500 active:scale-95 transition-all touch-press"
            >
              Buy Stars
            </button>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10 flex items-center justify-between">
            <div>
              <div className="font-semibold text-xs text-white">Goat Enterprise Pro</div>
              <div className="text-[11px] text-slate-400 font-mono">$9.99/mo • Auto-Renew</div>
            </div>
            <button
              onClick={() => executeIapPurchase('pro_subscription_monthly')}
              className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-bold hover:bg-purple-500 active:scale-95 transition-all touch-press"
            >
              Subscribe
            </button>
          </div>
        </div>
      </div>

      {/* Native Bottom-Sheet Checkout Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl bg-slate-900 border-t border-x border-emerald-500/30 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                <h2 className="font-bold text-white text-lg">
                  Native Multi-Rail Checkout
                </h2>
              </div>
              <button
                onClick={closeCheckoutSheet}
                className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cart Items List */}
            <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
              {cart.map((item) => (
                <div
                  key={item.product.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-white/5"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{item.product.image}</span>
                    <div>
                      <div className="font-semibold text-xs text-white">{item.product.title}</div>
                      <div className="text-[11px] text-emerald-400 font-mono">
                        ${item.product.price.toFixed(2)} ea
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.product.id, -1)}
                      className="p-1 rounded-md bg-slate-800 text-slate-300 hover:text-white"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-mono font-bold text-white px-1">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.product.id, 1)}
                      className="p-1 rounded-md bg-slate-800 text-slate-300 hover:text-white"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Promo Code Input */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Promo Code (try GOAT2026)"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl bg-slate-950/80 border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 font-mono uppercase"
              />
              <button
                onClick={applyCoupon}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold hover:bg-slate-700 active:scale-95 transition-all"
              >
                Apply
              </button>
            </div>

            {/* Payment Rail Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">
                Select Multi-Rail Payment Gateway:
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'bakong', label: 'Bakong KHQR', badge: 'National QR', icon: '🇰🇭' },
                  { id: 'alipay', label: 'Alipay', badge: 'Direct Wallet', icon: '🇨🇳' },
                  { id: 'paypay', label: 'PayPay', badge: 'Fast QR', icon: '🇯🇵' },
                  { id: 'apple_pay', label: 'Apple Pay', badge: 'StoreKit', icon: '🍎' }
                ].map((rail) => (
                  <button
                    key={rail.id}
                    onClick={() => setSelectedProvider(rail.id as PaymentProvider)}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all touch-press ${
                      selectedProvider === rail.id
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-500/20 font-bold'
                        : 'bg-slate-950/60 border-white/10 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-base">{rail.icon}</span>
                      <span className="text-[9px] font-mono opacity-80">{rail.badge}</span>
                    </div>
                    <span className="text-xs font-semibold mt-1">{rail.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Bakong KHQR Radar Visualizer */}
            {selectedProvider === 'bakong' && (
              <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/30 flex items-center gap-3">
                <div className="relative w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center">
                  <QrCode className="w-6 h-6 text-emerald-400" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                    Bakong KHQR EMV Radar Active
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono truncate">
                    khqr://bakong.nbc.gov.kh/v1/00020101021230440016...
                  </div>
                </div>
              </div>
            )}

            {/* Financial Summary */}
            <div className="p-3 rounded-xl bg-slate-950/90 border border-white/5 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              {discountPercent > 0 && (
                <div className="flex justify-between text-emerald-400 font-semibold">
                  <span>Promo Discount ({discountPercent}%)</span>
                  <span>-${discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-400">
                <span>Estimated Tax (8%)</span>
                <span>${tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Shipping</span>
                <span>{shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`}</span>
              </div>
              <div className="flex justify-between text-white font-bold text-sm pt-2 border-t border-white/10">
                <span>Grand Total</span>
                <span className="text-emerald-400 font-black">${grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Execute Payment Button */}
            <button
              onClick={executePayment}
              disabled={isProcessingPayment}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/25 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 touch-press disabled:opacity-50"
            >
              {isProcessingPayment ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  Securing Bridge Intent...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Authorize & Pay ${grandTotal.toFixed(2)} via {selectedProvider.toUpperCase()}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Payment Success Receipt Card */}
      {paymentResult && (
        <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/80 via-slate-900 to-slate-950 border border-emerald-500/40 shadow-2xl space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-base">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              Settlement Confirmed ({paymentResult.status})
            </div>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-semibold border border-emerald-500/30">
              {paymentResult.provider?.toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono text-slate-300 bg-slate-950/80 p-3 rounded-xl border border-white/5">
            <div>
              <span className="text-slate-500">Intent ID:</span>{' '}
              <span className="text-white font-semibold">{paymentResult.intentId}</span>
            </div>
            <div>
              <span className="text-slate-500">Tx Hash:</span>{' '}
              <span className="text-emerald-400 font-semibold truncate block">
                {paymentResult.txHash}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Handle:</span>{' '}
              <span className="text-white">{paymentResult.transactionHandle}</span>
            </div>
            <div>
              <span className="text-slate-500">Settled Amount:</span>{' '}
              <span className="text-emerald-400 font-bold">
                ${(paymentResult.amount / 100).toFixed(2)} {paymentResult.currency}
              </span>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setPaymentResult(null)}
              className="text-xs font-bold text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800"
            >
              Dismiss Receipt
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
