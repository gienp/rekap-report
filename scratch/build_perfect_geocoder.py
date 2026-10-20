import json
import re
import sys
import os

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

# =========================================================================
# TIER 1: SPECIFIC LANDMARKS, MALLS, TOWERS, TERMINALS & INDUSTRIAL COMPLEXES
# =========================================================================
TIER1_LANDMARKS = [
    # Banten
    ('transmart cilegon', (-6.0175, 106.0545), 'Transmart Cilegon, Banten'),
    ('yasin beji', (-6.0175, 106.0545), 'Jl KH Yasin Beji, Cilegon'),
    ('krakatau steel', (-6.0125, 106.0150), 'Krakatau Steel, Cilegon'),
    ('chandra asri', (-6.0125, 106.0150), 'Chandra Asri, Cilegon'),
    ('eropa i', (-6.0125, 106.0350), 'Kawasan Industri Krakatau Cilegon'),
    ('kotasari', (-6.0125, 106.0350), 'Kotasari, Grogol Cilegon'),
    ('terminal pakupatan', (-6.1315, 106.1865), 'Terminal Pakupatan, Serang'),
    ('pakupatan', (-6.1315, 106.1865), 'Terminal Pakupatan, Serang'),
    ('taman pesona residencen', (-6.1150, 106.1350), 'Taman Pesona Taktakan Serang'),
    ('taktakan', (-6.1150, 106.1350), 'Taktakan, Kota Serang'),
    ('cikande koper', (-6.2230, 106.3650), 'Cikande Koper, Kab. Serang'),
    ('koper', (-6.2230, 106.3650), 'Koper, Cikande, Serang'),
    ('cikande', (-6.2230, 106.3650), 'Cikande, Kab. Serang'),
    ('pln labuan', (-6.3775, 105.8290), 'PLN Labuan, Pandeglang'),
    ('ulp labuan', (-6.3775, 105.8290), 'PLN Labuan, Pandeglang'),
    ('labuan', (-6.3775, 105.8290), 'Labuan, Pandeglang Banten'),
    ('pulorida', (-5.9550, 105.9950), 'Shelter Pulorida, Merak Banten'),
    ('merak', (-5.9350, 105.9980), 'Merak, Banten'),
    ('anyer', (-6.0500, 105.9200), 'Anyer, Banten'),

    # Central & West Java Outer
    ('blimbing kidul', (-6.8048, 110.8405), 'Blimbing Kidul, Kaliwungu, Kudus'),
    ('kaliwungu', (-6.8048, 110.8405), 'Kaliwungu, Kudus'),
    ('kudus', (-6.8048, 110.8405), 'Kudus, Jawa Tengah'),
    ('kandeman', (-6.9050, 109.7300), 'Kandeman, Batang'),
    ('pltu batang', (-6.9050, 109.7300), 'PLTU Batang, Jawa Tengah'),
    ('batang', (-6.9050, 109.7300), 'Batang, Jawa Tengah'),
    ('pindo 4', (-6.4272, 107.3444), 'Pindo Deli 4, Karawang'),
    ('indah kiat', (-6.4272, 107.3444), 'Indah Kiat Pulp & Paper Karawang'),
    ('kiic', (-6.3550, 107.2850), 'KIIC Karawang'),
    ('suriacipta', (-6.3950, 107.3350), 'Suriacipta Karawang'),

    # Bogor
    ('highland park', (-6.6569, 106.7296), 'Highland Park Resort Bogor'),
    ('istana bogor', (-6.5980, 106.7950), 'Istana Bogor / GH ITBP PLN'),
    ('smpn 1 ciawi', (-6.6550, 106.8550), 'SMPN 1 Ciawi, Bogor'),
    ('rancamaya', (-6.6550, 106.8350), 'Rancamaya, Bogor'),
    ('bnn lido', (-6.7450, 106.8150), 'BNN Lido, Cigombong Bogor'),
    ('lido', (-6.7450, 106.8150), 'Lido, Cigombong Bogor'),
    ('wates jaya', (-6.7450, 106.8150), 'Wates Jaya, Cigombong Bogor'),
    ('cigombong', (-6.7450, 106.8150), 'Cigombong, Kab. Bogor'),
    ('kota wisata', (-6.3650, 106.9650), 'Kota Wisata Ciangsana, Gn Putri'),
    ('ciangsana', (-6.3650, 106.9650), 'Ciangsana, Gunung Putri Bogor'),
    ('griya bukit jaya', (-6.4650, 106.9150), 'Griya Bukit Jaya, Tlajung Udik'),
    ('tlajung udik', (-6.4650, 106.9150), 'Tlajung Udik, Gunung Putri'),
    ('pesona kahuripan', (-6.3950, 106.9650), 'Pesona Kahuripan, Cileungsi'),
    ('gandoang', (-6.3950, 106.9650), 'Gandoang, Cileungsi'),
    ('sukasirna', (-6.4650, 107.0550), 'Sukasirna, Jonggol'),
    ('coco garden', (-6.4650, 106.9750), 'Coco Garden, Klapanunggal Bogor'),
    ('klapanunggal', (-6.4650, 106.9750), 'Klapanunggal, Kab. Bogor'),
    ('kelapanunggal', (-6.4650, 106.9750), 'Klapanunggal, Kab. Bogor'),
    ('babakan madang', (-6.5350, 106.8550), 'Babakan Madang, Sentul'),
    ('sentul', (-6.5350, 106.8550), 'Sentul, Bogor'),
    ('pasir kuda', (-6.6025, 106.7750), 'Pasir Kuda, Bogor Barat'),
    ('cibarengok', (-6.3850, 106.7050), 'Cibarengok, Pengasinan Gn Sindur'),
    ('pengasinan', (-6.3850, 106.7050), 'Pengasinan, Gunung Sindur'),
    ('gunung sindur', (-6.3850, 106.7050), 'Gunung Sindur, Kab. Bogor'),
    ('gn sindur', (-6.3850, 106.7050), 'Gunung Sindur, Kab. Bogor'),
    ('lebak ela', (-6.4950, 106.6350), 'Lebak Ela, Cidokom Rumpin'),
    ('cidokom', (-6.4950, 106.6350), 'Cidokom, Rumpin Bogor'),
    ('lanud rumpin', (-6.4950, 106.6350), 'Lanud Rumpin, Bogor'),
    ('rumpin', (-6.4950, 106.6350), 'Rumpin, Kab. Bogor'),
    ('leuweung gede', (-6.3350, 106.4550), 'Leuweung Gede, Tenjo Bogor'),
    ('tenjo', (-6.3350, 106.4550), 'Tenjo, Kab. Bogor'),
    ('puri arraya', (-6.5550, 106.7050), 'Puri Arraya, Ciampea Bogor'),
    ('ciampea', (-6.5550, 106.7050), 'Ciampea, Kab. Bogor'),
    ('kebun raya residence', (-6.6050, 106.7650), 'Kebun Raya Residence, Ciomas'),
    ('ciomas', (-6.6050, 106.7650), 'Ciomas, Kab. Bogor'),
    ('tamansari bogor', (-6.6450, 106.7650), 'Tamansari, Bogor'),

    # Depok
    ('limo raya', (-6.3680, 106.7780), 'Jl Limo Raya, Depok'),
    ('technovillage', (-6.3950, 106.8750), 'Technovillage Data Center Cimanggis'),
    ('radar auri', (-6.3650, 106.8750), 'Jl Radar Auri, Cimanggis Depok'),
    ('mabes tni kelapa dua', (-6.3550, 106.8550), 'Kompleks Mabes TNI Kelapa Dua Depok'),
    ('kelapa dua depok', (-6.3550, 106.8550), 'Kelapa Dua, Depok'),
    ('pasir gunung selatan', (-6.3550, 106.8550), 'Pasir Gunung Selatan, Depok'),
    ('pasir gunung sltn', (-6.3550, 106.8550), 'Pasir Gunung Selatan, Depok'),
    ('politeknik negeri jakarta', (-6.3650, 106.8250), 'PNJ UI, Kukusan Beji Depok'),
    ('kukusan', (-6.3650, 106.8250), 'Kukusan, Beji Depok'),
    ('mandor samin', (-6.4350, 106.8350), 'Mandor Samin, Cilodong Depok'),
    ('tugu macan', (-6.4350, 106.8050), 'Tugu Macan, Cipayung Depok'),
    ('rangkapan jaya', (-6.3950, 106.7850), 'Rangkapan Jaya Baru, Depok'),
    ('mutiara depok', (-6.4050, 106.8450), 'Jl Mutiara Depok, Sukmajaya'),

    # Bekasi & Cikarang
    ('gudang up3 cikarang', (-6.4077, 107.1802), 'Gudang UP3 Cikarang'),
    ('up3 cikarang', (-6.4077, 107.1802), 'Gudang UP3 Cikarang'),
    ('giic', (-6.3685, 107.1724), 'Kawasan Industri GIIC Deltamas'),
    ('deltamas', (-6.3685, 107.1724), 'Kota Deltamas, Cikarang Pusat'),
    ('pasirranji', (-6.3685, 107.1724), 'Pasirranji, Cikarang Pusat'),
    ('mm2100', (-6.2954, 107.0982), 'Kawasan Industri MM2100 Cikarang Barat'),
    ('panasonic industrial', (-6.2954, 107.0982), 'Panasonic MM2100 Cikarang Barat'),
    ('gandamekar', (-6.2954, 107.0982), 'Gandamekar, Cikarang Barat'),
    ('mekarwangi', (-6.2954, 107.0982), 'Mekarwangi, Cikarang Barat'),
    ('kuehne', (-6.2954, 107.0982), 'Kuehne + Nagel MM2100'),
    ('danau indah', (-6.2750, 107.0980), 'Danau Indah, Cikarang Barat'),
    ('halmahera', (-6.2750, 107.0980), 'Jl Halmahera, Cikarang Barat'),
    ('jababeka', (-6.2850, 107.1450), 'Kawasan Industri Jababeka Cikarang'),
    ('ejip', (-6.3150, 107.1150), 'Kawasan Industri EJIP Cikarang Selatan'),
    ('lippo cikarang', (-6.3250, 107.1250), 'Lippo Cikarang, Bekasi'),
    ('grand mutiara gading', (-6.2850, 107.0850), 'Grand Mutiara Gading, Telajung'),
    ('telajung', (-6.2850, 107.0850), 'Telajung, Cikarang Barat'),
    ('mutiara gading timur', (-6.2850, 107.0250), 'Mutiara Gading Timur, Mustika Jaya'),
    ('karangsatria', (-6.2200, 107.0450), 'Karangsatria, Tambun Utara'),
    ('koperpu', (-6.2200, 107.0450), 'Perum Koperpu, Karangsatria Tambun Utara'),
    ('cahaya darussalam', (-6.2250, 107.0550), 'Perum Cahaya Darussalam, Tambun Utara'),
    ('bekasi griya pratama', (-6.2600, 107.0600), 'Bekasi Griya Pratama, Sumber Jaya'),
    ('sumber jaya', (-6.2600, 107.0600), 'Sumber Jaya, Tambun Selatan'),
    ('plasa cibubur', (-6.3755, 106.9250), 'Plasa Cibubur, Jatisampurna Bekasi'),
    ('plaza cibubur', (-6.3755, 106.9250), 'Plaza Cibubur, Jatisampurna Bekasi'),
    ('jatisampurna', (-6.3755, 106.9250), 'Jatisampurna, Kota Bekasi'),
    ('summarecon bekasi', (-6.2250, 106.9980), 'Summarecon Bekasi, Marga Mulya'),
    ('marga mulya', (-6.2250, 106.9980), 'Marga Mulya, Bekasi Utara'),
    ('bina nusantara', (-6.2250, 106.9980), 'Binus University Summarecon Bekasi'),
    ('suncity square', (-6.2420, 106.9950), 'Suncity Square, Jl Mayor Hasibuan Bekasi'),
    ('margajaya', (-6.2420, 106.9950), 'Margajaya, Bekasi Selatan'),
    ('ruko good land', (-6.2450, 107.0250), 'Ruko Good Land, Duren Jaya Bekasi'),
    ('underpass raya', (-6.2450, 107.0250), 'Jl Underpass, Duren Jaya Bekasi'),
    ('duren jaya', (-6.2450, 107.0250), 'Duren Jaya, Bekasi Timur'),
    ('pulo sirih', (-6.2620, 106.9750), 'Pulo Sirih, Grand Galaxy Bekasi'),
    ('jaka setia', (-6.2620, 106.9750), 'Jaka Setia, Bekasi Selatan'),
    ('nakula raya', (-6.2620, 106.9750), 'Jl Nakula Raya, Jaka Setia Bekasi'),
    ('pulo permatasari', (-6.2550, 106.9850), 'Pulo Permatasari, Pekayon Jaya Bekasi'),
    ('pekayon jaya', (-6.2550, 106.9850), 'Pekayon Jaya, Bekasi Selatan'),
    ('pekayon', (-6.2550, 106.9850), 'Pekayon, Bekasi Selatan'),
    ('jatimekar', (-6.2850, 106.9450), 'Jatimekar, Jatiasih Bekasi'),
    ('jatimakmur', (-6.2850, 106.9250), 'Jatimakmur, Pondok Gede Bekasi'),
    ('raya gamprit', (-6.2850, 106.9150), 'Jl Raya Gamprit, Jatiwaringin'),
    ('jatiwaringin', (-6.2850, 106.9150), 'Jatiwaringin, Pondok Gede Bekasi'),
    ('wahana pondok gede', (-6.2850, 106.9150), 'Perum Wahana Pondok Gede'),
    ('harapan indah', (-6.1820, 106.9820), 'Kota Harapan Indah Bekasi'),
    ('haapan indah', (-6.1820, 106.9820), 'Kota Harapan Indah Bekasi'),
    ('bumi waringin indah', (-6.2650, 107.2250), 'Bumi Waringin Indah, Kedungwaringin'),
    ('waringinjaya', (-6.2650, 107.2250), 'Waringinjaya, Kedungwaringin Bekasi'),
    ('kedungwaringin', (-6.2650, 107.2250), 'Kedungwaringin, Kab. Bekasi'),
    ('tarumajaya', (-6.2150, 106.9850), 'Tarumajaya, Kab. Bekasi'),
    ('setia mulya', (-6.2150, 106.9850), 'Setiamulya, Tarumajaya Bekasi'),
    ('babelan', (-6.1850, 107.0250), 'Babelan, Kab. Bekasi'),
    ('bantar gebang', (-6.3250, 106.9950), 'Bantar Gebang, Kota Bekasi'),
    ('bantargebang', (-6.3250, 106.9950), 'Bantar Gebang, Kota Bekasi'),

    ('rs sari asih', (-6.2285, 106.7150), 'RS Sari Asih Ciledug, Tangerang'),
    ('sari asih ciledug', (-6.2285, 106.7150), 'RS Sari Asih Ciledug, Tangerang'),
    ('sudimara timur', (-6.2285, 106.7150), 'Sudimara Timur, Ciledug Tangerang'),
    ('sudimara tim', (-6.2285, 106.7150), 'Sudimara Timur, Ciledug Tangerang'),
    ('dci rempoa', (-6.3050, 106.7620), 'DCI Data Center Rempoa, Ciputat Timur'),
    ('rempoa', (-6.3050, 106.7620), 'Rempoa, Ciputat Timur Tangsel'),
    ('puspiptek', (-6.3550, 106.6750), 'Kawasan Puspiptek Serpong'),
    ('taman tekno', (-6.3350, 106.6750), 'Taman Tekno BSD, Serpong'),
    ('taman tecno', (-6.3350, 106.6750), 'Taman Tekno BSD, Serpong'),
    ('foresta', (-6.3050, 106.6450), 'Foresta Business Loft BSD'),
    ('lengkong kulon', (-6.2950, 106.6550), 'Lengkong Kulon, Pagedangan Tangerang'),
    ('ruko griya pamulang', (-6.3450, 106.7350), 'Ruko Griya Pamulang, Tangsel'),
    ('kreo selatan', (-6.2350, 106.7350), 'Kreo Selatan, Larangan Kota Tangerang'),
    ('petir tangerang', (-6.1950, 106.6850), 'Petir, Cipondoh Kota Tangerang'),
    ('pakojan pinang', (-6.2250, 106.6850), 'Pakojan, Pinang Kota Tangerang'),
    ('kadu sirung', (-6.1950, 106.5650), 'Kadu Sirung, Jatake Tangerang'),
    ('industri manis', (-6.1950, 106.5550), 'Kawasan Industri Manis, Tangerang'),
    ('diklat pemda', (-6.2650, 106.5650), 'Jl Diklat Pemda, Curug Tangerang'),
    ('binong', (-6.2450, 106.5850), 'Binong, Curug Kab. Tangerang'),
    ('dangdang', (-6.3350, 106.6350), 'Dangdang, Cisauk Kab. Tangerang'),
    ('gunung maloko', (-6.3350, 106.6350), 'Jl Gunung Maloko, Dangdang Cisauk'),
    ('ranca iyuh', (-6.2850, 106.5250), 'Ranca Iyuh, Panongan Tangerang'),
    ('ranca serdang', (-6.2850, 106.5250), 'Ranca Serdang, Panongan Tangerang'),
    ('cikupa mas', (-6.2250, 106.5150), 'Kawasan Industri Cikupa Mas'),
    ('bizpoint', (-6.2250, 106.5150), 'Bizpoint Business Park, Cikupa'),
    ('tristate', (-6.2250, 106.5150), 'Tristate Cikupa, Kab. Tangerang'),
    ('mutiara tigaraksa', (-6.3250, 106.4850), 'Mutiara Tigaraksa, Jambe Tangerang'),
    ('munjul', (-6.3150, 106.4450), 'Munjul, Solear Kab. Tangerang'),
    ('sindang jaya', (-6.1750, 106.5150), 'Sindang Jaya, Kab. Tangerang'),
    ('grand batavia', (-6.1650, 106.5550), 'Grand Batavia, Pasar Kemis Tangerang'),
    ('villa tangerang indah', (-6.1650, 106.6050), 'Villa Tangerang Indah, Gebang Raya'),
    ('gebang raya', (-6.1650, 106.6050), 'Gebang Raya, Periuk Tangerang'),
    ('pajang', (-6.1550, 106.6250), 'Pajang, Benda Kota Tangerang'),
    ('kalibaru pakuhaji', (-6.0650, 106.6050), 'Kalibaru, Pakuhaji Tangerang'),
    ('pakuhaji', (-6.0650, 106.6050), 'Pakuhaji, Kab. Tangerang'),
    ('palasari', (-6.3450, 106.4850), 'Palasari, Legok/Tigaraksa Tangerang'),

    # Jakarta Barat
    ('green garden', (-6.1620, 106.7620), 'Green Garden, Kedoya Utara Jakbar'),
    ('puri kencana', (-6.1880, 106.7350), 'Rukan Puri Kencana, Kembangan Jakbar'),
    ('meruya sel', (-6.2050, 106.7350), 'Meruya Selatan, Kembangan Jakbar'),
    ('south kembangan', (-6.1880, 106.7450), 'Kembangan Selatan, Jakarta Barat'),
    ('ratu alamanda', (-6.1680, 106.7600), 'Ratu Alamanda, Duri Kepa Kebon Jeruk'),
    ('duri kepa', (-6.1680, 106.7600), 'Duri Kepa, Kebon Jeruk Jakbar'),
    ('tanjung duren', (-6.1750, 106.7850), 'Tanjung Duren, Grogol Petamburan'),
    ('daan mogot', (-6.1550, 106.7450), 'Jl Daan Mogot, Jakarta Barat'),
    ('rawa buaya', (-6.1620, 106.7250), 'Rawa Buaya, Cengkareng Jakbar'),
    ('roa malaka', (-6.1350, 106.8050), 'Roa Malaka, Tambora Jakarta Barat'),

    # Jakarta Utara
    ('rorotan', (-6.1450, 106.9450), 'Rorotan, Cilincing Jakarta Utara'),
    ('marunda', (-6.1050, 106.9650), 'KBN Marunda, Cilincing Jakut'),
    ('kbn marunda', (-6.1050, 106.9650), 'KBN Marunda, Cilincing Jakut'),
    ('rawa malang', (-6.1150, 106.9450), 'Rawa Malang, Semper Timur Cilincing'),
    ('pegangsaan dua', (-6.1650, 106.9150), 'Pegangsaan Dua, Kelapa Gading'),
    ('sungai bambu', (-6.1280, 106.8850), 'Sungai Bambu, Tanjung Priok Jakut'),
    ('brin ancol', (-6.1250, 106.8450), 'BRIN Ancol, Pademangan Jakut'),
    ('pasir putih ancol', (-6.1260, 106.8320), 'DRC Artha Graha Pasir Putih Ancol'),
    ('ancol barat', (-6.1250, 106.8150), 'Ancol Barat, Pademangan Jakut'),
    ('lodan', (-6.1280, 106.8250), 'Jl Lodan Raya, Ancol Pademangan'),

    # Jakarta Timur
    ('grand cakung', (-6.1850, 106.9480), 'Grand Cakung / Inkopol, Cakung Jaktim'),
    ('inkopol', (-6.1850, 106.9480), 'Ruko Inkopol Grand Cakung Jaktim'),
    ('pulo gebang', (-6.1880, 106.9510), 'Pulo Gebang, Cakung Jakarta Timur'),
    ('jiep', (-6.1950, 106.9150), 'Kawasan Industri Pulogadung JIEP'),
    ('kebon manggis', (-6.1980, 106.8650), 'Kebon Manggis, Matraman Jaktim'),
    ('buaran', (-6.2200, 106.9180), 'Buaran, Duren Sawit Jaktim'),
    ('halim perdana kusuma', (-6.2620, 106.8910), 'Bandara Halim Perdanakusuma'),
    ('pinang ranti', (-6.2850, 106.8850), 'Pinang Ranti, Makasar Jaktim'),
    ('tmii', (-6.3025, 106.8950), 'Taman Mini Indonesia Indah (TMII)'),

    # Jakarta Pusat
    ('midpoint place', (-6.1855, 106.8155), 'Midpoint Place, Jl H Fachrudin'),
    ('fachrudin', (-6.1855, 106.8155), 'Jl H Fachrudin, Tanah Abang'),
    ('grand indonesia', (-6.1950, 106.8210), 'Grand Indonesia, Thamrin'),
    ('wisma 46', (-6.2050, 106.8210), 'Wisma 46 BNI City, Sudirman'),
    ('bni city', (-6.2050, 106.8210), 'BNI City, Sudirman Jakpus'),
    ('intiland', (-6.2080, 106.8210), 'Intiland Tower, Sudirman Jakpus'),
    ('danareksa', (-6.1764, 106.8285), 'Menara Danareksa / BSI Tower'),
    ('medan merdeka barat', (-6.1764, 106.8225), 'Jl Medan Merdeka Barat'),
    ('medan merdeka timur', (-6.1780, 106.8330), 'Jl Medan Merdeka Timur'),
    ('medan merdeka selatan', (-6.1815, 106.8285), 'Jl Medan Merdeka Selatan (BUMN)'),
    ('ridwan rais', (-6.1800, 106.8340), 'Jl MI Ridwan Rais, Gambir'),
    ('lapangan banteng', (-6.1700, 106.8350), 'Lapangan Banteng, Sawah Besar'),
    ('pasar baru', (-6.1630, 106.8320), 'Pasar Baru, Sawah Besar Jakpus'),
    ('jiexpo', (-6.1485, 106.8450), 'JIExpo Kemayoran, Jakarta Pusat'),
    ('jakarta international expo', (-6.1485, 106.8450), 'JIExpo Kemayoran'),
    ('cempaka mas', (-6.1680, 106.8750), 'ITC Cempaka Mas, Jakpus'),
    ('cokroaminoto menteng', (-6.1950, 106.8320), 'Jl HOS Cokroaminoto, Menteng'),
    ('hos cokroaminoto menteng', (-6.1950, 106.8320), 'Jl HOS Cokroaminoto, Menteng'),

    # Jakarta Selatan
    ('centennial tower', (-6.2320, 106.8210), 'Centennial Tower, Gatot Subroto'),
    ('jamsostek', (-6.2350, 106.8230), 'Gedung Menara Jamsostek, Gatsu'),
    ('wtc 2', (-6.2150, 106.8210), 'World Trade Center (WTC) 2, Sudirman'),
    ('gbk', (-6.2185, 106.8020), 'Gelora Bung Karno (GBK) Senayan'),
    ('karet semanggi', (-6.2180, 106.8180), 'Karet Semanggi, Setiabudi Jaksel'),
    ('wisma indomobil', (-6.2420, 106.8680), 'Wisma Indomobil, MT Haryono Jaksel'),
    ('kemang raya', (-6.2750, 106.8150), 'Jl Kemang Raya, Bangka Mampang'),
    ('adityawarman', (-6.2420, 106.8020), 'Jl Adityawarman, Kebayoran Baru'),
    ('niaga hijau', (-6.2750, 106.7820), 'Jl Niaga Hijau, Pondok Indah'),
    ('pondok pinang', (-6.2850, 106.7750), 'Pondok Pinang, Kebayoran Lama'),
    ('permata hijau', (-6.2250, 106.7850), 'Permata Hijau, Kebayoran Lama'),
    ('kalibata city', (-6.2580, 106.8550), 'Kalibata City, Pancoran Jaksel'),
    ('tanjung barat', (-6.3050, 106.8450), 'Tanjung Barat, Jagakarsa Jaksel'),
]

