// Mock data shared across tools.
export const PRODUCTS = [
  { id: 1, name: 'Бейсболка синяя', sku: '2008431230089', type: 'Одежда', brand: 'Nike',   stock: 44, unit: 'шт', buy: 80000,  sell: 150000, photo: '👕' },
  { id: 2, name: 'Брус 50×100',     sku: '2008427460009', type: 'Дерево', brand: 'Tashkent Wood', stock: 50, unit: 'м³', buy: 280000, sell: 420000, photo: '🪵' },
  { id: 3, name: 'Шахматы 40×40',   sku: '2008419560001', type: 'Игры',   brand: 'Karpov', stock: 8, unit: 'шт', buy: 180000, sell: 300000, photo: '♟️' },
  { id: 4, name: 'Йогоч ваза 45',   sku: '1780165137388', type: 'Декор',  brand: 'Local',  stock: 71, unit: 'шт', buy: 90000,  sell: 200000, photo: '🏺' },
  { id: 5, name: 'Пенал шкатулка',  sku: '1780165096735', type: 'Декор',  brand: 'Local',  stock: 54, unit: 'шт', buy: 65000,  sell: 200000, photo: '📦' },
  { id: 6, name: 'Latun shamdon',   sku: '2008424820002', type: 'Латунь', brand: 'Buxoro', stock: 0, unit: 'шт', buy: 350000, sell: 580000, photo: '🕯️' },
  { id: 7, name: 'Кожаный кошелёк', sku: '2008425100003', type: 'Кожа',   brand: 'Karven', stock: 23, unit: 'шт', buy: 120000, sell: 280000, photo: '👛' },
  { id: 8, name: 'Шёлковый платок', sku: '2008425200004', type: 'Одежда', brand: 'Atlas',  stock: 38, unit: 'шт', buy: 95000,  sell: 220000, photo: '🧣' },
  { id: 9, name: 'Керамическая тарелка', sku: '2008425300005', type: 'Керамика', brand: 'Rishtan', stock: 17, unit: 'шт', buy: 45000, sell: 110000, photo: '🍽️' },
  { id: 10, name: 'Подсвечник латунь',     sku: '2008425400006', type: 'Латунь',    brand: 'Buxoro',  stock: 12, unit: 'шт', buy: 220000, sell: 420000, photo: '🕯️' },
  { id: 11, name: 'Чапан мужской',          sku: '2008425500007', type: 'Одежда',    brand: 'Local',   stock: 7,  unit: 'шт', buy: 380000, sell: 650000, photo: '🧥' },
  { id: 12, name: 'Ваза для роз',            sku: '2008425600008', type: 'Декор',     brand: 'Local',   stock: 29, unit: 'шт', buy: 110000, sell: 230000, photo: '🌹' },
];

export const CLIENTS = [
  { id: 1, name: 'ООО «Меркурий»',     type: 'B2B', phone: '+998 71 200 11 22', ltv: 14200000, deals: 12, lastDate: '2026-05-14', status: 'active',   tag: 'VIP'      },
  { id: 2, name: 'Алишер Каримов',     type: 'B2C', phone: '+998 90 111 22 33', ltv: 3400000,  deals: 28, lastDate: '2026-05-28', status: 'active',   tag: 'Лояльный' },
  { id: 3, name: 'TashTrade LLC',      type: 'B2B', phone: '+998 71 300 44 55', ltv: 47800000, deals: 5,  lastDate: '2026-05-25', status: 'active',   tag: 'VIP'      },
  { id: 4, name: 'Дилшод Усманов',     type: 'B2C', phone: '+998 93 444 55 66', ltv: 820000,   deals: 4,  lastDate: '2026-03-03', status: 'sleeping', tag: 'Спящий'  },
  { id: 5, name: 'ЧП «Барс»',          type: 'B2B', phone: '+998 71 500 77 88', ltv: 8200000,  deals: 3,  lastDate: '2026-05-17', status: 'active',   tag: 'Новый'   },
  { id: 6, name: 'Малика Турсунова',   type: 'B2C', phone: '+998 99 888 99 00', ltv: 180000,   deals: 1,  lastDate: '2026-01-12', status: 'lost',     tag: 'Ушёл'    },
  { id: 7, name: 'Khorezm Mebel',      type: 'B2B', phone: '+998 62 200 33 44', ltv: 17800000, deals: 4,  lastDate: '2026-05-25', status: 'active',   tag: 'VIP'      },
  { id: 8, name: 'Бахтиёр Каримов',    type: 'B2C', phone: '+998 90 555 66 77', ltv: 2100000,  deals: 7,  lastDate: '2026-05-20', status: 'active',   tag: 'Лояльный' },
];

export const SUPPLIERS = [
  { id: 1, name: 'Tashkent Wood',   contact: 'Бахром К.',     phone: '+998 90 200 30 40', city: 'Ташкент',    debt: 8500000, deals: 24 },
  { id: 2, name: 'Karpov Games',    contact: 'Sergey Karpov', phone: '+998 71 333 44 55', city: 'Ташкент',    debt: 0,       deals: 12 },
  { id: 3, name: 'Buxoro Latun',    contact: 'Хасан А.',       phone: '+998 65 222 11 33', city: 'Бухара',     debt: 4200000, deals: 18 },
  { id: 4, name: 'Local Craft',     contact: 'Алишер Б.',      phone: '+998 90 777 88 99', city: 'Самарканд',  debt: 0,       deals: 31 },
  { id: 5, name: 'Tex Mart',        contact: 'Дилшод У.',      phone: '+998 71 555 66 77', city: 'Ташкент',    debt: 5800000, deals: 9  },
];

export const fmt = (n) => Number(n).toLocaleString('ru-RU');
export const today = () => new Date().toLocaleDateString('ru-RU');
