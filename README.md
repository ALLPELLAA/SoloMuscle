# SoloMuscle

RPG "sistem" arayüzlü, **tamamen internetsiz** çalışan Android odaklı fitness uygulaması
(Expo SDK 58 + React Native + TypeScript).

- **Onboarding:** başlangıç testi (max şınav, mekik, squat, plank) → başlangıç statları, **E rank**.
- **Statlar:** Güç, Dayanıklılık, Çeviklik, Vitalite, Esneklik. Her egzersiz kaydı ilgili statlara XP verir.
- **Level:** gereken XP = `100 · level^1.5`. Level atlayınca animasyonlu sistem penceresi + 3 stat puanı dağıtma.
- **Günlük görev:** seviye ve statlara göre ölçeklenir, 00:00'da yenilenir. Kaçırılırsa ertesi gün
  **Ceza Görevi** açılır; bitene kadar XP kazanılmaz.
- **Rank sınavı (E→D→C→B→A→S):** belirli level'da açılır, gerçek performans eşikleriyle geçilir.
- **Antrenman kaydı:** set / tekrar / süre girişi, dinlenme zamanlayıcısı; bir önceki setin değerleri
  otomatik dolar, her sete **RPE 1–10** zorluk girilir.
- **Kişisel rekor = Boss:** bir hareketin rekorunu geçince "BOSS YENİLDİ" penceresi + bonus XP
  (`30 + 10·level`, hareket başına günde bir kez).
- **Uyarlanabilir hedefler:** RPE ortalamasına göre bir sonraki günlük hedef ±%20'ye kadar ayarlanır;
  her hedefin altında sayının nereden geldiğini anlatan kısa bir sistem notu vardır.
- **Dinlenme / hasta günü:** o gün tamamlanmayan görev ceza açmaz ve seri bozulmaz (son 7 günde en fazla 3).
- **İstatistik:** GitHub tarzı aktivite ısı haritası, stat beşgeni + stat geçmişi grafikleri, rekor listesi.
- **Veri:** `expo-sqlite` (cihazda). **Bildirim:** `expo-notifications` ile günlük yerel hatırlatma.

Oyun kuralları ve tüm formüller: [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md) ·
Mimari ve geliştirme kuralları: [`CLAUDE.md`](CLAUDE.md)

## Kurulum

Gereksinim: Node.js 20+ (LTS) ve git.

```bash
git clone <repo-url> SoloMuscle
cd SoloMuscle
git checkout mvp
npm install
```

## Telefonda test etme

### Yol 1 — Expo Go (en hızlı, derleme gerekmez)

1. Android telefona Play Store'dan **Expo Go** uygulamasını kur (SDK 58'i destekleyen güncel sürüm).
2. Bilgisayarda proje klasöründe:
   ```bash
   npm start
   ```
3. Telefon ve bilgisayar **aynı Wi-Fi ağında** olmalı. Terminalde çıkan QR kodu Expo Go içindeki
   "Scan QR code" ile okut. Uygulama telefonda açılır; kodu değiştirdikçe anında yenilenir.
4. Aynı ağda değilseniz / bağlanamıyorsa: `npx expo start --tunnel` (ilk seferde ngrok kurmayı önerir).

Notlar:
- Uygulamanın kendisi internet kullanmaz; Expo Go yalnızca geliştirme sırasında JS kodunu
  bilgisayardan indirmek için ağa ihtiyaç duyar.
- Günlük hatırlatma **yerel bildirimdir**; Expo Go'da çalışır (push bildirimi kullanılmıyor).
  İlk açılışta bildirim izni istenir; Ayarlar ekranından saat değiştirilebilir.
- **Ceza görevini beklemeden test etmek için:** Durum → ⚙ Ayarlar → *Geliştirici araçları* →
  "2 Gün Atla". Bu araç yalnızca geliştirme modunda (Expo Go) görünür, APK'da yoktur.

### Yol 2 — EAS Build ile APK (bağımsız kurulum dosyası)

APK, Expo Go olmadan telefona kurulan gerçek uygulamadır; tamamen çevrimdışı çalışır.

1. Ücretsiz bir Expo hesabı aç: <https://expo.dev/signup>
2. EAS CLI ile giriş yap ve projeyi bağla:
   ```bash
   npx eas-cli@latest login
   npx eas-cli@latest init          # app.json'a projectId ekler
   ```
3. APK derlemesini başlat (bulutta derlenir, Android Studio gerekmez):
   ```bash
   npx eas-cli@latest build -p android --profile preview
   ```
   `preview` profili `eas.json` içinde `buildType: "apk"` olarak tanımlıdır.
4. Derleme bitince terminalde ve expo.dev panelinde bir **indirme linki / QR kod** çıkar.
   Telefonda linki aç, APK'yı indir ve kur ("Bilinmeyen kaynaklardan yüklemeye izin ver" gerekebilir).

Play Store için: `npx eas-cli@latest build -p android --profile production` (AAB üretir).

> Alternatif (yerel derleme): Android Studio + SDK kuruluysa `npx expo run:android` ile
> USB'ye bağlı telefona doğrudan kurabilirsin.

## Geliştirme komutları

```bash
npm start              # Expo dev server
npm test               # Jest unit testleri (oyun mantığı)
npm run typecheck      # TypeScript kontrolü
npm run lint           # ESLint (src/game saflık kuralları dahil)
npx expo export -p android   # Android bundle derleme kontrolü
```

## Proje yapısı (özet)

```
src/
├── app/            # Expo Router route'ları (onboarding, 5 sekme, level-up, boss, allocate, rank-exam, settings)
├── game/           # SAF TypeScript oyun mantığı + unit testler (XP, statlar, görev üretici, rank, gün dönümü)
├── db/             # expo-sqlite şema, migrasyon, repository
├── notifications/  # yerel hatırlatma servisi
├── state/          # GameProvider + useGame (mantık ↔ DB ↔ UI)
├── components/     # neon "sistem penceresi" UI kiti
└── screens/        # ekran gövdeleri
```
