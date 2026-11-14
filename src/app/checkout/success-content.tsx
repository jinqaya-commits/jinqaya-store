"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatCartMoney } from "@/lib/cart";

type PaymentStatus = {
  orderNumber: string;
  status: string;
  paymentStatus: string;
  currency: string;
  totalAmount: number;
};

export function CheckoutSuccessContent() {
  const [order, setOrder] = useState<PaymentStatus | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/paypal/payment-status", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to retrieve payment status.");
      setOrder(result as PaymentStatus);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to retrieve payment status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, 2500);
    const timeout = window.setTimeout(() => window.clearInterval(interval), 30000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [refresh]);

  const paid = order?.paymentStatus === "paid" && (order.status === "paid" || order.status === "on_hold");

  return (
    <main className="inner-page">
      <header className="inner-page-header">
        <Link className="wordmark" href="/">JINQAYA<span>®</span></Link>
        <nav className="inner-nav" aria-label="Main navigation">
          <Link href="/shop">SHOP ALL</Link><Link href="/order-status">TRACK ORDER</Link>
        </nav>
      </header>
      <section className="checkout-success checkout-payment-success" aria-live="polite">
        {paid ? (
          <>
            <div className="payment-success-mark" aria-hidden="true">✓</div>
            <p className="eyebrow">PAYMENT COMPLETE</p>
            <h1>Payment successful.</h1>
            <p>Your PayPal payment has been received and confirmed.</p>
            <div className="checkout-notice">
              <strong>Order confirmation</strong>
              <p className="checkout-total"><span>Order number</span><strong>{order.orderNumber}</strong></p>
              <p className="checkout-total"><span>Payment status</span><strong className="payment-success-status">Paid</strong></p>
              <p className="checkout-total"><span>Payment method</span><strong>PayPal</strong></p>
              <p className="checkout-total"><span>Total paid</span><strong>{formatCartMoney(order.totalAmount, order.currency)}</strong></p>
            </div>
            <p className="checkout-disclaimer">We’ll send an order confirmation to your checkout email. If you need help, contact info@jinqaya.com.</p>
            <Link className="button button-dark" href="/shop">CONTINUE SHOPPING <span>↗</span></Link>
          </>
        ) : (
          <>
            <p className="eyebrow">PAYMENT STATUS</p>
            <h1>{loading ? "Checking your payment…" : "We’re confirming your payment."}</h1>
            <p>{order?.orderNumber ? <>Order <strong>{order.orderNumber}</strong> has been received. </> : null}Your payment status will update here once confirmed. Please don’t submit another payment.</p>
            {order && (
              <div className="checkout-notice">
                <strong>Order details</strong>
                <p className="checkout-total"><span>Payment status</span><strong>Awaiting confirmation</strong></p>
                <p className="checkout-total"><span>Order total</span><strong>{formatCartMoney(order.totalAmount, order.currency)}</strong></p>
              </div>
            )}
            {error && <p className="checkout-error" role="alert">{error}</p>}
            <button className="button button-dark" type="button" onClick={() => { setLoading(true); void refresh(); }}>CHECK AGAIN</button>
            <p className="checkout-disclaimer">If this page can’t find your order, use Track Order with your order number and checkout email, or contact info@jinqaya.com.</p>
            <Link className="back-link" href="/order-status">TRACK ORDER ↗</Link>
          </>
        )}
      </section>
      <footer className="inner-footer"><Link href="/">JINQAYA</Link><span>BETTER LIVING, TOGETHER.</span></footer>
    </main>
  );
}
