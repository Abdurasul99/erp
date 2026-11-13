// Тексты витрины /shop/:slug — RU, UZ (латиница), EN. Язык запоминается на устройстве.
export const SHOP_LANGS = ['ru', 'uz', 'en'];
export const SHOP_LANG_KEY = 'shop_lang';

const T = {
  ru: {
    search: 'Поиск товаров', all: 'Все товары', items: n => `${n} ${plural(n, 'товар', 'товара', 'товаров')}`,
    sortName: 'По названию', sortCheap: 'Сначала дешевле', sortExpensive: 'Сначала дороже', sort: 'Сортировка',
    inStock: 'В наличии', left: n => `Осталось ${n} шт`, photoSoon: 'Фото скоро', toCart: 'В корзину', inCart: 'В корзине',
    add: 'Добавить в корзину', qty: 'Количество', remove: 'Убрать', cart: 'Корзина', cartEmpty: 'Корзина пуста',
    cartEmptyHint: 'Добавьте товары из каталога — мы перезвоним и подтвердим заказ.', total: 'Итого',
    yourName: 'Ваше имя', yourPhone: 'Телефон', comment: 'Комментарий (необязательно)', commentPh: 'Удобное время звонка, вопросы',
    send: 'Отправить заказ', sending: 'Отправляем…', needName: 'Укажите имя', needPhone: 'Укажите телефон — не меньше 9 цифр',
    payNote: 'Оплата — при получении. Онлайн-оплаты нет: мы перезвоним, подтвердим наличие и время.',
    doneTitle: n => `Заказ №${n} принят`, doneText: p => `Мы перезвоним по номеру ${p} и подтвердим заказ.`, doneClose: 'Продолжить покупки',
    trustOrder: 'Заказ онлайн — перезвоним и подтвердим', trustPickup: 'Самовывоз', trustPay: 'Оплата при получении',
    notFound: 'Магазин не найден', notFoundText: 'Проверьте адрес ссылки.', loadError: 'Не удалось загрузить каталог', retry: 'Повторить',
    nothing: 'Ничего не нашлось', nothingHint: 'Попробуйте другое слово или категорию.', close: 'Закрыть', back: 'Назад',
    sendError: 'Не удалось отправить заказ. Попробуйте ещё раз.', phone: 'Телефон', hours: 'Часы работы', address: 'Адрес',
    reduced: 'Количество уменьшено — столько есть на складе', poweredBy: 'Работает на Wave', currency: 'сум', openCart: 'Открыть корзину',
    perPiece: 'за шт', category: 'Категория',
  },
  uz: {
    search: 'Mahsulot qidirish', all: 'Barcha mahsulotlar', items: n => `${n} ta mahsulot`,
    sortName: 'Nomi bo‘yicha', sortCheap: 'Avval arzonlari', sortExpensive: 'Avval qimmatlari', sort: 'Saralash',
    inStock: 'Mavjud', left: n => `${n} dona qoldi`, photoSoon: 'Rasm tez orada', toCart: 'Savatga', inCart: 'Savatda',
    add: 'Savatga qo‘shish', qty: 'Soni', remove: 'Olib tashlash', cart: 'Savat', cartEmpty: 'Savat bo‘sh',
    cartEmptyHint: 'Katalogdan mahsulot qo‘shing — biz qo‘ng‘iroq qilib buyurtmani tasdiqlaymiz.', total: 'Jami',
    yourName: 'Ismingiz', yourPhone: 'Telefon', comment: 'Izoh (shart emas)', commentPh: 'Qo‘ng‘iroq uchun qulay vaqt, savollar',
    send: 'Buyurtma yuborish', sending: 'Yuborilmoqda…', needName: 'Ismingizni yozing', needPhone: 'Telefon raqamini yozing — kamida 9 ta raqam',
    payNote: 'To‘lov — qabul qilganda. Onlayn to‘lov yo‘q: biz qo‘ng‘iroq qilib, mavjudligi va vaqtini tasdiqlaymiz.',
    doneTitle: n => `№${n} buyurtma qabul qilindi`, doneText: p => `${p} raqamiga qo‘ng‘iroq qilib, buyurtmani tasdiqlaymiz.`, doneClose: 'Xaridni davom ettirish',
    trustOrder: 'Onlayn buyurtma — qo‘ng‘iroq qilib tasdiqlaymiz', trustPickup: 'Olib ketish', trustPay: 'Qabul qilganda to‘lov',
    notFound: 'Do‘kon topilmadi', notFoundText: 'Havola manzilini tekshiring.', loadError: 'Katalogni yuklab bo‘lmadi', retry: 'Qayta urinish',
    nothing: 'Hech narsa topilmadi', nothingHint: 'Boshqa so‘z yoki toifani sinab ko‘ring.', close: 'Yopish', back: 'Orqaga',
    sendError: 'Buyurtmani yuborib bo‘lmadi. Yana urinib ko‘ring.', phone: 'Telefon', hours: 'Ish vaqti', address: 'Manzil',
    reduced: 'Soni kamaytirildi — omborda shuncha bor', poweredBy: 'Wave asosida ishlaydi', currency: 'so‘m', openCart: 'Savatni ochish',
    perPiece: 'dona', category: 'Toifa',
  },
  en: {
    search: 'Search products', all: 'All products', items: n => `${n} ${n === 1 ? 'product' : 'products'}`,
    sortName: 'By name', sortCheap: 'Price: low to high', sortExpensive: 'Price: high to low', sort: 'Sort',
    inStock: 'In stock', left: n => `Only ${n} left`, photoSoon: 'Photo coming soon', toCart: 'Add', inCart: 'In cart',
    add: 'Add to cart', qty: 'Quantity', remove: 'Remove', cart: 'Cart', cartEmpty: 'Your cart is empty',
    cartEmptyHint: 'Add products from the catalog — we will call you to confirm the order.', total: 'Total',
    yourName: 'Your name', yourPhone: 'Phone', comment: 'Comment (optional)', commentPh: 'Best time to call, questions',
    send: 'Place order', sending: 'Sending…', needName: 'Enter your name', needPhone: 'Enter your phone — at least 9 digits',
    payNote: 'Pay on pickup. There is no online payment: we will call to confirm availability and time.',
    doneTitle: n => `Order #${n} received`, doneText: p => `We will call ${p} to confirm the order.`, doneClose: 'Continue shopping',
    trustOrder: 'Order online — we call to confirm', trustPickup: 'Pickup', trustPay: 'Pay on pickup',
    notFound: 'Shop not found', notFoundText: 'Please check the link.', loadError: 'Could not load the catalog', retry: 'Try again',
    nothing: 'Nothing found', nothingHint: 'Try another word or category.', close: 'Close', back: 'Back',
    sendError: 'Could not send the order. Please try again.', phone: 'Phone', hours: 'Opening hours', address: 'Address',
    reduced: 'Quantity reduced to what is in stock', poweredBy: 'Powered by Wave', currency: 'UZS', openCart: 'Open cart',
    perPiece: 'per item', category: 'Category',
  },
};

