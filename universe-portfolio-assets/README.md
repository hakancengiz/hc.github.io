# Hakan Cengiz — Pixel Portfolio

Statik HTML portfolyosu. Derleme veya bir tarayıcı çalışma zamanı kütüphanesi gerekmez.

Önizleme:

```sh
node universe-portfolio-assets/scripts/preview.mjs
```

Adres: http://127.0.0.1:4173/

**index.html ve universe-portfolio-assets klasörünü birlikte taşıyın/yayınlayın.** SVG sprite ve dış dosyalar için HTTP önizlemesini kullanın.

## Dosyalar

- `index.html`: sayfa içeriği, tema başlangıcı ve Google Analytics.
- `universe-portfolio-assets/css/site.css`: responsive tasarım ve animasyonlar.
- `universe-portfolio-assets/js/site.js`: menü, evrenler, filtreler, form ve tek kaydırma denetleyicisi.
- `universe-portfolio-assets/js/blog-data.js`: dört makalenin metaverileri ve yerel kapak yolları.
- `universe-portfolio-assets/universe-images/`: kullanılan bütün görsel dosyaları; WebP kapaklar/portreler, responsive sürümler, favicon ve SVG sprite.
- `universe-portfolio-assets/fonts/`: yerel WOFF fontları.
- `universe-portfolio-assets/scripts/`: önizleme, kaynak kontrolü, tarayıcı testi ve blog güncelleme araçları.

## Bu sürümde yapılanlar

Kopyalama butonu, penceresi ve panoyla ilgili bütün kodlar kaldırıldı. URL ile evren açılışı ve son seçimin hatırlanması korunur: `?world=pixel`, `?world=elf`, `?world=wizard`, `?world=cosmic`.

HTML yaklaşık 23,8 MB'tan 44,5 KB'a indi. Gömülü base64 görseller ve fontlar kaldırıldı. Kullanılan 12 ana raster görsel yaklaşık 17,1 MB'tan 1,3 MB'a indirildi. Küçük ekran sürümleriyle birlikte tüm görsel klasörü yaklaşık 1,8 MB; tarayıcı gereken boyutu seçer. İnaktif evrenlerin portreleri başlangıçta yüklenmez. Yalnızca seçilen evrenin About görseli yüklenir.

Kaydırma göstergesi, aktif menü ve masaüstü paralaksı aynı requestAnimationFrame denetleyicisini kullanır. Mobilde paralaks ve sürekli arka plan hareketleri kapalıdır; dekor sayısı azaltılmıştır. Hafif giriş, evren geçişi ve dokunma tepkileri korunur. Görünmeyen sekmede hareketler durur. Hareket azaltma tercihi ve Motion kontrolü çalışır. Mobil inputlar 16 px kullanır.

Açılışta menüde bölüm seçili değildir. En üste dönünce seçim temizlenir. Tema geçişinde form içeriği korunur. Buton/input kenarlıkları kaldırılmıştır; klavye odağı renk ve metin vurgusuyla görünür kalır.

Google Analytics kimliği: **G-7Y59QC84L5**. Verilen gtag kodu sayfanın head alanına bir kez ve async olarak eklenmiştir. Yayın yapılmadı.

## Blog kapaklarını güncelleme

Bütün kapakların yerel kalması için yeni makalelerin görselleri yayın öncesinde indirilir:

```sh
npm --prefix universe-portfolio-assets install
npm --prefix universe-portfolio-assets run refresh:blog
npm --prefix universe-portfolio-assets run check
```

Güncelleme aracı Medium RSS verisindeki son dört makaleyi alır, gerçek kapakları WebP'ye çevirip `universe-portfolio-assets/universe-images/` içine kaydeder; sayfadaki makaleleri ve `blog-data.js` dosyasını günceller. Eski blog kapaklarını temizler. Sharp yalnızca bu geliştirme komutunda kullanılır; siteye gönderilmez.

Tarayıcıdaki RSS kontrolü zaten önbelleğe alınmış makaleleri güncelleyebilir. Henüz yerel kapağı bulunmayan yeni bir makale varsa mevcut dört görselli kartı korur ve blog sayfasında yeni yazılar olduğunu bildirir. Tarayıcı uzak görselleri yerel dosya gibi göstermeye çalışmaz.

## Kontroller

```sh
npm --prefix universe-portfolio-assets run check
npm --prefix universe-portfolio-assets run test:browser
```

Tarayıcı testi için Chrome/Edge gerekir. Gerekirse `CHROME_PATH` ortam değişkeniyle çalıştırılacak tarayıcıyı belirtin. Test çıktıları geçici dizindeki `hcengiz-qa` klasörüne yazılır; web projesine eklenmez.

320 ve 390 px mobil görünüm 4 kat CPU yavaşlatmayla; 1440 px masaüstü görünüm Chrome'da kontrol edildi. Yatay taşma, konsol/JavaScript hatası veya yerel 404 isteği görülmedi. Evren geçişleri, tercih kaydı, URL önceliği, formun korunması, kategori filtreleri, menü seçimi, fontlar ve başlangıçta gereksiz portre yüklenmemesi doğrulandı. Boşta sürekli JavaScript kare döngüsü bulunmadı.

Yerel kaynakların ilk aktarımı testte mobilde yaklaşık 316 KB, masaüstünde 340 KB oldu. Bu ölçüm Analytics/RSS uzak servislerinin aktarımını içermez. Fiziksel telefonda FPS ölçümü yapılmadı.

## Temizlik arşivi

Kullanılmayan eski HTML yedekleri, research üretim dosyaları ve yerini WebP sürümlerine bırakan PNG'ler artık proje klasöründe değildir. Otomatik onay denetimi toplu kalıcı silmeyi reddettiği için, bağımlılık kontrolünden sonra proje dışındaki geri alınabilir arşive taşındılar:

`C:/Users/PC/.codex/visualizations/2026/11/06/01a1b130-7bf9-7713-a7f5-cb7e8aadc05e/portfolio-unused-20261107`

Güncel HTML, CSS, JavaScript, önizleme ve kontrol komutlarının bu arşive hiçbir bağımlılığı yoktur.

## Taşınabilir teslim

Proje kökünde yalnızca `index.html` ve `universe-portfolio-assets/` vardır. Görseller, fontlar, SVG sprite, CSS, JavaScript, dokümantasyon ve geliştirme araçlarının tamamı bu klasördedir. Siteyi yayınlamak için bu iki öğeyi aynı dizine kopyalamak yeterlidir; geliştirme araçları çalışma zamanı için gerekli değildir. Kontroller bu iki öğenin bağımsız geçici kopyası üzerinde de çalıştırılır.