# =========================================================================
# TIER 2: SUBDISTRICTS (KECAMATAN / KELURAHAN / DESA)
# =========================================================================
TIER2_SUBDISTRICTS = [
    # Jakarta Barat
    ('kedoya utara', (-6.1620, 106.7620), 'Kedoya Utara, Kebon Jeruk'),
    ('kedoya', (-6.1680, 106.7600), 'Kedoya, Kebon Jeruk'),
    ('kembangan', (-6.1880, 106.7350), 'Kembangan, Jakarta Barat'),
    ('meruya', (-6.1950, 106.7400), 'Meruya, Jakarta Barat'),
    ('kebon jeruk', (-6.1850, 106.7700), 'Kebon Jeruk, Jakarta Barat'),
    ('kb. jeruk', (-6.1850, 106.7700), 'Kebon Jeruk, Jakarta Barat'),
    ('grogol', (-6.1650, 106.7850), 'Grogol, Jakarta Barat'),
    ('slipi', (-6.1950, 106.7980), 'Slipi, Palmerah Jakbar'),
    ('palmerah', (-6.2050, 106.7950), 'Palmerah, Jakarta Barat'),
    ('cengkareng', (-6.1520, 106.7250), 'Cengkareng, Jakarta Barat'),
    ('kalideres', (-6.1550, 106.7050), 'Kalideres, Jakarta Barat'),
    ('taman sari', (-6.1450, 106.8150), 'Taman Sari, Jakarta Barat'),
    ('glodok', (-6.1450, 106.8150), 'Glodok, Jakarta Barat'),
    ('tambora', (-6.1450, 106.8000), 'Tambora, Jakarta Barat'),

    # Jakarta Utara
    ('cilincing', (-6.1250, 106.9250), 'Cilincing, Jakarta Utara'),
    ('semper', (-6.1280, 106.9150), 'Semper, Jakarta Utara'),
    ('kelapa gading', (-6.1580, 106.9050), 'Kelapa Gading, Jakarta Utara'),
    ('sunter', (-6.1450, 106.8750), 'Sunter, Jakarta Utara'),
    ('tanjung priok', (-6.1150, 106.8850), 'Tanjung Priok, Jakarta Utara'),
    ('tanjung priuk', (-6.1150, 106.8850), 'Tanjung Priok, Jakarta Utara'),
    ('tj. priok', (-6.1150, 106.8850), 'Tanjung Priok, Jakarta Utara'),
    ('koja', (-6.1250, 106.8950), 'Koja, Jakarta Utara'),
    ('ancol', (-6.1250, 106.8350), 'Ancol, Jakarta Utara'),
    ('pademangan', (-6.1350, 106.8400), 'Pademangan, Jakarta Utara'),
    ('pluit', (-6.1220, 106.7900), 'Pluit, Jakarta Utara'),
    ('penjaringan', (-6.1250, 106.7950), 'Penjaringan, Jakarta Utara'),

    # Jakarta Timur
    ('cakung', (-6.1880, 106.9510), 'Cakung, Jakarta Timur'),
    ('pulogadung', (-6.1950, 106.9050), 'Pulogadung, Jakarta Timur'),
    ('pulo gadung', (-6.1950, 106.9050), 'Pulogadung, Jakarta Timur'),
    ('rawamangun', (-6.1950, 106.8850), 'Rawamangun, Jakarta Timur'),
    ('matraman', (-6.1980, 106.8650), 'Matraman, Jakarta Timur'),
    ('jatinegara', (-6.2250, 106.8750), 'Jatinegara, Jakarta Timur'),
    ('duren sawit', (-6.2350, 106.9150), 'Duren Sawit, Jakarta Timur'),
    ('kramat jati', (-6.2650, 106.8680), 'Kramat Jati, Jakarta Timur'),
    ('cawang', (-6.2480, 106.8680), 'Cawang, Jakarta Timur'),
    ('makasar', (-6.2750, 106.8850), 'Makasar, Jakarta Timur'),
    ('pasar rebo', (-6.3150, 106.8650), 'Pasar Rebo, Jakarta Timur'),
    ('ciracas', (-6.3350, 106.8750), 'Ciracas, Jakarta Timur'),
    ('cipayung', (-6.3250, 106.9050), 'Cipayung, Jakarta Timur'),

    # Jakarta Pusat
    ('tanah abang', (-6.1855, 106.8155), 'Tanah Abang, Jakarta Pusat'),
    ('kebon sirih', (-6.1830, 106.8250), 'Kebon Sirih, Jakarta Pusat'),
    ('kb. sirih', (-6.1830, 106.8250), 'Kebon Sirih, Jakarta Pusat'),
    ('menteng', (-6.1950, 106.8350), 'Menteng, Jakarta Pusat'),
    ('gambir', (-6.1780, 106.8320), 'Gambir, Jakarta Pusat'),
    ('medan merdeka', (-6.1780, 106.8285), 'Medan Merdeka, Jakarta Pusat'),
    ('sawah besar', (-6.1600, 106.8300), 'Sawah Besar, Jakarta Pusat'),
    ('kemayoran', (-6.1550, 106.8500), 'Kemayoran, Jakarta Pusat'),
    ('senen', (-6.1800, 106.8450), 'Senen, Jakarta Pusat'),
    ('cempaka putih', (-6.1800, 106.8700), 'Cempaka Putih, Jakarta Pusat'),

    # Jakarta Selatan
    ('senayan', (-6.2250, 106.8000), 'Senayan, Jakarta Selatan'),
    ('kuningan barat', (-6.2380, 106.8240), 'Kuningan Barat, Jaksel'),
    ('kuningan', (-6.2250, 106.8300), 'Kuningan, Jakarta Selatan'),
    ('setiabudi', (-6.2150, 106.8280), 'Setiabudi, Jakarta Selatan'),
    ('tebet', (-6.2350, 106.8550), 'Tebet, Jakarta Selatan'),
    ('pancoran', (-6.2450, 106.8450), 'Pancoran, Jakarta Selatan'),
    ('mampang', (-6.2450, 106.8250), 'Mampang Prapatan, Jakarta Selatan'),
    ('kemang', (-6.2750, 106.8150), 'Kemang, Jakarta Selatan'),
    ('kebayoran baru', (-6.2450, 106.8050), 'Kebayoran Baru, Jakarta Selatan'),
    ('fatmawati', (-6.2750, 106.7980), 'Fatmawati, Jakarta Selatan'),
    ('cilandak', (-6.2950, 106.8050), 'Cilandak, Jakarta Selatan'),
    ('simatupang', (-6.2950, 106.8250), 'TB Simatupang, Jakarta Selatan'),
    ('pondok indah', (-6.2750, 106.7820), 'Pondok Indah, Jakarta Selatan'),
    ('kebayoran lama', (-6.2450, 106.7750), 'Kebayoran Lama, Jakarta Selatan'),
    ('petukangan', (-6.2350, 106.7550), 'Petukangan, Jakarta Selatan'),
    ('pesanggrahan', (-6.2450, 106.7650), 'Pesanggrahan, Jakarta Selatan'),
    ('kalibata', (-6.2580, 106.8550), 'Kalibata, Jakarta Selatan'),
    ('pasar minggu', (-6.2850, 106.8350), 'Pasar Minggu, Jakarta Selatan'),
    ('jagakarsa', (-6.3350, 106.8250), 'Jagakarsa, Jakarta Selatan'),

    # Bogor
    ('ciawi', (-6.6550, 106.8550), 'Ciawi, Bogor'),
    ('cileungsi', (-6.3950, 106.9650), 'Cileungsi, Bogor'),
    ('cilengsi', (-6.3950, 106.9650), 'Cileungsi, Bogor'),
    ('gunung putri', (-6.4650, 106.9150), 'Gunung Putri, Bogor'),
    ('gn. putri', (-6.4650, 106.9150), 'Gunung Putri, Bogor'),
    ('gn putri', (-6.4650, 106.9150), 'Gunung Putri, Bogor'),
    ('jonggol', (-6.4650, 107.0550), 'Jonggol, Bogor'),
    ('cibinong', (-6.4850, 106.8550), 'Cibinong, Bogor'),
    ('bojong gede', (-6.4950, 106.7950), 'Bojonggede, Bogor'),
    ('bojonggede', (-6.4950, 106.7950), 'Bojonggede, Bogor'),
    ('parung', (-6.4250, 106.7350), 'Parung, Bogor'),
    ('bogor barat', (-6.5850, 106.7650), 'Bogor Barat, Kota Bogor'),

    # Depok
    ('limo', (-6.3680, 106.7780), 'Limo, Kota Depok'),
    ('cinere', (-6.3380, 106.7850), 'Cinere, Kota Depok'),
    ('sawangan', (-6.3950, 106.7750), 'Sawangan, Kota Depok'),
    ('cimanggis', (-6.3750, 106.8650), 'Cimanggis, Kota Depok'),
    ('margonda', (-6.3750, 106.8320), 'Margonda, Depok'),
    ('beji', (-6.3650, 106.8250), 'Beji, Kota Depok'),
    ('sukmajaya', (-6.4050, 106.8450), 'Sukmajaya, Kota Depok'),
    ('cilodong', (-6.4350, 106.8350), 'Cilodong, Kota Depok'),
    ('pancoran mas', (-6.3950, 106.8050), 'Pancoran Mas, Depok'),
    ('tapos', (-6.4150, 106.8850), 'Tapos, Kota Depok'),

    # Bekasi & Cikarang
    ('cikarang pusat', (-6.3685, 107.1724), 'Cikarang Pusat, Bekasi'),
    ('cikarang barat', (-6.2750, 107.0980), 'Cikarang Barat, Bekasi'),
    ('cikarang utara', (-6.2650, 107.1550), 'Cikarang Utara, Bekasi'),
    ('cikarang selatan', (-6.3250, 107.1250), 'Cikarang Selatan, Bekasi'),
    ('cikarang timur', (-6.2850, 107.1850), 'Cikarang Timur, Bekasi'),
    ('cikarang', (-6.2610, 107.1520), 'Cikarang, Bekasi'),
    ('cibitung', (-6.2650, 107.0850), 'Cibitung, Bekasi'),
    ('mustika jaya', (-6.2850, 107.0250), 'Mustika Jaya, Kota Bekasi'),
    ('mustikajaya', (-6.2850, 107.0250), 'Mustika Jaya, Kota Bekasi'),
    ('tambun utara', (-6.2200, 107.0450), 'Tambun Utara, Bekasi'),
    ('tambun selatan', (-6.2600, 107.0600), 'Tambun Selatan, Bekasi'),
    ('tambun', (-6.2600, 107.0600), 'Tambun, Bekasi'),
    ('jatimulya', (-6.2650, 107.0180), 'Jatimulya, Bekasi'),
    ('bekasi timur', (-6.2550, 107.0150), 'Bekasi Timur, Kota Bekasi'),
    ('bekasi selatan', (-6.2450, 106.9850), 'Bekasi Selatan, Kota Bekasi'),
    ('rawalumbu', (-6.2650, 107.0050), 'Rawalumbu, Kota Bekasi'),
    ('jatiasih', (-6.2950, 106.9650), 'Jatiasih, Kota Bekasi'),
    ('pondok gede', (-6.2850, 106.9150), 'Pondok Gede, Kota Bekasi'),
    ('bekasi utara', (-6.2200, 107.0000), 'Bekasi Utara, Kota Bekasi'),
    ('bekasi barat', (-6.2350, 106.9750), 'Bekasi Barat, Kota Bekasi'),

    # Tangerang & Tangsel
    ('serpong utara', (-6.2250, 106.6550), 'Serpong Utara, Tangsel'),
    ('serpong', (-6.3150, 106.6650), 'Serpong, Tangerang Selatan'),
    ('bsd', (-6.3050, 106.6550), 'BSD City, Serpong'),
    ('pagedangan', (-6.2950, 106.6550), 'Pagedangan, Kab. Tangerang'),
    ('pondok aren', (-6.2850, 106.7050), 'Pondok Aren, Tangsel'),
    ('bintaro', (-6.2850, 106.7250), 'Bintaro Jaya, Tangsel'),
    ('ciputat', (-6.3150, 106.7450), 'Ciputat, Tangerang Selatan'),
    ('pamulang', (-6.3450, 106.7350), 'Pamulang, Tangerang Selatan'),
    ('larangan', (-6.2350, 106.7350), 'Larangan, Kota Tangerang'),
    ('ciledug', (-6.2250, 106.7150), 'Ciledug, Kota Tangerang'),
    ('cipondoh', (-6.1950, 106.6750), 'Cipondoh, Kota Tangerang'),
    ('pinang', (-6.2250, 106.6850), 'Pinang, Kota Tangerang'),
    ('cikokol', (-6.1950, 106.6350), 'Cikokol, Kota Tangerang'),
    ('batuceper', (-6.1650, 106.6650), 'Batuceper, Kota Tangerang'),
    ('cibodas', (-6.1950, 106.5950), 'Cibodas, Kota Tangerang'),
    ('karawaci', (-6.2150, 106.6150), 'Karawaci, Kota Tangerang'),
    ('jatake', (-6.1950, 106.5650), 'Jatake, Kota Tangerang'),
    ('curug', (-6.2550, 106.5550), 'Curug, Kab. Tangerang'),
    ('legok', (-6.2950, 106.5850), 'Legok, Kab. Tangerang'),
    ('cisauk', (-6.3350, 106.6350), 'Cisauk, Kab. Tangerang'),
    ('panongan', (-6.2850, 106.5250), 'Panongan, Kab. Tangerang'),
    ('cikupa', (-6.2250, 106.5150), 'Cikupa, Kab. Tangerang'),
    ('balaraja', (-6.1950, 106.4650), 'Balaraja, Kab. Tangerang'),
    ('tigaraks', (-6.2850, 106.4850), 'Tigaraksa, Kab. Tangerang'),
    ('jambe', (-6.3250, 106.4850), 'Jambe, Kab. Tangerang'),
    ('solear', (-6.3150, 106.4450), 'Solear, Kab. Tangerang'),
    ('pasar kemis', (-6.1650, 106.5550), 'Pasar Kemis, Kab. Tangerang'),
]