// Категории — общие названия Wave (RU в базе, UZ в базе); для EN — перевод известных
const CATEGORY_EN = {
  'Инструменты': 'Tools', 'Для кухни': 'Kitchen', 'Для дома': 'Home', 'Красота и здоровье': 'Beauty & health',
  'Для авто': 'Car', 'Свет и электроника': 'Lighting & electronics', 'Сад, дача, отдых': 'Garden & outdoors',
};

function plural(n, one, few, many) {
  const a = Math.abs(n) % 100; const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

export function getShopLang() {
  try { const l = localStorage.getItem(SHOP_LANG_KEY); return SHOP_LANGS.includes(l) ? l : 'ru'; } catch { return 'ru'; }
}
export function makeShopT(lang) {
  const d = T[lang] || T.ru;
  return (key, arg) => { const v = d[key] ?? T.ru[key] ?? key; return typeof v === 'function' ? v(arg) : v; };
}
export function categoryLabel(cat, lang) {
  if (!cat) return '';
  if (lang === 'uz') return cat.name_uz || cat.name_ru;
  if (lang === 'en') return CATEGORY_EN[cat.name_ru] || cat.name_ru;
  return cat.name_ru;
}
export const productName = (p, lang) => (lang === 'uz' ? p.name_uz || p.name_ru : p.name_ru);
