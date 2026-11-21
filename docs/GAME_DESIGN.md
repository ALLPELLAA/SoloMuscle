# SoloMuscle — Oyun Tasarımı (Spec)

Bu belge oyun kurallarının **tek doğruluk kaynağıdır**. `src/game/` içindeki kod ve testler buradaki
formüllere birebir uymalıdır. Kod ile belge çelişirse önce belge güncellenir.

Kod tanımlayıcıları İngilizce, kullanıcı metinleri Türkçedir.

---

## 1. Statlar

| Anahtar | Etiket |
| --- | --- |
| `strength` | Güç |
| `endurance` | Dayanıklılık |
| `agility` | Çeviklik |
| `vitality` | Vitalite |
| `flexibility` | Esneklik |

Sıra her yerde yukarıdaki gibidir (`STAT_KEYS`). Stat değerleri tamsayıdır, üst sınır **999**.

## 2. Onboarding — başlangıç testi

Kullanıcı dört değer girer (`BaselineTest`):

| Alan | Anlam | Geçerli aralık |
| --- | --- | --- |
| `pushups` | Tek seferde max şınav | tamsayı, 0–1000 |
| `situps` | Tek seferde max mekik | tamsayı, 0–1000 |
| `squats` | Tek seferde max squat | tamsayı, 0–1000 |
| `plankSeconds` | Max plank süresi (sn) | tamsayı, 0–3600 |

Oyuncu adı: kırpılmış (trim) 1–20 karakter; boşsa `"Oyuncu"`.

### Başlangıç statları

Her stat `Math.round` ile yuvarlanır, sonra **[1, 50]** aralığına sıkıştırılır:

```
strength    = 5 + 0.3·pushups + 0.1·squats
endurance   = 5 + plankSeconds/10 + 0.15·situps
agility     = 5 + 0.15·squats + 0.1·situps
vitality    = 5 + 0.05·(pushups + situps + squats) + plankSeconds/30
flexibility = 5 + plankSeconds/30
```

Örnek: 15 şınav, 20 mekik, 25 squat, 45 sn plank →
Güç 12, Dayanıklılık 13, Çeviklik 11, Vitalite 10, Esneklik 7.

Başlangıç: level 1, xp 0, rank **E**, dağıtılmamış puan 0, tüm `statXp` = 0.

## 3. Level ve XP

```
xpToNextLevel(L) = Math.round(100 · L^1.5)
```

| L | Gereken XP |
| --- | --- |
| 1 | 100 |
| 2 | 283 |
| 3 | 520 |
| 4 | 800 |
| 5 | 1118 |
| 10 | 3162 |

- `xp` mevcut level içindeki ilerlemedir; `totalXp` toplam kazanılan XP'dir.
- XP eklenince: `xp ≥ xpToNextLevel(level)` olduğu sürece `xp -= gereken`, `level += 1`,
  `unspentPoints += 3`. Tek seferde birden çok level atlanabilir.
- Negatif / sonsuz / NaN XP eklenemez (hata).
- Level atlanınca UI animasyonlu "LEVEL UP" sistem penceresi gösterir, ardından stat puanı dağıtma
  ekranı açılır.

### Stat puanı dağıtma

- Her level için **3** puan.
- Dağıtım: stat başına negatif olmayan tamsayı; toplam ≥ 1 ve ≤ `unspentPoints`. Kısmi dağıtım
  serbesttir (kalan puan saklanır). Stat üst sınırı (999) aşılamaz.

## 4. Egzersizler ve XP

Her egzersizin birimi, birim başına XP'si ve stat ağırlıkları vardır (ağırlık toplamı 1).
"Birincil stat" = en yüksek ağırlıklı stat (eşitlikte `STAT_KEYS` sırası).

