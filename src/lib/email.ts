const esc = (value: string) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c] as string));

export async function sendVerificationEmail(args: {
  to: string;
  name: string;
  token: string;
  appUrl: string;
}) {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const from = String(process.env.EMAIL_FROM || 'InvoPro <noreply@invopro.site>').trim();
  if (!apiKey) throw new Error('RESEND_API_KEY belum diset.');

  const base = args.appUrl.replace(/\/$/, '');
  const verifyUrl = `${base}/verify-email?token=${encodeURIComponent(args.token)}`;
  const name = esc(args.name || args.to.split('@')[0]);

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [args.to],
      subject: 'Aktivasi akun InvoPro',
      html: `<!doctype html>
<html><body style="margin:0;background:#f5f7fb;font-family:Arial,sans-serif;color:#0f172a">
  <div style="max-width:560px;margin:32px auto;background:white;border:1px solid #e5e7eb;border-radius:16px;padding:32px">
    <div style="font-size:22px;font-weight:800;margin-bottom:18px">InvoPro</div>
    <h1 style="font-size:24px;margin:0 0 12px">Aktivasi akun kamu</h1>
    <p style="line-height:1.7;color:#475569">Halo ${name}, terima kasih sudah membuat akun InvoPro. Klik tombol di bawah untuk memverifikasi email dan mengaktifkan akun kamu.</p>
    <p style="margin:28px 0"><a href="${verifyUrl}" style="display:inline-block;background:#2563eb;color:white;text-decoration:none;padding:13px 20px;border-radius:10px;font-weight:700">Aktifkan Akun</a></p>
    <p style="font-size:13px;line-height:1.6;color:#64748b">Link aktivasi berlaku selama 24 jam. Kalau kamu tidak merasa mendaftar InvoPro, abaikan email ini.</p>
  </div>
</body></html>`,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Gagal mengirim email verifikasi (${response.status})${text ? `: ${text.slice(0, 300)}` : ''}`);
  }
}
