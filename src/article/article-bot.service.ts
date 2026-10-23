import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Article } from './article.entity';
import { ArticleService } from './article.service';
import axios from 'axios';
import slugify from 'slugify';

// Curated high-intent wedding keyword bank for Indonesian couples (100+ keywords across 10 clusters)
export const WEDDING_KEYWORDS_BANK = [
  // Cluster 1: Kata Mutiara, Teks Undangan, Doa, & Ucapan (Pencarian Sangat Tinggi)
  {
    keyword: 'contoh kata mutiara undangan pernikahan kristen ayat alkitab',
    category: 'teks-undangan',
    defaultCover: 'https://images.unsplash.com/photo-1561345806-a2a89814df7a?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'teks undangan pernikahan islami sesuai sunnah walimatul ursy',
    category: 'teks-undangan',
    defaultCover: 'https://images.unsplash.com/photo-1653137790376-8f7f92afe14e?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'ayat alquran untuk undangan pernikahan ar rum 21 arab latin',
    category: 'teks-undangan',
    defaultCover: 'https://images.unsplash.com/photo-1665306376180-3349308d5a38?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'contoh penulisan turut mengundang pada undangan pernikahan yang sopan',
    category: 'teks-undangan',
    defaultCover: 'https://images.unsplash.com/photo-1647470224844-054e5023ebf9?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'contoh teks undangan pernikahan katolik doa dan sakramen perkawinan',
    category: 'teks-undangan',
    defaultCover: 'https://images.unsplash.com/photo-1769374072596-cec462031154?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'contoh teks undangan pernikahan bahasa jawa krama inggil halus',
    category: 'teks-undangan',
    defaultCover: 'https://images.unsplash.com/photo-1551843326-629cf58c42a5?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'contoh teks undangan pernikahan bahasa sunda lemes dan artinya',
    category: 'teks-undangan',
    defaultCover: 'https://images.unsplash.com/photo-1610425303802-f09737e52e28?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'teks undangan pernikahan bahasa inggris formal aesthetic dan elegan',
    category: 'teks-undangan',
    defaultCover: 'https://images.unsplash.com/photo-1647470224844-054e5023ebf9?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'contoh doa restu pernikahan kristen protestan penuh berkat',
    category: 'teks-undangan',
    defaultCover: 'https://images.unsplash.com/photo-1561345806-a2a89814df7a?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'kumpulan ucapan terimakasih pernikahan untuk souvenir dan buku tamu',
    category: 'teks-undangan',
    defaultCover: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'contoh teks undangan ngunduh mantu pihak pria lengkap susunan kata',
    category: 'teks-undangan',
    defaultCover: 'https://images.unsplash.com/photo-1551843326-629cf58c42a5?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'teks undangan akad nikah saja tanpa resepsi sopan dan ringkas',
    category: 'teks-undangan',
    defaultCover: 'https://images.unsplash.com/photo-1653137790376-8f7f92afe14e?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'kata kata undangan pernikahan lewat wa tanpa mengurangi rasa hormat',
    category: 'teks-undangan',
    defaultCover: 'https://images.unsplash.com/photo-1737749685390-0959c05aecbb?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'contoh penulisan dress code pesta pernikahan di undangan digital',
    category: 'teks-undangan',
    defaultCover: 'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'ucapan mohon doa restu pernikahan dari calon pengantin untuk orang tua',
    category: 'teks-undangan',
    defaultCover: 'https://images.unsplash.com/photo-1610425303802-f09737e52e28?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'doa walimatul ursy berkah pengantin baru bahasa arab latin terjemahan',
    category: 'teks-undangan',
    defaultCover: 'https://images.unsplash.com/photo-1665306376180-3349308d5a38?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'contoh teks undangan syukuran pernikahan sederhana walimatun nikah',
    category: 'teks-undangan',
    defaultCover: 'https://images.unsplash.com/photo-1653137790376-8f7f92afe14e?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'kutipan puisi dan quotes romantis pembuka undangan pernikahan digital',
    category: 'teks-undangan',
    defaultCover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80',
  },

  // Cluster 2: Anggaran, Biaya, & Finansial Pernikahan
  {
    keyword: 'rincian biaya nikah sederhana 30 juta sampai 50 juta realistis hemat',
    category: 'budget',
    defaultCover: 'https://images.unsplash.com/photo-1559599101-f09722fb4948?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'cara menghemat budget cetak undangan dengan undangan pernikahan digital',
    category: 'budget',
    defaultCover: 'https://images.unsplash.com/photo-1737749685390-0959c05aecbb?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'rincian biaya nikah di rumah 20 juta sederhana tapi berkesan',
    category: 'budget',
    defaultCover: 'https://images.unsplash.com/photo-1559599101-f09722fb4948?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'simulasi biaya pernikahan gedung 100 juta untuk 300 sampai 500 tamu',
    category: 'budget',
    defaultCover: 'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'tips negosiasi vendor katering pernikahan agar dapat diskon dan bonus',
    category: 'budget',
    defaultCover: 'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'cara membagi biaya pernikahan antara pihak pria dan wanita secara adil',
    category: 'budget',
    defaultCover: 'https://images.unsplash.com/photo-1559599101-f09722fb4948?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'kesalahan mengatur budget pernikahan yang bikin pengantin baru boncos',
    category: 'budget',
    defaultCover: 'https://images.unsplash.com/photo-1559599101-f09722fb4948?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'daftar pos pengeluaran pernikahan tersembunyi yang sering terlupakan',
    category: 'budget',
    defaultCover: 'https://images.unsplash.com/photo-1559599101-f09722fb4948?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'tips memilih paket all in one wedding organizer hemat dan terpercaya',
    category: 'budget',
    defaultCover: 'https://images.unsplash.com/photo-1759661937582-0ccd5dacf20f?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'strategi menabung biaya nikah bersama pasangan dalam waktu 1 tahun',
    category: 'budget',
    defaultCover: 'https://images.unsplash.com/photo-1559599101-f09722fb4948?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'perbandingan biaya nikah di kua vs nikah di luar kantor kua penghulu',
    category: 'budget',
    defaultCover: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'cara menghemat biaya dekorasi pernikahan pelaminan rustic minimalis',
    category: 'budget',
    defaultCover: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80',
  },

  // Cluster 3: Susunan Acara, Panitia, MC, & Rundown
  {
    keyword: 'susunan panitia pernikahan keluarga checklist dan pembagian tugas lengkap',
    category: 'rundown-panitia',
    defaultCover: 'https://images.unsplash.com/photo-1759661937582-0ccd5dacf20f?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'rundown acara akad nikah dan resepsi 2 jam sederhana khidmat',
    category: 'rundown-panitia',
    defaultCover: 'https://images.unsplash.com/photo-1677768061409-3d4fbd0250d1?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'teks mc pernikahan formal akad dan resepsi bahasa indonesia modern',
    category: 'rundown-panitia',
    defaultCover: 'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'contoh susunan acara lamaran dan tunangan keluarga sederhana',
    category: 'rundown-panitia',
    defaultCover: 'https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'teks mc akad nikah islami khidmat dan runtut dengan ijab kabul',
    category: 'rundown-panitia',
    defaultCover: 'https://images.unsplash.com/photo-1653137790376-8f7f92afe14e?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'teks sambutan penyerahan calon pengantin pria oleh wakil keluarga',
    category: 'rundown-panitia',
    defaultCover: 'https://images.unsplash.com/photo-1677768061409-3d4fbd0250d1?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'teks sambutan penerimaan calon pengantin wanita penuh kehangatan',
    category: 'rundown-panitia',
    defaultCover: 'https://images.unsplash.com/photo-1677768061409-3d4fbd0250d1?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'rundown intimate wedding outdoor sore hari romantis dan santai',
    category: 'rundown-panitia',
    defaultCover: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'tugas dan tanggung jawab saksi nikah dalam hukum islam dan negara',
    category: 'rundown-panitia',
    defaultCover: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'checklist perlengkapan darurat emergency kit pengantin saat hari h',
    category: 'rundown-panitia',
    defaultCover: 'https://images.unsplash.com/photo-1759661937582-0ccd5dacf20f?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'susunan panitia among tamu dan penerima tamu pernikahan modern',
    category: 'rundown-panitia',
    defaultCover: 'https://images.unsplash.com/photo-1759661937582-0ccd5dacf20f?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'panduan gladi resik pernikahan h min 1 hal penting yang wajib dicek',
    category: 'rundown-panitia',
    defaultCover: 'https://images.unsplash.com/photo-1677768061409-3d4fbd0250d1?auto=format&fit=crop&w=1200&q=80',
  },

  // Cluster 4: Adat & Tradisi Budaya Nusantara
  {
    keyword: 'urutan prosesi pernikahan adat jawa panggih midodareni siraman',
    category: 'adat',
    defaultCover: 'https://images.unsplash.com/photo-1551843326-629cf58c42a5?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'tahapan prosesi pernikahan adat sunda ngeuyeuk seureuh sungkeman lengkap',
    category: 'adat',
    defaultCover: 'https://images.unsplash.com/photo-1610425303802-f09737e52e28?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'urutan pernikahan adat batak toba marhusip martumpol hingga pesta unjuk',
    category: 'adat',
    defaultCover: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'tahapan prosesi pernikahan adat minang malam bainai dan batimbang tando',
    category: 'adat',
    defaultCover: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'makna dan tata cara tradisi mappacci pernikahan adat bugis makassar',
    category: 'adat',
    defaultCover: 'https://images.unsplash.com/photo-1606800052052-a08af7148866?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'makna filosofis prosesi balangan suruh dan kacar kucur adat jawa solo',
    category: 'adat',
    defaultCover: 'https://images.unsplash.com/photo-1551843326-629cf58c42a5?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'urutan upacara pernikahan adat bali pawiwahan mepamit dan madengen dengen',
    category: 'adat',
    defaultCover: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'prosesi pernikahan adat palembang arak arakan dan cacap cacapan',
    category: 'adat',
    defaultCover: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'tata cara adat sunda sawer panganten huap lingkung meuleum harupat',
    category: 'adat',
    defaultCover: 'https://images.unsplash.com/photo-1610425303802-f09737e52e28?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'makna mahar uang panai suku bugis dan cara perhitungannya yang bijak',
    category: 'adat',
    defaultCover: 'https://images.unsplash.com/photo-1606800052052-a08af7148866?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'prosesi pernikahan adat betawi palang pintu berbalas pantun jenaka',
    category: 'adat',
    defaultCover: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'tata cara siraman pengantin adat jawa makna air 7 sumber dan kembang setaman',
    category: 'adat',
    defaultCover: 'https://images.unsplash.com/photo-1551843326-629cf58c42a5?auto=format&fit=crop&w=1200&q=80',
  },

  // Cluster 5: Administrasi, Dokumen, & Regulasi (KUA & Catatan Sipil)
  {
    keyword: 'syarat nikah di kua terbaru tahun 2026 dan alur pendaftaran lengkap',
    category: 'administrasi-kua',
    defaultCover: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'panduan daftar nikah online lewat simkah kemenag langkah demi langkah',
    category: 'administrasi-kua',
    defaultCover: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'cara mengurus surat n1 n2 n4 dari kelurahan untuk pendaftaran nikah',
    category: 'administrasi-kua',
    defaultCover: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'syarat tes kesehatan pranikah di puskesmas dan sertifikat elsimil bkkbn',
    category: 'administrasi-kua',
    defaultCover: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'syarat nikah beda daerah atau numpang nikah beda kabupaten provinsi',
    category: 'administrasi-kua',
    defaultCover: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'panduan mengurus pernikahan catatan sipil non muslim kristen budha hindu',
    category: 'administrasi-kua',
    defaultCover: 'https://images.unsplash.com/photo-1561345806-a2a89814df7a?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'syarat dispensasi nikah pengadilan agama prosedur dan dokumen yang dibutuhkan',
    category: 'administrasi-kua',
    defaultCover: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'panduan kursus calon pengantin suscatin bimbingan perkawinan di kua',
    category: 'administrasi-kua',
    defaultCover: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'cara mengurus surat nikah siri menjadi buku nikah resmi isbat nikah',
    category: 'administrasi-kua',
    defaultCover: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'prosedur perjanjian pranikah prenup pisah harta di notaris indonesia',
    category: 'administrasi-kua',
    defaultCover: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'syarat nikah campuran wni dan wna di indonesia kedutaan dan imigrasi',
    category: 'administrasi-kua',
    defaultCover: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'cara update kk dan ktp setelah menikah di dukcapil cepat dan gratis',
    category: 'administrasi-kua',
    defaultCover: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=1200&q=80',
  },

  // Cluster 6: Undangan Digital & Teknologi Pernikahan
  {
    keyword: 'keuntungan undangan pernikahan digital website dibanding undangan fisik',
    category: 'undangan-digital',
    defaultCover: 'https://images.unsplash.com/photo-1555774698-0b77e0d5fac6?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'daftar lagu romantis pernikahan pengiring undangan digital terpopuler',
    category: 'undangan-digital',
    defaultCover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'cara membuat undangan digital gratis langsung jadi dalam 5 menit',
    category: 'undangan-digital',
    defaultCover: 'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'etika mengirim undangan pernikahan digital lewat whatsapp yang sopan',
    category: 'undangan-digital',
    defaultCover: 'https://images.unsplash.com/photo-1737749685390-0959c05aecbb?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'cara setting rsvp online dan qr code tamu undangan digital anti ribet',
    category: 'undangan-digital',
    defaultCover: 'https://images.unsplash.com/photo-1555774698-0b77e0d5fac6?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'cara mencantumkan nomor rekening dan qris amplop digital yang elegan',
    category: 'undangan-digital',
    defaultCover: 'https://images.unsplash.com/photo-1737749685390-0959c05aecbb?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'waktu paling tepat menyebarkan undangan pernikahan agar tamu banyak hadir',
    category: 'undangan-digital',
    defaultCover: 'https://images.unsplash.com/photo-1647470224844-054e5023ebf9?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'cara membuat pesan siaran broadcast wa undangan pernikahan tanpa di banned',
    category: 'undangan-digital',
    defaultCover: 'https://images.unsplash.com/photo-1737749685390-0959c05aecbb?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'tips memilih template undangan digital website sesuai konsep pernikahan',
    category: 'undangan-digital',
    defaultCover: 'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'keuntungan fitur buku tamu digital qr code scan kehadiran di resepsi',
    category: 'undangan-digital',
    defaultCover: 'https://images.unsplash.com/photo-1555774698-0b77e0d5fac6?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'fitur hitung mundur countdown pernikahan di website undangan digital',
    category: 'undangan-digital',
    defaultCover: 'https://images.unsplash.com/photo-1737749685390-0959c05aecbb?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'cara custom nama tamu tanpa batas di link undangan website satuundangan',
    category: 'undangan-digital',
    defaultCover: 'https://images.unsplash.com/photo-1555774698-0b77e0d5fac6?auto=format&fit=crop&w=1200&q=80',
  },

  // Cluster 7: Seserahan, Hantaran, Mahar, & Cincin
  {
    keyword: 'daftar seserahan pernikahan sederhana dan hantaran pengantin wanita pria',
    category: 'seserahan-mahar',
    defaultCover: 'https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'daftar balasan seserahan dari pihak wanita untuk pengantin pria lengkap',
    category: 'seserahan-mahar',
    defaultCover: 'https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'ide mahar pernikahan unik bermanfaat kekinian dan tidak memberatkan',
    category: 'seserahan-mahar',
    defaultCover: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'rekomendasi isi kotak seserahan skincare make up pengantin wanita',
    category: 'seserahan-mahar',
    defaultCover: 'https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'perbedaan cincin kawin emas kuning emas putih palladium dan platina',
    category: 'seserahan-mahar',
    defaultCover: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'tips memilih ukuran cincin tunangan dan cincin kawin yang pas di jari',
    category: 'seserahan-mahar',
    defaultCover: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'cara menghias kotak seserahan akrilik sendiri di rumah hemat biaya',
    category: 'seserahan-mahar',
    defaultCover: 'https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'makna filosofi seperangkat alat sholat sebagai mahar pernikahan islami',
    category: 'seserahan-mahar',
    defaultCover: 'https://images.unsplash.com/photo-1665306376180-3349308d5a38?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'hukum tawar menawar mahar pernikahan dalam pandangan islam',
    category: 'seserahan-mahar',
    defaultCover: 'https://images.unsplash.com/photo-1653137790376-8f7f92afe14e?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'checklist barang seserahan adat sunda jawa yang wajib disiapkan',
    category: 'seserahan-mahar',
    defaultCover: 'https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=1200&q=80',
  },

  // Cluster 8: Gaun, Busana, MUA, & Dokumentasi
  {
    keyword: 'ide tema undangan pernikahan anime jepang unik aesthetic keren',
    category: 'vendor-makeup',
    defaultCover: 'https://images.unsplash.com/photo-1519882189396-71f93cb4714b?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'tips memilih mua pengantin flawless awet tahan seharian anti luntur',
    category: 'vendor-makeup',
    defaultCover: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'inspirasi gaun pengantin muslimah syari elegan modern dan tidak ketat',
    category: 'vendor-makeup',
    defaultCover: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'perbedaan kebaya akad nikah siger sunda solo putri dan jogja paes ageng',
    category: 'vendor-makeup',
    defaultCover: 'https://images.unsplash.com/photo-1610425303802-f09737e52e28?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'ide konsep foto prewedding casual sederhana outdoor tanpa sewa studio mahal',
    category: 'vendor-makeup',
    defaultCover: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'checklist daftar pose foto wajib dokumentasi pernikahan akad dan resepsi',
    category: 'vendor-makeup',
    defaultCover: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'tips memilih jas pengantin pria modern slim fit sesuai bentuk tubuh',
    category: 'vendor-makeup',
    defaultCover: 'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'tren warna tema pernikahan aesthetic terpopuler tahun 2026',
    category: 'vendor-makeup',
    defaultCover: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'tips perawatan kulit pranikah 3 bulan sebelum hari h agar glowing',
    category: 'vendor-makeup',
    defaultCover: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'tips memilih sepatu pengantin wanita heels nyaman tidak bikin pegal',
    category: 'vendor-makeup',
    defaultCover: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1200&q=80',
  },

  // Cluster 9: Katering, Venue, & Souvenir
  {
    keyword: 'checklist memilih vendor katering pernikahan enak bersih dan terpercaya',
    category: 'katering-venue',
    defaultCover: 'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'cara menghitung porsi katering pernikahan agar tidak kurang makanan',
    category: 'katering-venue',
    defaultCover: 'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'ide souvenir pernikahan unik murah bermanfaat di bawah 5000 rupiah',
    category: 'katering-venue',
    defaultCover: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'rekomendasi souvenir pernikahan bibit tanaman sukulen eco friendly',
    category: 'katering-venue',
    defaultCover: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'kelebihan dan kekurangan menikah di hotel gedung serbaguna vs di rumah',
    category: 'katering-venue',
    defaultCover: 'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'tips memilih menu pondokan resepsi pernikahan yang paling laris disukai tamu',
    category: 'katering-venue',
    defaultCover: 'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'ide hiburan pernikahan akustik live band playlist lagu romantis akustik',
    category: 'katering-venue',
    defaultCover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80',
  },

  // Cluster 10: Honeymoon & Kehidupan Awal Pasca Nikah
  {
    keyword: 'rekomendasi destinasi bulan madu romantis di indonesia hemat budget',
    category: 'honeymoon',
    defaultCover: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'checklist persiapan barang bawaan honeymoon luar kota dan luar negeri',
    category: 'honeymoon',
    defaultCover: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'tips finansial pasangan baru menikah mengatur keuangan rumah tangga',
    category: 'honeymoon',
    defaultCover: 'https://images.unsplash.com/photo-1559599101-f09722fb4948?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'panduan membeli rumah pertama untuk pasangan pengantin baru milenial',
    category: 'honeymoon',
    defaultCover: 'https://images.unsplash.com/photo-1559599101-f09722fb4948?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keyword: 'cara adaptasi tinggal mandiri setelah menikah vs tinggal di rumah mertua',
    category: 'honeymoon',
    defaultCover: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
  },
];

