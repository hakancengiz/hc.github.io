# Tam İsabet

Milisaniye hassasiyetinde doğru anı yakalamaya dayanan, mobil öncelikli bir refleks oyunudur. Backend, harici API veya derleme adımı kullanmaz.

## Tam sürüm özellikleri

- `performance.now()` ve `requestAnimationFrame()` tabanlı, kare hızından bağımsız zamanlama motoru
- 30 tur türü: halkalar, çizgiler, hedefte durdur, çarpışma, sıfır, merkez, renk, gizli hareket, sahte duruş, hız değişimi, ritim, yasak an, orbital hizalama, nabız zirvesi, ışık kapısı, denge anı, sarmal merkez ve üçlü senkron, saat ibresi, sarkaç merkezi, tutulma anı, tarayıcı çizgisi, odak açıklığı, bloğu oturt, dalga buluşması, açı eşleşmesi, tünel hizası, tepe noktası, eşit seviye ve yıldız yolu
- Her turda yön, hız, şekil, gizlenme ve yanıltma varyasyonları
- Son dört turu hatırlayan torba tabanlı tekrar önleme sistemi
- Klasik, İsabet Serisi, 60 Saniye ve tarih seed’li Günlük İsabet modları
- Üç enerjili klasik akış, seri çarpanları ve dinamik zorluk
- Uygulamalı üç turluk eğitim
- Erken/geç milisaniye geri bildirimi
- Görsel, sesli ve desteklenen cihazlarda haptik ritim geri bildirimi
- Günlük görevler ve yedi başarım
- Gelişmiş istatistikler ve modlara özel rekorlar
- Üç renk teması ve üç kozmetik hedef tasarımı
- Görsel paylaşım kartı ve metin paylaşımı
- Ses, titreşim, yüksek kontrast ve azaltılmış hareket seçenekleri
- Otomatik duraklatma, dikey ekran uyarısı ve iPhone güvenli alan desteği
- LocalStorage kalıcılığı, kurulabilir PWA ve çevrimdışı çalışma

## Yerelde çalıştırma

Oyunu hemen denemek için `index.html` dosyasını çift tıklayarak açabilirsiniz. PWA kurulumu ve çevrimdışı önbelleği test etmek için:

```bash
node tools/server.mjs 8080
```

Ardından `http://localhost:8080` adresini açın.

## GitHub Pages ile `/TamIsabet/` altında yayınlama

Manifest, `https://<kullanıcı>.github.io/TamIsabet/` adresi için hazırlanmıştır:

- `start_url`: `/TamIsabet/`
- `scope`: `/TamIsabet/`
- Service Worker kaydı: `./service-worker.js`
- Uygulama kaynakları ve ikonlar: göreli yollar

Yayınlamak için:

1. Dosyaları `TamIsabet` adlı GitHub deposunun köküne gönderin.
2. **Settings → Pages** bölümünü açın.
3. Kaynak olarak **Deploy from a branch** seçin.
4. Varsayılan dalı ve `/ (root)` klasörünü seçip kaydedin.
5. `https://<kullanıcı>.github.io/TamIsabet/` adresini açın.

Depo adı veya yayın yolu farklı olacaksa `manifest.webmanifest` içindeki `start_url` ve `scope` değerleri de aynı yola göre değiştirilmelidir. Proje başka bir deponun `TamIsabet` klasöründe yayınlanacaksa adres `/<depo-adı>/TamIsabet/` olur; bu durumda iki manifest alanı da bu tam yolu kullanmalıdır.

## Test

```bash
node tests/game.test.cjs
```

Test; 30 turun açılmasını, kısa aralıklı tekrar korumasını, günlük seed’in deterministik olmasını ve bir turun yalnızca bir kez enerji tüketmesini doğrular.