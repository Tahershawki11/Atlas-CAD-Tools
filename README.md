# Atlas Tools

تطبيق هاتف بواجهة عربية لقراءة DWG/DXF، وإدارة مشاريع محلية، وفحص توافق Leaflet مع محرك FiberLens. الواجهة مصممة للهاتف فقط، ويمكن تشغيلها داخل متصفح الهاتف أو WebView/Capacitor.

## التشغيل

```sh
npm ci
npm run dev
# http://localhost:5180
```

```sh
npm run build
npm test
npx playwright install chromium
npm run test:browser
```

للاختبار على النسخة الإنتاجية بدل خادم التطوير:

```sh
npm run preview -- --port 5181
ATLAS_TEST_URL=http://localhost:5181 npm run test:browser
```

## الاستخدام

- «فتح ملف»: يستورد DWG/DXF في Web Worker، ويحفظ نسخة أصلية لا تتغير مع حالة الطبقات.
- «ملف جديد»: مشروع محلي فارغ باسم ووحدة رسم. الرسم والتحرير والتصدير ليسوا ضمن النسخة الأولى.
- سجل الملفات: إعادة فتح، بحث، تصفية DWG/DXF، وحذف نسخة المشروع مع بياناتها بعد التأكيد.
- داخل الرسم: طبقات، ملاءمة، تحريك، تكبير، قياس نقطتين بوحدات CAD الأصلية.
- «اختبار التوافق»: عرض أصلي وعرض Leaflet، ثم فحص رؤوس خطوط العرض الفعلية وتنزيل JSON.
- يبدأ الملف بإحداثيات محلية. اختر CRS المؤكد لديك قبل عرض الخريطة؛ لا نخمّن منطقة UTM تلقائيًا.
- عينات إضافية للاختبار في `public/samples`. كل عينات `Synthetic-*` مصطنعة وموسومة بهذا الاسم.

تُحفظ البيانات محليًا في IndexedDB. مسح بيانات الموقع أو المتصفح يحذفها. احتفظ بالأصول خارج التطبيق. الخريطة الأساسية من OpenStreetMap تحتاج اتصالًا؛ التطبيق ليس PWA ولا يعيد تحميل نفسه دون سيرفر/إنترنت.

## البنية

- React / TypeScript / Vite وواجهة مستقلة عن FiberLens.
- `src/cad`: أجزاء محرك FiberLens القابلة لإعادة الاستخدام، مثبتة على المرجع الموثق في THIRD_PARTY_NOTICES.
- `src/map`: طبقة Leaflet، وتحويل إحداثيات العرض وقياسات المحاذاة.
- `src/lib/storage.ts`: تخزين ذري لبيانات المشاريع والأصول.
- `src/components`: إدارة الملفات ومساحة الرسم والمختبر.

تفاصيل الاختبار والقيود: [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md).  
تفاصيل الواجهة والمقارنة البصرية: [docs/DESIGN.md](docs/DESIGN.md).

## النشر والتحديث على الهاتف

Workflow باسم **Web preview artifact** يبني نسخة الويب ويرفعها كـArtifact مع كل دفع إلى `main`. نشر رابط GitHub Pages يحتاج تفعيل Pages مرة واحدة من Settings → Pages → GitHub Actions، لأن اتصال GitHub الحالي لا يملك صلاحية إنشاء موقع Pages تلقائيًا.

Workflow باسم **Build Android APK** يبني APK موقّعًا مع كل دفع إلى `main` وينشئ Release تلقائيًا برقم مثل `v0.1.16`. كما يدعم Tags بصيغة `v*.*.*`.

يحتاج الإصدار أسرارًا ثابتة:

- `ANDROID_KEYSTORE_BASE64`: محتوى keystore بصيغة Base64.
- `ANDROID_KEYSTORE_PASSWORD`: كلمة مرور keystore.
- `ANDROID_KEY_ALIAS`: `atlas`.

الـkeystore المستخدم بصيغة PKCS12، لذلك يستخدم Android كلمة مرور keystore نفسها للمفتاح الخاص. يجب الاحتفاظ بنفس keystore لكل الإصدارات؛ تغييره يمنع Android من تثبيت التحديث فوق النسخة السابقة. السر القديم `ANDROID_KEY_PASSWORD` يمكن تركه موجودًا، لكنه غير مستخدم في Workflow الحالي.

صفحة دليل الاستخدام داخل التطبيق تفحص `releases/latest` في المستودع وتعرض APK الأحدث. لأسباب أمن Android، التنزيل يمر عبر مثبت النظام ويحتاج موافقة المستخدم على تثبيت التطبيقات من المصدر؛ لا يمكن لتطبيق عادي تنفيذ تثبيت صامت دون إدارة جهاز أو صلاحيات نظام.
