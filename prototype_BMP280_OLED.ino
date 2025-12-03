//Project ID: dss-database-51609

#include <ESP8266WiFi.h>
#include <WiFiClientSecureBearSSL.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BMP280.h>
#include <U8g2lib.h>
#include <ArduinoJson.h>
#include <ESP8266HTTPClient.h>

// -------------------------------
// WiFi Credentials
// -------------------------------
const char* WIFI_SSID = "ROYAL_CABLE_F15E"; //WIFI you will connect to
const char* WIFI_PASS = "022310342"; //Password of the wifi you will connect to

// -------------------------------
// Firebase Credentials
// -------------------------------
const char* FIREBASE_API_KEY  = "AIzaSyCq6MUL63iHYpOrGqoQrWCjDPWhOnNajmQ"; //Firebase api key
const char* FIREBASE_EMAIL    = "nodemcu@gmail.com";                       //Firebase email
const char* FIREBASE_PASSWORD = "databasesender";                          //Firebase password
const char* PROJECT_ID        = "dss-database-51609";                      //Project ID

// Firestore URL
String FIREBASE_URL = String("https://firestore.googleapis.com/v1/projects/") + "dss-database-51609" + "/databases/(default)/documents/sensorData";

// -------------------------------
// BMP280 Sensor Object
// -------------------------------
Adafruit_BMP280 bmp;

// -------------------------------
// OLED Display Object (SH1106 128x64)
// -------------------------------
U8G2_SH1106_128X64_NONAME_F_HW_I2C oled(U8G2_R0, U8X8_PIN_NONE);

// -------------------------------
// Global Variables
// -------------------------------
String idToken = "";      // Firebase ID token
String refreshToken = ""; // Firebase refresh token
unsigned long tokenTime = 0;
const unsigned long TOKEN_EXPIRE = 3500UL * 1000; // 3500 sec ≈ 58 min
unsigned long lastPost = 0;
const unsigned long POST_INTERVAL = 5000; // 5 seconds

// -------------------------------
// Helper: Display Centered Text
// -------------------------------
void displayCentered(const char* line1, const char* line2 = "") {
  oled.clearBuffer();
  oled.setFont(u8g2_font_ncenB08_tr);
  int x1 = (128 - oled.getUTF8Width(line1)) / 2;
  oled.drawStr(x1, 22, line1);
  if (strlen(line2) > 0) {
    int x2 = (128 - oled.getUTF8Width(line2)) / 2;
    oled.drawStr(x2, 45, line2);
  }
  oled.sendBuffer();
}

// -------------------------------
// Connect to WiFi
// -------------------------------
void connectWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  displayCentered("Connecting to WiFi...");
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected!");
  displayCentered("WiFi Connected!", WiFi.localIP().toString().c_str());
}

// -------------------------------
// Firebase Sign-In
// -------------------------------
bool firebaseSignIn() {
  WiFiClientSecure client;
  client.setInsecure(); // skip SSL verification (not secure for production)

  HTTPClient https;
  String url = String("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=") + FIREBASE_API_KEY;
  https.begin(client, url);
  https.addHeader("Content-Type", "application/json");

  String payload = "{\"email\":\"" + String(FIREBASE_EMAIL) + "\",\"password\":\"" + String(FIREBASE_PASSWORD) + "\",\"returnSecureToken\":true}";
  int httpCode = https.POST(payload);

  if (httpCode == 200) {
    String response = https.getString();
    DynamicJsonDocument doc(1024);
    deserializeJson(doc, response);

    idToken = doc["idToken"].as<String>();
    refreshToken = doc["refreshToken"].as<String>();
    tokenTime = millis();

    https.end();
    return true;
  } else {
    Serial.print("Firebase sign-in failed, code: ");
    Serial.println(httpCode);
    https.end();
    return false;
  }
}

// -------------------------------
// Refresh Firebase ID Token
// -------------------------------
bool refreshFirebaseToken() {
  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient https;
  String url = String("https://securetoken.googleapis.com/v1/token?key=") + FIREBASE_API_KEY;
  https.begin(client, url);
  https.addHeader("Content-Type", "application/x-www-form-urlencoded");

  String payload = "grant_type=refresh_token&refresh_token=" + refreshToken;
  int httpCode = https.POST(payload);

  if (httpCode == 200) {
    String response = https.getString();
    DynamicJsonDocument doc(1024);
    deserializeJson(doc, response);
    idToken = doc["id_token"].as<String>();
    refreshToken = doc["refresh_token"].as<String>();
    tokenTime = millis();
    https.end();
    Serial.println("Firebase token refreshed.");
    return true;
  } else {
    Serial.print("Token refresh failed: ");
    Serial.println(httpCode);
    https.end();
    return false;
  }
}

// -------------------------------
// Send Data to Firestore
// -------------------------------
void sendDataToFirestore(float temperature, float humidity) {
  if (idToken == "") return; // Not signed in

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient https;
  https.begin(client, FIREBASE_URL);
  https.addHeader("Content-Type", "application/json");
  https.addHeader("Authorization", "Bearer " + idToken);

  String jsonPayload = "{ \"fields\": { ";
  jsonPayload += "\"temperature\": { \"doubleValue\": " + String(temperature, 2) + " }, ";
  jsonPayload += "\"humidity\": { \"doubleValue\": " + String(humidity, 2) + " } ";
  jsonPayload += "} }";

  int httpCode = https.POST(jsonPayload);
  if (httpCode > 0) {
    Serial.print("POST Response Code: ");
    Serial.println(httpCode);
    Serial.println(https.getString());
  } else {
    Serial.print("POST Error: ");
    Serial.println(https.errorToString(httpCode));
  }
  https.end();
}

// -------------------------------
// Setup
// -------------------------------
void setup() {
  Serial.begin(9600); //Using 9600 

  // Initialize I2C for BMP280 and OLED
  Wire.begin(D2, D1);

  // Initialize OLED
  oled.begin();
  displayCentered("OLED Ready");
  delay(1000);

  // Connect WiFi
  connectWiFi();

  // Initialize BMP280
  if (!bmp.begin(0x77)) {
    displayCentered("BMP280 ERROR!");
    Serial.println("Could not initialize BMP280!");
    while (1);
  }
  displayCentered("BMP280 Ready");
  delay(1000);

  // Firebase sign-in
  displayCentered("Signing in Firebase...");
  if (!firebaseSignIn()) {
    displayCentered("Firebase Auth FAILED");
    while (1);
  }
  displayCentered("Firebase Auth OK");
  delay(1000);
}

// -------------------------------
// Loop
// -------------------------------
void loop() {
  // Auto-refresh token every ~58 minutes
  if (millis() - tokenTime > TOKEN_EXPIRE) {
    refreshFirebaseToken();
  }

  // Read sensor
  float temperature = bmp.readTemperature();
  float pressure    = bmp.readPressure() / 100.0;
  float humidity    = pressure; // as requested

  // Display on OLED
  char tempStr[20], humStr[20];
  sprintf(tempStr, "T: %.1f°C", temperature);
  sprintf(humStr, "H: %.1f", humidity);
  displayCentered(tempStr, humStr);

  // Print to Serial
  Serial.print("Temperature: "); Serial.print(temperature); Serial.println(" °C");
  Serial.print("Humidity: "); Serial.print(humidity); Serial.println(" %");
  Serial.println("------------------------");

  // Send to Firebase every 5 seconds
  if (millis() - lastPost > POST_INTERVAL) {
    sendDataToFirestore(temperature, humidity);
    lastPost = millis();
  }

  delay(500);
}