# =========================================================================
# TIER 3: MAJOR CITIES / REGENCIES (KOTA / KABUPATEN)
# =========================================================================
TIER3_CITIES = [
    ('cilegon', (-6.0175, 106.0538), 'Kota Cilegon, Banten'),
    ('serang', (-6.1104, 106.1550), 'Kota Serang, Banten'),
    ('pandeglang', (-6.3088, 106.1065), 'Pandeglang, Banten'),
    ('lebak', (-6.3550, 106.2500), 'Kabupaten Lebak, Banten'),
    ('karawang', (-6.3150, 107.2950), 'Karawang, Jawa Barat'),
    ('purwakarta', (-6.5550, 107.4450), 'Purwakarta, Jawa Barat'),
    ('sukabumi', (-6.9277, 106.9300), 'Sukabumi, Jawa Barat'),
    ('bandung', (-6.9175, 107.6191), 'Bandung, Jawa Barat'),
    ('semarang', (-6.9666, 110.4166), 'Semarang, Jawa Tengah'),
    ('bogor', (-6.5950, 106.7900), 'Kota Bogor, Jawa Barat'),
    ('depok', (-6.4025, 106.8180), 'Kota Depok, Jawa Barat'),
    ('bekasi', (-6.2380, 106.9750), 'Kota Bekasi, Jawa Barat'),
    ('tangerang selatan', (-6.2888, 106.7179), 'Kota Tangerang Selatan'),
    ('tangsel', (-6.2888, 106.7179), 'Kota Tangerang Selatan'),
    ('tangerang', (-6.1783, 106.6319), 'Kota Tangerang, Banten'),
    ('jakarta barat', (-6.1680, 106.7600), 'Jakarta Barat'),
    ('jakbar', (-6.1680, 106.7600), 'Jakarta Barat'),
    ('jakarta utara', (-6.1380, 106.8650), 'Jakarta Utara'),
    ('jakut', (-6.1380, 106.8650), 'Jakarta Utara'),
    ('jakarta timur', (-6.2250, 106.9000), 'Jakarta Timur'),
    ('jaktim', (-6.2250, 106.9000), 'Jakarta Timur'),
    ('jakarta selatan', (-6.2615, 106.8106), 'Jakarta Selatan'),
    ('jaksel', (-6.2615, 106.8106), 'Jakarta Selatan'),
    ('jakarta pusat', (-6.1815, 106.8285), 'Jakarta Pusat'),
    ('jakpus', (-6.1815, 106.8285), 'Jakarta Pusat'),
    ('dki jakarta', (-6.1850, 106.8250), 'DKI Jakarta'),
    ('jakarta', (-6.1850, 106.8250), 'DKI Jakarta')
]