| id | Ad | Birim | XP/birim | Ağırlıklar |
| --- | --- | --- | --- | --- |
| `pushup` | Şınav | tekrar | 1.0 | Güç .7, Dayanıklılık .3 |
| `situp` | Mekik | tekrar | 0.8 | Dayanıklılık .6, Güç .4 |
| `squat` | Squat | tekrar | 0.8 | Güç .6, Çeviklik .4 |
| `plank` | Plank | saniye | 0.5 | Dayanıklılık .7, Vitalite .3 |
| `pullup` | Barfiks | tekrar | 3.0 | Güç .8, Dayanıklılık .2 |
| `lunge` | Lunge | tekrar | 0.8 | Güç .5, Çeviklik .5 |
| `burpee` | Burpee | tekrar | 2.0 | Çeviklik .5, Dayanıklılık .3, Güç .2 |
| `jumping_jack` | Jumping Jack | tekrar | 0.3 | Çeviklik .6, Vitalite .4 |
| `jump_rope` | İp Atlama | dakika | 6.0 | Çeviklik .7, Dayanıklılık .3 |
| `run` | Koşu | dakika | 8.0 | Dayanıklılık .5, Vitalite .5 |
| `walk` | Yürüyüş | dakika | 3.0 | Vitalite .8, Dayanıklılık .2 |
| `stretch` | Esneme | dakika | 4.0 | Esneklik 1.0 |
| `yoga` | Yoga | dakika | 5.0 | Esneklik .7, Vitalite .3 |

Miktar doğrulama: tamsayı; tekrar 1–1000, saniye 1–7200, dakika 1–600.

### Bir kayıt (set) işlendiğinde

```
baseXp      = amount · xpPerUnit
exerciseXp  = Math.round(baseXp)                 → level XP'sine eklenir
statShare_s = Math.round(baseXp · weight_s)      → ilgili statın statXp'sine eklenir
```

