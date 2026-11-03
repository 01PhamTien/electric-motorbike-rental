import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { SectionHeading } from '../../components/Brand';
import { useAuth } from '../auth/AuthContext';
import { api } from '../../services/api';

const roleLabels = { ADMIN: 'Quản trị viên', STAFF: 'Nhân viên', CUSTOMER: 'Khách hàng' };
function errorMessage(err: unknown):string {
  const m = (err as {response?:{data?:{message?:string|string[]}}})?.response?.data?.message;
  return Array.isArray(m)?m.join(', '):m||'Không thể thực hiện. Vui lòng thử lại.';
}
export function ProfilePage() {
  const { user, refresh } = useAuth();
  const [editing,setEditing]=useState(false);
  const [securityOpen,setSecurityOpen]=useState(false);
  const [fullName,setFullName]=useState(user?.fullName||'');
  const [phone,setPhone]=useState(user?.phone||'');
  const [currentPassword,setCurrentPassword]=useState('');
  const [newPassword,setNewPassword]=useState('');
  const [confirmPassword,setConfirmPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  useEffect(()=>{if(!editing){setFullName(user?.fullName||'');setPhone(user?.phone||'');}},[user,editing]);
  async function saveProfile(e:FormEvent){
    e.preventDefault();setBusy(true);setError('');setNotice('');
    try {await api.patch('/users/me',{fullName:fullName.trim(),phone:phone.trim()||null});await refresh();setEditing(false);setNotice('Thông tin cá nhân đã được cập nhật.');}
    catch(err){setError(errorMessage(err));}finally{setBusy(false);}
  }
  async function changePassword(e:FormEvent){
    e.preventDefault();setError('');setNotice('');
    if(newPassword!==confirmPassword){setError('Mật khẩu xác nhận không khớp.');return;}
    setBusy(true);
    try {await api.patch('/users/me/password',{currentPassword,newPassword});setCurrentPassword('');setNewPassword('');setConfirmPassword('');setSecurityOpen(false);setNotice('Đổi mật khẩu thành công.');}
    catch(err){setError(errorMessage(err));}finally{setBusy(false);}
  }
  return <section className="container-page space-y-7 py-12 sm:py-16">
    <SectionHeading eyebrow="HỒ SƠ CỦA TÔI" title="Thông tin cá nhân" description="Xem và cập nhật hồ sơ của bạn. Các tùy chọn bảo mật được đặt riêng ở cuối trang."/>
    {notice&&<p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{notice}</p>}
    {error&&<p role="alert" className="rounded-xl bg-rose-50 p-4 text-rose-800">{error}</p>}
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-5 border-b border-slate-100 p-7">
        <div aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-2xl font-black text-emerald-800">{(user?.fullName||'V').trim().slice(0,1).toUpperCase()}</div>
        <div className="flex-1"><h2 className="text-2xl font-extrabold">{user?.fullName||'Tài khoản VoltGo'}</h2><p className="mt-1 text-sm text-slate-500">{user?.email}</p><span className="tag mt-2 inline-block">{user?.role?roleLabels[user.role]:'—'}</span></div>
        {!editing&&<button className="btn-outline" onClick={()=>{setEditing(true);setError('');setNotice('');}}>Chỉnh sửa hồ sơ</button>}
      </div>
      {editing?<form onSubmit={saveProfile} className="grid gap-5 p-7 sm:grid-cols-2">
        <label><span className="field-label">Họ và tên</span><input className="field" required minLength={2} maxLength={120} value={fullName} onChange={e=>setFullName(e.target.value)}/></label>
        <label><span className="field-label">Số điện thoại (không bắt buộc)</span><input className="field" maxLength={20} value={phone} onChange={e=>setPhone(e.target.value)}/></label>
        <div className="flex gap-3 sm:col-span-2"><button disabled={busy} className="btn-primary">{busy?'Đang lưu...':'Lưu hồ sơ'}</button><button type="button" className="btn-outline" onClick={()=>{setEditing(false);setError('');}}>Hủy</button></div>
      </form>:<div className="grid gap-6 p-7 sm:grid-cols-2 lg:grid-cols-3">
        <div><p className="field-label">Họ và tên</p><p className="mt-2 font-bold">{user?.fullName||'—'}</p></div>
        <div><p className="field-label">Email đăng nhập</p><p className="mt-2 font-bold">{user?.email||'—'}</p></div>
        <div><p className="field-label">Số điện thoại</p><p className="mt-2 font-bold">{user?.phone||'Chưa cập nhật'}</p></div>
        <div><p className="field-label">Vai trò</p><p className="mt-2 font-bold">{user?.role?roleLabels[user.role]:'—'}</p></div>
        {user?.role==='STAFF'&&<div><p className="field-label">Điểm thuê phụ trách</p><p className="mt-2 font-bold">{user.stationId?'Trạm #'+user.stationId:'Chưa phân công'}</p></div>}
      </div>}
    </div>
    <div className="panel p-7"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-lg font-extrabold">Bảo mật tài khoản</h2><p className="mt-2 text-sm text-slate-500">Bạn có thể đổi mật khẩu khi cần. Mục này không mở mặc định.</p></div><button className="btn-outline" aria-expanded={securityOpen} onClick={()=>{setSecurityOpen(v=>!v);setError('');}}> {securityOpen?'Đóng':'Đổi mật khẩu'} </button></div>
      {securityOpen&&<form onSubmit={changePassword} className="mt-7 max-w-lg space-y-4 border-t pt-6">
        <label className="block"><span className="field-label">Mật khẩu hiện tại</span><input className="field" type="password" autoComplete="current-password" required value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)}/></label>
        <label className="block"><span className="field-label">Mật khẩu mới</span><input className="field" type="password" minLength={8} maxLength={72} autoComplete="new-password" required value={newPassword} onChange={e=>setNewPassword(e.target.value)}/></label>
        <label className="block"><span className="field-label">Nhập lại mật khẩu mới</span><input className="field" type="password" minLength={8} maxLength={72} autoComplete="new-password" required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/></label>
        <button disabled={busy} className="btn-primary">{busy?'Đang cập nhật...':'Xác nhận đổi mật khẩu'}</button>
      </form>}
    </div>
    <div className="flex flex-wrap gap-4 text-sm font-bold text-emerald-700">{user?.role==='ADMIN'&&<Link to="/admin">Vào trung tâm quản trị ↗</Link>}<Link to="/bookings/my">Xem đơn thuê của tôi ↗</Link></div>
  </section>;
}
