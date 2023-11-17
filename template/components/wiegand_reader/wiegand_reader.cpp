#include "wiegand_reader.h"
#include "esphome/core/log.h"
#include "esphome/core/helpers.h"

/*
 * Most of the code in this library has been adapted from
 *
 * https://github.com/monkeyboard/Wiegand-Protocol-Library-for-Arduino
 *
 * And was copied out on 2021-06-22
 *
 * If bugs are found in this implementation, they should not be reported to the library listed, but it may be worth
 * reviewing changes to the library after that point and attempting to port them into here.
 */

namespace esphome {
namespace wiegand_reader {

static const char *TAG = "wiegand_reader";

void IRAM_ATTR WiegandReader::read_d0_(WiegandReader *reader) {
  reader->_bitCount++;         // Increament bit count for Interrupt connected to D0
  if (reader->_bitCount > 31)  // If bit count more than 31, process high bits
  {
    reader->_cardTempHigh |= ((0x80000000 & reader->_cardTemp) >> 31);  //	shift value to high bits
    reader->_cardTempHigh <<= 1;
    reader->_cardTemp <<= 1;
  } else {
    reader->_cardTemp <<= 1;  // D0 represent binary 0, so just left shift card data
  }
  reader->_lastWiegand = millis();  // Keep track of last wiegand bit received
}

void IRAM_ATTR WiegandReader::read_d1_(WiegandReader *reader) {
  reader->_bitCount++;         // Increment bit count for Interrupt connected to D1
  if (reader->_bitCount > 31)  // If bit count more than 31, process high bits
  {
    reader->_cardTempHigh |= ((0x80000000 & reader->_cardTemp) >> 31);  // shift value to high bits
    reader->_cardTempHigh <<= 1;
    reader->_cardTemp |= 1;
    reader->_cardTemp <<= 1;
  } else {
    reader->_cardTemp |= 1;   // D1 represent binary 1, so OR card data with 1 then
    reader->_cardTemp <<= 1;  // left shift card data
  }
  reader->_lastWiegand = millis();  // Keep track of last wiegand bit received
}

char WiegandReader::translate_enter_escape_keypress_(char originalKeyPress) {
  switch (originalKeyPress) {
    case 0x0b:      // 11 or * key
      return 0x0d;  // 13 or ASCII ENTER

    case 0x0a:      // 10 or # key
      return 0x1b;  // 27 or ASCII ESCAPE

    default:
      return originalKeyPress;
  }
}

unsigned long WiegandReader::get_card_id_(volatile unsigned long *codehigh, volatile unsigned long *codelow,
                                          char bitlength) {
  if (bitlength == 26)  // EM tag
    return (*codelow & 0x1FFFFFE) >> 1;

  if (bitlength == 24)
    return (*codelow & 0x7FFFFE) >> 1;

  if (bitlength == 34)  // Mifare
  {
    *codehigh = *codehigh & 0x03;  // only need the 2 LSB of the codehigh
    *codehigh <<= 30;              // shift 2 LSB to MSB
    *codelow >>= 1;
    return *codehigh | *codelow;
  }

  if (bitlength == 32) {
    return (*codelow & 0x7FFFFFFE) >> 1;
  }

  return *codelow;  // EM tag or Mifare without parity bits
}

bool WiegandReader::do_wiegand_conversion_() {
  unsigned long cardID;
  unsigned long sysTick = millis();

  if ((sysTick - this->_lastWiegand) > 25)  // if no more signal coming through after 25ms
  {
    if ((this->_bitCount == 24) || (this->_bitCount == 26) || (this->_bitCount == 32) || (this->_bitCount == 34) ||
        (this->_bitCount == 8) ||
        (this->_bitCount == 4))  // bitCount for keypress=4 or 8, Wiegand 26=24 or 26, Wiegand 34=32 or 34
    {
      this->_cardTemp >>= 1;  // shift right 1 bit to get back the real value - interrupt done 1 left shift in advance
      if (this->_bitCount > 32)  // bit count more than 32 bits, shift high bits right to make adjustment
        this->_cardTempHigh >>= 1;

      if (this->_bitCount == 8)  // keypress wiegand with integrity
      {
        // 8-bit Wiegand keyboard data, high nibble is the "NOT" of low nibble
        // eg if key 1 pressed, data=E1 in binary 11100001 , high nibble=1110 , low nibble = 0001
        char highNibble = (this->_cardTemp & 0xf0) >> 4;
        char lowNibble = (this->_cardTemp & 0x0f);
        this->_wiegandType = _bitCount;
        this->_bitCount = 0;
        this->_cardTemp = 0;
        this->_cardTempHigh = 0;

        if (lowNibble == (~highNibble & 0x0f))  // check if low nibble matches the "NOT" of high nibble.
        {
          this->_code = (int) translate_enter_escape_keypress_(lowNibble);
          return true;
        } else {
          this->_lastWiegand = sysTick;
          this->_bitCount = 0;
          this->_cardTemp = 0;
          this->_cardTempHigh = 0;
          return false;
        }

        // TODO: Handle validation failure case!
      } else if (4 == this->_bitCount) {
        // 4-bit Wiegand codes have no data integrity check so we just
        // read the LOW nibble.
        this->_code = (int) translate_enter_escape_keypress_(_cardTemp & 0x0000000F);

        this->_wiegandType = _bitCount;
        this->_bitCount = 0;
        this->_cardTemp = 0;
        this->_cardTempHigh = 0;

        return true;
      } else  // wiegand 26 or wiegand 34
      {
        cardID = get_card_id_(&this->_cardTempHigh, &this->_cardTemp, this->_bitCount);
        this->_wiegandType = _bitCount;
        this->_bitCount = 0;
        this->_cardTemp = 0;
        this->_cardTempHigh = 0;
        this->_code = cardID;
        return true;
      }
    } else {
      // well time over 25 ms and bitCount !=8 , !=26, !=34 , must be noise or nothing then.
      this->_lastWiegand = sysTick;
      this->_bitCount = 0;
      this->_cardTemp = 0;
      this->_cardTempHigh = 0;
      return false;
    }
  } else
    return false;
}

void WiegandReader::setup() {
  this->pin_d0_->pin_mode(gpio::FLAG_INPUT);
  this->pin_d1_->pin_mode(gpio::FLAG_INPUT);

  _lastWiegand = 0;
  _cardTempHigh = 0;
  _cardTemp = 0;
  _code = 0;
  _wiegandType = 0;
  _bitCount = 0;

  this->dump_config();

  this->pin_d0_->attach_interrupt(WiegandReader::read_d0_, this, gpio::INTERRUPT_FALLING_EDGE);
  this->pin_d1_->attach_interrupt(WiegandReader::read_d1_, this, gpio::INTERRUPT_FALLING_EDGE);
}

std::string WiegandReader::get_code_hex_(std::string rawCode) {
  std::size_t dataStart = rawCode.find_first_not_of("0");
  if (dataStart != std::string::npos) {
    return str_snake_case(rawCode.substr(dataStart));
  } else {
    return str_snake_case(rawCode);
  }
}

void WiegandReader::update() {
  InterruptLock lock;
  if (this->do_wiegand_conversion_()) {
    char buffer[17];
    auto *address16 = reinterpret_cast<uint16_t *>(&(this->_code));
    snprintf(buffer, sizeof(buffer), "%04X%04X%04X%04X", address16[3], address16[2], address16[1], address16[0]);
    auto codeStr = std::string(buffer);
    std::string code = get_code_hex_(codeStr);

    ESP_LOGD(TAG, "Data received : %s", code.c_str());

    for (auto *trigger : this->triggers_) {
      trigger->process(code);
    }
  }
}

void WiegandReader::set_data_pins(InternalGPIOPin *pin_d0, InternalGPIOPin *pin_d1) {
  this->pin_d0_ = pin_d0;
  this->pin_d1_ = pin_d1;
}

float WiegandReader::get_setup_priority() const { return setup_priority::DATA; }

void WiegandReader::dump_config() {
  ESP_LOGCONFIG(TAG, "WiegandReader:");
  LOG_PIN("  DO Pin: ", this->pin_d0_);
  LOG_PIN("  D1 Pin: ", this->pin_d1_);
  LOG_UPDATE_INTERVAL(this);
}

void WiegandReaderTrigger::process(std::string tag) { this->trigger(tag.c_str()); }

}  // namespace wiegand_reader
}  // namespace esphome
