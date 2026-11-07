import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const OUT = path.join(process.cwd(), "public", "samples");

const receipts = [
  {
    file: "receipt-01-harbor-pine.png",
    merchant: "Harbor & Pine Grocery",
    address: "218 Alder Street, Portland, OR",
    date: "2026-09-12",
    time: "18:42",
    items: [
      ["Produce", "18.20"],
      ["Pantry staples", "31.22"],
      ["Household", "9.00"],
      ["Tax", "5.00"],
    ],
    total: "63.42",
    method: "VISA **** 4821",
    category: "Groceries",
  },
  {
    file: "receipt-02-nimbus-coffee.png",
    merchant: "Nimbus Coffee Roasters",
    address: "77 Quarry Lane, Portland, OR",
    date: "2026-09-04",
    time: "08:12",
    items: [
      ["Filter coffee", "3.25"],
      ["Almond croissant", "4.50"],
      ["Tax", "1.00"],
    ],
    total: "8.75",
    method: "VISA **** 4821",
    category: "Dining",
  },
  {
    file: "receipt-03-aurora-electronics.png",
    merchant: "Aurora Electronics",
    address: "1400 Market Way, Seattle, WA",
    date: "2026-09-18",
    time: "15:07",
    items: [
      ["Studio headphones", "1,799.00"],
      ["Protective case", "75.00"],
      ["Tax", "25.00"],
    ],
    total: "1,899.00",
    method: "VISA **** 4821",
    category: "Shopping",
  },
  {
    file: "receipt-04-streamwave.png",
    merchant: "StreamWave",
    address: "online · streamwave.example",
    date: "2026-09-20",
    time: "06:00",
    items: [
      ["Monthly plan (price increase)", "24.99"],
    ],
    total: "24.99",
    method: "VISA **** 4821",
    category: "Subscriptions",
  },
  {
    file: "receipt-05-corner-hardware.png",
    merchant: "Corner Hardware",
    address: "9 Beacon Road, Portland, OR",
    date: "2026-09-24",
    time: "11:26",
    items: [
      ["Shelving brackets", "21.50"],
      ["Wood screws", "4.80"],
      ["Tax", "1.00"],
    ],
    total: "27.30",
    method: "VISA **** 4821",
    category: "Shopping",
  },
];

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function barcode(seedText, y) {
  let hash = 2166136261;
  for (const char of seedText) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  const bars = [];
  let x = 90;
  for (let index = 0; index < 52; index++) {
    const width = ((hash >>> (index % 24)) & 3) + 1;
    bars.push(
      `<rect x="${x}" y="${y}" width="${width}" height="64" fill="#1a1a1a" />`,
    );
    x += width + (((hash >>> (index % 13)) & 1) ? 4 : 3);
  }
  return bars.join("");
}

