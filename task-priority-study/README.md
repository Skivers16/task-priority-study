# Task Priority Study — Prototype penelitian skripsi

Prototype untuk membandingkan List View dan Gantt Chart saat responden mengurutkan 10 tugas berdasarkan deadline.

## Fitur yang sudah tersedia

- Dua ronde: List View dan Gantt Chart.
- Urutan tampilan diacak dari empat rencana counterbalancing.
- Dua set tugas (A/B) dengan deadline 17–26 Oktober 2026 dan sepuluh tanggal deadline unik per set.
- Instruksi konsisten: peringkat 1 = deadline paling dekat; peringkat 10 = deadline paling jauh.
- Validasi agar semua tugas diberi peringkat dan tidak ada angka yang dipakai dua kali.
- Pengukuran durasi tiap ronde dan waktu total.
- Penilaian otomatis berdasarkan urutan deadline.
- Penyimpanan lokal dalam mode demo; integrasi Supabase dalam mode online.
- Ekspor JSON sesi; mode demo juga dapat mengekspor seluruh data demo.
- Tidak meminta nama, email, atau identitas pribadi responden.

## Struktur folder

- `index.html` — halaman aplikasi.
- `styles.css` — tampilan responsif.
- `app.js` — alur eksperimen, timer, penilaian, dan penyimpanan.
- `config.js` — konfigurasi koneksi Supabase.
- `supabase/schema.sql` — tabel, kebijakan keamanan, dan query ekspor.

## A. Uji coba lokal tanpa database

1. Ekstrak ZIP ini.
2. Buka terminal pada folder project.
3. Jalankan `python -m http.server 8000`.
4. Buka `http://localhost:8000`.
5. Masukkan kode responden contoh dan centang persetujuan.
6. Setelah selesai, gunakan tombol ekspor untuk memeriksa data hasil.

Jika konfigurasi Supabase kosong, aplikasi berjalan dalam mode demo. Data hanya tersimpan pada local storage browser yang digunakan, jadi **mode ini tidak cocok untuk pengambilan data responden secara online**.

## B. Membuat database Supabase

1. Buka https://supabase.com/ dan buat project baru.
2. Masuk ke **SQL Editor**.
3. Buka file `supabase/schema.sql`, salin seluruh isinya, lalu jalankan.
4. Di dashboard project, buka bagian API / Connect dan salin:
   - Project URL
   - Publishable key (biasanya diawali `sb_publishable_...`)
5. Isi kedua nilai tersebut pada `config.js`:

   ```js
   window.STUDY_CONFIG = {
     supabaseUrl: "https://PROJECT-ANDA.supabase.co",
     supabasePublishableKey: "sb_publishable_..."
   };
   ```

6. Simpan file dan deploy ulang website.

**Jangan masukkan Secret key atau `service_role` key ke `config.js`.** File ini dikirim ke browser responden. SQL mengaktifkan Row Level Security (RLS), memberikan akses insert saja kepada pengunjung publik, dan tidak menyediakan akses baca/ubah/hapus hasil melalui API publik.

## C. Deploy gratis/berbiaya rendah ke Vercel

1. Buat repository GitHub baru dan upload seluruh isi folder project ini.
2. Buka https://vercel.com/ dan masuk menggunakan akun GitHub.
3. Pilih **Add New → Project**, lalu import repository tadi.
4. Untuk project statis ini, pilih konfigurasi tanpa framework/build command jika diminta; output root adalah folder project yang berisi `index.html`.
5. Tekan Deploy. Vercel akan memberi URL publik.
6. Buka URL tersebut dari perangkat lain dan pastikan label di kanan atas berbunyi **Penyimpanan database aktif**.
7. Lakukan uji end-to-end dengan 1–2 kode responden percobaan dan cek tabel Supabase sebelum pengumpulan data resmi.

Dokumentasi deployment: https://vercel.com/docs/deployments/overview

Alternatif hosting statis: Netlify atau GitHub Pages. Jangan menganggap hasil sudah tersimpan online hanya karena website bisa dibuka; pastikan mode database aktif dan uji satu sesi sampai tuntas.

## D. Mengekspor hasil dari Supabase

1. Buka project Supabase → SQL Editor.
2. Jalankan query SELECT paling bawah pada `supabase/schema.sql`.
3. Download hasil query sebagai CSV dari panel hasil.
4. Simpan salinan dataset mentah sebelum membersihkan atau menganalisisnya.

Tabel yang dibuat:

- `study_sessions`: kode anonim, persetujuan, rencana urutan, waktu mulai sesi.
- `trial_results`: satu baris per tampilan, durasi, jumlah jawaban tepat, akurasi, seluruh jawaban JSON, dan urutan benar.
- `session_completions`: ringkasan penyelesaian dan total waktu.

## E. Catatan metodologi yang perlu Anda tentukan sebelum pengambilan data

Prototype ini menggunakan desain **within-subject**: setiap responden mencoba kedua tampilan. Untuk mengurangi efek urutan dan efek dataset, aplikasi mengacak empat kombinasi berikut:

- List View dengan set A → Gantt Chart dengan set B
- List View dengan set B → Gantt Chart dengan set A
- Gantt Chart dengan set A → List View dengan set B
- Gantt Chart dengan set B → List View dengan set A

Kedua set memiliki sepuluh deadline unik yang sama (17–26 Oktober), tetapi nama tugasnya berbeda. Ini membantu mengurangi efek mengingat jawaban ronde pertama. Namun, sebelum penelitian resmi, sebaiknya lakukan pilot test untuk memastikan kedua set benar-benar setara dan instruksi dipahami.

Definisi skor saat ini adalah **akurasi posisi per tugas**: setiap tugas mendapat satu poin jika peringkat yang dipilih sama dengan peringkat benar berdasarkan deadline paling dekat. Akurasi keseluruhan = jumlah posisi benar / 20 tugas. Waktu aktif = jumlah durasi dua ronde; waktu elapsed sesi juga direkam terpisah.

Jika hipotesis atau metode skripsi Anda memakai definisi prioritas lain (misalnya kombinasi deadline, durasi, dan dampak), ubah aturan penilaian sebelum mengambil data.

## F. Privasi dan integritas data

- Gunakan kode responden yang tidak langsung mengidentifikasi orang.
- Jangan kumpulkan nama/email jika tidak dibutuhkan protokol penelitian.
- Pastikan prosedur persetujuan sesuai arahan dosen pembimbing/komite etik kampus.
- RLS dan kebijakan insert-only membantu mencegah responden membaca atau mengubah data lewat API publik, tetapi endpoint publik tetap bisa menerima kiriman spam. Untuk penelitian berisiko tinggi atau skala besar, pertimbangkan endpoint server-side dengan validasi tambahan/rate limiting.
- Simpan salinan ekspor data secara berkala.
