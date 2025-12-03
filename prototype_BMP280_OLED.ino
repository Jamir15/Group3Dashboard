#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BMP280.h>
#include <U8g2lib.h>
#include <ESP8266WiFi.h>

// -------------------------------------
// OLED Display (SH1106 128x64 I2C)
// -------------------------------------
U8G2_SH1106_128X64_NONAME_F_HW_I2C oled(
    U8G2_R0,          // No rotation
    U8X8_PIN_NONE     // Reset pin not used
);

// -------------------------------------
// WiFi Credentials
// -------------------------------------
const char* WIFI_SSID = "ROYAL_CABLE_F15E";
const char* WIFI_PASS = "022310342";

// -------------------------------------
// BMP280 Sensor Object
// -------------------------------------
Adafruit_BMP280 bmp;

// -------------------------------------
// Helper Function: Display centered text
// -------------------------------------
void displayCentered(const char* line1, const char* line2 = "") {
    oled.clearBuffer();                // Clear previous display
    oled.setFont(u8g2_font_ncenB08_tr); // Set readable font

    // Line 1
    int x1 = (128 - oled.getUTF8Width(line1)) / 2;  // Horizontal centering
    oled.drawStr(x1, 22, line1);                    // Y = 22 for line 1

    // Line 2 (optional)
    if (strlen(line2) > 0) {
        int x2 = (128 - oled.getUTF8Width(line2)) / 2;
        oled.drawStr(x2, 45, line2);               // Y = 45 for line 2
    }

    oled.sendBuffer();  // Update OLED
}

// -------------------------------------
// Connect ESP8266 to WiFi
// -------------------------------------
void connectWiFi() {
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    displayCentered("Connecting to", WIFI_SSID);
    Serial.print("Connecting to WiFi: ");
    Serial.println(WIFI_SSID);

    while (WiFi.status() != WL_CONNECTED) {
        delay(400);
        Serial.print(".");
    }

    Serial.println("\nWiFi Connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());

    char ipStr[32];
    sprintf(ipStr, "IP: %s", WiFi.localIP().toString().c_str());
    displayCentered("WiFi Connected!", ipStr);
}

// -------------------------------------
// Arduino Setup
// -------------------------------------
void setup() {
    Serial.begin(9600); //always use 9600

    // Initialize I2C bus: SDA = D2, SCL = D1
    Wire.begin(D2, D1);

    // Initialize OLED
    oled.begin();
    displayCentered("OLED Ready");
    delay(1000);

    // Connect to WiFi
    connectWiFi();

    // Initialize BMP280
    // Use 0x77 as your sensor address (SDO = 3.3V)
    if (!bmp.begin(0x77)) {
        displayCentered("BMP280 ERROR!");
        Serial.println("Could not initialize BMP280!");
        while (1);  // Stop execution if sensor not found
    }

    displayCentered("BMP280 Ready");
    delay(1000);
}

// -------------------------------------
// Arduino Loop
// -------------------------------------
void loop() {
    // Read temperature in Celsius
    float temperature = bmp.readTemperature();

    // Read pressure in hPa
    float pressure = bmp.readPressure() / 100.0;

    // Prepare strings with symbols for display
    char tempStr[20];
    char pressStr[20];

    sprintf(tempStr,  "T: %.2f °C", temperature);  // ° symbol
    sprintf(pressStr, "P: %.1f hPa", pressure);

    // Display values on OLED
    displayCentered(tempStr, pressStr);

    // Print to Serial Monitor for debugging
    Serial.print("Temperature: ");
    Serial.print(temperature);
    Serial.println(" °C");

    Serial.print("Pressure: ");
    Serial.print(pressure);
    Serial.println(" hPa");

    Serial.println("--------------------------");

    delay(2000);  // Update every 2 seconds
}
