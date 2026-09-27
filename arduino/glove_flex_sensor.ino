/*
 * ==============================================================================
 * Project: Sign Bridge - Smart Sign Language Glove with Flex Sensors
 * Description: Reads 5 flex sensors on a glove, maps finger bend values, 
 *              and identifies sign language gestures.
 * Target Hardware: Arduino Uno / Nano / Mega / ESP32
 * Baud Rate: 9600
 * ==============================================================================
 *
 * WIRING DIAGRAM (Voltage Divider for each Flex Sensor):
 *
 *     5V (or 3.3V)
 *        |
 *     [ Flex Sensor ] (~10k to ~30k Ohm variable)
 *        |
 *        +-------------------- Analog Pin (A0 to A4)
 *        |
 *     [ 10k / 22k Resistor ] (Fixed Pulldown)
 *        |
 *       GND
 *
 * Finger Mapping:
 *   - Thumb  : Pin A0
 *   - Index  : Pin A1
 *   - Middle : Pin A2
 *   - Ring   : Pin A3
 *   - Pinky  : Pin A4
 * ==============================================================================
 */

// Define Flex Sensor Analog Pins
const int PIN_THUMB  = A0;
const int PIN_INDEX  = A1;
const int PIN_MIDDLE = A2;
const int PIN_RING   = A3;
const int PIN_PINKY  = A4;

// LED Indicator Pin (Built-in LED on pin 13)
const int PIN_STATUS_LED = 13;

// Calibration Thresholds (Adjust based on your flex sensor readings)
// When a finger is straight (flat) vs when it is bent.
// You can use the built-in Serial Monitor to inspect your raw values!
int thumbStraight  = 300, thumbBent  = 600;
int indexStraight  = 300, indexBent  = 600;
int middleStraight = 300, middleBent = 600;
int ringStraight   = 300, ringBent   = 600;
int pinkyStraight  = 300, pinkyBent  = 600;

// Threshold percentage (0 = fully flat, 1 = bent)
const int BEND_THRESHOLD = 500; // Anything higher than this is considered "BENT"

// Previous recognized gesture (to prevent spamming identical words)
String lastGesture = "";
unsigned long lastSendTime = 0;
const unsigned long DEBOUNCE_DELAY = 1500; // Send at most every 1.5 seconds per gesture

void setup() {
  // Initialize Serial Communication at 9600 Baud
  Serial.begin(9600);
  pinMode(PIN_STATUS_LED, OUTPUT);
  digitalWrite(PIN_STATUS_LED, LOW);

  // Optional: Perform automatic 5-second calibration
  // Flash LED during calibration
  digitalWrite(PIN_STATUS_LED, HIGH);
  delay(1000);
  digitalWrite(PIN_STATUS_LED, LOW);

  Serial.println("SIGN_BRIDGE_GLOVE_READY");
}

void loop() {
  // 1. Read Analog Values from all 5 Flex Sensors
  int rawThumb  = analogRead(PIN_THUMB);
  int rawIndex  = analogRead(PIN_INDEX);
  int rawMiddle = analogRead(PIN_MIDDLE);
  int rawRing   = analogRead(PIN_RING);
  int rawPinky  = analogRead(PIN_PINKY);

  // 2. Classify each finger: 0 = STRAIGHT (OPEN), 1 = BENT (CLOSED)
  bool isThumbBent  = (rawThumb  > BEND_THRESHOLD);
  bool isIndexBent  = (rawIndex  > BEND_THRESHOLD);
  bool isMiddleBent = (rawMiddle > BEND_THRESHOLD);
  bool isRingBent   = (rawRing   > BEND_THRESHOLD);
  bool isPinkyBent  = (rawPinky  > BEND_THRESHOLD);

  // 3. Recognize Sign Gesture Patterns
  String currentGesture = "";

  // Pattern 1: ALL FINGERS STRAIGHT (Open Palm) -> "HELLO"
  if (!isThumbBent && !isIndexBent && !isMiddleBent && !isRingBent && !isPinkyBent) {
    currentGesture = "HELLO";
  }
  // Pattern 2: ALL FINGERS BENT (Closed Fist) -> "YES"
  else if (isThumbBent && isIndexBent && isMiddleBent && isRingBent && isPinkyBent) {
    currentGesture = "YES";
  }
  // Pattern 3: INDEX & MIDDLE STRAIGHT, OTHERS BENT (Peace / V-sign) -> "PEACE" or "NO"
  else if (!isIndexBent && !isMiddleBent && isThumbBent && isRingBent && isPinkyBent) {
    currentGesture = "NO";
  }
  // Pattern 4: THUMB, INDEX, & PINKY STRAIGHT (ASL "I LOVE YOU") -> "I LOVE YOU"
  else if (!isThumbBent && !isIndexBent && isMiddleBent && isRingBent && !isPinkyBent) {
    currentGesture = "I LOVE YOU";
  }
  // Pattern 5: ONLY INDEX FINGER STRAIGHT (Pointing) -> "I NEED HELP"
  else if (!isIndexBent && isThumbBent && isMiddleBent && isRingBent && isPinkyBent) {
    currentGesture = "I NEED HELP";
  }
  // Pattern 6: ONLY THUMB STRAIGHT (Thumbs up) -> "THANK YOU"
  else if (!isThumbBent && isIndexBent && isMiddleBent && isRingBent && isPinkyBent) {
    currentGesture = "THANK YOU";
  }
  // Pattern 7: THREE FINGERS (Index, Middle, Ring straight) -> "WATER"
  else if (isThumbBent && !isIndexBent && !isMiddleBent && !isRingBent && isPinkyBent) {
    currentGesture = "WATER";
  }

  // 4. Send Gesture over Serial if detected and debounced
  if (currentGesture != "" && (currentGesture != lastGesture || (millis() - lastSendTime > DEBOUNCE_DELAY))) {
    // Send gesture text to Web Application
    Serial.println(currentGesture);
    
    // Blink status LED on transmit
    digitalWrite(PIN_STATUS_LED, HIGH);
    delay(100);
    digitalWrite(PIN_STATUS_LED, LOW);

    lastGesture = currentGesture;
    lastSendTime = millis();
  }

  // Optional: Uncomment below line if you want to inspect sensor values in Arduino Serial Plotter
  /*
  Serial.print("T:"); Serial.print(rawThumb);
  Serial.print(" I:"); Serial.print(rawIndex);
  Serial.print(" M:"); Serial.print(rawMiddle);
  Serial.print(" R:"); Serial.print(rawRing);
  Serial.print(" P:"); Serial.println(rawPinky);
  */

  delay(100); // 10Hz sampling rate
}
