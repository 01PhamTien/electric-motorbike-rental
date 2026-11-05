import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

export function Brand({ light = false }: { light?: boolean }) {
  return <Link to="/" className="inline-flex items-center gap-3" aria-label="VoltGo Đà Nẵng - Trang chủ">
    <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 36 36" width="30" height="30" fill="none"><path d="M20.6 3.5 7.8 19h10l-2.1 13.5L28.5 16H19l1.6-12.5Z" fill="currentColor"/></svg></span>
    <span className={light ? 'text-white' : 'text-slate-950'}><strong className="block text-xl font-extrabold tracking-[-.06em] leading-none">voltgo<span className="text-emerald-500">.</span></strong><span className="mt-1 block text-[9px] font-bold uppercase tracking-[.22em] opacity-60">ĐÀ NẴNG · E-MOBILITY</span></span>
  </Link>;
}
export function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return <div><p className="eyebrow">{eyebrow}</p><h2 className="section-title">{title}</h2>{description && <p className="mt-3 max-w-2xl text-slate-500 leading-7">{description}</p>}</div>;
}
export function LoadingState({ label = 'Đang tải dữ liệu...' }: { label?: string }) {
  return <div role="status" aria-live="polite" className="panel space-y-5 border-[#e7eee9] p-5 sm:p-6">
    <span className="sr-only">{label}</span>
    <div className="flex items-center gap-3"><span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600"/><span className="text-sm font-semibold text-slate-500">{label}</span></div>
    <div className="animate-pulse space-y-3"><div className="h-4 w-1/3 rounded-full bg-[#eaf2ed]"/><div className="grid gap-3 sm:grid-cols-3"><div className="h-20 rounded-xl bg-[#f0f6f2]"/><div className="h-20 rounded-xl bg-[#f0f6f2]"/><div className="h-20 rounded-xl bg-[#f0f6f2]"/></div><div className="h-3 w-full rounded-full bg-[#f0f6f2]"/><div className="h-3 w-4/5 rounded-full bg-[#f0f6f2]"/></div>
  </div>;
}
export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="panel p-12 text-center"><div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-3xl">⚡</div><h3 className="text-xl font-bold">{title}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>{action && <div className="mt-6">{action}</div>}</div>;
}
export const money = (value: number | string | undefined) => Number(value || 0).toLocaleString('vi-VN') + ' ₫';
export const timeText = (value: string) => new Date(value).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' });