export function resolveContextualCover(text: string, fallback?: string): string {
  const lower = (text || '').toLowerCase();

  // Batak
  if (lower.includes('batak') || lower.includes('marhusip') || lower.includes('martumpol') || lower.includes('unjuk') || lower.includes('ulos')) {
    return 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=1200&q=80';
  }
  // Minang / Padang
  if (lower.includes('minang') || lower.includes('suntiang') || lower.includes('bainai') || lower.includes('batimbang')) {
    return 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1200&q=80';
  }
  // Bali / Hindu
  if (lower.includes('bali') || lower.includes('pawiwahan') || lower.includes('mepamit') || lower.includes('hindu')) {
    return 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1200&q=80';
  }
  // Bugis / Makassar
  if (lower.includes('bugis') || lower.includes('makassar') || lower.includes('mappacci') || lower.includes('panai')) {
    return 'https://images.unsplash.com/photo-1606800052052-a08af7148866?auto=format&fit=crop&w=1200&q=80';
  }
  // Jawa
  if (lower.includes('jawa') || lower.includes('panggih') || lower.includes('siraman') || lower.includes('midodareni') || lower.includes('krama') || lower.includes('ngunduh mantu') || lower.includes('kacar kucur') || lower.includes('balangan suruh')) {
    return 'https://images.unsplash.com/photo-1551843326-629cf58c42a5?auto=format&fit=crop&w=1200&q=80';
  }
  // Sunda
  if (lower.includes('sunda') || lower.includes('siger') || lower.includes('ngeuyeuk') || lower.includes('seureuh') || lower.includes('sungkeman') || lower.includes('sawer')) {
    return 'https://images.unsplash.com/photo-1610425303802-f09737e52e28?auto=format&fit=crop&w=1200&q=80';
  }
  // Christian / Katolik / Alkitab
  if (lower.includes('kristen') || lower.includes('alkitab') || lower.includes('gereja') || lower.includes('matrimony') || lower.includes('protestan')) {
    return 'https://images.unsplash.com/photo-1561345806-a2a89814df7a?auto=format&fit=crop&w=1200&q=80';
  }
  if (lower.includes('katolik') || lower.includes('sakramen')) {
    return 'https://images.unsplash.com/photo-1769374072596-cec462031154?auto=format&fit=crop&w=1200&q=80';
  }
  // Islamic / Quran / KUA
  if (lower.includes('quran') || lower.includes('ar rum') || lower.includes('ayat')) {
    return 'https://images.unsplash.com/photo-1665306376180-3349308d5a38?auto=format&fit=crop&w=1200&q=80';
  }
  if (lower.includes('islami') || lower.includes('sunnah') || lower.includes('walimatul') || lower.includes('akad') || lower.includes('ijab kabul')) {
    return 'https://images.unsplash.com/photo-1653137790376-8f7f92afe14e?auto=format&fit=crop&w=1200&q=80';
  }
  // Legal / KUA / Catatan Sipil / Administrasi
  if (lower.includes('kua') || lower.includes('simkah') || lower.includes('kelurahan') || lower.includes('n1') || lower.includes('dukcapil') || lower.includes('elsimil') || lower.includes('dispensasi') || lower.includes('pranikah') || lower.includes('catatan sipil') || lower.includes('suscatin')) {
    return 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=1200&q=80';
  }
  // Cincin & Mahar
  if (lower.includes('cincin') || lower.includes('mahar') || lower.includes('palladium') || lower.includes('platina') || lower.includes('perhiasan')) {
    return 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=1200&q=80';
  }
  // Seserahan & Hantaran
  if (lower.includes('seserahan') || lower.includes('hantaran') || lower.includes('lamaran') || lower.includes('tunangan')) {
    return 'https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=1200&q=80';
  }
  // Souvenir & Hadiah
  if (lower.includes('souvenir') || lower.includes('cinderamata') || lower.includes('sukulen')) {
    return 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=1200&q=80';
  }
  // MUA & Gaun / Busana Pengantin
  if (lower.includes('mua') || lower.includes('makeup') || lower.includes('rias') || lower.includes('gaun') || lower.includes('kebaya') || lower.includes('heels') || lower.includes('jas pengantin') || lower.includes('skincare')) {
    return 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1200&q=80';
  }
  // Katering & Makanan
  if (lower.includes('katering') || lower.includes('catering') || lower.includes('menu') || lower.includes('pondokan') || lower.includes('porsi')) {
    return 'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=1200&q=80';
  }
  // Prewedding & Foto
  if (lower.includes('prewedding') || lower.includes('pose foto') || lower.includes('dokumentasi') || lower.includes('fotografi')) {
    return 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80';
  }
  // Panitia, MC, Rundown
  if (lower.includes('panitia') || lower.includes('checklist') || lower.includes('among tamu') || lower.includes('gladi resik') || lower.includes('emergency kit')) {
    return 'https://images.unsplash.com/photo-1759661937582-0ccd5dacf20f?auto=format&fit=crop&w=1200&q=80';
  }
  if (lower.includes('rundown') || lower.includes('susunan acara') || lower.includes('mc') || lower.includes('sambutan')) {
    return 'https://images.unsplash.com/photo-1677768061409-3d4fbd0250d1?auto=format&fit=crop&w=1200&q=80';
  }
  // Budget & Biaya
  if (lower.includes('budget') || lower.includes('biaya') || lower.includes('hemat') || lower.includes('simulasi biaya') || lower.includes('menabung') || lower.includes('boncos')) {
    return 'https://images.unsplash.com/photo-1559599101-f09722fb4948?auto=format&fit=crop&w=1200&q=80';
  }
  // Lagu & Musik
  if (lower.includes('lagu') || lower.includes('musik') || lower.includes('akustik') || lower.includes('playlist')) {
    return 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80';
  }
  // Honeymoon & Bulan Madu
  if (lower.includes('honeymoon') || lower.includes('bulan madu') || lower.includes('rumah tangga') || lower.includes('mertua')) {
    return 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80';
  }
  // Anime / Jepang
  if (lower.includes('anime') || lower.includes('jepang')) {
    return 'https://images.unsplash.com/photo-1519882189396-71f93cb4714b?auto=format&fit=crop&w=1200&q=80';
  }
  // Digital / Website / RSVP / QR
  if (lower.includes('digital') || lower.includes('online') || lower.includes('website') || lower.includes('whatsapp') || lower.includes('rsvp') || lower.includes('qr') || lower.includes('countdown')) {
    return 'https://images.unsplash.com/photo-1737749685390-0959c05aecbb?auto=format&fit=crop&w=1200&q=80';
  }
  return fallback || 'https://images.unsplash.com/photo-1737749685390-0959c05aecbb?auto=format&fit=crop&w=1200&q=80';
}

