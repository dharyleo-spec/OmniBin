/*
  OmniBin ESP32-CAM

  Takes a photo of the bin, decides whether it looks full, and posts
  both to Supabase. OmniBin shows the photo and uses this result to
  confirm the HC-SR04.

  Board in Arduino IDE: AI Thinker ESP32-CAM
  Tools > PSRAM: Enabled
  Tools > Partition Scheme: Huge APP (3MB No OTA / 1MB SPIFFS)

  Programmer wiring (FTDI set to 3.3V for the data pins)
    ESP32-CAM 5V   -> 5V
    ESP32-CAM GND  -> GND
    ESP32-CAM U0T  -> FTDI RX
    ESP32-CAM U0R  -> FTDI TX
    ESP32-CAM GPIO 0 -> GND only while uploading
  After upload, disconnect GPIO 0 from GND and press the reset button.

  Point the camera down into the bin.
  Set the Wi-Fi name and password, then flash this sketch.
*/

#include "esp_camera.h"
#include "img_converters.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

const char* WIFI_SSID = "YOUR_WIFI";
const char* WIFI_PASSWORD = "YOUR_PASSWORD";

const char* SUPABASE_URL = "https://ugstgbcrnuonvciytuth.supabase.co";
const char* SUPABASE_KEY = "sb_publishable_THJMYy81n37OjNbN2RitLA_s9QJhswW";

// Read the brightness line in Serial Monitor with the bin empty, then full.
// Put this number between those two readings.
constexpr int FULL_BRIGHTNESS = 90;

// An empty light-colored bin is brighter. Trash makes the picture darker.
// Set this to false if a full bin looks brighter than an empty one.
constexpr bool FULL_WHEN_DARKER = true;

constexpr unsigned long POST_EVERY_MS = 20000;

#define PWDN_GPIO_NUM 32
#define RESET_GPIO_NUM -1
#define XCLK_GPIO_NUM 0
#define SIOD_GPIO_NUM 26
#define SIOC_GPIO_NUM 27
#define Y9_GPIO_NUM 35
#define Y8_GPIO_NUM 34
#define Y7_GPIO_NUM 39
#define Y6_GPIO_NUM 36
#define Y5_GPIO_NUM 21
#define Y4_GPIO_NUM 19
#define Y3_GPIO_NUM 18
#define Y2_GPIO_NUM 5
#define VSYNC_GPIO_NUM 25
#define HREF_GPIO_NUM 23
#define PCLK_GPIO_NUM 22

bool startCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_RGB565;
  config.frame_size = FRAMESIZE_QVGA;
  config.jpeg_quality = 12;
  config.fb_count = 1;
  config.fb_location = CAMERA_FB_IN_PSRAM;
  config.grab_mode = CAMERA_GRAB_LATEST;

  const esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed: 0x%x\n", err);
    return false;
  }

  return true;
}

int averageBrightness(const camera_fb_t* fb) {
  if (fb == nullptr || fb->format != PIXFORMAT_RGB565) {
    return -1;
  }

  const uint16_t* pixels = reinterpret_cast<const uint16_t*>(fb->buf);
  uint32_t sum = 0;
  uint32_t count = 0;
  const int yStart = fb->height / 4;
  const int yEnd = fb->height * 3 / 4;
  const int xStart = fb->width / 4;
  const int xEnd = fb->width * 3 / 4;

  for (int y = yStart; y < yEnd; y += 4) {
    for (int x = xStart; x < xEnd; x += 4) {
      const uint16_t pixel = pixels[y * fb->width + x];
      const int red = ((pixel >> 11) & 0x1F) * 255 / 31;
      const int green = ((pixel >> 5) & 0x3F) * 255 / 63;
      const int blue = (pixel & 0x1F) * 255 / 31;
      sum += (red + green + blue) / 3;
      count++;
    }
  }

  if (count == 0) {
    return -1;
  }

  return sum / count;
}

bool uploadPhoto(const uint8_t* jpeg, size_t length, const char* filename, char* publicUrl, size_t publicUrlSize) {
  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  const String url = String(SUPABASE_URL) + "/storage/v1/object/trash-photos/" + filename;
  if (!http.begin(client, url)) {
    Serial.println("Camera: could not open photo upload");
    return false;
  }

  http.setTimeout(20000);
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
  http.addHeader("Content-Type", "image/jpeg");
  http.addHeader("x-upsert", "true");

  const int status = http.POST(const_cast<uint8_t*>(jpeg), length);
  http.end();

  if (status != 200 && status != 201) {
    Serial.print("Camera: photo upload failed, HTTP ");
    Serial.println(status);
    return false;
  }

  snprintf(
    publicUrl,
    publicUrlSize,
    "%s/storage/v1/object/public/trash-photos/%s",
    SUPABASE_URL,
    filename
  );
  return true;
}

bool postCheck(bool isFull, const char* filename, const char* imageUrl) {
  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  const String url = String(SUPABASE_URL) + "/rest/v1/camera_checks";
  if (!http.begin(client, url)) {
    Serial.println("Camera: could not open Supabase");
    return false;
  }

  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Prefer", "return=minimal");

  char body[320];
  if (imageUrl != nullptr && imageUrl[0] != '\0') {
    snprintf(
      body,
      sizeof(body),
      "{\"device\":\"esp32-cam\",\"is_full\":%s,\"filename\":\"%s\",\"image_url\":\"%s\"}",
      isFull ? "true" : "false",
      filename,
      imageUrl
    );
  } else {
    snprintf(
      body,
      sizeof(body),
      "{\"device\":\"esp32-cam\",\"is_full\":%s}",
      isFull ? "true" : "false"
    );
  }

  const int status = http.POST(body);
  if (status != 201 && status != 200) {
    Serial.print("Camera: Supabase rejected the check, HTTP ");
    Serial.println(status);
    Serial.println(http.getString());
    http.end();
    return false;
  }

  http.end();
  Serial.println(isFull ? "Camera posted: looks full" : "Camera posted: does not look full");
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

void captureAndPost() {
  camera_fb_t* frame = esp_camera_fb_get();
  if (frame == nullptr) {
    Serial.println("Camera: capture failed");
    return;
  }

  const int brightness = averageBrightness(frame);
  Serial.print("Brightness: ");
  Serial.println(brightness);

  const bool isFull = brightness >= 0 && (
    FULL_WHEN_DARKER ? brightness < FULL_BRIGHTNESS : brightness > FULL_BRIGHTNESS
  );

  uint8_t* jpeg = nullptr;
  size_t jpegLength = 0;
  const bool converted = frame2jpg(frame, 12, &jpeg, &jpegLength);

  char filename[32];
  snprintf(filename, sizeof(filename), "cam_%lu.jpg", millis());

  char imageUrl[180];
  imageUrl[0] = '\0';

  if (converted && jpeg != nullptr) {
    uploadPhoto(jpeg, jpegLength, filename, imageUrl, sizeof(imageUrl));
    free(jpeg);
  } else {
    Serial.println("Camera: could not make a JPEG");
  }

  esp_camera_fb_return(frame);
  postCheck(isFull, filename, imageUrl);
}

void setup() {
  Serial.begin(115200);
  connectWifi();

  if (!startCamera()) {
    Serial.println("Check PSRAM is enabled, then press reset.");
  }
}

void loop() {
  connectWifi();
  captureAndPost();
  delay(POST_EVERY_MS);
}
