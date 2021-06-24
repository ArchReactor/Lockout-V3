# AR Lockout Project

# Components

## Builder

This is a node script which looks up the list of allowed users for a given group, then builds an ESPHome image that will allow the given users to use the locked out tools.

```
npm run build -- \
    --key CIVICRM-KEY \
    --apiKey CIVICRM-API-KEY \
    --name Welder \
    --group CIVICRM-GROUP-ID \
    --activeTime 5 \
    --ip 10.20.30.40 \
    --nodeRed 'https://nodered.archreactor.net' \
    --wifiSsid WifiName \
    --wifiPass superSecredPassword \
    --espHomeRepo "git@github.com:rtward/esphome.git" \
    --espHomeBranch 211_weigand_reader
```

## Template

This is the template ESPHome config file that is customized by the builder script.


