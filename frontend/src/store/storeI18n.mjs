// Трёхъязычный словарь витрины ART Store: RU / UZ (латиница) / EN.
// ВАЖНО (по требованию клиента): доставка НЕ бесплатная и пока НЕ реализована —
// нигде не обещаем «доставим за 24 часа»; получение/оплату согласует куратор.

export const STORE_LANGS = ['ru', 'uz', 'en'];
export const STORE_LANG_KEY = 'art_store_lang';

const T = {
  // Верхняя лента (честно, без обещаний доставки)
  annMain: {
    ru: 'Заказ онлайн — куратор перезвонит и всё согласует',
    uz: "Onlayn buyurtma — kurator qo'ng'iroq qilib kelishib oladi",
    en: 'Order online — our curator will call you back',
  },
  annExtra: {
    ru: 'Шоурум: Parking Mall, Ташкент',
    uz: 'Shourum: Parking Mall, Toshkent',
    en: 'Showroom: Parking Mall, Tashkent',
  },

  docTitle: {
    ru: 'ART Store — искусство и ремёсла Узбекистана',
    uz: "ART Store — O'zbekiston san'ati va hunarmandchiligi",
    en: 'ART Store — art & crafts of Uzbekistan',
  },

  navCatalog: { ru: 'Каталог', uz: 'Katalog', en: 'Catalog' },
  navAbout: { ru: 'О нас', uz: 'Biz haqimizda', en: 'About' },

  heroEyebrow: {
    ru: 'Антиквариат Узбекистана · частная коллекция',
    uz: "O'zbekiston antikvariati · shaxsiy kolleksiya",
    en: 'Uzbek antiques · private collection',
  },
  heroTitle1: { ru: 'История,', uz: 'Tarix,', en: 'History' },
  heroTitle2: { ru: 'которую можно сохранить.', uz: 'uni saqlab qolish mumkin.', en: 'you can keep.' },
  heroSubtitle: {
    ru: 'Редкие предметы Центральной Азии — с вниманием к происхождению, материалу и времени.',
    uz: "Markaziy Osiyoning noyob buyumlari — kelib chiqishi, materiali va davriga e'tibor bilan.",
    en: 'Rare Central Asian objects — curated with care for provenance, material and time.',
  },
  heroCta: { ru: 'Смотреть коллекцию', uz: "Kolleksiyani ko'rish", en: 'View the collection' },
  heroCaption1: { ru: 'Лазурная керамика', uz: 'Lazur sopol buyum', en: 'Azure ceramics' },
  heroCaption2: { ru: 'Средняя Азия, музейная серия', uz: "O'rta Osiyo, muzey seriyasi", en: 'Central Asia, museum series' },
  heroAlt: {
    ru: 'Лазурная керамика и бронзовый кумган — артефакты в традициях Узбекистана',
    uz: "Lazur sopol va bronza kumg'on — O'zbekiston an'analaridagi artefaktlar",
    en: 'Azure ceramics and a bronze ewer — artifacts in the Uzbek tradition',
  },

  marq1: { ru: 'Оригиналы', uz: 'Asl asarlar', en: 'Originals' },
  marq2: { ru: 'Лимитированные принты', uz: 'Cheklangan printlar', en: 'Limited prints' },
  marq3: { ru: 'Керамика', uz: 'Sopol buyumlar', en: 'Ceramics' },
  marq4: { ru: 'Новые имена', uz: 'Yangi nomlar', en: 'New names' },

  collKicker: { ru: 'Выбор ART Store', uz: 'ART Store tanlovi', en: 'ART Store selection' },
  collTitle1: { ru: 'Работы, которые', uz: 'Makonni', en: 'Works that' },
  collTitle2: { ru: 'меняют пространство.', uz: "o'zgartiradigan asarlar.", en: 'transform a space.' },
  collText: {
    ru: 'Каждую работу мы выбираем лично — за сильную идею, честный материал и то чувство, которое остаётся надолго.',
    uz: "Har bir asarni shaxsan tanlaymiz — kuchli g'oyasi, halol materiali va uzoq qoladigan hissi uchun.",
    en: 'We select every piece personally — for a strong idea, honest material and a feeling that stays.',
  },

  catAll: { ru: 'Все', uz: 'Barchasi', en: 'All' },
  searchPh: { ru: 'Художник, работа или техника', uz: 'Ijodkor, asar yoki texnika', en: 'Artist, work or technique' },
  searchInlinePh: { ru: 'Найти работу', uz: 'Asar qidirish', en: 'Search the catalog' },

  view: { ru: 'Смотреть', uz: "Ko'rish", en: 'View' },
  photoSoon: { ru: 'фото скоро', uz: 'surat tez orada', en: 'photo soon' },
  lastOne: { ru: 'Последний экземпляр', uz: 'Oxirgi nusxa', en: 'Last one' },
  addedToCart: { ru: '«{name}» добавлено в корзину', uz: '«{name}» savatga qo‘shildi', en: '“{name}” added to cart' },

  emptyTitle: { ru: 'Ничего не нашли', uz: 'Hech narsa topilmadi', en: 'Nothing found' },
  emptyText: {
    ru: 'Попробуйте другой запрос или сбросьте фильтр.',
    uz: "Boshqa so'rov bilan urinib ko'ring yoki filtrni tozalang.",
    en: 'Try another query or reset the filter.',
  },
  emptyCta: { ru: 'Показать всё', uz: "Hammasini ko'rsatish", en: 'Show all' },

  storyKicker: { ru: 'ART Store и авторы', uz: 'ART Store va ijodkorlar', en: 'ART Store & artists' },
  storyTitle1: { ru: 'Мы не ищем', uz: 'Biz dekor', en: "We don't look for" },
  storyTitle2: { ru: 'декор. Мы ищем', uz: 'izlamaymiz. Biz', en: 'decor. We look for' },
  storyTitle3: { ru: 'новый взгляд.', uz: 'yangi nigoh izlaymiz.', en: 'a new vision.' },
  storyText: {
    ru: 'Знакомимся с художниками в их мастерских, отбираем работы и помогаем им найти своего зрителя. Покупая в ART Store, вы поддерживаете живую арт-сцену региона.',
    uz: "Ijodkorlar bilan ustaxonalarida tanishamiz, asarlarni tanlaymiz va ularga o'z tomoshabinini topishga yordam beramiz. ART Store'dan xarid qilib, mintaqaning jonli san'at muhitini qo'llab-quvvatlaysiz.",
    en: "We meet artists in their studios, select works and help them find their audience. Buying from ART Store supports the region's living art scene.",
  },
  storyLink: { ru: 'Стать автором ART Store', uz: "ART Store ijodkori bo'lish", en: 'Become an ART Store artist' },
  storyCaption: { ru: 'Студия автора · Ташкент', uz: 'Ijodkor ustaxonasi · Toshkent', en: "Artist's studio · Tashkent" },
  storyImgAlt: { ru: 'Художник за работой в студии', uz: 'Ustaxonada ishlayotgan ijodkor', en: 'Artist at work in the studio' },

  // Сервис — БЕЗ обещаний доставки (не реализована и не бесплатная)
  srv1Title: { ru: 'Поможем выбрать', uz: 'Tanlashga yordam beramiz', en: 'Help you choose' },
  srv1Text: {
    ru: 'Пришлите фото интерьера — куратор подберёт работы по масштабу и настроению.',
    uz: 'Interyer suratini yuboring — kurator masshtab va kayfiyatga mos asarlarni tanlab beradi.',
    en: 'Send a photo of your interior — the curator will match works by scale and mood.',
  },
  srv2Title: { ru: 'Получение и оплата', uz: "Olish va to'lov", en: 'Pickup & payment' },
  srv2Text: {
    ru: 'Самовывоз из шоурума в Parking Mall. Условия доставки и оплаты куратор согласует с вами индивидуально.',
    uz: "Parking Mall shourumidan olib ketish. Yetkazish va to'lov shartlarini kurator siz bilan alohida kelishadi.",
    en: 'Pickup from our Parking Mall showroom. Delivery and payment terms are arranged individually by the curator.',
  },
  srv3Title: { ru: 'Оформим пространство', uz: 'Makonni bezatamiz', en: 'Style your space' },
  srv3Text: {
    ru: 'Примерим работу в интерьере, подберём раму и найдём идеальную высоту.',
    uz: "Asarni interyerda sinab ko'ramiz, romka tanlaymiz va ideal balandlikni topamiz.",
    en: "We'll try the work in your interior, pick a frame and find the perfect height.",
  },

  ctaKicker: { ru: 'Letters from ART Store', uz: 'Letters from ART Store', en: 'Letters from ART Store' },
  ctaTitle1: { ru: 'Новые имена.', uz: 'Yangi nomlar.', en: 'New names.' },
  ctaTitle2: { ru: 'Сильные работы.', uz: 'Kuchli asarlar.', en: 'Strong works.' },
  ctaText: {
    ru: 'Письмо раз в месяц о том, что мы нашли в мастерских и галереях.',
    uz: 'Oyda bir marta — ustaxonalar va galereyalarda topganlarimiz haqida xat.',
    en: 'A letter once a month about what we found in studios and galleries.',
  },
  ctaEmailPh: { ru: 'Ваш email', uz: 'Email manzilingiz', en: 'Your email' },
  ctaSubscribe: { ru: 'Подписаться', uz: "Obuna bo'lish", en: 'Subscribe' },
  ctaToast: { ru: 'Вы в списке. Первое письмо уже в пути.', uz: "Siz ro'yxatdasiz. Birinchi xat yo'lda.", en: "You're on the list. The first letter is on its way." },

  footTag1: { ru: 'Искусство и редкие', uz: 'Hayot uchun san’at', en: 'Art and rare objects' },
  footTag2: { ru: 'предметы для жизни.', uz: 'va noyob buyumlar.', en: 'for living.' },
  footCatalog: { ru: 'Каталог', uz: 'Katalog', en: 'Catalog' },
  footAbout: { ru: 'О нас', uz: 'Biz haqimizda', en: 'About' },
  footContacts: { ru: 'Контакты', uz: 'Kontaktlar', en: 'Contacts' },
  footNote: { ru: 'Оригинальные работы · сертификат подлинности', uz: 'Asl asarlar · haqiqiylik sertifikati', en: 'Original works · certificate of authenticity' },

  cartChoice: { ru: 'Ваш выбор', uz: 'Sizning tanlovingiz', en: 'Your selection' },
  cartTitle: { ru: 'Корзина', uz: 'Savat', en: 'Cart' },
  checkoutTitle: { ru: 'Оформление', uz: 'Rasmiylashtirish', en: 'Checkout' },
  cartEmptyTitle: { ru: 'Здесь пока тихо', uz: "Hozircha bo'sh", en: "It's quiet here" },
  cartEmptyText: {
    ru: 'Добавьте работы, которые хочется рассматривать каждый день.',
    uz: "Har kuni tomosha qilgingiz keladigan asarlarni qo'shing.",
    en: "Add works you'll want to look at every day.",
  },
  cartEmptyCta: { ru: 'К коллекции', uz: 'Kolleksiyaga', en: 'To the collection' },
  cartTotal: { ru: 'Итого', uz: 'Jami', en: 'Total' },
  cartNote: {
    ru: 'Получение и оплату согласует куратор после заявки.',
    uz: "Olish va to'lovni kurator ariza qabul qilingach kelishadi.",
    en: 'Pickup and payment are arranged by the curator after your request.',
  },
  cartCheckout: { ru: 'Оформить заказ', uz: 'Buyurtma berish', en: 'Place order' },

  coBack: { ru: '← Назад к корзине', uz: '← Savatga qaytish', en: '← Back to cart' },
  coLead: {
    ru: 'Оставьте контакты. Куратор свяжется с вами, подтвердит наличие и поможет с получением.',
    uz: "Kontaktlaringizni qoldiring. Kurator siz bilan bog'lanadi, mavjudligini tasdiqlaydi va olishga yordam beradi.",
    en: 'Leave your contacts. The curator will call you, confirm availability and help with pickup.',
  },
  coName: { ru: 'Имя', uz: 'Ism', en: 'Name' },
  coNamePh: { ru: 'Как к вам обращаться', uz: 'Sizga qanday murojaat qilamiz', en: 'What should we call you' },
  coPhone: { ru: 'Телефон', uz: 'Telefon', en: 'Phone' },
  coComment: { ru: 'Комментарий', uz: 'Izoh', en: 'Comment' },
  coCommentPh: { ru: 'Удобное время звонка или вопрос', uz: "Qo'ng'iroq uchun qulay vaqt yoki savol", en: 'Convenient time to call or a question' },
  coDue: { ru: 'К оплате', uz: "To'lovga", en: 'Total due' },
  coPayNote: {
    ru: 'Оплата — по договорённости с куратором. Онлайн-оплаты пока нет.',
    uz: "To'lov — kurator bilan kelishuv asosida. Onlayn to'lov hozircha yo'q.",
    en: 'Payment is arranged with the curator. Online payment is not available yet.',
  },
  coSubmit: { ru: 'Отправить заявку', uz: 'Ariza yuborish', en: 'Send request' },
  coSending: { ru: 'Отправляем…', uz: 'Yuborilmoqda…', en: 'Sending…' },
  coError: {
    ru: 'Не удалось отправить заявку. Позвоните нам: +998 90 000 00 00',
    uz: "Arizani yuborib bo'lmadi. Bizga qo'ng'iroq qiling: +998 90 000 00 00",
    en: "Couldn't send the request. Call us: +998 90 000 00 00",
  },

  okAccepted: { ru: 'Заявка принята', uz: 'Ariza qabul qilindi', en: 'Request received' },
  okTitle: { ru: 'Скоро свяжемся с вами.', uz: "Tez orada bog'lanamiz.", en: "We'll be in touch soon." },
  okText: {
    ru: 'Куратор подтвердит наличие и согласует получение и оплату.',
    uz: "Kurator mavjudligini tasdiqlaydi, olish va to'lovni kelishadi.",
    en: 'The curator will confirm availability and arrange pickup and payment.',
  },
  okBack: { ru: 'Вернуться в магазин', uz: "Do'konga qaytish", en: 'Back to the store' },

  mTech: { ru: 'Техника', uz: 'Texnika', en: 'Technique' },
  mSize: { ru: 'Размер', uz: "O'lchami", en: 'Size' },
  mAvail: { ru: 'Наличие', uz: 'Mavjudligi', en: 'Availability' },
  mPcs: { ru: 'шт.', uz: 'dona', en: 'pcs' },
  mOnOrder: { ru: 'Под заказ', uz: 'Buyurtma asosida', en: 'Made to order' },
  mAdd: { ru: 'Добавить в корзину', uz: "Savatga qo'shish", en: 'Add to cart' },
  mDesc: {
    ru: 'Работа с тихой, но уверенной энергией. Она не спорит с пространством, а собирает его вокруг себя.',
    uz: "Sokin, ammo ishonchli energiyaga ega asar. U makon bilan bahslashmaydi — uni o'z atrofida jamlaydi.",
    en: "A work with quiet, confident energy. It doesn't argue with the space — it gathers it around itself.",
  },

  // Интро-заставка
  inTop: { ru: 'Ташкент · Узбекистан', uz: "Toshkent · O'zbekiston", en: 'Tashkent · Uzbekistan' },
  inSkip: { ru: 'Пропустить', uz: "O'tkazib yuborish", en: 'Skip' },
  inSign: { ru: 'Артефакты · искусство · редкие истории', uz: 'Artefaktlar · san’at · noyob hikoyalar', en: 'Artifacts · art · rare stories' },
  inArt1: { ru: 'Лазурная керамика', uz: 'Lazur sopol', en: 'Azure ceramics' },
  inEra1: { ru: 'XII–XIV вв.', uz: 'XII–XIV asrlar', en: '12th–14th c.' },
  inArt2: { ru: 'Бронзовый кумган', uz: "Bronza kumg'on", en: 'Bronze ewer' },
  inEra2: { ru: 'Шёлковый путь', uz: "Ipak yo'li", en: 'Silk Road' },
  inArt3: { ru: 'Серебро и сердолик', uz: 'Kumush va aqiq', en: 'Silver & carnelian' },
  inEra3: { ru: 'XIX век', uz: 'XIX asr', en: '19th century' },

  aMenu: { ru: 'Открыть меню', uz: 'Menyuni ochish', en: 'Open menu' },
  aClose: { ru: 'Закрыть', uz: 'Yopish', en: 'Close' },
  aSearch: { ru: 'Открыть поиск', uz: 'Qidiruvni ochish', en: 'Open search' },
  aCart: { ru: 'Открыть корзину', uz: 'Savatni ochish', en: 'Open cart' },

  currency: { ru: 'сум', uz: "so'm", en: 'UZS' },
};

export function getStoreLang() {
  try {
    const saved = localStorage.getItem(STORE_LANG_KEY);
    if (STORE_LANGS.includes(saved)) return saved;
  } catch { /* noop */ }
  return 'ru';
}

export function makeStoreT(lang) {
  const l = STORE_LANGS.includes(lang) ? lang : 'ru';
  return (key, vars) => {
    let s = T[key]?.[l] ?? T[key]?.ru ?? key;
    if (vars) Object.entries(vars).forEach(([k, v]) => { s = s.replace(`{${k}}`, v); });
    return s;
  };
}
