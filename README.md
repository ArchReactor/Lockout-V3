# AR Lockout Project

This is a node script which looks up the list of allowed users for a given group, then builds an ESPHome image that will allow the given users to use the locked out tools.

## Building the docker image

To build the docker image, run:

```
sudo docker build -t ar-lockout .
```

This will build a docker image you can use to run the builder, or update lockouts once they've been deployed.


## Deploying a new lockout

To initially flash an ESP to work as a lockout, you'll need to do a couple things.  The first is to generate and flash the device with an ESPHome image.  To generate the initial image, run the following:

```
docker run -it --rm \
    -v /tmp/lockout-templates:/tmp/lockout-templates \
    ar-lockout \
    --initial \
    --key <CIVICRM_KEY> \
    --apiKey <CIVICRM_API_KEY> \
    --group <CIVICRM_GROUP_ID> \
    --name <LOCKOUT_NAME> \
    --wifiName <WIFI_NAME> \
    --wifiPass <WIFI_PASS> \
    --activeTime <TIME IN SECONDS THE LOCKOUT SHOULD STAY OPEN> \
    --pin <THE PIN WE SHOULD SWITCH FOR RELAY CONTROL NORMALLY "D7">
    --ip <IP FOR THE LOCKOUT> \
    --gateway <THE ROUTER GATEWAY> \
    --subnet <THE NETWORK SUBNET> \
    --dns <THE DNS SERVER> \
    --output /tmp/lockout-templates
```

This will run the builder, and write the resulting template file to the dir specified in the `output` arg.  This dir should be the same one you mount with the docker volume command, otherwise you won't be able to access the resulting template file.

Once you have the template file, you'll need to flash it to an ESP.  Plug the ESP into your local system and run the following command:

```
cd /tmp/lockout-templates/
esphome logs <LOCKOUT_NAME>.yaml

docker run -it --rm \
    -v /tmp/lockout-templates:/config \
    --device /dev/ttyUSB0 \
    --entrypoint /root/.local/bin/esphome \ 
    ar-lockout 
    run /config/<LOCKOUT NAME>.yaml
```

This will flash a device connected via USB with the template file you just generated.

After that you'll need to login to the router and set a static IP for the ESP.  That IP should be the once you set on the command line above.  In the future, that static IP can be used to update the lockout wirelessly.

## Updating an existing lockout

To update an existing lockout, you'll use almost the same script as above, but without the initial option:

```
docker run -it --rm \
    -v /tmp/lockout-templates:/tmp/lockout-templates \
    ar-lockout \
    --key <CIVICRM_KEY> \
    --apiKey <CIVICRM_API_KEY> \
    --group <CIVICRM_GROUP_ID> \
    --name <LOCKOUT_NAME> \
    --wifiName <WIFI_NAME> \
    --wifiPass <WIFI_PASS> \
    --activeTime <TIME IN SECONDS THE LOCKOUT SHOULD STAY OPEN> \
    --pin <THE PIN WE SHOULD SWITCH FOR RELAY CONTROL NORMALLY "D7">
    --ip <IP FOR THE LOCKOUT> \
    --gateway <THE ROUTER GATEWAY> \
    --subnet <THE NETWORK SUBNET> \
    --dns <THE DNS SERVER> \
    --output /tmp/lockout-templates
```

This script will generate a fresh template and remotely flash it to the ESP at the provided static IP.

## Troubleshooting

If the lockout isn't working the way you expect, the first thing to check is the logs.  To fetch the logs for a given lockout, run:

```
cd /tmp/lockout-templates/
docker run -it --rm \
    -v /tmp/lockout-templates:/config \
    --device /dev/ttyUSB0 \
    --entrypoint /root/.local/bin/esphome \ 
    ar-lockout 
    logs /config/<LOCKOUT NAME>.yaml
```

This will connect to the lockout and begin printing out log messages.
