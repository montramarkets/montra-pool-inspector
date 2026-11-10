export const TOKEN = '0x063f7cc5339f92a5fd7baf3d22233044fda1f327';
const REGISTRY = '0xf1e2fa75422f889e565f3142bdbf60b28dce2aa7';
const RPC = 'https://rpc.montramarkets.xyz';
const ZERO = '0x' + '0'.repeat(40);
const word = n => BigInt(n).toString(16).padStart(64, '0');
const address = w => '0x' + w.slice(-40);
const integer = w => BigInt('0x' + w);
const words = data => data.slice(2).match(/.{64}/g) ?? [];

async function rpc(method, params = []) {
  const response = await fetch(RPC, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({jsonrpc: '2.0', id: 1, method, params}),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw Error('RPC returned HTTP ' + response.status);
  const body = await response.json();
  if (body.error) throw Error(body.error.message);
  return body.result;
}
const call = (to, data, block) => rpc('eth_call', [{to, data}, block]);
const key = name => Array.from(name, c => c.charCodeAt(0).toString(16)).join('').padEnd(64, '0');

async function asset(addr, block) {
  if (addr === ZERO) return {label: 'HYPE', decimals: 18, addr};
  const [decimalData, symbolData] = await Promise.all([
    call(addr, '0x313ce567', block),
    call(addr, '0x95d89b41', block).catch(() => '0x'),
  ]);
  const decimals = Number(BigInt(decimalData));
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) throw Error('Invalid token decimals');
  const encoded = words(symbolData);
  let label = addr.slice(0, 10) + '…';
  if (encoded.length === 1 || (encoded.length >= 3 && integer(encoded[0]) === 32n)) {
    const bytes = (encoded.length === 1 ? encoded[0] : encoded.slice(2).join('')).slice(0, 48);
    const decoded = new TextDecoder().decode(Uint8Array.from(bytes.match(/../g), x => parseInt(x, 16)));
    label = decoded.split('\0')[0] || label;
  }
  return {label, decimals, addr};
}

export async function inspect(input) {
  const token = input.trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(token)) throw Error('Enter a 40-digit Elysium contract address.');
  const [chain, block] = await Promise.all([rpc('eth_chainId'), rpc('eth_blockNumber')]);
  if (BigInt(chain) !== 99901n) throw Error('Unexpected RPC chain.');
  const resolve = async name => address(await call(REGISTRY, '0x8eaa6ac0' + key(name), block));
  const [lens, router] = await Promise.all([resolve('lens'), resolve('router')]);
  const fields = words(await call(lens, '0x72d9d212' + word(token), block));
  if (fields.length !== 50) throw Error('Unexpected pool response from the Montra Lens.');
  // PoolView is static: PoolKey occupies words 0–4 and PoolConfig occupies 5–27.
  const poolKey = fields.slice(0, 5).join('');
  const hook = address(fields[4]);
  const quoteIs0 = integer(fields[9]) === 1n;
  const quoteAddr = address(fields[quoteIs0 ? 0 : 1]);
  if (address(fields[quoteIs0 ? 1 : 0]) !== token) throw Error('Pool token does not match.');
  const known = await call(REGISTRY, '0xfc40113f' + word(hook), block);
  if (BigInt(known) !== 1n) throw Error('The registry does not recognize this pool hook.');
  const [base, quote] = await Promise.all([asset(token, block), asset(quoteAddr, block)]);
  return {base, quote, router, block, hook, poolKey, quoteIs0,
    buyFee: Number(integer(fields[38])), sellFee: Number(integer(fields[36])),
    earlyUntil: Number(integer(fields[13]))};
}

export async function quoteSwap(pool, side, amount) {
  const buy = side === 'buy';
  const [input, output] = buy ? [pool.quote, pool.base] : [pool.base, pool.quote];
  const clean = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(clean) || clean.length > 300) throw Error('Enter a positive decimal amount.');
  const [whole, fraction = ''] = clean.split('.');
  if (fraction.length > input.decimals) throw Error('Too many decimal places for ' + input.label);
  const raw = BigInt(whole + fraction.padEnd(input.decimals, '0'));
  if (raw === 0n || raw >= 2n ** 128n) throw Error('Amount is outside the supported range.');
  const direction = buy ? pool.quoteIs0 : !pool.quoteIs0;
  const result = BigInt(await call(pool.router, '0x9efe7d00' + pool.poolKey + word(Number(direction)) + word(raw), pool.block));
  const digits = result.toString().padStart(output.decimals + 1, '0');
  const value = output.decimals ? digits.slice(0, -output.decimals) + '.' + digits.slice(-output.decimals) : digits;
  return (output.decimals ? value.replace(/\.?0+$/, '') : value) + ' ' + output.label;
}
