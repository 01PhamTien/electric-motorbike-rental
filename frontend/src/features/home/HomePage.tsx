import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SectionHeading, money } from '../../components/Brand';
import { ScooterArt } from '../../components/ScooterArt';
import { api } from '../../services/api';
import type { Vehicle } from '../../types';

export function HomePage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  useEffect(() => { let active = true; api.get('/vehicles').then(({ data }) => { if (active) setVehicles(Array.isArray(data) ? data : data?.items ?? []); }).catch(() => {}); return () => { active = false; }; }, []);
  const featured = vehicles.filter(v => v.status === 'ACTIVE').slice(0, 3);
  return <>
    <section className="hero-mesh relative overflow-hidden text-white">
      <div className="container-page relative grid min-h-[590px] items-center gap-8 py-20 lg:grid-cols-[1.05fr_.95fr] lg:py-24">
        <div className="relative z-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-white/10 px-4 py-2 text-xs font-bold text-emerald-200">✦ CHUYẾN ĐI XANH · ĐÀ NẴNG</span>
          <h1 className="mt-8 max-w-[650px] text-5xl font-extrabold leading-[1.12] tracking-[-.065em] sm:text-6xl xl:text-[72px]">Đà Nẵng đẹp hơn <span className="text-emerald-300">khi đi theo cách của bạn.</span></h1>
          <p className="mt-7 max-w-[560px] text-base leading-8 text-emerald-50/80 sm:text-lg">Chủ động từng điểm dừng với xe máy điện êm ái. Chọn xe, chọn ngày thuê và đặt lịch trực tuyến trên cùng một nền tảng.</p>
          <div className="mt-9 flex flex-wrap gap-3"><Link className="btn-primary" to="/vehicles">Khám phá xe điện <span aria-hidden="true">↗</span></Link><Link className="inline-flex items-center justify-center rounded-xl border border-white/25 px-6 py-3.5 text-sm font-bold text-white hover:bg-white/10" to="/stations">Xem điểm nhận xe →</Link></div>
          <div className="mt-11 flex flex-wrap gap-6 text-sm font-semibold text-emerald-50/85"><span>✓ Đặt lịch trực tuyến</span><span>✓ Minh bạch giá thuê</span><span>✓ Linh hoạt hành trình</span></div>
        </div>
        <div className="relative mx-auto w-full max-w-[650px]">
          <div className="absolute left-[12%] top-[18%] h-[55%] w-[70%] rounded-full bg-emerald-400/20 blur-[70px]"/>
          <div className="relative aspect-[1.4] w-full"><ScooterArt dark /></div>
          <div className="absolute bottom-4 right-3 rounded-2xl border border-white/20 bg-white/10 px-5 py-4 shadow-xl backdrop-blur-xl"><p className="text-xs font-semibold text-emerald-100">TẬN HƯỞNG HÀNH TRÌNH</p><p className="mt-1 font-extrabold">Êm hơn. Xanh hơn. Tự do hơn.</p></div>
        </div>
      </div>
    </section>
    <div className="container-page relative -mt-7 z-10"><div className="panel grid gap-4 p-5 sm:grid-cols-3 sm:p-7">{[{icon:'01',title:'Chọn chiếc xe phù hợp',desc:'Xem thông tin xe và giá theo ngày.'},{icon:'02',title:'Chọn lịch nhận & trả',desc:'Đặt thời gian theo kế hoạch của bạn.'},{icon:'03',title:'Nhận xe & khám phá',desc:'Theo dõi đơn và đến điểm nhận xe.'}].map(x => <div key={x.icon} className="flex gap-4 p-2"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-sm font-black text-emerald-700">{x.icon}</span><div><h3 className="font-extrabold">{x.title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{x.desc}</p></div></div>)}</div></div>
    <section className="container-page py-24">
      <div className="flex flex-wrap items-end justify-between gap-6"><SectionHeading eyebrow="KHÁM PHÁ ĐỘI XE" title="Chọn xe cho hành trình của bạn" description="Các mẫu xe hiện có được cập nhật từ hệ thống. Lọc xe và xem giá thuê rõ ràng trước khi đặt."/><Link to="/vehicles" className="btn-outline">Xem tất cả xe ↗</Link></div>
      {featured.length ? <div className="mt-9 grid gap-6 md:grid-cols-3">{featured.map(v => <article className="panel overflow-hidden" key={v.id}><div className="vehicle-art relative flex aspect-[1.45] items-center justify-center p-6"><ScooterArt/><span className="absolute left-5 top-5 tag">● Sẵn sàng</span></div><div className="p-6"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{v.model?.brand} · {v.code}</p><h3 className="mt-2 text-xl font-extrabold">{v.model?.name}</h3><p className="mt-2 text-sm text-slate-500">⌖ {v.station?.name}</p><div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-5"><div><span className="text-xl font-extrabold text-emerald-700">{money(v.dailyRate)}</span><span className="block text-xs text-slate-400">mỗi ngày</span></div><Link to={'/vehicles?vehicle=' + v.id} className="btn-dark">Đặt xe ↗</Link></div></div></article>)}</div> : <div className="panel mt-9 p-8 text-center text-slate-500">Danh sách xe sẽ xuất hiện tại đây khi hệ thống có xe đang sẵn sàng.</div>}
    </section>
    <section className="bg-[#eaf4ee] py-20"><div className="container-page grid items-center gap-10 lg:grid-cols-2"><div><SectionHeading eyebrow="VÌ SAO CHỌN XE ĐIỆN?" title="Nhẹ nhàng với thành phố. Tự do với bạn." description="Di chuyển linh hoạt giữa biển Mỹ Khê, cầu Rồng, Sơn Trà và những góc phố yêu thích. Mỗi chuyến đi là một trải nghiệm riêng."/><Link to="/stations" className="btn-dark mt-7">Tìm điểm thuê gần bạn →</Link></div><div className="grid gap-4 sm:grid-cols-2">{[{icon:'⚡',title:'Trải nghiệm êm ái',text:'Động cơ điện vận hành yên tĩnh.'},{icon:'🌿',title:'Di chuyển xanh',text:'Không có khí thải từ ống xả khi vận hành.'},{icon:'🗓️',title:'Lịch thuê chủ động',text:'Chọn ngày và thời gian nhận, trả xe.'},{icon:'📍',title:'Điểm nhận rõ ràng',text:'Xem địa chỉ điểm thuê trước khi đến.'}].map(x => <div className="panel p-6" key={x.title}><span className="text-3xl">{x.icon}</span><h3 className="mt-4 text-lg font-extrabold">{x.title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{x.text}</p></div>)}</div></div></section>
    <section className="container-page py-20"><div className="rounded-[30px] bg-[#103a39] px-8 py-12 text-white sm:px-14"><div className="flex flex-wrap items-center justify-between gap-8"><div><p className="text-xs font-extrabold uppercase tracking-[.2em] text-emerald-300">SẴN SÀNG LÊN ĐƯỜNG?</p><h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">Một thành phố. Vô vàn điểm đến.</h2><p className="mt-3 text-emerald-50/70">Tìm chiếc xe phù hợp và bắt đầu hành trình của bạn.</p></div><Link to="/vehicles" className="btn-primary">Bắt đầu đặt xe ↗</Link></div></div></section>
  </>;
}