@Injectable()
export class ArticleBotService {
  private readonly logger = new Logger(ArticleBotService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly articleService: ArticleService,
    @InjectRepository(Article)
    private readonly articleRepository: Repository<Article>,
  ) {}

  /**
   * Cron Job: Runs automatically every day at 08:00 AM WIB (Asia/Jakarta)
   * Pattern: second=0, minute=0, hour=8, day=*, month=*, dayOfWeek=*
   */
  @Cron('0 8 * * *', {
    name: 'auto_blog_publisher',
    timeZone: 'Asia/Jakarta',
  })
  async handleDailyScheduledBlog() {
    this.logger.log('⏰ Triggered daily automated blog generation (08:00 WIB)');

    const isEnabled = this.configService.get<string>('AUTO_BLOG_ENABLED', 'true') !== 'false';
    if (!isEnabled) {
      this.logger.log('Auto blog is disabled via AUTO_BLOG_ENABLED=false. Skipping.');
      return;
    }

    try {
      const result = await this.generateAndPublishNextArticle();
      this.logger.log(`✅ Successfully published article via Auto-Blogger: "${result.title}" (ID: ${result.id})`);
    } catch (error) {
      this.logger.error(`❌ Failed daily automated blog generation: ${error.message}`, error.stack);
    }
  }

