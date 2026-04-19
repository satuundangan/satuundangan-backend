const fs = require('fs');
const path = require('path');
const midtransClient = require('midtrans-client');

function loadEnvFile() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    return;
  }

  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function getArg(name, fallback) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  if (!match) {
    return fallback;
  }

  return match.slice(prefix.length);
}

async function main() {
  loadEnvFile();

  const serverKey =
    process.env.MERCHANT_SERVER_KEY || process.env.SERVER_KEY || '';
  const clientKey =
    process.env.MERCHANT_CLIENT_KEY || process.env.CLIENT_KEY || '';
  const envArg = getArg('env', process.env.MIDTRANS_SMOKE_ENV || '');
  const normalizedEnv = String(envArg || process.env.NODE_ENV || '')
    .trim()
    .toLowerCase();
  const isProduction =
    normalizedEnv === 'production' || normalizedEnv === 'prod';

  if (!serverKey || !clientKey) {
    throw new Error(
      'Missing Midtrans credentials. Set SERVER_KEY/CLIENT_KEY or MERCHANT_SERVER_KEY/MERCHANT_CLIENT_KEY.',
    );
  }

  if (isProduction && process.env.MIDTRANS_SMOKE_CONFIRM !== 'YES') {
    throw new Error(
      'Refusing to create a live Midtrans transaction. Set MIDTRANS_SMOKE_CONFIRM=YES after double-checking your production keys.',
    );
  }

  const amount = Number(getArg('amount', process.env.MIDTRANS_SMOKE_AMOUNT || '10000'));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be a positive number.');
  }

  const orderId = getArg(
    'order-id',
    `${isProduction ? 'PROD' : 'SANDBOX'}-SMOKE-${Date.now()}`,
  );
  const email = getArg(
    'email',
    process.env.MIDTRANS_SMOKE_EMAIL || 'smoke-test@satuundangan.id',
  );
  const name = getArg(
    'name',
    process.env.MIDTRANS_SMOKE_NAME || 'Smoke Test',
  );

  const snap = new midtransClient.Snap({
    isProduction,
    serverKey,
    clientKey,
  });

  const transaction = await snap.createTransaction({
    transaction_details: {
      order_id: orderId,
      gross_amount: amount,
    },
    customer_details: {
      first_name: name,
      email,
    },
    credit_card: {
      secure: true,
    },
    item_details: [
      {
        id: 'MIDTRANS-SMOKE',
        price: amount,
        quantity: 1,
        name: `Midtrans smoke test (${isProduction ? 'production' : 'sandbox'})`,
      },
    ],
  });

  console.log(JSON.stringify({
    ok: true,
    env: isProduction ? 'production' : 'sandbox',
    order_id: orderId,
    amount,
    token: transaction.token,
    redirect_url: transaction.redirect_url,
  }, null, 2));
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