**Antrenmanla stat artışı:** `statXp[s] ≥ statXpToNextPoint(stats[s])` olduğu sürece
`statXp[s] -= gereken`, `stats[s] += 1` (999'da durur; fazla statXp tutulur).

```
statXpToNextPoint(v) = 20 + 5·v
```

**XP kilidi:** Ceza Görevi aktifse (bkz. §6) kayıt **hiç XP vermez** (ne level XP'si ne statXp).
Kilit, kaydın *işlenmeye başladığı andaki* duruma göre belirlenir.

## 5. Günlük görev

Her gün (yerel saat, 00:00 dönümü) bir günlük görev üretilir. Üretim deterministiktir:

```
seed = hash(`${createdDay}|${dayKey}|daily`)   (FNV-1a 32-bit)
rng  = mulberry32(seed)
```

**Hedefler (4 adet):** sabit üç çekirdek + bir "odak" hedefi.

1. `pushup`, `situp`, `squat` (bu sırayla)
2. Odak: oyuncunun **en düşük** statı (eşitlikte `STAT_KEYS` sırası) için havuzdan `rng` ile bir
   egzersiz: `floor(rng() · havuz.length)`.

| Zayıf stat | Odak havuzu |
| --- | --- |
| Güç | `lunge` |
| Dayanıklılık | `plank`, `run` |
| Çeviklik | `burpee`, `jump_rope`, `jumping_jack` |
| Vitalite | `walk`, `run` |
| Esneklik | `stretch`, `yoga` |

**Hedef miktarı (seviye, stat ve RPE'ye göre ölçeklenir):**

```
levelFactor = 1 + 0.08·(level − 1)
statFactor  = clamp(0.6 + S/25, 0.8, 3.0)        S = egzersizin birincil statının değeri
rpeFactor   = clamp(1 + (7 − R)·0.05, 0.8, 1.2)    R = egzersizin RPE ortalaması (§11); yoksa 1
raw         = base · levelFactor · statFactor · rpeFactor
```

Yuvarlama: tekrar → `raw ≥ 20` ise en yakın 5'in katı, değilse `Math.round`; saniye → en yakın 5'in
katı; dakika → `Math.round`. Sonuç `[1, max]` aralığına sıkıştırılır.

| Egzersiz | base | max |
| --- | --- | --- |
| pushup | 10 | 150 |
| situp | 10 | 150 |
| squat | 15 | 200 |
| lunge | 12 | 150 |
| plank | 30 sn | 600 |
| run | 10 dk | 60 |
| burpee | 8 | 100 |
| jump_rope | 3 dk | 30 |
| jumping_jack | 30 | 300 |
| walk | 15 dk | 90 |
| stretch | 5 dk | 30 |
| yoga | 10 dk | 45 |

**Ödül:** `rewardXp = 50 + 25·level` (görev üretildiği andaki level). Ödül yalnızca level XP'sine
eklenir. Görev tamamlandığı anda XP kilidi aktifse ödül **yanar** (`awardedXp = 0`).

İlerleme: kaydedilen her set, eşleşen hedefin `progress` değerine eklenir (hedefte sabitlenir).
Tüm hedefler `progress ≥ target` olunca görev `completed` olur.

Kimlik: `daily-<dayKey>`.

Her hedefin bir **sistem açıklaması** (`note`) vardır; hedef üretilirken yazılır ve sayının nereden
geldiğini gösterir (bkz. §12).

## 6. Gün dönümü ve Ceza Görevi

`rolloverDay(state, today)` uygulama açılışında, ön plana gelişte ve 00:00'da çağrılır.

- `today == lastRolloverDay`: günlük görev yoksa üretilir; başka değişiklik yok.
- `today < lastRolloverDay` (saat geri alınmış): **hiçbir şey değişmez** (istismar koruması).
- `today > lastRolloverDay`:
  1. Önceki günlük görev hâlâ `active` ise:
     - görevin günü **dinlenme/hasta günü** olarak işaretliyse (§13) → `excused` yapılır, kaçırılmış
       sayılmaz;
     - değilse `failed` yapılır. Bu görevin günü `createdDay` değilse (onboarding günü **tolerans
       günüdür**) → **kaçırıldı**.
  2. `diffDays(lastRolloverDay, today) ≥ 2` ise (arada uygulamanın hiç açılmadığı tam gün var)
     → **kaçırıldı**.
  3. Tamamlanmış/başarısız eski ceza görevi state'ten çıkarılır (arşivlenir).
  4. Kaçırıldıysa ve aktif ceza görevi yoksa → bugün için **Ceza Görevi** açılır. Zaten aktif ceza
     varsa yenisi eklenmez (birikmez), mevcut ceza devam eder.
  5. Önceki görev `failed` olduysa veya 2. madde gerçekleştiyse **seri sıfırlanır** (§13).
  6. Bugünün günlük görevi üretilir; `lastRolloverDay = today`.

**Ceza Görevi** (`penalty-<dayKey>`, başlık "CEZA GÖREVİ: Hayatta Kalma"):

| Egzersiz | base | max |
| --- | --- | --- |
| burpee | 20 | 150 |
| squat | 50 | 300 |
| plank | 120 sn | 900 |
| run | 15 dk | 90 |

Miktar = `base · levelFactor` (stat çarpanı yok), §5'teki yuvarlama kurallarıyla. `rewardXp = 0`.
Ceza görevi tamamlanana kadar **hiç XP kazanılmaz** ve rank sınavına girilemez. Ceza görevi gün
dönümünde kaybolmaz; tamamlanana kadar sürer.

## 7. Rank sınavı

Sıra: **E → D → C → B → A → S**. Bir sonraki rankın sınavı, minimum level'a ulaşınca açılır.
Sınav gerçek performans testidir: kullanıcı dört hareketi yapar ve sonuçları girer (plank için
uygulama içi kronometre). **Dört eşiğin hepsi** karşılanırsa geçilir.

| Hedef rank | Min level | Şınav | Mekik | Squat | Plank (sn) |
| --- | --- | --- | --- | --- | --- |
| D | 5 | 20 | 25 | 30 | 60 |
| C | 12 | 35 | 40 | 50 | 90 |
| B | 22 | 50 | 55 | 75 | 150 |
| A | 35 | 70 | 75 | 100 | 210 |
| S | 50 | 100 | 100 | 150 | 300 |

Girilebilirlik (sırayla kontrol edilir, ilk başarısız sebep döner):

1. `max_rank` — oyuncu zaten S.
2. `penalty` — aktif ceza görevi var.
3. `level` — level < min level.
4. `cooldown` — `rankExamCooldownUntil` dolu ve `today < rankExamCooldownUntil`.

Sonuç:

- **Geçti:** `rank = hedef`, ödül XP = `250 · hedefIndex` (D=1 … S=5) level XP'sine eklenir
  (level atlatabilir), cooldown temizlenir.
- **Kaldı:** `rankExamCooldownUntil = today + 1 gün` (ertesi gün tekrar denenebilir).

## 8. Bildirimler

Yerel, günlük hatırlatma (varsayılan **açık, 19:00**). Plan önümüzdeki **7 gün** için tek seferlik
tarih tetikleyicileriyle kurulur ve her açılışta / görev tamamlanınca yeniden hesaplanır:

- Saati geçmiş hatırlatma kurulmaz.
- Bugün dinlenme/hasta günü olarak işaretliyse bugünkü hatırlatma **hiç** kurulmaz.
- Bugünün günlük görevi tamamlandıysa ve ceza yoksa bugünkü hatırlatma atlanır.
- Bugün ceza aktifse bugünkü metin ceza uyarısıdır.

| Durum | Başlık | Metin |
| --- | --- | --- |
| Normal | `[SİSTEM] Günlük Görev` | `Günlük görevin seni bekliyor. Tamamlanmazsa Ceza Görevi açılacak.` |
| Ceza (bugün) | `[SİSTEM] CEZA GÖREVİ AKTİF` | `Ceza görevini tamamlamadan XP kazanamazsın.` |

## 9. Antrenman kaydı

- Antrenman = set listesi; her set `{ exerciseId, amount, rpe? }` (tekrar/saniye/dakika; RPE §11).
- Yeni set girilirken miktar ve RPE, o egzersizin **bir önceki setinden** otomatik doldurulur
  (önce bu antrenmandaki son set, yoksa veritabanındaki son kayıt).
- Dinlenme zamanlayıcısı: hazır süreler 30 / 60 / 90 / 120 / 180 sn; kalan süre zaman damgasından
  hesaplanır (`max(0, startedAt + duration − now)`), böylece uygulama arka plana gitse de doğru kalır.
- Antrenman bitirilince setler sırayla §4 kurallarıyla işlenir; her set için verilen XP kaydedilir.

## 10. Kişisel rekor ve Boss

Her egzersiz için **kişisel rekor** = tek bir sette ulaşılan en yüksek miktar
(`records[exerciseId] = { amount, dayKey, source, bonusDay }`).

- Onboarding testi şınav/mekik/squat/plank için başlangıç rekorlarını oluşturur (`source: 'baseline'`,
  değer > 0 ise).
- Bir set işlenirken (§4 sırasında, setin XP'sinden sonra):
  - Egzersizin rekoru yoksa: set ilk rekor olur (`source: 'set'`). **Boss sayılmaz**, bonus yok.
  - `amount > rekor` ise: rekor güncellenir ve **BOSS YENİLDİ**. Bonus XP:
    ```
    recordBonusXp(level) = 30 + 10·level        (level = o anki level)
    ```
    Bonus yalnızca level XP'sine eklenir. Aynı egzersiz için **günde en fazla bir** bonus verilir
    (`bonusDay`); aynı gün yeni rekorlar yine kaydedilir ve boss penceresi gösterilir, bonus 0'dır.
  - XP kilidi aktifse (ceza) rekor yine güncellenir ama bonus 0'dır ve `bonusDay` değişmez. Kilit,
    §4'teki gibi setin işlenmeye başladığı andaki duruma göre belirlenir.
- Rank sınavı sonuçları da dört hareketin rekorlarını günceller (`source: 'exam'`), boss/bonus yok.
- Her egzersizin boss adı sabittir (ör. Şınav → "Demir Golem").

## 11. RPE (zorluk) ve uyarlanabilir hedefler

- Her sete isteğe bağlı **RPE 1–10** (tamsayı) girilir: 1 = çok kolay, 10 = maksimum efor.
- Egzersiz başına RPE ortalaması üstel hareketli ortalama ile tutulur (2 ondalığa yuvarlanır):
  ```
  R_yeni = R yoksa rpe, varsa round2(0.7·R + 0.3·rpe)
  ```
  RPE güncellemesi XP kilidinden etkilenmez.
- Günlük görev üretilirken `rpeFactor` (§5) kullanılır: hedef bölge RPE 7. Kolay geliyorsa (R < 7)
  hedef artar, zor geliyorsa (R > 7) azalır; en fazla ±%20. Bugünün görevi değişmez; etki bir
  sonraki üretilen görevde görülür. Ceza görevine RPE uygulanmaz.

## 12. Hedef açıklamaları

Her görev hedefi üretilirken kısa bir açıklama (`note`) yazılır. Ondalık ayırıcı virgüldür.

- Günlük hedef: `Taban 10 · Lv 3 ×1,16 · Güç 14 ×1,16 · RPE 8,4 ×0,93 → 13`
  (RPE verisi yoksa RPE kısmı yazılmaz; üst sınıra takıldıysa sonuna ` (üst sınır)` eklenir).
- Odak hedefinde başa `Odak: en zayıf statın <Stat> (<değer>). ` eklenir.
- Ceza hedefi: `Ceza: taban 20 · Lv 3 ×1,16 → 25` (stat/RPE çarpanı yok).

## 13. Dinlenme / hasta günü ve seri

- Oyuncu **bugünü** dinlenme (`rest`) veya hasta (`sick`) günü olarak işaretleyebilir.
  Koşullar (sırayla): bugün zaten işaretli değil (`already_marked`), bugünün günlük görevi tamamlanmamış
  (`quest_completed`), son 7 günde (bugün dahil) en fazla **3** işaretli gün (`limit`).
- İşaret aynı gün içinde kaldırılabilir; geçmiş günler işaretlenemez/değiştirilemez.
- Etkisi: o günün görevi tamamlanmazsa gün dönümünde `excused` olur → **ceza görevi açılmaz** ve
  **seri bozulmaz**. Aktif bir ceza görevi varsa kaldırılmaz. O gün egzersiz yapılabilir, XP kurallar
  aynıdır. O günün hatırlatması kurulmaz.
- **Seri** (`streak = { current, best, lastCompletedDay }`): günlük görev tamamlandığında
  `current += 1`, `best = max(best, current)`. Dinlenme günleri seriyi ne artırır ne bozar.
  Gün dönümünde önceki görev `failed` ise veya uygulama tam bir gün hiç açılmadıysa `current = 0`.

## 14. İstatistikler

- **Aktivite ısı haritası:** son 20 hafta, haftalar Pazartesi başlar, sütun = hafta. Günün değeri =
  o günkü tüm setlerin ham XP'si (`Σ round(amount·xpPerUnit)`, XP kilidinden bağımsız). Seviye 0–4:
  değer 0 ise 0; aksi halde aralıktaki sıfırdan büyük değerlerin çeyrekliklerine göre
  (`≤ Q1` → 1, `≤ Q2` → 2, `≤ Q3` → 3, üstü → 4). Çeyreklik: sıralı dizide
  `q(p) = v[floor(p·(n−1))]`. Dinlenme günleri ve günlük görevin tamamlandığı günler ayrıca işaretlenir.
- **Stat grafikleri:** her gün son kaydedilen stat değerleri (`stat_snapshots`) ile çizgi grafik +
  güncel statlar için beşgen (radar) grafik.
- **Rekor listesi:** egzersiz sırasına göre güncel rekorlar, tarih ve kaynak.