  /**
   * Finds the next topic from the curated bank that hasn't been written yet.
   * If all 100+ keywords are exhausted, dynamically synthesizes a completely new unique topic.
   */
  async getNextUnpublishedKeyword(): Promise<{ keyword: string; category: string; defaultCover: string }> {
    const existingArticles = await this.articleRepository.find({
      select: ['title', 'slug', 'focusKeyword'],
    });

    const isMatch = (field: string | null | undefined, target: string) => {
      if (!field || !target) return false;
      const f = field.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
      const t = target.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
      return f.includes(t) || t.includes(f);
    };

    for (const item of WEDDING_KEYWORDS_BANK) {
      const itemSlugPrefix = slugify(item.keyword, { lower: true, strict: true }).slice(0, 30);
      const isAlreadyWritten = existingArticles.some(
        (art) =>
          isMatch(art.focusKeyword, item.keyword) ||
          isMatch(art.title, item.keyword) ||
          (art.slug && (art.slug.includes(itemSlugPrefix) || isMatch(art.slug, itemSlugPrefix))),
      );

      if (!isAlreadyWritten) {
        return item;
      }
    }

    // Dynamic Topic Generator (Infinite Uniqueness Fallback):
    // Synthesizes a completely unwritten topic using combinations of Angles x Subjects x Contexts
    return this.generateDynamicUnpublishedTopic(existingArticles);
  }

