import { parseReceiptText } from './src/lib/ocrEngine.js';

const sampleReceipt = `
THE SPICE LOUNGE
124 Galle Road
Colombo 03, Sri Lanka
Tel: +94 11 234 5678
Date: 24 Oct 2023 19:42
Table: T-12   Server: Kamal
Receipt #: 45982
--------------------------------
Chicken Kottu Roti    1    1,450.00
Fish Curry Meal       1    1,850.00
Dhal Curry (Side)     1      450.00
Roast Paan (Portion)  2      400.00
Pol Sambol (Side)     1      350.00
Lion Lager            2    1,600.00
Woodapple Juice       1      550.00
--------------------------------
Sub Total                  6,650.00
Service Charge 10%           665.00
VAT / Tax                    250.00
Total                     7,565.00
--------------------------------
Thank You For Visiting!
`;

// Supermarket receipt test
const supermarketReceipt = `
KEELLS SUPERMARKET
No. 45 Havelock Road, Colombo 05
Tel: 011-2589000
VAT Reg: 10459281
Cashier: 04  Bill: K-88120
Date: 15/11/2023 14:22
---------------------------------------
Prima Bread Loaf        1        190.00
Kotmale Fresh Milk 1L   2        520.00
Munchee Chocolate Cream 3        840.00
Dilmah Premium Tea      1        650.00
Anchor Butter 227g      1        980.00
---------------------------------------
Total Items: 5
SUB TOTAL                      3,180.00
VAT (8%)                         254.40
GRAND TOTAL                    3,434.40
CASH TENDERED                  5,000.00
CHANGE                         1,565.60
---------------------------------------
Have a pleasant day!
`;

console.log('--- Test 1: Restaurant Receipt ---');
const r1 = parseReceiptText(sampleReceipt, 'LKR');
console.log('Merchant:', r1.merchant);
console.log('Metadata:', r1.metadata);
console.log('Items Count:', r1.items.length);
r1.items.forEach(i => console.log(`  - ${i.name} (qty: ${i.quantity}, unit: ${i.unitPrice}, total: ${i.totalPrice}, conf: ${i.confidence})`));
console.log('Subtotal:', r1.subtotal, 'Service:', r1.serviceCharge, 'Tax:', r1.tax, 'Total:', r1.total);

console.log('\n--- Test 2: Supermarket Receipt ---');
const r2 = parseReceiptText(supermarketReceipt, 'LKR');
console.log('Merchant:', r2.merchant);
console.log('Metadata:', r2.metadata);
console.log('Items Count:', r2.items.length);
r2.items.forEach(i => console.log(`  - ${i.name} (qty: ${i.quantity}, unit: ${i.unitPrice}, total: ${i.totalPrice}, conf: ${i.confidence})`));
console.log('Subtotal:', r2.subtotal, 'Service:', r2.serviceCharge, 'Tax:', r2.tax, 'Total:', r2.total);