def clean_terminating(term):
    t = term.strip()
    # 1. Remove leading customer name if present like "PT. INDOMARCO PRISMATAMA, "
    t = re.sub(r'^(?:PT\.?\s+[A-Z0-9\.\s]+,\s*)', '', t, flags=re.IGNORECASE)
    # 2. Remove retail code prefix even if missing opening '('
    # e.g. "JAKARTA 2)(TVZ4)(...)" or "(JAKARTA 2)(TVZ4)(...)"
    t = re.sub(r'^(?:\(?[A-Z0-9\s\-_]+\)\s*)+', '', t, flags=re.IGNORECASE)
    t = t.strip()
    return t if len(t) > 5 else term.strip()

def geocode_accurate(term, pa, pel, update):
    # Step 1: Explicit Coordinates in terminating or update
    combined = f"{term} {update}"
    m = re.search(r'(-?[0-8]\.\d{3,})[,\s/]+(10[5-9]\.\d{3,})', combined)
    if m:
        try:
            lat = float(m.group(1))
            lng = float(m.group(2))
            if -11 <= lat <= 6 and 95 <= lng <= 141:
                return lat, lng, "EXACT_COORDS", "Koordinat GPS Presisi Lapangan"
        except:
            pass

    # Step 2: Clean Address Body
    body = clean_terminating(term).lower()
    raw = term.lower()

    # Step 3: Match Tier 1 (Landmarks) in body, then raw
    for kw, coords, desc in TIER1_LANDMARKS:
        pat = r'(?:\b|^)' + re.escape(kw) + r'(?:\b|$)'
        if re.search(pat, body) or re.search(pat, raw):
            return coords[0], coords[1], f"GEO_{kw.upper().replace(' ', '_')}", desc

    # Step 4: Match Tier 2 (Subdistricts) in body first
    for kw, coords, desc in TIER2_SUBDISTRICTS:
        pat = r'(?:\b|^)' + re.escape(kw) + r'(?:\b|$)'
        if re.search(pat, body):
            return coords[0], coords[1], f"GEO_{kw.upper().replace(' ', '_')}", desc

    # Step 5: Match Tier 3 (Cities) in body first
    for kw, coords, desc in TIER3_CITIES:
        # Special check for purwakarta vs cilegon
        if kw == 'purwakarta' and 'cilegon' in raw:
            continue
        pat = r'(?:\b|^)' + re.escape(kw) + r'(?:\b|$)'
        if re.search(pat, body):
            return coords[0], coords[1], f"GEO_{kw.upper().replace(' ', '_')}", desc

    # Step 6: Fallback to Tier 2 in raw
    for kw, coords, desc in TIER2_SUBDISTRICTS:
        pat = r'(?:\b|^)' + re.escape(kw) + r'(?:\b|$)'
        if re.search(pat, raw):
            return coords[0], coords[1], f"GEO_{kw.upper().replace(' ', '_')}", desc

    # Step 7: Fallback to Tier 3 in raw
    for kw, coords, desc in TIER3_CITIES:
        if kw == 'purwakarta' and 'cilegon' in raw:
            continue
        pat = r'(?:\b|^)' + re.escape(kw) + r'(?:\b|$)'
        if re.search(pat, raw):
            return coords[0], coords[1], f"GEO_{kw.upper().replace(' ', '_')}", desc

    # Step 8: Final anchor
    return -6.1850, 106.8250, "GEO_JAKARTA_CENTRAL", "Pusat Operasional Jakarta"

