import { supabase } from './supabase';

export const BIN_HEIGHT_CM = 40;
export const FULL_PERCENT = 85;

// =====================================================
// HC-SR04 CALIBRATION
// =====================================================
//
// The HC-SR04 is mounted above the trash compartment.
//
// EMPTY_DISTANCE_CM:
// Distance measured by the sensor when the bin is empty.
//
// FULL_DISTANCE_CM:
// Distance from the sensor to the desired "100%" fill level.
//
// IMPORTANT:
// These values should match your actual physical measurements.
// The Arduino/ESP32 code does NOT need to be changed.
// The conversion is done here in the app.
//
const EMPTY_DISTANCE_CM = 27.9;
const FULL_DISTANCE_CM = 4;

export type Reading = {
  id: string;
  created_at: string;
  device: string;
  distance_cm: number | null;
  fill_percent: number;
  is_full: boolean;
};

export type CameraCheck = {
  id: string;
  created_at: string;
  device: string;
  is_full: boolean | null;
  filename: string | null;
  image_url: string | null;
};

export type BinInfo = {
  bin_id: number;
  name: string;
  waste_type: string;
  location: string | null;
};

export type MonitorAlert = {
  at: string;
  source: 'sensor' | 'camera';
  message: string;
};

export type MonitorState = {
  bin: BinInfo | null;

  sensor: {
    distance_cm: number | null;
    fill_percent: number;
    is_full: boolean;
    updated_at: string;
  } | null;

  camera: {
    is_full: boolean | null;
    image: string | null;
    updated_at: string;
  } | null;

  history: {
    distance_cm: number | null;
    fill_percent: number;
    is_full: boolean;
    at: string;
  }[];

  alerts: MonitorAlert[];

  analytics: {
    readings_today: number;
    average_fill: number | null;
    peak_fill: number | null;
    full_alerts_today: number;
  };

  banner: {
    level: 'full' | 'check';
    text: string;
  } | null;

  confirmed_full: boolean;
};

function asNumber(value: unknown): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }

  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  if (
    value === 1 ||
    value === '1' ||
    value === 'true'
  ) {
    return true;
  }

  if (
    value === 0 ||
    value === '0' ||
    value === 'false'
  ) {
    return false;
  }

  return null;
}

function manilaDateKey(iso: string): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(
    'en-CA',
    {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }
  ).format(date);
}

// =====================================================
// CALCULATE FILL PERCENTAGE
// =====================================================
//
// Converts the HC-SR04 distance into a fill percentage.
//
// Example with the current calibration:
//
// 29.5 cm or farther = 0%
// 4 cm or closer     = 100%
//
// Anything between those values is mapped linearly.
//
function calculateFillPercent(
  distanceCm: number | null
): number {
  if (
    distanceCm === null ||
    !Number.isFinite(distanceCm)
  ) {
    return 0;
  }

  // Empty or beyond the empty calibration point.
  if (
    distanceCm >= EMPTY_DISTANCE_CM
  ) {
    return 0;
  }

  // At or beyond the full calibration point.
  if (
    distanceCm <= FULL_DISTANCE_CM
  ) {
    return 100;
  }

  const percent =
    (
      (EMPTY_DISTANCE_CM - distanceCm) /
      (EMPTY_DISTANCE_CM - FULL_DISTANCE_CM)
    ) * 100;

  return Math.round(
    Math.max(
      0,
      Math.min(100, percent)
    )
  );
}

/*
 * =====================================================
 * NORMALIZE READING
 * =====================================================
 */
function normalizeReading(
  row: Record<string, unknown>
): Reading | null {

  const distanceCm =
    asNumber(row.distance_cm);

  const storedFill =
    asNumber(row.fill_percent);

  const createdAt =
    typeof row.created_at === 'string'
      ? row.created_at
      : '';

  if (
    !createdAt ||
    (
      distanceCm === null &&
      storedFill === null
    )
  ) {
    return null;
  }

  // Use the HC-SR04 distance as the source of truth.
  //
  // This means the app no longer depends on the
  // Arduino/ESP32's old fill percentage calculation.
  const fillPercent =
    distanceCm !== null
      ? calculateFillPercent(distanceCm)
      : Math.round(
          Math.max(
            0,
            Math.min(
              100,
              storedFill ?? 0
            )
          )
        );

  // Determine FULL from the recalculated percentage.
  //
  // This is important because using the old database
  // is_full value could still cause the app to say FULL
  // even after the percentage has been recalculated.
  const isFull =
    fillPercent >= FULL_PERCENT;

  return {
    id: String(
      row.id ?? createdAt
    ),

    created_at: createdAt,

    device:
      typeof row.device === 'string'
        ? row.device
        : 'trash-bin',

    distance_cm:
      distanceCm,

    fill_percent:
      fillPercent,

    is_full:
      isFull,
  };
}

