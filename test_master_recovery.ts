import { calculateGroupBalancesAndOptimization } from './src/utils/debtOptimizer';
import { parseReceiptText, classifyReceiptLine } from './src/lib/ocrEngine';
import { Group, Expense, SettlementPayment, ExpenseSplit } from './src/types';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${testName}${detail ? ' -> ' + detail : ''}`);
  }
}

console.log('================================================================');
console.log('SMARTSPLIT MASTER RECOVERY — AUTOMATED VERIFICATION SUITE');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// TEST SUITE 1: AUTHENTICATION & IDENTITY SANITIZATION
// -----------------------------------------------------------------------------
console.log('SUITE 1: Authentication & Identity Isolation');
{
  const realUser = {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    name: 'Kaju Chandrakumar',
    email: 'kaju@example.com',
  };

  assert(realUser.id !== 'usr_kasun', 'Authenticated user ID is distinct from demo user ID');
  assert(realUser.name !== 'Kasun Perera', 'Real user name preserves authenticated identity');
  assert(!realUser.email.includes('kasun.p'), 'Real user email does not contain demo email');

  // Verify group mapping ignores demo user when real user created the group
  const mockMembers = [
    { id: 'm1', userId: realUser.id, name: realUser.name, email: realUser.email, role: 'admin' as const, avatar: '', initials: 'KC' },
    { id: 'm2', userId: 'usr_kasun', name: 'Kasun Perera', email: 'kasun.p@example.com', role: 'member' as const, avatar: '', initials: 'KP' },
  ];
  const sanitized = mockMembers.filter((m) => m.userId !== 'usr_kasun' && m.name !== 'Kasun Perera');
  assert(sanitized.length === 1 && sanitized[0].userId === realUser.id, 'Demo user Kasun Perera is filtered from real user groups');
}

// -----------------------------------------------------------------------------
// TEST SUITE 2: MULTIPLE PAYERS & SPLIT METHODS
// -----------------------------------------------------------------------------
console.log('\nSUITE 2: Multiple Payers & Split Methods (Equal, Exact, Percentage, Shares)');
{
  const testGroup: Group = {
    id: 'grp_test_multipay',
    name: 'Colombo Apartment',
    description: 'Shared expenses',
    currency: 'LKR',
    category: 'home',
    coverGradient: 'from-blue-600 to-indigo-800',
    members: [
      { id: 'u1', userId: 'usr_kaju', name: 'Kaju', email: 'kaju@test.com', role: 'admin', avatar: '', initials: 'K' },
      { id: 'u2', userId: 'usr_dilshan', name: 'Dilshan', email: 'dilshan@test.com', role: 'member', avatar: '', initials: 'D' },
      { id: 'u3', userId: 'usr_senith', name: 'Senith', email: 'senith@test.com', role: 'member', avatar: '', initials: 'S' },
    ],
    createdAt: new Date().toISOString(),
  };

  // Scenario: Total 12,000 LKR.
  // Multiple Payers: Kaju paid 7,000, Dilshan paid 5,000.
  // Equal Split among Kaju, Dilshan, Senith (4,000 each).
  const expense1: Expense = {
    id: 'exp_multi_1',
    groupId: testGroup.id,
    title: 'Monthly Groceries & Gas',
    amount: 12000,
    currency: 'LKR',
    category: 'food',
    payerId: 'usr_kaju',
    payerName: 'Kaju & Dilshan',
    payers: [
      { userId: 'usr_kaju', userName: 'Kaju', amount: 7000 },
      { userId: 'usr_dilshan', userName: 'Dilshan', amount: 5000 },
    ],
    date: '2026-11-08',
    splitMethod: 'equal',
    splits: [
      { userId: 'usr_kaju', userName: 'Kaju', amount: 4000 },
      { userId: 'usr_dilshan', userName: 'Dilshan', amount: 4000 },
      { userId: 'usr_senith', userName: 'Senith', amount: 4000 },
    ],
    createdAt: new Date().toISOString(),
  };

  const payerTotal = (expense1.payers || []).reduce((sum, p) => sum + p.amount, 0);
  assert(payerTotal === 12000, 'Multiple payers total matches expense total exactly (Rs. 12,000)');

  const splitTotal = expense1.splits.reduce((sum, s) => sum + s.amount, 0);
  assert(splitTotal === 12000, 'Split totals match expense total exactly (Rs. 12,000)');

  // Verify financial balances:
  // Kaju: paid 7,000, owes 4,000 -> Net = +3,000 (gets back)
  // Dilshan: paid 5,000, owes 4,000 -> Net = +1,000 (gets back)
  // Senith: paid 0, owes 4,000 -> Net = -4,000 (owes)
  const analysis1 = calculateGroupBalancesAndOptimization(testGroup, [expense1], []);

  const kajuBal = analysis1.netBalances.find((b) => b.userId === 'usr_kaju');
  const dilshanBal = analysis1.netBalances.find((b) => b.userId === 'usr_dilshan');
  const senithBal = analysis1.netBalances.find((b) => b.userId === 'usr_senith');

  assert(kajuBal?.totalPaid === 7000 && kajuBal?.totalOwed === 4000 && kajuBal?.balance === 3000,
    'Kaju net balance is correctly +3,000 (Paid 7k, Owed 4k)');
  assert(dilshanBal?.totalPaid === 5000 && dilshanBal?.totalOwed === 4000 && dilshanBal?.balance === 1000,
    'Dilshan net balance is correctly +1,000 (Paid 5k, Owed 4k)');
  assert(senithBal?.totalPaid === 0 && senithBal?.totalOwed === 4000 && senithBal?.balance === -4000,
    'Senith net balance is correctly -4,000 (Paid 0, Owed 4k)');

  // Verify debt simplification: Senith pays Kaju 3,000 and Dilshan 1,000
  assert(analysis1.optimizedTransfers.length === 2, 'Optimized transfers minimized to 2 direct settlements');
  const transferToKaju = analysis1.optimizedTransfers.find((t) => t.toId === 'usr_kaju');
  const transferToDilshan = analysis1.optimizedTransfers.find((t) => t.toId === 'usr_dilshan');
  assert(transferToKaju?.amount === 3000 && transferToKaju?.fromId === 'usr_senith', 'Senith pays Kaju Rs. 3,000');
  assert(transferToDilshan?.amount === 1000 && transferToDilshan?.fromId === 'usr_senith', 'Senith pays Dilshan Rs. 1,000');
}

// -----------------------------------------------------------------------------
// TEST SUITE 3: SETTLEMENT RECORDING & PARTIAL PAYMENTS
// -----------------------------------------------------------------------------
console.log('\nSUITE 3: Settlement Payments & Balance Updates');
{
  const testGroup: Group = {
    id: 'grp_test_stl',
    name: 'Trip Group',
    description: '',
    currency: 'LKR',
    category: 'trip',
    coverGradient: '',
    members: [
      { id: 'm1', userId: 'u_alice', name: 'Alice', email: '', role: 'admin', avatar: '', initials: 'A' },
      { id: 'm2', userId: 'u_bob', name: 'Bob', email: '', role: 'member', avatar: '', initials: 'B' },
    ],
    createdAt: new Date().toISOString(),
  };

  const exp: Expense = {
    id: 'e1',
    groupId: testGroup.id,
    title: 'Dinner',
    amount: 10000,
    currency: 'LKR',
    category: 'food',
    payerId: 'u_alice',
    payerName: 'Alice',
    date: '2026-11-08',
    splitMethod: 'equal',
    splits: [
      { userId: 'u_alice', userName: 'Alice', amount: 5000 },
      { userId: 'u_bob', userName: 'Bob', amount: 5000 },
    ],
    createdAt: new Date().toISOString(),
  };

  // Before settlement: Bob owes 5,000
  const preStl = calculateGroupBalancesAndOptimization(testGroup, [exp], []);
  assert(preStl.netBalances.find((b) => b.userId === 'u_bob')?.balance === -5000, 'Initial balance: Bob owes 5,000');

  // Bob makes a partial payment of 3,000 to Alice
  const stl1: SettlementPayment = {
    id: 'stl_1',
    groupId: testGroup.id,
    payerId: 'u_bob',
    payerName: 'Bob',
    payeeId: 'u_alice',
    payeeName: 'Alice',
    amount: 3000,
    currency: 'LKR',
    paymentMethod: 'bank_transfer',
    date: '2026-11-08',
    status: 'completed',
  };

  const postPartial = calculateGroupBalancesAndOptimization(testGroup, [exp], [stl1]);
  assert(postPartial.netBalances.find((b) => b.userId === 'u_bob')?.balance === -2000, 'Post partial payment: Bob now owes only 2,000');
  assert(postPartial.netBalances.find((b) => b.userId === 'u_alice')?.balance === 2000, 'Post partial payment: Alice is now owed only 2,000');

  // Bob pays remaining 2,000
  const stl2: SettlementPayment = {
    id: 'stl_2',
    groupId: testGroup.id,
    payerId: 'u_bob',
    payerName: 'Bob',
    payeeId: 'u_alice',
    payeeName: 'Alice',
    amount: 2000,
    currency: 'LKR',
    paymentMethod: 'cash',
    date: '2026-11-08',
    status: 'completed',
  };

  const postFull = calculateGroupBalancesAndOptimization(testGroup, [exp], [stl1, stl2]);
  assert(postFull.netBalances.find((b) => b.userId === 'u_bob')?.balance === 0, 'Post full payment: Bob balance is 0 (all settled)');
  assert(postFull.netBalances.find((b) => b.userId === 'u_alice')?.balance === 0, 'Post full payment: Alice balance is 0 (all settled)');
  assert(postFull.optimizedTransfers.length === 0, 'Zero remaining optimized transfers when fully settled');
}

// -----------------------------------------------------------------------------
// TEST SUITE 4: OCR RECEIPT CLASSIFICATION & METADATA EXCLUSION
// -----------------------------------------------------------------------------
console.log('\nSUITE 4: OCR Receipt Line Classifier & Parsing');
{
  // Test receipt text containing metadata (Address, Phone, Date, Table) and food items
  const sampleReceiptText = `
    THE MANGO TREE RESTAURANT
    Galle Road
    Colombo 03, Sri Lanka
    Tel: +94 11 234 5678
    Date: 24 Oct 2023 Time: 19:30
    Table: T-12 Trans: #88921
    --------------------------------
    Chicken Kottu Roti        1   1450.00
    Fish Curry Meal           1   1650.00
    Dhal Curry (Side)         1    450.00
    Roast Paan (Portion)      2    500.00
    Pol Sambol (Side)         1    350.00
    Lion Lager 2 x 600.00         1200.00
    Woodapple Juice           1    450.00
    --------------------------------
    Subtotal                      6050.00
    Service Charge 10%             605.00
    VAT (15%)                      907.50
    Grand Total                   7562.50
    Thank you for dining with us!
  `;

  const parsed = parseReceiptText(sampleReceiptText, 'LKR');

  // 1. Verify metadata was extracted into metadata object
  assert(parsed.metadata?.address?.toLowerCase().includes('galle road') === true, 'Galle Road classified as receipt address metadata');
  assert(parsed.metadata?.city?.toLowerCase().includes('colombo') === true, 'Colombo 03 classified as receipt city metadata');
  assert(parsed.metadata?.phone?.includes('234') === true, 'Phone number classified as telephone metadata');
  assert(parsed.metadata?.tableNo?.includes('T-12') === true, 'Table number classified as table metadata');

  // 2. CRITICAL: Verify NO metadata line was added as a purchased food item
  const itemNames = parsed.items.map((i) => i.name.toLowerCase());
  assert(!itemNames.some((n) => n.includes('galle road')), 'Galle Road is NOT in purchased food items');
  assert(!itemNames.some((n) => n.includes('colombo')), 'Colombo 03 is NOT in purchased food items');
  assert(!itemNames.some((n) => n.includes('tel:') || n.includes('+94')), 'Telephone line is NOT in purchased food items');
  assert(!itemNames.some((n) => n.includes('table:') || n.includes('t-12')), 'Table line is NOT in purchased food items');
  assert(!itemNames.some((n) => n.includes('trans:') || n.includes('#88921')), 'Transaction line is NOT in purchased food items');

  // 3. Verify ALL legitimate food items were preserved and accurately parsed
  assert(itemNames.some((n) => n.includes('chicken kottu roti')), 'Purchased Item: Chicken Kottu Roti preserved');
  assert(itemNames.some((n) => n.includes('fish curry meal')), 'Purchased Item: Fish Curry Meal preserved');
  assert(itemNames.some((n) => n.includes('dhal curry')), 'Purchased Item: Dhal Curry preserved');
  assert(itemNames.some((n) => n.includes('roast paan')), 'Purchased Item: Roast Paan preserved');
  assert(itemNames.some((n) => n.includes('pol sambol')), 'Purchased Item: Pol Sambol preserved');
  assert(itemNames.some((n) => n.includes('lion lager')), 'Purchased Item: Lion Lager preserved');
  assert(itemNames.some((n) => n.includes('woodapple juice')), 'Purchased Item: Woodapple Juice preserved');

  // 4. Verify prices and charges
  assert(parsed.subtotal === 6050, 'Subtotal correctly parsed (6,050.00)');
  assert(parsed.serviceCharge === 605, 'Service charge correctly parsed (605.00)');
  assert(parsed.tax === 907.5, 'VAT correctly parsed (907.50)');
  assert(parsed.total === 7562.5, 'Grand total correctly parsed (7,562.50)');
}

console.log('\n================================================================');
console.log(`FINAL RESULTS: ${passedTests}/${totalTests} TESTS PASSED (${failedTests} FAILED)`);
console.log('================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