function receiptSvg(receipt) {
  const itemStart = 252;
  const itemStep = 34;
  const totalY = itemStart + receipt.items.length * itemStep + 28;
  const paidY = totalY + 48;
  const categoryY = paidY + 36;
  const separatorY = categoryY + 42;
  const barcodeY = separatorY + 54;
  const footerY = barcodeY + 150;
  const height = footerY + 54;

  const itemLines = receipt.items
    .map(
      ([label, amount], index) =>
        `<text x="80" y="${itemStart + index * itemStep}" font-size="20" fill="#222">${escapeXml(
          label,
        )}</text><text x="600" y="${itemStart + index * itemStep}" font-size="20" fill="#222" text-anchor="end">${escapeXml(
          amount,
        )}</text>`,
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="${height}" viewBox="0 0 760 ${height}">
  <defs>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" result="noise"/>
      <feColorMatrix in="noise" type="saturate" values="0" result="mono"/>
      <feComponentTransfer in="mono" result="faint">
        <feFuncA type="linear" slope="0.045"/>
      </feComponentTransfer>
      <feBlend in="SourceGraphic" in2="faint" mode="multiply"/>
    </filter>
  </defs>
  <rect width="760" height="${height}" fill="#fbf8f0" filter="url(#grain)"/>
  <rect x="0" y="0" width="760" height="14" fill="#16352a" opacity="0.9"/>
  <text x="380" y="88" text-anchor="middle" font-family="Courier New, monospace" font-size="28" font-weight="700" fill="#14201a">${escapeXml(
    receipt.merchant,
  )}</text>
  <text x="380" y="120" text-anchor="middle" font-family="Courier New, monospace" font-size="16" fill="#555">${escapeXml(
    receipt.address,
  )}</text>
  <text x="380" y="148" text-anchor="middle" font-family="Courier New, monospace" font-size="16" fill="#555">${escapeXml(
    receipt.date,
  )}  ·  ${escapeXml(receipt.time)}</text>
  <line x1="80" y1="178" x2="680" y2="178" stroke="#222" stroke-dasharray="5 5"/>
  <text x="80" y="210" font-family="Courier New, monospace" font-size="15" fill="#777">ITEM</text>
  <text x="600" y="210" text-anchor="end" font-family="Courier New, monospace" font-size="15" fill="#777">AMOUNT</text>
  <line x1="80" y1="222" x2="680" y2="222" stroke="#222" stroke-dasharray="5 5"/>
  ${itemLines}
  <line x1="80" y1="${totalY - 24}" x2="680" y2="${totalY - 24}" stroke="#222"/>
  <text x="80" y="${totalY}" font-family="Courier New, monospace" font-size="24" font-weight="700" fill="#14201a">TOTAL</text>
  <text x="600" y="${totalY}" text-anchor="end" font-family="Courier New, monospace" font-size="24" font-weight="700" fill="#14201a">${escapeXml(
    receipt.total,
  )}</text>
  <text x="80" y="${paidY}" font-family="Courier New, monospace" font-size="17" fill="#444">PAID WITH</text>
  <text x="600" y="${paidY}" text-anchor="end" font-family="Courier New, monospace" font-size="17" fill="#444">${escapeXml(
    receipt.method,
  )}</text>
  <text x="80" y="${categoryY}" font-family="Courier New, monospace" font-size="17" fill="#444">CATEGORY</text>
  <text x="600" y="${categoryY}" text-anchor="end" font-family="Courier New, monospace" font-size="17" fill="#444">${escapeXml(
    receipt.category,
  )}</text>
  <line x1="80" y1="${separatorY}" x2="680" y2="${separatorY}" stroke="#222" stroke-dasharray="5 5"/>
  <text x="380" y="${separatorY + 28}" text-anchor="middle" font-family="Courier New, monospace" font-size="14" fill="#777">THANK YOU · KEEP THIS RECEIPT</text>
  ${barcode(receipt.file, barcodeY)}
  <text x="380" y="${barcodeY + 96}" text-anchor="middle" font-family="Courier New, monospace" font-size="13" fill="#888">${escapeXml(
    receipt.file,
  )}</text>
  <g transform="translate(380 ${separatorY - 34}) rotate(-13)" opacity="0.1">
    <rect x="-300" y="-42" width="600" height="84" fill="none" stroke="#8a2b1d" stroke-width="5" rx="8"/>
    <text x="0" y="12" text-anchor="middle" font-family="Courier New, monospace" font-size="32" font-weight="700" fill="#8a2b1d" letter-spacing="4">FICTIONAL SAMPLE</text>
  </g>
  <text x="380" y="${height - 24}" text-anchor="middle" font-family="Courier New, monospace" font-size="12" fill="#aaa">Not a real receipt · sample data for Sealed Ledger</text>
</svg>`;
}

const statementRows = [
  ["2026-09-01", "", "Salary — Northwind Studio", "Northwind Studio", "4200.00", "USD", "Income"],
  ["2026-09-01", "", "Rent — Maple Court", "Maple Court Apartments", "-1850.00", "USD", "Housing"],
  ["2026-09-02", "09:14", "Groceries", "Harbor & Pine Grocery", "-63.42", "USD", "Groceries"],
  ["2026-09-03", "07:48", "Transit pass", "Metro Transit", "-32.00", "USD", "Transport"],
  ["2026-09-04", "08:12", "Coffee", "Nimbus Coffee Roasters", "-8.75", "USD", "Dining"],
  ["2026-09-05", "", "Electricity", "Cascade Power", "-94.10", "USD", "Utilities"],
  ["2026-09-06", "17:20", "Groceries", "Harbor & Pine Grocery", "-78.21", "USD", "Groceries"],
  ["2026-09-08", "08:03", "Coffee", "Nimbus Coffee Roasters", "-8.75", "USD", "Dining"],
  ["2026-09-09", "08:05", "Coffee", "Nimbus Coffee Roasters", "-8.75", "USD", "Dining"],
  ["2026-09-10", "06:00", "Streaming plan", "StreamWave", "-15.99", "USD", "Subscriptions"],
  ["2026-09-11", "13:37", "Notebook and pens", "Paper & Thread", "-42.50", "USD", "Shopping"],
  ["2026-09-12", "18:42", "Groceries", "Harbor & Pine Grocery", "-63.42", "USD", "Groceries"],
  ["2026-09-13", "02:13", "Late dinner", "Midnight Diner", "-68.40", "USD", "Dining"],
  ["2026-09-15", "19:02", "Ride home", "Lyft", "-24.80", "USD", "Transport"],
  ["2026-09-16", "11:11", "Pharmacy", "Brightside Pharmacy", "-36.20", "USD", "Health"],
  ["2026-09-18", "15:07", "Studio headphones", "Aurora Electronics", "-1899.00", "USD", "Shopping"],
  ["2026-09-20", "06:00", "Streaming plan", "StreamWave", "-24.99", "USD", "Subscriptions"],
  ["2026-09-21", "18:10", "Groceries", "Harbor & Pine Grocery", "-51.10", "USD", "Groceries"],
  ["2026-09-22", "08:22", "Coffee", "Nimbus Coffee Roasters", "-8.75", "USD", "Dining"],
  ["2026-09-23", "", "Savings transfer", "Savings Transfer", "-500.00", "USD", "Transfers"],
  ["2026-09-25", "07:50", "Transit pass", "Metro Transit", "-32.00", "USD", "Transport"],
  ["2026-09-27", "21:40", "Ryokan deposit", "Kyoto Ryokan", "-310.00", "USD", "Travel"],
  ["2026-09-28", "", "Electricity", "Cascade Power", "-88.40", "USD", "Utilities"],
  ["2026-09-30", "17:55", "Groceries", "Harbor & Pine Grocery", "-67.80", "USD", "Groceries"],
];

function statementCsv() {
  const header = "date,time,description,merchant,amount,currency,category_hint";
  const rows = statementRows.map((row) =>
    row
      .map((value) =>
        /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value,
      )
      .join(","),
  );
  return [header, ...rows].join("\n") + "\n";
}

async function main() {
  await mkdir(OUT, { recursive: true });

  for (const receipt of receipts) {
    const svg = receiptSvg(receipt);
    await sharp(Buffer.from(svg))
      .png({ compressionLevel: 9 })
      .toFile(path.join(OUT, receipt.file));
    console.log(`wrote ${receipt.file}`);
  }

  const csvFile = "bank-statement-2026-09.csv";
  await writeFile(path.join(OUT, csvFile), statementCsv(), "utf8");
  console.log(`wrote ${csvFile}`);

  const manifest = [
    {
      id: "statement",
      kind: "statement",
      title: "September 2026 bank statement",
      description:
        "24 fictional transactions with seeded duplicates, a price increase, and a late-night charge.",
      files: [csvFile],
    },
    {
      id: "receipts",
      kind: "receipts",
      title: "Five fictional receipts",
      description:
        "Grocery, coffee, electronics, subscription, and hardware receipts that reconcile with the statement.",
      files: receipts.map((receipt) => receipt.file),
    },
  ];

  await writeFile(
    path.join(OUT, "samples.json"),
    JSON.stringify(manifest, null, 2) + "\n",
    "utf8",
  );
  console.log("wrote samples.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
