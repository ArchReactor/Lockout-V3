#pragma once

#include "esphome/core/hal.h"
#include "esphome/core/component.h"
#include "esphome/core/automation.h"

namespace esphome {
namespace wiegand_reader {

class WiegandReaderTrigger : public Trigger<std::string> {
 public:
  void process(std::string tag);
};

class WiegandReader : public PollingComponent {
 public:
  void setup() override;
  void set_data_pins(InternalGPIOPin *pin_d0, InternalGPIOPin *pin_d1);
  void dump_config() override;
  void update() override;
  float get_setup_priority() const override;
  void register_trigger(WiegandReaderTrigger *trig) { this->triggers_.push_back(trig); }

 protected:
  unsigned long get_code_();
  bool do_wiegand_conversion_();

  InternalGPIOPin *pin_d0_;
  InternalGPIOPin *pin_d1_;
  std::vector<WiegandReaderTrigger *> triggers_;

  volatile unsigned long _cardTempHigh;
  volatile unsigned long _cardTemp;
  volatile unsigned long _lastWiegand;
  volatile int _bitCount;
  int _wiegandType;
  unsigned long _code;

  static void read_d0_(WiegandReader *reader);
  static void read_d1_(WiegandReader *reader);
  static unsigned long get_card_id_(volatile unsigned long *codehigh, volatile unsigned long *codelow, char bitlength);
  static char translate_enter_escape_keypress_(char originalKeyPress);
  static std::string get_code_hex_(std::string);
};

}  // namespace wiegand_reader
}  // namespace esphome
