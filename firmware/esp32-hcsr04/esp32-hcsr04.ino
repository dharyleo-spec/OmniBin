/*
  OmniBin HC-SR04

  Reads the ultrasonic distance and posts it to Supabase.
  OmniBin displays that measurement on the dashboard.

  Wiring
    HC-SR04 VCC  -> ESP32 5V
    HC-SR04 GND  -> ESP32 GND
    HC-SR04 TRIG -> GPIO 5
    HC-SR04 ECHO -> GPIO 18 through a divider.
      ECHO is 5V. ESP32 pins are not 5V tolerant.
      ECHO ---- 1k ohm ---- GPIO 18
                          |
                       2k ohm
                          |
                         GND

  Set the Wi-Fi name and password below, then flash this sketch.
  The Supabase key is the same publishable key in lib/supabase.ts.
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

const char* WIFI_SSID = "YOUR_WIFI";
const char* WIFI_PASSWORD = "YOUR_PASSWORD";

const char* SUPABASE_URL = "https://ugstgbcrnuonvciytuth.supabase.co";
const char* SUPABASE_KEY = "sb_publishable_THJMYy81n37OjNbN2RitLA_s9QJhswW";

constexpr int TRIG_PIN = 5;
constexpr int ECHO_PIN = 18;
constexpr unsigned long POST_EVERY_MS = 10000;

float readDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  const unsigned long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  if (duration == 0) {
    return -1;
  }

  return duration / 58.2f;
}

float medianDistanceCm() {
  float samples[5];
  int count = 0;

  for (int i = 0; i < 5; i++) {
    const float cm = readDistanceCm();
    if (cm > 0 && cm < 400) {
      samples[count++] = cm;
    }
    delay(60);
  }

  if (count == 0) {
    return -1;
  }

  for (int i = 1; i < count; i++) {
    const float value = samples[i];
    int j = i - 1;
    while (j >= 0 && samples[j] > value) {
      samples[j + 1] = samples[j];
      j--;
    }
    samples[j + 1] = value;
  }

  return samples[count / 2];
}

bool postDistance(float centimeters) {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  const String url = String(SUPABASE_URL) + "/rest/v1/readings";

  if (!http.begin(client, url)) {
    Serial.println("HC-SR04: could not open Supabase");
    return false;
  }

  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Prefer", "return=minimal");

  char body[80];
  snprintf(body, sizeof(body), "{\"device\":\"hc-sr04\",\"distance_cm\":%.1f}", centimeters);

  const int status = http.POST(body);
  if (status != 201 && status != 200) {
    Serial.print("HC-SR04: Supabase rejected the reading, HTTP ");
    Serial.println(status);
    Serial.println(http.getString());
    http.end();
    return false;
  }

  http.end();
  Serial.print("HC-SR04 posted ");
  Serial.print(centimeters, 1);
  Serial.println(" cm");
  return true;
}

void connectWifi() {
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to Wi-Fi");

  for (int attempt = 0; attempt < 30 && WiFi.status() != WL_CONNECTED; attempt++) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("Wi-Fi connected: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("Wi-Fi not connected");
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  digitalWrite(TRIG_PIN, LOW);
  connectWifi();
}

void loop() {
  connectWifi();

  const float centimeters = medianDistanceCm();
  if (centimeters > 0) {
    postDistance(centimeters);
  } else {
    Serial.println("HC-SR04: no echo");
  }

  delay(POST_EVERY_MS);
}