  /**
   * Smart Dynamic Fallback Generator:
   * Generates a unique, high-intent topic from a permutation matrix to prevent identical duplicates and -2/-3/-4 slugs.
   */
  private generateDynamicUnpublishedTopic(
    existingArticles: Partial<Article>[],
  ): { keyword: string; category: string; defaultCover: string } {
    const angles = [
      'panduan lengkap',
      'tips praktis dan cara mengurus',
      'checklist lengkap persiapan',
      'kesalahan umum dan solusi',
      'cara cerdas menghemat budget',
      'rekomendasi dan inspirasi',
      'tata cara dan etika sopan',
      'strategi jitu persiapan',
      'tahapan penting',
      'rahasia sukses merancang',
    ];

    const subjects = [
      { topic: 'buku tamu digital qr code scan kehadiran resepsi', category: 'undangan-digital' },
      { topic: 'amplop digital qris bebas potongan untuk sumbangan pernikahan', category: 'undangan-digital' },
      { topic: 'undangan pernikahan website ramah lansia dan mudah dibuka', category: 'undangan-digital' },
      { topic: 'seserahan skincare dan kosmetik pengantin wanita lengkap', category: 'seserahan-mahar' },
      { topic: 'cincin kawin bahan palladium anti karat untuk pria muslim', category: 'seserahan-mahar' },
      { topic: 'souvenir bibit tanaman sukulen unik ramah lingkungan', category: 'katering-venue' },
      { topic: 'menu katering pondokan pernikahan paling disukai tamu', category: 'katering-venue' },
      { topic: 'foto prewedding kasual outdoor street style tanpa studio mahal', category: 'vendor-makeup' },
      { topic: 'makeup pengantin glowing natural tahan seharian kulit berminyak', category: 'vendor-makeup' },
      { topic: 'kebaya akad nikah muslimah syari modern tidak ketat', category: 'vendor-makeup' },
      { topic: 'perjanjian pranikah pisah harta menurut hukum indonesia di notaris', category: 'administrasi-kua' },
      { topic: 'syarat tes kesehatan pranikah puskesmas sertifikat elsimil', category: 'administrasi-kua' },
      { topic: 'bimbingan perkawinan suscatin mandiri di kua kecamatan', category: 'administrasi-kua' },
      { topic: 'susunan panitia among tamu dan penerima tamu pernikahan', category: 'rundown-panitia' },
      { topic: 'teks sambutan penerimaan mempelai pria oleh keluarga wanita', category: 'rundown-panitia' },
      { topic: 'emergency kit pengantin perlengkapan darurat saat hari h', category: 'rundown-panitia' },
      { topic: 'dekorasi pelaminan rustic minimalis hemat biaya di rumah', category: 'budget' },
      { topic: 'pembagian porsi katering agar tidak kekurangan makanan resepsi', category: 'budget' },
      { topic: 'rincian paket all in one wedding organizer hemat transparan', category: 'budget' },
      { topic: 'destinasi bulan madu romantis di indonesia ramah kantong', category: 'honeymoon' },
    ];

    const contexts = [
      'pernikahan modern elegan',
      'pernikahan intimate sederhana',
      'resepsi pernikahan di rumah',
      'calon pengantin baru',
      'konsep pernikahan kekinian',
    ];

    // Try permutations until we find one that has never been written
    for (const subject of subjects) {
      for (const angle of angles) {
        for (const context of contexts) {
          const synthesized = `${angle} ${subject.topic} untuk ${context}`;
          const synthSlugPrefix = slugify(synthesized, { lower: true, strict: true }).slice(0, 30);

          const alreadyExists = existingArticles.some(
            (art) =>
              (art.focusKeyword && art.focusKeyword.toLowerCase().includes(subject.topic)) ||
              (art.title && art.title.toLowerCase().includes(subject.topic)) ||
              (art.slug && art.slug.includes(synthSlugPrefix)),
          );

          if (!alreadyExists) {
            return {
              keyword: synthesized,
              category: subject.category,
              defaultCover: resolveContextualCover(synthesized),
            };
          }
        }
      }
    }

    // Ultimate fallback if hundreds of articles have been generated
    const randomAngle = angles[Math.floor(Math.random() * angles.length)];
    const randomSubject = subjects[Math.floor(Math.random() * subjects.length)];
    const uniqueFallback = `${randomAngle} ${randomSubject.topic} edisi spesial`;
    return {
      keyword: uniqueFallback,
      category: randomSubject.category,
      defaultCover: resolveContextualCover(uniqueFallback),
    };
  }