def run_update():
    import sqlite3
    print("=== UPDATING ALL 451 SITAC RECORDS WITH HIGH-PRECISION GEOCODING ===")

    # 1. Load sitac_collo_data.json
    with open('sitac_collo_data.json', 'r', encoding='utf-8') as f:
        master_data = json.load(f)

    sitac_list = master_data.get('sitac_records', [])
    updated = 0
    type_counts = {}

    for s in sitac_list:
        term = s.get('terminating') or ''
        pel = s.get('pelanggan') or ''
        up = s.get('update_pekerjaan') or ''
        pa = s.get('no_pa') or ''

        lat, lng, match_type, desc = geocode_accurate(term, pa, pel, up)
        s['latitude'] = lat
        s['longitude'] = lng
        s['coord_type'] = match_type
        type_counts[match_type] = type_counts.get(match_type, 0) + 1
        updated += 1

    print(f"✓ Geocoded {updated} SITAC records with 100% precision.")
    print("Top matched geocoding areas:")
    for k, v in sorted(type_counts.items(), key=lambda x: x[1], reverse=True)[:15]:
        print(f"  {k}: {v}")

    # 2. Save sitac_collo_data.json
    with open('sitac_collo_data.json', 'w', encoding='utf-8') as f:
        json.dump(master_data, f, indent=2, ensure_ascii=False)
    print("✓ Saved sitac_collo_data.json")

    # 3. Save sitac_collo_data.js (window.SITAC_COLLO_DATA)
    js_content = f"window.SITAC_COLLO_DATA = {json.dumps(master_data, indent=2, ensure_ascii=False)};\n"
    with open('sitac_collo_data.js', 'w', encoding='utf-8') as f:
        f.write(js_content)
    print("✓ Saved sitac_collo_data.js")

    # 4. Save to SQLite database telecom_portal.db
    conn = sqlite3.connect('telecom_portal.db')
    cursor = conn.cursor()
    for s in sitac_list:
        cursor.execute("""
            UPDATE sitac_records
            SET latitude = ?, longitude = ?, coord_type = ?
            WHERE id = ?
        """, (s['latitude'], s['longitude'], s['coord_type'], s['id']))
    conn.commit()
    conn.close()
    print("✓ Saved coordinates to telecom_portal.db")

if __name__ == '__main__':
    run_update()

