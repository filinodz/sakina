/**
 * Adhan recordings, streamed from the Internet Archive (archive.org).
 * They are NOT redistributed in this repository; each can be downloaded once
 * inside the app ("available offline") and is then stored in IndexedDB.
 * Mosques can also upload their own muezzin's recording.
 *
 * Every entry was checked against https://archive.org/metadata/<item> (file name + duration).
 */
export interface Athan {
  id: string;
  name: string;
  nameAr: string;
  origin: string;
  item: string;
  file: string;
  seconds: number;
  fajr?: boolean;
}

export const ATHANS: Athan[] = [
  { id: 'mishary-afasy', name: 'Mishary Rashid Alafasy', nameAr: 'مشاري راشد العفاسي', origin: 'Koweït', item: 'VeryBeautifulAdhaanByMisharyAlAfasy', file: 'Very Beautiful Adhaan by Mishary Al-Afasy.mp3', seconds: 258 },
  { id: 'mishary-short', name: 'Mishary Alafasy (court)', nameAr: 'مشاري العفاسي — قصير', origin: 'Koweït', item: 'AdhanMisharyRashid', file: 'Adhan Mishary Rashid.mp3', seconds: 178 },
  { id: 'mishary-fajr', name: 'Mishary Alafasy — Fajr', nameAr: 'مشاري العفاسي — الفجر', origin: 'Koweït', item: 'AdhanFajrAndDuaBySyeikhMisharyRashidAlAfasy', file: 'Adhan Fajr and dua by Syeikh Mishary Rashid Al Afasy.mp3', seconds: 210, fajr: true },
  { id: 'mishary-hijaz-fajr', name: 'Mishary Alafasy — Fajr (maqam Hijaz)', nameAr: 'العفاسي — الفجر مقام حجاز', origin: 'Koweït', item: 'adhan-call-to-prayer-mishary-rashid-alafasy-fajr-maqam-hijaz-hd-320-kbps-1', file: 'Adhan (Call to prayer) _ Mishary Rashid Alafasy _ Fajr _ Maqam Hijaz ᴴᴰ (320 kbps) (1).mp3', seconds: 224, fajr: true },
  { id: 'makkah-ali-mulla-fajr', name: 'Ali Ahmad Mulla — Fajr, La Mecque', nameAr: 'علي أحمد ملا — فجر الحرم المكي', origin: 'La Mecque', item: 'MakkahFajrAdhan6913SheikhAliMullah', file: 'Makkah Fajr Adhan 6-9-13 Sheikh Ali Mullah.mp3', seconds: 243, fajr: true },
  { id: 'makkah-ali-mulla', name: 'Ali Ahmad Mulla — La Mecque', nameAr: 'علي أحمد ملا — الحرم المكي', origin: 'La Mecque', item: 'athan__201409', file: 'athan_ali_mulla.25-9-2014mp3.mp3', seconds: 237 },
  { id: 'makkah-classic', name: 'Adhan de La Mecque', nameAr: 'أذان الحرم المكي', origin: 'La Mecque', item: '01AthanMakkah', file: '01 Athan (Makkah).mp3', seconds: 155 },
  { id: 'makkah-yunus-khoja', name: 'Yunus Khoja — Dhuhr, La Mecque', nameAr: 'يونس خوجة — الحرم المكي', origin: 'La Mecque', item: '4-9-13MakkahDuhurAdhanSheikhYunusKhoja', file: '4-9-13MakkahDuhurAdhanSheikhYunusKhoja.mp3', seconds: 193 },
  { id: 'makkah-esam-khan', name: 'Esam Ali Khan — La Mecque', nameAr: 'عصام علي خان — الحرم المكي', origin: 'La Mecque', item: '3913MakkahDuhurAdhanBySheikhEsamAliKhan', file: '3-9-13 Makkah Duhur Adhan by Sheikh Esam Ali Khan.mp3', seconds: 224 },
  { id: 'makkah-isha', name: 'Adhan al-Icha, La Mecque', nameAr: 'أذان العشاء — الحرم المكي', origin: 'La Mecque', item: 'AdhanAleshaaOfAlharamAlmakki8-12-1435', file: 'AdhanAleshaa8121435.mp3', seconds: 239 },
  { id: 'makkah-qathami', name: 'Nasser al-Qatami', nameAr: 'ناصر القطامي', origin: 'Arabie saoudite', item: 'AdhanSheikhNasserQathami', file: 'AdzanNaserAlqathami.mp3', seconds: 139 },
  { id: 'zahrani', name: 'az-Zahrani — maqam Hijaz', nameAr: 'الزهراني — مقام حجاز', origin: 'Arabie saoudite', item: 'AthanHijazZahrani', file: 'AzanZhrani.mp3', seconds: 201 },
  { id: 'dagriri', name: 'ad-Dagriri', nameAr: 'الدغريري', origin: 'Arabie saoudite', item: 'AthanAldagriri1991434', file: 'athan_aldagriri_19-9-1434.mp3', seconds: 137 },
  { id: 'madinah', name: 'Adhan de Médine', nameAr: 'أذان المسجد النبوي', origin: 'Médine', item: 'huzur-veren-ezan-most-beautiful-azan-in-madina', file: 'Huzur Veren Ezân (Most Beautiful Azan in Madina).mp3', seconds: 267 },
  { id: 'hadraawi', name: 'Farooq al-Hadrawi — Maghrib', nameAr: 'فاروق حضراوي — المغرب', origin: 'Médine', item: 'April202012-SheikhFarooqAlHadraawi-MaghribAdhan', file: 'April202012-SheikhHadraawi-MaghribAdhan.mp3', seconds: 235 },
  { id: 'egypt-harak', name: 'Abdelnasser Harak', nameAr: 'عبد الناصر حركة', origin: 'Égypte', item: 'adhan-from-egypt-abdulnasser-harak', file: 'Adhan from Egypt Abdulnasser Harak.mp3', seconds: 216 },
  { id: 'albani', name: 'Adhan — al-Albani', nameAr: 'أذان — الألباني', origin: '—', item: 'athan_al-albanee', file: '143-athan_al-albanee_vbr.mp3', seconds: 145 },
  { id: 'adlan', name: 'Adhan — Adlane', nameAr: 'أذان عدلان', origin: 'Maghreb', item: '20200117_20200117_0734', file: 'أذان_عدلان.mp3', seconds: 194 },
  { id: 'beautiful', name: 'Very Beautiful Adhan', nameAr: 'أذان خاشع', origin: '—', item: 'VeryBeautifulAzan', file: 'VeryBeautifulAzan.mp3', seconds: 164 },
  { id: 'classic', name: 'Adhan classique', nameAr: 'أذان', origin: '—', item: 'adhan_201605', file: 'adhan.mp3', seconds: 203 },
];

export const athanUrl = (a: Athan) => `https://archive.org/download/${encodeURIComponent(a.item)}/${encodeURIComponent(a.file)}`;
export const athanById = (id: string) => ATHANS.find((a) => a.id === id);