  /**
   * Generates and publishes an article (used by Cron or manual Admin call)
   */
  async generateAndPublishNextArticle(customTopic?: string, targetStatus: 'published' | 'draft' = 'published') {
    const apiKey =
      this.configService.get<string>('GEMINI_API_KEY') ||
      this.configService.get<string>('GOOGLE_API_KEY');

    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY or GOOGLE_API_KEY is not set in backend environment variables. Please provide your Google AI Studio API key.',
      );
    }

    const topicItem = customTopic
      ? {
          keyword: customTopic,
          category: 'pernikahan',
          defaultCover: resolveContextualCover(customTopic),
        }
      : await this.getNextUnpublishedKeyword();

    this.logger.log(`Generating article with Gemini AI for target keyword: "${topicItem.keyword}"`);

    // Fetch the 20 most recent articles to provide as an exclusion prompt for Gemini
    const recentArticles = await this.articleRepository.find({
      select: ['title'],
      order: { createdAt: 'DESC' },
      take: 20,
    });
    const recentTitles = recentArticles.map((a) => `- ${a.title}`).join('\n');

    const generated = await this.callGeminiForArticle(topicItem.keyword, apiKey, recentTitles);

    // Ensure CTA Box is present for maximum conversion to SatuUndangan
    const contentWithCTA = this.ensureCtaAndBranding(generated.content);

    // Resolve contextually accurate cover image
    const finalCover = resolveContextualCover(
      `${generated.title} ${topicItem.keyword}`,
      topicItem.defaultCover,
    );

    // Build unique base slug
    let targetSlug = generated.slug
      ? slugify(generated.slug, { lower: true, strict: true })
      : slugify(generated.title, { lower: true, strict: true });

    // Prevent direct duplicate slug collisions before passing to ArticleService
    const existingSlug = await this.articleRepository.findOne({ where: { slug: targetSlug } });
    if (existingSlug) {
      const categoryModifier = slugify(topicItem.category || 'tips', { lower: true, strict: true });
      targetSlug = `${targetSlug}-${categoryModifier}`;
    }

    // Save article to database
    const newArticle = await this.articleService.create(
      {
        title: generated.title,
        slug: targetSlug,
        content: contentWithCTA,
        excerpt: generated.excerpt,
        coverImage: finalCover,
        metaTitle: generated.metaTitle || generated.title,
        metaDescription: generated.metaDescription || generated.excerpt,
        focusKeyword: generated.focusKeyword || topicItem.keyword,
        status: targetStatus,
      },
      1, // Author: Admin (ID 1)
    );

    return newArticle;
  }

  /**
   * Calls Google Gemini REST API with strict JSON schema response and anti-duplication instructions
   */
  private async callGeminiForArticle(keyword: string, apiKey: string, recentTitles?: string) {
    const currentYear = new Date().getFullYear();
    const prompt = `Anda adalah Senior SEO Content Strategist dan Editor Ahli untuk SatuUndangan (platform pembuatan undangan pernikahan digital aesthetic & instan di Indonesia).
Tulis artikel panduan pernikahan yang SANGAT MENDALAM, KOMPREHENSIF, dan RAMAH SEO (High EEAT) untuk keyword target: "${keyword}".

PENTING - ATURAN ANTI-DUPLIKASI (GOOGLE HELPFUL CONTENT COMPLIANT):
Berikut adalah judul-judul artikel yang SUDAH DITERBITKAN sebelumnya di website SatuUndangan:
${recentTitles || '(Belum ada artikel terdahulu)'}

ATURAN WAJIB GEMINI:
1. Judul dan slug yang Anda buat HARUS 100% UNIK, SEGAR, dan TIDAK BOLEH mirip atau mengulang struktur kata dari judul-judul di atas.
2. Dilarang keras membuat judul generik atau hanya menempelkan "Terbaru ${currentYear}" pada topik yang serupa.
3. Fokuskan artikel pada keyword target: "${keyword}". Berikan solusi spesifik, studi kasus, tips praktis, data, atau checklist yang dapat langsung dipraktekkan calon pengantin.

PANDUAN KONTEN:
1. Panjang artikel: Minimal 1.200 - 1.500 kata. Daging semua, bukan basa-basi generik.
2. Struktur:
   - Pembuka yang menarik (Hook masalah calon pengantin).
   - Beberapa sub-heading <h2> dan <h3> dengan poin-poin yang mudah dipahami.
   - Contoh nyata (misal: contoh teks/kutipan, tabel perbandingan budget, atau checklist susunan acara).
   - Bagian FAQ (Frequently Asked Questions) berisi 3-4 pertanyaan umum dan jawaban ringkas.
3. Gaya bahasa: Mengalir, sopan, bersahabat, terpercaya, dan menggunakan Bahasa Indonesia baku yang luwes.
4. Sertakan referensi ke tahun ${currentYear} bila relevan.
5. Format konten di field 'content' wajib menggunakan HTML bersih (gunakan tag <h2>, <h3>, <p>, <ul>, <li>, <blockquote>, <table>, <thead>, <tbody>, <tr>, <th>, <td>). Jangan gunakan tag <html> atau <body>.

Balas HANYA dalam format JSON valid dengan struktur:
{
  "title": "Judul artikel yang memikat, mengandung keyword, 50-65 karakter",
  "slug": "url-slug-ramah-seo-tanpa-spasi",
  "excerpt": "Ringkasan padat dan memikat 140-160 karakter untuk meta description dan kartu preview",
  "focusKeyword": "${keyword}",
  "metaTitle": "Title SEO untuk Google Search (50-60 karakter)",
  "metaDescription": "Deskripsi SEO yang memicu klik di Google (140-160 karakter)",
  "content": "Konten lengkap artikel dalam format HTML semantik",
  "faqs": [
    { "question": "Pertanyaan 1?", "answer": "Jawaban 1..." },
    { "question": "Pertanyaan 2?", "answer": "Jawaban 2..." }
  ]
}`;

    // Prioritize fast and cost-effective flash models first
    const models = [
      'gemini-3.5-flash-lite',
      'gemini-3.8-flash',
      'gemini-3.7-flash',
      'gemini-flash-lite-latest',
      'gemini-flash-latest',
    ];
    let lastError: any = null;

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await axios.post(
          url,
          {
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 8192,
              responseMimeType: 'application/json',
            },
          },
          {
            timeout: 60000,
            headers: { 'Content-Type': 'application/json' },
          },
        );

        const candidates = response.data?.candidates;
        if (!candidates || candidates.length === 0) {
          throw new Error('Gemini API returned no candidates');
        }

        const rawText = candidates[0].content?.parts?.[0]?.text;
        if (!rawText) {
          throw new Error('Empty response from Gemini');
        }

        const parsed = JSON.parse(rawText);
        return parsed;
      } catch (err) {
        lastError = err;
        this.logger.warn(`Model ${model} failed: ${err.message}. Trying fallback if available.`);
      }
    }

    throw new Error(`Failed to generate article from Gemini: ${lastError?.message}`);
  }

  /**
   * Injects an eye-catching CTA box into the HTML content to convert readers into SatuUndangan users
   */
  private ensureCtaAndBranding(htmlContent: string): string {
    const ctaBanner = `
<div class="my-10 p-6 md:p-8 rounded-2xl bg-gradient-to-r from-[#2c1d11]/5 via-[#d4af37]/10 to-[#2c1d11]/5 border border-[#d4af37]/30 text-center shadow-sm">
  <span class="inline-block px-3 py-1 bg-[#d4af37]/20 text-[#8c6b2d] rounded-full text-xs font-bold uppercase tracking-widest mb-3">Solusi Undangan Pernikahan Digital</span>
  <h3 class="text-xl md:text-2xl font-bold text-gray-900 mb-2">Buat Undangan Pernikahan Digital Impianmu di SatuUndangan</h3>
  <p class="text-sm text-gray-600 max-w-xl mx-auto mb-6 leading-relaxed">
    Nikmati kemudahan membuat undangan digital modern dengan fitur lengkap: RSVP instan, amplop digital QRIS, countdown acara, dan pilihan musik romantis bebas pilih.
  </p>
  <div class="flex flex-wrap items-center justify-center gap-4">
    <a href="/create" class="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#2c1d11] text-white font-bold text-sm shadow-md hover:bg-[#432d1a] transition-all">
      Buat Undangan Sekarang
    </a>
    <a href="/templates" class="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-all">
      Lihat Katalog Desain
    </a>
  </div>
</div>`;

    return `${htmlContent}\n\n${ctaBanner}`;
  }

  /**
   * Retrieves bot status and remaining topics for admin dashboard
   */
  async getStatus() {
    const totalPublished = await this.articleRepository.count();
    const remainingKeywordCount = WEDDING_KEYWORDS_BANK.length;
    const isConfigured = Boolean(
      this.configService.get<string>('GEMINI_API_KEY') ||
      this.configService.get<string>('GOOGLE_API_KEY'),
    );

    return {
      autoBlogEnabled: this.configService.get<string>('AUTO_BLOG_ENABLED', 'true') !== 'false',
      scheduleTime: '08:00 WIB (Setiap Hari)',
      geminiConfigured: isConfigured,
      totalArticlesInDb: totalPublished,
      curatedKeywordsTotal: remainingKeywordCount,
      nextScheduledRun: 'Setiap hari pukul 08:00 WIB',
    };
  }
}
