import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { CartLink } from "@/components/storefront/cart-link";
import { CategoryNavigation } from "@/components/storefront/category-navigation";
import { createClient } from "@/lib/supabase/server";
import { AccountAccess } from "./account-access";
import styles from "./account.module.css";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"My Account",description:"Sign in securely to view your JINQAYA order history.",robots:{index:false,follow:false}};
type AccountOrder={order_number:string;status:string;created_at:string;currency:string;total_amount:number|string|null;items:Array<{product_name:string;variant_name:string|null;quantity:number}>;shipment:null|{carrier:string|null;tracking_number:string|null;tracking_url:string|null}};
type AccountData={first_name:string;last_name:string;orders:AccountOrder[]};
function money(value:number|string|null,currency:string){if(value===null||value==="")return "To be confirmed";const amount=Number(value);if(!Number.isFinite(amount))return "To be confirmed";try{return new Intl.NumberFormat("en-US",{style:"currency",currency:currency||"USD"}).format(amount)}catch{return amount.toFixed(2)+" "+currency}}
function safeTrackingUrl(value:string|null){if(!value)return null;try{const url=new URL(value);return url.protocol==="https:"?url.toString():null}catch{return null}}
function statusLabel(status:string){return ({on_hold:"Under review",pending_payment:"Awaiting payment",paid:"Payment confirmed",processing:"Being prepared",partially_shipped:"Partially shipped",shipped:"Shipped",delivered:"Delivered",cancelled:"Cancelled",partially_refunded:"Partially refunded",refunded:"Refunded"} as Record<string,string>)[status]||status.replaceAll("_"," ")}

export default async function AccountPage(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 let account:AccountData|null=null;let accountError=false;
 if(user){const client=supabase as unknown as {rpc:(name:string)=>Promise<{data:unknown;error:{message:string}|null}>};const {data,error}=await client.rpc("get_my_customer_account_orders");if(error)accountError=true;else account=data as AccountData}
 return <main className="jq-home jq-policy-page">
  <div className="jq-topline"><span>JINQAYA / A PET LIFESTYLE HOUSE</span><span>MADE FOR LIFE, SHARED</span></div>
  <header className="jq-header"><Link className="jq-brand-logo-link" href="/" aria-label="JINQAYA home"><Image className="jq-brand-logo jq-inner-logo" src="/jinqaya-logo.png" alt="JINQAYA Premium Pet Lifestyle" width={900} height={287}/></Link><CategoryNavigation/><div className="jq-header-actions"><CartLink/></div></header>
  <section className="jq-policy-hero"><p className="jq-kicker">CUSTOMER ACCOUNT</p><h1>Your orders,<br/><em>all together.</em></h1><p>Sign in with your email to view your JINQAYA order history and delivery updates. No password needed.</p></section>
  <article className={styles.content}>
   {!user?<section className={styles.panel}><h2>Sign in or create an account</h2><p>Enter your email and we’ll send you a one-time verification code. Use the same email address you use when placing orders to see your order history.</p><AccountAccess mode="login"/><p className={styles.guestNote}>Prefer not to create an account? You can still <Link href="/order-status">track an order as a guest</Link> using your order number and checkout email.</p></section>:
   <section className={styles.account}><div className={styles.accountHeading}><div><p className={styles.kicker}>SIGNED IN AS</p><h2>{account?.first_name?account.first_name+" "+account.last_name:user.email}</h2><p>{user.email}</p></div><AccountAccess mode="logout"/></div>
   {accountError?<p className={styles.notice}>We couldn’t load your orders right now. Please refresh the page or try again later.</p>:account&&account.orders.length>0?<div className={styles.orderList}><h3>Order history <span>{account.orders.length}</span></h3>{account.orders.map(order=><article className={styles.orderCard} key={order.order_number}><div className={styles.orderTop}><div><p className={styles.kicker}>ORDER REFERENCE</p><strong>{order.order_number}</strong><p className={styles.date}>Placed {new Date(order.created_at).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})}</p></div><span className={styles.status}>{statusLabel(order.status)}</span></div><div className={styles.items}>{order.items.map((item,index)=><p key={order.order_number+"-"+index}>{item.product_name}{item.variant_name?" · "+item.variant_name:""} × {item.quantity}</p>)}</div><div className={styles.total}><span>Order total</span><strong>{money(order.total_amount,order.currency)}</strong></div>{order.shipment?.tracking_number?<div className={styles.tracking}><span>{order.shipment.carrier||"Shipment"} · {order.shipment.tracking_number}</span>{safeTrackingUrl(order.shipment.tracking_url)?<a href={safeTrackingUrl(order.shipment.tracking_url)!} target="_blank" rel="noopener noreferrer">Track parcel ↗</a>:null}</div>:null}<Link className={styles.orderLink} href={"/order-status?order="+encodeURIComponent(order.order_number)}>VIEW ORDER STATUS ↗</Link></article>)}</div>:<div className={styles.empty}><h3>No orders linked yet</h3><p>Orders placed using this verified email address will appear here. If you checked out with another email, sign out and use that address instead.</p><Link href="/shop">EXPLORE THE SHOP ↗</Link></div>}
   </section>}
  </article>
  <footer className="jq-footer"><div className="jq-footer-main"><div><Link className="jq-wordmark" href="/">JINQAYA<span>®</span></Link><p>Life is better in good company.</p></div><div className="jq-footer-links"><Link href="/shop">THE SHOP</Link><Link href="/order-status">TRACK ORDER</Link><Link href="/account">MY ACCOUNT</Link><Link href="/policies/shipping">SHIPPING POLICY</Link><Link href="/policies/returns-refunds">RETURNS &amp; REFUNDS</Link><Link href="/contact">CONTACT</Link><a href="mailto:info@jinqaya.com">info@jinqaya.com</a></div><span className="jq-footer-note">FOR CATS, DOGS<br/>AND THE LIFE BETWEEN.</span></div></footer>
 </main>;
}
