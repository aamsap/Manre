import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "@phosphor-icons/react";

const sections = [
  ["1. Sifat layanan", "Manre adalah platform komunitas gratis dan non-komersial untuk berbagi makanan surplus antar warga. Lokasi berbagi ditentukan sendiri oleh masing-masing pengguna saat memposting. Manre bukan penjual, produsen, distributor, maupun kurir makanan."],
  ["2. Tanggung jawab donor", "Donor menyatakan makanan/bahan yang dibagikan layak konsumsi, mencantumkan waktu masak (untuk makanan matang), kondisi sebenarnya, dan jendela waktu pengambilan. Donor bertanggung jawab penuh atas kualitas makanan yang dibagikan."],
  ["3. Tanggung jawab penerima", "Penerima menyatakan memahami makanan diberikan gratis, non-komersial, apa adanya, dan menerima kondisinya. Penerima wajib memeriksa sendiri kelayakan makanan sebelum dikonsumsi."],
  ["4. Larangan menjual ulang", "Dilarang menjual kembali, menukar dengan uang, atau memanfaatkan makanan dari Manre untuk tujuan komersial. Pelanggaran yang terbukti berakibat pemblokiran permanen."],
  ["5. Batas waktu & kadaluarsa", "Makanan matang maksimal jendela 6 jam; bahan mentah maksimal 48 jam. Post otomatis kadaluarsa setelah jendela berakhir."],
  ["6. No-show & kuota klaim", "Maksimal 2 klaim aktif per pengguna. Dua laporan no-show dalam 30 hari mengakibatkan larangan klaim selama 24 jam dan pengurangan trust score."],
  ["7. Moderasi", "Tiga post pertama setiap pengguna ditinjau admin. Admin dapat menolak post, menutup laporan, dan memblokir akun yang melanggar."],
  ["8. Privasi lokasi", "Pengguna membagikan lokasinya sendiri saat memposting. Pin lokasi donor dapat digeser acak ±100 meter. Detail lokasi persis hanya dibagikan melalui chat antar pihak."],
  ["9. Batas tanggung jawab", "Manre menyediakan sarana penghubung saja. Segala risiko yang timbul dari konsumsi makanan menjadi tanggung jawab donor dan penerima. Dokumen ini adalah template awal (boilerplate) dan bukan nasihat hukum."],
];

export default function Terms() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen w-full bg-[#EDE7E0]">
      <div className="relative mx-auto min-h-screen w-full max-w-md bg-sand px-5 pb-12 pt-8 shadow-2xl md:my-10 md:min-h-0 md:max-w-3xl md:rounded-[2rem] md:px-10" data-testid="terms-page">
        <button data-testid="terms-back-btn" onClick={() => navigate(-1)} className="press flex items-center gap-1 text-sm font-bold text-slate2">
          <ArrowLeft size={16} weight="bold" /> Kembali
        </button>
        <h1 className="mt-5 font-heading text-3xl font-black tracking-tight text-ink">Syarat & Ketentuan</h1>
        <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-slate2">Versi 1.0 · Komunitas Manre</p>
        <div className="mt-6 space-y-4">
          {sections.map(([t, b]) => (
            <div key={t} className="rounded-3xl border border-line bg-white p-4">
              <p className="font-heading text-sm font-extrabold text-ink">{t}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate2">{b}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
