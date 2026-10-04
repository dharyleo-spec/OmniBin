/**
 * Sends the same Supabase messages as the HC-SR04 and ESP32-CAM.
 * Use this when the boards are somewhere else and you want to see
 * whether OmniBin displays a measurement and a camera check.
 *
 *   node scripts/simulate-bin.js
 *   node scripts/simulate-bin.js --distance 30 --camera empty
 *   node scripts/simulate-bin.js --distance 6 --camera full
 *
 * Then open the OmniBin dashboard and pull to refresh.
 */

const SUPABASE_URL = 'https://ugstgbcrnuonvciytuth.supabase.co';
const SUPABASE_KEY = 'sb_publishable_THJMYy81n37OjNbN2RitLA_s9QJhswW';

const TINY_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxMTEhUTExMWFRUXGBcYGBgXGB4dGh0dHhwjHh0jHiMjIC0lHh0lJzItJS8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL//AABEIAAEAAQMBIgACEQEDEQH/xAAUAAEAAAAAAAAAAAAAAAAAAAAQ/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAH/2gAMAwEAAhEDEQA/AJUAH//Z',
  'base64',
);

function readArg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1 || process.argv[index + 1] === undefined) {
    return fallback;
  }
  return process.argv[index + 1];
}

function headers(extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    ...extra,
  };
}

async function readError(response) {
  const text = await response.text();
  return text || response.statusText;
}

async function postReading(distanceCm) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/readings`, {
    method: 'POST',
    headers: headers({
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    }),
    body: JSON.stringify({
      device: 'hc-sr04',
      distance_cm: distanceCm,
    }),
  });

  if (!response.ok) {
    throw new Error(`Sensor post failed (HTTP ${response.status}): ${await readError(response)}`);
  }

  const rows = await response.json();
  return rows[0];
}

async function postCamera(isFull) {
  const filename = `test_${Date.now()}.jpg`;
  const upload = await fetch(
    `${SUPABASE_URL}/storage/v1/object/trash-photos/${filename}`,
    {
      method: 'POST',
      headers: headers({
        'Content-Type': 'image/jpeg',
        'x-upsert': 'true',
      }),
      body: TINY_JPEG,
    },
  );

  let imageUrl = null;
  if (upload.ok) {
    imageUrl = `${SUPABASE_URL}/storage/v1/object/public/trash-photos/${filename}`;
  } else {
    console.log(`Photo upload skipped (HTTP ${upload.status}): ${await readError(upload)}`);
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/camera_checks`, {
    method: 'POST',
    headers: headers({
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    }),
    body: JSON.stringify({
      device: 'esp32-cam',
      is_full: isFull,
      filename: imageUrl ? filename : null,
      image_url: imageUrl,
    }),
  });

  if (!response.ok) {
    throw new Error(`Camera post failed (HTTP ${response.status}): ${await readError(response)}`);
  }

  const rows = await response.json();
  return rows[0];
}

async function main() {
  const distance = Number(readArg('--distance', '12'));
  const camera = String(readArg('--camera', 'full')).toLowerCase();

  if (!Number.isFinite(distance) || distance < 0) {
    throw new Error('Pass a distance in centimeters, for example --distance 12');
  }

  if (!['full', 'empty', 'skip'].includes(camera)) {
    throw new Error('Use --camera full, --camera empty, or --camera skip');
  }

  const reading = await postReading(distance);
  console.log(
    `HC-SR04 saved: ${reading.distance_cm} cm, ${reading.fill_percent}% full, is_full=${reading.is_full}`,
  );

  if (camera !== 'skip') {
    const check = await postCamera(camera === 'full');
    console.log(
      `Camera saved: is_full=${check.is_full}, photo=${check.image_url || 'none'}`,
    );
  }

  console.log('Open the OmniBin dashboard and pull to refresh.');
}

main().catch((error) => {
  console.error(error.message);
  if (
    error.message.includes('readings') ||
    error.message.includes('camera_checks') ||
    error.message.includes('schema cache') ||
    error.message.includes('trash-photos')
  ) {
    console.error(
      'Run OmniBin/supabase/migrations/20261003120000_bin_monitor.sql in the Supabase SQL Editor, then run this script again.',
    );
  }
  process.exit(1);
});
