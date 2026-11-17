import { useEffect } from 'react';
import { AppIcon } from './AppIcon';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default'|'danger';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({open,title,description,confirmLabel='Xác nhận',cancelLabel='Quay lại',tone='default',busy=false,onConfirm,onCancel}:ConfirmDialogProps){
  useEffect(()=>{
    if(!open)return;
    const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!busy)onCancel();};
    window.addEventListener('keydown',onKey);
    return()=>window.removeEventListener('keydown',onKey);
  },[open,busy,onCancel]);
  if(!open)return null;
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#14251d]/45 p-4 backdrop-blur-[3px]" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)onCancel();}}>
    <section role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description" className="w-full max-w-md overflow-hidden rounded-[24px] border border-[#e5ece6] bg-white shadow-[0_28px_90px_rgba(16,40,28,.24)]">
      <div className="flex items-start gap-3 p-5 sm:p-6">
        <span className={'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl '+(tone==='danger'?'bg-[#fff1ef] text-[#b84d43]':'bg-[#edf7f0] text-[#247653]')}><AppIcon name={tone==='danger'?'alert':'check-circle'} size={21}/></span>
        <div className="min-w-0 flex-1"><h2 id="confirm-dialog-title" className="text-lg font-bold tracking-tight text-[#203b34]">{title}</h2><p id="confirm-dialog-description" className="mt-2 whitespace-pre-line text-sm leading-6 text-[#63756b]">{description}</p></div>
        <button type="button" onClick={onCancel} disabled={busy} aria-label="Đóng hộp thoại" className="rounded-lg p-1.5 text-[#819087] hover:bg-[#f4f7f4] disabled:opacity-40"><AppIcon name="close" size={18}/></button>
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-[#edf1ed] bg-[#fafcfa] p-4 sm:flex-row sm:justify-end sm:px-6">
        <button type="button" onClick={onCancel} disabled={busy} className="btn-outline justify-center">{cancelLabel}</button>
        <button type="button" onClick={onConfirm} disabled={busy} className={tone==='danger'?'inline-flex min-h-11 items-center justify-center rounded-xl bg-[#a9433c] px-5 text-sm font-bold text-white transition hover:bg-[#913a34] disabled:opacity-50':'btn-primary justify-center'}>{busy?'Đang xử lý...':confirmLabel}</button>
      </div>
    </section>
  </div>;
}
