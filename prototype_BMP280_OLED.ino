/*
 * DSS-Database Sensor Sender
 * NodeMCU ESP8266  +  BMP280  +  OLED SH1106
 * Posts temperature + (pressure→humidity) to Firestore every 5 s
 */

#include <ESP8266WiFi.h>
#include <WiFiClientSecureBearSSL.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BMP280.h>
#include <U8g2lib.h>
#include <ArduinoJson.h>
#include <ESP8266HTTPClient.h>
#include <time.h>               // NTP for real timestamp

/* 1.  CONFIGURATION  ------------------------------------------*/
const char* WIFI_SSID   = "ROYAL_CABLE_F15E";
const char* WIFI_PASS   = "022310342";

const char* FIREBASE_API_KEY  = "AIzaSyCq6MUL63iHYpOrGqoQrWCjDPWhOnNajmQ";
const char* FIREBASE_EMAIL    = "nodemcu@gmail.com";
const char* FIREBASE_PASSWORD = "databasesender";
const char* PROJECT_ID        = "dss-database-51609";

/* FIXED: removed trailing space that caused 404 */
String FIREBASE_URL = "https://firestore.googleapis.com/v1/projects/"
                      + String(PROJECT_ID) +
                      "/databases/(default)/documents/sensorData";

const unsigned long POST_INTERVAL = 5000;
unsigned long lastPost = 0;

/* 2.  HARDWARE  -----------------------------------------------*/
Adafruit_BMP280 bmp;   // I2C  D2=SDA  D1=SCL
U8G2_SH1106_128X64_NONAME_F_HW_I2C oled(U8G2_R0, U8X8_PIN_NONE);

/* 3.  UTILITIES  ----------------------------------------------*/
String idToken;

void displayCentered(const char* line1, const char* line2 = "") {
  oled.clearBuffer();
  oled.setFont(u8g2_font_ncenB08_tr);
  int x1 = (128 - oled.getUTF8Width(line1)) / 2;
  oled.drawStr(x1, 25, line1);
  if (strlen(line2)) {
    int x2 = (128 - oled.getUTF8Width(line2)) / 2;
    oled.drawStr(x2, 50, line2);
  }
  oled.sendBuffer();
}

bool firebaseSignIn() {
  std::unique_ptr<BearSSL::WiFiClientSecure> client(new BearSSL::WiFiClientSecure);
  client->setInsecure();
  HTTPClient https;
  String url = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key="
               + String(FIREBASE_API_KEY);
  https.begin(*client, url);
  https.addHeader("Content-Type", "application/json");

  StaticJsonDocument<256> auth;
  auth["email"]             = FIREBASE_EMAIL;
  auth["password"]          = FIREBASE_PASSWORD;
  auth["returnSecureToken"] = true;
  String body;
  serializeJson(auth, body);

  int httpCode = https.POST(body);
  String resp  = https.getString();
  https.end();

  if (httpCode == 200) {
    DynamicJsonDocument doc(1024);
    deserializeJson(doc, resp);
    idToken = doc["idToken"].as<String>();
    return true;
  }
  Serial.printf("Auth failed %d\n", httpCode);
  return false;
}

/* Get ISO-8601 timestamp (required by Firestore) --------------*/
String getISO8601Time() {
  time_t now = time(nullptr);
  struct tm* ti = gmtime(&now);
  char buf[32];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", ti);
  return String(buf);
}

void sendDataToFirestore(float temp, float humidity) {
  if (idToken.length() == 0 && !firebaseSignIn()) return;

  std::unique_ptr<BearSSL::WiFiClientSecure> client(new BearSSL::WiFiClientSecure);
  client->setInsecure();
  HTTPClient https;
  https.begin(*client, FIREBASE_URL);
  https.addHeader("Content-Type", "application/json");
  https.addHeader("Authorization", "Bearer " + idToken);

  DynamicJsonDocument doc(512);
  JsonObject fields = doc.createNestedObject("fields");

  fields["temperature"]["doubleValue"] = temp;
  fields["humidity"]["doubleValue"]    = humidity;
  fields["timestamp"]["timestampValue"] = getISO8601Time();  // server accepts this

  String json;
  serializeJson(doc, json);

  int httpCode = https.POST(json);
  if (httpCode == 200) {
    Serial.println("Successfully Posted");
  } else if (httpCode == 401) {
    Serial.println("Token expired – re-authing");
    firebaseSignIn();
  } else {
    Serial.printf("POST error %d\n", httpCode);
    Serial.println(https.getString());
  }
  https.end();
}

/* 4.  SETUP  --------------------------------------------------*/
void setup() {
  Serial.begin(9600);
  Wire.begin(D2, D1);
  oled.begin();
  displayCentered("Initializing...");

  if (!bmp.begin(0x77) && !bmp.begin(0x76)) {
    displayCentered("BMP280 Error");
    while (1);
  }

  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500); Serial.print('.');
    displayCentered("Connecting WiFi...");
  }
  displayCentered("WiFi connected!");

  /* NTP so we have real time for timestamp */
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  while (time(nullptr) < 100000) delay(100);

  displayCentered(firebaseSignIn() ? "Auth OK" : "Auth failed");
  delay(1000);
}

/* 5.  LOOP  ---------------------------------------------------*/
void loop() {
  float temp     = bmp.readTemperature();
  float press    = bmp.readPressure() / 100.0f;   // hPa used as humidity

  char tStr[16], hStr[16];
  sprintf(tStr, "T: %.2f C", temp);
  sprintf(hStr, "P: %.2f hPa", press);
  displayCentered(tStr, hStr);

  if (millis() - lastPost >= POST_INTERVAL) {
    Serial.println("Sending data...");
    sendDataToFirestore(temp, press);
    lastPost = millis();
  }
  delay(100);
}
