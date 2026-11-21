# SoloMuscle — CLAUDE.md

## Amaç

SoloMuscle, gerçek egzersizleri bir RPG "sistem" arayüzüyle oyunlaştıran, **tamamen internetsiz**
çalışan, Android öncelikli bir fitness uygulamasıdır. Kullanıcı bir "oyuncu"dur: başlangıç testiyle
statlarını belirler, egzersiz kaydettikçe XP kazanıp level atlar, günlük görevleri tamamlar, görevi
kaçırırsa Ceza Görevi'ne düşer ve rank sınavlarıyla E'den S'ye yükselir.

- Arayüz dili: **Türkçe** (tüm kullanıcıya görünen metinler).
- Tema: koyu arka plan + mavi neon "sistem penceresi" panelleri. Ceza durumları kırmızı neon.
- Ağ yok: hiçbir özellik sunucuya, API'ye veya uzaktan fonta bağımlı olamaz.
- Oyun kuralları ve formüllerin tek doğruluk kaynağı: [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md).

## Stack

| Katman | Seçim |
| --- | --- |
| Çatı | Expo SDK 58 (React Native 0.88, React 19.3, New Architecture) |
| Dil | TypeScript (strict) |
| Navigasyon | Expo Router (`src/app/`), JS Tabs (`expo-router/js-tabs`) + Stack |
| Veri | `expo-sqlite` (SQLiteProvider + `PRAGMA user_version` migrasyonları) |
| Bildirim | `expo-notifications` (yalnızca **yerel** bildirim; push yok) |
| Animasyon | `react-native-reanimated` 4 |
| Diğer | `expo-haptics`, `@expo/vector-icons` (Ionicons) |
| Test | Jest + `jest-expo` (oyun mantığı için unit test) |

Expo Go uyumluluğu korunmalı: Expo Go'da olmayan native modül **eklenmez**.

## Klasör yapısı

```
├── CLAUDE.md
├── docs/GAME_DESIGN.md          # Oyun kuralları, formüller, eşikler (spec)
├── app.json / eas.json          # Expo + EAS yapılandırması
├── assets/                      # İkon, splash
└── src/
    ├── app/                     # SADECE route dosyaları (Expo Router)
    │   ├── _layout.tsx          #   Kök Stack + provider'lar
    │   ├── index.tsx            #   Yönlendirme (onboarding / sekmeler)
    │   ├── onboarding.tsx
    │   ├── (tabs)/              #   Durum, Görevler, Antrenman, Rank
    │   ├── level-up.tsx         #   Animasyonlu LEVEL UP modalı
    │   ├── allocate.tsx         #   Stat puanı dağıtma
    │   ├── rank-exam.tsx
    │   └── settings.tsx
    ├── game/                    # SAF TypeScript oyun mantığı (+ *.test.ts)
    ├── db/                      # expo-sqlite şema, migrasyon, repository
    ├── notifications/           # expo-notifications servis katmanı
    ├── state/                   # GameProvider + useGame hook (mantık ↔ DB ↔ UI köprüsü)
    ├── components/              # Yeniden kullanılan UI (system-window, stat-bar, ...)
    ├── screens/                 # Route'ların render ettiği ekran gövdeleri
    ├── hooks/                   # Paylaşılan hook'lar (zamanlayıcı vb.)
    └── theme.ts                 # Renkler, boşluklar, tipografi, glow
```

## Mimari kurallar

1. **`src/game/` saftır.** `react`, `react-native`, `expo-*` veya `src/db`, `src/state` import
   edemez. Yan etkisiz, deterministik fonksiyonlar: zaman (`now`, `DayKey`) ve rastgelelik
   (seed) **parametre** olarak gelir; `Date.now()` / `Math.random()` çağrılmaz.
2. Oyun durumu değiştiren her işlem `src/game` içindeki bir fonksiyonla hesaplanır; `src/state`
   sonucu DB'ye yazar, UI sadece `useGame()` üzerinden okur/aksiyon çağırır. UI'da formül yok.
3. `src/db/` SQL ve satır↔nesne dönüşümünü yapar; oyun kuralı içermez. Şema değişikliği = yeni
   migrasyon (mevcut migrasyonlar düzenlenmez).
4. `src/app/` dosyaları ince tutulur; ekran gövdesi büyükse `src/screens/<ekran>/` altına konur.
5. Günler **yerel saatle** `DayKey` (`YYYY-MM-DD`) olarak temsil edilir; gün dönümü 00:00'dır.
6. Bileşen dosyaları kebab-case, tek named export; stiller dosya sonunda `StyleSheet.create`.
7. Renk/boşluk/yazı tipi değerleri `src/theme.ts`'ten gelir; ekranlarda sabit hex kullanılmaz.
8. Kullanıcı girdisi (tekrar, süre) oyun mantığına girmeden önce doğrulanır (`src/game` içindeki
   validator'larla); geçersiz değer state'e yazılmaz.

## Komutlar

```bash
npm start                 # Expo dev server (Expo Go ile QR okut)
npm test                  # Jest unit testleri (src/**/*.test.ts)
npm run typecheck         # tsc --noEmit
npm run lint              # expo lint
npx expo export -p android   # Android bundle derleme kontrolü
```

Paket eklerken sürümü SDK'ya uygun seç: `node -e "console.log(require('expo/bundledNativeModules.json')['<paket>'])"`
(bu ortamda `npx expo install` ağ kısıtı nedeniyle çalışmayabilir).

## Tamamlanma kriteri

Bir iş "bitti" sayılmadan önce: `npm test`, `npm run typecheck`, `npm run lint` temiz olmalı ve
oyun mantığına dokunan her değişiklik test ile kapsanmalı. `docs/GAME_DESIGN.md` ile kod çelişirse
önce spec güncellenir, sonra kod.

## Git

- Geliştirme `mvp` branch'inde yapılır; `main`'e doğrudan commit atılmaz.
- `ios/` ve `android/` klasörleri üretilir (CNG) — elle oluşturulmaz, commit edilmez.
