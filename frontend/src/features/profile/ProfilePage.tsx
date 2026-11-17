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
  const [avatarUrl,setAvatarUrl]=useState(user?.avatarUrl||'');
  const [currentPassword,setCurrentPassword]=useState('');
  const [newPassword,setNewPassword]=useState('');
  const [confirmPassword,setConfirmPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  useEffect(()=>{if(!editing){setFullName(user?.fullName||'');setPhone(user?.phone||'');setAvatarUrl(user?.avatarUrl||'');}},[user,editing]);
  async function saveProfile(e:FormEvent){
    e.preventDefault();setBusy(true);setError('');setNotice('');
    try {await api.patch('/users/me',{fullName:fullName.trim(),phone:phone.trim()||null,avatarUrl:avatarUrl.trim()||null});await refresh();setEditing(false);setNotice('Thông tin cá nhân đã được cập nhật.');}
    catch(err){setError(errorMessage(err));}finally{setBusy(false);}
  }
  async function changePassword(e:FormEvent){
    e.preventDefault();setError('');setNotice('');
    if(newPassword!==confirmPassword){setError('Mật khẩu xác nhận không khớp.');return;}
    setBusy(true);
    try {await api.patch('/users/me/password',{currentPassword,newPassword});setCurrentPassword('');setNewPassword('');setConfirmPassword('');setSecurityOpen(false);setNotice('Đổi mật khẩu thành công.');}
    catch(err){setError(errorMessage(err));}finally{setBusy(false);}
  }
  return <section className="container-page max-w-5xl space-y-6 py-8 sm:py-12">
    <SectionHeading eyebrow="HỒ SƠ CỦA TÔI" title="Thông tin cá nhân" description="Quản lý thông tin liên hệ, bảo mật và các hoạt động thuê xe của bạn tại một nơi."/>
    {notice&&<p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{notice}</p>}
    {error&&<p role="alert" className="rounded-xl bg-rose-50 p-4 text-rose-800">{error}</p>}
    <div className="panel overflow-hidden border-[#e7eee9] shadow-[0_18px_50px_rgba(30,90,65,.05)]">
      <div className="flex flex-wrap items-center gap-4 border-b border-[#edf2ee] bg-[#f8fbf8] p-5 sm:gap-5 sm:p-7">
        {user?.avatarUrl?<img src={user.avatarUrl} alt="Ảnh đại diện" className="h-16 w-16 rounded-2xl border-4 border-white object-cover shadow-sm sm:h-20 sm:w-20"/>:<div aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-white bg-[#eaf6ee] text-2xl font-bold text-[#13865f] shadow-sm sm:h-20 sm:w-20 sm:text-3xl">{(user?.fullName||'V').trim().slice(0,1).toUpperCase()}</div>}
        <div className="flex-1"><h2 className="text-2xl font-extrabold">{user?.fullName||'Tài khoản VoltGo'}</h2><p className="mt-1 text-sm text-slate-500">{user?.email}</p><span className="tag mt-2 inline-block">{user?.role?roleLabels[user.role]:'—'}</span></div>
        {!editing&&<button className="btn-outline" onClick={()=>{setEditing(true);setError('');setNotice('');}}>Chỉnh sửa hồ sơ</button>}
      </div>
      {editing?<form onSubmit={saveProfile} className="grid gap-5 p-5 sm:grid-cols-2 sm:p-7">
        <label><span className="field-label">Họ và tên</span><input className="field" required minLength={2} maxLength={120} value={fullName} onChange={e=>setFullName(e.target.value)}/></label>
        <label><span className="field-label">Số điện thoại (không bắt buộc)</span><input className="field" maxLength={20} value={phone} onChange={e=>setPhone(e.target.value)}/></label>
        <label className="sm:col-span-2"><span className="field-label">Đường dẫn ảnh đại diện (không bắt buộc)</span><input className="field" type="url" maxLength={2048} placeholder="https://..." value={avatarUrl} onChange={e=>setAvatarUrl(e.target.value)}/><span className="mt-1 block text-xs text-slate-500">Dán liên kết ảnh công khai bắt đầu bằng https://. Nếu chưa có liên kết, bạn có thể để trống và dùng chữ cái đầu của tên.</span></label>
        <div className="flex gap-3 sm:col-span-2"><button disabled={busy} className="btn-primary">{busy?'Đang lưu...':'Lưu hồ sơ'}</button><button type="button" className="btn-outline" onClick={()=>{setEditing(false);setError('');}}>Hủy</button></div>
      </form>:<div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-7 lg:grid-cols-3">
        <div><p className="field-label">Họ và tên</p><p className="mt-2 font-bold">{user?.fullName||'—'}</p></div>
        <div><p className="field-label">Email đăng nhập</p><p className="mt-2 font-bold">{user?.email||'—'}</p></div>
        <div><p className="field-label">Số điện thoại</p><p className="mt-2 font-bold">{user?.phone||'Chưa cập nhật'}</p></div>
        <div><p className="field-label">Vai trò</p><p className="mt-2 font-bold">{user?.role?roleLabels[user.role]:'—'}</p></div>
        {user?.role==='STAFF'&&<div><p className="field-label">Điểm thuê phụ trách</p><p className="mt-2 font-bold">{user.stationId?'Trạm #'+user.stationId:'Chưa phân công'}</p></div>}
      </div>}
    </div>
    <section aria-labelledby="personal-actions-title">
      <div className="mb-4"><h2 id="personal-actions-title" className="text-lg font-bold tracking-tight">Truy cập nhanh</h2><p className="mt-1 text-sm text-slate-500">Các thao tác bạn thường cần sau khi đăng nhập.</p></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {user?.role==='CUSTOMER' ? <>
          <Link to="/bookings/my" className="panel group p-5 transition hover:border-[#cfe2d4] hover:shadow-sm"><span className="text-sm font-bold text-[#315b4d]">Đơn thuê của tôi</span><p className="mt-2 text-sm text-slate-500">Theo dõi lịch nhận xe, trả xe và thanh toán.</p><span className="mt-4 block text-xs font-bold text-[#159b70]">Xem đơn thuê →</span></Link>
          <Link to="/stations" className="panel group p-5 transition hover:border-[#cfe2d4] hover:shadow-sm"><span className="text-sm font-bold text-[#315b4d]">Trạm gần tôi</span><p className="mt-2 text-sm text-slate-500">Bật vị trí để tìm điểm nhận xe gần nhất.</p><span className="mt-4 block text-xs font-bold text-[#159b70]">Tìm trạm →</span></Link>
          <Link to="/vehicles" className="panel group p-5 transition hover:border-[#cfe2d4] hover:shadow-sm"><span className="text-sm font-bold text-[#315b4d]">Khám phá xe</span><p className="mt-2 text-sm text-slate-500">Chọn xe, thời gian thuê và phương thức thanh toán.</p><span className="mt-4 block text-xs font-bold text-[#159b70]">Tìm xe →</span></Link>
        </> : <>
          <Link to="/operations" className="panel group p-5 transition hover:border-[#cfe2d4] hover:shadow-sm"><span className="text-sm font-bold text-[#315b4d]">Quản lý đơn thuê</span><p className="mt-2 text-sm text-slate-500">Theo dõi và xử lý các đơn đang vận hành.</p><span className="mt-4 block text-xs font-bold text-[#159b70]">Mở quản lý →</span></Link>
          {user?.role==='ADMIN'&&<Link to="/admin" className="panel group p-5 transition hover:border-[#cfe2d4] hover:shadow-sm"><span className="text-sm font-bold text-[#315b4d]">Trung tâm quản trị</span><p className="mt-2 text-sm text-slate-500">Quản lý hệ thống và cấu hình vận hành.</p><span className="mt-4 block text-xs font-bold text-[#159b70]">Mở quản trị →</span></Link>}
          <Link to="/stations" className="panel group p-5 transition hover:border-[#cfe2d4] hover:shadow-sm"><span className="text-sm font-bold text-[#315b4d]">Mạng lưới trạm</span><p className="mt-2 text-sm text-slate-500">Xem vị trí và tình trạng các điểm nhận xe.</p><span className="mt-4 block text-xs font-bold text-[#159b70]">Xem trạm →</span></Link>
        </>}
      </div>
    </section>
    <div className="panel border-[#e7eee9] p-5 shadow-none sm:p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-lg font-extrabold">Bảo mật tài khoản</h2><p className="mt-2 text-sm text-slate-500">Bạn có thể đổi mật khẩu khi cần. Mục này không mở mặc định.</p></div><button className="btn-outline" aria-expanded={securityOpen} onClick={()=>{setSecurityOpen(v=>!v);setError('');}}> {securityOpen?'Đóng':'Đổi mật khẩu'} </button></div>
      {securityOpen&&<form onSubmit={changePassword} className="mt-6 max-w-lg space-y-4 border-t border-[#edf1ed] pt-5">
        <label className="block"><span className="field-label">Mật khẩu hiện tại</span><input className="field" type="password" autoComplete="current-password" required value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)}/></label>
        <label className="block"><span className="field-label">Mật khẩu mới</span><input className="field" type="password" minLength={8} maxLength={72} autoComplete="new-password" required value={newPassword} onChange={e=>setNewPassword(e.target.value)}/><span className="mt-1 block text-xs text-slate-500">Sử dụng ít nhất 8 ký tự.</span></label>
        <label className="block"><span className="field-label">Nhập lại mật khẩu mới</span><input className="field" type="password" minLength={8} maxLength={72} autoComplete="new-password" required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/></label>
        <button disabled={busy} className="btn-primary">{busy?'Đang cập nhật...':'Xác nhận đổi mật khẩu'}</button>
      </form>}
    </div>
    <p className="text-xs leading-5 text-slate-500">Thông tin hồ sơ chỉ dùng để phục vụ tài khoản và liên hệ trong quá trình thuê xe. Không chia sẻ mật khẩu hoặc mã xác thực với người khác.</p>
  </section>;
}