/*
 * =====================================================
 * NORMALIZE CAMERA
 * =====================================================
 */
function normalizeCamera(
  row: Record<string, unknown>
): CameraCheck | null {

  const createdAt =
    typeof row.created_at === 'string'
      ? row.created_at
      : '';

  if (!createdAt) {
    return null;
  }

  return {
    id: String(
      row.id ?? createdAt
    ),

    created_at: createdAt,

    device:
      typeof row.device === 'string'
        ? row.device
        : 'esp32-cam',

    is_full:
      asBoolean(row.is_full),

    filename:
      typeof row.filename === 'string'
        ? row.filename
        : null,

    image_url:
      typeof row.image_url === 'string'
        ? row.image_url
        : null,
  };
}

/*
 * =====================================================
 * NORMALIZE BIN
 * =====================================================
 */
function normalizeBin(
  row: Record<string, unknown>
): BinInfo | null {

  const binId =
    asNumber(row.bin_id);

  if (binId === null) {
    return null;
  }

  return {
    bin_id: binId,

    name:
      typeof row.name === 'string'
        ? row.name
        : 'Live Trashcan 01',

    waste_type:
      typeof row.waste_type === 'string'
        ? row.waste_type
        : 'Recyclable',

    location:
      typeof row.location === 'string'
        ? row.location
        : null,
  };
}

/*
 * =====================================================
 * PRESENT MONITOR
 * =====================================================
 */
export function presentMonitor(
  readingsNewestFirst: Reading[],
  camerasNewestFirst: CameraCheck[],
  bin: BinInfo | null
): MonitorState {

  const today =
    manilaDateKey(
      new Date().toISOString()
    );

  const todayFills: number[] = [];

  const alerts: MonitorAlert[] = [];

  /*
   * ===================================================
   * SENSOR ALERTS
   * ===================================================
   */

  let wasFull = false;

  for (
    const row of [
      ...readingsNewestFirst,
    ].reverse()
  ) {

    if (
      manilaDateKey(
        row.created_at
      ) === today
    ) {
      todayFills.push(
        row.fill_percent
      );
    }

    if (
      row.is_full &&
      !wasFull
    ) {
      alerts.push({
        at: row.created_at,
        source: 'sensor',
        message:
          'Sensor reported the trashcan is full.',
      });
    }

    wasFull =
      row.is_full;
  }

  /*
   * ===================================================
   * CAMERA ALERTS
   * ===================================================
   */

  let cameraWasFull = false;

  for (
    const row of [
      ...camerasNewestFirst,
    ].reverse()
  ) {

    if (
      row.is_full === true &&
      !cameraWasFull
    ) {
      alerts.push({
        at: row.created_at,
        source: 'camera',
        message:
          'Camera confirmed the trashcan looks full.',
      });
    }

    if (
      row.is_full !== null
    ) {
      cameraWasFull =
        row.is_full;
    }
  }

  alerts.sort(
    (left, right) =>
      left.at < right.at
        ? 1
        : left.at > right.at
        ? -1
        : 0
  );

  const fullToday =
    alerts.filter(
      (alert) =>
        manilaDateKey(
          alert.at
        ) === today
    ).length;

  /*
   * ===================================================
   * CURRENT DATA
   * ===================================================
   */

  const sensor =
    readingsNewestFirst[0] ??
    null;

  const camera =
    camerasNewestFirst[0] ??
    null;

  const sensorFull =
    Boolean(
      sensor?.is_full
    );

  const cameraFull =
    camera?.is_full ??
    null;

  /*
   * BOTH SOURCES REFER TO THE SAME BIN
   */

  const confirmed =
    sensorFull &&
    cameraFull === true;

  /*
   * ===================================================
   * BANNER
   * ===================================================
   */

  let banner:
    MonitorState['banner'] =
    null;

  if (confirmed) {

    banner = {
      level: 'full',
      text:
        'The trashcan is full. The camera confirms what the sensor measured.',
    };

  } else if (
    sensorFull &&
    cameraFull === false
  ) {

    banner = {
      level: 'check',
      text:
        'The sensor says the trashcan is full. The camera does not confirm it.',
    };

  } else if (sensorFull) {

    banner = {
      level: 'full',
      text:
        'The sensor says the trashcan is full. Waiting for the camera to confirm.',
    };

  } else if (
    cameraFull === true
  ) {

    banner = {
      level: 'check',
      text:
        'The camera shows a full trashcan. The distance sensor has not reported full.',
    };
  }

  /*
   * ===================================================
   * HISTORY
   * ===================================================
   */

  const history =
    [
      ...readingsNewestFirst.slice(
        0,
        60
      ),
    ]
      .reverse()
      .map((row) => ({
        distance_cm:
          row.distance_cm,

        fill_percent:
          row.fill_percent,

        is_full:
          row.is_full,

        at:
          row.created_at,
      }));

  /*
   * ===================================================
   * FINAL STATE
   * ===================================================
   */

  return {

    bin,

    sensor:
      sensor
        ? {
            distance_cm:
              sensor.distance_cm,

            fill_percent:
              sensor.fill_percent,

            is_full:
              sensor.is_full,

            updated_at:
              sensor.created_at,
          }
        : null,

    camera:
      camera
        ? {
            is_full:
              camera.is_full,

            image:
              camera.image_url &&
              camera.image_url.startsWith(
                'http'
              )
                ? camera.image_url
                : null,

            updated_at:
              camera.created_at,
          }
        : null,

    history,

    alerts:
      alerts.slice(0, 12),

    analytics: {

      readings_today:
        todayFills.length,

      average_fill:
        todayFills.length
          ? Math.round(
              (
                todayFills.reduce(
                  (
                    sum,
                    value
                  ) =>
                    sum + value,
                  0
                ) /
                todayFills.length
              ) * 10
            ) / 10
          : null,

      peak_fill:
        todayFills.length
          ? Math.round(
              Math.max(
                ...todayFills
              ) * 10
            ) / 10
          : null,

      full_alerts_today:
        fullToday,
    },

    banner,

    confirmed_full:
      confirmed,
  };
}

