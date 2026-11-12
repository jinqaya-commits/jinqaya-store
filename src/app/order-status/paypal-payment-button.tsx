"use client";

import { useEffect, useRef, useState } from "react";

type PayPalSdkInstance = {
  findEligibleMethods: (options: { currencyCode: string }) => Promise<{ isEligible: (method: string) => boolean }>;
  createPayPalOneTimePaymentSession: (callbacks: {
    onApprove: (data: { orderId: string }) => Promise<void>;
    onCancel: () => void;
    onError: (error: unknown) => void;
  }) => {
    start: (options: { presentationMode: "auto" }, order: Promise<{ orderId: string }>) => Promise<void>;
  };
};
declare global {
  interface Window {
    paypal?: {
      createInstance: (options: { clientToken: string; components: string[]; pageType: string }) => Promise<PayPalSdkInstance>;
    };
  }
}

type Props = { currency: string; onPaid: () => void | Promise<void> };

export function PayPalPaymentButton({ currency, onPaid }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;
  const [message, setMessage] = useState("Loading secure PayPal checkout…");
  const [state, setState] = useState<"loading" | "ready" | "error" | "paid">("loading");

  useEffect(() => {
    let active = true;
    let button: HTMLElement | null = null;
    let clickHandler: (() => void) | null = null;

    async function initialize(clientId: string) {
      if (!active || !window.paypal || !containerRef.current) return;
      try {
        const sdk = await window.paypal.createInstance({
          clientToken,
          components: ["paypal-payments"],
          pageType: "checkout",
        });
        const eligible = await sdk.findEligibleMethods({ currencyCode: currency.toUpperCase() });
        if (!active) return;
        if (!eligible.isEligible("paypal")) {
          throw new Error("PayPal is not available for this currency or account. Please contact info@jinqaya.com.");
        }

        const session = sdk.createPayPalOneTimePaymentSession({
          onApprove: async (data) => {
            const response = await fetch("/api/paypal/capture-order", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ paypalOrderId: data.orderId }),
              cache: "no-store",
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Unable to confirm your PayPal payment.");
            if (!active) return;
            setState("paid");
            setMessage(result.stockReviewRequired
              ? "Payment received. Our team is checking stock before preparing your order."
              : "Payment confirmed. Thank you for your order.");
            await onPaidRef.current();
          },
          onCancel: () => {
            if (active) setMessage("Payment was cancelled. Your order is still awaiting payment.");
          },
          onError: () => {
            if (active) {
              setState("error");
              setMessage("PayPal could not complete this payment. Please try again or contact info@jinqaya.com.");
            }
          },
        });

        button = document.createElement("paypal-button");
        button.setAttribute("type", "pay");
        button.removeAttribute("hidden");
        clickHandler = () => {
          const orderPromise = fetch("/api/paypal/create-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
            cache: "no-store",
          }).then(async (response) => {
            const result = await response.json();
            if (!response.ok || typeof result.id !== "string") {
              throw new Error(result.error || "Unable to start PayPal checkout.");
            }
            return { orderId: result.id };
          });
          void session.start({ presentationMode: "auto" }, orderPromise).catch(() => {
            if (active) {
              setState("error");
              setMessage("Unable to start PayPal checkout. Please refresh and try again.");
            }
          });
        };
        button.addEventListener("click", clickHandler);
        containerRef.current?.replaceChildren(button);
        setState("ready");
        setMessage("Pay securely with PayPal.");
      } catch (error) {
        if (active) {
          setState("error");
          setMessage(error instanceof Error ? error.message : "PayPal checkout is unavailable.");
        }
      }
    }

    async function load() {
      try {
        const configResponse = await fetch("/api/paypal/config", { cache: "no-store" });
        const config = await configResponse.json();
        if (!configResponse.ok || config.enabled !== true || typeof config.sdkUrl !== "string") {
          throw new Error("PayPal checkout is being configured. Please contact info@jinqaya.com to arrange payment.");
        }
        if (window.paypal) {
          await initialize(config.clientToken);
          return;
        }
        let script = document.getElementById("jinqaya-paypal-sdk") as HTMLScriptElement | null;
        const onLoad = () => { void initialize(config.clientToken); };
        if (!script) {
          script = document.createElement("script");
          script.id = "jinqaya-paypal-sdk";
          script.src = config.sdkUrl;
          script.async = true;
          script.addEventListener("load", onLoad, { once: true });
          script.addEventListener("error", () => {
            if (active) { setState("error"); setMessage("Unable to load PayPal checkout. Please try again later."); }
          }, { once: true });
          document.head.appendChild(script);
        } else {
          script.addEventListener("load", onLoad, { once: true });
        }
      } catch (error) {
        if (active) {
          setState("error");
          setMessage(error instanceof Error ? error.message : "PayPal checkout is unavailable.");
        }
      }
    }

    void load();
    return () => {
      active = false;
      if (button && clickHandler) button.removeEventListener("click", clickHandler);
      button?.remove();
    };
  }, [currency]);

  return (
    <section className="order-paypal-panel" aria-live="polite">
      <p className="order-paypal-kicker">SECURE PAYMENT</p>
      <div ref={containerRef} className="order-paypal-button" />
      <p className={state === "error" ? "order-paypal-message is-error" : "order-paypal-message"}>{message}</p>
    </section>
  );
}