/*
 * =====================================================
 * FETCH MONITOR STATE
 * =====================================================
 */
export async function fetchMonitorState(): Promise<MonitorState> {

  const [
    readingsResult,
    cameraResult,
    binResult,
  ] = await Promise.all([

    /*
     * HC-SR04 READINGS
     */
    supabase
      .from('readings')
      .select(
        'id, created_at, device, distance_cm, fill_percent, is_full'
      )
      .order(
        'created_at',
        {
          ascending: false,
        }
      )
      .limit(300),

    /*
     * ESP32-CAM CHECKS
     */
    supabase
      .from('camera_checks')
      .select(
        'id, created_at, device, is_full, filename, image_url'
      )
      .order(
        'created_at',
        {
          ascending: false,
        }
      )
      .limit(80),

    /*
     * THE ONE PHYSICAL BIN
     *
     * bin_id = 1
     */
    supabase
      .from('bins')
      .select(
        'bin_id, name, waste_type, location'
      )
      .eq(
        'bin_id',
        1
      )
      .maybeSingle(),
  ]);

  /*
   * ===================================================
   * ERRORS
   * ===================================================
   */

  if (
    readingsResult.error
  ) {
    throw new Error(
      readingsResult.error.message
    );
  }

  if (
    cameraResult.error
  ) {
    throw new Error(
      cameraResult.error.message
    );
  }

  if (
    binResult.error
  ) {
    throw new Error(
      binResult.error.message
    );
  }

  /*
   * ===================================================
   * NORMALIZE DATA
   * ===================================================
   */

  const readings =
    (
      (
        readingsResult.data ??
        []
      ) as Record<
        string,
        unknown
      >[]
    )
      .map(
        normalizeReading
      )
      .filter(
        (
          row
        ): row is Reading =>
          row !== null
      );

  const cameras =
    (
      (
        cameraResult.data ??
        []
      ) as Record<
        string,
        unknown
      >[]
    )
      .map(
        normalizeCamera
      )
      .filter(
        (
          row
        ): row is CameraCheck =>
          row !== null
      );

  const bin =
    binResult.data
      ? normalizeBin(
          binResult.data as Record<
            string,
            unknown
          >
        )
      : null;

  return presentMonitor(
    readings,
    cameras,
    bin
  );
}